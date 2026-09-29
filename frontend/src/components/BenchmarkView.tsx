import React, { useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  BarChart2,
  CheckCircle,
  Flame,
  Target,
  Swords,
  TrendingDown,
  MapPin,
  FileCode2
} from 'lucide-react';
import { benchmarkData } from '../data/benchmarkData';
import { ALGOS, METAHEURISTICS, AlgoKey, algoColor } from '../data/algorithms';

// ---------- Types for scripts/run_real_benchmarks.py output ----------
interface SearchStats { cost_mean: number; cost_std: number; iters_to_1pct: number; evals_to_1pct: number; time_ms: number; wins: number; }
interface PipelineStats { cost_mean: number; cost_std: number; on_time_pct: number; dist: number; fleet_time: number; time_ms: number; wins: number; }
interface Tier {
  size: number;
  label: string;
  riders: number;
  capacity_kg: number;
  iterations: number;
  search: Record<string, SearchStats>;
  pipeline: Record<string, PipelineStats>;
  search_best: string;
  pipeline_best: string;
  qpso_vs_pso: { search_wins: number; final_wins: number; seeds: number; search_diff_pct: number; final_diff_pct: number };
  curves: Record<string, number[]>;
  anytime?: Anytime;
}
// checkpoint ("5", "10", "20", "final") -> algo -> mean gap (%) to the seed's best final cost, and seeds led
type Anytime = Record<string, Record<string, { gap_mean: number; wins: number }>>;
interface ZoneRow {
  size: number;
  zones: number;
  riders: number;
  iterations_per_zone: number;
  search: Record<string, { cost_mean: number; wins: number }>;
  final: Record<string, { cost_mean: number; wins: number; on_time_pct: number; time_ms: number }>;
}
interface ExactRow { size: number; seeds: number; exact_ms_mean: number; algos: Record<string, { gap_mean: number; gap_max: number; optimal_hits: number }>; }
interface BenchmarkFile {
  meta: { generated_at: string; seeds: number[]; population: number; iterations_rule: string; riders_rule: string; capacity_kg: number; objective: string; command: string; runtime_s?: number };
  conditions: { congested: Tier[]; clear: Tier[] };
  zones?: { congested: ZoneRow[]; clear: ZoneRow[] };
  exact: ExactRow[];
  delhi_scenario: {
    seed?: number; seeds_tested: number; reroute_winner_counts: Record<string, number>; reroute_anytime?: Anytime;
    plan_winner_counts?: Record<string, number>; qpso_wins_both?: number; selection_rule?: string;
  };
}

const CHECKPOINTS = ['5', '10', '20', 'final'] as const;
const checkpointLabel = (c: string) => (c === 'final' ? 'End of run' : `After ${c} it.`);

const data = benchmarkData as BenchmarkFile;

const fmt = (n: number, digits = 0) =>
  Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const fmtK = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `${Math.round(n)}`);

// Lowest value, counting exact ties (e.g. a swarm that kept the greedy start) as shared bests
const isBest = (v: number, all: number[]) => v <= Math.min(...all) * (1 + 1e-6) + 1e-9;

export const BenchmarkView: React.FC<any> = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  if (!data) {
    return (
      <div className={`rounded-2xl border p-10 text-center ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'}`}>
        <BarChart2 size={36} className="mx-auto mb-3 text-slate-400" />
        <h2 className={`text-lg font-bold font-heading ${isDark ? 'text-white' : 'text-slate-900'}`}>Benchmark results not generated yet</h2>
        <p className="text-sm mt-2">
          Run <code className="font-mono px-1.5 py-0.5 rounded bg-slate-500/10">python scripts/run_real_benchmarks.py</code> from the project root.
          This page updates automatically when it finishes.
        </p>
      </div>
    );
  }
  return <BenchmarkStudy />;
};

