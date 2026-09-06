import React, { useState } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  Database,
  ArrowRight,
  Settings,
  AlertCircle,
  Play,
  RotateCcw,
  MapPin,
} from 'lucide-react';
import { ColumnMapping, RawSensorRow, NavigationFrame } from '../types/navigation';
import { BENCHMARK_SCENARIOS, DatasetScenario } from '../data/benchmarkDatasets';

interface DatasetManagerProps {
  onLoadCustomDataset: (frames: any[], scenarioName: string) => void;
  onSelectScenario: (scenarioId: string) => void;
  currentScenarioId: string;
  loadedFrames: NavigationFrame[];
  onOpenRoutePlanner?: () => void;
}

export const DatasetManager: React.FC<DatasetManagerProps> = ({
  onLoadCustomDataset,
  onSelectScenario,
  currentScenarioId,
  loadedFrames,
  onOpenRoutePlanner,
}) => {
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Default Column Mapping
  const [mapping, setMapping] = useState<ColumnMapping>({
    timestamp: 'timestamp',
    latitude: 'latitude',
    longitude: 'longitude',
    altitude: 'altitude',
    accelX: 'accel_x',
    accelY: 'accel_y',
    accelZ: 'accel_z',
    gyroX: 'gyro_x',
    gyroY: 'gyro_y',
    gyroZ: 'gyro_z',
    velocity: 'velocity',
    heading: 'heading',
    wheelSpeed: 'odometry',
    gnssAvailable: 'gnss_valid',
  });

  // Handle CSV file upload
  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
      setCsvHeaders(headers);

      const rows: any[] = [];
      const sampleLines = lines.slice(1, Math.min(lines.length, 500));

      for (const line of sampleLines) {
        const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: Record<string, string> = {};
        headers.forEach((h, i) => {
          rowObj[h] = values[i];
        });
        rows.push(rowObj);
      }

      setParsedRows(rows);

      // Auto-detect columns
      const autoMap: ColumnMapping = { ...mapping };
      headers.forEach((h) => {
        const lower = h.toLowerCase();
        if (lower.includes('time') || lower === 't') autoMap.timestamp = h;
        else if (lower.includes('lat') || lower === 'latitude') autoMap.latitude = h;
        else if (lower.includes('lon') || lower.includes('lng') || lower === 'longitude') autoMap.longitude = h;
        else if (lower.includes('alt')) autoMap.altitude = h;
        else if (lower.includes('acc_x') || lower.includes('accel_x') || lower === 'ax') autoMap.accelX = h;
        else if (lower.includes('acc_y') || lower.includes('accel_y') || lower === 'ay') autoMap.accelY = h;
        else if (lower.includes('acc_z') || lower.includes('accel_z') || lower === 'az') autoMap.accelZ = h;
        else if (lower.includes('gyr_x') || lower.includes('gyro_x') || lower === 'gx') autoMap.gyroX = h;
        else if (lower.includes('gyr_y') || lower.includes('gyro_y') || lower === 'gy') autoMap.gyroY = h;
        else if (lower.includes('gyr_z') || lower.includes('gyro_z') || lower === 'gz') autoMap.gyroZ = h;
        else if (lower.includes('vel') || lower.includes('speed') || lower === 'v') autoMap.velocity = h;
        else if (lower.includes('head') || lower.includes('yaw')) autoMap.heading = h;
        else if (lower.includes('wheel') || lower.includes('odo')) autoMap.wheelSpeed = h;
        else if (lower.includes('gps') || lower.includes('gnss') || lower.includes('valid')) autoMap.gnssAvailable = h;
      });

      setMapping(autoMap);
      setShowMappingModal(true);
    };

    reader.readAsText(file);
  };

  const applyMappingAndLoad = () => {
    if (parsedRows.length === 0) return;

    // Convert parsed rows using mapping
    const baseLat = parseFloat(parsedRows[0][mapping.latitude]) || 13.0382;
    const baseLon = parseFloat(parsedRows[0][mapping.longitude]) || 77.5684;

    const frames = parsedRows.map((r, i) => {
      const lat = parseFloat(r[mapping.latitude]) || baseLat + (i * 0.00005);
      const lon = parseFloat(r[mapping.longitude]) || baseLon + (i * 0.00005);
      const speed = parseFloat(r[mapping.velocity]) || parseFloat(r[mapping.wheelSpeed]) || 10.0;
      const heading = parseFloat(r[mapping.heading]) || (i * 1.5) % 360;

      // Simulated GNSS availability flag if column not explicitly false
      const gnssValid = r[mapping.gnssAvailable] !== undefined
        ? r[mapping.gnssAvailable] === 'true' || r[mapping.gnssAvailable] === '1'
        : !(i >= 30 && i <= 70); // default outage mid-dataset

      return {
        index: i,
        timestamp: parseFloat(r[mapping.timestamp]) || (1715000000000 + i * 500),
        relativeSec: i * 0.5,
        gtLat: lat,
        gtLon: lon,
        gtAlt: parseFloat(r[mapping.altitude]) || 920,
        gtVelocity: speed,
        gtHeading: heading,
        gnssAvailable: gnssValid,
        gnssLat: gnssValid ? lat : null,
        gnssLon: gnssValid ? lon : null,
        gnssAlt: gnssValid ? 920 : null,
        gnssQuality: gnssValid ? 0.95 : 0.0,
        accelX: parseFloat(r[mapping.accelX]) || 0.1,
        accelY: parseFloat(r[mapping.accelY]) || 0.0,
        accelZ: parseFloat(r[mapping.accelZ]) || 9.81,
        gyroX: parseFloat(r[mapping.gyroX]) || 0.0,
        gyroY: parseFloat(r[mapping.gyroY]) || 0.0,
        gyroZ: parseFloat(r[mapping.gyroZ]) || 0.0,
        odometrySpeed: speed,
      };
    });

    onLoadCustomDataset(frames, fileName || 'Uploaded Custom Dataset');
    setShowMappingModal(false);
  };

  return (
    <div className="space-y-6 font-mono max-w-6xl mx-auto pb-12">
      {/* Header Info */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              <span>Vehicle Navigation Datasets & Benchmark Scenarios</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1 max-w-3xl">
              Compatible with the official <b>IO-VNBD</b> (Inertial and Odometry Benchmark Dataset
              for Ground Vehicle Positioning, Onyekpeu et al.) as specified in ISRO Problem Statement 26168.
              Upload custom CSV logs or switch between calibrated operational demo scenarios.
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-gray-500">Loaded Records:</span>
            <div className="text-lg font-extrabold text-blue-400">
              {loadedFrames.length} Frames
            </div>
          </div>
        </div>
      </div>

      {/* Built-in Scenarios Grid */}
      <div>
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>Official Benchmark Demo Scenarios</span>
          <span className="text-xs font-normal text-gray-500">
            (Select to simulate GNSS outage transitions)
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BENCHMARK_SCENARIOS.map((sc) => {
            const isSelected = currentScenarioId === sc.id;
            return (
              <div
                key={sc.id}
                onClick={() => onSelectScenario(sc.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-600/10 border-blue-500/80 shadow-[0_0_15px_rgba(37,99,235,0.2)]'
                    : 'bg-[#111418] border-[#2D333B] hover:border-gray-600 hover:bg-[#15181E]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white">{sc.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#20252E] text-gray-400'
                      }`}
                    >
                      {isSelected ? 'ACTIVE' : 'SELECT'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{sc.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#2D333B] flex items-center justify-between text-xs text-gray-400">
                  <span>Duration: <b className="text-gray-200">{sc.durationSec}s</b></span>
                  <span>Outage: <b className="text-red-400">{sc.outageRange[1] - sc.outageRange[0]}s</b></span>
                  <span className="text-[11px] text-blue-400">{sc.environment}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Google Maps Route Planner Card */}
      {onOpenRoutePlanner && (
        <div className="bg-gradient-to-r from-[#111418] via-[#12211e] to-[#111418] border border-emerald-500/50 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mt-0.5">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Interactive Route Planner (Google Maps & Real Roads)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  NEW
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 max-w-2xl">
                Select your own Origin (A) and Destination (B) on the map or choose real-world tunnel presets (ISRO Bengaluru, Coastal Road Mumbai, Golden Gate SF, Tokyo Yamate). Configure outage points and feed live driving telemetry into the Dead Reckoning engine.
              </p>
            </div>
          </div>

          <button
            id="btn-dataset-open-route-planner"
            onClick={onOpenRoutePlanner}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.35)] transition-all cursor-pointer whitespace-nowrap"
          >
            <MapPin className="w-4 h-4 fill-current" />
            <span>Open Route Planner ➔</span>
          </button>
        </div>
      )}

      {/* CSV Dataset Upload Card */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-400" />
          <span>Upload Custom Sensor Dataset (CSV)</span>
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Upload real vehicle logs containing IMU (accelerometers & gyroscopes), odometry/speed,
          and GNSS coordinates. The system automatically inspects headers and presents a mapping interface.
        </p>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-600/10'
              : 'border-[#2D333B] bg-[#0A0B0D] hover:border-gray-600'
          }`}
        >
          <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-300">
            Drag & drop your CSV navigation log file here
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supports IO-VNBD, ROSbag CSV, Oxford RobotCar, or custom MEMS logger files
          </p>

          <label className="inline-block mt-4 px-4 py-2 rounded-lg bg-[#15181E] hover:bg-[#20252E] text-gray-200 border border-[#2D333B] text-xs font-bold cursor-pointer transition-colors">
            <span>Browse Local File</span>
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Column Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111418] border border-[#2D333B] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2D333B] pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Column Mapping: {fileName}
                </h3>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Verify detected CSV columns. Assign columns that match your dataset schema:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {Object.keys(mapping).map((key) => {
                const mapKey = key as keyof ColumnMapping;
                return (
                  <div key={mapKey} className="bg-[#0A0B0D] p-2.5 rounded-lg border border-[#2D333B] flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-300 capitalize">
                      {mapKey.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <select
                      value={mapping[mapKey]}
                      onChange={(e) =>
                        setMapping({ ...mapping, [mapKey]: e.target.value })
                      }
                      className="bg-[#15181E] border border-[#2D333B] rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Not in dataset --</option>
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#2D333B] flex items-center justify-end gap-2">
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-4 py-2 rounded-lg bg-[#15181E] text-gray-300 hover:bg-[#20252E] text-xs font-bold border border-[#2D333B]"
              >
                Cancel
              </button>
              <button
                onClick={applyMappingAndLoad}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(37,99,235,0.3)]"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Apply & Process Dataset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Preview Table */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider mb-3">
          Loaded Frames Preview (First 8 Rows)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300 font-mono">
            <thead className="bg-[#0A0B0D] text-gray-400 border-b border-[#2D333B]">
              <tr>
                <th className="py-2 px-3">Frame</th>
                <th className="py-2 px-3">Time (s)</th>
                <th className="py-2 px-3">Ground Truth (Lat, Lon)</th>
                <th className="py-2 px-3">Speed (km/h)</th>
                <th className="py-2 px-3">Heading (°)</th>
                <th className="py-2 px-3">Accel X/Y (m/s²)</th>
                <th className="py-2 px-3">Gyro Z (°/s)</th>
                <th className="py-2 px-3">GNSS Fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D333B]/60">
              {loadedFrames.slice(0, 8).map((f) => (
                <tr key={f.index} className="hover:bg-[#15181E]">
                  <td className="py-2 px-3 text-gray-500">#{f.index}</td>
                  <td className="py-2 px-3 text-blue-400 font-bold">{f.relativeSec}s</td>
                  <td className="py-2 px-3">
                    {f.gtLat.toFixed(5)}, {f.gtLon.toFixed(5)}
                  </td>
                  <td className="py-2 px-3">{(f.odometrySpeed * 3.6).toFixed(1)}</td>
                  <td className="py-2 px-3">{f.gtHeading.toFixed(1)}°</td>
                  <td className="py-2 px-3 text-gray-400">
                    {f.accelX.toFixed(2)}, {f.accelY.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-blue-400">{f.gyroZ.toFixed(2)}</td>
                  <td className="py-2 px-3">
                    {f.gnssAvailable ? (
                      <span className="text-green-400 font-bold">AVAILABLE</span>
                    ) : (
                      <span className="text-red-400 font-bold">OUTAGE</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
