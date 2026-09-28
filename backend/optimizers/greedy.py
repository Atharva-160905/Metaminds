"""
Greedy Nearest-Neighbour (Greedy NN) Heuristic Baseline for QuantaRoute SIH 2026.

Serves as the canonical deterministic heuristic baseline:
- Starts each vehicle at the central depot.
- Repeatedly selects the nearest valid unvisited delivery stop by travel distance/time
  subject to vehicle payload capacity and shift constraints.
- When capacity is reached or time exceeded, returns to depot and deploys next vehicle.
"""

from typing import Dict, List, Any, Optional
import numpy as np
import time

from .common import greedy_keys


class GreedyNearestNeighbourOptimizer:
    def __init__(
        self,
        problem,
        seed: Optional[int] = 42
    ):
        self.problem = problem
        self.dimension = problem.num_deliveries
        self.num_riders = problem.num_riders
        self.capacity = problem.rider_capacity_kg
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def optimize(self, warm_state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes the Greedy Nearest-Neighbour heuristic routing.
        """
        start_time = time.perf_counter()

        N = self.dimension
        if N == 0:
            vec = np.zeros(0)
            best_solution = self.problem.decode_particle(vec)
            return {
                "algorithm": "Greedy NN",
                "algorithm_name": "Greedy Nearest-Neighbour (Baseline)",
                "execution_time_ms": 0.1,
                "iterations": 1,
                "population_size": 1,
                "final_cost": 0.0,
                "pre_local_search_cost": 0.0,
                "local_search": None,
                "convergence_history": [{"iteration": 0, "cost": 0.0}],
                "tail_improvement_pct": 0.0,
                "reinitialized_particles": 0,
                "is_warm_started": False,
                "solution": best_solution
            }

        # Same nearest-neighbour construction used to seed every metaheuristic
        chromosome = greedy_keys(self.problem)

        # Standard decoding and evaluation
        best_solution = self.problem.decode_particle(chromosome, apply_local_search=True)
        raw_fitness = self.problem.evaluate(chromosome)
        exec_time_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        return {
            "algorithm": "Greedy NN",
            "algorithm_name": "Greedy Nearest-Neighbour (Baseline)",
            "execution_time_ms": exec_time_ms,
            "iterations": 1,
            "population_size": 1,
            "final_cost": round(float(best_solution["fitness"]), 4),
            "pre_local_search_cost": round(float(raw_fitness), 4),
            "local_search": best_solution.get("local_search"),
            "convergence_history": [
                {"iteration": 0, "cost": round(float(raw_fitness), 4)},
                {"iteration": 1, "cost": round(float(best_solution["fitness"]), 4)}
            ],
            "tail_improvement_pct": 0.0,
            "iters_to_1pct": 0,
            "evals_to_1pct": 1,
            "reinitialized_particles": 0,
            "is_warm_started": False,
            "solution": best_solution
        }
