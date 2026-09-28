import React from 'react';
import { Trophy, Clock } from 'lucide-react';
import { OptimizerResult } from '../types';
import { ALGOS, algoColor, AlgoKey } from '../data/algorithms';

export interface ScenarioMetrics {
  cost: number;
  on_time_pct: number;
  late?: number;
  fleet_time_min: number;
  dist_km: number;
  time_ms: number;
  vans_used?: number;
}

/** Same metrics the benchmark script records, computed from a live API result. */
export const metricsFromResult = (res: OptimizerResult): ScenarioMetrics => {
  const routes = res.solution?.rider_routes ?? [];
  const stops = routes.flatMap((r: any) => r.deliveries ?? []);
  const late = stops.filter((d: any) => d.is_late).length;
  return {
    cost: res.final_cost,
    on_time_pct: stops.length ? (100 * (stops.length - late)) / stops.length : 100,
    late,
    fleet_time_min: res.solution?.total_time_min ?? 0,
    dist_km: res.solution?.total_dist_km ?? 0,
    time_ms: res.execution_time_ms,
    vans_used: routes.filter((r: any) => (r.delivery_count ?? 0) > 0).length
  };
};

interface ScenarioTableProps {
  title: string;
  subtitle: string;
  rows: Record<string, ScenarioMetrics>;
  previous?: Record<string, ScenarioMetrics>;
  isDark: boolean;
  alert?: boolean;
}

export const ScenarioTable: React.FC<ScenarioTableProps> = ({ title, subtitle, rows, previous, isDark, alert }) => {
  const present = ALGOS.filter(a => rows[a.key]);
  const minCost = present.length ? Math.min(...present.map(a => rows[a.key].cost)) : 0;
  const ink = isDark ? 'text-white' : 'text-slate-900';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className={`px-5 py-4 border-b flex items-center gap-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${alert ? 'bg-rose-500' : 'bg-emerald-500'}`} />
        <div className="min-w-0">
          <h4 className={`font-heading font-bold text-sm ${ink}`}>{title}</h4>
          <p className={`text-[11px] ${muted}`}>{subtitle}</p>
        </div>
      </div>

      {present.length === 0 ? (
        <div className={`px-5 py-12 text-center text-xs flex flex-col items-center gap-2 ${muted}`}>
          <Clock size={20} />
          <span>Waiting for re-optimisation results</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className={`text-[10px] uppercase tracking-wider border-b ${
              isDark ? 'bg-slate-950/60 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              <tr>
                <th className="py-2.5 px-4 text-left">Algorithm</th>
                <th className="py-2.5 px-3 text-right">Route cost</th>
                <th className="py-2.5 px-3 text-right">On time</th>
                <th className="py-2.5 px-3 text-right">Fleet time</th>
                <th className="py-2.5 px-3 text-right">Distance</th>
                <th className="py-2.5 px-4 text-right">Compute</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {present.map(a => {
                const m = rows[a.key];
                const best = m.cost <= minCost + 1e-6;
                const prev = previous?.[a.key];
                const delta = prev ? m.cost - prev.cost : null;
                return (
                  <tr key={a.key} className={best ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : ''}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1 h-6 rounded-full shrink-0"
                          style={{ backgroundColor: algoColor(a.key as AlgoKey, isDark) }}
                        />
                        <div>
                          <div className={`font-semibold ${ink}`}>{a.label}</div>
                          {best && (
                            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <Trophy size={10} /> Lowest cost
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <div className={`${best ? 'font-bold' : ''} ${ink}`}>{m.cost.toFixed(1)}</div>
                      {delta !== null && (
                        <div className={`text-[10px] ${delta > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)}
                        </div>
                      )}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${m.on_time_pct < 100 ? 'text-rose-600 dark:text-rose-400' : ink}`}>
                      {m.on_time_pct.toFixed(0)}%
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${ink}`}>{Math.round(m.fleet_time_min)} min</td>
                    <td className={`py-3 px-3 text-right font-mono ${ink}`}>{m.dist_km.toFixed(1)} km</td>
                    <td className={`py-3 px-4 text-right font-mono ${muted}`}>{Math.round(m.time_ms)} ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
