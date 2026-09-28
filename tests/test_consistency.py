import sys
import os
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from exact_solver import solve_exact_problem
from optimizers.common import greedy_keys
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
from optimizers.ga import GAOptimizer
from optimizers.sa import SAOptimizer
from optimizers.greedy import GreedyNearestNeighbourOptimizer


def make_problem(n, riders, seed=3):
    city = SyntheticCity(grid_size=6, seed=seed)
    deliveries = city.generate_deliveries(num_deliveries=n, seed=seed)
    return VRPProblem(city=city, deliveries=deliveries, num_riders=riders, rider_capacity_kg=75.0, seed=seed)


def test_search_objective_matches_decoded_routes():
    """The cost the optimizers minimise equals the cost of the routes they decode to (before local search)."""
    problem = make_problem(25, 4)
    rng = np.random.default_rng(0)
    for _ in range(20):
        keys = rng.uniform(-10, 10, size=25)
        decoded = problem.decode_particle(keys, apply_local_search=False)
        assert abs(problem.evaluate(keys) - decoded["fitness"]) < 1e-6


def test_greedy_seeding_never_starts_worse_than_greedy():
    problem = make_problem(30, 4)
    greedy_cost = problem.evaluate(greedy_keys(problem))
    for opt in [
        QPSOOptimizer(problem, num_particles=15, max_iterations=10, seed=1),
        ClassicalPSOOptimizer(problem, num_particles=15, max_iterations=10, seed=1),
        GAOptimizer(problem, population_size=15, max_iterations=10, seed=1),
        SAOptimizer(problem, max_iterations=10, num_particles=15, seed=1),
    ]:
        assert opt.optimize()["pre_local_search_cost"] <= greedy_cost + 1e-6


def test_no_method_beats_the_exact_optimum():
    problem = make_problem(6, 2, seed=5)
    exact = solve_exact_problem(problem)
    assert exact["is_optimal"]
    results = [
        QPSOOptimizer(problem, num_particles=15, max_iterations=15, seed=2).optimize(),
        ClassicalPSOOptimizer(problem, num_particles=15, max_iterations=15, seed=2).optimize(),
        GreedyNearestNeighbourOptimizer(problem).optimize(),
    ]
    for r in results:
        assert r["final_cost"] >= exact["exact_cost"] - 1e-3


def test_convergence_speed_is_reported():
    problem = make_problem(20, 3)
    res = QPSOOptimizer(problem, num_particles=12, max_iterations=15, seed=4).optimize()
    assert 0 <= res["iters_to_1pct"] <= 15
    assert res["evals_to_1pct"] >= 12
