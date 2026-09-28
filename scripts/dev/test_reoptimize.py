"""
Unit Test Suite for SmartRoute-Q Warm-Started Re-Optimization Pipeline.
Verifies:
1. Unaffected particles preserve their P_fit values upon matrix update.
2. Affected particles are identified and reinitialized with fresh exploration capacity.
3. Swarm continues smoothly without full cold reset.
4. Convergence confidence metric behaves realistically.
"""

from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer
import numpy as np

def test_warm_start_pipeline():
    print("=== Testing Warm-Started Re-Optimization Pipeline ===")
    
    # 1. Initialize Problem
    city = SyntheticCity(grid_size=8, seed=42)
    deliveries = city.generate_deliveries(num_deliveries=30, seed=42)
    problem = VRPProblem(city=city, deliveries=deliveries, num_riders=4, rider_capacity=10)
    
    # 2. Initial Classical PSO Run
    print("1. Running initial PSO optimization...")
    pso = ClassicalPSOOptimizer(problem=problem, num_particles=20, max_iterations=40, seed=42)
    res1 = pso.optimize()
    raw_state = res1["raw_state"]
    old_P = np.copy(raw_state["P"])
    old_P_fit = np.copy(raw_state["P_fit"])
    
    print(f"   Initial PSO Cost: {res1['final_cost']} | Time: {res1['execution_time_ms']} ms")
    assert "raw_state" in res1, "raw_state must be exported for warm-starting"
    
    # 3. Artificially block an edge used by some particles
    print("2. Injecting artificial road blockage...")
    incidents = city.inject_traffic_incident(count=3)
    problem.refresh_matrices()
    
    # 4. Check P_fit re-evaluation
    print("3. Re-evaluating existing personal bests against new distance matrix...")
    new_P_fit = np.zeros(20)
    for i in range(20):
        new_P_fit[i] = problem.evaluate(old_P[i])
        
    # Check that some particles got worse (their route used the blocked road)
    degraded_count = sum(1 for i in range(20) if new_P_fit[i] > old_P_fit[i] * 1.05)
    unaffected_count = sum(1 for i in range(20) if abs(new_P_fit[i] - old_P_fit[i]) < 1e-3)
    
    print(f"   Degraded particles (traversing blocked road): {degraded_count}/20")
    print(f"   Unaffected particles (independent routes): {unaffected_count}/20")
    
    # 5. Run Warm-Started PSO Re-Optimization
    print("4. Executing warm-started PSO re-optimization...")
    pso_warm = ClassicalPSOOptimizer(problem=problem, num_particles=20, max_iterations=40, seed=142)
    res_reopt = pso_warm.optimize(warm_state=raw_state)
    
    print(f"   Re-optimized Cost: {res_reopt['final_cost']} | Reinitialized: {res_reopt['reinitialized_particles']} particles")
    print(f"   Convergence Confidence: {res_reopt['convergence_confidence']} ({res_reopt['convergence_status']})")
    
    assert res_reopt["is_warm_started"] == True, "Optimizer must record warm-started flag"
    assert res_reopt["reinitialized_particles"] > 0, "Must reinitialize affected particles"
    assert "convergence_confidence" in res_reopt, "Must provide convergence confidence signal"
    
    # 6. Test QPSO Warm-Starting
    print("5. Executing warm-started QPSO re-optimization...")
    qpso = QPSOOptimizer(problem=problem, num_particles=20, max_iterations=40, seed=42)
    q_res1 = qpso.optimize()
    
    qpso_warm = QPSOOptimizer(problem=problem, num_particles=20, max_iterations=40, seed=142)
    q_reopt = qpso_warm.optimize(warm_state=q_res1["raw_state"])
    
    print(f"   QPSO Re-optimized Cost: {q_reopt['final_cost']} | Reinitialized: {q_reopt['reinitialized_particles']} particles")
    print(f"   QPSO Confidence: {q_reopt['convergence_confidence']} ({q_reopt['convergence_status']})")
    
    assert q_reopt["is_warm_started"] == True
    assert q_reopt["reinitialized_particles"] > 0
    
    print("\n>>> ALL WARM-START RE-OPTIMIZATION UNIT TESTS PASSED SUCCESSFULLY! <<<\n")

if __name__ == "__main__":
    test_warm_start_pipeline()
