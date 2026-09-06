/**
 * Benchmark Datasets & Vehicle Trajectory Scenarios
 * Includes:
 * 1. Bengaluru Urban Canyon & Underpass (ISRO HQ vicinity)
 * 2. High-Speed Highway Tunnel (Atal Tunnel Corridor)
 * 3. Multi-Level Spiral Parking Facility
 * 4. IO-VNBD Benchmark Sample Format
 */

import { NavigationFrame } from '../types/navigation';
import { enuToGeodetic, calculateBearing } from '../engine/coordinates';

export interface DatasetScenario {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  environment: string;
  outageRange: [number, number]; // [startSec, endSec]
  initialCoordinates: [number, number];
  generateFrames: () => Omit<
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
  >[];
}

/**
 * Helper to generate synthetic realistic vehicle trajectories with physical sensor dynamics
 */
function createTrajectoryGenerator(
  refLat: number,
  refLon: number,
  refAlt: number,
  durationSec: number,
  dt: number,
  outageStart: number,
  outageEnd: number,
  trajectoryProfile: (
    t: number
  ) => {
    speed: number;
    yawRate: number;
    accelForward: number;
    accelLateral: number;
  }
) {
  const frames: any[] = [];
  const steps = Math.floor(durationSec / dt);

  let currentEast = 0;
  let currentNorth = 0;
  let currentHeading = 0; // degrees (0 = North)

  const startTime = 1715000000000; // Epoch timestamp in ms

  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const profile = trajectoryProfile(t);

    const speed = profile.speed;
    const yawRate = profile.yawRate;

    // Update orientation & position in local ENU
    currentHeading = (currentHeading + yawRate * dt) % 360;
    if (currentHeading < 0) currentHeading += 360;

    const headingRad = (currentHeading * Math.PI) / 180.0;
    const dEast = speed * Math.sin(headingRad) * dt;
    const dNorth = speed * Math.cos(headingRad) * dt;

    currentEast += dEast;
    currentNorth += dNorth;

    // Convert to Geodetic
    const gtGeo = enuToGeodetic(currentEast, currentNorth, 0, refLat, refLon, refAlt);

    // GNSS availability & noise
    const isOutage = t >= outageStart && t <= outageEnd;
    const gnssAvailable = !isOutage;

    // In normal GNSS, standard civilian GPS jitter is ~1.5 - 2.5 meters
    let gnssLat: number | null = null;
    let gnssLon: number | null = null;
    let gnssQuality = 1.0;

    if (gnssAvailable) {
      const jitterEast = (Math.random() - 0.5) * 2.0;
      const jitterNorth = (Math.random() - 0.5) * 2.0;
      const gnssGeo = enuToGeodetic(
        currentEast + jitterEast,
        currentNorth + jitterNorth,
        0,
        refLat,
        refLon,
        refAlt
      );
      gnssLat = gnssGeo.lat;
      gnssLon = gnssGeo.lon;
      gnssQuality = 0.95 + (Math.random() - 0.5) * 0.05;
    } else {
      gnssQuality = 0.0;
    }

    // Accelerometer readings (forward, lateral, vertical + gravity 9.81)
    const accelX = profile.accelForward + (Math.random() - 0.5) * 0.15;
    const accelY = profile.accelLateral + (Math.random() - 0.5) * 0.15;
    const accelZ = 9.81 + (Math.random() - 0.5) * 0.2;

    // Gyroscope readings (roll, pitch, yaw rate + noise)
    const gyroX = (Math.random() - 0.5) * 0.2;
    const gyroY = (Math.random() - 0.5) * 0.2;
    const gyroZ = yawRate + (Math.random() - 0.5) * 0.1;

    // Wheel odometry speed with minor wheel slip / measurement noise
    const odoNoise = (Math.random() - 0.5) * 0.15;
    const odometrySpeed = Math.max(0, speed + odoNoise);

    frames.push({
      index: i,
      timestamp: startTime + t * 1000,
      relativeSec: Number(t.toFixed(2)),
      gtLat: gtGeo.lat,
      gtLon: gtGeo.lon,
      gtAlt: refAlt,
      gtVelocity: speed,
      gtHeading: currentHeading,
      gnssAvailable,
      gnssLat,
      gnssLon,
      gnssAlt: gnssAvailable ? refAlt : null,
      gnssQuality,
      accelX: Number(accelX.toFixed(3)),
      accelY: Number(accelY.toFixed(3)),
      accelZ: Number(accelZ.toFixed(3)),
      gyroX: Number(gyroX.toFixed(3)),
      gyroY: Number(gyroY.toFixed(3)),
      gyroZ: Number(gyroZ.toFixed(3)),
      odometrySpeed: Number(odometrySpeed.toFixed(2)),
    });
  }

  return frames;
}

