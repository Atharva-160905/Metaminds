import React from 'react';
import { OptimizerResult, SyntheticCityData } from '../types';
import { CityRouteMap } from './CityRouteMap';
import { Zap, Clock, Navigation, CheckCircle2, Award, Flame } from 'lucide-react';
import { getRiderColor } from '../utils/colors';

interface SideBySideComparisonProps {
  city: SyntheticCityData | null;
  qpsoResult: OptimizerResult | null;
  psoResult: OptimizerResult | null;
  animProgress: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetAnim: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const SideBySideComparison: React.FC<SideBySideComparisonProps> = ({
  city,
  qpsoResult,
  psoResult,
  animProgress,
  isPlaying,
  onTogglePlay,
  onResetAnim,
  playbackSpeed,
  onChangeSpeed,
}) => {
  const isQpsoBest = qpsoResult && psoResult && qpsoResult.final_cost <= psoResult.final_cost;
  const isPsoBest = qpsoResult && psoResult && psoResult.final_cost < qpsoResult.final_cost;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. LEFT PANEL: Quantum-Inspired (QPSO) */}
      <div className="flex flex-col space-y-3">
        {/* Metric Header Card */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-600/30">
                <Zap size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 font-heading">
                    Quantum-Inspired QPSO
                  </h3>
                  {isQpsoBest && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                      <Award size={11} /> Top Solution
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Delta-Potential Well • Mean-Best Quantum Attractor</p>
              </div>
            </div>

            {qpsoResult && (
              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Final Cost</div>
                <div className="text-lg font-black font-mono text-emerald-700">
                  {qpsoResult.final_cost}
                </div>
              </div>
            )}
          </div>

          {/* Key Stat Pills */}
          {qpsoResult ? (
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase block">Total Time</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {qpsoResult.solution.total_time_min} min
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase block">Total Distance</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {qpsoResult.solution.total_dist_km} km
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase block">Execution</span>
                <span className="font-bold text-emerald-700 font-mono text-sm">
                  {qpsoResult.execution_time_ms} ms
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 italic">
              Ready to optimize on current city network.
            </div>
          )}
        </div>

        {/* Map Visualization */}
        <CityRouteMap
          city={city}
          riderRoutes={qpsoResult?.solution.rider_routes}
          title="Quantum-Inspired Route Solution"
          theme="qpso"
          animProgress={animProgress}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onResetAnim={onResetAnim}
          playbackSpeed={playbackSpeed}
          onChangeSpeed={onChangeSpeed}
        />
      </div>

      {/* 2. RIGHT PANEL: Classical PSO Baseline */}
      <div className="flex flex-col space-y-3">
        {/* Metric Header Card */}
        <div className="bg-white rounded-2xl p-4 border border-cyan-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-100/50 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-cyan-600 text-white rounded-xl shadow-md shadow-cyan-600/30">
                <Zap size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 font-heading">
                    Classical PSO
                  </h3>
                  {isPsoBest && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full uppercase">
                      <Award size={11} /> Top Solution
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Inertia Weight Decay • Velocity-Displacement Dynamics</p>
              </div>
            </div>

            {psoResult && (
              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Final Cost</div>
                <div className="text-lg font-black font-mono text-cyan-700">
                  {psoResult.final_cost}
                </div>
              </div>
            )}
          </div>

          {/* Key Stat Pills */}
          {psoResult ? (
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase block">Total Time</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {psoResult.solution.total_time_min} min
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase block">Total Distance</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {psoResult.solution.total_dist_km} km
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase block">Execution</span>
                <span className="font-bold text-cyan-700 font-mono text-sm">
                  {psoResult.execution_time_ms} ms
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 italic">
              Ready to optimize on current city network.
            </div>
          )}
        </div>

        {/* Map Visualization */}
        <CityRouteMap
          city={city}
          riderRoutes={psoResult?.solution.rider_routes}
          title="Classical PSO Route Solution"
          theme="pso"
          animProgress={animProgress}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onResetAnim={onResetAnim}
          playbackSpeed={playbackSpeed}
          onChangeSpeed={onChangeSpeed}
        />
      </div>
    </div>
  );
};
