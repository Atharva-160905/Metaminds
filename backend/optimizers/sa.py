"""
Simulated Annealing (SA) Optimizer for SmartRoute-Q SIH 2026.
Uses continuous-valued vector with argsort decoding (same encoding as PSO/QPSO/GA).
Cooling Schedule: Exponential decay with localized Gaussian / swap perturbations.
Supports Warm-Starting for dynamic re-routing scenarios.
"""

from typing import Dict, List, Any, Optional
import numpy as np
import time

from .common import initial_population, convergence_speed


class SAOptimizer:
    def __init__(
        self,
        problem,
        max_iterations: int = 100,
        num_particles: int = 25,
        initial_temp: float = 100.0,
        final_temp: float = 0.01,
        perturbation_scale: float = 2.0,
        restarts: int = 3,
        seed: Optional[int] = 42,
        seed_greedy: bool = True
    ):
        self.problem = problem
        self.dimension = problem.num_deliveries
        self.max_iterations = max(10, max_iterations)
        self.num_particles = max(1, num_particles)
        self.T_init = initial_temp
        self.T_final = final_temp
        self.perturbation_scale = perturbation_scale
        self.restarts = max(1, restarts)
        self.seed = seed
        self.seed_greedy = seed_greedy
        self.rng = np.random.default_rng(seed)

    def _perturb(self, x: np.ndarray, temp: float) -> np.ndarray:
        """Perturbs a localized subset of continuous keys (1-3 dimensions) or performs swap."""
        cand = np.copy(x)
        if self.rng.random() < 0.4 and self.dimension > 1:
            idx1, idx2 = self.rng.choice(self.dimension, size=2, replace=False)
            cand[idx1], cand[idx2] = cand[idx2], cand[idx1]
        else:
            k = min(self.dimension, int(self.rng.integers(1, 4)))
            indices = self.rng.choice(self.dimension, size=k, replace=False)
            scale = self.perturbation_scale * max(0.05, temp / self.T_init)
            cand[indices] += self.rng.normal(0.0, scale, size=k)
        return np.clip(cand, -10.0, 10.0)

    def _acceptance_prob(self, delta_cost: float, temp: float) -> float:
        """Metropolis acceptance criterion."""
        if delta_cost < 0:
            return 1.0
        return float(np.exp(-delta_cost / max(temp, 1e-10)))

    def optimize(self, warm_state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes multi-restart Simulated Annealing with equalized evaluation budget.
        Supports warm-starting from a prior solution state for dynamic traffic re-routing.
        """
        start_time = time.perf_counter()

        low_bound, high_bound = -10.0, 10.0
        reinitialized_count = 0

        # Track convergence at iteration granularity across all restarts
        iters_per_restart = max(1, self.max_iterations // self.restarts)
        total_iter = 0

        # Cooling rate computed per restart to reach T_final
        alpha = (self.T_final / self.T_init) ** (1.0 / iters_per_restart)

        # Determine starting solutions for each restart
        if warm_state is not None and "G" in warm_state:
            # Warm start: use the global best from prior optimization as seed
            warm_solution = np.copy(warm_state["G"])
            if len(warm_solution) == self.dimension:
                global_best = warm_solution
            else:
                global_best = initial_population(self.problem, self.rng, 1, self.seed_greedy)[0]
            global_best_cost = self.problem.evaluate(global_best)
            reinitialized_count = 1
        else:
            # Cold start: first restart begins from the greedy tour (same seeding as the swarms)
            global_best = initial_population(self.problem, self.rng, 1, self.seed_greedy)[0]
            global_best_cost = self.problem.evaluate(global_best)

        convergence_history: List[Dict[str, Any]] = [
            {"iteration": 0, "cost": round(global_best_cost, 4)}
        ]

        steps_per_iter = max(1, self.num_particles)

        for restart in range(self.restarts):
            if restart == 0:
                current = np.copy(global_best)
                current_cost = global_best_cost
            else:
                current = self.rng.uniform(low_bound, high_bound, size=self.dimension)
                current_cost = self.problem.evaluate(current)

            local_best = np.copy(current)
            local_best_cost = current_cost
            temp = self.T_init

            for t in range(iters_per_restart):
                total_iter += 1

                # Equalize budget: explore proposals per iteration
                for _ in range(steps_per_iter):
                    candidate = self._perturb(current, temp)
                    candidate_cost = self.problem.evaluate(candidate)

                    # Metropolis acceptance
                    delta = candidate_cost - current_cost
                    if delta < 0 or self.rng.random() < self._acceptance_prob(delta, temp):
                        current = candidate
                        current_cost = candidate_cost

                        if current_cost < local_best_cost:
                            local_best = np.copy(current)
                            local_best_cost = current_cost

                # Exponential cooling
                temp *= alpha

                # Update global best
                if local_best_cost < global_best_cost:
                    global_best = np.copy(local_best)
                    global_best_cost = local_best_cost

                convergence_history.append({
                    "iteration": total_iter,
                    "cost": round(float(global_best_cost), 4)
                })

        best_solution = self.problem.decode_particle(global_best)
        execution_time_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        # Convergence confidence: tail flatness
        tail_len = max(5, int(self.max_iterations * 0.15))
        tail_len = min(tail_len, len(convergence_history) - 1)
        init_tail_cost = convergence_history[-tail_len]["cost"]
        final_tail_cost = convergence_history[-1]["cost"]
        tail_improvement_pct = round(
            max(0.0, (init_tail_cost - final_tail_cost) / (init_tail_cost + 1e-6) * 100), 2
        )

        return {
            "algorithm": "SA",
            "algorithm_name": "Simulated Annealing (Gaussian + Multi-Restart)",
            "execution_time_ms": execution_time_ms,
            "iterations": self.max_iterations,
            "population_size": self.restarts,  # SA "population" is restart count
            "final_cost": round(float(best_solution["fitness"]), 4),
            "pre_local_search_cost": round(float(global_best_cost), 4),
            "local_search": best_solution.get("local_search"),
            "convergence_history": convergence_history,
            "tail_improvement_pct": tail_improvement_pct,
            **convergence_speed(convergence_history, self.num_particles),
            "reinitialized_particles": reinitialized_count,
            "is_warm_started": warm_state is not None,
            "raw_state": {
                "X": global_best.reshape(1, -1),  # Current best as population of 1
                "P": global_best.reshape(1, -1),
                "P_fit": np.array([global_best_cost]),
                "G": global_best,
                "G_fit": global_best_cost
            },
            "solution": best_solution
        }
