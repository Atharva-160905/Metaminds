export interface CityNode {
  id: string;
  x: number;
  y: number;
  type: 'depot' | 'intersection';
  label: string;
}

export interface CityEdge {
  u: string;
  v: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  distance: number;
  speed_limit: number;
  base_time: number;
  current_time: number;
  congestion_factor: number;
  status: 'normal' | 'moderate' | 'congested' | 'incident';
  road_name: string;
}

export interface Delivery {
  id: number;
  node_id: string;
  label: string;
  pos: [number, number];
  base_pos: [number, number];
  demand: number;
  weight_kg?: number;
  locality?: string;
  lat?: number;
  lng?: number;
  priority: 'normal' | 'high';
}

export interface CityDistrict {
  name: string;
  x: number;
  y: number;
  type: string;
}

export interface CityPark {
  name: string;
  points: [number, number][];
}

export interface PuneLandmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'college' | 'hospital' | 'bridge' | 'junction' | 'commercial' | 'residential' | string;
  pos: [number, number];
}

export interface OkhlaRoadSegment {
  u: number;
  v: number;
  road_type: 'primary' | 'secondary' | 'tertiary' | 'residential';
  road_name: string;
  length_m: number;
  oneway: boolean;
  maxspeed?: string;
  points: [number, number][];
}

export interface SyntheticCityData {
  region_name?: string;
  city_name?: string;
  width: number;
  height: number;
  is_real_osm?: boolean;
  depot: {
    id: string;
    label?: string;
    x: number;
    y: number;
    lat?: number;
    lng?: number;
  };
  districts?: CityDistrict[];
  parks?: CityPark[];
  landmarks?: PuneLandmark[];
  river_path?: [number, number][];
  nodes: CityNode[];
  edges: CityEdge[];
  deliveries: Delivery[];
  roads?: OkhlaRoadSegment[];
}

export interface DeliveryDetail {
  delivery_id: number;
  delivery_index: number;
  label: string;
  node_id: string;
  pos: [number, number];
  eta_min: number;
  dist_cum: number;
}

export interface WaypointCoord {
  id: string;
  x: number;
  y: number;
}

export interface RiderRoute {
  rider_id: number;
  delivery_count: number;
  deliveries: DeliveryDetail[];
  route_time_min: number;
  route_dist_km: number;
  waypoint_nodes: string[];
  waypoint_coords: WaypointCoord[];
}

export interface LocalSearchMetrics {
  applied: boolean;
  pre_cost: number;
  post_cost: number;
  improvement_pct: number;
  moves_applied: number;
}

export interface VRPDecodedSolution {
  fitness: number;
  total_time_min: number;
  total_dist_km: number;
  penalty: number;
  rider_routes: RiderRoute[];
  permutation: number[];
  local_search?: LocalSearchMetrics;
}

export interface ConvergencePoint {
  iteration: number;
  cost: number;
}

export interface OptimizerResult {
  algorithm: 'QPSO' | 'PSO' | 'GA' | 'SA' | 'Greedy NN' | string;
  algorithm_name: string;
  execution_time_ms: number;
  iterations: number;
  population_size: number;
  final_cost: number;
  pre_local_search_cost?: number;
  local_search?: LocalSearchMetrics;
  convergence_history: ConvergencePoint[];
  solution: VRPDecodedSolution;
}

export interface ComparisonMetrics {
  winner: 'QPSO' | 'PSO' | 'GA' | 'SA' | 'Greedy NN' | 'TIE' | string;
  winner_reason?: string;
  cost_diff: number;
  cost_diff_pct: number;
  time_diff_ms?: number;
  qpso_time_ms: number;
  pso_time_ms: number;
  ga_time_ms?: number;
  sa_time_ms?: number;
  greedy_time_ms?: number;
  all_costs?: Record<string, number>;
}

export interface TrafficIncident {
  u: string;
  v: string;
  road_name: string;
  old_time: number;
  new_time: number;
  congestion_factor: number;
  status: string;
}

export interface BenchmarkItem {
  size: number;
  riders: number;
  capacity: number;
  iterations: number;
  qpso_cost: number;
  pso_cost: number;
  ga_cost?: number;
  sa_cost?: number;
  qpso_time_ms: number;
  pso_time_ms: number;
  ga_time_ms?: number;
  sa_time_ms?: number;
  cost_diff: number;
  cost_diff_pct: number;
  winner: 'QPSO' | 'PSO' | 'GA' | 'SA' | 'TIE';
}

export interface BenchmarkResponse {
  benchmark_results: BenchmarkItem[];
  summary: {
    total_tested: number;
    qpso_wins: number;
    pso_wins: number;
    ga_wins?: number;
    sa_wins?: number;
    ties: number;
  };
}

export interface EventLogItem {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'traffic' | 'qpso' | 'pso';
}
