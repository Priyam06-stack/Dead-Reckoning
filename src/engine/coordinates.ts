/**
 * Real Geodetic & Coordinate Transformations for Navigation Systems
 * WGS-84 Ellipsoid and Local Tangent Plane (East-North-Up / ENU)
 */

export const WGS84_A = 6378137.0; // Semi-major axis (meters)
export const WGS84_F = 1.0 / 298.257223563; // Flattening
export const WGS84_B = WGS84_A * (1.0 - WGS84_F); // Semi-minor axis
export const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F; // First eccentricity squared

export interface LatLonAlt {
  lat: number;
  lon: number;
  alt?: number;
}

export interface ENUPoint {
  east: number;  // meters
  north: number; // meters
  up: number;    // meters
}

/**
 * Degrees to Radians
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180.0;
}

/**
 * Radians to Degrees
 */
export function radToDeg(rad: number): number {
  return (rad * 180.0) / Math.PI;
}

/**
 * Normalize angle to [0, 360) degrees
 */
export function normalizeHeading(deg: number): number {
  let h = deg % 360;
  if (h < 0) h += 360;
  return h;
}

/**
 * Haversine distance between two lat/lon coordinates in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Mean Earth radius in meters
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  const rLat1 = degToRad(lat1);
  const rLat2 = degToRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate initial forward azimuth/bearing from pt1 to pt2 in degrees [0, 360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = degToRad(lat1);
  const phi2 = degToRad(lat2);
  const deltaLambda = degToRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return normalizeHeading(radToDeg(theta));
}

/**
 * Convert Geodetic (Lat, Lon, Alt) to Earth-Centered Earth-Fixed (ECEF) [X, Y, Z]
 */
export function geodeticToEcef(lat: number, lon: number, alt: number = 0): [number, number, number] {
  const phi = degToRad(lat);
  const lambda = degToRad(lon);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLambda = Math.sin(lambda);
  const cosLambda = Math.cos(lambda);

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);

  const x = (N + alt) * cosPhi * cosLambda;
  const y = (N + alt) * cosPhi * sinLambda;
  const z = (N * (1 - WGS84_E2) + alt) * sinPhi;

  return [x, y, z];
}

/**
 * Convert ECEF [X, Y, Z] to Geodetic (Lat, Lon, Alt)
 */
export function ecefToGeodetic(x: number, y: number, z: number): LatLonAlt {
  const p = Math.sqrt(x * x + y * y);
  const theta = Math.atan2(z * WGS84_A, p * WGS84_B);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  const phi = Math.atan2(
    z + (WGS84_E2 * WGS84_A * WGS84_A / WGS84_B) * Math.pow(sinTheta, 3),
    p - (WGS84_E2 * WGS84_A) * Math.pow(cosTheta, 3)
  );

  const lambda = Math.atan2(y, x);
  const sinPhi = Math.sin(phi);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);
  const alt = p / Math.cos(phi) - N;

  return {
    lat: radToDeg(phi),
    lon: radToDeg(lambda),
    alt: alt,
  };
}

/**
 * Convert Geodetic coordinates to Local Tangent Plane ENU relative to ref
 */
export function geodeticToEnu(
  lat: number,
  lon: number,
  alt: number,
  refLat: number,
  refLon: number,
  refAlt: number
): ENUPoint {
  const [x, y, z] = geodeticToEcef(lat, lon, alt);
  const [refX, refY, refZ] = geodeticToEcef(refLat, refLon, refAlt);

  const dx = x - refX;
  const dy = y - refY;
  const dz = z - refZ;

  const phi = degToRad(refLat);
  const lambda = degToRad(refLon);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLambda = Math.sin(lambda);
  const cosLambda = Math.cos(lambda);

  const east = -sinLambda * dx + cosLambda * dy;
  const north = -sinPhi * cosLambda * dx - sinPhi * sinLambda * dy + cosPhi * dz;
  const up = cosPhi * cosLambda * dx + cosPhi * sinLambda * dy + sinPhi * dz;

  return { east, north, up };
}

/**
 * Convert Local Tangent Plane ENU back to Geodetic (Lat, Lon, Alt)
 */
export function enuToGeodetic(
  east: number,
  north: number,
  up: number,
  refLat: number,
  refLon: number,
  refAlt: number
): LatLonAlt {
  const [refX, refY, refZ] = geodeticToEcef(refLat, refLon, refAlt);

  const phi = degToRad(refLat);
  const lambda = degToRad(refLon);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLambda = Math.sin(lambda);
  const cosLambda = Math.cos(lambda);

  const dx = -sinLambda * east - sinPhi * cosLambda * north + cosPhi * cosLambda * up;
  const dy = cosLambda * east - sinPhi * sinLambda * north + cosPhi * sinLambda * up;
  const dz = cosPhi * north + sinPhi * up;

  return ecefToGeodetic(refX + dx, refY + dy, refZ + dz);
}
