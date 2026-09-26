import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { OptimizerResult, ComparisonMetrics } from '../types';
import { TrendingDown, Zap, Clock, Award } from 'lucide-react';

interface ConvergenceChartProps {
  qpsoResult: OptimizerResult | null;
  psoResult: OptimizerResult | null;
  comparison: ComparisonMetrics | null;
}

export const ConvergenceChart: React.FC<ConvergenceChartProps> = ({
  qpsoResult,
  psoResult,
  comparison,
}) => {
  if (!qpsoResult || !psoResult) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[300px] text-slate-400">
        <TrendingDown size={36} className="mb-2 text-slate-300 animate-bounce" />
        <p className="font-medium text-slate-600">No optimization run active</p>
        <p className="text-xs text-slate-400 mt-1">Click "Start Simulation" or "Start Guided Demo" to view live convergence curves.</p>
      </div>
    );
  }

  // Combine convergence histories into a single array for Recharts
  const maxIters = Math.max(
    qpsoResult.convergence_history.length,
    psoResult.convergence_history.length
  );

  const chartData = [];
  for (let i = 0; i < maxIters; i++) {
    const qPt = qpsoResult.convergence_history[i] || qpsoResult.convergence_history[qpsoResult.convergence_history.length - 1];
    const pPt = psoResult.convergence_history[i] || psoResult.convergence_history[psoResult.convergence_history.length - 1];
    chartData.push({
      iteration: i,
      QPSO: qPt ? qPt.cost : null,
      PSO: pPt ? pPt.cost : null,
    });
  }

  const isQpsoWinner = comparison?.winner === 'QPSO';
  const isPsoWinner = comparison?.winner === 'PSO';

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 font-heading">
              Optimization Convergence Curves
            </h3>
            <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-full">
              Lower cost is better
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time comparison of best fitness across {qpsoResult.iterations} iterations.
          </p>
        </div>

        {/* Quick Metric Badges */}
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            isQpsoWinner ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <Zap size={14} className={isQpsoWinner ? 'text-emerald-600' : 'text-slate-500'} />
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-500">QPSO Best</div>
              <div className="text-sm font-bold font-mono">{qpsoResult.final_cost}</div>
            </div>
            {isQpsoWinner && <Award size={14} className="text-emerald-600" />}
          </div>

          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            isPsoWinner ? 'bg-cyan-50 border-cyan-300 text-cyan-800' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <Zap size={14} className={isPsoWinner ? 'text-cyan-600' : 'text-slate-500'} />
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-500">PSO Best</div>
              <div className="text-sm font-bold font-mono">{psoResult.final_cost}</div>
            </div>
            {isPsoWinner && <Award size={14} className="text-cyan-600" />}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-72 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="iteration"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              label={{ value: 'Iteration', position: 'insideBottomRight', offset: -5, fontSize: 11, fill: '#94A3B8' }}
            />
            <YAxis
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              domain={['auto', 'auto']}
              label={{ value: 'Best Cost', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94A3B8' }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs">
                      <div className="font-semibold text-slate-300 mb-1.5">Iteration #{label}</div>
                      {payload.map((entry: any) => (
                        <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-300">{entry.name}:</span>
                          </span>
                          <span className="font-mono font-bold text-white">{Number(entry.value).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
            />
            <Line
              type="monotone"
              dataKey="QPSO"
              name="Quantum-Inspired (QPSO)"
              stroke="#10B981"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: '#10B981', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="PSO"
              name="Classical PSO"
              stroke="#06B6D4"
              strokeWidth={2.5}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 5, fill: '#06B6D4', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Comparison Analysis Summary */}
      {comparison && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Measured Outcome:</span>
            <span className={`font-bold px-2 py-0.5 rounded ${
              comparison.winner === 'QPSO' ? 'bg-emerald-100 text-emerald-800' :
              comparison.winner === 'PSO' ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-200 text-slate-800'
            }`}>
              {comparison.winner === 'TIE' ? 'Equal Performance (Tie)' : `${comparison.winner} Won`}
            </span>
            <span className="text-slate-500">
              {comparison.winner_reason || `Quality difference: ${Math.abs(comparison.cost_diff_pct)}%`}
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={12} /> QPSO Runtime: <b className="text-slate-700">{comparison.qpso_time_ms} ms</b>
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> PSO Runtime: <b className="text-slate-700">{comparison.pso_time_ms} ms</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
