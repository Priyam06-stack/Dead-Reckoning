import React from 'react';
import { NavigationFrame } from '../types/navigation';
import { Compass, Gauge, Activity, Satellite, Cpu, Wind } from 'lucide-react';

interface TelemetrySensorsProps {
  frame: NavigationFrame;
}

export const TelemetrySensors: React.FC<TelemetrySensorsProps> = ({ frame }) => {
  const speedKmh = frame.odometrySpeed * 3.6;
  const heading = frame.gtHeading;

  // Cardinal direction helper
  const getCardinal = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
      {/* Card 1: Speed & Odometry */}
      <div className="bg-[#15181E] border border-[#2D333B] rounded-xl p-3 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-gray-400 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-gray-300">
            <Gauge className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] uppercase">VEHICLE SPEED</span>
          </div>
          <span className="text-[10px] bg-[#20252E] px-1.5 py-0.5 rounded text-blue-400 font-bold">
            ODOMETRY
          </span>
        </div>

        <div className="my-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white tracking-tight">
            {speedKmh.toFixed(1)}
          </span>
          <span className="text-xs text-gray-400 font-normal">km/h</span>
          <span className="text-xs text-blue-400/80 ml-auto font-bold">
            ({frame.odometrySpeed.toFixed(1)} m/s)
          </span>
        </div>

        {/* Speed Bar Gauge */}
        <div className="w-full bg-[#2D333B] h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-150"
            style={{ width: `${Math.min(100, (speedKmh / 100) * 100)}%` }}
          />
        </div>
      </div>

      {/* Card 2: Heading & Gyro Yaw Rate */}
      <div className="bg-[#15181E] border border-[#2D333B] rounded-xl p-3 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-gray-400 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-gray-300">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] uppercase">HEADING & YAW</span>
          </div>
          <span className="text-[10px] bg-blue-950/60 border border-blue-800/40 text-blue-300 px-1.5 py-0.5 rounded font-bold">
            {getCardinal(heading)}
          </span>
        </div>

        <div className="my-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white tracking-tight">
            {heading.toFixed(1)}°
          </span>
          <span className="text-xs text-blue-400/90 ml-auto">
            ωz: {frame.gyroZ >= 0 ? `+${frame.gyroZ.toFixed(2)}` : frame.gyroZ.toFixed(2)} °/s
          </span>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <span>Roll: {frame.gyroX.toFixed(1)}°/s</span>
          <span className="text-gray-600">•</span>
          <span>Pitch: {frame.gyroY.toFixed(1)}°/s</span>
        </div>
      </div>

      {/* Card 3: 3-Axis IMU Acceleration */}
      <div className="bg-[#15181E] border border-[#2D333B] rounded-xl p-3 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-gray-400 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-gray-300">
            <Activity className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] uppercase">IMU ACCELERATION</span>
          </div>
          <span className="text-[10px] text-gray-500">6-DoF MEMS</span>
        </div>

        <div className="grid grid-cols-3 gap-2 my-1.5 text-xs">
          <div className="bg-[#0A0B0D] p-1.5 rounded border border-[#2D333B]">
            <div className="text-[10px] text-gray-500">Ax (Fwd)</div>
            <div className="font-bold text-gray-100">{frame.accelX.toFixed(2)}</div>
            <div className="text-[9px] text-gray-600">m/s²</div>
          </div>
          <div className="bg-[#0A0B0D] p-1.5 rounded border border-[#2D333B]">
            <div className="text-[10px] text-gray-500">Ay (Lat)</div>
            <div className="font-bold text-gray-100">{frame.accelY.toFixed(2)}</div>
            <div className="text-[9px] text-gray-600">m/s²</div>
          </div>
          <div className="bg-[#0A0B0D] p-1.5 rounded border border-[#2D333B]">
            <div className="text-[10px] text-gray-500">Az (Vert)</div>
            <div className="font-bold text-gray-100">{frame.accelZ.toFixed(2)}</div>
            <div className="text-[9px] text-gray-600">m/s²</div>
          </div>
        </div>
      </div>

      {/* Card 4: AI Drift Compensator Active State */}
      <div className="bg-[#15181E] border border-[#2D333B] rounded-xl p-3 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-gray-400 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-blue-400">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] uppercase">AI COMPENSATOR</span>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              frame.isOutage
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50 animate-pulse'
                : 'bg-[#20252E] text-gray-400'
            }`}
          >
            {frame.isOutage ? 'ACTIVE COMPENSATING' : 'STANDBY (GNSS)'}
          </span>
        </div>

        <div className="my-2 flex items-baseline justify-between">
          <div>
            <div className="text-[10px] text-gray-500">Corrected Drift</div>
            <div className="text-xl font-bold text-blue-400">
              {frame.isOutage ? `${frame.aiCorrectionMag.toFixed(2)} m` : '0.00 m'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500">Drift Avoided</div>
            <div className="text-xl font-bold text-green-400">
              {frame.isOutage
                ? `${Math.max(0, frame.rawDrErrorMeters - frame.aiDrErrorMeters).toFixed(2)} m`
                : '0.00 m'}
            </div>
          </div>
        </div>

        <div className="text-[10px] text-gray-500 border-l-2 border-blue-500 pl-2 py-0.5 bg-blue-500/5 flex items-center justify-between">
          <span>Inference: &lt;1.2 ms</span>
          <span>Physics Residual MLP</span>
        </div>
      </div>
    </div>
  );
};
