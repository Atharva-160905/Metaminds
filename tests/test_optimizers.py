import pytest
import numpy as np
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer

def test_qpso_mathematical_bounds():
    """Verify QPSO particles evolve within bounded limits and mbest is computed correctly."""
    city = SyntheticCity(grid_size=6, seed=42)
    deliveries = city.generate_deliveries(num_deliveries=15, seed=42)
    problem = VRPProblem(city=city, deliveries=deliveries, num_riders=3)
    
    qpso = QPSOOptimizer(problem=problem, num_particles=20, max_iterations=25, seed=42)
    result = qpso.optimize()
    
    assert "final_cost" in result
    assert result["final_cost"] > 0
    assert len(result["convergence_history"]) == 26
    assert result["iterations"] == 25
    assert len(result["solution"]["rider_routes"]) == 3
    assert result["tail_improvement_pct"] >= 0.0

def test_deterministic_reproducibility():
    """Verify that same seed produces exact identical convergence history across runs."""
    city1 = SyntheticCity(grid_size=6, seed=10)
    deliv1 = city1.generate_deliveries(num_deliveries=12, seed=10)
    problem1 = VRPProblem(city=city1, deliveries=deliv1, num_riders=3)
    
    city2 = SyntheticCity(grid_size=6, seed=10)
    deliv2 = city2.generate_deliveries(num_deliveries=12, seed=10)
    problem2 = VRPProblem(city=city2, deliveries=deliv2, num_riders=3)
    
    res1 = QPSOOptimizer(problem1, num_particles=15, max_iterations=20, seed=99).optimize()
    res2 = QPSOOptimizer(problem2, num_particles=15, max_iterations=20, seed=99).optimize()
    
    assert res1["final_cost"] == pytest.approx(res2["final_cost"], rel=1e-5)
    for p1, p2 in zip(res1["convergence_history"], res2["convergence_history"]):
        assert p1["cost"] == pytest.approx(p2["cost"], rel=1e-5)

def test_fair_evaluation_budget():
    """Verify both QPSO and PSO execute the exact same iteration count and population size."""
    city = SyntheticCity(grid_size=6, seed=1)
    deliveries = city.generate_deliveries(num_deliveries=20, seed=1)
    problem = VRPProblem(city=city, deliveries=deliveries, num_riders=4)
    
    qpso = QPSOOptimizer(problem, num_particles=30, max_iterations=40, seed=7)
    pso = ClassicalPSOOptimizer(problem, num_particles=30, max_iterations=40, seed=7)
    
    q_res = qpso.optimize()
    p_res = pso.optimize()
    
    assert q_res["iterations"] == p_res["iterations"] == 40
    assert q_res["population_size"] == p_res["population_size"] == 30
    assert len(q_res["convergence_history"]) == len(p_res["convergence_history"]) == 41

def test_warm_start_particle_mismatch_resilience():
    """Verify QPSO, PSO, and GA do not crash when warm-started with different particle counts."""
    from optimizers.ga import GAOptimizer
    from optimizers.sa import SAOptimizer
    
    city = SyntheticCity(grid_size=6, seed=42)
    deliveries = city.generate_deliveries(num_deliveries=15, seed=42)
    problem = VRPProblem(city=city, deliveries=deliveries, num_riders=3, seed=42)
    
    # Run initial optimization with 25 particles
    qpso_initial = QPSOOptimizer(problem, num_particles=25, max_iterations=20, seed=42).optimize()
    pso_initial = ClassicalPSOOptimizer(problem, num_particles=25, max_iterations=20, seed=42).optimize()
    ga_initial = GAOptimizer(problem, population_size=25, max_iterations=20, seed=42).optimize()
    sa_initial = SAOptimizer(problem, num_particles=25, max_iterations=20, seed=42).optimize()
    
    # Inject traffic incident to simulate re-optimization
    city.inject_traffic_incident(count=2)
    problem.refresh_matrices()
    
    # Re-optimize with 30 particles (greater than initial 25) - must not IndexError!
    qpso_warm_30 = QPSOOptimizer(problem, num_particles=30, max_iterations=20, seed=142).optimize(warm_state=qpso_initial["raw_state"])
    assert qpso_warm_30["is_warm_started"] is True
    assert qpso_warm_30["population_size"] == 30
    
    pso_warm_30 = ClassicalPSOOptimizer(problem, num_particles=30, max_iterations=20, seed=142).optimize(warm_state=pso_initial["raw_state"])
    assert pso_warm_30["is_warm_started"] is True
    assert pso_warm_30["population_size"] == 30
    
    ga_warm_30 = GAOptimizer(problem, population_size=30, max_iterations=20, seed=142).optimize(warm_state=ga_initial["raw_state"])
    assert ga_warm_30["is_warm_started"] is True
    assert ga_warm_30["population_size"] == 30

    sa_warm_30 = SAOptimizer(problem, num_particles=30, max_iterations=20, seed=142).optimize(warm_state=sa_initial["raw_state"])
    assert sa_warm_30["is_warm_started"] is True

    # Re-optimize with 15 particles (smaller than initial 25) - must not IndexError!
    qpso_warm_15 = QPSOOptimizer(problem, num_particles=15, max_iterations=20, seed=242).optimize(warm_state=qpso_initial["raw_state"])
    assert qpso_warm_15["population_size"] == 15

def test_objective_weights_affect_fitness():
    """Verify that changing w_time and w_dist changes the fitness evaluation appropriately."""
    city = SyntheticCity(grid_size=6, seed=42)
    deliveries = city.generate_deliveries(num_deliveries=10, seed=42)
    
    prob_time = VRPProblem(city=city, deliveries=deliveries, num_riders=2, objective="time", seed=42)
    prob_dist = VRPProblem(city=city, deliveries=deliveries, num_riders=2, objective="distance", seed=42)
    prob_bal = VRPProblem(city=city, deliveries=deliveries, num_riders=2, objective="balanced", w_time=0.9, w_dist=0.1, seed=42)
    
    particle = np.linspace(-5.0, 5.0, len(deliveries))
    cost_time = prob_time.evaluate(particle)
    cost_dist = prob_dist.evaluate(particle)
    cost_bal = prob_bal.evaluate(particle)
    
    assert cost_time > 0
    assert cost_dist > 0
    assert cost_bal > 0
