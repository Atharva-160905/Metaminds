import React from 'react';
import { OptimizerResult, SyntheticCityData } from '../types';
import { CityRouteMap } from './CityRouteMap';
import { AlgorithmScoreboardTable } from './AlgorithmScoreboardTable';
import { Zap, Clock, Navigation, CheckCircle2, Award, Flame, Dna, Thermometer, Sparkles } from 'lucide-react';
import { getRiderColor } from '../utils/colors';

interface SideBySideComparisonProps {
  city: SyntheticCityData | null;
  qpsoResult: OptimizerResult | null;
  psoResult: OptimizerResult | null;
  gaResult: OptimizerResult | null;
  saResult: OptimizerResult | null;
  animProgress: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetAnim: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

// Reusable algorithm metric card
const AlgorithmCard: React.FC<{
  result: OptimizerResult | null;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;      // e.g. 'emerald'
  bgGlow: string;           // e.g. 'bg-emerald-100/50'
  borderColor: string;      // e.g. 'border-emerald-200'
  iconBg: string;           // e.g. 'bg-emerald-600'
  iconShadow: string;       // e.g. 'shadow-emerald-600/30'
  costColor: string;        // e.g. 'text-emerald-700'
  execColor: string;        // e.g. 'text-emerald-700'
  badgeBg: string;          // e.g. 'bg-emerald-100'
  badgeText: string;        // e.g. 'text-emerald-800'
  isBest: boolean;
}> = ({
  result, title, subtitle, icon, accentColor, bgGlow, borderColor, iconBg, iconShadow,
  costColor, execColor, badgeBg, badgeText, isBest
}) => (
  <div className={`bg-white rounded-2xl p-4 border ${borderColor} shadow-sm relative overflow-hidden`}>
    <div className={`absolute top-0 right-0 w-32 h-32 ${bgGlow} rounded-full blur-2xl pointer-events-none`} />
    
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className={`p-2 ${iconBg} text-white rounded-xl shadow-md ${iconShadow}`}>
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 font-heading">
              {title}
            </h3>
            {isBest && (
              <span className={`flex items-center gap-1 text-[10px] font-bold ${badgeBg} ${badgeText} px-2 py-0.5 rounded-full uppercase`}>
                <Award size={11} /> Top Solution
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      {result && (
        <div className="text-right">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Final Cost</div>
          <div className={`text-lg font-black font-mono ${costColor}`}>
            {result.final_cost}
          </div>
        </div>
      )}
    </div>

    {result ? (
      <>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase block">Total Time</span>
            <span className="font-bold text-slate-900 font-mono text-sm">
              {result.solution.total_time_min} min
            </span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase block">Total Distance</span>
            <span className="font-bold text-slate-900 font-mono text-sm">
              {result.solution.total_dist_km} km
            </span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase block">Execution</span>
            <span className={`font-bold ${execColor} font-mono text-sm`}>
              {result.execution_time_ms} ms
            </span>
          </div>
        </div>

        {result.local_search && result.local_search.applied && (
          <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Sparkles size={12} className="text-amber-500 shrink-0" />
              <span className="text-[11px]">2-Opt & Relocate Polish</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              {result.local_search.improvement_pct > 0 ? (
                <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  -{result.local_search.improvement_pct}% ({result.local_search.moves_applied} moves)
                </span>
              ) : (
                <span className="text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                  Optimal (0 moves)
                </span>
              )}
            </div>
          </div>
        )}
      </>
    ) : (
      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 italic">
        Ready to optimize on current city network.
      </div>
    )}
  </div>
);

export const SideBySideComparison: React.FC<SideBySideComparisonProps> = ({
  city,
  qpsoResult,
  psoResult,
  gaResult,
  saResult,
  animProgress,
  isPlaying,
  onTogglePlay,
  onResetAnim,
  playbackSpeed,
  onChangeSpeed,
}) => {
  // Determine overall best among all available results
  const allResults = [
    { name: 'QPSO', result: qpsoResult },
    { name: 'PSO', result: psoResult },
    { name: 'GA', result: gaResult },
    { name: 'SA', result: saResult },
  ].filter(r => r.result !== null);

  const bestAlgo = allResults.length > 0
    ? allResults.reduce((best, curr) =>
        (curr.result!.final_cost < best.result!.final_cost) ? curr : best
      ).name
    : null;

  return (
    <div className="space-y-6">
      {/* 5 Measures Benchmark Scoreboard */}
      {(qpsoResult || psoResult) && (
        <AlgorithmScoreboardTable
          qpsoResult={qpsoResult}
          psoResult={psoResult}
          gaResult={gaResult}
          saResult={saResult}
          title="Scoreboard: The 5 Key Measures"
          subtitle="Direct comparison across customer SLA on-time %, fleet active time, travel distance, carbon footprint, and computation latency."
        />
      )}

      {/* Top Row: QPSO vs PSO with route maps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QPSO Panel */}
        <div className="flex flex-col space-y-3">
          <AlgorithmCard
            result={qpsoResult}
            title="Quantum-Inspired QPSO"
            subtitle="Delta-Potential Well • Mean-Best Quantum Attractor"
            icon={<Zap size={18} />}
            accentColor="emerald"
            bgGlow="bg-emerald-100/50"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-600"
            iconShadow="shadow-emerald-600/30"
            costColor="text-emerald-700"
            execColor="text-emerald-700"
            badgeBg="bg-emerald-100"
            badgeText="text-emerald-800"
            isBest={bestAlgo === 'QPSO'}
          />
          <CityRouteMap
            city={city}
            riderRoutes={qpsoResult?.solution.rider_routes}
            numRiders={city?.riders?.length}
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

        {/* PSO Panel */}
        <div className="flex flex-col space-y-3">
          <AlgorithmCard
            result={psoResult}
            title="Classical PSO"
            subtitle="Inertia Weight Decay • Velocity-Displacement Dynamics"
            icon={<Zap size={18} />}
            accentColor="cyan"
            bgGlow="bg-cyan-100/50"
            borderColor="border-cyan-200"
            iconBg="bg-cyan-600"
            iconShadow="shadow-cyan-600/30"
            costColor="text-cyan-700"
            execColor="text-cyan-700"
            badgeBg="bg-cyan-100"
            badgeText="text-cyan-800"
            isBest={bestAlgo === 'PSO'}
          />
          <CityRouteMap
            city={city}
            riderRoutes={psoResult?.solution.rider_routes}
            numRiders={city?.riders?.length}
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

      {/* Bottom Row: GA and SA metric cards (compact, no map needed) */}
      {(gaResult || saResult) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {gaResult && (
            <AlgorithmCard
              result={gaResult}
              title="Genetic Algorithm"
              subtitle="BLX-α Crossover • Tournament Selection • Gaussian Mutation"
              icon={<Dna size={18} />}
              accentColor="violet"
              bgGlow="bg-violet-100/50"
              borderColor="border-violet-200"
              iconBg="bg-violet-600"
              iconShadow="shadow-violet-600/30"
              costColor="text-violet-700"
              execColor="text-violet-700"
              badgeBg="bg-violet-100"
              badgeText="text-violet-800"
              isBest={bestAlgo === 'GA'}
            />
          )}
          {saResult && (
            <AlgorithmCard
              result={saResult}
              title="Simulated Annealing"
              subtitle="Cauchy Perturbation • Exponential Cooling • Multi-Restart"
              icon={<Thermometer size={18} />}
              accentColor="amber"
              bgGlow="bg-amber-100/50"
              borderColor="border-amber-200"
              iconBg="bg-amber-600"
              iconShadow="shadow-amber-600/30"
              costColor="text-amber-700"
              execColor="text-amber-700"
              badgeBg="bg-amber-100"
              badgeText="text-amber-800"
              isBest={bestAlgo === 'SA'}
            />
          )}
        </div>
      )}
    </div>
  );
};
