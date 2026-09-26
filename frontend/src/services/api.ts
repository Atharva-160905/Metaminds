import {
  SyntheticCityData,
  OptimizerResult,
  ComparisonMetrics,
  TrafficIncident,
  BenchmarkResponse
} from '../types';

const API_BASE = 'http://localhost:8000/api';

export interface GenerateProblemParams {
  num_deliveries: number;
  num_riders: number;
  rider_capacity: number;
  objective: 'time' | 'distance' | 'balanced';
  grid_size?: number;
  seed?: number;
}

export interface OptimizeParams {
  num_particles?: number;
  max_iterations?: number;
  seed?: number;
}

export interface OptimizationResponse {
  timestamp: number;
  qpso: OptimizerResult;
  pso: OptimizerResult;
  comparison: ComparisonMetrics;
  city: SyntheticCityData;
}

export interface TrafficSimulateResponse {
  message: string;
  incidents: TrafficIncident[];
  city: SyntheticCityData;
}

export interface ReoptimizeResponse {
  message: string;
  incidents: TrafficIncident[];
  qpso: OptimizerResult;
  pso: OptimizerResult;
  comparison: ComparisonMetrics;
  city: SyntheticCityData;
}

export const api = {
  async checkHealth(): Promise<{ status: string; deliveries: number; riders: number }> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Failed to fetch backend health');
    return res.json();
  },

  async getNetwork(): Promise<{ city: SyntheticCityData; config: any }> {
    const res = await fetch(`${API_BASE}/network`);
    if (!res.ok) throw new Error('Failed to fetch road network');
    return res.json();
  },

  async generateProblem(params: GenerateProblemParams): Promise<{ message: string; city: SyntheticCityData; config: any }> {
    const res = await fetch(`${API_BASE}/problem/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to generate delivery problem');
    return res.json();
  },

  async runOptimization(params: OptimizeParams = {}): Promise<OptimizationResponse> {
    const res = await fetch(`${API_BASE}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to run dual optimization');
    return res.json();
  },

  async simulateTraffic(incident_count: number = 2): Promise<TrafficSimulateResponse> {
    const res = await fetch(`${API_BASE}/traffic/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incident_count }),
    });
    if (!res.ok) throw new Error('Failed to simulate traffic incident');
    return res.json();
  },

  async reoptimize(params: OptimizeParams = {}): Promise<ReoptimizeResponse> {
    const res = await fetch(`${API_BASE}/reoptimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to re-optimize routes');
    return res.json();
  },

  async runBenchmark(
    sizes: number[] = [20, 50, 100, 250, 500],
    traffic_condition: 'congested' | 'clear' = 'congested'
  ): Promise<BenchmarkResponse> {
    const res = await fetch(`${API_BASE}/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sizes, num_particles: 35, traffic_condition }),
    });
    if (!res.ok) throw new Error('Failed to run benchmark suite');
    return res.json();
  },

  // =========================================================================
  // REAL-WORLD PUNE (AMBEGAON - VADGAON - SINHGAD CAMPUS) API CALLS
  // =========================================================================
  async getPuneNetwork(): Promise<{ city: SyntheticCityData; config: any }> {
    const res = await fetch(`${API_BASE}/pune/network`);
    if (!res.ok) throw new Error('Failed to fetch Pune road network');
    return res.json();
  },

  async generatePuneProblem(params: {
    num_deliveries: number;
    num_riders: number;
    rider_capacity: number;
    objective: 'time' | 'distance' | 'balanced';
    seed?: number;
  }): Promise<{ message: string; city: SyntheticCityData; config: any }> {
    const res = await fetch(`${API_BASE}/pune/problem/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to generate Pune logistics problem');
    return res.json();
  },

  async runPuneOptimization(params: OptimizeParams = {}): Promise<OptimizationResponse> {
    const res = await fetch(`${API_BASE}/pune/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to run Pune dual optimization');
    return res.json();
  },

  async simulatePuneTraffic(incident_count: number = 2): Promise<TrafficSimulateResponse> {
    const res = await fetch(`${API_BASE}/pune/traffic/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incident_count }),
    });
    if (!res.ok) throw new Error('Failed to simulate Pune traffic incident');
    return res.json();
  },

  async reoptimizePune(params: OptimizeParams = {}): Promise<ReoptimizeResponse> {
    const res = await fetch(`${API_BASE}/pune/reoptimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to re-optimize Pune routes');
    return res.json();
  }
};
