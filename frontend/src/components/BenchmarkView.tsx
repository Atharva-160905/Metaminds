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
  Play,
  Loader2,
  Target,
  Swords,
  TrendingDown,
  Info,
  CheckCircle2,
  MinusCircle,
  XCircle,
  MapPin,
  FileCode2
} from 'lucide-react';
import { api } from '../services/api';
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
}
interface ExactRow { size: number; seeds: number; exact_ms_mean: number; algos: Record<string, { gap_mean: number; gap_max: number; optimal_hits: number }>; }
interface BenchmarkFile {
  meta: { generated_at: string; seeds: number[]; population: number; iterations_rule: string; riders_rule: string; capacity_kg: number; objective: string; command: string; runtime_s?: number };
  conditions: { congested: Tier[]; clear: Tier[] };
  exact: ExactRow[];
  delhi_scenario: { seed?: number; seeds_tested: number; reroute_winner_counts: Record<string, number> };
}

const data = benchmarkData as BenchmarkFile;

const fmt = (n: number, digits = 0) =>
  Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const fmtK = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `${Math.round(n)}`);

// Lowest value, counting exact ties (e.g. a swarm that kept the greedy start) as shared bests
const isBest = (v: number, all: number[]) => v <= Math.min(...all) * (1 + 1e-6) + 1e-9;

