/**
 * Route & Geocoding Services
 * Provides location search (geocoding), reverse geocoding, real turn-by-turn road routing,
 * and custom route persistence.
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  placeId: string;
  name: string;
  displayName: string;
  city?: string;
  country?: string;
  lat: number;
  lng: number;
  type?: string;
}

export interface CustomRouteItem {
  id: string;
  name: string;
  city: string;
  description: string;
  origin: LatLngPoint;
  destination: LatLngPoint;
  originName: string;
  destinationName: string;
  defaultSpeedKmh: number;
  outagePct: number;
  outageDurationSec: number;
  environment: 'Tunnel' | 'Underpass' | 'Urban Canyon' | 'Dense Forest' | 'EMI Jamming';
  createdAt: number;
  distanceKm?: number;
  isCustom: true;
}

const CUSTOM_ROUTES_STORAGE_KEY = 'isro_dr_custom_routes_v1';

/**
 * Search places anywhere in the world using OpenStreetMap Nominatim
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const encoded = encodeURIComponent(trimmed);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&addressdetails=1&limit=6`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ISRO-DeadReckoning-RoutePlanner/1.0',
      },
      signal,
    });

    if (!res.ok) {
      throw new Error(`Nominatim HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      const addr = item.address || {};
      const cityName =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.county ||
        addr.state_district ||
        addr.state ||
        '';
      const countryName = addr.country || '';

      // Title formatting
      const primaryName =
        item.name ||
        addr.road ||
        addr.suburb ||
        addr.neighbourhood ||
        item.display_name.split(',')[0];

      return {
        placeId: String(item.place_id || `${item.lat}_${item.lon}`),
        name: primaryName,
        displayName: item.display_name,
        city: cityName,
        country: countryName,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type || item.class || 'place',
      };
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return [];
    }
    console.warn('searchPlaces warning:', err);
    return [];
  }
}

/**
 * Reverse geocode a latitude/longitude coordinate to a human-readable place description
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ISRO-DeadReckoning-RoutePlanner/1.0',
      },
      signal,
    });

    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();

    if (data && data.display_name) {
      const parts = data.display_name.split(',').map((p: string) => p.trim());
      // Return concise location (top 2-3 tokens)
      return parts.slice(0, 3).join(', ');
    }

    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

/**
 * Compute real turn-by-turn road trajectory using OSRM driving engine
 * Falls back to curved geodesic arc if OSRM is unreachable
 */
export async function fetchDrivingRoute(
  origin: LatLngPoint,
  destination: LatLngPoint,
  signal?: AbortSignal
): Promise<{ coordinates: LatLngPoint[]; distanceMeters: number; durationSec: number }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawCoords: [number, number][] = route.geometry.coordinates;

        // OSRM returns [lng, lat]
        const points: LatLngPoint[] = rawCoords.map(([lng, lat]) => ({ lat, lng }));

        if (points.length >= 2) {
          return {
            coordinates: points,
            distanceMeters: Math.round(route.distance),
            durationSec: Math.round(route.duration),
          };
        }
      }
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn('OSRM router warning, falling back to geodesic synthesis:', err);
    }
  }

  // Fallback to high-resolution geodesic arc
  const fallbackPoints = generateGeodesicCurve(origin, destination, 35);
  const dist = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  return {
    coordinates: fallbackPoints,
    distanceMeters: Math.round(dist),
    durationSec: Math.round(dist / 16.6), // ~60 km/h average
  };
}

/**
 * Haversine formula for spherical distance in meters
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate intermediate curved waypoints between origin & destination to model real road topology
 */
export function generateGeodesicCurve(
  p1: LatLngPoint,
  p2: LatLngPoint,
  steps: number = 30
): LatLngPoint[] {
  const points: LatLngPoint[] = [];
  const midLat = (p1.lat + p2.lat) / 2;
  const midLng = (p1.lng + p2.lng) / 2;
  const dLat = p2.lat - p1.lat;
  const dLng = p2.lng - p1.lng;

  // Curvature normal vector
  const normLat = -dLng * 0.15;
  const normLng = dLat * 0.15;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (1 - t) * (1 - t) * p1.lat + 2 * (1 - t) * t * (midLat + normLat) + t * t * p2.lat;
    const lng = (1 - t) * (1 - t) * p1.lng + 2 * (1 - t) * t * (midLng + normLng) + t * t * p2.lng;
    points.push({ lat, lng });
  }

  return points;
}

/**
 * Load user's saved custom routes from LocalStorage
 */
export function loadSavedCustomRoutes(): CustomRouteItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ROUTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load custom routes from storage:', e);
    return [];
  }
}

/**
 * Save a custom route to LocalStorage
 */
export function saveCustomRouteToStorage(route: CustomRouteItem): CustomRouteItem[] {
  try {
    const current = loadSavedCustomRoutes();
    const existingIndex = current.findIndex((r) => r.id === route.id);
    let updated: CustomRouteItem[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = route;
    } else {
      updated = [route, ...current];
    }
    localStorage.setItem(CUSTOM_ROUTES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save custom route to storage:', e);
    return [];
  }
}

/**
 * Delete a custom route from LocalStorage
 */
export function deleteCustomRouteFromStorage(routeId: string): CustomRouteItem[] {
  try {
    const current = loadSavedCustomRoutes();
    const updated = current.filter((r) => r.id !== routeId);
    localStorage.setItem(CUSTOM_ROUTES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to delete custom route from storage:', e);
    return [];
  }
}
