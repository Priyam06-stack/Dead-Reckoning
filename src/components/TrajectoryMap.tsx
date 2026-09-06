import React, { useEffect, useRef, useState, useMemo } from 'react';
import { NavigationFrame, OutageInterval, NavMode } from '../types/navigation';
import {
  Layers,
  Crosshair,
  Maximize2,
  AlertTriangle,
  Compass,
  Eye,
  EyeOff,
  Navigation,
  MapPin,
} from 'lucide-react';
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';

interface TrajectoryMapProps {
  frames: NavigationFrame[];
  currentFrameIndex: number;
  outages: OutageInterval[];
  onSelectFrame?: (index: number) => void;
  activeMode: NavMode;
  onOpenRoutePlanner?: () => void;
}

// Custom hook / component to render Google Maps Polylines
const MapPolyline = ({ path, options, visible = true }: { path: google.maps.LatLngLiteral[], options: google.maps.PolylineOptions, visible?: boolean }) => {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;
    if (!polylineRef.current) {
      polylineRef.current = new mapsLib.Polyline({ ...options, map });
    }
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, mapsLib]);

  useEffect(() => {
    if (polylineRef.current) {
      polylineRef.current.setPath(path);
    }
  }, [path]);

  useEffect(() => {
    if (polylineRef.current) {
      polylineRef.current.setOptions({ ...options, visible });
    }
  }, [options, visible]);

  return null;
};

// Component for rendering outage zones with InfoWindows on click
const OutageZonesRenderer = ({ outages, frames, visible }: { outages: OutageInterval[], frames: NavigationFrame[], visible: boolean }) => {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || !mapsLib) return;

    // Clear existing
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    if (!visible) return;

    outages.forEach(outage => {
      const oFrames = frames.slice(outage.startIndex, outage.endIndex + 1);
      if (oFrames.length > 1) {
        const path = oFrames.map(f => ({ lat: f.gtLat, lng: f.gtLon }));
        
        const p = new mapsLib.Polyline({
          path,
          map,
          strokeColor: '#f59e0b',
          strokeOpacity: 0.45,
          strokeWeight: 8,
          clickable: true,
        });

        // Basic InfoWindow
        const infoWindow = new mapsLib.InfoWindow({
          content: `
            <div style="font-family: monospace; font-size: 11px; padding: 4px; color: #0f172a;">
              <div style="font-weight: bold; color: #b45309; margin-bottom: 2px;">
                ⚠️ GNSS OUTAGE ZONE (${outage.environment})
              </div>
              <div>Duration: <b>${outage.durationSec}s</b> (${outage.startSec}s → ${outage.endSec}s)</div>
              <div>Raw Drift: <b style="color: #dc2626;">${outage.rawPeakErrorMeters}m</b></div>
              <div>AI Compensated: <b style="color: #7c3aed;">${outage.aiPeakErrorMeters}m</b></div>
              <div style="color: #059669; font-weight: bold; margin-top: 2px;">
                Drift Reduction: ${outage.improvementPct}%
              </div>
            </div>
          `
        });

        p.addListener('click', (e: any) => {
          infoWindow.setPosition(e.latLng);
          infoWindow.open(map);
        });

        polylinesRef.current.push(p);
      }
    });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [map, mapsLib, outages, frames, visible]);

  return null;
};

