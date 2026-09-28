"""
Genetic Algorithm (GA) Optimizer for SmartRoute-Q SIH 2026.
Uses continuous-valued chromosomes with argsort decoding (same encoding as PSO/QPSO).
Operators: Tournament Selection, BLX-α Crossover, Gaussian Mutation.
Supports Warm-Starting for dynamic re-routing scenarios.
"""

from typing import Dict, List, Any, Optional
import numpy as np
import time

from .common import initial_population, convergence_speed


class GAOptimizer:
    def __init__(
        self,
        problem,
        population_size: int = 40,
        max_iterations: int = 100,
        crossover_rate: float = 0.85,
        mutation_rate: float = 0.15,
        tournament_size: int = 3,
        elitism_count: int = 2,
        seed: Optional[int] = 42,
        seed_greedy: bool = True
    ):
        self.problem = problem
        self.dimension = problem.num_deliveries
        self.pop_size = max(10, population_size)
        self.max_iterations = max(10, max_iterations)
        self.crossover_rate = crossover_rate
        self.mutation_rate = mutation_rate
        self.tournament_size = min(tournament_size, self.pop_size)
        self.elitism_count = min(elitism_count, self.pop_size // 2)
        self.seed = seed
        self.seed_greedy = seed_greedy
        self.rng = np.random.default_rng(seed)

    def _tournament_select(self, pop: np.ndarray, fitness: np.ndarray) -> int:
        """Tournament selection: pick tournament_size random individuals, return the fittest."""
        candidates = self.rng.choice(self.pop_size, size=self.tournament_size, replace=False)
        best_idx = candidates[0]
        for c in candidates[1:]:
            if fitness[c] < fitness[best_idx]:
                best_idx = c
        return int(best_idx)

    def _blx_alpha_crossover(self, p1: np.ndarray, p2: np.ndarray, alpha: float = 0.5) -> tuple:
        """BLX-α crossover: offspring genes sampled from expanded parent range."""
        d_min = np.minimum(p1, p2)
        d_max = np.maximum(p1, p2)
        span = d_max - d_min
        low = d_min - alpha * span
        high = d_max + alpha * span
        child1 = self.rng.uniform(low, high)
        child2 = self.rng.uniform(low, high)
        return child1, child2

    def _gaussian_mutate(self, chromosome: np.ndarray, sigma: float = 1.0) -> np.ndarray:
        """Gaussian mutation with adaptive sigma."""
        mask = self.rng.random(self.dimension) < self.mutation_rate
        noise = self.rng.normal(0.0, sigma, size=self.dimension)
        chromosome[mask] += noise[mask]
        return chromosome

    def optimize(self, warm_state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes the Genetic Algorithm.
        Supports warm-starting from a prior population state for dynamic traffic re-routing.
        """
        start_time = time.perf_counter()

        low_bound, high_bound = -10.0, 10.0
        reinitialized_indices = []

        if warm_state is not None and "X" in warm_state:
            # Warm-start: reuse prior population
            old_pop = np.asarray(warm_state["X"])
            old_fit = np.asarray(warm_state.get("P_fit", []))

            if old_pop.ndim == 2 and old_pop.shape[1] == self.dimension and len(old_pop) > 0:
                pop = self.rng.uniform(low_bound, high_bound, size=(self.pop_size, self.dimension))
                copy_n = min(len(old_pop), self.pop_size)
                pop[:copy_n] = old_pop[:copy_n]

                # Re-evaluate on updated distance matrix
                fitness = np.array([self.problem.evaluate(pop[i]) for i in range(self.pop_size)])

                # Identify degraded individuals and reinitialize them
                degradation = np.zeros(self.pop_size)
                for i in range(self.pop_size):
                    old_val = old_fit[i] if i < len(old_fit) and old_fit[i] > 0 else fitness[i]
                    degradation[i] = fitness[i] / (old_val + 1e-6)

                sorted_indices = np.argsort(-degradation)  # worst degradation first
                num_reinit = max(2, int(self.pop_size * 0.25))
                for k in range(num_reinit):
                    idx = sorted_indices[k]
                    if degradation[idx] > 1.05 or k < 2:
                        pop[idx] = self.rng.uniform(low_bound, high_bound, size=self.dimension)
                        fitness[idx] = self.problem.evaluate(pop[idx])
                        reinitialized_indices.append(int(idx))
            else:
                pop = initial_population(self.problem, self.rng, self.pop_size, self.seed_greedy)
                fitness = np.array([self.problem.evaluate(pop[i]) for i in range(self.pop_size)])
        else:
            # Cold initialization (greedy tour + random keys, identical for every optimizer)
            pop = initial_population(self.problem, self.rng, self.pop_size, self.seed_greedy)
            fitness = np.array([self.problem.evaluate(pop[i]) for i in range(self.pop_size)])

        # Track global best
        g_best_idx = int(np.argmin(fitness))
        g_best = np.copy(pop[g_best_idx])
        g_best_fit = float(fitness[g_best_idx])

        convergence_history: List[Dict[str, Any]] = [
            {"iteration": 0, "cost": round(g_best_fit, 4)}
        ]

        # Generational loop
        for gen in range(1, self.max_iterations + 1):
            # Adaptive mutation sigma: decreases over generations
            sigma = 2.0 * (1.0 - gen / self.max_iterations) + 0.1

            # Elitism: carry over the best individuals unchanged
            elite_indices = np.argsort(fitness)[:self.elitism_count]
            new_pop = np.copy(pop[elite_indices])
            new_fit = fitness[elite_indices].copy()

            # Fill the rest of the population via selection, crossover, mutation
            while len(new_pop) < self.pop_size:
                p1_idx = self._tournament_select(pop, fitness)
                p2_idx = self._tournament_select(pop, fitness)

                if self.rng.random() < self.crossover_rate:
                    c1, c2 = self._blx_alpha_crossover(pop[p1_idx], pop[p2_idx])
                else:
                    c1 = np.copy(pop[p1_idx])
                    c2 = np.copy(pop[p2_idx])

                c1 = self._gaussian_mutate(c1, sigma)
                c2 = self._gaussian_mutate(c2, sigma)

                c1 = np.clip(c1, low_bound, high_bound)
                c2 = np.clip(c2, low_bound, high_bound)

                f1 = self.problem.evaluate(c1)
                f2 = self.problem.evaluate(c2)

                new_pop = np.vstack([new_pop, c1.reshape(1, -1)])
                new_fit = np.append(new_fit, f1)

                if len(new_pop) < self.pop_size:
                    new_pop = np.vstack([new_pop, c2.reshape(1, -1)])
                    new_fit = np.append(new_fit, f2)

            # Trim to exact population size
            pop = new_pop[:self.pop_size]
            fitness = new_fit[:self.pop_size]

            # Update global best
            gen_best_idx = int(np.argmin(fitness))
            if fitness[gen_best_idx] < g_best_fit:
                g_best = np.copy(pop[gen_best_idx])
                g_best_fit = float(fitness[gen_best_idx])

            convergence_history.append({
                "iteration": gen,
                "cost": round(float(g_best_fit), 4)
            })

        best_solution = self.problem.decode_particle(g_best)
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
            "algorithm": "GA",
            "algorithm_name": "Genetic Algorithm (BLX-α + Tournament)",
            "execution_time_ms": execution_time_ms,
            "iterations": self.max_iterations,
            "population_size": self.pop_size,
            "final_cost": round(float(best_solution["fitness"]), 4),
            "pre_local_search_cost": round(float(g_best_fit), 4),
            "local_search": best_solution.get("local_search"),
            "convergence_history": convergence_history,
            "tail_improvement_pct": tail_improvement_pct,
            **convergence_speed(convergence_history, self.pop_size),
            "reinitialized_particles": len(reinitialized_indices),
            "is_warm_started": warm_state is not None,
            "raw_state": {
                "X": pop,
                "P": pop,          # For GA, population IS the personal bests
                "P_fit": fitness,
                "G": g_best,
                "G_fit": g_best_fit
            },
            "solution": best_solution
        }
