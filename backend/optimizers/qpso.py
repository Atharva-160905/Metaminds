"""
Canonical Quantum-Behaved Particle Swarm Optimization (QPSO) Engine.
Formulation based on Sun, Xu, Feng et al. (Delta-Potential-Well Model).

Supports Warm-Starting, Partial Re-Initialization for Dynamic Traffic Changes,
and Convergence Confidence Metrics.
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import time

class QPSOOptimizer:
    def __init__(
        self,
        problem,
        num_particles: int = 40,
        max_iterations: int = 100,
        alpha_start: float = 0.85,
        alpha_end: float = 0.40,
        seed: Optional[int] = 42
    ):
        self.problem = problem
        self.dimension = problem.num_deliveries
        self.num_particles = max(10, num_particles)
        self.max_iterations = max(10, max_iterations)
        self.alpha_start = alpha_start
        self.alpha_end = alpha_end
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def optimize(self, warm_state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes QPSO optimization.
        Supports warm-starting from prior swarm state upon traffic changes.
        """
        start_time = time.perf_counter()
        
        low_bound, high_bound = -10.0, 10.0
        reinitialized_indices = []
        
        if warm_state is not None and "X" in warm_state and "P" in warm_state:
            # 1. Warm-start from existing swarm
            X = np.copy(warm_state["X"])
            P = np.copy(warm_state["P"])
            old_P_fit = np.copy(warm_state.get("P_fit", np.zeros(self.num_particles)))
            
            # Re-evaluate all personal bests on the updated distance/time matrix
            P_fit = np.zeros(self.num_particles)
            for i in range(self.num_particles):
                P_fit[i] = self.problem.evaluate(P[i])
                
            # Identify affected particles (cost degraded by incident)
            degradation_ratios = []
            for i in range(self.num_particles):
                ratio = P_fit[i] / (old_P_fit[i] + 1e-6) if old_P_fit[i] > 0 else 1.0
                degradation_ratios.append((ratio, i))
                
            degradation_ratios.sort(key=lambda x: x[0], reverse=True)
            num_reinit = max(2, int(self.num_particles * 0.25))
            
            # Reinitialize only the affected particles to inject fresh quantum exploration
            for k in range(num_reinit):
                ratio, idx = degradation_ratios[k]
                if ratio > 1.05 or k < 2:
                    X[idx] = self.rng.uniform(low_bound, high_bound, size=self.dimension)
                    P[idx] = np.copy(X[idx])
                    P_fit[idx] = self.problem.evaluate(P[idx])
                    reinitialized_indices.append(idx)
                    
            g_best_idx = int(np.argmin(P_fit))
            G = np.copy(P[g_best_idx])
            G_fit = float(P_fit[g_best_idx])
            
            # In warm start, start alpha at a balanced exploration level
            effective_alpha_start = 0.85
        else:
            # Cold initialization
            X = self.rng.uniform(low_bound, high_bound, size=(self.num_particles, self.dimension))
            P = np.copy(X)
            P_fit = np.zeros(self.num_particles)
            for i in range(self.num_particles):
                P_fit[i] = self.problem.evaluate(P[i])
                
            g_best_idx = int(np.argmin(P_fit))
            G = np.copy(P[g_best_idx])
            G_fit = float(P_fit[g_best_idx])
            effective_alpha_start = self.alpha_start

        convergence_history: List[Dict[str, Any]] = [
            {"iteration": 0, "cost": round(G_fit, 4)}
        ]
        
        # Iteration Loop
        for t in range(1, self.max_iterations + 1):
            alpha = effective_alpha_start - (effective_alpha_start - self.alpha_end) * (t / self.max_iterations)
            mbest = np.mean(P, axis=0)
            
            for i in range(self.num_particles):
                phi = self.rng.uniform(0.0, 1.0, size=self.dimension)
                p_i = phi * P[i] + (1.0 - phi) * G
                
                u = self.rng.uniform(0.0, 1.0, size=self.dimension)
                u = np.clip(u, 1e-7, 1.0 - 1e-7)
                
                sign_mask = np.where(self.rng.uniform(0.0, 1.0, size=self.dimension) > 0.5, 1.0, -1.0)
                step = sign_mask * alpha * np.abs(mbest - X[i]) * np.log(1.0 / u)
                X[i] = p_i + step
                X[i] = np.clip(X[i], low_bound, high_bound)
                
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
        
        # Calculate real convergence confidence metric
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
            "algorithm": "QPSO",
            "algorithm_name": "Quantum-Behaved Particle Swarm Optimization",
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
                "P": P,
                "P_fit": P_fit,
                "G": G,
                "G_fit": G_fit
            },
            "solution": best_solution
        }
