import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Navigation, Crosshair } from 'lucide-react';
import { searchPlaces, GeocodingResult, LatLngPoint } from '../utils/routeServices';

interface PlaceSearchInputProps {
  label: string;
  badgeLabel: 'START (A)' | 'DESTINATION (B)';
  badgeColor: 'emerald' | 'rose';
  location: LatLngPoint;
  locationName: string;
  onLocationChange: (point: LatLngPoint, name: string) => void;
  isPickingOnMap: boolean;
  onTogglePickOnMap: () => void;
  placeholder?: string;
  idPrefix: string;
}

export const PlaceSearchInput: React.FC<PlaceSearchInputProps> = ({
  label,
  badgeLabel,
  badgeColor,
  location,
  locationName,
  onLocationChange,
  isPickingOnMap,
  onTogglePickOnMap,
  placeholder = 'Search place, address, city or landmark...',
  idPrefix,
}) => {
  const [query, setQuery] = useState(locationName || '');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync with prop changes when preset or reverse-geocode changes
  useEffect(() => {
    if (locationName) {
      setQuery(locationName);
    }
  }, [locationName]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle typing search with 300ms debounce
  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    if (!val || val.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);

    debounceTimerRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();
      try {
        const hits = await searchPlaces(val, abortControllerRef.current.signal);
        setResults(hits);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 320);
  };

  const handleSelectResult = (result: GeocodingResult) => {
    const title = result.name || result.displayName.split(',')[0];
    const fullDesc = result.city
      ? `${title}, ${result.city}`
      : result.displayName.split(',').slice(0, 3).join(', ');

    setQuery(fullDesc);
    setIsOpen(false);
    setResults([]);
    onLocationChange({ lat: result.lat, lng: result.lng }, fullDesc);
  };

  // Browser Geolocation (Current device position)
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const desc = `My Current Location (${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)})`;
        setQuery(desc);
        onLocationChange(pt, desc);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const isGreen = badgeColor === 'emerald';

  return (
    <div
      ref={containerRef}
      className={`p-3.5 rounded-xl border transition-all relative ${
        isGreen
          ? 'bg-[#121815] border-emerald-500/40 focus-within:border-emerald-500'
          : 'bg-[#181315] border-rose-500/40 focus-within:border-rose-500'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isGreen ? 'bg-emerald-400 ring-2 ring-emerald-400/30' : 'bg-rose-500 ring-2 ring-rose-500/30'
            }`}
          />
          <span className="text-[11px] font-bold text-white tracking-wider uppercase">
            {label}
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              isGreen
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}
          >
            {badgeLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            id={`${idPrefix}-pick-map`}
            onClick={onTogglePickOnMap}
            className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1 border ${
              isPickingOnMap
                ? isGreen
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : 'bg-rose-600 text-white border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                : isGreen
                ? 'bg-[#18231C] text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-[#26181C] text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            <Crosshair className="w-3 h-3" />
            <span>{isPickingOnMap ? 'Picking...' : 'Pick on Map'}</span>
          </button>

          <button
            type="button"
            title="Use current device GPS location"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-black/30 transition-all cursor-pointer"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : (
              <Navigation className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowCoords(!showCoords)}
            title="Toggle raw coordinates"
            className={`text-[10px] px-1.5 py-0.5 rounded transition-all cursor-pointer font-mono ${
              showCoords ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {showCoords ? 'Hide Lat/Lng' : 'Lat/Lng'}
          </button>
        </div>
      </div>

      {/* Main Search Input Field */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        <input
          id={`${idPrefix}-search-input`}
          type="text"
          value={query}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 bg-[#0A0C0E] border border-[#2D333B] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-sans transition-all"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Search Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0F1318] border border-[#3A424E] rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto font-sans">
          {isLoading ? (
            <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Searching locations worldwide...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-[#222831]">
              {results.map((item) => (
                <button
                  key={item.placeId}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="w-full p-2.5 text-left hover:bg-[#1A222C] transition-colors flex items-start gap-2.5 cursor-pointer group"
                >
                  <MapPin className="w-4 h-4 text-blue-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <span>{item.name}</span>
                      {item.type && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-gray-400 font-mono">
                          {item.type}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate mt-0.5 leading-tight">
                      {item.displayName}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-gray-400">
              No matching locations found. Try city, landmark, or street name.
            </div>
          )}
        </div>
      )}

      {/* Optional Raw Coordinate Inputs */}
      {showCoords && (
        <div className="mt-2.5 pt-2.5 border-t border-[#2D333B]/60 grid grid-cols-2 gap-2 text-xs font-mono">
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Latitude:</label>
            <input
              type="number"
              step="0.0001"
              value={location.lat}
              onChange={(e) => {
                const newLat = parseFloat(e.target.value) || 0;
                onLocationChange({ ...location, lat: newLat }, `${newLat.toFixed(4)}, ${location.lng.toFixed(4)}`);
              }}
              className="w-full bg-[#0A0C0E] border border-[#2D333B] rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Longitude:</label>
            <input
              type="number"
              step="0.0001"
              value={location.lng}
              onChange={(e) => {
                const newLng = parseFloat(e.target.value) || 0;
                onLocationChange({ ...location, lng: newLng }, `${location.lat.toFixed(4)}, ${newLng.toFixed(4)}`);
              }}
              className="w-full bg-[#0A0C0E] border border-[#2D333B] rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
