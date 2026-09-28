import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from exact_solver import ExactVRPTSolver
from optimizers.qpso import QPSOOptimizer

def test_exact_solver_optimality():
    """Verify that PuLP exact solver returns mathematically optimal solution for small problem."""
    city = SyntheticCity(grid_size=5, seed=42)
    deliveries = city.generate_deliveries(num_deliveries=6, seed=42)
    time_mat, _, _ = city.get_shortest_path_matrices()
    
    solver = ExactVRPTSolver(time_matrix=time_mat, depot_id=city.depot_node, deliveries=deliveries, num_vehicles=2)
    result = solver.solve(time_limit_sec=5)
    
    assert result["is_optimal"] is True
    assert result["exact_cost"] is not None
    assert result["exact_cost"] > 0
    assert len(result["routes"]) >= 1

def test_qpso_near_optimality_gap():
    """Verify that QPSO finds a solution close to the exact solver optimal ground truth."""
    city = SyntheticCity(grid_size=5, seed=42)
    deliveries = city.generate_deliveries(num_deliveries=6, seed=42)
    
    # QPSO problem instance initializes delivery weights and time windows
    problem = VRPProblem(city=city, deliveries=deliveries, num_riders=2, objective="time", seed=42)
    
    # Exact ground truth on identical problem parameters
    solver = ExactVRPTSolver(time_matrix=problem.time_matrix, depot_id=city.depot_node, deliveries=problem.deliveries, num_vehicles=2)
    exact_res = solver.solve(time_limit_sec=5)
    
    qpso = QPSOOptimizer(problem=problem, num_particles=30, max_iterations=50, seed=42)
    qpso_res = qpso.optimize()
    
    assert qpso_res["final_cost"] >= exact_res["exact_cost"] * 0.95 # Ground truth floor
    gap_pct = ((qpso_res["final_cost"] - exact_res["exact_cost"]) / exact_res["exact_cost"]) * 100.0
    assert gap_pct < 50.0

def test_exact_solver_timeout_handling():
    """Verify that when exact solver times out, is_optimal is False and status reflects Timeout."""
    city = SyntheticCity(grid_size=6, seed=42)
    # 12 deliveries = 479 million permutations, will easily timeout in 0.05 seconds
    deliveries = city.generate_deliveries(num_deliveries=12, seed=42)
    time_mat, _, _ = city.get_shortest_path_matrices()
    
    solver = ExactVRPTSolver(time_matrix=time_mat, depot_id=city.depot_node, deliveries=deliveries, num_vehicles=3)
    result = solver.solve(time_limit_sec=0.05)
    
    assert result["is_optimal"] is False
    assert "Timeout" in result["status"]
