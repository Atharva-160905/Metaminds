import React from 'react';
import { Cpu, Activity, MapPin, BarChart2, BookOpen, Layers, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  activeTab: 'demo' | 'live-map' | 'benchmark' | 'about';
  setActiveTab: (tab: 'demo' | 'live-map' | 'benchmark' | 'about') => void;
  isBackendConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isBackendConnected,
}) => {
  return (
    <header className="bg-[#0B132B] text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu size={22} className="text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-cyan-300">
                  QuantaRoute
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  SIH 2026
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal hidden sm:block">
                Quantum-Inspired Intelligent Traffic Route Optimization
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('demo')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'demo'
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Activity size={14} />
              <span>Synthetic Presets</span>
            </button>

            <button
              onClick={() => setActiveTab('live-map')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'live-map'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-cyan-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <MapPin size={14} className="text-cyan-300 animate-pulse" />
              <span className="font-bold">Live Pune Map</span>
              <span className="bg-cyan-500/20 text-cyan-300 text-[9px] px-1.5 py-0.2 rounded font-mono uppercase">Sinhgad</span>
            </button>

            <button
              onClick={() => setActiveTab('benchmark')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'benchmark'
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart2 size={14} />
              <span>Benchmark Results</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'about'
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BookOpen size={14} />
              <span>About & Theory</span>
            </button>
          </div>

          {/* Backend Status Indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-400 font-mono text-[11px]">
              {isBackendConnected ? 'FastAPI Online' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
