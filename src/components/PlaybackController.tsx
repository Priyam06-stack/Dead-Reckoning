import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  FastForward,
  Radio,
  Clock,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { NavigationFrame, OutageInterval } from '../types/navigation';

interface PlaybackControllerProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  currentFrameIndex: number;
  totalFrames: number;
  onSeek: (index: number) => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  frames: NavigationFrame[];
  outages: OutageInterval[];
  onToggleManualOutage?: () => void;
  isManualOutageActive?: boolean;
}

export const PlaybackController: React.FC<PlaybackControllerProps> = ({
  isPlaying,
  onTogglePlay,
  onRestart,
  onStepForward,
  onStepBack,
  currentFrameIndex,
  totalFrames,
  onSeek,
  playbackSpeed,
  onChangeSpeed,
  frames,
  outages,
  onToggleManualOutage,
  isManualOutageActive,
}) => {
  const currentFrame = frames[currentFrameIndex] || frames[0];
  const currentTimeSec = currentFrame ? currentFrame.relativeSec : 0;
  const totalDurationSec = frames.length > 0 ? frames[frames.length - 1].relativeSec : 0;

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const tenths = Math.floor((sec % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };

  const jumpToOutage = (outage: OutageInterval) => {
    onSeek(outage.startIndex);
  };

  return (
    <div className="w-full bg-[#12161E] border border-[#242C3B] rounded-xl p-3.5 shadow-md flex flex-col gap-3">
      {/* Timeline Scrubber with Outage Highlights */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
            <Clock className="w-4 h-4" />
            <span>Time: {formatTime(currentTimeSec)}</span>
            <span className="text-gray-500 font-normal">/ {formatTime(totalDurationSec)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {outages.map((o) => (
              <button
                key={o.id}
                onClick={() => jumpToOutage(o)}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                title={`Jump directly to Tunnel Outage #${o.id} (${o.durationSec}s)`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Jump to Tunnel #{o.id} ({o.durationSec}s)</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Progress Bar with Outage Colored Spans */}
        <div className="relative w-full h-3.5 bg-[#1C222C] rounded-full overflow-hidden cursor-pointer group shadow-inner border border-[#242C3B]">
          {/* Outage indicator zones */}
          {outages.map((o) => {
            const startPct = (o.startIndex / Math.max(1, totalFrames - 1)) * 100;
            const endPct = (o.endIndex / Math.max(1, totalFrames - 1)) * 100;
            const widthPct = Math.max(1, endPct - startPct);
            return (
              <div
                key={o.id}
                style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                className="absolute top-0 bottom-0 bg-rose-500/40 border-x border-rose-500/80 z-10 hover:bg-rose-500/60"
                title={`Tunnel Outage: ${o.environment} (${o.durationSec}s)`}
              />
            );
          })}

          {/* Progress fill */}
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-75 z-20"
            style={{
              width: `${(currentFrameIndex / Math.max(1, totalFrames - 1)) * 100}%`,
            }}
          />

          {/* Native Range Input overlaid */}
          <input
            type="range"
            min={0}
            max={Math.max(0, totalFrames - 1)}
            value={currentFrameIndex}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
          />
        </div>
      </div>

      {/* Control Buttons & Playback Parameters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#242C3B]">
        {/* Play / Step Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-restart"
            onClick={onRestart}
            title="Restart to Beginning"
            className="p-2 rounded-lg bg-[#181E27] text-gray-300 hover:text-white hover:bg-[#202835] transition-colors border border-[#262F3E] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="btn-step-back"
            onClick={onStepBack}
            title="Step Backward (0.5s)"
            className="p-2 rounded-lg bg-[#181E27] text-gray-300 hover:text-white hover:bg-[#202835] transition-colors border border-[#262F3E] cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            id="btn-play-pause"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause simulation' : 'Start simulation'}
            className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-95 ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>PLAY SIMULATION</span>
              </>
            )}
          </button>

          <button
            id="btn-step-forward"
            onClick={onStepForward}
            title="Step Forward (0.5s)"
            className="p-2 rounded-lg bg-[#181E27] text-gray-300 hover:text-white hover:bg-[#202835] transition-colors border border-[#262F3E] cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Multipliers */}
        <div className="flex items-center gap-1 bg-[#181E27] p-1 rounded-lg border border-[#262F3E] text-xs">
          <span className="text-[10px] text-gray-400 px-1 font-semibold">SPEED:</span>
          {[0.5, 1, 2, 5].map((spd) => (
            <button
              key={spd}
              onClick={() => onChangeSpeed(spd)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                playbackSpeed === spd
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-[#202835]'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Outage Simulation Trigger */}
        {onToggleManualOutage && (
          <button
            id="btn-trigger-outage"
            onClick={onToggleManualOutage}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
              isManualOutageActive
                ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 animate-pulse'
                : 'bg-[#181E27] hover:bg-[#202835] border-[#262F3E] text-gray-300'
            }`}
            title="Instantly trigger a simulated GPS loss / tunnel blackout"
          >
            <ShieldAlert className={`w-4 h-4 ${isManualOutageActive ? 'text-rose-400' : 'text-gray-400'}`} />
            <span>{isManualOutageActive ? 'Outage Active: AI On' : 'Simulate GPS Outage'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
