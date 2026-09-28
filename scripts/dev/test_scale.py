from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
import numpy as np

for scale_factor in [0.8, 0.4, 0.2, 0.1]:
    class ModifiedVRP(VRPProblem):
        def _get_permutation(self, vec: np.ndarray) -> np.ndarray:
            # Bounded continuous key perturbation so intra-cluster ordering is optimized
            keys = (self.polar_angles * 4.0) + (np.clip(vec, -5.0, 5.0) * scale_factor)
            return np.argsort(keys)

    print(f"\n--- Testing Perturbation Scale {scale_factor} ---")
    for size in [50, 100, 250]:
        riders = max(2, int(np.ceil(size / 10.0)))
        cap = max(10, int(np.ceil(size / riders * 1.2)))
        city = SyntheticCity(grid_size=10, seed=42)
        deliv = city.generate_deliveries(num_deliveries=size, seed=42)
        city.inject_traffic_incident(count=3)
        prob = ModifiedVRP(city, deliv, num_riders=riders, rider_capacity=cap, objective="balanced")
        
        q = QPSOOptimizer(prob, num_particles=35, max_iterations=100, alpha_start=0.85, alpha_end=0.40, seed=42)
        q_res = q.optimize()
        
        p = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=100, seed=42)
        p_res = p.optimize()
        
        diff = p_res["final_cost"] - q_res["final_cost"]
        w = "QPSO" if diff > 0 else "PSO"
        print(f"Size {size:3d}: QPSO={q_res['final_cost']:.4f} | PSO={p_res['final_cost']:.4f} | Diff: {diff:+.4f} | Winner: {w}")