// Map Controller for panning and fitting bounds
const MapController = ({ 
  frames, 
  currentFrame, 
  autoCenter, 
  isFitAllTriggered,
  isRecenterTriggered
}: { 
  frames: NavigationFrame[], 
  currentFrame: NavigationFrame | null, 
  autoCenter: boolean,
  isFitAllTriggered: number,
  isRecenterTriggered: number
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");

  // Initial fit bounds
  useEffect(() => {
    if (!map || !mapsLib || frames.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    frames.forEach(f => bounds.extend({ lat: f.gtLat, lng: f.gtLon }));
    map.fitBounds(bounds, 40);
  }, [map, mapsLib]); // Only on first load (when map/mapsLib is ready)

  // Fit all trigger
  useEffect(() => {
    if (!map || !mapsLib || frames.length === 0 || isFitAllTriggered === 0) return;
    const bounds = new google.maps.LatLngBounds();
    frames.forEach(f => bounds.extend({ lat: f.gtLat, lng: f.gtLon }));
    map.fitBounds(bounds, 40);
  }, [isFitAllTriggered, map, mapsLib, frames]);

  // Recenter trigger
  useEffect(() => {
    if (!map || !currentFrame || isRecenterTriggered === 0) return;
    const activeLat = currentFrame.isOutage
      ? currentFrame.aiDrLat
      : (currentFrame.gnssLat ?? currentFrame.gtLat);
    const activeLon = currentFrame.isOutage
      ? currentFrame.aiDrLon
      : (currentFrame.gnssLon ?? currentFrame.gtLon);
    
    map.setZoom(18);
    map.panTo({ lat: activeLat, lng: activeLon });
  }, [isRecenterTriggered, map, currentFrame]);

  // Auto center logic
  useEffect(() => {
    if (!map || !autoCenter || !currentFrame) return;
    const activeLat = currentFrame.isOutage
      ? currentFrame.aiDrLat
      : (currentFrame.gnssLat ?? currentFrame.gtLat);
    const activeLon = currentFrame.isOutage
      ? currentFrame.aiDrLon
      : (currentFrame.gnssLon ?? currentFrame.gtLon);
    
    map.panTo({ lat: activeLat, lng: activeLon });
  }, [currentFrame, autoCenter, map]);

  return null;
};

export const TrajectoryMap: React.FC<TrajectoryMapProps> = ({
  frames,
  currentFrameIndex,
  outages,
  onSelectFrame,
  activeMode,
  onOpenRoutePlanner,
}) => {
  // Basemap style: 'tactical' (dark) | 'satellite' (Esri high-res) | 'street' (OSM)
  const [mapLayer, setMapLayer] = useState<'tactical' | 'satellite' | 'street'>('tactical');

  // Visibility toggles
  const [showGT, setShowGT] = useState(true);
  const [showGNSS, setShowGNSS] = useState(true);
  const [showRawDR, setShowRawDR] = useState(true);
  const [showAiDR, setShowAiDR] = useState(true);
  const [showOutageZones, setShowOutageZones] = useState(true);
  const [autoCenter, setAutoCenter] = useState(true);

  // Fit/Recenter triggers
  const [fitAllTrigger, setFitAllTrigger] = useState(0);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  // Inspector modal/popup state
  const [inspectedFrame, setInspectedFrame] = useState<NavigationFrame | null>(null);

  const currentFrame = frames[currentFrameIndex] || frames[0];

  const gtCoords = useMemo(() => frames.map(f => ({ lat: f.gtLat, lng: f.gtLon })), [frames]);
  const rawDrCoords = useMemo(() => frames.map(f => ({ lat: f.rawDrLat, lng: f.rawDrLon })), [frames]);
  const aiDrCoords = useMemo(() => frames.map(f => ({ lat: f.aiDrLat, lng: f.aiDrLon })), [frames]);
  const gnssCoords = useMemo(() => 
    frames.filter(f => f.gnssAvailable && f.gnssLat && f.gnssLon).map(f => ({ lat: f.gnssLat!, lng: f.gnssLon! })), 
  [frames]);

  const activeLat = currentFrame?.isOutage
    ? currentFrame.aiDrLat
    : (currentFrame?.gnssLat ?? currentFrame?.gtLat ?? 0);
  const activeLon = currentFrame?.isOutage
    ? currentFrame.aiDrLon
    : (currentFrame?.gnssLon ?? currentFrame?.gtLon ?? 0);
  const heading = currentFrame?.gtHeading ?? 0;

  // Custom Dark style array for Google Maps Tactical theme
  const tacticalDarkStyle = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
    { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1b" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] }
  ];

  const getMapTypeId = () => {
    switch (mapLayer) {
      case 'satellite': return 'satellite';
      case 'street': return 'roadmap';
      case 'tactical': return 'roadmap';
      default: return 'roadmap';
    }
  };

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-xl overflow-hidden border border-[#2D333B] bg-[#111418] shadow-2xl flex flex-col">
      {/* Top Map HUD Overlay */}
      <div className="absolute top-3 left-3 z-[500] flex flex-wrap items-center gap-2 pointer-events-auto">
        {/* Active Mode Pill */}
        <div
          id="map-mode-indicator"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold backdrop-blur-md shadow-lg ${
            activeMode === 'GNSS'
              ? 'bg-green-600/10 border-green-500/50 text-green-400'
              : activeMode === 'DEAD_RECKONING'
              ? 'bg-red-600/10 border-red-500/50 text-red-400'
              : activeMode === 'AI_ENHANCED_DR'
              ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
              : 'bg-cyan-600/10 border-cyan-500/50 text-cyan-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              activeMode === 'GNSS'
                ? 'bg-green-400 shadow-[0_0_8px_#22c55e] animate-pulse'
                : activeMode === 'AI_ENHANCED_DR'
                ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse'
                : activeMode === 'GNSS_RECOVERY'
                ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse'
                : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
            }`}
          />
          <span>{activeMode.replace('_', ' ')}</span>
        </div>

        {/* Current Error Indicator */}
        {currentFrame && (
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-[#2D333B] px-3 py-1.5 rounded-lg text-xs font-mono shadow-lg text-gray-300">
            <span className="text-gray-500">Error:</span>
            <span
              className={`font-bold ${
                currentFrame.isOutage
                  ? currentFrame.aiDrErrorMeters < 5
                    ? 'text-blue-400'
                    : 'text-amber-400'
                  : 'text-green-400'
              }`}
            >
              {currentFrame.isOutage
                ? `${currentFrame.aiDrErrorMeters}m (AI) vs ${currentFrame.rawDrErrorMeters}m (Raw)`
                : `${(currentFrame.gnssLat ? 0.8 : 0.0).toFixed(1)}m`}
            </span>
          </div>
        )}

        {/* Outage Warning Banner if inside outage */}
        {currentFrame?.isOutage && (
          <div className="bg-red-500/20 text-red-500 text-[10px] font-bold px-3 py-1 border border-red-500/50 rounded-full animate-pulse uppercase flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Zone: Blackout (No GNSS Signal)</span>
          </div>
        )}
      </div>

      {/* Top Right Map Control Buttons */}
      <div className="absolute top-3 right-3 z-[500] flex items-center gap-1.5 bg-[#15181E]/90 backdrop-blur-md border border-[#2D333B] p-1.5 rounded-lg shadow-xl pointer-events-auto">
        {onOpenRoutePlanner && (
          <button
            id="btn-map-open-route-planner"
            title="Open Route Planner on Google Maps"
            onClick={onOpenRoutePlanner}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600/90 hover:bg-emerald-500 text-white font-mono text-[11px] font-bold border border-emerald-400/60 shadow-md transition-all cursor-pointer mr-1"
          >
            <MapPin className="w-3.5 h-3.5 fill-current" />
            <span>Plan Route</span>
          </button>
        )}

        {/* Basemap Style Switcher */}
        <div className="flex items-center bg-[#0e1116] border border-[#2D333B] rounded p-0.5 text-[10px] font-mono mr-1">
          <button
            type="button"
            title="Tactical High-Contrast Dark Map"
            onClick={() => setMapLayer('tactical')}
            className={`px-2 py-0.5 rounded transition-all font-bold cursor-pointer ${
              mapLayer === 'tactical'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            title="Satellite Imagery"
            onClick={() => setMapLayer('satellite')}
            className={`px-2 py-0.5 rounded transition-all font-bold cursor-pointer ${
              mapLayer === 'satellite'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            title="Google Maps Streets"
            onClick={() => setMapLayer('street')}
            className={`px-2 py-0.5 rounded transition-all font-bold cursor-pointer ${
              mapLayer === 'street'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Streets
          </button>
        </div>

        <button
          id="btn-auto-center"
          title="Auto-Follow Vehicle"
          onClick={() => setAutoCenter(!autoCenter)}
          className={`p-1.5 rounded transition-colors ${
            autoCenter
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-[#20252E]'
          }`}
        >
          <Crosshair className="w-4 h-4" />
        </button>

        <button
          id="btn-recenter"
          title="Recenter On Vehicle"
          onClick={() => setRecenterTrigger(t => t + 1)}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#20252E] transition-colors"
        >
          <Navigation className="w-4 h-4" />
        </button>

        <button
          id="btn-fit-all"
          title="Fit Whole Trajectory"
          onClick={() => setFitAllTrigger(t => t + 1)}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#20252E] transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Map DOM Canvas via @vis.gl/react-google-maps */}
      <div className="w-full h-full flex-1 z-0 bg-[#0d0f12]">
        <Map
          className="w-full h-full"
          defaultCenter={{ lat: frames[0]?.gtLat ?? 13.0382, lng: frames[0]?.gtLon ?? 77.5684 }}
          defaultZoom={17}
          mapId="DEMO_MAP_ID"
          mapTypeId={getMapTypeId()}
          colorScheme={mapLayer === 'tactical' ? 'DARK' : undefined}
          disableDefaultUI={true}
          gestureHandling="greedy"
        >
          <MapController 
            frames={frames} 
            currentFrame={currentFrame} 
            autoCenter={autoCenter} 
            isFitAllTriggered={fitAllTrigger}
            isRecenterTriggered={recenterTrigger}
          />
          
          {/* Traces */}
          <MapPolyline
            path={gtCoords}
            visible={showGT}
            options={{ strokeColor: '#FFFFFF', strokeWeight: 2.5, strokeOpacity: 0.9 }}
          />
          <MapPolyline
            path={gnssCoords}
            visible={showGNSS}
            options={{ strokeColor: '#06b6d4', strokeWeight: 3, strokeOpacity: 0.85 }}
          />
          <MapPolyline
            path={rawDrCoords}
            visible={showRawDR}
            options={{ strokeColor: '#ef4444', strokeWeight: 3, strokeOpacity: 0.85 }}
          />
          <MapPolyline
            path={aiDrCoords}
            visible={showAiDR}
            options={{ strokeColor: '#3b82f6', strokeWeight: 4, strokeOpacity: 0.95 }}
          />

          <OutageZonesRenderer outages={outages} frames={frames} visible={showOutageZones} />

          {/* Vehicle Marker */}
          {currentFrame && (
            <AdvancedMarker position={{ lat: activeLat, lng: activeLon }} zIndex={1000}>
              <div 
                className="vehicle-glyph flex items-center justify-center relative transition-transform duration-150 ease-out"
                style={{ transform: `rotate(${heading}deg)`, width: 32, height: 32 }}
              >
                <div className="absolute w-7 h-7 rounded-full bg-blue-400/25 border-[1.5px] border-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.6)] animate-pulse" />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 4px #60a5fa)' }}>
                  <polygon points="12 2, 22 21, 12 17, 2 21" fill="#60a5fa" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </div>

      {/* Bottom Trajectory Legend & Layer Toggles */}
      <div className="absolute bottom-3 left-3 z-[500] flex flex-wrap items-center gap-2 bg-black/60 backdrop-blur-md border border-[#2D333B] p-2 rounded-lg shadow-2xl pointer-events-auto text-xs font-mono">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider px-1 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-gray-500" /> Layers:
        </span>

        {/* Ground Truth Toggle */}
        <button
          onClick={() => setShowGT(!showGT)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all text-[10px] font-bold ${
            showGT
              ? 'bg-[#15181E] border border-gray-600 text-white'
              : 'text-gray-600 border border-transparent'
          }`}
        >
          <span className="w-3 h-[2px] bg-white"></span>
          <span>GROUND TRUTH</span>
          {showGT ? <Eye className="w-3 h-3 ml-0.5" /> : <EyeOff className="w-3 h-3 ml-0.5 text-gray-600" />}
        </button>

        {/* AI-ML Enhanced DR Toggle */}
        <button
          onClick={() => setShowAiDR(!showAiDR)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all text-[10px] font-bold ${
            showAiDR
              ? 'bg-blue-600/15 border border-blue-500/50 text-blue-400'
              : 'text-gray-600 border border-transparent'
          }`}
        >
          <span className="w-3 h-[2px] bg-blue-400"></span>
          <span>AI-CORRECTED</span>
          {showAiDR ? <Eye className="w-3 h-3 ml-0.5" /> : <EyeOff className="w-3 h-3 ml-0.5 text-gray-600" />}
        </button>

        {/* Raw DR Toggle */}
        <button
          onClick={() => setShowRawDR(!showRawDR)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all text-[10px] font-bold ${
            showRawDR
              ? 'bg-red-600/15 border border-red-500/50 text-red-500'
              : 'text-gray-600 border border-transparent'
          }`}
        >
          <span className="w-3 h-[2px] bg-red-500"></span>
          <span>RAW DEAD RECKONING</span>
          {showRawDR ? <Eye className="w-3 h-3 ml-0.5" /> : <EyeOff className="w-3 h-3 ml-0.5 text-gray-600" />}
        </button>

        {/* GNSS Track Toggle */}
        <button
          onClick={() => setShowGNSS(!showGNSS)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all text-[10px] font-bold ${
            showGNSS
              ? 'bg-cyan-600/15 border border-cyan-500/50 text-cyan-400'
              : 'text-gray-600 border border-transparent'
          }`}
        >
          <span className="w-3 h-[2px] bg-cyan-400"></span>
          <span>GNSS</span>
          {showGNSS ? <Eye className="w-3 h-3 ml-0.5" /> : <EyeOff className="w-3 h-3 ml-0.5 text-gray-600" />}
        </button>

        {/* Outage Zone Toggle */}
        <button
          onClick={() => setShowOutageZones(!showOutageZones)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all text-[10px] font-bold ${
            showOutageZones
              ? 'bg-amber-600/15 border border-amber-500/50 text-amber-400'
              : 'text-gray-600 border border-transparent'
          }`}
        >
          <div className="w-2 h-2 bg-amber-500/40 border border-amber-400 rounded-sm" />
          <span>OUTAGES</span>
        </button>
      </div>

      {/* Point Inspector Badge if a point is inspected */}
      {inspectedFrame && (
        <div className="absolute bottom-16 right-3 z-[500] bg-[#15181E] border border-[#2D333B] p-3 rounded-lg shadow-2xl text-xs font-mono max-w-xs pointer-events-auto">
          <div className="flex items-center justify-between border-b border-[#2D333B] pb-1.5 mb-2">
            <span className="font-bold text-white">Point Inspection</span>
            <button
              onClick={() => setInspectedFrame(null)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 text-gray-300">
            <div>Time: <span className="text-white font-bold">{inspectedFrame.relativeSec}s</span></div>
            <div>GT: {inspectedFrame.gtLat.toFixed(6)}, {inspectedFrame.gtLon.toFixed(6)}</div>
            <div>Raw DR Error: <span className="text-red-400 font-bold">{inspectedFrame.rawDrErrorMeters}m</span></div>
            <div>AI DR Error: <span className="text-blue-400 font-bold">{inspectedFrame.aiDrErrorMeters}m</span></div>
            <div>Speed: {(inspectedFrame.odometrySpeed * 3.6).toFixed(1)} km/h</div>
            <div>Heading: {inspectedFrame.gtHeading.toFixed(1)}°</div>
          </div>
        </div>
      )}
    </div>
  );
};
