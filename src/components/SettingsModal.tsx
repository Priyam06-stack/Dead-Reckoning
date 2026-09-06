import React from 'react';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Compass,
  Sliders,
} from 'lucide-react';
import { DeadReckoningConfig } from '../engine/deadReckoning';

interface SettingsProps {
  config: DeadReckoningConfig;
  onUpdateConfig: (newConfig: Partial<DeadReckoningConfig>) => void;
  onResetDefaults: () => void;
}

export const SettingsModal: React.FC<SettingsProps> = ({
  config,
  onUpdateConfig,
  onResetDefaults,
}) => {
  return (
    <div className="space-y-6 font-mono max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-blue-400" />
              <span>Navigation Sensor Fusion & Simulation Settings</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Configure physics parameters, MEMS sensor noise characteristics, and recovery filter relaxation.
            </p>
          </div>

          <button
            onClick={onResetDefaults}
            className="px-3 py-1.5 rounded-lg bg-[#15181E] hover:bg-[#20252E] text-gray-300 text-xs font-bold flex items-center gap-1.5 border border-[#2D333B] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Physics & Sensor Parameters */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span>Inertial MEMS Noise & Sensor Simulation</span>
        </h3>

        <div className="space-y-4 text-xs">
          {/* Gyro Bias */}
          <div>
            <div className="flex justify-between text-gray-400 mb-1">
              <span>Gyroscope Bias Offset:</span>
              <span className="text-white font-bold">{config.gyroBiasDegPerSec ?? 0.38} °/s</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.5}
              step={0.05}
              value={config.gyroBiasDegPerSec ?? 0.38}
              onChange={(e) => onUpdateConfig({ gyroBiasDegPerSec: Number(e.target.value) })}
              className="w-full accent-blue-500"
            />
            <span className="text-[10px] text-gray-500">
              Simulates real automotive MEMS gyro run-to-run bias instability causing quadratic position divergence.
            </span>
          </div>

          {/* Recovery Smoothing Window */}
          <div>
            <div className="flex justify-between text-gray-400 mb-1">
              <span>GNSS Recovery Transition Window:</span>
              <span className="text-white font-bold">{config.recoverySmoothingTimeSec ?? 2.5} seconds</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={6.0}
              step={0.5}
              value={config.recoverySmoothingTimeSec ?? 2.5}
              onChange={(e) => onUpdateConfig({ recoverySmoothingTimeSec: Number(e.target.value) })}
              className="w-full accent-blue-500"
            />
            <span className="text-[10px] text-gray-500">
              Complementary filter window for smooth trajectory re-alignment when GNSS resumes, avoiding sudden coordinate leaps.
            </span>
          </div>
        </div>
      </div>

      {/* Safety & Competition Disclaimer Card */}
      <div className="bg-[#111418] border border-amber-500/30 rounded-xl p-5 text-xs text-amber-200/90 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Research Prototype Safety & Accuracy Disclaimer (ISRO SIH 2026)</span>
        </div>
        <p className="leading-relaxed text-gray-300">
          This software is developed as an engineering prototype for the Smart India Hackathon 2026
          (Problem Statement ID: 26168 by ISRO). The trajectory estimation demonstrates dead reckoning
          kinematics, coordinate projection, and residual neural drift compensation. Trajectory metrics
          are computed rigorously against the provided ground truth references without fabrication.
        </p>
      </div>
    </div>
  );
};
