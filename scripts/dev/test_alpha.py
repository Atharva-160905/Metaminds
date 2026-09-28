from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
import numpy as np

# Test with tuned alpha
for alpha_start, alpha_end in [(1.0, 0.5), (0.85, 0.4), (0.75, 0.35)]:
    city = SyntheticCity(grid_size=10, seed=42)
    deliv = city.generate_deliveries(num_deliveries=100, seed=42)
    city.inject_traffic_incident(count=3)
    prob = VRPProblem(city, deliv, num_riders=10, rider_capacity=12, objective="balanced")
    
    q = QPSOOptimizer(prob, num_particles=35, max_iterations=100, alpha_start=alpha_start, alpha_end=alpha_end, seed=42)
    q_res = q.optimize()
    
    p = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=100, seed=42)
    p_res = p.optimize()
    print(f"Alpha ({alpha_start}, {alpha_end}): QPSO={q_res['final_cost']:.4f} vs PSO={p_res['final_cost']:.4f} -> Diff: {p_res['final_cost'] - q_res['final_cost']:.4f}")
