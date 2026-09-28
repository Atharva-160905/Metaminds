import React from 'react';
import { Cpu, MapPin, BarChart2, BookOpen, Navigation, Sun, Moon, Home } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  activeTab: 'home' | 'delhi-map' | 'live-map' | 'benchmark' | 'about';
  setActiveTab: (tab: 'home' | 'delhi-map' | 'live-map' | 'benchmark' | 'about') => void;
  isBackendConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isBackendConnected,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className={`sticky top-0 z-50 transition-colors duration-200 ${
      isDark
        ? 'bg-[#0B132B]/95 text-white border-b border-slate-800 shadow-md backdrop-blur-md'
        : 'bg-white/95 text-slate-900 border-b border-slate-200/90 shadow-sm backdrop-blur-md'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Cpu size={22} className="text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-heading font-extrabold text-lg tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  QuantaRoute
                </span>
                <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  SIH 2026
                </span>
              </div>
              <p className={`text-[11px] font-normal hidden sm:block ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Quantum-Inspired Intelligent Traffic Route Optimization
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border transition-colors ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100/90 border-slate-200'
          }`}>
            <button
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'home'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                  : isDark
                  ? 'text-emerald-400 hover:text-white hover:bg-slate-800'
                  : 'text-emerald-700 hover:text-emerald-900 hover:bg-white'
              }`}
            >
              <Home size={13} />
              <span className="font-bold">Home & Demo</span>
            </button>

            <button
              onClick={() => setActiveTab('delhi-map')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'delhi-map'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm'
                  : isDark
                  ? 'text-amber-400 hover:text-white hover:bg-slate-800'
                  : 'text-amber-700 hover:text-amber-900 hover:bg-white'
              }`}
            >
              <Navigation size={13} className="text-amber-300 animate-pulse" />
              <span className="font-bold">Live Delhi Map</span>
              <span className="bg-amber-500/20 text-[9px] px-1.5 py-0.2 rounded font-mono uppercase">Okhla</span>
            </button>

            <button
              onClick={() => setActiveTab('live-map')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'live-map'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                  : isDark
                  ? 'text-cyan-400 hover:text-white hover:bg-slate-800'
                  : 'text-cyan-700 hover:text-cyan-900 hover:bg-white'
              }`}
            >
              <MapPin size={13} className="text-cyan-300 animate-pulse" />
              <span className="font-bold">Live Pune Map</span>
              <span className="bg-cyan-500/20 text-[9px] px-1.5 py-0.2 rounded font-mono uppercase">Sinhgad</span>
            </button>

            <button
              onClick={() => setActiveTab('benchmark')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'benchmark'
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <BarChart2 size={13} />
              <span>Benchmark Results</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'about'
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <BookOpen size={13} />
              <span>About & Theory</span>
            </button>
          </div>

          {/* Right Toolbar: Theme Toggle & Backend Status */}
          <div className="flex items-center gap-3">
            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700 hover:text-amber-200'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {isDark ? (
                <>
                  <Sun size={14} className="text-amber-400" />
                  <span className="hidden sm:inline text-[11px] font-semibold">Light</span>
                </>
              ) : (
                <>
                  <Moon size={14} className="text-indigo-600" />
                  <span className="hidden sm:inline text-[11px] font-semibold">Dark</span>
                </>
              )}
            </button>

            {/* Backend Status */}
            <div className="hidden md:flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className={`font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isBackendConnected ? 'FastAPI Online' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
