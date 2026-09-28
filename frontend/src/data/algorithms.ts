// Shared identity for every algorithm: display names and chart colors.
// Colors validated for categorical use (lightness band, CVD separation, contrast) on white and slate-900.

export type AlgoKey = 'QPSO' | 'PSO' | 'GA' | 'SA' | 'Greedy NN';

export interface AlgoMeta {
  key: AlgoKey;
  apiKey: 'qpso' | 'pso' | 'ga' | 'sa' | 'greedy';
  label: string;
  short: string;
  light: string;
  dark: string;
  isBaseline?: boolean;
}

export const ALGOS: AlgoMeta[] = [
  { key: 'QPSO', apiKey: 'qpso', label: 'QPSO (Quantum-inspired)', short: 'QPSO', light: '#059669', dark: '#059669' },
  { key: 'PSO', apiKey: 'pso', label: 'Classical PSO', short: 'PSO', light: '#0284C7', dark: '#0284C7' },
  { key: 'GA', apiKey: 'ga', label: 'Genetic Algorithm', short: 'GA', light: '#7C3AED', dark: '#8B5CF6' },
  { key: 'SA', apiKey: 'sa', label: 'Simulated Annealing', short: 'SA', light: '#D97706', dark: '#D97706' },
  { key: 'Greedy NN', apiKey: 'greedy', label: 'Greedy NN (baseline)', short: 'Greedy', light: '#64748B', dark: '#94A3B8', isBaseline: true },
];

export const METAHEURISTICS = ALGOS.filter(a => !a.isBaseline);

export const algoColor = (key: AlgoKey, isDark: boolean): string => {
  const meta = ALGOS.find(a => a.key === key);
  return meta ? (isDark ? meta.dark : meta.light) : '#64748B';
};
