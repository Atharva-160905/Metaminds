"""
Backend verification script for SmartRoute-Q.
"""
from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer

def test_pipeline():
    print("1. Initializing synthetic city...")
    city = SyntheticCity(grid_size=8, seed=42)
    deliveries = city.generate_deliveries(num_deliveries=20, seed=42)
    print(f"   Nodes: {len(city.graph.nodes)}, Edges: {len(city.graph.edges)}, Deliveries: {len(deliveries)}")
    
    print("2. Initializing VRP Problem...")
    problem = VRPProblem(city=city, deliveries=deliveries, num_riders=3, rider_capacity=8, objective="balanced")
    
    print("3. Running QPSO (20 particles, 30 iterations)...")
    qpso = QPSOOptimizer(problem=problem, num_particles=20, max_iterations=30, seed=42)
    q_res = qpso.optimize()
    print(f"   QPSO Final Cost: {q_res['final_cost']} in {q_res['execution_time_ms']}ms")
    assert len(q_res["convergence_history"]) == 31
    assert len(q_res["solution"]["rider_routes"]) == 3
    
    print("4. Running Classical PSO (20 particles, 30 iterations)...")
    pso = ClassicalPSOOptimizer(problem=problem, num_particles=20, max_iterations=30, seed=42)
    p_res = pso.optimize()
    print(f"   PSO Final Cost: {p_res['final_cost']} in {p_res['execution_time_ms']}ms")
    assert len(p_res["convergence_history"]) == 31
    assert len(p_res["solution"]["rider_routes"]) == 3
    
    print("5. Testing traffic incident injection...")
    incidents = city.inject_traffic_incident(count=2)
    print(f"   Injected {len(incidents)} incidents: {incidents[0]['road_name']} ({incidents[0]['old_time']} -> {incidents[0]['new_time']})")
    problem.refresh_matrices()
    
    print("6. Re-optimizing on congested graph...")
    qpso_re = QPSOOptimizer(problem=problem, num_particles=20, max_iterations=20, seed=142).optimize()
    print(f"   QPSO Re-optimized Cost: {qpso_re['final_cost']} in {qpso_re['execution_time_ms']}ms")
    
    print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_pipeline()
