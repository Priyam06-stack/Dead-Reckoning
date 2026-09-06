import React, { useState } from 'react';
import {
  NavigationFrame,
  OutageInterval,
  TrajectorySummary,
} from '../types/navigation';
import {
  Satellite,
  AlertTriangle,
  Radio,
  Clock,
  ShieldAlert,
  Zap,
  CheckCircle2,
  TrendingDown,
  FileSpreadsheet,
} from 'lucide-react';

interface GNSSAnalysisProps {
  frames: NavigationFrame[];
  trajectorySummary: TrajectorySummary;
  onInjectCustomOutage: (startSec: number, durationSec: number, env: string) => void;
  isManualOutageActive: boolean;
  onToggleManualOutage: () => void;
}

export const GNSSAnalysis: React.FC<GNSSAnalysisProps> = ({
  frames,
  trajectorySummary,
  onInjectCustomOutage,
  isManualOutageActive,
  onToggleManualOutage,
}) => {
  const { outages, metrics } = trajectorySummary;

  // Custom outage injection parameters
  const [customStartSec, setCustomStartSec] = useState<number>(25);
  const [customDurationSec, setCustomDurationSec] = useState<number>(30);
  const [customEnvironment, setCustomEnvironment] = useState<string>('Urban Canyon Underpass');

  return (
    <div className="space-y-6 font-mono max-w-6xl mx-auto pb-12">
      {/* Overview Card */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Satellite className="w-5 h-5 text-blue-400" />
              <span>GNSS Outage Detection & Signal Loss Analysis</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1 max-w-3xl">
              Automatic threshold detector identifies signal loss, multi-path degradation, and tunnel blackouts.
              Evaluates dead reckoning resilience and drift accumulation during uninterrupted outages.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleManualOutage}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
                isManualOutageActive
                  ? 'bg-red-500/15 border border-red-500/50 text-red-400 animate-pulse'
                  : 'bg-[#15181E] hover:bg-[#20252E] text-gray-200 border border-[#2D333B]'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{isManualOutageActive ? 'OUTAGE FORCED (ACTIVE)' : 'Simulate RF Jamming'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Outage Breakdown Interval Cards */}
      <div>
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>Detected Outage Events & Comparative Drift Table</span>
          <span className="text-xs text-red-400 font-normal">
            ({outages.length} Outage Event{outages.length !== 1 ? 's' : ''} in Active Dataset)
          </span>
        </h3>

        {outages.length === 0 ? (
          <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-8 text-center text-gray-400 text-xs">
            No GNSS outages detected in the current dataset slice. You can inject an outage below.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outages.map((outage) => (
              <div
                key={outage.id}
                className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-lg space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#2D333B] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold">
                      OUTAGE #{outage.id}
                    </span>
                    <span className="text-xs font-semibold text-gray-200">
                      {outage.environment}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-bold">
                    {outage.durationSec}s Duration
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#0A0B0D] p-2.5 rounded-lg border border-[#2D333B]">
                    <div className="text-[10px] text-gray-500">Time Interval</div>
                    <div className="font-bold text-blue-400">
                      T+ {outage.startSec}s → T+ {outage.endSec}s
                    </div>
                  </div>
                  <div className="bg-[#0A0B0D] p-2.5 rounded-lg border border-[#2D333B]">
                    <div className="text-[10px] text-gray-500">Avg Outage Speed</div>
                    <div className="font-bold text-white">
                      {(outage.avgVelocityMs * 3.6).toFixed(1)} km/h
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-red-500/10 p-2.5 rounded-lg border border-red-500/30">
                    <div className="text-[10px] text-red-400 font-semibold">Raw DR Peak Drift</div>
                    <div className="text-lg font-bold text-red-400">
                      {outage.rawPeakErrorMeters} m
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Rate: {(outage.rawPeakErrorMeters / outage.durationSec).toFixed(2)} m/s
                    </div>
                  </div>

                  <div className="bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/30">
                    <div className="text-[10px] text-blue-300 font-semibold">AI Compensated Drift</div>
                    <div className="text-lg font-bold text-blue-400">
                      {outage.aiPeakErrorMeters} m
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Rate: {(outage.aiPeakErrorMeters / outage.durationSec).toFixed(2)} m/s
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#2D333B] flex items-center justify-between text-xs">
                  <span className="text-gray-400">Drift Reduction Factor:</span>
                  <span className="px-2 py-0.5 rounded bg-green-500/10 border border-green-500/40 text-green-400 font-bold">
                    {outage.improvementPct}% Improvement
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Outage Injection & Simulation Controls */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          <span>Interactive GNSS Outage Injector (Simulation Laboratory)</span>
        </h3>
        <p className="text-xs text-gray-400">
          Inject simulated GNSS blockage into the current trajectory at any time stamp to test the
          Dead Reckoning engine's real-time detection, error accumulation, and recovery realignment.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-gray-400 mb-1">Outage Start Time (seconds):</label>
            <input
              type="number"
              value={customStartSec}
              onChange={(e) => setCustomStartSec(Math.max(0, Number(e.target.value)))}
              className="w-full bg-[#0A0B0D] border border-[#2D333B] rounded-lg p-2 text-white font-bold"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-1">Duration (seconds):</label>
            <input
              type="number"
              value={customDurationSec}
              onChange={(e) => setCustomDurationSec(Math.max(5, Number(e.target.value)))}
              className="w-full bg-[#0A0B0D] border border-[#2D333B] rounded-lg p-2 text-white font-bold"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-1">Environment / Scenario:</label>
            <select
              value={customEnvironment}
              onChange={(e) => setCustomEnvironment(e.target.value)}
              className="w-full bg-[#0A0B0D] border border-[#2D333B] rounded-lg p-2 text-white"
            >
              <option value="Tunnel">Mountain Tunnel</option>
              <option value="Underpass">Urban Canyon Underpass</option>
              <option value="Dense Forest">Dense Forest Canopy</option>
              <option value="Multi-Level Parking">Multi-Level Parking Structure</option>
              <option value="EMI Jamming">Electromagnetic Jamming (EW)</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => onInjectCustomOutage(customStartSec, customDurationSec, customEnvironment)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-[0_0_12px_rgba(37,99,235,0.3)] transition-all"
        >
          <Zap className="w-4 h-4" />
          <span>Apply Injected Outage & Recompute Engine</span>
        </button>
      </div>
    </div>
  );
};
