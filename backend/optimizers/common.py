"""
Shared helpers used identically by every optimizer (QPSO, PSO, GA, SA, Greedy NN):
- Greedy nearest-neighbour construction (the baseline tour).
- Initial population seeding: one greedy individual + uniform random keys.
- Convergence-speed metric computed from a convergence history.
"""

from typing import Any, Dict, List
import numpy as np

KEY_LOW, KEY_HIGH = -10.0, 10.0


def greedy_permutation(problem) -> List[int]:
    """
    Nearest-neighbour ordering of deliveries: each vehicle starts at the depot and
    repeatedly takes the closest unvisited stop that still fits its capacity.
    """
    N = problem.num_deliveries
    num_riders = problem.num_riders
    capacity = problem.rider_capacity_kg
    d_depot = problem.d_depot_to_deliv
    d_mat = problem.d_mat
    weights = problem.weights_arr
    target_load = max(10.0, float(np.sum(weights)) / num_riders)
    max_stops = max(2, int(np.ceil(N / num_riders) * 1.4))

    unvisited = set(range(N))
    order: List[int] = []

    for r_idx in range(num_riders):
        if not unvisited:
            break
        curr_load = 0.0
        curr_stops = 0
        prev_stop = -1

        while unvisited:
            best_stop = -1
            best_dist = float("inf")
            for candidate in sorted(unvisited):
                if curr_load + weights[candidate] > capacity and curr_stops > 0:
                    continue
                dist = d_depot[candidate] if prev_stop == -1 else d_mat[prev_stop, candidate]
                if dist < best_dist:
                    best_dist = dist
                    best_stop = candidate

            if best_stop == -1:
                break

            order.append(best_stop)
            unvisited.remove(best_stop)
            curr_load += weights[best_stop]
            curr_stops += 1
            prev_stop = best_stop

            # Soft load threshold to balance vehicles if more riders remain
            if curr_load >= target_load and r_idx < num_riders - 1 and len(unvisited) > (num_riders - 1 - r_idx):
                break
            if curr_stops >= max_stops and r_idx < num_riders - 1:
                break

    # Append any remaining stops (fallback if capacity was tight)
    order.extend(sorted(unvisited))
    return order


def greedy_keys(problem, low: float = KEY_LOW, high: float = KEY_HIGH) -> np.ndarray:
    """Random-key vector whose argsort reproduces the greedy ordering exactly."""
    order = greedy_permutation(problem)
    N = len(order)
    keys = np.zeros(N, dtype=np.float64)
    span = max(1, N - 1)
    for rank, stop_idx in enumerate(order):
        keys[stop_idx] = low + (high - low) * rank / span
    return keys


def initial_population(problem, rng, size: int, seed_greedy: bool = True,
                       low: float = KEY_LOW, high: float = KEY_HIGH) -> np.ndarray:
    """
    Uniform random keys, with individual 0 replaced by the greedy tour when seed_greedy is set.
    Every metaheuristic uses this same initialisation so the comparison stays fair.
    """
    pop = rng.uniform(low, high, size=(size, problem.num_deliveries))
    if seed_greedy and size > 0 and problem.num_deliveries > 0:
        pop[0] = greedy_keys(problem, low, high)
    return pop


def convergence_speed(history: List[Dict[str, Any]], evals_per_iter: int, tolerance: float = 0.01) -> Dict[str, Any]:
    """
    Iterations (and objective evaluations) needed to get within `tolerance` of the final search cost.
    """
    if not history:
        return {"iters_to_1pct": 0, "evals_to_1pct": 0}
    final_cost = history[-1]["cost"]
    target = final_cost + abs(final_cost) * tolerance
    iters = history[-1]["iteration"]
    for point in history:
        if point["cost"] <= target:
            iters = point["iteration"]
            break
    return {
        "iters_to_1pct": int(iters),
        "evals_to_1pct": int((iters + 1) * evals_per_iter)
    }
