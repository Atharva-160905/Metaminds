from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
import numpy as np

print("=== REAL-TIME EMERGENCY REROUTING (40-ITERATION BURST) ===")
for seed in [42, 101, 202, 303, 555]:
    city = SyntheticCity(grid_size=8, seed=seed)
    deliv = city.generate_deliveries(num_deliveries=50, seed=seed)
    prob = VRPProblem(city, deliv, num_riders=5, rider_capacity=12, objective="balanced")
    
    # Initial clear run (80 iterations)
    q0 = QPSOOptimizer(prob, num_particles=35, max_iterations=80, seed=seed).optimize()
    p0 = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=80, seed=seed).optimize()
    
    # Inject 2 traffic incidents
    city.inject_traffic_incident(count=2)
    prob.refresh_matrices()
    
    # Re-optimization in a fast 40-iteration real-time burst
    q_re = QPSOOptimizer(prob, num_particles=35, max_iterations=45, seed=seed+1).optimize(warm_state=q0["raw_state"])
    p_re = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=45, seed=seed+1).optimize(warm_state=p0["raw_state"])
    
    diff_pct = round(((p_re["final_cost"] - q_re["final_cost"]) / p_re["final_cost"]) * 100.0, 2)
    w = "QPSO" if q_re["final_cost"] < p_re["final_cost"] else "PSO"
    print(f"Seed {seed:3d}: Clear [QPSO={q0['final_cost']:.2f} vs PSO={p0['final_cost']:.2f}] | Traffic [QPSO={q_re['final_cost']:.2f} vs PSO={p_re['final_cost']:.2f}] -> Winner: {w:4s} ({diff_pct:+.2f}%)")
