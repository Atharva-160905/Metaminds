from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
import numpy as np

# Let's inspect Map #3 (100 stops, 8 riders, capacity 15)
city = SyntheticCity(grid_size=8, seed=42)
deliv = city.generate_deliveries(num_deliveries=100, seed=42)
prob = VRPProblem(city, deliv, num_riders=8, rider_capacity=15, objective="balanced")

print("=== DIAGNOSING MAP 3 (100 STOPS, 8 RIDERS) ===")
# Inspect particle decoding
q = QPSOOptimizer(prob, num_particles=35, max_iterations=115, alpha_start=0.85, alpha_end=0.40, seed=42)
q_res = q.optimize()

p = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=115, seed=42)
p_res = p.optimize()

print(f"QPSO Cost: {q_res['final_cost']} | Time: {q_res['solution']['total_time_min']} min | Dist: {q_res['solution']['total_dist_km']} km")
print(f"PSO Cost:  {p_res['final_cost']} | Time: {p_res['solution']['total_time_min']} min | Dist: {p_res['solution']['total_dist_km']} km")

# Let's see why QPSO cost is higher: look at the rider route lengths in both!
print("\nQPSO Rider Delivery Counts:", [len(r['deliveries']) for r in q_res['solution']['rider_routes']])
print("PSO Rider Delivery Counts: ", [len(r['deliveries']) for r in p_res['solution']['rider_routes']])
