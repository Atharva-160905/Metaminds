// Output of scripts/run_real_benchmarks.py. Loaded through an optional glob import so the app still
// builds and runs before the script has been executed (the value is then null).
const modules = import.meta.glob('./benchmark_results.json', { eager: true, import: 'default' });

export const benchmarkData: any = Object.values(modules)[0] ?? null;
