"""
FastAPI Backend Application for SmartRoute-Q SIH 2026.
Serves synthetic city networks, dual metaheuristic optimization (QPSO vs PSO),
traffic incidents, warm-start dynamic re-routing, convergence confidence, and multi-scale benchmarking.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
import os
import sys
import time
import json
import copy
import threading
import math
import numpy as np

# Ensure backend directory is in sys.path regardless of execution CWD
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from city_graph import SyntheticCity
from pune_graph import PuneCityGraph
from delhi_graph import DelhiCityGraph
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
from optimizers.ga import GAOptimizer
from optimizers.sa import SAOptimizer
from optimizers.greedy import GreedyNearestNeighbourOptimizer

app = FastAPI(
    title="QuantaRoute API",
    description="Quantum-Inspired Metaheuristic Traffic Route Optimization API (SIH 2026)",
    version="1.0.0"
)

# Enable CORS for local React/Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State Container for active session
class GlobalState:
    def __init__(self):
        self.seed: int = 42
        self.city: SyntheticCity = SyntheticCity(grid_size=8, seed=42)
        self.deliveries: List[Dict[str, Any]] = self.city.generate_deliveries(num_deliveries=50, seed=42)
        self.num_riders: int = 5
        self.rider_capacity: int = 10
        self.objective: str = "balanced" # "time", "distance", "balanced"
        self.w_time: float = 0.6
        self.w_dist: float = 0.4
        self.problem: VRPProblem = VRPProblem(
            city=self.city,
            deliveries=self.deliveries,
            num_riders=self.num_riders,
            rider_capacity=self.rider_capacity,
            objective=self.objective,
            w_time=self.w_time,
            w_dist=self.w_dist
        )
        self.last_qpso_result: Optional[Dict[str, Any]] = None
        self.last_pso_result: Optional[Dict[str, Any]] = None
        self.last_ga_result: Optional[Dict[str, Any]] = None
        self.last_sa_result: Optional[Dict[str, Any]] = None
        self.qpso_raw_state: Optional[Dict[str, Any]] = None
        self.pso_raw_state: Optional[Dict[str, Any]] = None
        self.ga_raw_state: Optional[Dict[str, Any]] = None
        self.sa_raw_state: Optional[Dict[str, Any]] = None
        self.active_incidents: List[Dict[str, Any]] = []

state = GlobalState()

# Pydantic Request Models
class ProblemGenerateRequest(BaseModel):
    num_deliveries: int = Field(50, ge=5, le=500)
    num_riders: int = Field(5, ge=1, le=50)
    rider_capacity: int = Field(10, ge=1, le=100)
    objective: str = Field("balanced", pattern="^(time|distance|balanced)$")
    grid_size: int = Field(8, ge=6, le=14)
    seed: Optional[int] = 42

class OptimizeRequest(BaseModel):
    num_particles: int = Field(35, ge=10, le=100)
    max_iterations: Optional[int] = None
    seed: Optional[int] = 42

class TrafficSimulateRequest(BaseModel):
    incident_count: int = Field(2, ge=1, le=6)
    target_edges: Optional[List[List[str]]] = None

class BenchmarkRequest(BaseModel):
    sizes: List[int] = Field(default=[20, 50, 100, 250, 500])
    num_particles: int = Field(35, ge=10, le=60)
    max_iterations: Optional[int] = None
    seed: Optional[int] = 42
    traffic_condition: str = Field(default="congested") # "congested" (active road incidents) or "clear"

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "service": "QuantaRoute Backend",
        "version": "1.0.0",
        "deliveries": len(state.deliveries),
        "riders": state.num_riders
    }

@app.get("/api/network")
def get_network():
    """Returns the current synthetic city road network and active deliveries."""
    return {
        "city": state.city.to_dict(),
        "config": {
            "num_deliveries": len(state.deliveries),
            "num_riders": state.num_riders,
            "rider_capacity": state.rider_capacity,
            "objective": state.objective,
            "active_incidents": state.active_incidents
        }
    }

@app.post("/api/problem/generate")
def generate_problem(req: ProblemGenerateRequest):
    """Generates a fresh synthetic city and delivery distribution."""
    seed = req.seed if req.seed is not None else 42
    state.seed = seed
    
    # Scale grid size based on delivery count
    grid_sz = req.grid_size
    if req.num_deliveries > 150:
        grid_sz = max(grid_sz, 10)
    if req.num_deliveries > 300:
        grid_sz = max(grid_sz, 12)
        
    state.city = SyntheticCity(grid_size=grid_sz, seed=seed)
    state.deliveries = state.city.generate_deliveries(num_deliveries=req.num_deliveries, seed=seed)
    state.num_riders = req.num_riders
    state.rider_capacity = req.rider_capacity
    state.objective = req.objective
    state.active_incidents = []
    
    state.problem = VRPProblem(
        city=state.city,
        deliveries=state.deliveries,
        num_riders=state.num_riders,
        rider_capacity=state.rider_capacity,
        objective=state.objective,
        w_time=state.w_time,
        w_dist=state.w_dist
    )
    
    state.last_qpso_result = None
    state.last_pso_result = None
    state.last_ga_result = None
    state.last_sa_result = None
    state.qpso_raw_state = None
    state.pso_raw_state = None
    state.ga_raw_state = None
    state.sa_raw_state = None
    
    return {
        "message": f"Successfully generated problem with {req.num_deliveries} deliveries and {req.num_riders} riders.",
        "city": state.city.to_dict(),
        "config": {
            "num_deliveries": req.num_deliveries,
            "num_riders": req.num_riders,
            "rider_capacity": req.rider_capacity,
            "objective": req.objective,
            "seed": seed
        }
    }

@app.post("/api/optimize")
def run_optimization(req: OptimizeRequest):
    """
    Executes QPSO, PSO, GA, and SA on the EXACT SAME problem instance.
    Dynamically scales iteration budget with problem size if not specified.
    """
    opt_seed = req.seed if req.seed is not None else state.seed
    
    # Dynamic iteration scaling based on number of deliveries for snappy UX
    num_deliv = state.problem.num_deliveries
    if req.max_iterations is not None:
        iters = req.max_iterations
    else:
        iters = min(100, max(35, int(25 + num_deliv * 0.20)))
        
    num_p = min(req.num_particles, 25) if req.num_particles else 25
        
    # 1. Run QPSO
    qpso = QPSOOptimizer(
        problem=state.problem,
        num_particles=num_p,
        max_iterations=iters,
        seed=opt_seed
    )
    qpso_res = qpso.optimize()
    state.qpso_raw_state = qpso_res.pop("raw_state", None)
    state.last_qpso_result = qpso_res
    
    # 2. Run Classical PSO with identical seed and iteration budget
    pso = ClassicalPSOOptimizer(
        problem=state.problem,
        num_particles=num_p,
        max_iterations=iters,
        w_start=0.9,
        w_end=0.4,
        seed=opt_seed
    )
    pso_res = pso.optimize()
    state.pso_raw_state = pso_res.pop("raw_state", None)
    state.last_pso_result = pso_res
    
    # 3. Run Genetic Algorithm
    ga = GAOptimizer(
        problem=state.problem,
        population_size=num_p,
        max_iterations=iters,
        crossover_rate=0.85,
        mutation_rate=0.15,
        tournament_size=3,
        elitism_count=2,
        seed=opt_seed
    )
    ga_res = ga.optimize()
    state.ga_raw_state = ga_res.pop("raw_state", None)
    state.last_ga_result = ga_res
    
    # 4. Run Simulated Annealing
    sa = SAOptimizer(
        problem=state.problem,
        max_iterations=iters,
        initial_temp=100.0,
        final_temp=0.01,
        perturbation_scale=2.0,
        restarts=3,
        seed=opt_seed
    )
    sa_res = sa.optimize()
    state.sa_raw_state = sa_res.pop("raw_state", None)
    state.last_sa_result = sa_res
    
    # 5. Calculate 4-way comparative metrics
    all_results = {
        "QPSO": qpso_res,
        "PSO": pso_res,
        "GA": ga_res,
        "SA": sa_res
    }
    costs = {name: res["final_cost"] for name, res in all_results.items()}
    winner = min(costs, key=costs.get)
    best_cost = costs[winner]
    
    # QPSO vs PSO legacy comparison (backward compat)
    qpso_cost = qpso_res["final_cost"]
    pso_cost = pso_res["final_cost"]
    cost_diff = round(pso_cost - qpso_cost, 4)
    cost_diff_pct = round(((pso_cost - qpso_cost) / pso_cost) * 100.0, 2) if pso_cost > 0 else 0.0
    time_diff_ms = round(pso_res["execution_time_ms"] - qpso_res["execution_time_ms"], 2)
    
    winner_reason = f"{winner} achieved the lowest cost ({best_cost}) across all 4 algorithms"

    return {
        "timestamp": time.time(),
        "qpso": qpso_res,
        "pso": pso_res,
        "ga": ga_res,
        "sa": sa_res,
        "comparison": {
            "winner": winner,
            "winner_reason": winner_reason,
            "cost_diff": cost_diff,
            "cost_diff_pct": cost_diff_pct,
            "time_diff_ms": time_diff_ms,
            "qpso_time_ms": qpso_res["execution_time_ms"],
            "pso_time_ms": pso_res["execution_time_ms"],
            "ga_time_ms": ga_res["execution_time_ms"],
            "sa_time_ms": sa_res["execution_time_ms"],
            "iterations_executed": iters,
            "all_costs": costs
        },
        "city": state.city.to_dict()
    }

@app.post("/api/traffic/simulate")
def simulate_traffic(req: TrafficSimulateRequest):
    """
    Injects a severe traffic congestion incident onto currently used or critical road segments.
    """
    t_start = time.perf_counter()
    candidate_edges = []
    if state.last_qpso_result:
        for r_data in state.last_qpso_result["solution"]["rider_routes"]:
            nodes = r_data.get("waypoint_nodes", [])
            for i in range(len(nodes) - 1):
                u, v = nodes[i], nodes[i+1]
                if state.city.graph.has_edge(u, v):
                    candidate_edges.append((u, v))
                    
    incidents = state.city.inject_traffic_incident(
        candidate_edges=candidate_edges if candidate_edges else None,
        count=req.incident_count
    )
    state.active_incidents = incidents
    
    # Refresh problem matrix cache
    t_dijkstra_start = time.perf_counter()
    state.problem.refresh_matrices()
    dijkstra_ms = round((time.perf_counter() - t_dijkstra_start) * 1000.0, 2)
    
    total_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
    
    print(json.dumps({
        "event": "traffic_simulation",
        "incidents": len(incidents),
        "dijkstra_ms": dijkstra_ms,
        "total_ms": total_ms
    }))
    
    return {
        "message": f"Simulated traffic incident on {len(incidents)} road segment(s).",
        "incidents": incidents,
        "city": state.city.to_dict(),
        "timing": {
            "dijkstra_refresh_ms": dijkstra_ms,
            "total_request_ms": total_ms
        }
    }

@app.post("/api/reoptimize")
def reoptimize(req: OptimizeRequest):
    """
    Warm-started re-optimization upon dynamic traffic change:
    - Measures real latency across Dijkstra, QPSO, and PSO.
    - Preserves previous swarm state and reinitializes only affected particles.
    - Dynamically scales iteration budget with problem size.
    - Computes real convergence confidence.
    """
    t_request_start = time.perf_counter()
    
    # 1. Dijkstra Refresh (if not done)
    t_dijkstra_start = time.perf_counter()
    if not state.active_incidents:
        state.active_incidents = state.city.inject_traffic_incident(count=2)
    state.problem.refresh_matrices()
    dijkstra_ms = round((time.perf_counter() - t_dijkstra_start) * 1000.0, 2)
    
    # 2. Dynamic iteration budget scaling with problem size (Issue 2 fix)
    num_deliv = state.problem.num_deliveries
    if req.max_iterations is not None:
        iters = req.max_iterations
    else:
        iters = min(220, max(80, int(60 + num_deliv * 0.35)))
        
    opt_seed = req.seed if req.seed is not None else (state.seed + 101)
    num_p = min(req.num_particles, 25) if req.num_particles else 25
    
    # 3. Warm-Started QPSO Re-Optimization (Issue 1 fix)
    qpso = QPSOOptimizer(
        problem=state.problem,
        num_particles=num_p,
        max_iterations=iters,
        seed=opt_seed
    )
    qpso_res = qpso.optimize(warm_state=state.qpso_raw_state)
    state.qpso_raw_state = qpso_res.pop("raw_state", None)
    state.last_qpso_result = qpso_res
    
    # 4. Warm-Started Classical PSO Re-Optimization (Issue 1 fix)
    pso = ClassicalPSOOptimizer(
        problem=state.problem,
        num_particles=num_p,
        max_iterations=iters,
        w_start=0.9,
        w_end=0.4,
        seed=opt_seed
    )
    pso_res = pso.optimize(warm_state=state.pso_raw_state)
    state.pso_raw_state = pso_res.pop("raw_state", None)
    state.last_pso_result = pso_res

    # 5. Warm-Started GA Re-Optimization
    ga = GAOptimizer(
        problem=state.problem,
        population_size=num_p,
        max_iterations=iters,
        seed=opt_seed
    )
    ga_res = ga.optimize(warm_state=state.ga_raw_state)
    state.ga_raw_state = ga_res.pop("raw_state", None)
    state.last_ga_result = ga_res

    # 6. Warm-Started SA Re-Optimization
    sa = SAOptimizer(
        problem=state.problem,
        max_iterations=iters,
        num_particles=num_p,
        seed=opt_seed
    )
    sa_res = sa.optimize(warm_state=state.sa_raw_state)
    state.sa_raw_state = sa_res.pop("raw_state", None)
    state.last_sa_result = sa_res
    
    total_request_ms = round((time.perf_counter() - t_request_start) * 1000.0, 2)
    
    # 4-way winner determination
    all_costs = {
        "QPSO": qpso_res["final_cost"],
        "PSO": pso_res["final_cost"],
        "GA": ga_res["final_cost"],
        "SA": sa_res["final_cost"]
    }
    winner = min(all_costs, key=all_costs.get)
    best_cost = all_costs[winner]

    qpso_cost = qpso_res["final_cost"]
    pso_cost = pso_res["final_cost"]
    cost_diff = round(pso_cost - qpso_cost, 4)
    cost_diff_pct = round(((pso_cost - qpso_cost) / pso_cost) * 100.0, 2) if pso_cost > 0 else 0.0

    winner_reason = f"{winner} achieved lowest cost ({best_cost}) across all 4 algorithms on dynamic re-routing"
    
    return {
        "message": "Warm-started re-optimization complete with updated road traffic weights across 4 algorithms.",
        "incidents": state.active_incidents,
        "qpso": qpso_res,
        "pso": pso_res,
        "ga": ga_res,
        "sa": sa_res,
        "comparison": {
            "winner": winner,
            "winner_reason": winner_reason,
            "cost_diff": cost_diff,
            "cost_diff_pct": cost_diff_pct,
            "qpso_time_ms": qpso_res["execution_time_ms"],
            "pso_time_ms": pso_res["execution_time_ms"],
            "ga_time_ms": ga_res["execution_time_ms"],
            "sa_time_ms": sa_res["execution_time_ms"],
            "iterations_executed": iters,
            "all_costs": all_costs
        },
        "timing": {
            "dijkstra_refresh_ms": dijkstra_ms,
            "qpso_ms": qpso_res["execution_time_ms"],
            "pso_ms": pso_res["execution_time_ms"],
            "ga_ms": ga_res["execution_time_ms"],
            "sa_ms": sa_res["execution_time_ms"],
            "total_request_ms": total_request_ms
        },
        "tail_improvement_pct": {
            "qpso": qpso_res.get("tail_improvement_pct"),
            "pso": pso_res.get("tail_improvement_pct"),
            "ga": ga_res.get("tail_improvement_pct"),
            "sa": sa_res.get("tail_improvement_pct")
        },
        "city": state.city.to_dict()
    }

@app.post("/api/benchmark")
def run_benchmark(req: BenchmarkRequest):
    """
    Executes an empirical benchmark across problem sizes (20, 50, 100, 250, 500).
    Measures actual QPSO vs PSO solution costs, runtimes, and performance ratios honestly.
    """
    benchmark_results = []
    base_seed = req.seed if req.seed is not None else 42
    
    for size in req.sizes:
        riders = max(2, int(np.ceil(size / 10.0)))
        capacity = max(10, int(np.ceil(size / riders * 1.2)))
        
        grid_sz = 8
        if size > 150:
            grid_sz = 10
        if size > 300:
            grid_sz = 12
            
        test_city = SyntheticCity(grid_size=grid_sz, seed=base_seed)
        test_deliveries = test_city.generate_deliveries(num_deliveries=size, seed=base_seed)
        
        if req.traffic_condition == "congested":
            arterial_edges = []
            for u, v, data in test_city.graph.edges(data=True):
                p1 = test_city.graph.nodes[u]['pos']
                p2 = test_city.graph.nodes[v]['pos']
                if abs(p1[0] - 600) < 350 and abs(p1[1] - 450) < 350:
                    arterial_edges.append((u, v))
            incident_count = 3 if size <= 50 else (4 if size <= 200 else 6)
            test_city.inject_traffic_incident(candidate_edges=arterial_edges, count=incident_count)
            
        test_prob = VRPProblem(
            city=test_city,
            deliveries=test_deliveries,
            num_riders=riders,
            rider_capacity=capacity,
            objective="balanced"
        )
        
        if req.max_iterations is not None:
            iter_budget = req.max_iterations
        elif req.traffic_condition == "congested":
            iter_budget = min(240, max(90, int(70 + size * 0.35)))
        else:
            iter_budget = min(160, max(60, int(45 + size * 0.25)))
            
        bench_particles = req.num_particles if req.num_particles is not None else 30
        bench_particles = min(max(10, bench_particles), 35)

        qpso = QPSOOptimizer(
            problem=test_prob,
            num_particles=bench_particles,
            max_iterations=iter_budget,
            seed=base_seed
        )
        pso = ClassicalPSOOptimizer(
            problem=test_prob,
            num_particles=bench_particles,
            max_iterations=iter_budget,
            w_start=0.9,
            w_end=0.4,
            seed=base_seed
        )
        ga = GAOptimizer(
            problem=test_prob,
            population_size=bench_particles,
            max_iterations=iter_budget,
            seed=base_seed
        )
        sa = SAOptimizer(
            problem=test_prob,
            max_iterations=iter_budget,
            num_particles=bench_particles,
            restarts=3,
            seed=base_seed
        )
        greedy = GreedyNearestNeighbourOptimizer(test_prob, seed=base_seed)
            
        qpso_res = qpso.optimize()
        pso_res = pso.optimize()
        ga_res = ga.optimize()
        sa_res = sa.optimize()
        greedy_res = greedy.optimize()
        
        q_cost = qpso_res["final_cost"]
        p_cost = pso_res["final_cost"]
        g_cost = ga_res["final_cost"]
        s_cost = sa_res["final_cost"]
        gr_cost = greedy_res["final_cost"]
        q_time = qpso_res["execution_time_ms"]
        p_time = pso_res["execution_time_ms"]
        g_time = ga_res["execution_time_ms"]
        s_time = sa_res["execution_time_ms"]
        gr_time = greedy_res["execution_time_ms"]
        
        costs = {"QPSO": q_cost, "PSO": p_cost, "GA": g_cost, "SA": s_cost, "Greedy NN": gr_cost}
        min_cost = min(costs.values())
        ties = [k for k, v in costs.items() if abs(v - min_cost) / (min_cost + 1e-6) <= 0.005]
        winner = "TIE (" + "/".join(ties) + ")" if len(ties) > 1 else min(costs, key=costs.get)
        
        diff = round(p_cost - q_cost, 2)
        diff_pct = round(((p_cost - q_cost) / p_cost) * 100.0, 2) if p_cost > 0 else 0.0
            
        benchmark_results.append({
            "size": size,
            "riders": riders,
            "capacity": capacity,
            "iterations": iter_budget,
            "qpso_cost": q_cost,
            "pso_cost": p_cost,
            "ga_cost": g_cost,
            "sa_cost": s_cost,
            "greedy_cost": gr_cost,
            "qpso_time_ms": q_time,
            "pso_time_ms": p_time,
            "ga_time_ms": g_time,
            "sa_time_ms": s_time,
            "greedy_time_ms": gr_time,
            "cost_diff": diff,
            "cost_diff_pct": diff_pct,
            "winner": winner
        })
        
    return {
        "benchmark_results": benchmark_results,
        "summary": {
            "total_tested": len(req.sizes),
            "qpso_wins": sum(1 for r in benchmark_results if r["winner"] == "QPSO"),
            "pso_wins": sum(1 for r in benchmark_results if r["winner"] == "PSO"),
            "ga_wins": sum(1 for r in benchmark_results if r["winner"] == "GA"),
            "sa_wins": sum(1 for r in benchmark_results if r["winner"] == "SA"),
            "greedy_wins": sum(1 for r in benchmark_results if r["winner"] == "Greedy NN"),
            "ties": sum(1 for r in benchmark_results if r["winner"].startswith("TIE"))
        }
    }


# =====================================================================
# REAL-WORLD PUNE (AMBEGAON - VADGAON - SINHGAD CAMPUS) ROAD NETWORK APIS
# =====================================================================

class PuneGlobalState:
    def __init__(self):
        self.seed: int = 42
        self.city: PuneCityGraph = PuneCityGraph(seed=42)
        self.deliveries: List[Dict[str, Any]] = self.city.generate_deliveries(num_deliveries=25, seed=42)
        self.num_riders: int = 4
        self.rider_capacity: int = 8
        self.objective: str = "balanced"
        self.w_time: float = 0.6
        self.w_dist: float = 0.4
        self.problem: VRPProblem = VRPProblem(
            city=self.city,
            deliveries=self.deliveries,
            num_riders=self.num_riders,
            rider_capacity=self.rider_capacity,
            objective=self.objective,
            w_time=self.w_time,
            w_dist=self.w_dist
        )
        self.last_qpso_result: Optional[Dict[str, Any]] = None
        self.last_pso_result: Optional[Dict[str, Any]] = None
        self.last_ga_result: Optional[Dict[str, Any]] = None
        self.last_sa_result: Optional[Dict[str, Any]] = None
        self.qpso_raw_state: Optional[Dict[str, Any]] = None
        self.pso_raw_state: Optional[Dict[str, Any]] = None
        self.ga_raw_state: Optional[Dict[str, Any]] = None
        self.sa_raw_state: Optional[Dict[str, Any]] = None
        self.active_incidents: List[Dict[str, Any]] = []

pune_state = PuneGlobalState()

class PuneProblemGenerateRequest(BaseModel):
    num_deliveries: int = Field(25, ge=5, le=100)
    num_riders: int = Field(4, ge=1, le=20)
    rider_capacity: int = Field(8, ge=1, le=50)
    objective: str = Field("balanced", pattern="^(time|distance|balanced)$")
    seed: Optional[int] = 42

class PuneTrafficSimulateRequest(BaseModel):
    incident_count: int = Field(2, ge=1, le=5)
    target_edges: Optional[List[List[str]]] = None

@app.get("/api/pune/network")
def get_pune_network():
    """Returns the authentic Pune Ambegaon/Vadgaon/Sinhgad network topology, landmarks, and river path."""
    return {
        "city": pune_state.city.to_dict(),
        "config": {
            "num_deliveries": len(pune_state.deliveries),
            "num_riders": pune_state.num_riders,
            "rider_capacity": pune_state.rider_capacity,
            "objective": pune_state.objective,
            "active_incidents": pune_state.active_incidents
        }
    }

@app.post("/api/pune/problem/generate")
def generate_pune_problem(req: PuneProblemGenerateRequest):
    """Generates delivery packages across landmarks and residential/college pockets in Ambegaon & Vadgaon."""
    seed = req.seed if req.seed is not None else 42
    pune_state.seed = seed
    
    pune_state.city = PuneCityGraph(seed=seed)
    pune_state.deliveries = pune_state.city.generate_deliveries(num_deliveries=req.num_deliveries, seed=seed)
    pune_state.num_riders = req.num_riders
    pune_state.rider_capacity = req.rider_capacity
    pune_state.objective = req.objective
    pune_state.active_incidents = []
    pune_state.city.clear_incidents()
    
    pune_state.problem = VRPProblem(
        city=pune_state.city,
        deliveries=pune_state.deliveries,
        num_riders=pune_state.num_riders,
        rider_capacity=pune_state.rider_capacity,
        objective=pune_state.objective,
        w_time=pune_state.w_time,
        w_dist=pune_state.w_dist
    )
    pune_state.problem.refresh_matrices()
    
    pune_state.last_qpso_result = None
    pune_state.last_pso_result = None
    pune_state.last_ga_result = None
    pune_state.last_sa_result = None
    pune_state.qpso_raw_state = None
    pune_state.pso_raw_state = None
    pune_state.ga_raw_state = None
    pune_state.sa_raw_state = None
    
    return {
        "message": f"Successfully generated Pune logistics problem with {req.num_deliveries} stops and {req.num_riders} fleet vehicles.",
        "city": pune_state.city.to_dict(),
        "config": {
            "num_deliveries": req.num_deliveries,
            "num_riders": req.num_riders,
            "rider_capacity": req.rider_capacity,
            "objective": req.objective,
            "seed": seed
        }
    }

@app.post("/api/pune/optimize")
def run_pune_optimization(req: OptimizeRequest):
    """
    Executes QPSO, PSO, GA, and SA on the real Pune graph network.
    """
    opt_seed = req.seed if req.seed is not None else pune_state.seed
    num_deliv = pune_state.problem.num_deliveries
    iters = req.max_iterations if req.max_iterations is not None else min(80, max(30, int(20 + num_deliv * 0.25)))
    num_p = min(req.num_particles, 25) if req.num_particles else 25
    
    # 1. Run QPSO
    qpso = QPSOOptimizer(
        problem=pune_state.problem,
        num_particles=num_p,
        max_iterations=iters,
        seed=opt_seed
    )
    qpso_res = qpso.optimize()
    pune_state.qpso_raw_state = qpso_res.pop("raw_state", None)
    pune_state.last_qpso_result = qpso_res
    
    # 2. Run Classical PSO
    pso = ClassicalPSOOptimizer(
        problem=pune_state.problem,
        num_particles=num_p,
        max_iterations=iters,
        w_start=0.9,
        w_end=0.4,
        seed=opt_seed
    )
    pso_res = pso.optimize()
    pune_state.pso_raw_state = pso_res.pop("raw_state", None)
    pune_state.last_pso_result = pso_res
    
    # 3. Run Genetic Algorithm
    ga = GAOptimizer(
        problem=pune_state.problem,
        population_size=num_p,
        max_iterations=iters,
        crossover_rate=0.85,
        mutation_rate=0.15,
        tournament_size=3,
        elitism_count=2,
        seed=opt_seed
    )
    ga_res = ga.optimize()
    pune_state.ga_raw_state = ga_res.pop("raw_state", None)
    pune_state.last_ga_result = ga_res
    
    # 4. Run Simulated Annealing
    sa = SAOptimizer(
        problem=pune_state.problem,
        max_iterations=iters,
        initial_temp=100.0,
        final_temp=0.01,
        perturbation_scale=2.0,
        restarts=3,
        seed=opt_seed
    )
    sa_res = sa.optimize()
    pune_state.sa_raw_state = sa_res.pop("raw_state", None)
    pune_state.last_sa_result = sa_res
    
    # 5. 4-way metrics
    all_results = {
        "QPSO": qpso_res,
        "PSO": pso_res,
        "GA": ga_res,
        "SA": sa_res
    }
    costs = {name: res["final_cost"] for name, res in all_results.items()}
    winner = min(costs, key=costs.get)
    best_cost = costs[winner]
    
    qpso_cost = qpso_res["final_cost"]
    pso_cost = pso_res["final_cost"]
    cost_diff = round(pso_cost - qpso_cost, 4)
    cost_diff_pct = round(((pso_cost - qpso_cost) / pso_cost) * 100.0, 2) if pso_cost > 0 else 0.0
    time_diff_ms = round(pso_res["execution_time_ms"] - qpso_res["execution_time_ms"], 2)
    
    winner_reason = f"{winner} achieved the lowest cost ({best_cost}) across all 4 algorithms"
        
    return {
        "timestamp": time.time(),
        "qpso": qpso_res,
        "pso": pso_res,
        "ga": ga_res,
        "sa": sa_res,
        "comparison": {
            "winner": winner,
            "winner_reason": winner_reason,
            "cost_diff": cost_diff,
            "cost_diff_pct": cost_diff_pct,
            "time_diff_ms": time_diff_ms,
            "qpso_time_ms": qpso_res["execution_time_ms"],
            "pso_time_ms": pso_res["execution_time_ms"],
            "ga_time_ms": ga_res["execution_time_ms"],
            "sa_time_ms": sa_res["execution_time_ms"],
            "iterations_executed": iters,
            "all_costs": costs
        },
        "city": pune_state.city.to_dict()
    }

@app.post("/api/pune/traffic/simulate")
def simulate_pune_traffic(req: PuneTrafficSimulateRequest):
    """
    Simulates real Pune traffic incidents on active routes or choke points (Navale Bridge, Vadgaon Phata).
    """
    t_start = time.perf_counter()
    candidate_edges = []
    if pune_state.last_qpso_result:
        for r_data in pune_state.last_qpso_result["solution"]["rider_routes"]:
            nodes = r_data.get("waypoint_nodes", [])
            for i in range(len(nodes) - 1):
                u, v = nodes[i], nodes[i+1]
                if pune_state.city.graph.has_edge(u, v):
                    candidate_edges.append((u, v))
                    
    incidents = pune_state.city.inject_traffic_incident(
        candidate_edges=candidate_edges if candidate_edges else None,
        count=req.incident_count
    )
    pune_state.active_incidents = incidents
    
    # Dijkstra matrix refresh
    t_dijkstra_start = time.perf_counter()
    pune_state.problem.refresh_matrices()
    dijkstra_ms = round((time.perf_counter() - t_dijkstra_start) * 1000.0, 2)
    total_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
    
    return {
        "message": f"Simulated traffic choke points on {len(incidents)} Pune road segment(s).",
        "incidents": incidents,
        "city": pune_state.city.to_dict(),
        "timing": {
            "dijkstra_refresh_ms": dijkstra_ms,
            "total_request_ms": total_ms
        }
    }

@app.post("/api/pune/reoptimize")
def reoptimize_pune(req: OptimizeRequest):
    """
    Warm-started re-optimization for Pune real graph upon road incidents.
    """
    t_request_start = time.perf_counter()
    
    # 1. Dijkstra Refresh
    t_dijkstra_start = time.perf_counter()
    if not pune_state.active_incidents:
        pune_state.active_incidents = pune_state.city.inject_traffic_incident(count=2)
    pune_state.problem.refresh_matrices()
    dijkstra_ms = round((time.perf_counter() - t_dijkstra_start) * 1000.0, 2)
    
    num_deliv = pune_state.problem.num_deliveries
    iters = req.max_iterations if req.max_iterations is not None else min(180, max(60, int(50 + num_deliv * 0.4)))
    opt_seed = req.seed if req.seed is not None else (pune_state.seed + 101)
    num_p = min(req.num_particles, 25) if req.num_particles else 25
    
    # 2. Warm QPSO
    qpso = QPSOOptimizer(
        problem=pune_state.problem,
        num_particles=num_p,
        max_iterations=iters,
        seed=opt_seed
    )
    qpso_res = qpso.optimize(warm_state=pune_state.qpso_raw_state)
    pune_state.qpso_raw_state = qpso_res.pop("raw_state", None)
    pune_state.last_qpso_result = qpso_res
    
    # 3. Warm PSO
    pso = ClassicalPSOOptimizer(
        problem=pune_state.problem,
        num_particles=num_p,
        max_iterations=iters,
        w_start=0.9,
        w_end=0.4,
        seed=opt_seed
    )
    pso_res = pso.optimize(warm_state=pune_state.pso_raw_state)
    pune_state.pso_raw_state = pso_res.pop("raw_state", None)
    pune_state.last_pso_result = pso_res

    # 4. Warm GA
    ga = GAOptimizer(
        problem=pune_state.problem,
        population_size=num_p,
        max_iterations=iters,
        seed=opt_seed
    )
    ga_res = ga.optimize(warm_state=pune_state.ga_raw_state)
    pune_state.ga_raw_state = ga_res.pop("raw_state", None)
    pune_state.last_ga_result = ga_res

    # 5. Warm SA
    sa = SAOptimizer(
        problem=pune_state.problem,
        max_iterations=iters,
        num_particles=num_p,
        seed=opt_seed
    )
    sa_res = sa.optimize(warm_state=pune_state.sa_raw_state)
    pune_state.sa_raw_state = sa_res.pop("raw_state", None)
    pune_state.last_sa_result = sa_res
    
    total_request_ms = round((time.perf_counter() - t_request_start) * 1000.0, 2)
    
    all_costs = {
        "QPSO": qpso_res["final_cost"],
        "PSO": pso_res["final_cost"],
        "GA": ga_res["final_cost"],
        "SA": sa_res["final_cost"]
    }
    winner = min(all_costs, key=all_costs.get)
    best_cost = all_costs[winner]

    qpso_cost = qpso_res["final_cost"]
    pso_cost = pso_res["final_cost"]
    cost_diff = round(pso_cost - qpso_cost, 4)
    cost_diff_pct = round(((pso_cost - qpso_cost) / pso_cost) * 100.0, 2) if pso_cost > 0 else 0.0

    winner_reason = f"{winner} achieved lowest cost ({best_cost}) across all 4 algorithms on Pune road network"
    
    return {
        "message": "Warm-started re-optimization complete on Pune road network across 4 algorithms.",
        "incidents": pune_state.active_incidents,
        "qpso": qpso_res,
        "pso": pso_res,
        "ga": ga_res,
        "sa": sa_res,
        "comparison": {
            "winner": winner,
            "winner_reason": winner_reason,
            "cost_diff": cost_diff,
            "cost_diff_pct": cost_diff_pct,
            "qpso_time_ms": qpso_res["execution_time_ms"],
            "pso_time_ms": pso_res["execution_time_ms"],
            "ga_time_ms": ga_res["execution_time_ms"],
            "sa_time_ms": sa_res["execution_time_ms"],
            "iterations_executed": iters,
            "all_costs": all_costs
        },
        "timing": {
            "dijkstra_refresh_ms": dijkstra_ms,
            "qpso_ms": qpso_res["execution_time_ms"],
            "pso_ms": pso_res["execution_time_ms"],
            "ga_ms": ga_res["execution_time_ms"],
            "sa_ms": sa_res["execution_time_ms"],
            "total_request_ms": total_request_ms
        },
        "tail_improvement_pct": {
            "qpso": qpso_res.get("tail_improvement_pct"),
            "pso": pso_res.get("tail_improvement_pct"),
            "ga": ga_res.get("tail_improvement_pct"),
            "sa": sa_res.get("tail_improvement_pct")
        },
        "city": pune_state.city.to_dict()
    }


# =====================================================================
# REAL-WORLD DELHI (OKHLA PHASE I/II — NEHRU PLACE — KALKAJI) ROAD NETWORK APIS
# =====================================================================

class DelhiGlobalState:
    def __init__(self, build_default: bool = True):
        self.seed: int = 42
        self.num_riders: int = 4
        self.rider_capacity: int = 8
        self.objective: str = "balanced"
        self.w_time: float = 0.6
        self.w_dist: float = 0.4
        self.city: Optional[DelhiCityGraph] = None
        self.deliveries: List[Dict[str, Any]] = []
        self.problem: Optional[VRPProblem] = None
        if build_default:
            self.city = DelhiCityGraph(seed=42)
            self.deliveries = self.city.generate_deliveries(num_deliveries=25, seed=42)
            self.problem = VRPProblem(
                city=self.city,
                deliveries=self.deliveries,
                num_riders=self.num_riders,
                rider_capacity=self.rider_capacity,
                objective=self.objective,
                w_time=self.w_time,
                w_dist=self.w_dist
            )
        self.last_qpso_result: Optional[Dict[str, Any]] = None
        self.last_pso_result: Optional[Dict[str, Any]] = None
        self.last_ga_result: Optional[Dict[str, Any]] = None
        self.last_sa_result: Optional[Dict[str, Any]] = None
        self.last_greedy_result: Optional[Dict[str, Any]] = None
        self.qpso_raw_state: Optional[Dict[str, Any]] = None
        self.pso_raw_state: Optional[Dict[str, Any]] = None
        self.ga_raw_state: Optional[Dict[str, Any]] = None
        self.sa_raw_state: Optional[Dict[str, Any]] = None
        self.active_incidents: List[Dict[str, Any]] = []

delhi_state = DelhiGlobalState()

class DelhiProblemGenerateRequest(BaseModel):
    num_deliveries: int = Field(25, ge=5, le=100)
    num_riders: int = Field(4, ge=1, le=20)
    rider_capacity: int = Field(8, ge=1, le=200)
    objective: str = Field("balanced", pattern="^(time|distance|balanced)$")
    seed: Optional[int] = 42

class DelhiTrafficSimulateRequest(BaseModel):
    incident_count: int = Field(2, ge=1, le=5)
    target_edges: Optional[List[List[str]]] = None

@app.get("/api/delhi/network")
def get_delhi_network():
    """Returns the authentic Delhi Okhla/Nehru Place/Kalkaji network topology, landmarks, and Yamuna river path."""
    return {
        "city": delhi_state.city.to_dict(),
        "config": {
            "num_deliveries": len(delhi_state.deliveries),
            "num_riders": delhi_state.num_riders,
            "rider_capacity": delhi_state.rider_capacity,
            "objective": delhi_state.objective,
            "active_incidents": delhi_state.active_incidents
        }
    }

@app.get("/api/delhi/roads")
def get_delhi_roads():
    """Returns the full 4,602 OpenStreetMap road segments for client-side rendering."""
    roads_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'okhla_roads.json')
    if os.path.exists(roads_file):
        with open(roads_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"roads": []}

def _delhi_generate(state: DelhiGlobalState, req: DelhiProblemGenerateRequest) -> Dict[str, Any]:
    """Generates delivery packages across landmarks and industrial/residential pockets in Okhla & Kalkaji."""
    seed = req.seed if req.seed is not None else 42
    state.seed = seed

    state.city = DelhiCityGraph(seed=seed)
    state.deliveries = state.city.generate_deliveries(num_deliveries=req.num_deliveries, seed=seed)
    state.num_riders = req.num_riders
    state.rider_capacity = req.rider_capacity
    state.objective = req.objective
    state.active_incidents = []

    state.problem = VRPProblem(
        city=state.city,
        deliveries=state.deliveries,
        num_riders=state.num_riders,
        rider_capacity=state.rider_capacity,
        objective=state.objective,
        w_time=state.w_time,
        w_dist=state.w_dist
    )

    state.last_qpso_result = None
    state.last_pso_result = None
    state.last_ga_result = None
    state.last_sa_result = None
    state.last_greedy_result = None
    state.qpso_raw_state = None
    state.pso_raw_state = None
    state.ga_raw_state = None
    state.sa_raw_state = None

    return {
        "message": f"Successfully generated Delhi logistics problem with {req.num_deliveries} stops and {req.num_riders} fleet vehicles.",
        "city": state.city.to_dict(),
        "config": {
            "num_deliveries": req.num_deliveries,
            "num_riders": req.num_riders,
            "rider_capacity": req.rider_capacity,
            "objective": req.objective,
            "seed": seed
        }
    }

def _delhi_optimize(state: DelhiGlobalState, req: OptimizeRequest) -> Dict[str, Any]:
    """
    Executes QPSO, PSO, GA, and SA on the real Delhi Okhla road network.
    """
    opt_seed = req.seed if req.seed is not None else state.seed
    num_deliv = state.problem.num_deliveries
    iters = req.max_iterations if req.max_iterations is not None else min(80, max(30, int(20 + num_deliv * 0.25)))
    num_p = min(req.num_particles, 25) if req.num_particles else 25

    # 1. Run QPSO
    qpso = QPSOOptimizer(
        problem=state.problem,
        num_particles=num_p,
        max_iterations=iters,
        seed=opt_seed
    )
    qpso_res = qpso.optimize()
    state.qpso_raw_state = qpso_res.pop("raw_state", None)
    state.last_qpso_result = qpso_res

    # 2. Run Classical PSO
    pso = ClassicalPSOOptimizer(
        problem=state.problem,
        num_particles=num_p,
        max_iterations=iters,
        w_start=0.9,
        w_end=0.4,
        seed=opt_seed
    )
    pso_res = pso.optimize()
    state.pso_raw_state = pso_res.pop("raw_state", None)
    state.last_pso_result = pso_res

    # 3. Run Genetic Algorithm
    ga = GAOptimizer(
        problem=state.problem,
        population_size=num_p,
        max_iterations=iters,
        crossover_rate=0.85,
        mutation_rate=0.15,
        tournament_size=3,
        elitism_count=2,
        seed=opt_seed
    )
    ga_res = ga.optimize()
    state.ga_raw_state = ga_res.pop("raw_state", None)
    state.last_ga_result = ga_res

    # 4. Run Simulated Annealing
    sa = SAOptimizer(
        problem=state.problem,
        max_iterations=iters,
        initial_temp=100.0,
        final_temp=0.01,
        perturbation_scale=2.0,
        restarts=3,
        seed=opt_seed
    )
    sa_res = sa.optimize()
    state.sa_raw_state = sa_res.pop("raw_state", None)
    state.last_sa_result = sa_res

    # 5. Run Greedy Nearest-Neighbour (Baseline)
    gnn = GreedyNearestNeighbourOptimizer(
        problem=state.problem,
        seed=opt_seed
    )
    greedy_res = gnn.optimize()
    state.last_greedy_result = greedy_res

    # 6. 5-way metrics
    all_results = {
        "QPSO": qpso_res,
        "PSO": pso_res,
        "GA": ga_res,
        "SA": sa_res,
        "Greedy NN": greedy_res
    }
    costs = {name: res["final_cost"] for name, res in all_results.items()}
    winner = min(costs, key=costs.get)
    best_cost = costs[winner]

    qpso_cost = qpso_res["final_cost"]
    pso_cost = pso_res["final_cost"]
    cost_diff = round(pso_cost - qpso_cost, 4)
    cost_diff_pct = round(((pso_cost - qpso_cost) / pso_cost) * 100.0, 2) if pso_cost > 0 else 0.0
    time_diff_ms = round(pso_res["execution_time_ms"] - qpso_res["execution_time_ms"], 2)

    winner_reason = f"{winner} achieved the lowest cost ({best_cost}) across all 5 algorithms on Delhi Okhla network"

    return {
        "timestamp": time.time(),
        "qpso": qpso_res,
        "pso": pso_res,
        "ga": ga_res,
        "sa": sa_res,
        "greedy": greedy_res,
        "comparison": {
            "winner": winner,
            "winner_reason": winner_reason,
            "cost_diff": cost_diff,
            "cost_diff_pct": cost_diff_pct,
            "time_diff_ms": time_diff_ms,
            "qpso_time_ms": qpso_res["execution_time_ms"],
            "pso_time_ms": pso_res["execution_time_ms"],
            "ga_time_ms": ga_res["execution_time_ms"],
            "sa_time_ms": sa_res["execution_time_ms"],
            "greedy_time_ms": greedy_res["execution_time_ms"],
            "iterations_executed": iters,
            "all_costs": costs
        },
        "city": state.city.to_dict()
    }

def _delhi_traffic(state: DelhiGlobalState, req: DelhiTrafficSimulateRequest) -> Dict[str, Any]:
    """
    Simulates real Delhi traffic incidents on active routes or choke points (Mathura Rd, Nehru Place Flyover, Ring Rd).
    """
    t_start = time.perf_counter()
    candidate_edges = []
    if state.last_qpso_result:
        for r_data in state.last_qpso_result["solution"]["rider_routes"]:
            nodes = r_data.get("waypoint_nodes", [])
            for i in range(len(nodes) - 1):
                u, v = nodes[i], nodes[i+1]
                if state.city.graph.has_edge(u, v):
                    candidate_edges.append((u, v))

    incidents = state.city.inject_traffic_incident(
        candidate_edges=candidate_edges if candidate_edges else None,
        count=req.incident_count
    )
    state.active_incidents = incidents

    # Dijkstra matrix refresh
    t_dijkstra_start = time.perf_counter()
    state.problem.refresh_matrices()
    dijkstra_ms = round((time.perf_counter() - t_dijkstra_start) * 1000.0, 2)
    total_ms = round((time.perf_counter() - t_start) * 1000.0, 2)

    return {
        "message": f"Simulated traffic choke points on {len(incidents)} Delhi road segment(s).",
        "incidents": incidents,
        "city": state.city.to_dict(),
        "timing": {
            "dijkstra_refresh_ms": dijkstra_ms,
            "total_request_ms": total_ms
        }
    }

def _delhi_reoptimize(state: DelhiGlobalState, req: OptimizeRequest) -> Dict[str, Any]:
    """
    Warm-started re-optimization for Delhi Okhla graph upon road incidents.
    """
    t_request_start = time.perf_counter()

    # 1. Dijkstra Refresh
    t_dijkstra_start = time.perf_counter()
    if not state.active_incidents:
        state.active_incidents = state.city.inject_traffic_incident(count=2)
    state.problem.refresh_matrices()
    dijkstra_ms = round((time.perf_counter() - t_dijkstra_start) * 1000.0, 2)

    num_deliv = state.problem.num_deliveries
    iters = req.max_iterations if req.max_iterations is not None else min(180, max(60, int(50 + num_deliv * 0.4)))
    opt_seed = req.seed if req.seed is not None else (state.seed + 101)
    num_p = min(req.num_particles, 25) if req.num_particles else 25

    # 2. Warm QPSO
    qpso = QPSOOptimizer(
        problem=state.problem,
        num_particles=num_p,
        max_iterations=iters,
        seed=opt_seed
    )
    qpso_res = qpso.optimize(warm_state=state.qpso_raw_state)
    state.qpso_raw_state = qpso_res.pop("raw_state", None)
    state.last_qpso_result = qpso_res

    # 3. Warm PSO
    pso = ClassicalPSOOptimizer(
        problem=state.problem,
        num_particles=num_p,
        max_iterations=iters,
        w_start=0.9,
        w_end=0.4,
        seed=opt_seed
    )
    pso_res = pso.optimize(warm_state=state.pso_raw_state)
    state.pso_raw_state = pso_res.pop("raw_state", None)
    state.last_pso_result = pso_res

    # 4. Warm GA
    ga = GAOptimizer(
        problem=state.problem,
        population_size=num_p,
        max_iterations=iters,
        seed=opt_seed
    )
    ga_res = ga.optimize(warm_state=state.ga_raw_state)
    state.ga_raw_state = ga_res.pop("raw_state", None)
    state.last_ga_result = ga_res

    # 5. Warm SA
    sa = SAOptimizer(
        problem=state.problem,
        max_iterations=iters,
        num_particles=num_p,
        seed=opt_seed
    )
    sa_res = sa.optimize(warm_state=state.sa_raw_state)
    state.sa_raw_state = sa_res.pop("raw_state", None)
    state.last_sa_result = sa_res

    # 6. Greedy NN Baseline
    gnn = GreedyNearestNeighbourOptimizer(
        problem=state.problem,
        seed=opt_seed
    )
    greedy_res = gnn.optimize()
    state.last_greedy_result = greedy_res

    total_request_ms = round((time.perf_counter() - t_request_start) * 1000.0, 2)

    all_costs = {
        "QPSO": qpso_res["final_cost"],
        "PSO": pso_res["final_cost"],
        "GA": ga_res["final_cost"],
        "SA": sa_res["final_cost"],
        "Greedy NN": greedy_res["final_cost"]
    }
    winner = min(all_costs, key=all_costs.get)
    best_cost = all_costs[winner]

    qpso_cost = qpso_res["final_cost"]
    pso_cost = pso_res["final_cost"]
    cost_diff = round(pso_cost - qpso_cost, 4)
    cost_diff_pct = round(((pso_cost - qpso_cost) / pso_cost) * 100.0, 2) if pso_cost > 0 else 0.0

    winner_reason = f"{winner} achieved lowest cost ({best_cost}) across all 5 algorithms on Delhi Okhla road network"

    return {
        "message": "Warm-started re-optimization complete on Delhi Okhla road network across 5 algorithms.",
        "incidents": state.active_incidents,
        "qpso": qpso_res,
        "pso": pso_res,
        "ga": ga_res,
        "sa": sa_res,
        "greedy": greedy_res,
        "comparison": {
            "winner": winner,
            "winner_reason": winner_reason,
            "cost_diff": cost_diff,
            "cost_diff_pct": cost_diff_pct,
            "qpso_time_ms": qpso_res["execution_time_ms"],
            "pso_time_ms": pso_res["execution_time_ms"],
            "ga_time_ms": ga_res["execution_time_ms"],
            "sa_time_ms": sa_res["execution_time_ms"],
            "greedy_time_ms": greedy_res["execution_time_ms"],
            "iterations_executed": iters,
            "all_costs": all_costs
        },
        "timing": {
            "dijkstra_refresh_ms": dijkstra_ms,
            "qpso_ms": qpso_res["execution_time_ms"],
            "pso_ms": pso_res["execution_time_ms"],
            "ga_ms": ga_res["execution_time_ms"],
            "sa_ms": sa_res["execution_time_ms"],
            "total_request_ms": total_request_ms
        },
        "tail_improvement_pct": {
            "qpso": qpso_res.get("tail_improvement_pct"),
            "pso": pso_res.get("tail_improvement_pct"),
            "ga": ga_res.get("tail_improvement_pct"),
            "sa": sa_res.get("tail_improvement_pct")
        },
        "city": state.city.to_dict()
    }


# Interactive Delhi tab: the steps act on the shared delhi_state
@app.post("/api/delhi/problem/generate")
def generate_delhi_problem(req: DelhiProblemGenerateRequest):
    return _delhi_generate(delhi_state, req)

@app.post("/api/delhi/optimize")
def run_delhi_optimization(req: OptimizeRequest):
    return _delhi_optimize(delhi_state, req)

@app.post("/api/delhi/traffic/simulate")
def simulate_delhi_traffic(req: DelhiTrafficSimulateRequest):
    return _delhi_traffic(delhi_state, req)

@app.post("/api/delhi/reoptimize")
def reoptimize_delhi(req: OptimizeRequest):
    return _delhi_reoptimize(delhi_state, req)


class DelhiDemoRequest(BaseModel):
    num_deliveries: int = Field(40, ge=5, le=100)
    num_riders: int = Field(6, ge=1, le=20)
    rider_capacity: int = Field(20, ge=1, le=200)
    objective: str = Field("balanced", pattern="^(time|distance|balanced)$")
    seed: int = 2
    num_particles: int = Field(25, ge=10, le=25)
    max_iterations: int = Field(60, ge=10, le=200)
    incident_count: int = Field(2, ge=1, le=5)

_demo_cache: Dict[tuple, Dict[str, Any]] = {}
_demo_lock = threading.Lock()

@app.post("/api/delhi/demo")
def run_delhi_demo(req: DelhiDemoRequest):
    """
    Home page walkthrough in a single call: generate -> optimise -> 2 incidents -> warm-started re-optimise.
    Runs on its own private problem (never the shared Delhi tab state), so clicks, other tabs and other
    users cannot change it. The run is deterministic for a given seed and is cached, so every call
    returns the identical response. scripts/run_real_benchmarks.py records its output for the Home page.
    """
    key = tuple(sorted(req.model_dump().items()))
    with _demo_lock:
        if key in _demo_cache:
            return _demo_cache[key]

    state = DelhiGlobalState(build_default=False)
    _delhi_generate(state, DelhiProblemGenerateRequest(
        num_deliveries=req.num_deliveries, num_riders=req.num_riders,
        rider_capacity=req.rider_capacity, objective=req.objective, seed=req.seed
    ))
    opt_req = OptimizeRequest(num_particles=req.num_particles, max_iterations=req.max_iterations, seed=req.seed)
    # Deep copies freeze each step's snapshot before the next step changes the shared city/problem objects
    step1 = copy.deepcopy(_delhi_optimize(state, opt_req))
    traffic_full = _delhi_traffic(state, DelhiTrafficSimulateRequest(incident_count=req.incident_count))
    traffic = copy.deepcopy({k: v for k, v in traffic_full.items() if k != "city"})  # step3 carries the updated city
    step3 = _delhi_reoptimize(state, opt_req)

    result = {"config": req.model_dump(), "step1": step1, "traffic": traffic, "step3": step3}
    with _demo_lock:
        if len(_demo_cache) >= 8:
            _demo_cache.pop(next(iter(_demo_cache)))
        _demo_cache[key] = result
    return result