const BenchmarkStudy: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [condition, setCondition] = useState<'congested' | 'clear'>('congested');
  const tiers = data.conditions[condition];
  const [chartSize, setChartSize] = useState<number>(tiers[tiers.length - 1]?.size ?? 500);
  const [checkpoint, setCheckpoint] = useState<string>('10');
  const [zoneMode, setZoneMode] = useState<'search' | 'final'>('search');

  // ---------- Theme tokens ----------
  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const ink = isDark ? 'text-white' : 'text-slate-900';
  const ink2 = isDark ? 'text-slate-300' : 'text-slate-700';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const headRow = isDark ? 'bg-slate-950/70 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200';
  const divide = isDark ? 'divide-slate-800' : 'divide-slate-100';
  const bestCell = isDark ? 'bg-emerald-500/10' : 'bg-emerald-50';

  // ---------- Aggregates (all computed from the JSON) ----------
  const allTiers = [...data.conditions.congested, ...data.conditions.clear];
  const qpsoExact = data.exact.map(r => r.algos['QPSO']);
  const qpsoGap = qpsoExact.reduce((s, a) => s + a.gap_mean, 0) / Math.max(1, qpsoExact.length);
  const qpsoHits = qpsoExact.reduce((s, a) => s + a.optimal_hits, 0);
  const exactRuns = data.exact.reduce((s, r) => s + r.seeds, 0);

  // ---------- Overview: who has the lowest cost where (win counts over all seeds and both traffic conditions) ----------
  type WinRow = { label: string; sub: string; wins: Record<string, number>; runs: number };
  const seedCount = data.meta.seeds.length;
  const addWins = (acc: Record<string, number>, src: Record<string, { wins: number }> | undefined) => {
    METAHEURISTICS.forEach(a => { acc[a.key] = (acc[a.key] ?? 0) + (src?.[a.key]?.wins ?? 0); });
    return acc;
  };
  const tierRow = (label: string, sub: string, sizes: number[]): WinRow => {
    const ts = allTiers.filter(t => sizes.includes(t.size));
    return { label, sub, wins: ts.reduce((acc, t) => addWins(acc, t.search), {} as Record<string, number>), runs: ts.length * seedCount };
  };
  const zoneRows = data.zones ? [...data.zones.congested, ...data.zones.clear] : [];
  const delhi = data.delhi_scenario;
  const scoreRows: WinRow[] = [
    tierRow('Small orders', '20 stops', [20]),
    tierRow('Medium orders', '50 and 100 stops, solved as one problem', [50, 100]),
    tierRow('Large orders', '250 and 500 stops, solved as one problem', [250, 500]),
    ...(zoneRows.length ? [{
      label: 'Large orders split into zones',
      sub: '100 to 500 stops, solved as ~20-stop zones',
      wins: zoneRows.reduce((acc, z) => addWins(acc, z.search), {} as Record<string, number>),
      runs: zoneRows.length * seedCount
    }] : []),
    ...(allTiers[0]?.anytime ? [{
      label: 'Answer needed fast',
      sub: 'cost after only 10 iterations, all sizes',
      wins: allTiers.reduce((acc, t) => addWins(acc, t.anytime?.['10']), {} as Record<string, number>),
      runs: allTiers.length * seedCount
    }] : []),
    ...(delhi.reroute_anytime?.['10'] ? [{
      label: 'Quick re-route after incidents',
      sub: `Delhi Okhla, cost after 10 re-route iterations, ${delhi.seeds_tested} scenarios`,
      wins: Object.fromEntries(METAHEURISTICS.map(a => [a.key, delhi.reroute_anytime!['10'][a.key]?.wins ?? 0])),
      runs: delhi.seeds_tested
    }] : []),
    {
      label: 'Re-routing after traffic incidents',
      sub: `Delhi Okhla, 40 stops, ${delhi.seeds_tested} scenarios (final routes)`,
      wins: Object.fromEntries(METAHEURISTICS.map(a => [a.key, delhi.reroute_winner_counts[a.key] ?? 0])),
      runs: delhi.seeds_tested
    }
  ];
  const leader = (r: WinRow) => METAHEURISTICS.reduce((best, a) => (r.wins[a.key] > r.wins[best] ? a.key : best), METAHEURISTICS[0].key as string);
  const qpsoLeads = scoreRows.filter(r => leader(r) === 'QPSO');
  const othersLead = scoreRows.filter(r => leader(r) !== 'QPSO');
  const zoneRow = scoreRows.find(r => r.label.startsWith('Large orders split'));
  const smallRow = scoreRows[0];

  const chartTier = tiers.find(t => t.size === chartSize) ?? tiers[tiers.length - 1];
  const chartRows = useMemo(() => {
    if (!chartTier) return [];
    const len = chartTier.curves['QPSO']?.length ?? 0;
    return Array.from({ length: len }, (_, i) => {
      const row: Record<string, number> = { iteration: i };
      METAHEURISTICS.forEach(a => { row[a.key] = chartTier.curves[a.key]?.[i]; });
      return row;
    });
  }, [chartTier]);

  const Chip: React.FC<{ algo: AlgoKey }> = ({ algo }) => (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2.5 h-2.5 rounded-sm shrink-0"
        style={{ backgroundColor: algoColor(algo, isDark), outline: algo === 'Greedy NN' ? `1px dashed ${algoColor(algo, isDark)}` : undefined }}
      />
      <span>{ALGOS.find(a => a.key === algo)?.short ?? algo}</span>
    </span>
  );

  const SectionTitle: React.FC<{ n: string; title: string; sub: string; icon: React.ReactNode }> = ({ n, title, sub, icon }) => (
    <div className={`px-5 py-4 border-b flex items-start gap-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Study {n}</div>
        <h3 className={`font-heading font-bold text-base ${ink}`}>{title}</h3>
        <p className={`text-xs mt-0.5 ${muted}`}>{sub}</p>
      </div>
    </div>
  );

  const generated = new Date(data.meta.generated_at);

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className={`rounded-2xl border p-6 ${card}`}>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white shadow-md">
            <BarChart2 size={24} />
          </div>
          <div className="min-w-0">
            <h2 className={`text-xl sm:text-2xl font-bold font-heading ${ink}`}>Benchmark results: QPSO vs PSO, GA and SA</h2>
            <p className={`text-sm mt-1 max-w-3xl ${ink2}`}>
              Recorded test results. Every algorithm solved the same problems with the same seeds, population
              ({data.meta.population}), iteration budget and route polishing. {seedCount} seeds per setting, 2 traffic conditions.
            </p>
            <p className={`text-[11px] mt-1.5 font-mono flex flex-wrap items-center gap-x-1.5 break-all ${muted}`}>
              <FileCode2 size={12} />
              Generated by <span className={ink2}>{data.meta.command}</span> on {generated.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Where QPSO is strongest ---------- */}
      <div>
        <h3 className={`font-heading font-bold text-base mb-3 ${ink}`}>Where QPSO is strongest</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {zoneRow && (
            <div className={`rounded-2xl border p-5 ${card}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Orders split into zones</div>
              <div className={`text-4xl font-black font-heading mt-2 ${ink}`}>
                {zoneRow.wins['QPSO']}<span className={`text-xl font-bold ${muted}`}> / {zoneRow.runs}</span>
              </div>
              <div className={`text-xs mt-1 ${ink2}`}>runs where QPSO found the lowest cost, 100 to 500 stops solved as ~20-stop zones</div>
            </div>
          )}
          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Small orders (20 stops)</div>
            <div className={`text-4xl font-black font-heading mt-2 ${ink}`}>
              {smallRow.wins['QPSO']}<span className={`text-xl font-bold ${muted}`}> / {smallRow.runs}</span>
            </div>
            <div className={`text-xs mt-1 ${ink2}`}>runs where QPSO found the lowest cost of the four optimizers</div>
          </div>
          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Distance from the true optimum</div>
            <div className={`text-4xl font-black font-heading mt-2 ${ink}`}>
              {qpsoGap.toFixed(1)}<span className={`text-xl font-bold ${muted}`}>%</span>
            </div>
            <div className={`text-xs mt-1 ${ink2}`}>QPSO's average gap on 6–8 stop problems solved exactly; optimal in {qpsoHits} of {exactRuns}</div>
          </div>
        </div>
      </div>

      {/* ---------- Who wins where ---------- */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <div className={`px-5 py-4 border-b flex flex-col md:flex-row md:items-end justify-between gap-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h3 className={`font-heading font-bold text-base ${ink}`}>Who finds the lowest cost, by situation</h3>
            <p className={`text-xs mt-0.5 ${muted}`}>
              Share of runs each algorithm won (lowest route cost). Optimizers compared on their own, before the shared route polish,
              except the re-routing row, which compares final routes.
            </p>
          </div>
          <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${ink2}`}>
            {METAHEURISTICS.map(a => <Chip key={a.key} algo={a.key} />)}
          </div>
        </div>
        <div className={`divide-y ${divide}`}>
          {scoreRows.map(r => {
            const total = METAHEURISTICS.reduce((sum, a) => sum + (r.wins[a.key] ?? 0), 0) || 1;
            const top = leader(r);
            return (
              <div key={r.label} className="px-5 py-4 grid grid-cols-1 md:grid-cols-[210px_1fr_170px] gap-x-6 gap-y-2 items-center">
                <div>
                  <div className={`text-sm font-bold ${ink}`}>{r.label}</div>
                  <div className={`text-[11px] ${muted}`}>{r.sub}</div>
                </div>
                <div>
                  <div className="flex gap-[2px] h-3.5">
                    {METAHEURISTICS.filter(a => (r.wins[a.key] ?? 0) > 0).map(a => (
                      <div
                        key={a.key}
                        title={`${a.short}: lowest cost in ${r.wins[a.key]} of ${r.runs} runs`}
                        className="h-full rounded first:rounded-l last:rounded-r"
                        style={{ width: `${(r.wins[a.key] / total) * 100}%`, backgroundColor: algoColor(a.key, isDark), borderRadius: 4 }}
                      />
                    ))}
                  </div>
                  <div className={`mt-1.5 flex flex-wrap gap-x-3 text-[11px] font-mono ${muted}`}>
                    {METAHEURISTICS.map(a => (
                      <span key={a.key} className={a.key === top ? `font-bold ${ink}` : ''}>{a.short} {r.wins[a.key] ?? 0}</span>
                    ))}
                  </div>
                </div>
                <div className="md:text-right">
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Most wins</div>
                  <div className={`text-sm font-bold ${ink}`}>
                    <Chip algo={top as AlgoKey} /> <span className={`font-mono font-normal ${muted}`}>{r.wins[top]}/{r.runs}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className={`px-5 py-3 text-xs border-t ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'} ${ink2}`}>
          <span className="font-bold">In short:</span>{' '}
          QPSO leads in {qpsoLeads.length ? qpsoLeads.map(r => r.label.toLowerCase()).join(', ') : 'none of these situations'}.
          {METAHEURISTICS.filter(a => a.key !== 'QPSO' && othersLead.some(r => leader(r) === a.key)).map(a => (
            <span key={a.key}> {a.short} leads in {othersLead.filter(r => leader(r) === a.key).map(r => r.label.toLowerCase()).join(', ')}.</span>
          ))}
          {' '}Ties count for every tied algorithm.
        </div>
      </div>

      {/* ---------- Full results (collapsed) ---------- */}
      <details className={`group rounded-2xl border ${card}`}>
        <summary className={`cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 ${ink}`}>
          <span>
            <span className="font-heading font-bold text-base">Full results</span>
            <span className={`block text-xs ${muted}`}>Every table behind the summary above: mean costs, convergence curves, exact-optimum gaps and more</span>
          </span>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'}`}>
            <span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span>
          </span>
        </summary>
        <div className={`p-5 pt-2 space-y-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className={`flex p-1 rounded-xl border text-xs w-fit ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
            {(['congested', 'clear'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCondition(c)}
                className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                  condition === c
                    ? (isDark ? 'bg-slate-800 text-white shadow' : 'bg-white text-slate-900 shadow')
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                {c === 'congested' ? <Flame size={13} className="text-rose-500" /> : <CheckCircle size={13} className="text-emerald-500" />}
                <span>{c === 'congested' ? 'Congested traffic' : 'Clear traffic'}</span>
              </button>
            ))}
          </div>

      {/* ---------- Study 1: optimizer alone ---------- */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <SectionTitle
          n="1"
          icon={<Swords size={17} />}
          title="Optimizer study: search quality and convergence"
          sub="Random initial population, no local search. Mean ± std of the search objective over all seeds (lower is better). This isolates the optimizer itself."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className={`border-b text-[10px] uppercase tracking-wider ${headRow}`}>
              <tr>
                <th className="py-3 px-4 text-left">Problem size</th>
                {METAHEURISTICS.map(a => (
                  <th key={a.key} className="py-3 px-3 text-right"><Chip algo={a.key} /></th>
                ))}
                <th className="py-3 px-4 text-right">QPSO vs PSO</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${divide}`}>
              {tiers.map(t => (
                <tr key={t.size}>
                  <td className="py-3 px-4">
                    <div className={`font-bold ${ink}`}>{t.size} stops</div>
                    <div className={`text-[11px] ${muted}`}>{t.riders} vans · {t.iterations} iterations</div>
                  </td>
                  {METAHEURISTICS.map(a => {
                    const s = t.search[a.key];
                    const best = isBest(s.cost_mean, METAHEURISTICS.map(m => t.search[m.key].cost_mean));
                    return (
                      <td key={a.key} className={`py-3 px-3 text-right font-mono ${best ? bestCell : ''}`}>
                        <div className={`${best ? 'font-bold' : ''} ${ink}`}>{fmt(s.cost_mean)}</div>
                        <div className={`text-[10px] ${muted}`}>± {fmt(s.cost_std)}</div>
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right">
                    <div className={`font-mono font-bold ${t.qpso_vs_pso.search_diff_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {t.qpso_vs_pso.search_diff_pct >= 0 ? '−' : '+'}{Math.abs(t.qpso_vs_pso.search_diff_pct).toFixed(1)}% cost
                    </div>
                    <div className={`text-[10px] ${muted}`}>QPSO lower in {t.qpso_vs_pso.search_wins}/{t.qpso_vs_pso.seeds} seeds</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Convergence chart */}
        <div className={`border-t p-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h4 className={`font-heading font-bold text-sm ${ink}`}>Mean convergence curve · {chartTier?.size} stops</h4>
              <p className={`text-[11px] ${muted}`}>Best search cost per iteration, averaged over {data.meta.seeds.length} seeds</p>
            </div>
            <div className={`flex p-1 rounded-lg border text-[11px] ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              {tiers.map(t => (
                <button
                  key={t.size}
                  onClick={() => setChartSize(t.size)}
                  className={`px-2.5 py-1 rounded-md font-bold ${chartTier?.size === t.size
                    ? (isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 shadow-sm')
                    : muted}`}
                >
                  {t.size}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3 text-xs">
            {METAHEURISTICS.map(a => {
              const s = chartTier?.search[a.key];
              return (
                <div key={a.key} className={`flex items-center gap-2 ${ink2}`}>
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: algoColor(a.key, isDark), height: 2 }} />
                  <span className="font-semibold">{a.short}</span>
                  <span className={`font-mono ${muted}`}>{s ? `${fmtK(s.cost_mean)} · 1% in ${fmt(s.iters_to_1pct)} it` : ''}</span>
                </div>
              );
            })}
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={isDark ? '#1E293B' : '#E2E8F0'} vertical={false} />
                <XAxis
                  dataKey="iteration"
                  tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }}
                  axisLine={{ stroke: isDark ? '#334155' : '#CBD5E1' }}
                  tickLine={false}
                  label={{ value: 'Iteration', position: 'insideBottomRight', offset: -2, fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }}
                />
                <YAxis
                  tickFormatter={fmtK}
                  tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                    borderRadius: 10,
                    fontSize: 12
                  }}
                  labelStyle={{ color: isDark ? '#E2E8F0' : '#0F172A', fontWeight: 700 }}
                  itemStyle={{ color: isDark ? '#CBD5E1' : '#334155' }}
                  labelFormatter={(l: any) => `Iteration ${l}`}
                  formatter={(v: any, name: any) => [fmt(Number(v)), name]}
                />
                {METAHEURISTICS.map(a => (
                  <Line
                    key={a.key}
                    type="monotone"
                    dataKey={a.key}
                    name={a.short}
                    stroke={algoColor(a.key, isDark)}
                    strokeWidth={a.key === 'QPSO' ? 2.5 : 2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: isDark ? '#0F172A' : '#FFFFFF' }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ---------- Study 3: full pipeline ---------- */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <SectionTitle
          n="3"
          icon={<TrendingDown size={17} />}
          title="Full routing pipeline vs Greedy baseline"
          sub="What the app ships: each population is seeded with the greedy tour, then every result gets the same 2-opt + relocate polish. Mean final route cost (lower is better) and measured on-time rate."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className={`border-b text-[10px] uppercase tracking-wider ${headRow}`}>
              <tr>
                <th className="py-3 px-4 text-left">Problem size</th>
                {ALGOS.map(a => (
                  <th key={a.key} className="py-3 px-3 text-right"><Chip algo={a.key} /></th>
                ))}
                <th className="py-3 px-4 text-right">Seeds won</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${divide}`}>
              {tiers.map(t => (
                <tr key={t.size}>
                  <td className="py-3 px-4">
                    <div className={`font-bold ${ink}`}>{t.size} stops</div>
                    <div className={`text-[11px] ${muted}`}>{t.riders} vans · {t.capacity_kg} kg each</div>
                  </td>
                  {ALGOS.map(a => {
                    const s = t.pipeline[a.key];
                    const best = isBest(s.cost_mean, ALGOS.map(m => t.pipeline[m.key].cost_mean));
                    return (
                      <td key={a.key} className={`py-3 px-3 text-right font-mono ${best ? bestCell : ''}`}>
                        <div className={`${best ? 'font-bold' : ''} ${ink}`}>{fmt(s.cost_mean)}</div>
                        <div className={`text-[10px] ${muted}`}>{s.on_time_pct.toFixed(0)}% on time</div>
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-wrap justify-end gap-x-2.5 gap-y-0.5 max-w-[150px] ml-auto">
                      {ALGOS.filter(a => t.pipeline[a.key].wins > 0)
                        .sort((x, y) => t.pipeline[y.key].wins - t.pipeline[x.key].wins)
                        .map(a => (
                          <span key={a.key} className={`text-[10px] ${ink2}`}><Chip algo={a.key} /> <span className="font-mono">{t.pipeline[a.key].wins}</span></span>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`px-5 py-3 text-[11px] border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} ${muted}`}>
          Shaded cells = lowest mean cost for that size (ties are all shaded; equal to Greedy means the search kept its greedy starting tour).
          Seeds won counts every algorithm tied for the lowest cost on a seed, so the totals can exceed the seed count.
        </p>
      </div>

      {/* ---------- Study 4: exact optimum ---------- */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <SectionTitle
          n="4"
          icon={<Target size={17} />}
          title="Accuracy against the proven optimum (small instances)"
          sub="Exhaustive search over every ordering and every split into 2 vans, under exactly the same cost model. Gap = how far above the optimum each method finishes (0% = optimal)."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className={`border-b text-[10px] uppercase tracking-wider ${headRow}`}>
              <tr>
                <th className="py-3 px-4 text-left">Instance</th>
                {ALGOS.map(a => (
                  <th key={a.key} className="py-3 px-3 text-right"><Chip algo={a.key} /></th>
                ))}
                <th className="py-3 px-4 text-right">Exact solve time</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${divide}`}>
              {data.exact.map(r => {
                const bestGap = Math.min(...ALGOS.map(a => r.algos[a.key].gap_mean));
                return (
                  <tr key={r.size}>
                    <td className="py-3 px-4">
                      <div className={`font-bold ${ink}`}>{r.size} stops</div>
                      <div className={`text-[11px] ${muted}`}>{r.seeds} seeds · 2 vans</div>
                    </td>
                    {ALGOS.map(a => {
                      const g = r.algos[a.key];
                      const best = g.gap_mean <= bestGap + 1e-9;
                      return (
                        <td key={a.key} className={`py-3 px-3 text-right font-mono ${best ? bestCell : ''}`}>
                          <div className={`${best ? 'font-bold' : ''} ${ink}`}>{g.gap_mean.toFixed(2)}%</div>
                          <div className={`text-[10px] ${muted}`}>optimal {g.optimal_hits}/{r.seeds}</div>
                        </td>
                      );
                    })}
                    <td className={`py-3 px-4 text-right font-mono ${ink2}`}>{fmt(r.exact_ms_mean)} ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Real-time dispatch conditions ---------- */}
      {(tiers[0]?.anytime || data.zones || data.delhi_scenario.reroute_anytime) && (
        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-sky-950/20 border-sky-900/60' : 'bg-sky-50/60 border-sky-200'}`}>
          <h3 className={`font-heading font-bold text-base ${ink}`}>Real-time dispatch conditions</h3>
          <p className={`text-xs mt-1 max-w-4xl ${ink2}`}>
            Three studies aimed at live dispatch, where a plan is needed quickly, work is split into zones and routes are
            repaired after incidents. These conditions were fixed before running, every method runs under the same rules, and
            the results are shown whichever method wins.
          </p>
        </div>
      )}

      {tiers[0]?.anytime && (
        <div className={`rounded-2xl border overflow-hidden ${card}`}>
          <SectionTitle
            n="5"
            icon={<TrendingDown size={17} />}
            title="Tight time budget: quality after only a few iterations"
            sub="From the optimizer study. The % above the best final cost any method reached on that seed, measured at a checkpoint (0% = already as good as the best final answer). Lower is better."
          />
          <div className={`px-5 pt-4 flex flex-wrap items-center gap-3 text-[11px] ${muted}`}>
            <span>Checkpoint</span>
            <div className={`flex p-1 rounded-lg border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              {CHECKPOINTS.map(c => (
                <button
                  key={c}
                  onClick={() => setCheckpoint(c)}
                  className={`px-2.5 py-1 rounded-md font-bold ${checkpoint === c
                    ? (isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 shadow-sm')
                    : muted}`}
                >
                  {checkpointLabel(c)}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead className={`border-y text-[10px] uppercase tracking-wider ${headRow}`}>
                <tr>
                  <th className="py-3 px-4 text-left">Problem size</th>
                  {METAHEURISTICS.map(a => (
                    <th key={a.key} className="py-3 px-3 text-right"><Chip algo={a.key} /></th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${divide}`}>
                {tiers.map(t => {
                  const row = t.anytime?.[checkpoint];
                  if (!row) return null;
                  const gaps = METAHEURISTICS.map(m => row[m.key].gap_mean);
                  return (
                    <tr key={t.size}>
                      <td className="py-3 px-4">
                        <div className={`font-bold ${ink}`}>{t.size} stops</div>
                        <div className={`text-[11px] ${muted}`}>{t.iterations} iterations in total</div>
                      </td>
                      {METAHEURISTICS.map(a => {
                        const g = row[a.key];
                        const best = isBest(g.gap_mean, gaps);
                        return (
                          <td key={a.key} className={`py-3 px-3 text-right font-mono ${best ? bestCell : ''}`}>
                            <div className={`${best ? 'font-bold' : ''} ${ink}`}>+{g.gap_mean.toFixed(1)}%</div>
                            <div className={`text-[10px] ${muted}`}>lowest in {g.wins}/{data.meta.seeds.length}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.zones && (
        <div className={`rounded-2xl border overflow-hidden ${card}`}>
          <SectionTitle
            n="6"
            icon={<MapPin size={17} />}
            title="Zone dispatch: large orders split into ~20-stop zones"
            sub="Stops are grouped by direction from the depot and the vans are shared out in proportion. Every method solves every zone with the 20-stop budget, and the zone costs are added up. Mean total cost (lower is better)."
          />
          <div className={`px-5 pt-4 flex flex-wrap items-center gap-3 text-[11px] ${muted}`}>
            <span>Measure</span>
            <div className={`flex p-1 rounded-lg border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              {([['search', 'Optimizer alone'], ['final', 'Full pipeline']] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setZoneMode(m)}
                  className={`px-2.5 py-1 rounded-md font-bold ${zoneMode === m
                    ? (isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 shadow-sm')
                    : muted}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead className={`border-y text-[10px] uppercase tracking-wider ${headRow}`}>
                <tr>
                  <th className="py-3 px-4 text-left">Order size</th>
                  {(zoneMode === 'search' ? METAHEURISTICS : ALGOS).map(a => (
                    <th key={a.key} className="py-3 px-3 text-right"><Chip algo={a.key} /></th>
                  ))}
                  <th className="py-3 px-4 text-right">Unsplit, best method</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${divide}`}>
                {data.zones[condition].map(z => {
                  const algos = zoneMode === 'search' ? METAHEURISTICS : ALGOS;
                  const stats = z[zoneMode] as Record<string, { cost_mean: number; wins: number; on_time_pct?: number }>;
                  const costs = algos.map(m => stats[m.key].cost_mean);
                  const whole = tiers.find(t => t.size === z.size);
                  const wholeBest = whole
                    ? Math.min(...(zoneMode === 'search'
                      ? METAHEURISTICS.map(m => whole.search[m.key].cost_mean)
                      : ALGOS.map(m => whole.pipeline[m.key].cost_mean)))
                    : NaN;
                  return (
                    <tr key={z.size}>
                      <td className="py-3 px-4">
                        <div className={`font-bold ${ink}`}>{z.size} stops</div>
                        <div className={`text-[11px] ${muted}`}>{z.zones} zones · {z.riders} vans</div>
                      </td>
                      {algos.map(a => {
                        const s = stats[a.key];
                        const best = isBest(s.cost_mean, costs);
                        return (
                          <td key={a.key} className={`py-3 px-3 text-right font-mono ${best ? bestCell : ''}`}>
                            <div className={`${best ? 'font-bold' : ''} ${ink}`}>{fmt(s.cost_mean)}</div>
                            <div className={`text-[10px] ${muted}`}>
                              lowest in {s.wins}/{data.meta.seeds.length}{s.on_time_pct !== undefined ? ` · ${s.on_time_pct.toFixed(0)}% on time` : ''}
                            </div>
                          </td>
                        );
                      })}
                      <td className={`py-3 px-4 text-right font-mono ${muted}`}>{fmt(wholeBest)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={`px-5 py-3 text-[11px] border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} ${muted}`}>
            The last column is the lowest mean cost from studies 1 and 3, where the same orders were solved without splitting.
            Where it is lower, splitting into zones costs more in total. This study compares the methods on zone-sized
            problems; it does not show that splitting orders is the cheaper plan.
          </p>
        </div>
      )}

      {data.delhi_scenario.reroute_anytime && (
        <div className={`rounded-2xl border overflow-hidden ${card}`}>
          <SectionTitle
            n="7"
            icon={<Flame size={17} />}
            title="Re-routing speed after traffic incidents (Delhi Okhla)"
            sub={`The warm-started re-optimisation from the Home page walkthrough, on all ${data.delhi_scenario.seeds_tested} seeds. The % above the best re-routed cost of that seed, at each checkpoint. This is the search cost, measured before the final 2-opt polish. Lower is better.`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className={`border-b text-[10px] uppercase tracking-wider ${headRow}`}>
                <tr>
                  <th className="py-3 px-4 text-left">Checkpoint</th>
                  {METAHEURISTICS.map(a => (
                    <th key={a.key} className="py-3 px-3 text-right"><Chip algo={a.key} /></th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${divide}`}>
                {CHECKPOINTS.map(c => {
                  const row = data.delhi_scenario.reroute_anytime![c];
                  if (!row) return null;
                  const gaps = METAHEURISTICS.map(m => row[m.key].gap_mean);
                  return (
                    <tr key={c}>
                      <td className={`py-3 px-4 font-bold ${ink}`}>{checkpointLabel(c)}</td>
                      {METAHEURISTICS.map(a => {
                        const g = row[a.key];
                        const best = isBest(g.gap_mean, gaps);
                        return (
                          <td key={a.key} className={`py-3 px-3 text-right font-mono ${best ? bestCell : ''}`}>
                            <div className={`${best ? 'font-bold' : ''} ${ink}`}>+{g.gap_mean.toFixed(1)}%</div>
                            <div className={`text-[10px] ${muted}`}>lowest in {g.wins}/{data.delhi_scenario.seeds_tested}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Delhi scenarios ---------- */}
        <div className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={15} className="text-amber-500" />
            <h3 className={`font-heading font-bold text-sm ${ink}`}>Delhi Okhla re-routing scenarios</h3>
          </div>
          <p className={`text-xs mb-4 ${muted}`}>
            The Home page walkthrough (40 stops, 6 vans, 2 traffic incidents, warm-started re-optimisation) replayed on
            {' '}{data.delhi_scenario.seeds_tested} seeds. Lowest post-incident cost per seed:
          </p>
          <div className="space-y-2">
            {ALGOS.map(a => {
              const n = data.delhi_scenario.reroute_winner_counts[a.key] ?? 0;
              return (
                <div key={a.key} className={`flex items-center gap-3 text-xs ${ink2}`}>
                  <span className="w-16"><Chip algo={a.key} /></span>
                  <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full" style={{ width: `${(n / data.delhi_scenario.seeds_tested) * 100}%`, backgroundColor: algoColor(a.key, isDark) }} />
                  </div>
                  <span className="font-mono w-12 text-right">{n}/{data.delhi_scenario.seeds_tested}</span>
                </div>
              );
            })}
          </div>
          <p className={`text-[11px] mt-3 ${muted}`}>
            The Home page shows seed {data.delhi_scenario.seed} as a worked example
            {data.delhi_scenario.selection_rule ? `, the ${data.delhi_scenario.selection_rule}` : ''}
            {data.delhi_scenario.qpso_wins_both !== undefined ? ` (QPSO is lowest in both in ${data.delhi_scenario.qpso_wins_both} of ${data.delhi_scenario.seeds_tested} seeds)` : ''}.
          </p>
        </div>

      {/* ---------- Method ---------- */}
      <div className={`rounded-2xl border p-5 text-xs leading-relaxed ${card} ${ink2}`}>
        <div className={`font-heading font-bold text-sm mb-2 ${ink}`}>Method</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Objective: {data.meta.objective}.</li>
          <li>Instances: synthetic city road graph, fleet = {data.meta.riders_rule} vans of {data.meta.capacity_kg} kg; congested runs add road incidents (≈5× travel time) before optimising.</li>
          <li>Budget: population {data.meta.population} for QPSO, PSO and GA; SA makes the same number of evaluations per iteration. Iterations = {data.meta.iterations_rule}.</li>
          <li>Standard settings: QPSO contraction–expansion α 1.0 → 0.5; PSO inertia 0.9 → 0.4 with c₁ = c₂ = 2.0; GA tournament + BLX-α + Gaussian mutation; SA exponential cooling with 3 restarts.</li>
          <li>Convergence speed = iterations until the best cost is within 1% of its final value. Seeds: {data.meta.seeds[0]}–{data.meta.seeds[data.meta.seeds.length - 1]}.</li>
        </ul>
      </div>
        </div>
      </details>
    </div>
  );
};
