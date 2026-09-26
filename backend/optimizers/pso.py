"""
Classical Particle Swarm Optimization (PSO) Engine for SmartRoute-Q SIH 2026.
Supports Warm-Starting, Partial Re-Initialization for Dynamic Traffic Changes,
and Convergence Confidence Metrics.
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import time

class ClassicalPSOOptimizer:
    def __init__(
        self,
        problem,
        num_particles: int = 40,
        max_iterations: int = 100,
        w_start: float = 0.9,
        w_end: float = 0.4,
        c1: float = 1.8,
        c2: float = 1.8,
        seed: Optional[int] = 42
    ):
        self.problem = problem
        self.dimension = problem.num_deliveries
        self.num_particles = max(10, num_particles)
        self.max_iterations = max(10, max_iterations)
        self.w_start = w_start
        self.w_end = w_end
        self.c1 = c1
        self.c2 = c2
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def optimize(self, warm_state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes Classical PSO.
        Supports warm-starting from a prior swarm state when traffic changes.
        """
        start_time = time.perf_counter()
        
        low_bound, high_bound = -10.0, 10.0
        v_max = (high_bound - low_bound) * 0.2
        v_min = -v_max
        
        reinitialized_indices = []
        
        if warm_state is not None and "X" in warm_state and "P" in warm_state:
            # 1. Warm-start from existing swarm
            X = np.copy(warm_state["X"])
            V = np.copy(warm_state.get("V", self.rng.uniform(v_min, v_max, size=(self.num_particles, self.dimension))))
            P = np.copy(warm_state["P"])
            old_P_fit = np.copy(warm_state.get("P_fit", np.zeros(self.num_particles)))
            
            # Re-evaluate all personal bests on the updated distance matrix
            P_fit = np.zeros(self.num_particles)
            for i in range(self.num_particles):
                P_fit[i] = self.problem.evaluate(P[i])
                
            # Identify affected particles (cost degraded by > 15% or top 25% worst degraded)
            degradation_ratios = []
            for i in range(self.num_particles):
                ratio = P_fit[i] / (old_P_fit[i] + 1e-6) if old_P_fit[i] > 0 else 1.0
                degradation_ratios.append((ratio, i))
                
            # Sort by highest degradation
            degradation_ratios.sort(key=lambda x: x[0], reverse=True)
            num_reinit = max(2, int(self.num_particles * 0.25))
            
            # Reinitialize only the affected particles
            for k in range(num_reinit):
                ratio, idx = degradation_ratios[k]
                if ratio > 1.05 or k < 2: # Affected by incident
                    X[idx] = self.rng.uniform(low_bound, high_bound, size=self.dimension)
                    V[idx] = self.rng.uniform(v_min, v_max, size=self.dimension)
                    P[idx] = np.copy(X[idx])
                    P_fit[idx] = self.problem.evaluate(P[idx])
                    reinitialized_indices.append(idx)
                    
            g_best_idx = int(np.argmin(P_fit))
            G = np.copy(P[g_best_idx])
            G_fit = float(P_fit[g_best_idx])
        else:
            # Cold initialization
            X = self.rng.uniform(low_bound, high_bound, size=(self.num_particles, self.dimension))
            V = self.rng.uniform(v_min, v_max, size=(self.num_particles, self.dimension))
            P = np.copy(X)
            P_fit = np.zeros(self.num_particles)
            for i in range(self.num_particles):
                P_fit[i] = self.problem.evaluate(P[i])
                
            g_best_idx = int(np.argmin(P_fit))
            G = np.copy(P[g_best_idx])
            G_fit = float(P_fit[g_best_idx])

        convergence_history: List[Dict[str, Any]] = [
            {"iteration": 0, "cost": round(G_fit, 4)}
        ]
        
        # 4. Iteration loop
        for t in range(1, self.max_iterations + 1):
            w = self.w_start - (self.w_start - self.w_end) * (t / self.max_iterations)
            
            for i in range(self.num_particles):
                r1 = self.rng.uniform(0.0, 1.0, size=self.dimension)
                r2 = self.rng.uniform(0.0, 1.0, size=self.dimension)
                
                V[i] = (
                    w * V[i]
                    + self.c1 * r1 * (P[i] - X[i])
                    + self.c2 * r2 * (G - X[i])
                )
                V[i] = np.clip(V[i], v_min, v_max)
                X[i] = np.clip(X[i] + V[i], low_bound, high_bound)
                
                fit_val = self.problem.evaluate(X[i])
                
                if fit_val < P_fit[i]:
                    P[i] = np.copy(X[i])
                    P_fit[i] = fit_val
                    
                    if fit_val < G_fit:
                        G = np.copy(X[i])
                        G_fit = fit_val
            
            convergence_history.append({
                "iteration": t,
                "cost": round(float(G_fit), 4)
            })

        execution_time_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        
        # Calculate real convergence confidence based on tail flatness
        tail_len = max(5, int(self.max_iterations * 0.15))
        init_tail_cost = convergence_history[-tail_len]["cost"]
        final_tail_cost = convergence_history[-1]["cost"]
        tail_delta_pct = (init_tail_cost - final_tail_cost) / (init_tail_cost + 1e-6)
        
        if tail_delta_pct < 0.005:
            confidence = round(0.95 + min(0.04, (0.005 - tail_delta_pct) * 10), 2)
            confidence_status = "High (Converged)"
        elif tail_delta_pct < 0.025:
            confidence = round(0.80 + (0.025 - tail_delta_pct) * 7.5, 2)
            confidence_status = "Medium (Stabilizing)"
        else:
            confidence = round(max(0.40, 0.75 - tail_delta_pct * 5), 2)
            confidence_status = "Low (Still Improving)"

        best_solution = self.problem.decode_particle(G)
        
        return {
            "algorithm": "PSO",
            "algorithm_name": "Classical Particle Swarm Optimization",
            "execution_time_ms": execution_time_ms,
            "iterations": self.max_iterations,
            "population_size": self.num_particles,
            "final_cost": round(float(G_fit), 4),
            "convergence_history": convergence_history,
            "convergence_confidence": confidence,
            "convergence_status": confidence_status,
            "reinitialized_particles": len(reinitialized_indices),
            "is_warm_started": warm_state is not None,
            "raw_state": {
                "X": X,
                "V": V,
                "P": P,
                "P_fit": P_fit,
                "G": G,
                "G_fit": G_fit
            },
            "solution": best_solution
        }
