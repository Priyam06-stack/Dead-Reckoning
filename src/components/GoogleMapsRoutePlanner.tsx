// Source: Google Maps Platform Code Assist
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
  MapMouseEvent,
} from "@vis.gl/react-google-maps";
import L from "leaflet";
import {
  MapPin,
  Navigation,
  Route as RouteIcon,
  Play,
  RotateCcw,
  Sliders,
  ShieldAlert,
  Compass,
  ArrowRightLeft,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  Gauge,
  Layers,
  Plus,
  Trash2,
  Bookmark,
  Sparkles,
  Save,
  X,
  Check,
  Search,
  Crosshair,
} from "lucide-react";
import {
  LatLngPoint,
  decodePolyline,
  generateTrajectoryFromPath,
} from "../engine/routeGenerator";
import {
  processNavigationDataset,
  DeadReckoningConfig,
} from "../engine/deadReckoning";
import { NavigationFrame, TrajectorySummary } from "../types/navigation";
import { PlaceSearchInput } from "./PlaceSearchInput";
import {
  searchPlaces,
  reverseGeocode,
  fetchDrivingRoute,
  loadSavedCustomRoutes,
  saveCustomRouteToStorage,
  deleteCustomRouteFromStorage,
  CustomRouteItem,
  haversineDistance,
  generateGeodesicCurve,
} from "../utils/routeServices";

// Real-world presets with known tunnel / GNSS blackout corridors
export interface PresetRoute {
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
  environment:
    | "Tunnel"
    | "Underpass"
    | "Urban Canyon"
    | "Dense Forest"
    | "EMI Jamming";
  isCustom?: boolean;
}

export const PRESET_ROUTES: PresetRoute[] = [
  {
    id: "bengaluru-isro-corridor",
    name: "ISRO HQ to Kempegowda Airport Corridor",
    city: "Bengaluru, India",
    description:
      "Antariksh Bhavan through Hebbal elevated expressway and railway underpass.",
    origin: { lat: 13.0382, lng: 77.5684 },
    destination: { lat: 13.1986, lng: 77.7066 },
    originName: "Antariksh Bhavan (ISRO HQ), Bengaluru",
    destinationName: "Kempegowda International Airport, Bengaluru",
    defaultSpeedKmh: 65,
    outagePct: 35,
    outageDurationSec: 35,
    environment: "Underpass",
  },
  {
    id: "mumbai-coastal-tunnel",
    name: "Marine Drive to Bandra-Worli Sea Link",
    city: "Mumbai, India",
    description:
      "Coastal Road expressway including the subsea twin tunnel under Malabar Hill.",
    origin: { lat: 18.9438, lng: 72.8232 },
    destination: { lat: 19.0435, lng: 72.818 },
    originName: "Marine Drive, Nariman Point, Mumbai",
    destinationName: "Bandra-Worli Sea Link, Mumbai",
    defaultSpeedKmh: 75,
    outagePct: 40,
    outageDurationSec: 45,
    environment: "Tunnel",
  },
  {
    id: "sf-presidio-tunnel",
    name: "Presidio Parkway to Golden Gate Bridge",
    city: "San Francisco, USA",
    description:
      "Traverses the Presidio cut-and-cover highway tunnels heading northbound.",
    origin: { lat: 37.7989, lng: -122.4662 },
    destination: { lat: 37.8324, lng: -122.4795 },
    originName: "Presidio Parkway Highway 101, San Francisco",
    destinationName: "Golden Gate Bridge Vista Point, San Francisco",
    defaultSpeedKmh: 55,
    outagePct: 30,
    outageDurationSec: 25,
    environment: "Tunnel",
  },
  {
    id: "delhi-airport-express",
    name: "Connaught Place to IGI Aerocity Tunnel",
    city: "New Delhi, India",
    description:
      "Central arterial route passing through Dhaula Kuan multi-tier underpass.",
    origin: { lat: 28.6315, lng: 77.2167 },
    destination: { lat: 28.5562, lng: 77.0999 },
    originName: "Connaught Place Radial Road, New Delhi",
    destinationName: "IGI Airport Aerocity Underpass, New Delhi",
    defaultSpeedKmh: 60,
    outagePct: 45,
    outageDurationSec: 30,
    environment: "Underpass",
  },
  {
    id: "tokyo-yamate-tunnel",
    name: "Shibuya Crossing to Shinjuku via C2",
    city: "Tokyo, Japan",
    description:
      "Route incorporating sections of the subterranean Shuto Expressway Yamate Tunnel.",
    origin: { lat: 35.658, lng: 139.7016 },
    destination: { lat: 35.6938, lng: 139.7034 },
    originName: "Shibuya Crossing, Shibuya City, Tokyo",
    destinationName: "Shinjuku Central Park / C2 Express, Tokyo",
    defaultSpeedKmh: 50,
    outagePct: 25,
    outageDurationSec: 40,
    environment: "Tunnel",
  },
];

interface GoogleMapsRoutePlannerProps {
  onApplyRouteToSimulation: (frames: any[], scenarioName: string) => void;
  drConfig: DeadReckoningConfig;
}

/**
 * Inner Map Controller that leverages useMapsLibrary('routes') to compute real road directions
 */
interface RouteRendererProps {
  origin: LatLngPoint;
  destination: LatLngPoint;
  onPathComputed: (
    path: LatLngPoint[],
    distanceMeters: number,
    durationSec: number,
  ) => void;
  simulationPolylines: {
    rawDr: LatLngPoint[];
    aiDr: LatLngPoint[];
  } | null;
}

