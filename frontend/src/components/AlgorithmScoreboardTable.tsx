import React, { useState } from 'react';
import { OptimizerResult, ComparisonMetrics } from '../types';
import {
  Trophy,
  Clock,
  Navigation,
  Leaf,
  Timer,
  CheckCircle2,
  Sparkles,
  Info,
  Truck,
  TrendingDown,
  Award
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface AlgorithmScoreboardTableProps {
  qpsoResult: OptimizerResult | null;
  psoResult: OptimizerResult | null;
  gaResult?: OptimizerResult | null;
  saResult?: OptimizerResult | null;
  greedyResult?: OptimizerResult | null;
  comparison?: ComparisonMetrics | null;
  title?: string;
  subtitle?: string;
}

interface AlgoScoreRow {
  key: string;
  name: string;
  shortName: string;
  badgeClass: string;
  textColor: string;
  ringColor: string;
  distanceKm: number;
  fleetTimeMin: number;
  onTimePct: number;
  onTimeCount: number;
  totalDeliveries: number;
  co2Kg: number;
  vansUsed: number;
  solveTimeSec: number;
  solveTimeMs: number;
  cost: number;
  localSearchImpPct?: number;
  isOverallWinner: boolean;
}

export const AlgorithmScoreboardTable: React.FC<AlgorithmScoreboardTableProps> = ({
  qpsoResult,
  psoResult,
  gaResult,
  saResult,
  greedyResult,
  comparison,
  title = "Scoreboard: The 5 Key Measures",
  subtitle = "Comparative performance breakdown across customer SLA, operational fleet time, route distance, carbon footprint, and computation latency."
}) => {
  const [showMeasureGuide, setShowMeasureGuide] = useState<boolean>(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Extract raw rows from available results
  const rawResults: { key: string; name: string; result: OptimizerResult | null; badgeClass: string; textColor: string; ringColor: string }[] = [
    {
      key: 'QPSO',
      name: 'Quantum-Behaved PSO',
      result: qpsoResult,
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      textColor: 'text-emerald-400',
      ringColor: 'ring-emerald-500/30'
    },
    {
      key: 'PSO',
      name: 'Classical PSO',
      result: psoResult,
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      textColor: 'text-indigo-400',
      ringColor: 'ring-indigo-500/30'
    },
    {
      key: 'GA',
      name: 'Genetic Algorithm',
      result: gaResult || null,
      badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
      textColor: 'text-violet-400',
      ringColor: 'ring-violet-500/30'
    },
    {
      key: 'SA',
      name: 'Simulated Annealing',
      result: saResult || null,
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      textColor: 'text-amber-400',
      ringColor: 'ring-amber-500/30'
    },
    {
      key: 'Greedy NN',
      name: 'Greedy Nearest-Neighbour (Baseline)',
      result: greedyResult || null,
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      textColor: 'text-rose-400',
      ringColor: 'ring-rose-500/30'
    },
  ];

  const rows: AlgoScoreRow[] = [];

  rawResults.forEach(({ key, name, result, badgeClass, textColor, ringColor }) => {
    if (!result) return;

    const sol = result.solution;
    const routes = sol.rider_routes || [];
    const allDeliveries = routes.flatMap(r => r.deliveries || []);
    const totalDeliveries = allDeliveries.length;
    const onTimeCount = allDeliveries.filter(d => !(d as any).is_late).length;
    const onTimePct = totalDeliveries > 0 ? (onTimeCount / totalDeliveries) * 100.0 : 100.0;

    const distanceKm = sol.total_dist_km || routes.reduce((acc, r) => acc + (r.route_dist_km || 0), 0);
    const fleetTimeMin = sol.total_time_min || routes.reduce((acc, r) => acc + (r.route_time_min || 0), 0);
    const vansUsed = routes.filter(r => (r.delivery_count || 0) > 0).length;

    // Standard commercial delivery van emission standard ~0.160 kg CO2 / km
    const co2Kg = Number((distanceKm * 0.160).toFixed(2));

    const solveTimeMs = result.execution_time_ms;
    const solveTimeSec = Number((solveTimeMs / 1000.0).toFixed(3));
    const cost = result.final_cost;
    const localSearchImpPct = result.local_search?.improvement_pct;

    const isOverallWinner = comparison?.winner === key;

    rows.push({
      key,
      name,
      shortName: key,
      badgeClass,
      textColor,
      ringColor,
      distanceKm: Number(distanceKm.toFixed(2)),
      fleetTimeMin: Number(fleetTimeMin.toFixed(1)),
      onTimePct: Number(onTimePct.toFixed(1)),
      onTimeCount,
      totalDeliveries,
      co2Kg,
      vansUsed,
      solveTimeSec,
      solveTimeMs,
      cost: Number(cost.toFixed(2)),
      localSearchImpPct,
      isOverallWinner
    });
  });

  if (rows.length === 0) {
    return null;
  }

  // Determine winners for each column
  // 1. On-time deliveries: HIGHER is better (max)
  const maxOnTime = Math.max(...rows.map(r => r.onTimePct));

  // 2. Fleet time: LOWER is better (min)
  const minFleetTime = Math.min(...rows.map(r => r.fleetTimeMin));

  // 3. Distance: LOWER is better (min)
  const minDistance = Math.min(...rows.map(r => r.distanceKm));

  // 4. CO2 / Vans: LOWER is better (min)
  const minCo2 = Math.min(...rows.map(r => r.co2Kg));

  // 5. Solve time: LOWER is better (min)
  const minSolveTime = Math.min(...rows.map(r => r.solveTimeMs));

  // 6. Overall Objective Cost: LOWER is better (min)
  const minCost = Math.min(...rows.map(r => r.cost));

  // Helper to check winner with floating point safety
  const isClose = (a: number, b: number) => Math.abs(a - b) <= 0.05;

  return (
    <div className={`rounded-2xl overflow-hidden border shadow-sm transition-colors ${
      isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200'
    }`}>
      {/* Header bar */}
      <div className={`px-5 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center text-slate-950 shadow-md">
            <Trophy size={16} className="font-extrabold" />
          </div>
          <div>
            <h3 className={`font-heading font-bold text-sm flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              <span>{title}</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Live Benchmarking
              </span>
            </h3>
            <p className={`text-[11px] mt-0.5 max-w-2xl ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Action Toggle for Metric Definitions */}
        <button
          onClick={() => setShowMeasureGuide(prev => !prev)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
            showMeasureGuide
              ? isDark ? 'bg-slate-800 border-amber-500/50 text-amber-300 shadow-sm' : 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm'
              : isDark ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Info size={13} />
          <span>{showMeasureGuide ? 'Hide Metric Guide' : 'What each measure means'}</span>
        </button>
      </div>

      {/* Expandable "What it means & Why a user cares" Guide (Matches Image 2) */}
      {showMeasureGuide && (
        <div className={`border-b p-4 animate-in fade-in slide-in-from-top-2 ${
          isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-mono uppercase text-[11px]">
                  <CheckCircle2 size={13} />
                  On-Time Deliveries
                </span>
                <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Stops reached inside their time slot.</p>
              </div>
              <div className={`mt-2 pt-2 border-t text-[10px] ${isDark ? 'border-slate-800/60 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                <span className="text-amber-600 dark:text-amber-300 font-semibold">Why it matters:</span> Late parcels cost customers; this matters most.
              </div>
            </div>

            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5 font-mono uppercase text-[11px]">
                  <Clock size={13} />
                  Fleet Time
                </span>
                <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total driving + waiting time of all vans.</p>
              </div>
              <div className={`mt-2 pt-2 border-t text-[10px] ${isDark ? 'border-slate-800/60 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                <span className="text-amber-600 dark:text-amber-300 font-semibold">Why it matters:</span> Driver wages, shift limits, and fuel usage.
              </div>
            </div>

            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 font-mono uppercase text-[11px]">
                  <Navigation size={13} />
                  Distance
                </span>
                <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total road kilometers driven.</p>
              </div>
              <div className={`mt-2 pt-2 border-t text-[10px] ${isDark ? 'border-slate-800/60 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                <span className="text-amber-600 dark:text-amber-300 font-semibold">Why it matters:</span> Wear on vehicles, tires, maintenance and fuel.
              </div>
            </div>

            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <span className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 font-mono uppercase text-[11px]">
                  <Leaf size={13} />
                  CO₂ & Vans Used
                </span>
                <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Estimated carbon footprint (0.160 kg/km) & active vans.</p>
              </div>
              <div className={`mt-2 pt-2 border-t text-[10px] ${isDark ? 'border-slate-800/60 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                <span className="text-amber-600 dark:text-amber-300 font-semibold">Why it matters:</span> Green fleet compliance; fewer vans = lower cost.
              </div>
            </div>

            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-mono uppercase text-[11px]">
                  <Timer size={13} />
                  Solve Time
                </span>
                <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Computational run time of algorithm.</p>
              </div>
              <div className={`mt-2 pt-2 border-t text-[10px] ${isDark ? 'border-slate-800/60 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                <span className="text-amber-600 dark:text-amber-300 font-semibold">Why it matters:</span> Real-time responsiveness for dispatch operators.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The 5 Measures Scoreboard Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`border-b text-[11px] font-mono uppercase ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
              <th className="py-3 px-4 font-bold">Algorithm</th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>On-time Deliveries</span>
                  <span className="text-[9px] text-slate-500 font-normal">(%)</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-sky-400" />
                  <span>Fleet Time</span>
                  <span className="text-[9px] text-slate-500 font-normal">(min)</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Navigation size={13} className="text-indigo-400" />
                  <span>Distance</span>
                  <span className="text-[9px] text-slate-500 font-normal">(km)</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Leaf size={13} className="text-teal-400" />
                  <span>CO₂ / Vans Used</span>
                  <span className="text-[9px] text-slate-500 font-normal">(kg / qty)</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Timer size={13} className="text-amber-400" />
                  <span>Solve Time</span>
                  <span className="text-[9px] text-slate-500 font-normal">(sec / ms)</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={13} className="text-purple-400" />
                  <span>Objective Cost</span>
                  <span className="text-[9px] text-slate-500 font-normal">(Score)</span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody className={`divide-y text-xs font-mono ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {rows.map((row) => {
              const isOnTimeWinner = isClose(row.onTimePct, maxOnTime);
              const isFleetTimeWinner = isClose(row.fleetTimeMin, minFleetTime);
              const isDistanceWinner = isClose(row.distanceKm, minDistance);
              const isCo2Winner = isClose(row.co2Kg, minCo2);
              const isSolveTimeWinner = isClose(row.solveTimeMs, minSolveTime);
              const isCostWinner = isClose(row.cost, minCost);

              return (
                <tr
                  key={`score-row-${row.key}`}
                  className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/80'} ${
                    row.isOverallWinner ? (isDark ? 'bg-amber-500/[0.04]' : 'bg-amber-50/50') : ''
                  }`}
                >
                  {/* Algorithm Name & Identity */}
                  <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${row.badgeClass} flex items-center gap-1.5`}>
                        {row.shortName}
                        {row.isOverallWinner && (
                          <span title="Overall Winner across all dimensions" className="text-amber-500">
                            👑
                          </span>
                        )}
                      </span>
                      <span className={`hidden md:inline text-[11px] font-sans font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {row.name}
                      </span>
                    </div>
                  </td>

                  {/* 1. On-time Deliveries (%) */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                      isOnTimeWinner
                        ? isDark ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.15)]' : 'bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold shadow-sm'
                        : isDark ? 'text-slate-300' : 'text-slate-800 font-medium'
                    }`}>
                      <span>{row.onTimePct}%</span>
                      {isOnTimeWinner && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-extrabold ${
                          isDark ? 'bg-emerald-500/30 text-emerald-200' : 'bg-emerald-200 text-emerald-900'
                        }`}>
                          🏆 Best
                        </span>
                      )}
                    </div>
                    <span className={`block text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {row.onTimeCount}/{row.totalDeliveries} stops
                    </span>
                  </td>

                  {/* 2. Fleet Time (min) */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                      isFleetTimeWinner
                        ? isDark ? 'bg-sky-500/20 border border-sky-500/50 text-sky-300 font-bold shadow-[0_0_10px_rgba(14,165,233,0.15)]' : 'bg-sky-50 border border-sky-300 text-sky-800 font-bold shadow-sm'
                        : isDark ? 'text-slate-300' : 'text-slate-800 font-medium'
                    }`}>
                      <span>{row.fleetTimeMin} min</span>
                      {isFleetTimeWinner && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-extrabold ${
                          isDark ? 'bg-sky-500/30 text-sky-200' : 'bg-sky-200 text-sky-900'
                        }`}>
                          🏆 Best
                        </span>
                      )}
                    </div>
                    <span className={`block text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {(row.fleetTimeMin / 60.0).toFixed(1)} hrs active
                    </span>
                  </td>

                  {/* 3. Distance (km) */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                      isDistanceWinner
                        ? isDark ? 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 font-bold shadow-[0_0_10px_rgba(99,102,241,0.15)]' : 'bg-indigo-50 border border-indigo-300 text-indigo-800 font-bold shadow-sm'
                        : isDark ? 'text-slate-300' : 'text-slate-800 font-medium'
                    }`}>
                      <span>{row.distanceKm} km</span>
                      {isDistanceWinner && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-extrabold ${
                          isDark ? 'bg-indigo-500/30 text-indigo-200' : 'bg-indigo-200 text-indigo-900'
                        }`}>
                          🏆 Best
                        </span>
                      )}
                    </div>
                    <span className={`block text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {(row.distanceKm / Math.max(1, row.vansUsed)).toFixed(1)} km/van
                    </span>
                  </td>

                  {/* 4. CO2 (kg) / Vans Used */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                      isCo2Winner
                        ? isDark ? 'bg-teal-500/20 border border-teal-500/50 text-teal-300 font-bold shadow-[0_0_10px_rgba(20,184,166,0.15)]' : 'bg-teal-50 border border-teal-300 text-teal-800 font-bold shadow-sm'
                        : isDark ? 'text-slate-300' : 'text-slate-800 font-medium'
                    }`}>
                      <span>{row.co2Kg} kg</span>
                      {isCo2Winner && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-extrabold ${
                          isDark ? 'bg-teal-500/30 text-teal-200' : 'bg-teal-200 text-teal-900'
                        }`}>
                          🏆 Best
                        </span>
                      )}
                    </div>
                    <span className={`block text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {row.vansUsed} vans active
                    </span>
                  </td>

                  {/* 5. Solve Time (sec / ms) */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                      isSolveTimeWinner
                        ? isDark ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.15)]' : 'bg-amber-50 border border-amber-300 text-amber-800 font-bold shadow-sm'
                        : isDark ? 'text-slate-300' : 'text-slate-800 font-medium'
                    }`}>
                      <span>{row.solveTimeMs < 1000 ? `${row.solveTimeMs.toFixed(1)} ms` : `${row.solveTimeSec} s`}</span>
                      {isSolveTimeWinner && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-extrabold ${
                          isDark ? 'bg-amber-500/30 text-amber-200' : 'bg-amber-200 text-amber-900'
                        }`}>
                          ⚡ Fastest
                        </span>
                      )}
                    </div>
                    <span className={`block text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {row.solveTimeMs < 100 ? 'Real-time (<100ms)' : 'Sub-second dispatch'}
                    </span>
                  </td>

                  {/* 6. Objective Cost / Score */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                      isCostWinner
                        ? isDark ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300 font-bold shadow-[0_0_10px_rgba(168,85,247,0.15)]' : 'bg-purple-50 border border-purple-300 text-purple-800 font-bold shadow-sm'
                        : isDark ? 'text-slate-300' : 'text-slate-800 font-medium'
                    }`}>
                      <span>{row.cost.toFixed(2)}</span>
                      {isCostWinner && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-extrabold ${
                          isDark ? 'bg-purple-500/30 text-purple-200' : 'bg-purple-200 text-purple-900'
                        }`}>
                          🏆 Winner
                        </span>
                      )}
                    </div>
                    {row.localSearchImpPct && row.localSearchImpPct > 0 ? (
                      <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold">
                        ✨ -{row.localSearchImpPct}% LS polished
                      </span>
                    ) : (
                      <span className={`block text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        Base metaheuristic
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Winner Summary Footer Callout */}
      {comparison && (
        <div className={`px-5 py-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors ${
          isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center gap-2">
            <Award size={15} className="text-amber-500 shrink-0" />
            <span>
              <strong className={isDark ? 'text-white' : 'text-slate-900'}>{comparison.winner}</strong> achieved the best overall objective fitness ({minCost.toFixed(2)})
              {comparison.cost_diff_pct !== undefined && Math.abs(comparison.cost_diff_pct) > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold ml-1">
                  ({Math.abs(comparison.cost_diff_pct)}% lead)
                </span>
              )}
            </span>
          </div>

          <div className={`flex items-center gap-3 text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Badges indicate column leader
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
