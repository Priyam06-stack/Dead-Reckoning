/**
 * Route Telemetry Generator
 * Converts real Google Maps route paths into simulated high-rate vehicle kinematics
 * (Forward velocity, longitudinal/lateral accelerations, gyroscope yaw rate, GNSS status, and outages).
 */

import { haversineDistance, calculateBearing, normalizeHeading, degToRad } from './coordinates';
import { NavigationFrame } from '../types/navigation';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface RouteGenerationOptions {
  speedKmh: number; // e.g. 50 km/h
  sampleRateHz: number; // e.g. 2 Hz (dt = 0.5s)
  outageStartPct: number; // e.g. 30 (%)
  outageDurationSec: number; // e.g. 30s
  outageEnvironment?: 'Tunnel' | 'Underpass' | 'Urban Canyon' | 'Dense Forest' | 'EMI Jamming';
  initialAltitude?: number;
}

/**
 * Standard Google Encoded Polyline Decoder
 */
export function decodePolyline(encoded: string): LatLngPoint[] {
  const points: LatLngPoint[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }

  return points;
}

/**
 * Converts a sequence of real LatLng waypoints into continuous time-stepped vehicle telemetry
 */
export function generateTrajectoryFromPath(
  path: LatLngPoint[],
  options: RouteGenerationOptions
): Omit<
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
>[] {
  if (!path || path.length < 2) {
    return [];
  }

  const dt = 1.0 / Math.max(1, options.sampleRateHz);
  const targetSpeedMs = (options.speedKmh * 1000) / 3600; // m/s
  const refAlt = options.initialAltitude ?? 120;

  // 1. Calculate cumulative segment distances along path
  const cumulativeDist: number[] = [0];
  let totalDistanceMeters = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const d = haversineDistance(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
    totalDistanceMeters += d;
    cumulativeDist.push(totalDistanceMeters);
  }

  if (totalDistanceMeters < 5) {
    return [];
  }

  // Calculate duration in seconds
  const totalDurationSec = totalDistanceMeters / targetSpeedMs;
  const numSteps = Math.max(10, Math.floor(totalDurationSec / dt));

  // Determine outage window
  const outageStartSec = (options.outageStartPct / 100) * totalDurationSec;
  const outageEndSec = Math.min(totalDurationSec - 1, outageStartSec + options.outageDurationSec);

  const frames: any[] = [];
  const startTimeMs = Date.now() - numSteps * dt * 1000;

  let prevHeading = calculateBearing(path[0].lat, path[0].lng, path[1].lat, path[1].lng);
  let prevVelocity = 0;

  for (let step = 0; step < numSteps; step++) {
    const t = step * dt;
    const currentDistance = Math.min(totalDistanceMeters, t * targetSpeedMs);

    // Find the two waypoints surrounding this distance
    let segIdx = 0;
    while (segIdx < cumulativeDist.length - 2 && cumulativeDist[segIdx + 1] < currentDistance) {
      segIdx++;
    }

    const segStartDist = cumulativeDist[segIdx];
    const segEndDist = cumulativeDist[segIdx + 1];
    const segSpan = Math.max(0.001, segEndDist - segStartDist);
    const frac = Math.max(0, Math.min(1, (currentDistance - segStartDist) / segSpan));

    // Linear interpolate Lat, Lon
    const pA = path[segIdx];
    const pB = path[segIdx + 1];
    const gtLat = pA.lat + (pB.lat - pA.lat) * frac;
    const gtLon = pA.lng + (pB.lng - pA.lng) * frac;

    // Heading calculation
    let currentBearing = calculateBearing(pA.lat, pA.lng, pB.lat, pB.lng);

    // Smooth heading transition across turn boundaries
    let headingDiff = currentBearing - prevHeading;
    if (headingDiff > 180) headingDiff -= 360;
    if (headingDiff < -180) headingDiff += 360;
    const smoothedHeading = normalizeHeading(prevHeading + headingDiff * 0.35);

    // Angular yaw rate (deg/s)
    const gyroZ = headingDiff / dt;
    prevHeading = smoothedHeading;

    // Velocity profile with gentle start ramp
    const speedRamp = Math.min(1, step / 5);
    const currentSpeed = targetSpeedMs * speedRamp;
    const accelForward = (currentSpeed - prevVelocity) / dt;
    prevVelocity = currentSpeed;

    // Lateral acceleration a = v * omega (rad/s)
    const gyroZRad = degToRad(gyroZ);
    const accelLateral = currentSpeed * gyroZRad;

    // GNSS availability
    const isOutage = t >= outageStartSec && t <= outageEndSec;
    const gnssAvailable = !isOutage;

    // Civilian GNSS jitter (~1m random error)
    let gnssLat: number | null = null;
    let gnssLon: number | null = null;
    let gnssQuality = 1.0;

    if (gnssAvailable) {
      // 1 meter in latitude degrees ~ 1 / 111139
      const jitterLat = ((Math.random() - 0.5) * 1.5) / 111139;
      const jitterLon = ((Math.random() - 0.5) * 1.5) / (111139 * Math.cos(degToRad(gtLat)));
      gnssLat = gtLat + jitterLat;
      gnssLon = gtLon + jitterLon;
      gnssQuality = 0.95 + Math.random() * 0.05;
    } else {
      gnssLat = null;
      gnssLon = null;
      gnssQuality = 0.0;
    }

    frames.push({
      index: step,
      timestamp: startTimeMs + Math.round(t * 1000),
      relativeSec: Math.round(t * 10) / 10,
      gtLat,
      gtLon,
      gtAlt: refAlt + Math.sin(t * 0.1) * 2,
      gtVelocity: currentSpeed,
      gtHeading: smoothedHeading,
      gnssAvailable,
      gnssLat,
      gnssLon,
      gnssAlt: gnssAvailable ? refAlt : null,
      gnssQuality,
      accelX: accelForward,
      accelY: accelLateral,
      accelZ: 9.81 + (Math.random() - 0.5) * 0.05,
      gyroX: (Math.random() - 0.5) * 0.2,
      gyroY: (Math.random() - 0.5) * 0.2,
      gyroZ: gyroZ + (Math.random() - 0.5) * 0.1,
      odometrySpeed: currentSpeed * (1 + (Math.random() - 0.5) * 0.01),
    });
  }

  return frames;
}
