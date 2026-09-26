from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
import numpy as np

class TunedVRP(VRPProblem):
    def _get_permutation(self, vec: np.ndarray) -> np.ndarray:
        keys = (self.polar_angles * 4.0) + (np.clip(vec, -5.0, 5.0) * 0.4)
        return np.argsort(keys)

print("=== CONGESTED ROAD BENCHMARK (WITH TRAFFIC) ===")
for size in [20, 50, 100, 250, 500]:
    riders = max(2, int(np.ceil(size / 10.0)))
    cap = max(10, int(np.ceil(size / riders * 1.2)))
    grid_sz = 8 if size <= 150 else (10 if size <= 300 else 12)
    city = SyntheticCity(grid_size=grid_sz, seed=42)
    deliv = city.generate_deliveries(num_deliveries=size, seed=42)
    city.inject_traffic_incident(count=3)
    prob = TunedVRP(city, deliv, num_riders=riders, rider_capacity=cap, objective="balanced")
    iters = min(220, max(80, int(60 + size * 0.35)))
    
    q = QPSOOptimizer(prob, num_particles=35, max_iterations=iters, alpha_start=0.85, alpha_end=0.40, seed=42)
    q_res = q.optimize()
    
    p = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=iters, seed=42)
    p_res = p.optimize()
    
    diff_pct = round(((p_res["final_cost"] - q_res["final_cost"]) / p_res["final_cost"]) * 100.0, 2)
    w = "QPSO" if q_res["final_cost"] < p_res["final_cost"] else ("PSO" if p_res["final_cost"] < q_res["final_cost"] else "TIE")
    print(f"Size {size:3d}: QPSO={q_res['final_cost']:.4f} | PSO={p_res['final_cost']:.4f} | Winner: {w:4s} ({diff_pct:+.2f}%)")
