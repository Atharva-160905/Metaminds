from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
import numpy as np

for map_name, size, riders, cap in [
    ("Map 1 (20 stops)", 20, 3, 8),
    ("Map 2 (50 stops)", 50, 5, 12),
    ("Map 3 (100 stops)", 100, 8, 15),
]:
    print(f"\n=================== {map_name.upper()} ===================")
    city = SyntheticCity(grid_size=8, seed=42)
    deliv = city.generate_deliveries(num_deliveries=size, seed=42)
    prob = VRPProblem(city, deliv, num_riders=riders, rider_capacity=cap, objective="balanced")
    iters = min(220, max(80, int(60 + size * 0.35)))
    
    # 1. Clear run
    q0 = QPSOOptimizer(prob, num_particles=35, max_iterations=iters, alpha_start=0.85, alpha_end=0.40, seed=42).optimize()
    p0 = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=iters, seed=42).optimize()
    
    w0 = "QPSO" if q0['final_cost'] < p0['final_cost'] else ("PSO" if p0['final_cost'] < q0['final_cost'] else "TIE")
    print(f"CLEAR ROAD:   QPSO={q0['final_cost']:.4f} vs PSO={p0['final_cost']:.4f} -> Winner: {w0}")
    
    # 2. Inject traffic
    city.inject_traffic_incident(count=2)
    prob.refresh_matrices()
    
    # 3. Warm-start reoptimize
    q_re = QPSOOptimizer(prob, num_particles=35, max_iterations=iters, alpha_start=0.85, alpha_end=0.40, seed=42).optimize(warm_state=q0["raw_state"])
    p_re = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=iters, seed=42).optimize(warm_state=p0["raw_state"])
    
    w_re = "QPSO" if q_re['final_cost'] < p_re['final_cost'] else ("PSO" if p_re['final_cost'] < q_re['final_cost'] else "TIE")
    diff_pct = round(((p_re["final_cost"] - q_re["final_cost"]) / p_re["final_cost"]) * 100.0, 2)
    print(f"WITH TRAFFIC: QPSO={q_re['final_cost']:.4f} vs PSO={p_re['final_cost']:.4f} -> Winner: {w_re} ({diff_pct:+.2f}%)")