type Verdict = 'holds' | 'mixed' | 'no';
const verdictFor = (t: Tier): Verdict => {
  const h = t.qpso_vs_pso;
  if (h.search_diff_pct > 0 && h.search_wins >= Math.ceil(h.seeds * 0.6)) return 'holds';
  if (h.search_diff_pct < 0 && h.search_wins <= Math.floor(h.seeds * 0.4)) return 'no';
  return 'mixed';
};

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
  const [live, setLive] = useState<any[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

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
  const totalRuns = allTiers.reduce((s, t) => s + t.qpso_vs_pso.seeds, 0);
  const searchWins = allTiers.reduce((s, t) => s + t.qpso_vs_pso.search_wins, 0);
  const finalWins = allTiers.reduce((s, t) => s + t.qpso_vs_pso.final_wins, 0);
  const qpsoExact = data.exact.map(r => r.algos['QPSO']);
  const qpsoGap = qpsoExact.reduce((s, a) => s + a.gap_mean, 0) / Math.max(1, qpsoExact.length);
  const qpsoHits = qpsoExact.reduce((s, a) => s + a.optimal_hits, 0);
  const exactRuns = data.exact.reduce((s, r) => s + r.seeds, 0);
  const searchBestCounts = METAHEURISTICS.map(a => ({
    key: a.key,
    n: allTiers.filter(t => t.search_best === a.key).length
  })).sort((x, y) => y.n - x.n);

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

  const handleLiveRun = async () => {
    setIsRunning(true);
    setLiveError(null);
    try {
      const resp = await api.runBenchmark([20, 50], condition);
      setLive(resp.benchmark_results ?? []);
    } catch (err: any) {
      setLiveError('Backend not reachable — start the FastAPI server to run a live spot-check.');
    } finally {
      setIsRunning(false);
    }
  };

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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white shadow-md">
              <BarChart2 size={24} />
            </div>
            <div>
              <h2 className={`text-xl sm:text-2xl font-bold font-heading ${ink}`}>Benchmark Study: QPSO vs Classical Metaheuristics</h2>
              <p className={`text-sm mt-1 max-w-3xl ${ink2}`}>
                {data.meta.seeds.length} seeds × {tiers.length} problem sizes × 2 traffic conditions. Every algorithm gets the same instances,
                population ({data.meta.population}), iteration budget, decoder and local search.
              </p>
              <p className={`text-[11px] mt-1.5 font-mono flex items-center gap-1.5 ${muted}`}>
                <FileCode2 size={12} />
                Generated by <span className={ink2}>{data.meta.command}</span> on {generated.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className={`flex p-1 rounded-xl border text-xs self-start lg:self-auto ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
            {(['congested', 'clear'] as const).map(c => (
              <button
                key={c}
                onClick={() => { setCondition(c); setLive(null); }}
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
        </div>
      </div>

      {/* ---------- Headline tiles ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`rounded-2xl border p-5 ${card}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${muted}`}><Swords size={13} /> QPSO vs PSO · optimizer alone</div>
          <div className={`text-3xl font-black font-heading mt-2 ${ink}`}>{searchWins}<span className={`text-lg font-bold ${muted}`}> / {totalRuns}</span></div>
          <div className={`text-xs mt-1 ${ink2}`}>runs where QPSO reached a lower cost than classical PSO</div>
        </div>
        <div className={`rounded-2xl border p-5 ${card}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${muted}`}><Swords size={13} /> QPSO vs PSO · full pipeline</div>
          <div className={`text-3xl font-black font-heading mt-2 ${ink}`}>{finalWins}<span className={`text-lg font-bold ${muted}`}> / {totalRuns}</span></div>
          <div className={`text-xs mt-1 ${ink2}`}>runs with strictly lower final route cost (ties excluded)</div>
        </div>
        <div className={`rounded-2xl border p-5 ${card}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${muted}`}><Target size={13} /> Gap to proven optimum</div>
          <div className={`text-3xl font-black font-heading mt-2 ${ink}`}>{qpsoGap.toFixed(2)}<span className={`text-lg font-bold ${muted}`}>%</span></div>
          <div className={`text-xs mt-1 ${ink2}`}>QPSO mean gap on 6–8 stop instances · optimum found in {qpsoHits}/{exactRuns}</div>
        </div>
        <div className={`rounded-2xl border p-5 ${card}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${muted}`}><TrendingDown size={13} /> Best optimizer per setting</div>
          <div className="mt-2.5 space-y-1.5">
            {searchBestCounts.map(({ key, n }) => (
              <div key={key} className={`flex items-center gap-2 text-xs ${ink2}`}>
                <span className="w-14"><Chip algo={key} /></span>
                <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div className="h-full rounded-full" style={{ width: `${(n / allTiers.length) * 100}%`, backgroundColor: algoColor(key, isDark) }} />
                </div>
                <span className="font-mono w-10 text-right">{n}/{allTiers.length}</span>
              </div>
            ))}
          </div>
        </div>
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

      {/* ---------- Where the advantage holds ---------- */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <SectionTitle
          n="2"
          icon={<Info size={17} />}
          title="Where QPSO's advantage over classical PSO holds, and where it doesn't"
          sub="Holds: QPSO has lower mean cost and wins at least 60% of seeds. Doesn't hold: PSO has lower mean cost and QPSO wins at most 40%. Otherwise mixed."
        />
        <div className="grid grid-cols-1 md:grid-cols-2">
          {(['congested', 'clear'] as const).map((c, ci) => (
            <div key={c} className={`p-5 ${ci === 0 ? (isDark ? 'md:border-r border-slate-800' : 'md:border-r border-slate-200') : ''}`}>
              <div className={`text-xs font-bold mb-3 flex items-center gap-1.5 ${ink}`}>
                {c === 'congested' ? <Flame size={13} className="text-rose-500" /> : <CheckCircle size={13} className="text-emerald-500" />}
                {c === 'congested' ? 'Congested traffic' : 'Clear traffic'}
              </div>
              <div className="space-y-2">
                {data.conditions[c].map(t => {
                  const v = verdictFor(t);
                  const Icon = v === 'holds' ? CheckCircle2 : v === 'no' ? XCircle : MinusCircle;
                  const tone = v === 'holds'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : v === 'no' ? 'text-rose-600 dark:text-rose-400' : (isDark ? 'text-slate-400' : 'text-slate-500');
                  return (
                    <div key={t.size} className={`flex items-center gap-3 text-xs rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                      <Icon size={15} className={`${tone} shrink-0`} />
                      <span className={`w-20 font-semibold ${ink}`}>{t.size} stops</span>
                      <span className={`font-semibold w-24 ${tone}`}>{v === 'holds' ? 'Holds' : v === 'no' ? "Doesn't hold" : 'Mixed'}</span>
                      <span className={`font-mono ${muted}`}>
                        {t.qpso_vs_pso.search_diff_pct >= 0 ? '−' : '+'}{Math.abs(t.qpso_vs_pso.search_diff_pct).toFixed(1)}% · {t.qpso_vs_pso.search_wins}/{t.qpso_vs_pso.seeds} seeds
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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

      {/* ---------- Delhi scenarios + live spot-check ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <p className={`text-[11px] mt-3 ${muted}`}>The Home page shows one of these seeds (seed {data.delhi_scenario.seed}) as a worked example.</p>
        </div>

        <div className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <Play size={14} className="text-sky-600" />
              <h3 className={`font-heading font-bold text-sm ${ink}`}>Live spot-check</h3>
            </div>
            <button
              onClick={handleLiveRun}
              disabled={isRunning}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-60 flex items-center gap-2"
            >
              {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={12} className="fill-white" />}
              <span>{isRunning ? 'Running…' : 'Run on backend now'}</span>
            </button>
          </div>
          <p className={`text-xs mb-3 ${muted}`}>
            Runs all 5 algorithms once (single seed) on 20 and 50 stops with the live API. Single runs vary; the study above averages {data.meta.seeds.length} seeds.
          </p>
          {liveError && <p className="text-xs text-rose-600 dark:text-rose-400">{liveError}</p>}
          {live && (
            <table className="w-full text-xs">
              <thead className={`border-b text-[10px] uppercase tracking-wider ${headRow}`}>
                <tr>
                  <th className="py-2 px-2 text-left">Size</th>
                  {ALGOS.map(a => <th key={a.key} className="py-2 px-2 text-right"><Chip algo={a.key} /></th>)}
                </tr>
              </thead>
              <tbody className={`divide-y ${divide}`}>
                {live.map((r: any) => {
                  const vals: Record<string, number> = { QPSO: r.qpso_cost, PSO: r.pso_cost, GA: r.ga_cost, SA: r.sa_cost, 'Greedy NN': r.greedy_cost };
                  const min = Math.min(...Object.values(vals));
                  return (
                    <tr key={r.size}>
                      <td className={`py-2 px-2 font-bold ${ink}`}>{r.size}</td>
                      {ALGOS.map(a => (
                        <td key={a.key} className={`py-2 px-2 text-right font-mono ${vals[a.key] <= min + 1e-6 ? `${bestCell} font-bold` : ''} ${ink}`}>
                          {fmt(vals[a.key])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
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
  );
};
