from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer

print("=== MAP 2 (50 STOPS): TESTING SEEDS ===")
for s in [5, 12, 17, 21, 33, 44, 55, 77, 88, 101, 202, 555]:
    city = SyntheticCity(grid_size=8, seed=s)
    deliv = city.generate_deliveries(num_deliveries=50, seed=s)
    prob = VRPProblem(city, deliv, num_riders=5, rider_capacity=12, objective="balanced")
    q0 = QPSOOptimizer(prob, num_particles=35, max_iterations=80, seed=s).optimize()
    p0 = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=80, seed=s).optimize()
    
    city.inject_traffic_incident(count=2)
    prob.refresh_matrices()
    
    q_re = QPSOOptimizer(prob, num_particles=35, max_iterations=80, seed=s).optimize(warm_state=q0["raw_state"])
    p_re = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=80, seed=s).optimize(warm_state=p0["raw_state"])
    
    w_clear = "PSO" if p0['final_cost'] < q0['final_cost'] else "QPSO"
    w_traffic = "QPSO" if q_re['final_cost'] < p_re['final_cost'] else "PSO"
    adv = ((p_re['final_cost'] - q_re['final_cost']) / p_re['final_cost']) * 100.0
    print(f"Seed {s:3d}: Clear [QPSO={q0['final_cost']:.2f} vs PSO={p0['final_cost']:.2f} ({w_clear} wins)] -> Traffic [QPSO={q_re['final_cost']:.2f} vs PSO={p_re['final_cost']:.2f} ({w_traffic} wins, {adv:+.2f}%)]")
