from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
import numpy as np

# Test authentic classical PSO inertia on warm start
class AuthenticPSO(ClassicalPSOOptimizer):
    def optimize(self, warm_state=None):
        start_time = 0
        import time
        t_start = time.perf_counter()
        low_bound, high_bound = -10.0, 10.0
        v_max = (high_bound - low_bound) * 0.2
        v_min = -v_max
        
        if warm_state is not None:
            # Retain authentic velocity inertia without artificial teleportation
            X = np.copy(warm_state["X"])
            V = np.copy(warm_state.get("V", self.rng.uniform(v_min, v_max, size=(self.num_particles, self.dimension))))
            P = np.copy(warm_state["P"])
            
            P_fit = np.zeros(self.num_particles)
            for i in range(self.num_particles):
                P_fit[i] = self.problem.evaluate(P[i])
                
            g_best_idx = int(np.argmin(P_fit))
            G = np.copy(P[g_best_idx])
            G_fit = float(P_fit[g_best_idx])
        else:
            X = self.rng.uniform(low_bound, high_bound, size=(self.num_particles, self.dimension))
            V = self.rng.uniform(v_min, v_max, size=(self.num_particles, self.dimension))
            P = np.copy(X)
            P_fit = np.zeros(self.num_particles)
            for i in range(self.num_particles):
                P_fit[i] = self.problem.evaluate(P[i])
            g_best_idx = int(np.argmin(P_fit))
            G = np.copy(P[g_best_idx])
            G_fit = float(P_fit[g_best_idx])
            
        for t in range(1, self.max_iterations + 1):
            w = self.w_start - (self.w_start - self.w_end) * (t / self.max_iterations)
            for i in range(self.num_particles):
                r1 = self.rng.uniform(0.0, 1.0, size=self.dimension)
                r2 = self.rng.uniform(0.0, 1.0, size=self.dimension)
                V[i] = w * V[i] + self.c1 * r1 * (P[i] - X[i]) + self.c2 * r2 * (G - X[i])
                V[i] = np.clip(V[i], v_min, v_max)
                X[i] = np.clip(X[i] + V[i], low_bound, high_bound)
                fit = self.problem.evaluate(X[i])
                if fit < P_fit[i]:
                    P[i] = np.copy(X[i])
                    P_fit[i] = fit
                    if fit < G_fit:
                        G = np.copy(X[i])
                        G_fit = fit
        exec_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
        return {"final_cost": round(float(G_fit), 4), "execution_time_ms": exec_ms, "raw_state": {"X": X, "V": V, "P": P, "P_fit": P_fit}}

print("=== TESTING AUTHENTIC VELOCITY INERTIA UNDER TRAFFIC ===")
for seed in [42, 101, 202, 303, 555]:
    city = SyntheticCity(grid_size=8, seed=seed)
    deliv = city.generate_deliveries(num_deliveries=50, seed=seed)
    prob = VRPProblem(city, deliv, num_riders=5, rider_capacity=12, objective="balanced")
    
    # Initial clear run
    q0 = QPSOOptimizer(prob, num_particles=35, max_iterations=80, seed=seed).optimize()
    p0 = AuthenticPSO(prob, num_particles=35, max_iterations=80, seed=seed).optimize()
    
    # Inject 2 traffic incidents
    city.inject_traffic_incident(count=2)
    prob.refresh_matrices()
    
    # Re-optimization
    q_re = QPSOOptimizer(prob, num_particles=35, max_iterations=80, seed=seed+1).optimize(warm_state=q0["raw_state"])
    p_re = AuthenticPSO(prob, num_particles=35, max_iterations=80, seed=seed+1).optimize(warm_state=p0["raw_state"])
    
    diff_pct = round(((p_re["final_cost"] - q_re["final_cost"]) / p_re["final_cost"]) * 100.0, 2)
    w = "QPSO" if q_re["final_cost"] < p_re["final_cost"] else "PSO"
    print(f"Seed {seed:3d}: Clear [QPSO={q0['final_cost']:.2f} vs PSO={p0['final_cost']:.2f}] | Traffic [QPSO={q_re['final_cost']:.2f} vs PSO={p_re['final_cost']:.2f}] -> Winner: {w:4s} ({diff_pct:+.2f}%)")
