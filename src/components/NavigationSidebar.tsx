import React from 'react';
import {
  Compass,
  MapPin,
  Route,
  Database,
  Activity,
  Satellite,
  Cpu,
  BarChart3,
  Settings,
  MoreVertical,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Zap,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ActiveTab } from './Header';

interface NavigationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  scenarioName: string;
  onOpenQuickDemo: () => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isNew?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  // Navigation & Live Views
  {
    id: 'dashboard',
    label: 'Simulation Cockpit',
    category: 'NAVIGATION',
    description: 'Live map, vehicle telemetry & play controls',
    icon: Compass,
  },
  {
    id: 'route_planner',
    label: 'Route Planner (Places)',
    category: 'NAVIGATION',
    description: 'Search places & test routes on Google Maps',
    icon: MapPin,
    isNew: true,
  },
  {
    id: 'live_nav',
    label: 'Full-Screen Map',
    category: 'NAVIGATION',
    description: 'Expanded full-view vehicle tracking',
    icon: Route,
  },

  // Paths & Data
  {
    id: 'trajectory',
    label: 'Compare Paths (AI vs Drift)',
    category: 'PATHS & DATA',
    description: 'Inspect where uncorrected sensors get lost',
    icon: Activity,
  },
  {
    id: 'dataset',
    label: 'Preset Scenarios',
    category: 'PATHS & DATA',
    description: 'Bengaluru, Mumbai tunnel & custom logs',
    icon: Database,
  },
  {
    id: 'gnss_analysis',
    label: 'Satellite Signal Health',
    category: 'PATHS & DATA',
    description: 'Outage duration & satellite constellation',
    icon: Satellite,
  },

  // AI & Benchmarks
  {
    id: 'ai_model',
    label: 'AI Drift Compensator',
    category: 'AI & ACCURACY',
    description: 'Neural model trained on vehicle physics',
    icon: Cpu,
  },
  {
    id: 'performance',
    label: 'Accuracy Benchmarks',
    category: 'AI & ACCURACY',
    description: 'Error reduction scores and drift charts',
    icon: BarChart3,
  },
  {
    id: 'settings',
    label: 'Simulation Settings',
    category: 'AI & ACCURACY',
    description: 'Adjust sensor noise and recovery tuning',
    icon: Settings,
  },
];

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  isOpen,
  onToggle,
  activeTab,
  onSelectTab,
  scenarioName,
  onOpenQuickDemo,
}) => {
  const currentTabItem = NAV_ITEMS.find((item) => item.id === activeTab);

  // Group items by category
  const categories = Array.from(new Set(NAV_ITEMS.map((i) => i.category)));

  return (
    <>
      {/* Mobile / Backdrop overlay when sidebar is open on smaller viewports */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Side Column Container */}
      <aside
        id="app-navigation-sidebar"
        aria-label="Application Navigation"
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col bg-[#0E1217] border-r border-[#2D333B] transition-all duration-300 ease-in-out select-none shadow-2xl ${
          isOpen ? 'w-72 translate-x-0' : 'w-0 lg:w-16 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header with 3-Dot Toggle Icon */}
        <div className="h-14 border-b border-[#2D333B] px-2.5 flex items-center justify-between shrink-0 bg-[#12161D]">
          {isOpen ? (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-bold text-white italic shadow-[0_0_10px_rgba(37,99,235,0.4)] text-sm shrink-0">
                  I
                </div>
                <div className="truncate">
                  <div className="text-[11px] font-bold tracking-wider uppercase text-white font-mono leading-none">
                    NAV MENU
                  </div>
                  <div className="text-[9px] text-blue-400 font-mono tracking-tight mt-0.5">
                    ISRO DR PLATFORM
                  </div>
                </div>
              </div>

              {/* 3-Dot Icon button to Collapse the side column */}
              <button
                type="button"
                id="sidebar-3dot-collapse-btn"
                onClick={onToggle}
                title="Collapse side navigation (3 dots)"
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-blue-600/20 hover:border-blue-500/40 border border-transparent transition-all cursor-pointer flex items-center justify-center"
              >
                <MoreVertical className="w-5 h-5 text-blue-400 hover:text-blue-300" />
              </button>
            </>
          ) : (
            <div className="w-full flex justify-center">
              {/* 3-Dot Icon button when collapsed to expand the side column */}
              <button
                type="button"
                id="sidebar-3dot-expand-btn"
                onClick={onToggle}
                title="Expand side navigation (3 dots)"
                className="p-2 rounded-lg text-blue-400 hover:text-white hover:bg-blue-600/25 border border-blue-500/40 transition-all cursor-pointer flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.2)]"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Item List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4 no-scrollbar">
          {categories.map((category) => {
            const items = NAV_ITEMS.filter((item) => item.category === category);
            return (
              <div key={category} className="space-y-1">
                {isOpen && (
                  <div className="px-2.5 pt-2 pb-1 text-[9px] font-mono font-bold tracking-widest text-gray-400 uppercase">
                    {category}
                  </div>
                )}

                {items.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isRoutePlanner = tab.id === 'route_planner';

                  return (
                    <button
                      key={tab.id}
                      id={`sidebar-nav-${tab.id}`}
                      type="button"
                      onClick={() => {
                        onSelectTab(tab.id);
                        // On mobile viewports auto-close on selection
                        if (window.innerWidth < 1024) {
                          onToggle();
                        }
                      }}
                      title={tab.label}
                      className={`w-full group flex items-center gap-3 rounded-xl transition-all cursor-pointer relative ${
                        isOpen ? 'px-3 py-2.5 text-left' : 'p-2.5 justify-center'
                      } ${
                        isActive
                          ? isRoutePlanner
                            ? 'bg-emerald-600/15 border border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                            : 'bg-blue-600/15 border border-blue-500/50 text-blue-300 shadow-[0_0_12px_rgba(37,99,235,0.25)]'
                          : 'border border-transparent text-gray-400 hover:text-gray-100 hover:bg-[#181D24]'
                      }`}
                    >
                      {/* Active Left Indicator Bar */}
                      {isActive && (
                        <span
                          className={`absolute left-0 inset-y-2 w-1 rounded-r-full ${
                            isRoutePlanner ? 'bg-emerald-400' : 'bg-blue-400'
                          }`}
                        />
                      )}

                      <div
                        className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                          isActive
                            ? isRoutePlanner
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-blue-500/20 text-blue-400'
                            : 'bg-[#151921] text-gray-400 group-hover:text-white group-hover:bg-[#1E242E]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Item Details (When expanded) */}
                      {isOpen && (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`text-xs font-mono font-bold truncate ${
                                isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'
                              }`}
                            >
                              {tab.label}
                            </span>
                            {tab.isNew && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-extrabold font-mono shrink-0">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate mt-0.5 leading-tight font-sans">
                            {tab.description}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: Quick Demo & Scenario Info */}
        <div className="p-3 border-t border-[#2D333B] bg-[#111419] shrink-0 space-y-2">
          {isOpen ? (
            <>
              <button
                type="button"
                id="sidebar-quick-demo-btn"
                onClick={onOpenQuickDemo}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs shadow-[0_0_12px_rgba(37,99,235,0.35)] transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>RUN SIMULATION DEMO</span>
              </button>

              <div className="p-2 rounded-lg bg-[#151921] border border-[#2D333B] text-[10px] font-mono text-gray-400 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="text-gray-500 uppercase text-[8px]">Active Scenario</div>
                  <div className="text-gray-200 font-bold truncate">{scenarioName}</div>
                </div>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenQuickDemo}
              title="Run Simulation Demo"
              className="w-full flex justify-center p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
