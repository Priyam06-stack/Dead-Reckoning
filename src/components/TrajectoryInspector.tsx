import React, { useState } from 'react';
import {
  NavigationFrame,
  OutageInterval,
  TrajectorySummary,
} from '../types/navigation';
import {
  Activity,
  Crosshair,
  Sliders,
  AlertTriangle,
  CheckCircle,
  Eye,
  Maximize2,
  TrendingUp,
} from 'lucide-react';
import { TrajectoryMap } from './TrajectoryMap';

interface TrajectoryInspectorProps {
  frames: NavigationFrame[];
  currentFrameIndex: number;
  trajectorySummary: TrajectorySummary;
  onSelectFrame: (index: number) => void;
}

export const TrajectoryInspector: React.FC<TrajectoryInspectorProps> = ({
  frames,
  currentFrameIndex,
  trajectorySummary,
  onSelectFrame,
}) => {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(currentFrameIndex);

  const selectedFrame = frames[selectedPointIndex] || frames[0];
  const { metrics, outages } = trajectorySummary;

  if (!selectedFrame) return null;

  return (
    <div className="space-y-4 font-mono pb-12">
      {/* Header Info */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span>Multi-Trajectory Analysis & Point Inspection</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Compare Ground Truth vs GNSS vs Raw Dead Reckoning vs AI-ML Enhanced trajectory.
            Inspect instantaneous error vectors and sensor states at any point in time.
          </p>
        </div>

        {/* Selected Frame Quick Jump */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Inspecting Frame:</span>
          <span className="px-2.5 py-1 rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold">
            #{selectedFrame.index} (T+ {selectedFrame.relativeSec}s)
          </span>
        </div>
      </div>

      {/* Main Map with Inspection */}
      <div className="w-full h-[480px]">
        <TrajectoryMap
          frames={frames}
          currentFrameIndex={selectedPointIndex}
          outages={outages}
          onSelectFrame={(idx) => {
            setSelectedPointIndex(idx);
            onSelectFrame(idx);
          }}
          activeMode={selectedFrame.mode}
        />
      </div>

      {/* Trajectory Scrubber for Inspection */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Scrub to inspect any point along trajectory:</span>
          <span className="text-blue-400 font-bold">
            T+ {selectedFrame.relativeSec}s / {frames[frames.length - 1]?.relativeSec}s
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={selectedPointIndex}
          onChange={(e) => {
            const idx = Number(e.target.value);
            setSelectedPointIndex(idx);
            onSelectFrame(idx);
          }}
          className="w-full h-2 bg-[#0A0B0D] rounded-lg cursor-pointer accent-blue-500 border border-[#2D333B]"
        />
      </div>

      {/* Point Telemetry Breakdown Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Ground Truth */}
        <div className="bg-[#111418] border border-green-500/40 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-green-400 text-xs font-bold mb-2">
            <span>GROUND TRUTH</span>
            <span className="w-2 h-2 rounded-full bg-green-400" />
          </div>
          <div className="space-y-1.5 text-xs text-gray-300">
            <div>Lat: <b className="text-white">{selectedFrame.gtLat.toFixed(6)}°</b></div>
            <div>Lon: <b className="text-white">{selectedFrame.gtLon.toFixed(6)}°</b></div>
            <div>Heading: <b className="text-white">{selectedFrame.gtHeading.toFixed(1)}°</b></div>
            <div>Speed: <b className="text-white">{(selectedFrame.odometrySpeed * 3.6).toFixed(1)} km/h</b></div>
          </div>
        </div>

        {/* GNSS Measurement */}
        <div className="bg-[#111418] border border-blue-500/40 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-blue-400 text-xs font-bold mb-2">
            <span>RAW GNSS MEASUREMENT</span>
            <span className={`w-2 h-2 rounded-full ${selectedFrame.gnssAvailable ? 'bg-blue-400' : 'bg-red-500'}`} />
          </div>
          <div className="space-y-1.5 text-xs text-gray-300">
            {selectedFrame.gnssAvailable ? (
              <>
                <div>Lat: <b className="text-white">{selectedFrame.gnssLat?.toFixed(6)}°</b></div>
                <div>Lon: <b className="text-white">{selectedFrame.gnssLon?.toFixed(6)}°</b></div>
                <div>Fix Quality: <b className="text-green-400">100% (Nominal)</b></div>
                <div>Status: <b className="text-blue-400">RECEIVING SATELLITE FIX</b></div>
              </>
            ) : (
              <div className="p-2 rounded bg-red-950/60 border border-red-800/50 text-red-300 text-xs font-bold text-center">
                ⚠️ SIGNAL BLACKOUT (GNSS UNAVAILABLE)
              </div>
            )}
          </div>
        </div>

        {/* Raw Dead Reckoning */}
        <div className="bg-[#111418] border border-red-500/40 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-red-400 text-xs font-bold mb-2">
            <span>RAW DEAD RECKONING</span>
            <span className="w-2 h-2 rounded-full bg-red-500" />
          </div>
          <div className="space-y-1.5 text-xs text-gray-300">
            <div>Lat: <b className="text-white">{selectedFrame.rawDrLat.toFixed(6)}°</b></div>
            <div>Lon: <b className="text-white">{selectedFrame.rawDrLon.toFixed(6)}°</b></div>
            <div>Heading: <b className="text-white">{selectedFrame.rawDrHeading.toFixed(1)}°</b></div>
            <div>
              Accumulated Error:{' '}
              <b className="text-red-400 font-extrabold">{selectedFrame.rawDrErrorMeters}m</b>
            </div>
          </div>
        </div>

        {/* AI-ML Enhanced Dead Reckoning */}
        <div className="bg-[#111418] border border-blue-500/50 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-blue-300 text-xs font-bold mb-2">
            <span>AI/ML ENHANCED DR</span>
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          </div>
          <div className="space-y-1.5 text-xs text-gray-300">
            <div>Lat: <b className="text-white">{selectedFrame.aiDrLat.toFixed(6)}°</b></div>
            <div>Lon: <b className="text-white">{selectedFrame.aiDrLon.toFixed(6)}°</b></div>
            <div>Heading: <b className="text-white">{selectedFrame.aiDrHeading.toFixed(1)}°</b></div>
            <div>
              Corrected Error:{' '}
              <b className="text-blue-300 font-extrabold">{selectedFrame.aiDrErrorMeters}m</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
