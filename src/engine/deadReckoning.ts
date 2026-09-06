/**
 * Core Dead Reckoning Engine & Sensor Fusion Pipeline
 *
 * Implements:
 * 1. GNSS Ground Reference & Sensor Calibration
 * 2. Raw Inertial/Odometry Dead Reckoning (with genuine bias integration)
 * 3. AI/ML-assisted Drift Compensated Dead Reckoning
 * 4. Smooth GNSS Re-alignment & Recovery Filter
 */

import {
  NavigationFrame,
  OutageInterval,
  TrajectorySummary,
  NavMode,
} from '../types/navigation';
import {
  geodeticToEnu,
  enuToGeodetic,
  haversineDistance,
  normalizeHeading,
  degToRad,
} from './coordinates';
import { globalNavModel } from './mlModel';

export interface DeadReckoningConfig {
  gyroBiasDegPerSec?: number; // Injected realistic gyro bias (e.g. 0.35 deg/s)
  odometrySlipFactor?: number; // Wheel slip coefficient during sharp turns
  enableAiCorrection?: boolean;
  recoverySmoothingTimeSec?: number; // Smoothing window for GNSS recovery (default 2.5s)
}

export function processNavigationDataset(
  rawFrames: Omit<
    NavigationFrame,
    | 'rawDrLat'
    | 'rawDrLon'
    | 'rawDrHeading'
    | 'rawDrVelocity'
    | 'rawDrErrorMeters'
    | 'aiDrLat'
    | 'aiDrLon'
    | 'aiDrHeading'
    | 'aiDrVelocity'
    | 'aiDrErrorMeters'
    | 'aiCorrectionMag'
    | 'mode'
    | 'isOutage'
  >[],
  config: DeadReckoningConfig = {}
): TrajectorySummary {
  if (!rawFrames || rawFrames.length === 0) {
    return {
      frames: [],
      outages: [],
      metrics: {
        totalDurationSec: 0,
        totalDistanceMeters: 0,
        gnssRMSE: 0,
        rawDrRMSE: 0,
        aiDrRMSE: 0,
        rawDrMAE: 0,
        aiDrMAE: 0,
        rawMaxError: 0,
        aiMaxError: 0,
        finalRawDrError: 0,
        finalAiDrError: 0,
        overallImprovementPct: 0,
        rawDriftRateMps: 0,
        aiDriftRateMps: 0,
      },
    };
  }

  const gyroBias = config.gyroBiasDegPerSec ?? 0.38; // standard automotive MEMS gyro bias
  const recoveryWindowSec = config.recoverySmoothingTimeSec ?? 2.5;

  // Set reference datum to initial ground-truth position
  const refLat = rawFrames[0].gtLat;
  const refLon = rawFrames[0].gtLon;
  const refAlt = rawFrames[0].gtAlt;

  // State variables for Raw Dead Reckoning
  let rawEast = 0;
  let rawNorth = 0;
  let rawHeading = rawFrames[0].gtHeading;

  // State variables for AI-Enhanced Dead Reckoning
  let aiEast = 0;
  let aiNorth = 0;
  let aiHeading = rawFrames[0].gtHeading;

  // Outage state tracking
  let inOutage = false;
  let outageStartTime = 0;
  let outageStartIndex = 0;
  let currentOutageId = 0;
  const outages: OutageInterval[] = [];

  // Recovery smoothing state
  let recoveryStartTime: number | null = null;
  let recoveryOffsetEast = 0;
  let recoveryOffsetNorth = 0;

  const processedFrames: NavigationFrame[] = [];

  let totalGnssSqError = 0;
  let totalRawSqError = 0;
  let totalAiSqError = 0;
  let totalRawAbsError = 0;
  let totalAiAbsError = 0;
  let rawMaxError = 0;
  let aiMaxError = 0;
  let totalDistance = 0;

  for (let i = 0; i < rawFrames.length; i++) {
    const frame = rawFrames[i];
    const prevFrame = i > 0 ? rawFrames[i - 1] : null;
    const dt = prevFrame ? Math.max(0.01, frame.relativeSec - prevFrame.relativeSec) : 0.1;

    // Convert Ground Truth to ENU
    const gtEnu = geodeticToEnu(frame.gtLat, frame.gtLon, frame.gtAlt, refLat, refLon, refAlt);

    if (prevFrame) {
      totalDistance += haversineDistance(
        prevFrame.gtLat,
        prevFrame.gtLon,
        frame.gtLat,
        frame.gtLon
      );
    }

    // Determine GNSS availability
    const isOutage = !frame.gnssAvailable || frame.gnssQuality < 0.2;

    // Outage state machine
    if (isOutage && !inOutage) {
      // Outage just started
      inOutage = true;
      currentOutageId++;
      outageStartTime = frame.relativeSec;
      outageStartIndex = i;
      recoveryStartTime = null;
    } else if (!isOutage && inOutage) {
      // Outage just ended -> Transition to GNSS RECOVERY
      inOutage = false;
      const duration = frame.relativeSec - outageStartTime;

      // Slice outage frames to calculate outage metrics
      const outageFrames = processedFrames.slice(outageStartIndex, i);
      const rawPeak = outageFrames.reduce((max, f) => Math.max(max, f.rawDrErrorMeters), 0);
      const aiPeak = outageFrames.reduce((max, f) => Math.max(max, f.aiDrErrorMeters), 0);
      const rawFinal = outageFrames.length > 0 ? outageFrames[outageFrames.length - 1].rawDrErrorMeters : 0;
      const aiFinal = outageFrames.length > 0 ? outageFrames[outageFrames.length - 1].aiDrErrorMeters : 0;
      const improvement = rawPeak > 0 ? Math.round(((rawPeak - aiPeak) / rawPeak) * 100) : 0;

      const avgSpeed =
        outageFrames.reduce((sum, f) => sum + f.odometrySpeed, 0) /
        Math.max(1, outageFrames.length);

      outages.push({
        id: currentOutageId,
        startSec: outageStartTime,
        endSec: frame.relativeSec,
        durationSec: duration,
        startIndex: outageStartIndex,
        endIndex: i,
        environment:
          duration > 40
            ? 'Tunnel'
            : duration > 20
            ? 'Underpass'
            : 'Urban Canyon',
        rawPeakErrorMeters: Number(rawPeak.toFixed(2)),
        rawFinalErrorMeters: Number(rawFinal.toFixed(2)),
        aiPeakErrorMeters: Number(aiPeak.toFixed(2)),
        aiFinalErrorMeters: Number(aiFinal.toFixed(2)),
        improvementPct: Math.max(0, improvement),
        avgVelocityMs: Number(avgSpeed.toFixed(1)),
      });

      // Start recovery smoothing
      recoveryStartTime = frame.relativeSec;
      // Innovation vector for raw DR
      recoveryOffsetEast = rawEast - gtEnu.east;
      recoveryOffsetNorth = rawNorth - gtEnu.north;
    }

    // Determine current Navigation Mode
    let mode: NavMode = 'GNSS';
    if (inOutage) {
      mode = 'AI_ENHANCED_DR';
    } else if (
      recoveryStartTime !== null &&
      frame.relativeSec - recoveryStartTime < recoveryWindowSec
    ) {
      mode = 'GNSS_RECOVERY';
    } else {
      mode = 'GNSS';
    }

    // ==========================================
    // 1. RAW DEAD RECKONING INTEGRATION
    // ==========================================
    if (!isOutage && mode !== 'GNSS_RECOVERY') {
      // GNSS available: Update state from GNSS measurement
      const gnssEnu = geodeticToEnu(
        frame.gnssLat ?? frame.gtLat,
        frame.gnssLon ?? frame.gtLon,
        frame.gnssAlt ?? frame.gtAlt,
        refLat,
        refLon,
        refAlt
      );
      rawEast = gnssEnu.east;
      rawNorth = gnssEnu.north;
      rawHeading = frame.gtHeading;
    } else {
      // Outage: Propagate via uncorrected Gyro + Odometry
      // Gyro reading has uncompensated bias:
      const measuredGyroZ = frame.gyroZ + gyroBias;
      rawHeading = normalizeHeading(rawHeading + measuredGyroZ * dt);

      // Integrate velocity along heading:
      const v = frame.odometrySpeed;
      const headingRad = degToRad(rawHeading);
      // Navigation angle: 0 deg = North, 90 deg = East
      const dEast = v * Math.sin(headingRad) * dt;
      const dNorth = v * Math.cos(headingRad) * dt;

      rawEast += dEast;
      rawNorth += dNorth;

      if (mode === 'GNSS_RECOVERY' && recoveryStartTime !== null) {
        // Smoothly decay the offset during recovery
        const elapsedRec = frame.relativeSec - recoveryStartTime;
        const alpha = Math.min(1.0, elapsedRec / recoveryWindowSec);
        // Exponential-like easing:
        const decay = Math.cos((alpha * Math.PI) / 2);
        rawEast = gtEnu.east + recoveryOffsetEast * decay;
        rawNorth = gtEnu.north + recoveryOffsetNorth * decay;
      }
    }

    // ==========================================
    // 2. AI/ML ENHANCED DEAD RECKONING INTEGRATION
    // ==========================================
    let aiCorrectionMag = 0;
    if (!isOutage && mode !== 'GNSS_RECOVERY') {
      aiEast = rawEast;
      aiNorth = rawNorth;
      aiHeading = frame.gtHeading;
    } else {
      // Outage or Recovery: Run AI model inference to predict drift compensation
      const outageElapsed = inOutage ? frame.relativeSec - outageStartTime : 0;
      const mlCorrection = globalNavModel.predictCorrection({
        speed: frame.odometrySpeed,
        yawRate: frame.gyroZ + gyroBias,
        accelX: frame.accelX,
        accelY: frame.accelY,
        accelZ: frame.accelZ,
        outageElapsedSec: outageElapsed,
        currentHeadingDeg: aiHeading,
      });

      aiCorrectionMag = mlCorrection.estimatedDriftMagnitudeMeters;

      // Apply ML Heading Drift Correction:
      const correctedGyroZ = frame.gyroZ + gyroBias - mlCorrection.headingCorrectionDegPerSec;
      aiHeading = normalizeHeading(aiHeading + correctedGyroZ * dt);

      // Apply ML Velocity Vector Correction:
      const vCorrected = frame.odometrySpeed + mlCorrection.velocityCorrectionX;
      const headingRad = degToRad(aiHeading);
      // Include lateral slip compensation:
      const dEast =
        (vCorrected * Math.sin(headingRad) - mlCorrection.velocityCorrectionY * Math.cos(headingRad)) * dt;
      const dNorth =
        (vCorrected * Math.cos(headingRad) + mlCorrection.velocityCorrectionY * Math.sin(headingRad)) * dt;

      aiEast += dEast;
      aiNorth += dNorth;

      if (mode === 'GNSS_RECOVERY' && recoveryStartTime !== null) {
        const elapsedRec = frame.relativeSec - recoveryStartTime;
        const alpha = Math.min(1.0, elapsedRec / recoveryWindowSec);
        const decay = Math.cos((alpha * Math.PI) / 2);
        aiEast = gtEnu.east + (aiEast - gtEnu.east) * decay;
        aiNorth = gtEnu.north + (aiNorth - gtEnu.north) * decay;
      }
    }

    // Convert ENU back to Geodetic (Lat, Lon)
    const rawGeo = enuToGeodetic(rawEast, rawNorth, 0, refLat, refLon, refAlt);
    const aiGeo = enuToGeodetic(aiEast, aiNorth, 0, refLat, refLon, refAlt);

    // Errors against Ground Truth in meters
    const rawError = haversineDistance(frame.gtLat, frame.gtLon, rawGeo.lat, rawGeo.lon);
    const aiError = haversineDistance(frame.gtLat, frame.gtLon, aiGeo.lat, aiGeo.lon);
    const gnssError = !isOutage && frame.gnssLat && frame.gnssLon
      ? haversineDistance(frame.gtLat, frame.gtLon, frame.gnssLat, frame.gnssLon)
      : 0;

    totalRawSqError += rawError * rawError;
    totalAiSqError += aiError * aiError;
    totalGnssSqError += gnssError * gnssError;
    totalRawAbsError += rawError;
    totalAiAbsError += aiError;

    if (rawError > rawMaxError) rawMaxError = rawError;
    if (aiError > aiMaxError) aiMaxError = aiError;

    processedFrames.push({
      ...frame,
      rawDrLat: rawGeo.lat,
      rawDrLon: rawGeo.lon,
      rawDrHeading: rawHeading,
      rawDrVelocity: frame.odometrySpeed,
      rawDrErrorMeters: Number(rawError.toFixed(2)),

      aiDrLat: aiGeo.lat,
      aiDrLon: aiGeo.lon,
      aiDrHeading: aiHeading,
      aiDrVelocity: frame.odometrySpeed,
      aiDrErrorMeters: Number(aiError.toFixed(2)),
      aiCorrectionMag: Number(aiCorrectionMag.toFixed(2)),

      mode: mode,
      isOutage: isOutage,
      outageId: inOutage ? currentOutageId : undefined,
    });
  }

  const n = processedFrames.length;
  const rawRMSE = Math.sqrt(totalRawSqError / Math.max(1, n));
  const aiRMSE = Math.sqrt(totalAiSqError / Math.max(1, n));
  const gnssRMSE = Math.sqrt(totalGnssSqError / Math.max(1, n));
  const rawMAE = totalRawAbsError / Math.max(1, n);
  const aiMAE = totalAiAbsError / Math.max(1, n);

  const finalRaw = processedFrames[n - 1]?.rawDrErrorMeters ?? 0;
  const finalAi = processedFrames[n - 1]?.aiDrErrorMeters ?? 0;
  const overallImprovement =
    rawRMSE > 0 ? Math.round(((rawRMSE - aiRMSE) / rawRMSE) * 100) : 0;

  const totalDuration = processedFrames[n - 1]?.relativeSec ?? 0;
  const totalOutageDuration = outages.reduce((acc, o) => acc + o.durationSec, 0);

  return {
    frames: processedFrames,
    outages,
    metrics: {
      totalDurationSec: Number(totalDuration.toFixed(1)),
      totalDistanceMeters: Number(totalDistance.toFixed(1)),
      gnssRMSE: Number(gnssRMSE.toFixed(2)),
      rawDrRMSE: Number(rawRMSE.toFixed(2)),
      aiDrRMSE: Number(aiRMSE.toFixed(2)),
      rawDrMAE: Number(rawMAE.toFixed(2)),
      aiDrMAE: Number(aiMAE.toFixed(2)),
      rawMaxError: Number(rawMaxError.toFixed(2)),
      aiMaxError: Number(aiMaxError.toFixed(2)),
      finalRawDrError: Number(finalRaw.toFixed(2)),
      finalAiDrError: Number(finalAi.toFixed(2)),
      overallImprovementPct: Math.max(0, overallImprovement),
      rawDriftRateMps: Number(
        (totalOutageDuration > 0 ? rawMaxError / totalOutageDuration : 0).toFixed(3)
      ),
      aiDriftRateMps: Number(
        (totalOutageDuration > 0 ? aiMaxError / totalOutageDuration : 0).toFixed(3)
      ),
    },
  };
}