const GoogleRouteRenderer: React.FC<RouteRendererProps> = ({
  origin,
  destination,
  onPathComputed,
  simulationPolylines,
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const routesLib = useMapsLibrary("routes");
  const [routePolyline, setRoutePolyline] = useState<any>(null);
  const [rawDrPolyline, setRawDrPolyline] = useState<any>(null);
  const [aiDrPolyline, setAiDrPolyline] = useState<any>(null);

  // Compute route when origin or destination changes
  useEffect(() => {
    if (!routesLib || !mapsLib || !map) return;

    // Clean up previous line
    if (routePolyline) {
      routePolyline.setMap(null);
      setRoutePolyline(null);
    }

    try {
      const travelMode = (routesLib as any)?.TravelMode?.DRIVE || "DRIVE";

      const request: any = {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode,
        routingPreference: "TRAFFIC_UNAWARE",
        fields: [
          "routes.polyline.encodedPolyline",
          "routes.distanceMeters",
          "routes.duration",
          "routes.viewport",
        ],
      };

      const routeComputePromise =
        typeof (routesLib as any)?.Route?.computeRoutes === "function"
          ? (routesLib as any).Route.computeRoutes(request)
          : Promise.reject(new Error("Route.computeRoutes not ready"));

      routeComputePromise
        .then((response: any) => {
          if (response.routes && response.routes.length > 0) {
            const firstRoute = response.routes[0];
            let decodedCoords: LatLngPoint[] = [];

            if (firstRoute.polyline?.encodedPolyline) {
              decodedCoords = decodePolyline(
                firstRoute.polyline.encodedPolyline,
              );
            }

            if (decodedCoords.length === 0) {
              decodedCoords = generateGeodesicCurve(origin, destination, 30);
            }

            // Render Google Maps Polyline (Ground Truth in emerald green)
            const gPolyline = new mapsLib.Polyline({
              path: decodedCoords,
              geodesic: true,
              strokeColor: "#10b981", // emerald green
              strokeOpacity: 0.9,
              strokeWeight: 4,
              map,
            });
            setRoutePolyline(gPolyline);

            if (firstRoute.viewport) {
              const bounds = new mapsLib.LatLngBounds(
                firstRoute.viewport.southwest,
                firstRoute.viewport.northeast,
              );
              map.fitBounds(bounds, 50);
            } else {
              const bounds = new mapsLib.LatLngBounds();
              bounds.extend(origin);
              bounds.extend(destination);
              map.fitBounds(bounds, 50);
            }

            const dist =
              firstRoute.distanceMeters ??
              haversineDistance(
                origin.lat,
                origin.lng,
                destination.lat,
                destination.lng,
              );
            const duration = firstRoute.duration
              ? parseInt(String(firstRoute.duration))
              : Math.round(dist / 16);

            onPathComputed(decodedCoords, dist, duration);
          }
        })
        .catch((err: any) => {
          console.warn(
            "Google Routes computeRoutes error; attempting OSRM driving route:",
            err,
          );
          fetchDrivingRoute(origin, destination).then(
            ({ coordinates, distanceMeters, durationSec }) => {
              const gPolyline = new mapsLib.Polyline({
                path: coordinates,
                geodesic: true,
                strokeColor: "#10b981",
                strokeOpacity: 0.9,
                strokeWeight: 4,
                map,
              });
              setRoutePolyline(gPolyline);
              onPathComputed(coordinates, distanceMeters, durationSec);
            },
          );
        });
    } catch (e) {
      console.warn("Routes computation fallback triggered:", e);
      fetchDrivingRoute(origin, destination).then(
        ({ coordinates, distanceMeters, durationSec }) => {
          onPathComputed(coordinates, distanceMeters, durationSec);
        },
      );
    }

    return () => {
      if (routePolyline) routePolyline.setMap(null);
    };
  }, [
    routesLib,
    mapsLib,
    map,
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
  ]);

  // Update simulation polylines when available
  useEffect(() => {
    if (!map || !mapsLib) return;

    if (rawDrPolyline) rawDrPolyline.setMap(null);
    if (aiDrPolyline) aiDrPolyline.setMap(null);

    if (simulationPolylines) {
      if (simulationPolylines.rawDr.length > 0) {
        const pRaw = new mapsLib.Polyline({
          path: simulationPolylines.rawDr,
          geodesic: true,
          strokeColor: "#ef4444",
          strokeOpacity: 0.85,
          strokeWeight: 3,
          map,
        });
        setRawDrPolyline(pRaw);
      }

      if (simulationPolylines.aiDr.length > 0) {
        const pAi = new mapsLib.Polyline({
          path: simulationPolylines.aiDr,
          geodesic: true,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.9,
          strokeWeight: 3.5,
          map,
        });
        setAiDrPolyline(pAi);
      }
    }

    return () => {
      if (rawDrPolyline) rawDrPolyline.setMap(null);
      if (aiDrPolyline) aiDrPolyline.setMap(null);
    };
  }, [map, mapsLib, simulationPolylines]);

  return null;
};

export const GoogleMapsRoutePlanner: React.FC<GoogleMapsRoutePlannerProps> = ({
  onApplyRouteToSimulation,
  drConfig,
}) => {
  // Read Google Maps API Key from environment
  const metaEnv = (import.meta as any).env;
  const apiKey = (metaEnv?.VITE_GOOGLE_MAPS_API_KEY as string) || "";
  const isGoogleMapsConfigured = Boolean(apiKey && apiKey.trim().length > 5);

  // Active Tab: 'presets' | 'custom'
  const [routeTab, setRouteTab] = useState<"presets" | "custom">("presets");

  // Active Origin & Destination
  const [selectedRouteId, setSelectedRouteId] = useState<string>(
    PRESET_ROUTES[0].id,
  );
  const [origin, setOrigin] = useState<LatLngPoint>(PRESET_ROUTES[0].origin);
  const [destination, setDestination] = useState<LatLngPoint>(
    PRESET_ROUTES[0].destination,
  );
  const [originName, setOriginName] = useState<string>(
    PRESET_ROUTES[0].originName,
  );
  const [destinationName, setDestinationName] = useState<string>(
    PRESET_ROUTES[0].destinationName,
  );

  // Custom user-saved routes from LocalStorage
  const [customRoutes, setCustomRoutes] = useState<CustomRouteItem[]>(() =>
    loadSavedCustomRoutes(),
  );
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");

  // Save Route Form State
  const [newRouteName, setNewRouteName] = useState<string>("");
  const [newRouteCity, setNewRouteCity] = useState<string>("");
  const [newRouteDesc, setNewRouteDesc] = useState<string>("");

  // Click-to-place selection mode: 'origin' | 'destination' | null
  const [clickTarget, setClickTarget] = useState<
    "origin" | "destination" | null
  >(null);

  // Route Simulation Parameters
  const [speedKmh, setSpeedKmh] = useState<number>(
    PRESET_ROUTES[0].defaultSpeedKmh,
  );
  const [outagePct, setOutagePct] = useState<number>(
    PRESET_ROUTES[0].outagePct,
  );
  const [outageDurationSec, setOutageDurationSec] = useState<number>(
    PRESET_ROUTES[0].outageDurationSec,
  );
  const [outageEnvironment, setOutageEnvironment] = useState<
    "Tunnel" | "Underpass" | "Urban Canyon" | "Dense Forest" | "EMI Jamming"
  >("Underpass");

  // Computed Path Data
  const [computedPath, setComputedPath] = useState<LatLngPoint[]>([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number>(0);
  const [routeDurationSec, setRouteDurationSec] = useState<number>(0);
  const [isRouting, setIsRouting] = useState<boolean>(false);

  // Simulation execution results
  const [simSummary, setSimSummary] = useState<TrajectorySummary | null>(null);
  const [simFrames, setSimFrames] = useState<any[] | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Leaflet fallback map ref (when Google Maps API key is pending)
  const leafletContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletStartMarkerRef = useRef<L.Marker | null>(null);
  const leafletEndMarkerRef = useRef<L.Marker | null>(null);
  const leafletGtPolylineRef = useRef<L.Polyline | null>(null);
  const leafletRawDrPolylineRef = useRef<L.Polyline | null>(null);
  const leafletAiDrPolylineRef = useRef<L.Polyline | null>(null);

  // Polylines to pass into Google Map renderer
  const simulationPolylines = useMemo(() => {
    if (!simSummary || simSummary.frames.length === 0) return null;
    return {
      rawDr: simSummary.frames.map((f) => ({
        lat: f.rawDrLat,
        lng: f.rawDrLon,
      })),
      aiDr: simSummary.frames.map((f) => ({ lat: f.aiDrLat, lng: f.aiDrLon })),
    };
  }, [simSummary]);

  // Compute road route and update Leaflet polyline
  const recalculateLeafletRoute = useCallback(
    async (startPt: LatLngPoint, endPt: LatLngPoint) => {
      setIsRouting(true);
      try {
        const { coordinates, distanceMeters, durationSec } =
          await fetchDrivingRoute(startPt, endPt);
        setComputedPath(coordinates);
        setRouteDistanceMeters(distanceMeters);
        setRouteDurationSec(durationSec);

        const map = leafletMapRef.current;
        if (map && !isGoogleMapsConfigured) {
          if (leafletGtPolylineRef.current)
            leafletGtPolylineRef.current.remove();
          leafletGtPolylineRef.current = L.polyline(
            coordinates.map((p) => [p.lat, p.lng]),
            { color: "#10b981", weight: 4, opacity: 0.9 },
          ).addTo(map);

          const bounds = L.latLngBounds([
            [startPt.lat, startPt.lng],
            [endPt.lat, endPt.lng],
          ]);
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch (err) {
        console.warn("Leaflet recalculate route error:", err);
      } finally {
        setIsRouting(false);
      }
    },
    [isGoogleMapsConfigured],
  );

  // Handle preset selection
  const handleSelectPreset = (presetId: string) => {
    const p = PRESET_ROUTES.find((r) => r.id === presetId);
    if (!p) return;
    setSelectedRouteId(presetId);
    setOrigin(p.origin);
    setDestination(p.destination);
    setOriginName(p.originName);
    setDestinationName(p.destinationName);
    setSpeedKmh(p.defaultSpeedKmh);
    setOutagePct(p.outagePct);
    setOutageDurationSec(p.outageDurationSec);
    setOutageEnvironment(p.environment);
    setSimSummary(null);
    setSimFrames(null);
    recalculateLeafletRoute(p.origin, p.destination);
  };

  // Handle custom route selection
  const handleSelectCustomRoute = (route: CustomRouteItem) => {
    setSelectedRouteId(route.id);
    setOrigin(route.origin);
    setDestination(route.destination);
    setOriginName(route.originName);
    setDestinationName(route.destinationName);
    setSpeedKmh(route.defaultSpeedKmh);
    setOutagePct(route.outagePct);
    setOutageDurationSec(route.outageDurationSec);
    setOutageEnvironment(route.environment);
    setSimSummary(null);
    setSimFrames(null);
    recalculateLeafletRoute(route.origin, route.destination);
  };

  // Delete a saved custom route
  const handleDeleteCustomRoute = (routeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteCustomRouteFromStorage(routeId);
    setCustomRoutes(updated);
    if (selectedRouteId === routeId) {
      // Revert to default preset
      handleSelectPreset(PRESET_ROUTES[0].id);
      setRouteTab("presets");
    }
  };

  // Open Save Route modal with smart prefilled fields
  const handleOpenSaveModal = () => {
    const defaultTitle = `${originName.split(",")[0]} to ${destinationName.split(",")[0]}`;
    setNewRouteName(defaultTitle);
    const inferredCity =
      originName.split(",")[1]?.trim() ||
      destinationName.split(",")[1]?.trim() ||
      "Custom Region";
    setNewRouteCity(inferredCity);
    setNewRouteDesc(
      `Custom road itinerary between ${originName.split(",")[0]} and ${destinationName.split(",")[0]}.`,
    );
    setShowSaveModal(true);
  };

  // Save new custom route to LocalStorage
  const handleConfirmSaveCustomRoute = () => {
    if (!newRouteName.trim()) return;

    const newRoute: CustomRouteItem = {
      id: `custom-route-${Date.now()}`,
      name: newRouteName.trim(),
      city: newRouteCity.trim() || "Custom",
      description:
        newRouteDesc.trim() || `Route from ${originName} to ${destinationName}`,
      origin,
      destination,
      originName,
      destinationName,
      defaultSpeedKmh: speedKmh,
      outagePct,
      outageDurationSec,
      environment: outageEnvironment,
      createdAt: Date.now(),
      distanceKm: Math.round((routeDistanceMeters / 1000) * 10) / 10,
      isCustom: true,
    };

    const updatedList = saveCustomRouteToStorage(newRoute);
    setCustomRoutes(updatedList);
    setSelectedRouteId(newRoute.id);
    setRouteTab("custom");
    setShowSaveModal(false);

    setSaveSuccessMsg(`Route "${newRoute.name}" added to My Routes!`);
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };

  // Swap Origin and Destination
  const handleSwapEndpoints = () => {
    const tempOrigin = { ...origin };
    const tempOriginName = originName;
    setOrigin({ ...destination });
    setOriginName(destinationName);
    setDestination(tempOrigin);
    setDestinationName(tempOriginName);
    setSimSummary(null);
    setSimFrames(null);
    recalculateLeafletRoute(destination, tempOrigin);
  };

  // Handle location update from PlaceSearchInput
  const handleOriginChange = (newPt: LatLngPoint, newName: string) => {
    setOrigin(newPt);
    setOriginName(newName);
    setSelectedRouteId("custom-adhoc");
    setSimSummary(null);
    setSimFrames(null);
    recalculateLeafletRoute(newPt, destination);
  };

  const handleDestinationChange = (newPt: LatLngPoint, newName: string) => {
    setDestination(newPt);
    setDestinationName(newName);
    setSelectedRouteId("custom-adhoc");
    setSimSummary(null);
    setSimFrames(null);
    recalculateLeafletRoute(origin, newPt);
  };

  // Map click handler for Google Maps
  const handleGoogleMapClick = (e: MapMouseEvent) => {
    if (!e.detail?.latLng) return;
    const clicked: LatLngPoint = {
      lat: e.detail.latLng.lat,
      lng: e.detail.latLng.lng,
    };

    if (clickTarget === "origin") {
      setOrigin(clicked);
      setClickTarget(null);
      setSelectedRouteId("custom-adhoc");
      setSimSummary(null);
      reverseGeocode(clicked.lat, clicked.lng).then((addr) =>
        setOriginName(addr),
      );
    } else if (clickTarget === "destination") {
      setDestination(clicked);
      setClickTarget(null);
      setSelectedRouteId("custom-adhoc");
      setSimSummary(null);
      reverseGeocode(clicked.lat, clicked.lng).then((addr) =>
        setDestinationName(addr),
      );
    }
  };

  // Initialize or update Leaflet fallback when Google Maps key is not set
  useEffect(() => {
    if (isGoogleMapsConfigured || !leafletContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(leafletContainerRef.current, {
        center: [origin.lat, origin.lng],
        zoom: 12,
        zoomControl: false,
      });

      // Clean, watermark-free OpenStreetMap tiles with tactical dark CSS filter
      const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      map.on("click", (e: L.LeafletMouseEvent) => {
        const clicked: LatLngPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
        setClickTarget((target) => {
          if (target === "origin") {
            setOrigin(clicked);
            setSelectedRouteId("custom-adhoc");
            setSimSummary(null);
            reverseGeocode(clicked.lat, clicked.lng).then((addr) =>
              setOriginName(addr),
            );
            return null;
          } else if (target === "destination") {
            setDestination(clicked);
            setSelectedRouteId("custom-adhoc");
            setSimSummary(null);
            reverseGeocode(clicked.lat, clicked.lng).then((addr) =>
              setDestinationName(addr),
            );
            return null;
          }
          return target;
        });
      });

      leafletMapRef.current = map;
      recalculateLeafletRoute(origin, destination);
    }

    const map = leafletMapRef.current;
    if (!map) return;

    // Clear previous markers
    if (leafletStartMarkerRef.current) leafletStartMarkerRef.current.remove();
    if (leafletEndMarkerRef.current) leafletEndMarkerRef.current.remove();

    // Start Marker (Emerald)
    const startIcon = L.divIcon({
      className: "custom-start-marker",
      html: `<div style="background:#10b981; color:white; font-weight:bold; font-size:11px; padding:3px 7px; border-radius:12px; border:2px solid white; box-shadow:0 0 10px rgba(16,185,129,0.7); display:flex; align-items:center; gap:3px;"><span>A</span><span>START</span></div>`,
      iconSize: [60, 24],
      iconAnchor: [30, 24],
    });
    leafletStartMarkerRef.current = L.marker([origin.lat, origin.lng], {
      icon: startIcon,
    }).addTo(map);

    // End Marker (Red)
    const endIcon = L.divIcon({
      className: "custom-end-marker",
      html: `<div style="background:#ef4444; color:white; font-weight:bold; font-size:11px; padding:3px 7px; border-radius:12px; border:2px solid white; box-shadow:0 0 10px rgba(239,68,68,0.7); display:flex; align-items:center; gap:3px;"><span>B</span><span>DEST</span></div>`,
      iconSize: [60, 24],
      iconAnchor: [30, 24],
    });
    leafletEndMarkerRef.current = L.marker([destination.lat, destination.lng], {
      icon: endIcon,
    }).addTo(map);

    // If simulation summary exists, draw Raw DR and AI DR lines
    if (leafletRawDrPolylineRef.current)
      leafletRawDrPolylineRef.current.remove();
    if (leafletAiDrPolylineRef.current) leafletAiDrPolylineRef.current.remove();

    if (simSummary && simSummary.frames.length > 0) {
      const rawPoints: [number, number][] = simSummary.frames.map((f) => [
        f.rawDrLat,
        f.rawDrLon,
      ]);
      const aiPoints: [number, number][] = simSummary.frames.map((f) => [
        f.aiDrLat,
        f.aiDrLon,
      ]);

      leafletRawDrPolylineRef.current = L.polyline(rawPoints, {
        color: "#ef4444",
        weight: 3,
        dashArray: "5, 5",
        opacity: 0.85,
      }).addTo(map);

      leafletAiDrPolylineRef.current = L.polyline(aiPoints, {
        color: "#3b82f6",
        weight: 3.5,
        opacity: 0.9,
      }).addTo(map);
    }
  }, [
    isGoogleMapsConfigured,
    origin,
    destination,
    simSummary,
    recalculateLeafletRoute,
  ]);

  // Execute Dead Reckoning Simulation along the chosen road path
  const handleRunSimulation = () => {
    if (computedPath.length < 2) return;

    setIsSimulating(true);

    setTimeout(() => {
      const rawFrames = generateTrajectoryFromPath(computedPath, {
        speedKmh,
        sampleRateHz: 2,
        outageStartPct: outagePct,
        outageDurationSec,
        outageEnvironment,
      });

      const summary = processNavigationDataset(rawFrames, drConfig);

      setSimFrames(rawFrames);
      setSimSummary(summary);
      setIsSimulating(false);
    }, 150);
  };

  // Push this route dataset into App's active simulation & cockpit
  const handleLoadIntoMainSimulation = () => {
    if (!simFrames || simFrames.length === 0) {
      handleRunSimulation();
    }
    const currentPreset = PRESET_ROUTES.find((p) => p.id === selectedRouteId);
    const currentCustom = customRoutes.find((r) => r.id === selectedRouteId);

    const title = currentCustom
      ? `${currentCustom.name} (Custom Route)`
      : currentPreset
        ? `${currentPreset.name} (Road Corridor)`
        : `Custom Route (${originName.split(",")[0]} → ${destinationName.split(",")[0]})`;

    const framesToLoad =
      simFrames ||
      generateTrajectoryFromPath(computedPath, {
        speedKmh,
        sampleRateHz: 2,
        outageStartPct: outagePct,
        outageDurationSec,
        outageEnvironment,
      });

    onApplyRouteToSimulation(framesToLoad, title);
  };

  return (
    <div className="space-y-5 font-mono max-w-7xl mx-auto pb-12">
      {/* Header & Actions */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600/20 border border-blue-500/40 text-blue-300">
                GLOBAL ROUTE & PLACE SEARCH PLANNER
              </span>
              <span className="text-xs text-gray-400">
                Search Places • Add Custom Corridors • Simulate Blackout
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
              <RouteIcon className="w-5 h-5 text-blue-400" />
              <span>Search Places & Add Custom Navigation Routes</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1 max-w-3xl">
              Search any place, city, landmark or address worldwide for Start
              (A) and Destination (B), or pick on the interactive map. Add your
              own custom routes, configure GNSS blackout tunnels, and test
              inertial dead reckoning with AI drift compensation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-save-custom-route-top"
              onClick={handleOpenSaveModal}
              className="px-3.5 py-2.5 rounded-lg bg-[#18202F] border border-blue-500/50 hover:bg-blue-600/30 text-blue-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Bookmark className="w-4 h-4 text-blue-400" />
              <span>Save as Custom Route</span>
            </button>
            <button
              id="btn-simulate-route-drift"
              onClick={handleRunSimulation}
              disabled={isSimulating || computedPath.length < 2}
              className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>
                {isSimulating
                  ? "Simulating Physics..."
                  : "Simulate Trajectory Drift"}
              </span>
            </button>
            <button
              id="btn-load-live-cockpit"
              onClick={handleLoadIntoMainSimulation}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              <span>Load Into Live Cockpit</span>
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* API Key Status Notice */}
        {!isGoogleMapsConfigured && (
          <div className="mt-4 p-3 rounded-lg bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-3">
            <Radio className="w-4 h-4 text-blue-400 mt-0.5 shrink-0 animate-pulse" />
            <div className="space-y-1">
              <div className="font-bold text-blue-300">
                Worldwide Place Search & Road Router Active (Zero Watermarks)
              </div>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                You can search any address, city, or landmark worldwide, place
                points on the map, and save custom corridors. Turn-by-turn road
                geometries are computed directly. To enable Google Maps Platform
                vector tiles, configure{" "}
                <code className="bg-black/40 px-1 py-0.5 rounded text-blue-200">
                  VITE_GOOGLE_MAPS_API_KEY
                </code>{" "}
                or try a{" "}
                <a
                  href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-blue-400 font-bold hover:text-blue-300 inline-flex items-center gap-1"
                >
                  Maps Demo Key <ExternalLink className="w-3 h-3 inline" />
                </a>
                .
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Corridor Presets & My Custom Routes Section */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D333B] pb-3">
          {/* Tab buttons */}
          <div className="flex items-center gap-2">
            <button
              id="tab-curated-presets"
              onClick={() => setRouteTab("presets")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                routeTab === "presets"
                  ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                  : "bg-[#15181E] text-gray-400 hover:text-white border border-[#2D333B]"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Curated Presets ({PRESET_ROUTES.length})</span>
            </button>

            <button
              id="tab-custom-routes"
              onClick={() => setRouteTab("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                routeTab === "custom"
                  ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                  : "bg-[#15181E] text-gray-400 hover:text-white border border-[#2D333B]"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>My Custom Routes ({customRoutes.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-add-new-custom-route"
              onClick={handleOpenSaveModal}
              className="px-2.5 py-1 rounded bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Current As New Route</span>
            </button>
          </div>
        </div>

        {/* Route Cards */}
        {routeTab === "presets" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {PRESET_ROUTES.map((p) => {
              const isSelected = selectedRouteId === p.id;
              return (
                <button
                  key={p.id}
                  id={`preset-${p.id}`}
                  onClick={() => handleSelectPreset(p.id)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-blue-600/20 border-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.3)]"
                      : "bg-[#15181E] border-[#2D333B] hover:border-gray-500 hover:bg-[#1A1F26]"
                  }`}
                >
                  <div>
                    <div className="text-[10px] font-bold text-blue-400 uppercase">
                      {p.city}
                    </div>
                    <div className="text-xs font-bold text-white truncate mt-0.5">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-tight">
                      {p.description}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[9px] text-gray-400 border-t border-[#2D333B]/60 pt-1.5">
                    <span>{p.environment}</span>
                    <span className="text-blue-300 font-bold">
                      {p.defaultSpeedKmh} km/h
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            {customRoutes.length === 0 ? (
              <div className="p-6 text-center rounded-lg bg-[#15181E] border border-dashed border-[#2D333B] space-y-2">
                <Bookmark className="w-6 h-6 text-gray-500 mx-auto" />
                <div className="text-xs font-bold text-gray-300">
                  No custom routes saved yet
                </div>
                <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                  Search any Start & Destination places using the search boxes
                  below, adjust your blackout corridor settings, and click
                  &ldquo;Save as Custom Route&rdquo; to add your own routes.
                </p>
                <button
                  onClick={handleOpenSaveModal}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Current Route Now</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {customRoutes.map((r) => {
                  const isSelected = selectedRouteId === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => handleSelectCustomRoute(r)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                        isSelected
                          ? "bg-blue-600/20 border-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.3)]"
                          : "bg-[#15181E] border-[#2D333B] hover:border-gray-500 hover:bg-[#1A1F26]"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-bold text-blue-400 uppercase">
                              {r.city}
                            </div>
                            <div className="text-xs font-bold text-white mt-0.5">
                              {r.name}
                            </div>
                          </div>
                          <button
                            type="button"
                            title="Delete this custom route"
                            onClick={(e) => handleDeleteCustomRoute(r.id, e)}
                            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-70 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1.5 space-y-0.5">
                          <div className="truncate text-emerald-400">
                            A: {r.originName}
                          </div>
                          <div className="truncate text-rose-400">
                            B: {r.destinationName}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[9px] text-gray-400 border-t border-[#2D333B]/60 pt-2">
                        <span className="px-1.5 py-0.5 rounded bg-black/40 text-gray-300 font-bold">
                          {r.environment}
                        </span>
                        <span className="text-blue-300 font-bold">
                          {r.distanceKm ? `${r.distanceKm} km` : ""} •{" "}
                          {r.defaultSpeedKmh} km/h
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Map & Place Search Controller Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Interactive Map Viewport */}
        <div className="lg:col-span-2 bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-xl space-y-3">
          {/* Map Sub-Header with Click-to-Place Mode */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2D333B] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-300 uppercase">
                Interactive Map Canvas:
              </span>
              <span className="text-xs text-gray-400">
                {clickTarget ? (
                  <span className="text-amber-400 font-bold animate-pulse">
                    👉 Click anywhere on the map to set{" "}
                    {clickTarget === "origin"
                      ? "Starting Point (A)"
                      : "Destination Point (B)"}
                  </span>
                ) : isRouting ? (
                  <span className="text-blue-400 font-bold animate-pulse">
                    Calculating road directions...
                  </span>
                ) : (
                  <span>Search places in panel or click map to reposition</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                id="btn-set-start-map"
                onClick={() =>
                  setClickTarget(clickTarget === "origin" ? null : "origin")
                }
                className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                  clickTarget === "origin"
                    ? "bg-emerald-600 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    : "bg-[#15181E] border-[#2D333B] text-emerald-400 hover:bg-[#1C2129]"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Set Start (A)</span>
              </button>

              <button
                id="btn-set-dest-map"
                onClick={() =>
                  setClickTarget(
                    clickTarget === "destination" ? null : "destination",
                  )
                }
                className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                  clickTarget === "destination"
                    ? "bg-rose-600 text-white border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                    : "bg-[#15181E] border-[#2D333B] text-rose-400 hover:bg-[#1C2129]"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Set Destination (B)</span>
              </button>

              <button
                id="btn-swap-endpoints-map"
                onClick={handleSwapEndpoints}
                title="Swap Start & Destination"
                className="p-1.5 rounded bg-[#15181E] border border-[#2D333B] text-gray-400 hover:text-white hover:bg-[#1C2129] transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Map Container */}
          <div className="w-full h-[500px] rounded-lg overflow-hidden relative border border-[#2D333B] bg-[#0A0B0D]">
            {isGoogleMapsConfigured ? (
              <APIProvider apiKey={apiKey} libraries={["routes", "marker"]}>
                <Map
                  className="w-full h-full"
                  defaultCenter={{ lat: origin.lat, lng: origin.lng }}
                  defaultZoom={12}
                  mapId="DEMO_MAP_ID"
                  colorScheme="DARK"
                  disableDefaultUI={false}
                  onClick={handleGoogleMapClick}
                  internalUsageAttributionIds={[
                    "gmp_mcp_codeassist_v1_aistudio",
                  ]}
                >
                  {/* Origin Marker (Point A) */}
                  <AdvancedMarker
                    position={origin}
                    title={`Start: ${originName}`}
                  >
                    <Pin
                      background="#10b981"
                      borderColor="#ffffff"
                      glyphColor="#ffffff"
                      scale={1.2}
                    >
                      <span className="font-bold text-[10px] text-white">
                        A
                      </span>
                    </Pin>
                  </AdvancedMarker>

                  {/* Destination Marker (Point B) */}
                  <AdvancedMarker
                    position={destination}
                    title={`Destination: ${destinationName}`}
                  >
                    <Pin
                      background="#ef4444"
                      borderColor="#ffffff"
                      glyphColor="#ffffff"
                      scale={1.2}
                    >
                      <span className="font-bold text-[10px] text-white">
                        B
                      </span>
                    </Pin>
                  </AdvancedMarker>

                  {/* Dynamic Route Polyline and Dead Reckoning visualizer */}
                  <GoogleRouteRenderer
                    origin={origin}
                    destination={destination}
                    onPathComputed={(path, dist, dur) => {
                      setComputedPath(path);
                      setRouteDistanceMeters(dist);
                      setRouteDurationSec(dur);
                    }}
                    simulationPolylines={simulationPolylines}
                  />
                </Map>
              </APIProvider>
            ) : (
              // Fallback Leaflet Map (Watermark-Free Tactical Dark)
              <div
                ref={leafletContainerRef}
                className="w-full h-full leaflet-dark-tiles"
              />
            )}

            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 bg-[#111418]/90 backdrop-blur border border-[#2D333B] rounded-lg p-2.5 text-[10px] space-y-1.5 z-10">
              <div className="font-bold text-gray-300 uppercase tracking-wider text-[9px] border-b border-[#2D333B] pb-1">
                Road Trajectory Legend
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="w-3 h-1 bg-emerald-500 rounded-full" />
                <span>Road Trajectory (Ground Truth)</span>
              </div>
              {simSummary && (
                <>
                  <div className="flex items-center gap-2 text-rose-400">
                    <span className="w-3 h-0.5 bg-rose-500" />
                    <span>Raw Inertial Dead Reckoning (Divergent)</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-400 font-bold">
                    <span className="w-3 h-1 bg-blue-500 rounded-full" />
                    <span>AI-ML Enhanced DR (Compensated)</span>
                  </div>
                </>
              )}
            </div>

            {/* Distance & Duration Badge */}
            <div className="absolute top-3 right-3 bg-[#111418]/95 backdrop-blur border border-[#2D333B] rounded-lg p-2.5 text-xs z-10 flex items-center gap-4 shadow-lg">
              <div>
                <div className="text-[10px] text-gray-400">
                  Driving Distance:
                </div>
                <div className="font-bold text-white">
                  {(routeDistanceMeters / 1000).toFixed(2)} km
                </div>
              </div>
              <div className="border-l border-[#2D333B] pl-4">
                <div className="text-[10px] text-gray-400">
                  Estimated Drive:
                </div>
                <div className="font-bold text-blue-400">
                  {Math.floor(routeDurationSec / 60)}m {routeDurationSec % 60}s
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Place Search & Blackout Corridor Configuration */}
        <div className="space-y-4">
          {/* Place Search Inputs */}
          <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                <span>Search Places & Coordinates</span>
              </h3>
              <button
                type="button"
                onClick={handleSwapEndpoints}
                title="Swap Start & Destination"
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>Swap A ⇄ B</span>
              </button>
            </div>

            {/* Starting Location (A) Search Input */}
            <PlaceSearchInput
              idPrefix="route-origin"
              label="Starting Location"
              badgeLabel="START (A)"
              badgeColor="emerald"
              location={origin}
              locationName={originName}
              onLocationChange={handleOriginChange}
              isPickingOnMap={clickTarget === "origin"}
              onTogglePickOnMap={() =>
                setClickTarget(clickTarget === "origin" ? null : "origin")
              }
              placeholder="Search origin city, street, landmark..."
            />

            {/* Ending Location (B) Search Input */}
            <PlaceSearchInput
              idPrefix="route-dest"
              label="Ending Destination"
              badgeLabel="DESTINATION (B)"
              badgeColor="rose"
              location={destination}
              locationName={destinationName}
              onLocationChange={handleDestinationChange}
              isPickingOnMap={clickTarget === "destination"}
              onTogglePickOnMap={() =>
                setClickTarget(
                  clickTarget === "destination" ? null : "destination",
                )
              }
              placeholder="Search destination city, airport, venue..."
            />

            {/* Quick Action: Save Current Search as Custom Route */}
            <button
              id="btn-save-custom-route-sidebar"
              type="button"
              onClick={handleOpenSaveModal}
              className="w-full py-2 px-3 rounded-lg bg-[#18202F] border border-blue-500/40 hover:bg-blue-600/20 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 text-blue-400" />
              <span>Save As My Custom Route</span>
            </button>
          </div>

          {/* Outage Corridor & Kinematic Settings */}
          <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Simulated GNSS Blackout Corridor</span>
            </h3>

            {/* Outage Environment */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase">
                Blackout Environment:
              </label>
              <select
                id="select-outage-environment"
                value={outageEnvironment}
                onChange={(e) => setOutageEnvironment(e.target.value as any)}
                className="w-full mt-1 bg-[#15181E] border border-[#2D333B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="Tunnel">
                  Mountain Tunnel (Complete Sat Loss)
                </option>
                <option value="Underpass">Urban Underpass (Rapid Drop)</option>
                <option value="Urban Canyon">
                  Dense Urban Canyon (Multipath / Low SNR)
                </option>
                <option value="Dense Forest">
                  Dense Forest Canopy (Signal Attenuation)
                </option>
                <option value="EMI Jamming">
                  Electronic Warfare / Jamming Zone
                </option>
              </select>
            </div>

            {/* Outage Position (% along route) */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Tunnel / Outage Entry:</span>
                <span className="text-blue-400 font-bold">
                  {outagePct}% along route
                </span>
              </div>
              <input
                id="slider-outage-start"
                type="range"
                min={10}
                max={85}
                step={5}
                value={outagePct}
                onChange={(e) => setOutagePct(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Outage Duration */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Blackout Duration:</span>
                <span className="text-rose-400 font-bold">
                  {outageDurationSec} seconds
                </span>
              </div>
              <input
                id="slider-outage-duration"
                type="range"
                min={10}
                max={90}
                step={5}
                value={outageDurationSec}
                onChange={(e) => setOutageDurationSec(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            {/* Vehicle Velocity */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Cruising Velocity:</span>
                <span className="text-white font-bold">{speedKmh} km/h</span>
              </div>
              <input
                id="slider-speed-kmh"
                type="range"
                min={30}
                max={120}
                step={5}
                value={speedKmh}
                onChange={(e) => setSpeedKmh(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Simulation Results KPI Card */}
          {simSummary && (
            <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-200 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Simulation Results</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
                  {simSummary.metrics.overallImprovementPct}% DRIFT REDUCTION
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-[#15181E] border border-[#2D333B]">
                  <div className="text-[10px] text-gray-400">Raw DR RMSE:</div>
                  <div className="text-base font-bold text-rose-400">
                    {simSummary.metrics.rawDrRMSE} m
                  </div>
                </div>
                <div className="p-2 rounded bg-[#15181E] border border-[#2D333B]">
                  <div className="text-[10px] text-gray-400">
                    AI-ML DR RMSE:
                  </div>
                  <div className="text-base font-bold text-blue-400">
                    {simSummary.metrics.aiDrRMSE} m
                  </div>
                </div>
                <div className="p-2 rounded bg-[#15181E] border border-[#2D333B]">
                  <div className="text-[10px] text-gray-400">
                    Max Peak Drift:
                  </div>
                  <div className="text-sm font-bold text-rose-400">
                    {simSummary.metrics.rawMaxError} m
                  </div>
                </div>
                <div className="p-2 rounded bg-[#15181E] border border-[#2D333B]">
                  <div className="text-[10px] text-gray-400">
                    AI Bounded Drift:
                  </div>
                  <div className="text-sm font-bold text-blue-400">
                    {simSummary.metrics.aiMaxError} m
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Custom Route Modal Dialog */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans">
          <div className="bg-[#111418] border border-[#3A424E] rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#2D333B] pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Save Custom Route
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="p-1 rounded text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 font-bold block mb-1">
                  Route Name:
                </label>
                <input
                  type="text"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  placeholder="e.g. My Daily Office Commute"
                  className="w-full p-2.5 bg-[#0A0C0E] border border-[#2D333B] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-gray-300 font-bold block mb-1">
                  City / Region:
                </label>
                <input
                  type="text"
                  value={newRouteCity}
                  onChange={(e) => setNewRouteCity(e.target.value)}
                  placeholder="e.g. Bengaluru, India"
                  className="w-full p-2.5 bg-[#0A0C0E] border border-[#2D333B] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-gray-300 font-bold block mb-1">
                  Description / Notes:
                </label>
                <textarea
                  rows={2}
                  value={newRouteDesc}
                  onChange={(e) => setNewRouteDesc(e.target.value)}
                  placeholder="Notes about tunnels, underpasses, speed limits..."
                  className="w-full p-2.5 bg-[#0A0C0E] border border-[#2D333B] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#15181E] border border-[#2D333B] space-y-1 text-[11px] text-gray-400 font-mono">
                <div className="text-emerald-400 truncate">
                  Start (A): {originName} ({origin.lat.toFixed(4)},{" "}
                  {origin.lng.toFixed(4)})
                </div>
                <div className="text-rose-400 truncate">
                  Destination (B): {destinationName} (
                  {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)})
                </div>
                <div className="text-blue-300">
                  Distance: {(routeDistanceMeters / 1000).toFixed(2)} km •
                  Cruising: {speedKmh} km/h • Environment: {outageEnvironment}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-lg bg-[#181C22] border border-[#2D333B] text-gray-300 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-save-route"
                onClick={handleConfirmSaveCustomRoute}
                disabled={!newRouteName.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save to My Routes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
