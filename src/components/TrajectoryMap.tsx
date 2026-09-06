import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
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

interface TrajectoryMapProps {
  frames: NavigationFrame[];
  currentFrameIndex: number;
  outages: OutageInterval[];
  onSelectFrame?: (index: number) => void;
  activeMode: NavMode;
  onOpenRoutePlanner?: () => void;
}

export const TrajectoryMap: React.FC<TrajectoryMapProps> = ({
  frames,
  currentFrameIndex,
  outages,
  onSelectFrame,
  activeMode,
  onOpenRoutePlanner,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups refs
  const gtPolylineRef = useRef<L.Polyline | null>(null);
  const gnssPolylineRef = useRef<L.Polyline | null>(null);
  const rawDrPolylineRef = useRef<L.Polyline | null>(null);
  const aiDrPolylineRef = useRef<L.Polyline | null>(null);
  const outagePolygonsRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Basemap style: 'tactical' (dark, watermark-free) | 'satellite' (Esri high-res) | 'street' (OSM)
  const [mapLayer, setMapLayer] = useState<'tactical' | 'satellite' | 'street'>('tactical');

  // Visibility toggles
  const [showGT, setShowGT] = useState(true);
  const [showGNSS, setShowGNSS] = useState(true);
  const [showRawDR, setShowRawDR] = useState(true);
  const [showAiDR, setShowAiDR] = useState(true);
  const [showOutageZones, setShowOutageZones] = useState(true);
  const [autoCenter, setAutoCenter] = useState(true);

  // Inspector modal/popup state
  const [inspectedFrame, setInspectedFrame] = useState<NavigationFrame | null>(null);

  const currentFrame = frames[currentFrameIndex] || frames[0];

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Initial center point
    const initLat = frames[0]?.gtLat ?? 13.0382;
    const initLon = frames[0]?.gtLon ?? 77.5684;

    const map = L.map(mapContainerRef.current, {
      center: [initLat, initLon],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    });

    // Tactical Dark Cartography (Clean, high-contrast, zero watermark)
    // Uses OpenStreetMap tiles with tactical dark styling (100% watermark-free).
    const defaultTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(defaultTileUrl, {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Polylines matching Elegant Dark design
    gtPolylineRef.current = L.polyline([], {
      color: '#FFFFFF',
      weight: 2.5,
      dashArray: '5, 5',
      opacity: 0.9,
    }).addTo(map);

    gnssPolylineRef.current = L.polyline([], {
      color: '#06b6d4',
      weight: 3,
      opacity: 0.85,
    }).addTo(map);

    rawDrPolylineRef.current = L.polyline([], {
      color: '#ef4444',
      weight: 3,
      opacity: 0.85,
    }).addTo(map);

    aiDrPolylineRef.current = L.polyline([], {
      color: '#60a5fa',
      weight: 4,
      opacity: 0.95,
    }).addTo(map);

    outagePolygonsRef.current = L.layerGroup().addTo(map);

    // Custom Vehicle Heading Marker
    const vehicleIcon = L.divIcon({
      className: 'vehicle-marker-icon',
      html: `
        <div id="vehicle-glyph" style="
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: transform 0.15s ease-out;
        ">
          <div style="
            position: absolute;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(96, 165, 250, 0.25);
            border: 1.5px solid #60a5fa;
            box-shadow: 0 0 12px rgba(96, 165, 250, 0.6);
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          "></div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 0 4px #60a5fa);">
            <polygon points="12 2, 22 21, 12 17, 2 21" fill="#60a5fa" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    vehicleMarkerRef.current = L.marker([initLat, initLon], {
      icon: vehicleIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Trajectory Paths when frames change
  useEffect(() => {
    if (!mapInstanceRef.current || frames.length === 0) return;

    const gtCoords: [number, number][] = frames.map((f) => [f.gtLat, f.gtLon]);
    const rawDrCoords: [number, number][] = frames.map((f) => [f.rawDrLat, f.rawDrLon]);
    const aiDrCoords: [number, number][] = frames.map((f) => [f.aiDrLat, f.aiDrLon]);

    // GNSS coords only where available (with gaps during outage)
    const gnssCoords: [number, number][] = frames
      .filter((f) => f.gnssAvailable && f.gnssLat && f.gnssLon)
      .map((f) => [f.gnssLat!, f.gnssLon!]);

    if (gtPolylineRef.current) gtPolylineRef.current.setLatLngs(gtCoords);
    if (gnssPolylineRef.current) gnssPolylineRef.current.setLatLngs(gnssCoords);
    if (rawDrPolylineRef.current) rawDrPolylineRef.current.setLatLngs(rawDrCoords);
    if (aiDrPolylineRef.current) aiDrPolylineRef.current.setLatLngs(aiDrCoords);

    // Update Outage Zone Highlights
    if (outagePolygonsRef.current) {
      outagePolygonsRef.current.clearLayers();
      outages.forEach((outage) => {
        const oFrames = frames.slice(outage.startIndex, outage.endIndex + 1);
        if (oFrames.length > 1) {
          const latLngs: [number, number][] = oFrames.map((f) => [f.gtLat, f.gtLon]);
          // Draw bold orange/amber outage track
          const outageTrack = L.polyline(latLngs, {
            color: '#f59e0b',
            weight: 8,
            opacity: 0.45,
            dashArray: '8, 8',
          });

          const midIndex = Math.floor(oFrames.length / 2);
          const midFrame = oFrames[midIndex];

          const popupHtml = `
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
          `;
          outageTrack.bindPopup(popupHtml);
          outagePolygonsRef.current?.addLayer(outageTrack);
        }
      });
    }

    // Fit bounds once on dataset load
    if (gtCoords.length > 0) {
      const bounds = L.latLngBounds(gtCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [frames, outages]);

  // Update Active Vehicle Marker Position & Heading
  useEffect(() => {
    if (!currentFrame || !vehicleMarkerRef.current) return;

    // Use AI DR position during outage, or GNSS/GroundTruth when available
    const activeLat = currentFrame.isOutage
      ? currentFrame.aiDrLat
      : (currentFrame.gnssLat ?? currentFrame.gtLat);
    const activeLon = currentFrame.isOutage
      ? currentFrame.aiDrLon
      : (currentFrame.gnssLon ?? currentFrame.gtLon);

    vehicleMarkerRef.current.setLatLng([activeLat, activeLon]);

    // Rotate vehicle glyph
    const heading = currentFrame.gtHeading;
    const glyph = document.getElementById('vehicle-glyph');
    if (glyph) {
      glyph.style.transform = `rotate(${heading}deg)`;
    }

    // Auto-center map if enabled
    if (autoCenter && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([activeLat, activeLon], {
        animate: true,
        duration: 0.2,
      });
    }
  }, [currentFrameIndex, currentFrame, autoCenter]);

  // Handle layer toggles
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (gtPolylineRef.current) {
      if (showGT) map.addLayer(gtPolylineRef.current);
      else map.removeLayer(gtPolylineRef.current);
    }
    if (gnssPolylineRef.current) {
      if (showGNSS) map.addLayer(gnssPolylineRef.current);
      else map.removeLayer(gnssPolylineRef.current);
    }
    if (rawDrPolylineRef.current) {
      if (showRawDR) map.addLayer(rawDrPolylineRef.current);
      else map.removeLayer(rawDrPolylineRef.current);
    }
    if (aiDrPolylineRef.current) {
      if (showAiDR) map.addLayer(aiDrPolylineRef.current);
      else map.removeLayer(aiDrPolylineRef.current);
    }
    if (outagePolygonsRef.current) {
      if (showOutageZones) map.addLayer(outagePolygonsRef.current);
      else map.removeLayer(outagePolygonsRef.current);
    }
  }, [showGT, showGNSS, showRawDR, showAiDR, showOutageZones]);

  // Switch basemap layer dynamically without watermarks
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.remove();

    const metaEnv = (import.meta as any).env;
    const cartoKey = metaEnv?.VITE_CARTO_API_KEY;

    if (mapLayer === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '&copy; Esri Earthstar Geographics',
        }
      ).addTo(mapInstanceRef.current);
    } else if (mapLayer === 'street') {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          attribution: '&copy; OpenStreetMap contributors',
        }
      ).addTo(mapInstanceRef.current);
    } else {
      // Tactical Dark mode (Clean OpenStreetMap + Dark filter - 100% watermark-free)
      const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      tileLayerRef.current = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current);
    }
  }, [mapLayer]);

  const handleRecenter = () => {
    if (!mapInstanceRef.current || !currentFrame) return;
    mapInstanceRef.current.setView(
      [currentFrame.gtLat, currentFrame.gtLon],
      18,
      { animate: true }
    );
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current || frames.length === 0) return;
    const bounds = L.latLngBounds(frames.map((f) => [f.gtLat, f.gtLon]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
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

        {/* Outage Warning Banner if inside outage - directly from Design HTML */}
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

        {/* Basemap Style Switcher (Watermark-Free) */}
        <div className="flex items-center bg-[#0e1116] border border-[#2D333B] rounded p-0.5 text-[10px] font-mono mr-1">
          <button
            type="button"
            title="Tactical High-Contrast Dark Map (Clean, Zero Watermarks)"
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
            title="True Orbital Satellite Imagery (Esri, Zero Watermarks)"
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
            title="OpenStreetMap Standard Roads (Zero Watermarks)"
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
          onClick={handleRecenter}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#20252E] transition-colors"
        >
          <Navigation className="w-4 h-4" />
        </button>

        <button
          id="btn-fit-all"
          title="Fit Whole Trajectory"
          onClick={handleFitAll}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#20252E] transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Map DOM Canvas */}
      <div
        ref={mapContainerRef}
        className={`w-full h-full flex-1 z-0 bg-[#0d0f12] ${
          mapLayer === 'tactical' ? 'leaflet-dark-tiles' : ''
        }`}
      />

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
