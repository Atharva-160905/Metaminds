import React, { useState, useEffect } from 'react';
import { BenchmarkResponse } from '../types';
import { api } from '../services/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { BarChart2, Play, RefreshCw, Award, CheckCircle, Info, TrendingUp, Clock, Zap, Layers } from 'lucide-react';

interface BenchmarkViewProps {
  benchmarkData: BenchmarkResponse | null;
  setBenchmarkData: (data: BenchmarkResponse) => void;
  onLogEvent: (title: string, desc: string, type: any) => void;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({
  benchmarkData,
  setBenchmarkData,
  onLogEvent,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [trafficCondition, setTrafficCondition] = useState<'congested' | 'clear'>('congested');

  // Auto-run benchmark on first view if no data exists yet
  useEffect(() => {
    if (!benchmarkData && !isRunning) {
      handleRunBenchmark('congested');
    }
  }, []);

  const handleRunBenchmark = async (condition: 'congested' | 'clear' = trafficCondition) => {
    setIsRunning(true);
    setTrafficCondition(condition);
    onLogEvent(
      'Benchmark Started',
      `Running multi-scale evaluation across 20-500 deliveries (${condition === 'congested' ? 'Heavy Traffic Incidents' : 'Clear Road Baseline'})...`,
      'info'
    );
    try {
      const res = await api.runBenchmark([20, 50, 100, 250, 500], condition);
      setBenchmarkData(res);
      onLogEvent(
        'Benchmark Completed',
        `Evaluated ${res.benchmark_results.length} problem scales under ${condition.toUpperCase()} network. QPSO wins: ${res.summary.qpso_wins}, PSO wins: ${res.summary.pso_wins}`,
        'success'
      );
    } catch (err: any) {
      console.error(err);
      onLogEvent('Benchmark Error', err.message || 'Failed to complete benchmark', 'traffic');
    } finally {
      setIsRunning(false);
    }
  };

  const results = benchmarkData?.benchmark_results || [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <BarChart2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-heading">
                Multi-Scale Empirical Benchmark Suite
              </h2>
              <p className="text-xs text-slate-500">
                Comparative evaluation across 20, 50, 100, 250, and 500 delivery stops under different road conditions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Traffic Condition Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => handleRunBenchmark('congested')}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                trafficCondition === 'congested'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-200 animate-pulse"></span>
              <span>Congested (With Traffic)</span>
            </button>
            <button
              onClick={() => handleRunBenchmark('clear')}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                trafficCondition === 'clear'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
              <span>Clear Road Baseline</span>
            </button>
          </div>

          <button
            onClick={() => handleRunBenchmark(trafficCondition)}
            disabled={isRunning}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw size={14} className="animate-spin text-emerald-400" />
                <span>Evaluating 5 Scales (20-500)...</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-emerald-400 text-emerald-400" />
                <span>Re-Run Benchmark</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Overlay State if initial run is executing */}
      {isRunning && results.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <RefreshCw size={40} className="animate-spin text-emerald-500 mb-4" />
          <h3 className="text-base font-bold text-slate-900 font-heading">Running Empirical Benchmark Suite</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Solving real VRP graphs for 20, 50, 100, 250, and 500 delivery nodes with both QPSO and Classical PSO swarms...
          </p>
        </div>
      )}

      {/* Summary Stat Cards */}
      {benchmarkData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase">Scales Tested</span>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {benchmarkData.summary.total_tested} Problems
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm bg-emerald-50/20">
            <span className="text-xs font-semibold text-emerald-700 uppercase flex items-center gap-1">
              <Award size={13} /> QPSO Wins
            </span>
            <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
              {benchmarkData.summary.qpso_wins}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-cyan-200 shadow-sm bg-cyan-50/20">
            <span className="text-xs font-semibold text-cyan-700 uppercase flex items-center gap-1">
              <Award size={13} /> Classical PSO Wins
            </span>
            <div className="text-2xl font-black text-cyan-700 mt-1 font-mono">
              {benchmarkData.summary.pso_wins}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Equal Ties</span>
            <div className="text-2xl font-black text-slate-700 mt-1 font-mono">
              {benchmarkData.summary.ties}
            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm font-heading">Measured Comparison Results</h3>
            <span className="text-xs text-slate-400 italic">Deterministic seed = 42</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Problem Size</th>
                  <th className="py-3 px-4">Riders / Cap</th>
                  <th className="py-3 px-4 text-emerald-700">QPSO Cost</th>
                  <th className="py-3 px-4 text-cyan-700">PSO Cost</th>
                  <th className="py-3 px-4">Cost Delta (%)</th>
                  <th className="py-3 px-4">QPSO Time</th>
                  <th className="py-3 px-4">PSO Time</th>
                  <th className="py-3 px-4 text-center">Measured Winner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {results.map((row) => (
                  <tr key={row.size} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 font-sans">
                      {row.size} Deliveries
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {row.riders} riders / {row.capacity} cap
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700">
                      {row.qpso_cost}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-cyan-700">
                      {row.pso_cost}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                        row.winner === 'QPSO' ? 'bg-emerald-100 text-emerald-800' :
                        row.winner === 'PSO' ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {row.cost_diff_pct > 0 ? `+${row.cost_diff_pct}%` : `${row.cost_diff_pct}%`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {row.qpso_time_ms} ms
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {row.pso_time_ms} ms
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                        row.winner === 'QPSO' ? 'bg-emerald-600 text-white' :
                        row.winner === 'PSO' ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-800'
                      }`}>
                        <Award size={12} />
                        {row.winner}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scaling Analysis Charts */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Solution Cost vs Problem Size */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm font-heading mb-1">
              Solution Cost vs Problem Scale (Lower is Better)
            </h3>
            <p className="text-xs text-slate-400 mb-4">Comparison of solution cost as delivery count increases</p>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="size" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="qpso_cost" name="QPSO Cost" stroke="#10B981" strokeWidth={3} />
                  <Line type="monotone" dataKey="pso_cost" name="PSO Cost" stroke="#06B6D4" strokeWidth={3} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Runtime vs Problem Size */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm font-heading mb-1">
              Execution Runtime vs Problem Scale (ms)
            </h3>
            <p className="text-xs text-slate-400 mb-4">Computational scaling efficiency across problem dimensions</p>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="size" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="qpso_time_ms" name="QPSO Time (ms)" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pso_time_ms" name="PSO Time (ms)" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Honest Scientific Disclaimer */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-600">
        <Info size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-bold text-slate-800">Scientific Integrity & Honest Reporting:</span>
          <p className="mt-0.5">
            Metaheuristic optimization algorithms exhibit problem-specific stochastic behavior. QPSO offers quantum-inspired mean-best exploration to escape local minima in high-dimensional combinatorics, while Classical PSO utilizes velocity momentum. Results presented here reflect unadulterated wall-clock benchmarks.
          </p>
        </div>
      </div>
    </div>
  );
};
