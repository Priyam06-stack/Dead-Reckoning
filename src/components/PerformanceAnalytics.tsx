import React from 'react';
import {
  NavigationFrame,
  TrajectorySummary,
  OutageInterval,
} from '../types/navigation';
import {
  BarChart3,
  TrendingDown,
  Download,
  CheckCircle,
  FileSpreadsheet,
  Layers,
  Award,
} from 'lucide-react';

interface PerformanceAnalyticsProps {
  trajectorySummary: TrajectorySummary;
  frames: NavigationFrame[];
}

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  trajectorySummary,
  frames,
}) => {
  const { metrics, outages } = trajectorySummary;

  // Export performance report as JSON
  const handleExportJSON = () => {
    const report = {
      project: 'ISRO NavDR: AI-ML Intelligent Dead Reckoning System',
      problemStatementId: 26168,
      timestamp: new Date().toISOString(),
      evaluationMetrics: metrics,
      outageIntervals: outages,
      totalFramesEvaluated: frames.length,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `isro_navdr_evaluation_metrics_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export CSV summary
  const handleExportCSV = () => {
    let csv = 'Timestamp_Sec,GroundTruth_Lat,GroundTruth_Lon,RawDR_Lat,RawDR_Lon,RawDR_Error_Meters,AIDR_Lat,AIDR_Lon,AIDR_Error_Meters,Mode\n';
    frames.forEach((f) => {
      csv += `${f.relativeSec},${f.gtLat},${f.gtLon},${f.rawDrLat},${f.rawDrLon},${f.rawDrErrorMeters},${f.aiDrLat},${f.aiDrLon},${f.aiDrErrorMeters},${f.mode}\n`;
    });

    const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `navdr_trajectory_comparison_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Sample frames for error chart
  const sampleStep = Math.max(1, Math.floor(frames.length / 100));
  const chartFrames = frames.filter((_, i) => i % sampleStep === 0);
  const maxPlotError = Math.max(15, metrics.rawMaxError * 1.1);

  return (
    <div className="space-y-6 font-mono max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-950/80 border border-green-500/50 text-green-300">
                BENCHMARK VERIFICATION
              </span>
              <span className="text-xs text-gray-400">SIH 2026 Evaluation Suite</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span>Comparative Performance & Error Analytics</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1 max-w-3xl">
              Quantitative comparison of GNSS, Raw Inertial Dead Reckoning, and AI-ML Enhanced
              trajectory against Ground Truth. Calculates RMSE, MAE, and accumulated outage drift.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-lg bg-[#15181E] hover:bg-[#20252E] border border-[#2D333B] text-gray-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(37,99,235,0.3)] transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Report (JSON)</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric: RMSE */}
        <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-gray-400 font-bold uppercase">Root Mean Square Error</div>
          <div className="my-2">
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-red-400">Raw DR:</span>
              <span className="text-xl font-bold text-red-400">{metrics.rawDrRMSE} m</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-blue-300 font-bold">AI DR:</span>
              <span className="text-2xl font-extrabold text-blue-400">{metrics.aiDrRMSE} m</span>
            </div>
          </div>
          <div className="text-[10px] text-green-400 font-bold bg-green-950/40 p-1 rounded border border-green-800/30 text-center">
            {metrics.overallImprovementPct}% Lower RMSE
          </div>
        </div>

        {/* Metric: MAE */}
        <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-gray-400 font-bold uppercase">Mean Absolute Error</div>
          <div className="my-2">
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-red-400">Raw DR:</span>
              <span className="text-xl font-bold text-red-400">{metrics.rawDrMAE} m</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-blue-300 font-bold">AI DR:</span>
              <span className="text-2xl font-extrabold text-blue-400">{metrics.aiDrMAE} m</span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 text-center">
            Nominal GNSS Jitter: ~0.8m
          </div>
        </div>

        {/* Metric: Peak Drift */}
        <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-gray-400 font-bold uppercase">Max Outage Peak Drift</div>
          <div className="my-2">
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-red-400">Raw DR:</span>
              <span className="text-xl font-bold text-red-400">{metrics.rawMaxError} m</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-blue-300 font-bold">AI DR:</span>
              <span className="text-2xl font-extrabold text-blue-400">{metrics.aiMaxError} m</span>
            </div>
          </div>
          <div className="text-[10px] text-green-400 font-bold bg-green-950/40 p-1 rounded border border-green-800/30 text-center">
            {(metrics.rawMaxError - metrics.aiMaxError).toFixed(1)}m Drift Prevented
          </div>
        </div>

        {/* Metric: Drift Rate */}
        <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-gray-400 font-bold uppercase">Outage Drift Rate</div>
          <div className="my-2">
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-red-400">Raw DR:</span>
              <span className="text-xl font-bold text-red-400">{metrics.rawDriftRateMps} m/s</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-blue-300 font-bold">AI DR:</span>
              <span className="text-2xl font-extrabold text-blue-400">{metrics.aiDriftRateMps} m/s</span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 text-center">
            Across {outages.reduce((s, o) => s + o.durationSec, 0)}s Blackout
          </div>
        </div>
      </div>

      {/* Main Interactive Error-vs-Time Chart */}
      <div className="bg-[#111418] border border-[#2D333B] rounded-xl p-5 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D333B] pb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
              Position Error Over Time (Meters from Ground Truth)
            </h3>
            <p className="text-xs text-gray-400">
              Notice the quadratic divergence of uncompensated Raw Dead Reckoning versus the bounded AI model.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-red-400">
              <span className="w-3 h-0.5 bg-red-500" />
              <span>Raw Dead Reckoning</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-400 font-bold">
              <span className="w-3 h-1 bg-blue-500 rounded-full" />
              <span>AI-ML Enhanced DR</span>
            </div>
          </div>
        </div>

        {/* SVG Chart Plot */}
        <div className="w-full h-64 bg-[#0A0B0D] rounded-xl border border-[#2D333B] p-3 relative">
          <svg className="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
            {/* Outage Highlight Background Bars */}
            {outages.map((o) => {
              const startX = (o.startIndex / Math.max(1, frames.length - 1)) * 480 + 10;
              const endX = (o.endIndex / Math.max(1, frames.length - 1)) * 480 + 10;
              const width = Math.max(2, endX - startX);
              return (
                <g key={o.id}>
                  <rect
                    x={startX}
                    y={10}
                    width={width}
                    height={150}
                    fill="#ef4444"
                    opacity="0.12"
                  />
                  <text
                    x={startX + 4}
                    y={25}
                    fill="#f87171"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    OUTAGE #{o.id} ({o.environment})
                  </text>
                </g>
              );
            })}

            {/* Grid lines */}
            <line x1="10" y1="40" x2="490" y2="40" stroke="#2D333B" strokeDasharray="3 3" strokeWidth="0.5" />
            <line x1="10" y1="80" x2="490" y2="80" stroke="#2D333B" strokeDasharray="3 3" strokeWidth="0.5" />
            <line x1="10" y1="120" x2="490" y2="120" stroke="#2D333B" strokeDasharray="3 3" strokeWidth="0.5" />
            <line x1="10" y1="160" x2="490" y2="160" stroke="#374151" strokeWidth="1" />

            {/* Raw DR Error Line (Red) */}
            {chartFrames.length > 1 && (
              <path
                d={chartFrames
                  .map((f, i) => {
                    const x = (i / (chartFrames.length - 1)) * 480 + 10;
                    const y = 160 - (Math.min(maxPlotError, f.rawDrErrorMeters) / maxPlotError) * 140;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}

            {/* AI DR Error Line (Blue) */}
            {chartFrames.length > 1 && (
              <path
                d={chartFrames
                  .map((f, i) => {
                    const x = (i / (chartFrames.length - 1)) * 480 + 10;
                    const y = 160 - (Math.min(maxPlotError, f.aiDrErrorMeters) / maxPlotError) * 140;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};
