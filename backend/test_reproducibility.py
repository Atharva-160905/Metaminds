import numpy as np
from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer

def run_sequence(run_id, seed=42):
    print(f"\n================ RUN {run_id} (Seed {seed}) ================")
    city = SyntheticCity(grid_size=10, seed=seed)
    deliv = city.generate_deliveries(num_deliveries=200, seed=seed)
    prob = VRPProblem(city, deliv, num_riders=20, rider_capacity=12, objective="balanced")
    iters = min(220, max(80, int(60 + 200 * 0.35))) # 130 iters
    
    # 0. Initial Optimization
    qpso = QPSOOptimizer(prob, num_particles=35, max_iterations=iters, alpha_start=0.85, alpha_end=0.40, seed=seed)
    q_res = qpso.optimize()
    qpso_state = q_res.pop("raw_state", None)
    
    pso = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=iters, seed=seed)
    p_res = pso.optimize()
    pso_state = p_res.pop("raw_state", None)
    
    print(f"Round 0 (Initial): QPSO={q_res['final_cost']:.4f} | PSO={p_res['final_cost']:.4f}")
    
    # 5 Consecutive Incident Injections + Re-optimizations
    for r in range(1, 6):
        incidents = city.inject_traffic_incident(count=2)
        prob.refresh_matrices()
        
        # Warm-started re-optimization
        q_opt = QPSOOptimizer(prob, num_particles=35, max_iterations=iters, alpha_start=0.85, alpha_end=0.40, seed=seed + r * 10)
        q_res = q_opt.optimize(warm_state=qpso_state)
        qpso_reinit = q_res.get("reinitialized_particles", 0)
        qpso_state = q_res.pop("raw_state", None)
        
        p_opt = ClassicalPSOOptimizer(prob, num_particles=35, max_iterations=iters, seed=seed + r * 10)
        p_res = p_opt.optimize(warm_state=pso_state)
        pso_reinit = p_res.get("reinitialized_particles", 0)
        pso_state = p_res.pop("raw_state", None)
        
        print(f"Round {r} (Incident + Reroute): QPSO={q_res['final_cost']:.4f} (Reinit: {qpso_reinit}) | PSO={p_res['final_cost']:.4f} (Reinit: {pso_reinit})")

run_sequence(1, seed=42)
run_sequence(2, seed=42)
