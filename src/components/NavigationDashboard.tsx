import React, { useState } from 'react';
import {
  NavigationFrame,
  OutageInterval,
  TrajectorySummary,
  NavMode,
} from '../types/navigation';
import {
  Satellite,
  Compass,
  AlertTriangle,
  Radio,
  MapPin,
  TrendingDown,
  Clock,
  Gauge,
  Activity,
  CheckCircle2,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { TrajectoryMap } from './TrajectoryMap';
import { PlaybackController } from './PlaybackController';
import { TelemetrySensors } from './TelemetrySensors';

interface NavigationDashboardProps {
  frames: NavigationFrame[];
  currentFrameIndex: number;
  trajectorySummary: TrajectorySummary;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onSeek: (index: number) => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onSelectScenario: (scenarioId: string) => void;
  currentScenarioId: string;
  onToggleManualOutage: () => void;
  isManualOutageActive: boolean;
  onOpenRoutePlanner?: () => void;
}

const QUICK_SCENARIOS = [
  { id: 'bengaluru-urban-underpass', label: 'Bengaluru Underpass', tag: 'City Tunnel' },
  { id: 'highspeed-highway-tunnel', label: 'Highway Mountain Tunnel', tag: 'High Speed' },
  { id: 'multilevel-spiral-parking', label: 'Multi-Level Parking', tag: 'Spiral Turns' },
  { id: 'io-vnbd-benchmark', label: 'IO-VNBD Benchmark', tag: 'Urban Canyon' },
];

export const NavigationDashboard: React.FC<NavigationDashboardProps> = ({
  frames,
  currentFrameIndex,
  trajectorySummary,
  isPlaying,
  onTogglePlay,
  onRestart,
  onStepForward,
  onStepBack,
  onSeek,
  playbackSpeed,
  onChangeSpeed,
  onSelectScenario,
  currentScenarioId,
  onToggleManualOutage,
  isManualOutageActive,
  onOpenRoutePlanner,
}) => {
  const [showAdvancedSensors, setShowAdvancedSensors] = useState<boolean>(false);
  const currentFrame = frames[currentFrameIndex] || frames[0];
  const { metrics, outages } = trajectorySummary;

  if (!currentFrame) {
    return (
      <div className="p-8 text-center text-gray-400 font-medium">
        Loading navigation simulation...
      </div>
    );
  }

  // Active coordinates based on mode
  const currentLat = currentFrame.isOutage
    ? currentFrame.aiDrLat
    : (currentFrame.gnssLat ?? currentFrame.gtLat);
  const currentLon = currentFrame.isOutage
    ? currentFrame.aiDrLon
    : (currentFrame.gnssLon ?? currentFrame.gtLon);

  const speedKmh = currentFrame.odometrySpeed * 3.6;

  // Cardinal direction helper
  const getCardinal = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  // Simple, friendly mode badge
  const getModeBadge = (mode: NavMode) => {
    switch (mode) {
      case 'GNSS':
        return {
          title: 'GPS Signal Strong',
          subtitle: 'Tracking vehicle position accurately via NavIC & GPS satellites',
          badgeText: 'GPS ACTIVE',
          bgColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dotColor: 'bg-emerald-400',
          icon: Satellite,
        };
      case 'DEAD_RECKONING':
        return {
          title: 'GPS Lost: Uncompensated Drift',
          subtitle: 'Sensors are drifting off course without AI corrections',
          badgeText: 'SENSOR DRIFT',
          bgColor: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dotColor: 'bg-rose-500',
          icon: AlertTriangle,
        };
      case 'AI_ENHANCED_DR':
        return {
          title: 'Tunnel Detected: AI Navigating',
          subtitle: 'Neural drift compensator is canceling sensor errors in real time',
          badgeText: 'AI TAKEOVER',
          bgColor: 'bg-blue-500/15 border-blue-500/50 text-blue-300',
          dotColor: 'bg-blue-400 animate-pulse',
          icon: Cpu,
        };
      case 'GNSS_RECOVERY':
        return {
          title: 'Exiting Tunnel: Reacquiring GPS',
          subtitle: 'Smoothly realigning vehicle trajectory with incoming satellites',
          badgeText: 'RECOVERING',
          bgColor: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
          dotColor: 'bg-cyan-400',
          icon: CheckCircle2,
        };
    }
  };

  const modeBadge = getModeBadge(currentFrame.mode);
  const ModeIcon = modeBadge.icon;
  const totalDistanceKm = (metrics.totalDistanceMeters / 1000).toFixed(2);
  const driftAvoidedMeters = Math.max(0, currentFrame.rawDrErrorMeters - currentFrame.aiDrErrorMeters).toFixed(1);

  return (
    <div className="space-y-4 pb-12">
      {/* 1-Click Scenario Quick Switcher */}
      <div className="bg-[#12161E] border border-[#242C3B] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">
            Scenarios:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_SCENARIOS.map((sc) => {
              const isSelected = currentScenarioId === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onSelectScenario(sc.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                      : 'bg-[#181E27] text-gray-300 hover:text-white hover:bg-[#222A36] border border-[#262F3E]'
                  }`}
                >
                  <span>{sc.label}</span>
                  <span
                    className={`text-[10px] px-1 rounded ${
                      isSelected ? 'bg-blue-700/60 text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {sc.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {onOpenRoutePlanner && (
          <button
            type="button"
            onClick={onOpenRoutePlanner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Search Places & Plan Custom Route ➔</span>
          </button>
        )}
      </div>

      {/* 3 Clear, Human-Readable Primary Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Navigation State */}
        <div className="bg-[#12161E] border border-[#242C3B] rounded-xl p-4 shadow-md flex items-center gap-3.5">
          <div className={`p-3 rounded-xl border ${modeBadge.bgColor} shrink-0`}>
            <ModeIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${modeBadge.dotColor}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {modeBadge.badgeText}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5 truncate">
              {modeBadge.title}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              {modeBadge.subtitle}
            </p>
          </div>
        </div>

        {/* Card 2: Vehicle Motion */}
        <div className="bg-[#12161E] border border-[#242C3B] rounded-xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1.5 font-semibold text-gray-300">
              <Gauge className="w-4 h-4 text-blue-400" />
              <span>Vehicle Movement</span>
            </div>
            <span className="text-[11px] font-medium bg-[#181E27] px-2 py-0.5 rounded text-blue-300 border border-[#262F3E]">
              Heading: {currentFrame.gtHeading.toFixed(0)}° {getCardinal(currentFrame.gtHeading)}
            </span>
          </div>

          <div className="my-1.5 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold text-white tracking-tight">
                {speedKmh.toFixed(0)}
              </span>
              <span className="text-xs text-gray-400 font-medium ml-1">km/h</span>
            </div>
            <div className="text-xs text-gray-400 text-right">
              Distance: <span className="font-semibold text-white">{totalDistanceKm} km</span>
            </div>
          </div>

          <div className="w-full bg-[#1C222C] h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-150"
              style={{ width: `${Math.min(100, (speedKmh / 90) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 3: AI Positioning Accuracy */}
        <div className="bg-[#12161E] border border-[#242C3B] rounded-xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1.5 font-semibold text-gray-300">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>AI Precision</span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {metrics.overallImprovementPct}% Drift Reduction
            </span>
          </div>

          <div className="my-1.5 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold text-emerald-400 tracking-tight">
                {currentFrame.isOutage ? `±${currentFrame.aiDrErrorMeters.toFixed(2)}m` : '±0.35m'}
              </span>
              <span className="text-xs text-gray-400 font-medium ml-1.5">current drift</span>
            </div>
            <div className="text-xs text-right">
              {currentFrame.isOutage ? (
                <span className="text-rose-400 font-medium">
                  Raw would drift: {currentFrame.rawDrErrorMeters.toFixed(1)}m
                </span>
              ) : (
                <span className="text-gray-400">Nominal GPS noise</span>
              )}
            </div>
          </div>

          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-0.5">
            <span>AI avoided: <b className="text-emerald-400">{driftAvoidedMeters}m</b> drift</span>
            <span className="text-gray-500">Latency: &lt;1.2 ms</span>
          </div>
        </div>
      </div>

      {/* Main Trajectory Map Canvas */}
      <div className="w-full h-[520px] rounded-xl overflow-hidden border border-[#242C3B] shadow-lg">
        <TrajectoryMap
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          outages={outages}
          onSelectFrame={onSeek}
          activeMode={currentFrame.mode}
          onOpenRoutePlanner={onOpenRoutePlanner}
        />
      </div>

      {/* Playback Controls & Timeline Scrubber */}
      <PlaybackController
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onRestart={onRestart}
        onStepForward={onStepForward}
        onStepBack={onStepBack}
        currentFrameIndex={currentFrameIndex}
        totalFrames={frames.length}
        onSeek={onSeek}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={onChangeSpeed}
        frames={frames}
        outages={outages}
        onToggleManualOutage={onToggleManualOutage}
        isManualOutageActive={isManualOutageActive}
      />

      {/* Collapsible Technical Sensor Telemetry Toggle */}
      <div className="bg-[#12161E] border border-[#242C3B] rounded-xl p-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-gray-200">
              Technical Telemetry: 6-DoF Inertial Sensors & Accelerations
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedSensors((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#181E27] hover:bg-[#202835] border border-[#262F3E] text-xs font-medium text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <span>{showAdvancedSensors ? 'Hide Detailed Sensors' : 'View Detailed Sensors'}</span>
            {showAdvancedSensors ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        </div>

        {/* Expanded 6-DoF Sensor Cards */}
        {showAdvancedSensors && (
          <div className="mt-3 pt-3 border-t border-[#242C3B]">
            <TelemetrySensors frame={currentFrame} />
          </div>
        )}
      </div>

      {/* Evaluation Results Footer */}
      <div className="bg-[#10131A] border border-[#242C3B] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-gray-200 font-semibold">SIH 2026 Evaluation:</span>
          <span>Unassisted Dead Reckoning Error: <b className="text-rose-400">{metrics.rawDrRMSE}m</b></span>
          <span className="text-gray-600">•</span>
          <span>AI-Enhanced DR Error: <b className="text-blue-400">{metrics.aiDrRMSE}m</b></span>
          <span className="text-gray-600">•</span>
          <span className="text-emerald-400 font-semibold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
            {metrics.overallImprovementPct}% Overall Accuracy Improvement
          </span>
        </div>

        <div className="text-[11px] text-gray-500 flex items-center gap-2">
          <span>Frames: {frames.length}</span>
          <span>•</span>
          <span>Sampling: 2.0 Hz</span>
          <span>•</span>
          <span>WGS-84 Datum</span>
        </div>
      </div>
    </div>
  );
};
