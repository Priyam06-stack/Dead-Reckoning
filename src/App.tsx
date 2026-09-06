import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  NavigationFrame,
  TrajectorySummary,
  NavMode,
} from './types/navigation';
import {
  BENCHMARK_SCENARIOS,
  DatasetScenario,
} from './data/benchmarkDatasets';
import {
  processNavigationDataset,
  DeadReckoningConfig,
} from './engine/deadReckoning';
import { Header, ActiveTab } from './components/Header';
import { NavigationSidebar } from './components/NavigationSidebar';
import { NavigationDashboard } from './components/NavigationDashboard';
import { TrajectoryMap } from './components/TrajectoryMap';
import { PlaybackController } from './components/PlaybackController';
import { TelemetrySensors } from './components/TelemetrySensors';
import { DatasetManager } from './components/DatasetManager';
import { TrajectoryInspector } from './components/TrajectoryInspector';
import { GNSSAnalysis } from './components/GNSSAnalysis';
import { ModelLab } from './components/ModelLab';
import { PerformanceAnalytics } from './components/PerformanceAnalytics';
import { SettingsModal } from './components/SettingsModal';
import { GoogleMapsRoutePlanner } from './components/GoogleMapsRoutePlanner';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );
  const [currentScenarioId, setCurrentScenarioId] = useState<string>('bengaluru-urban-underpass');
  const [customRawFrames, setCustomRawFrames] = useState<any[] | null>(null);
  const [customScenarioName, setCustomScenarioName] = useState<string>('');

  // Dead Reckoning Physics Config
  const [drConfig, setDrConfig] = useState<DeadReckoningConfig>({
    gyroBiasDegPerSec: 0.38,
    recoverySmoothingTimeSec: 2.5,
    enableAiCorrection: true,
  });

  // Manual Outage Simulation State
  const [isManualOutageActive, setIsManualOutageActive] = useState<boolean>(false);

  // Playback State
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Active raw dataset generator
  const activeScenario = useMemo(() => {
    return BENCHMARK_SCENARIOS.find((s) => s.id === currentScenarioId) || BENCHMARK_SCENARIOS[0];
  }, [currentScenarioId]);

  // Compute raw frames based on scenario + manual outage override
  const rawFrames = useMemo(() => {
    let frames = customRawFrames ? [...customRawFrames] : activeScenario.generateFrames();

    // If manual outage is forced active, override GNSS availability for current playback slice
    if (isManualOutageActive) {
      frames = frames.map((f, i) => {
        // Cut GNSS off for 30s around current playback frame or from 20s onwards
        const isForcedOutage = i >= 20 && i <= 80;
        return {
          ...f,
          gnssAvailable: !isForcedOutage,
          gnssLat: !isForcedOutage ? f.gnssLat : null,
          gnssLon: !isForcedOutage ? f.gnssLon : null,
          gnssQuality: !isForcedOutage ? 0.95 : 0.0,
        };
      });
    }

    return frames;
  }, [activeScenario, customRawFrames, isManualOutageActive]);

  // Process Trajectory through Dead Reckoning & AI-ML Pipeline
  const trajectorySummary: TrajectorySummary = useMemo(() => {
    return processNavigationDataset(rawFrames, drConfig);
  }, [rawFrames, drConfig]);

  const frames = trajectorySummary.frames;
  const currentFrame = frames[currentFrameIndex] || frames[0];

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    // Default frame interval is 500ms / playbackSpeed
    const intervalMs = Math.max(20, 500 / playbackSpeed);

    const timer = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        if (prev >= frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, frames.length]);

  // Playback handlers
  const handleTogglePlay = () => {
    if (currentFrameIndex >= frames.length - 1) {
      setCurrentFrameIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  };

  const handleStepForward = () => {
    setCurrentFrameIndex((prev) => Math.min(frames.length - 1, prev + 1));
  };

  const handleStepBack = () => {
    setCurrentFrameIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSeek = (index: number) => {
    setCurrentFrameIndex(Math.max(0, Math.min(frames.length - 1, index)));
  };

  const handleSelectScenario = (scenarioId: string) => {
    setCustomRawFrames(null);
    setCurrentScenarioId(scenarioId);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setIsManualOutageActive(false);
  };

  const handleLoadCustomDataset = (customFrames: any[], name: string) => {
    setCustomRawFrames(customFrames);
    setCustomScenarioName(name);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setIsManualOutageActive(false);
  };

  const handleInjectCustomOutage = (startSec: number, durationSec: number, env: string) => {
    if (!rawFrames || rawFrames.length === 0) return;
    const endSec = startSec + durationSec;

    const modified = rawFrames.map((f) => {
      const isOutage = f.relativeSec >= startSec && f.relativeSec <= endSec;
      return {
        ...f,
        gnssAvailable: !isOutage,
        gnssLat: !isOutage ? f.gnssLat : null,
        gnssLon: !isOutage ? f.gnssLon : null,
        gnssQuality: !isOutage ? 0.95 : 0.0,
      };
    });

    setCustomRawFrames(modified);
    setCustomScenarioName(`Custom Injected Outage (${env})`);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  };

  const handleQuickDemo = () => {
    setActiveTab('dashboard');
    setCurrentScenarioId('bengaluru-urban-underpass');
    setCustomRawFrames(null);
    setIsManualOutageActive(false);
    setCurrentFrameIndex(0);
    setIsPlaying(true);
  };

  const handleApplyGoogleRoute = (routeFrames: any[], title: string) => {
    setCustomRawFrames(routeFrames);
    setCustomScenarioName(title);
    setCurrentFrameIndex(0);
    setIsPlaying(true);
    setIsManualOutageActive(false);
    setActiveTab('dashboard');
  };

  const currentScenarioTitle = customRawFrames
    ? customScenarioName
    : activeScenario.name;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-purple-500/30 selection:text-purple-200">
      {/* Global Application Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        scenarioName={currentScenarioTitle}
        onOpenQuickDemo={handleQuickDemo}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      <div className="flex-1 flex w-full relative">
        {/* Collapsible Side Column with 3-dot collapse icon */}
        <NavigationSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          scenarioName={currentScenarioTitle}
          onOpenQuickDemo={handleQuickDemo}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 overflow-x-hidden">
        {/* Tab 1: Dashboard */}
        {activeTab === 'dashboard' && (
          <NavigationDashboard
            frames={frames}
            currentFrameIndex={currentFrameIndex}
            trajectorySummary={trajectorySummary}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onRestart={handleRestart}
            onStepForward={handleStepForward}
            onStepBack={handleStepBack}
            onSeek={handleSeek}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={setPlaybackSpeed}
            onSelectScenario={handleSelectScenario}
            currentScenarioId={currentScenarioId}
            onToggleManualOutage={() => setIsManualOutageActive(!isManualOutageActive)}
            isManualOutageActive={isManualOutageActive}
            onOpenRoutePlanner={() => setActiveTab('route_planner')}
          />
        )}

        {/* Tab 2: Live Navigation (Full-Screen Map Focus) */}
        {activeTab === 'live_nav' && (
          <div className="space-y-4 font-mono pb-12">
            <div className="w-full h-[620px]">
              <TrajectoryMap
                frames={frames}
                currentFrameIndex={currentFrameIndex}
                outages={trajectorySummary.outages}
                onSelectFrame={handleSeek}
                activeMode={currentFrame?.mode ?? 'GNSS'}
                onOpenRoutePlanner={() => setActiveTab('route_planner')}
              />
            </div>

            <PlaybackController
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onRestart={handleRestart}
              onStepForward={handleStepForward}
              onStepBack={handleStepBack}
              currentFrameIndex={currentFrameIndex}
              totalFrames={frames.length}
              onSeek={handleSeek}
              playbackSpeed={playbackSpeed}
              onChangeSpeed={setPlaybackSpeed}
              frames={frames}
              outages={trajectorySummary.outages}
              onToggleManualOutage={() => setIsManualOutageActive(!isManualOutageActive)}
              isManualOutageActive={isManualOutageActive}
            />

            {currentFrame && <TelemetrySensors frame={currentFrame} />}
          </div>
        )}

        {/* Tab 3: Google Maps Route & Path Planner */}
        {activeTab === 'route_planner' && (
          <GoogleMapsRoutePlanner
            onApplyRouteToSimulation={handleApplyGoogleRoute}
            drConfig={drConfig}
          />
        )}

        {/* Tab 4: Dataset Manager */}
        {activeTab === 'dataset' && (
          <DatasetManager
            onLoadCustomDataset={handleLoadCustomDataset}
            onSelectScenario={handleSelectScenario}
            currentScenarioId={currentScenarioId}
            loadedFrames={frames}
            onOpenRoutePlanner={() => setActiveTab('route_planner')}
          />
        )}

        {/* Tab 4: Trajectory Deep Inspector */}
        {activeTab === 'trajectory' && (
          <TrajectoryInspector
            frames={frames}
            currentFrameIndex={currentFrameIndex}
            trajectorySummary={trajectorySummary}
            onSelectFrame={handleSeek}
          />
        )}

        {/* Tab 5: GNSS Outage Analysis */}
        {activeTab === 'gnss_analysis' && (
          <GNSSAnalysis
            frames={frames}
            trajectorySummary={trajectorySummary}
            onInjectCustomOutage={handleInjectCustomOutage}
            isManualOutageActive={isManualOutageActive}
            onToggleManualOutage={() => setIsManualOutageActive(!isManualOutageActive)}
          />
        )}

        {/* Tab 6: AI/ML Model Training & Lab */}
        {activeTab === 'ai_model' && <ModelLab />}

        {/* Tab 7: Performance Analytics & Error Charts */}
        {activeTab === 'performance' && (
          <PerformanceAnalytics
            trajectorySummary={trajectorySummary}
            frames={frames}
          />
        )}

        {/* Tab 8: Settings & Simulation Noise */}
        {activeTab === 'settings' && (
          <SettingsModal
            config={drConfig}
            onUpdateConfig={(newConf) => setDrConfig({ ...drConfig, ...newConf })}
            onResetDefaults={() =>
              setDrConfig({
                gyroBiasDegPerSec: 0.38,
                recoverySmoothingTimeSec: 2.5,
                enableAiCorrection: true,
              })
            }
          />
        )}
      </main>
      </div>
    </div>
  );
}
