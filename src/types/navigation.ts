export type NavMode = 'GNSS' | 'DEAD_RECKONING' | 'AI_ENHANCED_DR' | 'GNSS_RECOVERY';

export type GNSSStatus = 'AVAILABLE' | 'SIGNAL_LOST' | 'DEGRADED';

export interface RawSensorRow {
  timestamp: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;
  velocity?: number; // m/s or km/h
  heading?: number; // degrees
  wheelSpeed?: number;
  gnssAvailable?: boolean;
  hdop?: number;
}

export interface NavigationFrame {
  index: number;
  timestamp: number;
  relativeSec: number;
  // Ground truth reference
  gtLat: number;
  gtLon: number;
  gtAlt: number;
  gtVelocity: number;
  gtHeading: number;

  // Raw GNSS measurement (has noise, and is null/flagged during outage)
  gnssAvailable: boolean;
  gnssLat: number | null;
  gnssLon: number | null;
  gnssAlt: number | null;
  gnssQuality: number; // 0 to 1 (1 = best)

  // IMU & Odometry measurements
  accelX: number; // m/s^2 (forward/longitudinal)
  accelY: number; // m/s^2 (lateral)
  accelZ: number; // m/s^2 (vertical)
  gyroX: number;  // deg/s (roll rate)
  gyroY: number;  // deg/s (pitch rate)
  gyroZ: number;  // deg/s (yaw rate)
  odometrySpeed: number; // m/s

  // Computed state - Raw Dead Reckoning
  rawDrLat: number;
  rawDrLon: number;
  rawDrHeading: number;
  rawDrVelocity: number;
  rawDrErrorMeters: number;

  // Computed state - AI-Enhanced Dead Reckoning
  aiDrLat: number;
  aiDrLon: number;
  aiDrHeading: number;
  aiDrVelocity: number;
  aiDrErrorMeters: number;
  aiCorrectionMag: number; // magnitude of drift vector corrected in meters

  // Current operational mode
  mode: NavMode;
  isOutage: boolean;
  outageId?: number;
}

export interface OutageInterval {
  id: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  startIndex: number;
  endIndex: number;
  environment: 'Tunnel' | 'Underpass' | 'Urban Canyon' | 'Dense Forest' | 'EMI Jamming';
  rawPeakErrorMeters: number;
  rawFinalErrorMeters: number;
  aiPeakErrorMeters: number;
  aiFinalErrorMeters: number;
  improvementPct: number;
  avgVelocityMs: number;
}

export interface TrajectorySummary {
  frames: NavigationFrame[];
  outages: OutageInterval[];
  metrics: {
    totalDurationSec: number;
    totalDistanceMeters: number;
    gnssRMSE: number;
    rawDrRMSE: number;
    aiDrRMSE: number;
    rawDrMAE: number;
    aiDrMAE: number;
    rawMaxError: number;
    aiMaxError: number;
    finalRawDrError: number;
    finalAiDrError: number;
    overallImprovementPct: number;
    rawDriftRateMps: number;
    aiDriftRateMps: number;
  };
}

export interface MLModelConfig {
  architecture: 'Physics-Informed Residual MLP' | 'Temporal 1D-CNN' | 'TCN Recurrent Regressor';
  featureWindowSize: number; // sliding window size (e.g. 5 steps)
  features: string[];
  learningRate: number;
  hiddenLayers: number[];
  trainedEpochs: number;
  valLoss: number;
  inferenceMode: 'Client Edge Inference' | 'Backend API Service';
  apiEndpoint?: string;
  isTrained: boolean;
}

export interface ColumnMapping {
  timestamp: string;
  latitude: string;
  longitude: string;
  altitude: string;
  accelX: string;
  accelY: string;
  accelZ: string;
  gyroX: string;
  gyroY: string;
  gyroZ: string;
  velocity: string;
  heading: string;
  wheelSpeed: string;
  gnssAvailable: string;
}
