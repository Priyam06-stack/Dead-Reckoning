import React, { useState } from "react";
import {
  Satellite,
  Compass,
  Database,
  Route,
  Activity,
  Cpu,
  BarChart3,
  Settings,
  ShieldCheck,
  Zap,
  MapPin,
  MoreVertical,
  HelpCircle,
  X,
  Play,
  Navigation,
} from "lucide-react";

export type ActiveTab =
  | "dashboard"
  | "live_nav"
  | "route_planner"
  | "dataset"
  | "trajectory"
  | "gnss_analysis"
  | "ai_model"
  | "performance"
  | "settings";

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  scenarioName: string;
  onOpenQuickDemo: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const TAB_META: Record<
  ActiveTab,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  dashboard: { label: "Cockpit & Map", icon: Compass },
  route_planner: { label: "Route Planner (Search Places)", icon: MapPin },
  live_nav: { label: "Full-Screen Map", icon: Route },
  trajectory: { label: "Path Comparison (AI vs Drift)", icon: Activity },
  dataset: { label: "Dataset Manager", icon: Database },
  gnss_analysis: { label: "Satellite Signal Health", icon: Satellite },
  ai_model: { label: "AI Drift Compensator", icon: Cpu },
  performance: { label: "Accuracy Analytics", icon: BarChart3 },
  settings: { label: "Settings", icon: Settings },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  scenarioName,
  onOpenQuickDemo,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const currentTab = TAB_META[activeTab] || TAB_META.dashboard;
  const TabIcon = currentTab.icon;

  return (
    <>
      <header className="w-full bg-[#10141A] border-b border-[#242A35] sticky top-0 z-40 shadow-md select-none">
        <div className="w-full px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: 3-Dot Toggle Menu + Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="header-3dot-toggle-btn"
              onClick={onToggleSidebar}
              title={
                isSidebarOpen
                  ? "Collapse navigation menu"
                  : "Open navigation menu (3 dots)"
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isSidebarOpen
                  ? "bg-blue-600/20 text-blue-300 border-blue-500/60 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                  : "bg-[#181D24] text-gray-300 border-[#2D333B] hover:text-white hover:bg-blue-600/20 hover:border-blue-500/40"
              }`}
            >
              <MoreVertical className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-xs hidden sm:inline">
                Menu
              </span>
            </button>

            {/* Emblem */}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-lg flex items-center justify-center font-bold text-white shadow-md text-sm shrink-0">
              <Navigation className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-wide leading-tight">
                  NaviGuard
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium">
                  AI Dead Reckoning
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Seamless vehicle navigation through tunnels and GPS outages
              </p>
            </div>
          </div>

          {/* Right Controls: Current Tab, Quick Demo, Help Guide */}
          <div className="flex items-center gap-2.5">
            {/* Active Screen Button */}
            <button
              type="button"
              onClick={onToggleSidebar}
              title="Click to open menu and switch screens"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181E27] border border-[#2D3545] text-gray-200 text-xs font-medium cursor-pointer hover:border-blue-500/50 hover:bg-[#1E2532] transition-all shadow-sm"
            >
              <TabIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-white font-semibold">
                {currentTab.label}
              </span>
            </button>

            {/* Instant Demo Button */}
            <button
              id="btn-run-demo-header"
              onClick={onOpenQuickDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-[0_0_12px_rgba(37,99,235,0.35)] transition-all cursor-pointer active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Play Demo</span>
            </button>

            {/* How It Works Guide Button */}
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              title="Quick Guide & Explanation"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181E27] border border-[#2D3545] text-gray-300 hover:text-white hover:border-blue-500/40 transition-all text-xs font-medium cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">How It Works</span>
            </button>
          </div>
        </div>
      </header>

      {/* Simple User Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#12161E] border border-[#2D3545] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#242A35] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    How This App Works
                  </h3>
                  <p className="text-xs text-gray-400">
                    Simple 3-step overview for everyone
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#202633] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex gap-3 items-start bg-[#181E29] p-3.5 rounded-xl border border-[#242C3B]">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-white">
                    The Problem: GPS Tunnels & Blackouts
                  </h4>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                    When your car enters a tunnel, underpass, or dense city
                    canyon, satellite GPS signals are blocked. Standard car
                    sensors (accelerometers & gyroscopes) drift off course by
                    tens of meters within seconds.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-[#181E29] p-3.5 rounded-xl border border-[#242C3B]">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-white">
                    The Solution: AI Dead Reckoning
                  </h4>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                    This system uses an AI neural network trained on vehicle
                    physics to instantly detect sensor bias and cancel out the
                    drift, keeping the car perfectly locked to the real road
                    path.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-[#181E29] p-3.5 rounded-xl border border-[#242C3B]">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-white">
                    How You Can Test It
                  </h4>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                    Press{" "}
                    <span className="text-blue-400 font-semibold">
                      Play (▶)
                    </span>{" "}
                    to watch the live simulation. Look at the map: the{" "}
                    <span className="text-blue-400 font-semibold">
                      Blue Line
                    </span>{" "}
                    is AI-corrected, while the{" "}
                    <span className="text-red-400 font-semibold">Red Line</span>{" "}
                    shows how a standard sensor would get lost. You can also
                    open the{" "}
                    <span className="text-emerald-400 font-semibold">
                      Route Planner
                    </span>{" "}
                    to search any real places on Google Maps!
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer transition-colors"
              >
                Got It, Let's Explore!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