export const BENCHMARK_SCENARIOS: DatasetScenario[] = [
  {
    id: 'bengaluru-urban-underpass',
    name: 'Bengaluru Urban Underpass (ISRO HQ Vicinity)',
    description:
      'Vehicle navigating through New BEL Road arterial corridor into an underpass tunnel with 45s GNSS loss, S-curve turning, and signal recovery.',
    durationSec: 120,
    environment: 'Underpass / Urban Canyon',
    outageRange: [35, 80], // 45 seconds outage
    initialCoordinates: [13.0382, 77.5684], // Antariksh Bhavan / ISRO HQ, Bengaluru
    generateFrames: () => {
      const dt = 0.5; // 2 Hz sampling
      return createTrajectoryGenerator(
        13.0382,
        77.5684,
        920,
        120,
        dt,
        35,
        80,
        (t) => {
          let speed = 12.0; // ~43 km/h
          let yawRate = 0;
          let accelForward = 0;
          let accelLateral = 0;

          if (t < 20) {
            speed = 11.5;
            yawRate = 0.5; // slight road curvature
          } else if (t >= 20 && t < 35) {
            // Turning right onto ramp
            speed = 9.0;
            yawRate = 3.5;
            accelLateral = 1.2;
          } else if (t >= 35 && t < 55) {
            // Underpass straight section (OUTAGE ACTIVE)
            speed = 13.0;
            yawRate = 0.2;
            accelForward = 0.4;
          } else if (t >= 55 && t < 72) {
            // Underpass S-curve curve (OUTAGE ACTIVE)
            speed = 10.5;
            yawRate = -4.2;
            accelLateral = -1.8;
          } else if (t >= 72 && t <= 80) {
            // Emerging from underpass
            speed = 11.0;
            yawRate = 1.8;
          } else {
            // Post-recovery open road
            speed = 12.5;
            yawRate = 0.0;
          }

          return { speed, yawRate, accelForward, accelLateral };
        }
      );
    },
  },

  {
    id: 'highway-mountain-tunnel',
    name: 'Himalayan Highway Tunnel (Atal Tunnel Corridor)',
    description:
      'High-speed 60 km/h vehicle transit through a sustained 65-second mountain tunnel black-out with continuous velocity and gradual bore curvature.',
    durationSec: 150,
    environment: 'Deep Mountain Tunnel',
    outageRange: [40, 105], // 65 seconds outage
    initialCoordinates: [32.3619, 77.1643], // Atal Tunnel North Portal
    generateFrames: () => {
      const dt = 0.5;
      return createTrajectoryGenerator(
        32.3619,
        77.1643,
        3060,
        150,
        dt,
        40,
        105,
        (t) => {
          let speed = 16.5; // ~60 km/h
          let yawRate = 0;
          let accelForward = 0;
          let accelLateral = 0;

          if (t >= 40 && t < 105) {
            // Inside tunnel: slight continuous curvature of the mountain bore
            yawRate = 0.85; // steady curve creates significant gyro bias drift!
            accelLateral = 0.45;
          } else if (t > 105) {
            yawRate = -1.2; // exiting onto valley road
            speed = 14.0;
          }

          return { speed, yawRate, accelForward, accelLateral };
        }
      );
    },
  },

  {
    id: 'multilevel-spiral-parking',
    name: 'Multi-Level Spiral Parking Facility',
    description:
      'Challenging continuous high-yaw-rate circular descent inside a concrete multi-storey structure with complete RF shielding.',
    durationSec: 100,
    environment: 'Multi-level Parking Ramp',
    outageRange: [20, 80], // 60 seconds outage
    initialCoordinates: [12.9716, 77.5946], // Central Bengaluru
    generateFrames: () => {
      const dt = 0.5;
      return createTrajectoryGenerator(
        12.9716,
        77.5946,
        910,
        100,
        dt,
        20,
        80,
        (t) => {
          let speed = 4.5; // slow tight ramp speed
          let yawRate = 0;
          let accelLateral = 0;

          if (t >= 20 && t <= 80) {
            // Spiral helical turns
            yawRate = 12.0; // 12 deg/s circular turn
            accelLateral = (speed * (yawRate * Math.PI / 180));
          }

          return { speed, yawRate, accelForward: 0, accelLateral };
        }
      );
    },
  },

  {
    id: 'io-vnbd-benchmark',
    name: 'IO-VNBD Benchmark Track (Onyekpeu Format)',
    description:
      'Official IO-VNBD dataset schema emulation featuring vehicle odometry pulses, 6-DoF IMU logs, and simulated urban canyon outages.',
    durationSec: 110,
    environment: 'Urban Canyon / Dense Forest',
    outageRange: [30, 75],
    initialCoordinates: [13.0827, 80.2707], // Chennai Urban Center
    generateFrames: () => {
      const dt = 0.5;
      return createTrajectoryGenerator(
        13.0827,
        80.2707,
        15,
        110,
        dt,
        30,
        75,
        (t) => {
          let speed = 10.0;
          let yawRate = 0;
          let accelForward = 0;
          let accelLateral = 0;

          if (t >= 30 && t < 50) {
            yawRate = -2.5;
            accelLateral = -0.8;
          } else if (t >= 50 && t <= 75) {
            yawRate = 3.0;
            accelLateral = 1.1;
          }

          return { speed, yawRate, accelForward, accelLateral };
        }
      );
    },
  },
];
