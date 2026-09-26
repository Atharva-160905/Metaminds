import React from 'react';
import { Play, Sparkles, AlertOctagon, RefreshCw, RotateCcw, Sliders, ShieldCheck } from 'lucide-react';

interface SetupPanelProps {
  numDeliveries: number;
  setNumDeliveries: (n: number) => void;
  numRiders: number;
  setNumRiders: (n: number) => void;
  riderCapacity: number;
  setRiderCapacity: (c: number) => void;
  objective: 'time' | 'distance' | 'balanced';
  setObjective: (o: 'time' | 'distance' | 'balanced') => void;
  isOptimizing: boolean;
  onGenerate: () => void;
  onSelectPreset?: (preset: { deliveries: number; riders: number; capacity: number }) => void;
  onOptimize: () => void;
  onSimulateTraffic: () => void;
  onReoptimize: () => void;
  onReset: () => void;
  onStartGuidedDemo: () => void;
  hasOptimized: boolean;
  hasTrafficIncident: boolean;
}

export const SetupPanel: React.FC<SetupPanelProps> = ({
  numDeliveries,
  setNumDeliveries,
  numRiders,
  setNumRiders,
  riderCapacity,
  setRiderCapacity,
  objective,
  setObjective,
  isOptimizing,
  onGenerate,
  onSelectPreset,
  onOptimize,
  onSimulateTraffic,
  onReoptimize,
  onReset,
  onStartGuidedDemo,
  hasOptimized,
  hasTrafficIncident,
}) => {
  const presets = [
    { label: 'Map #1 (20 Stops)', deliveries: 20, riders: 3, capacity: 8 },
    { label: 'Map #2 (50 Stops)', deliveries: 50, riders: 5, capacity: 12 },
    { label: 'Map #3 (100 Stops)', deliveries: 100, riders: 8, capacity: 15 },
    { label: 'Map #4 (200 Stops)', deliveries: 200, riders: 12, capacity: 20 },
    { label: 'Map #5 (300 Stops)', deliveries: 300, riders: 18, capacity: 22 },
  ];

  const handlePresetSelect = (preset: typeof presets[0]) => {
    if (onSelectPreset) {
      onSelectPreset(preset);
    } else {
      setNumDeliveries(preset.deliveries);
      setNumRiders(preset.riders);
      setRiderCapacity(preset.capacity);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      {/* Title & Presets */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-900 text-white rounded-xl">
            <Sliders size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 font-heading">Simulation Parameters</h2>
            <p className="text-xs text-slate-500">Configure synthetic logistics environment and metaheuristic objectives.</p>
          </div>
        </div>

        {/* Problem Size Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-semibold text-slate-400 mr-1 uppercase">Presets:</span>
          {presets.map((p) => {
            const isActive = numDeliveries === p.deliveries && numRiders === p.riders;
            return (
              <button
                key={p.label}
                onClick={() => handlePresetSelect(p)}
                disabled={isOptimizing}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {/* 1. Deliveries */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700">Delivery Orders</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {numDeliveries} pkgs
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={300}
            step={5}
            value={numDeliveries}
            onChange={(e) => setNumDeliveries(Number(e.target.value))}
            disabled={isOptimizing}
            className="w-full accent-slate-900 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>10 min</span>
            <span>150</span>
            <span>300 max</span>
          </div>
        </div>

        {/* 2. Riders */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700">Rider Fleet</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {numRiders} riders
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={numRiders}
            onChange={(e) => setNumRiders(Number(e.target.value))}
            disabled={isOptimizing}
            className="w-full accent-slate-900 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>1</span>
            <span>10</span>
            <span>20</span>
          </div>
        </div>

        {/* 3. Capacity */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700">Rider Capacity</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {riderCapacity} / rider
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={1}
            value={riderCapacity}
            onChange={(e) => setRiderCapacity(Number(e.target.value))}
            disabled={isOptimizing}
            className="w-full accent-slate-900 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>5</span>
            <span>25</span>
            <span>50</span>
          </div>
        </div>

        {/* 4. Objective */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-700 mb-1.5">Optimization Goal</div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'time', label: 'Time' },
              { id: 'distance', label: 'Dist' },
              { id: 'balanced', label: 'Balanced' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setObjective(opt.id as any)}
                disabled={isOptimizing}
                className={`py-1.5 text-xs font-medium rounded-lg transition-all text-center ${
                  objective === opt.id
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {/* Start Simulation */}
          <button
            onClick={onOptimize}
            disabled={isOptimizing}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isOptimizing ? (
              <>
                <RefreshCw size={16} className="animate-spin text-emerald-400" />
                <span>Optimizing Swarms...</span>
              </>
            ) : (
              <>
                <Play size={16} className="fill-emerald-400 text-emerald-400" />
                <span>Start Dual Simulation</span>
              </>
            )}
          </button>

          {/* Simulate Traffic Incident */}
          <button
            onClick={onSimulateTraffic}
            disabled={isOptimizing || !hasOptimized}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border ${
              hasTrafficIncident
                ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title="Inject real-time congestion or incident onto active route roads"
          >
            <AlertOctagon size={16} className={hasTrafficIncident ? 'text-rose-600 animate-pulse' : 'text-amber-600'} />
            <span>{hasTrafficIncident ? 'Inject More Incidents' : 'Simulate Traffic'}</span>
          </button>

          {/* Re-Optimize */}
          {hasTrafficIncident && (
            <button
              onClick={onReoptimize}
              disabled={isOptimizing}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all animate-pulse"
              title="Re-run QPSO and PSO to avoid congested roads"
            >
              <RefreshCw size={16} />
              <span>Re-Optimize Routes</span>
            </button>
          )}

          {/* Regenerate City / Reset */}
          <button
            onClick={onGenerate}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs transition-colors"
            title="Generate new synthetic road network and delivery distribution"
          >
            <RotateCcw size={14} />
            <span>New City Map</span>
          </button>
        </div>

        {/* Guided Demo Button */}
        <button
          onClick={onStartGuidedDemo}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-xs shadow-md transition-all"
        >
          <Sparkles size={14} className="text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Interactive Demo Walkthrough</span>
        </button>
      </div>
    </div>
  );
};
