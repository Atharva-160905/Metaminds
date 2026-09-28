import numpy as np
from city_graph import SyntheticCity
from vrp_problem import VRPProblem
from optimizers.qpso import QPSOOptimizer
from optimizers.pso import ClassicalPSOOptimizer

sizes = [20, 50, 100, 250, 500]
seed = 42

def run_suite(traffic_condition, alpha_start, alpha_end):
    rows = []
    for size in sizes:
        riders = max(2, int(np.ceil(size / 10.0)))
        cap = max(10, int(np.ceil(size / riders * 1.2)))
        grid_sz = 8 if size <= 150 else (10 if size <= 300 else 12)
        
        city = SyntheticCity(grid_size=grid_sz, seed=seed)
        deliv = city.generate_deliveries(num_deliveries=size, seed=seed)
        
        if traffic_condition == "congested":
            city.inject_traffic_incident(count=3)
            
        prob = VRPProblem(city, deliv, num_riders=riders, rider_capacity=cap, objective="balanced")
        iters = min(220, max(80, int(60 + size * 0.35)))
        
        qpso = QPSOOptimizer(
            problem=prob,
            num_particles=35,
            max_iterations=iters,
            alpha_start=alpha_start,
            alpha_end=alpha_end,
            seed=seed
        )
        qpso_res = qpso.optimize()
        
        pso = ClassicalPSOOptimizer(
            problem=prob,
            num_particles=35,
            max_iterations=iters,
            seed=seed
        )
        pso_res = pso.optimize()
        
        q_cost = qpso_res["final_cost"]
        p_cost = pso_res["final_cost"]
        
        cost_diff = round(p_cost - q_cost, 4)
        cost_diff_pct = round(((p_cost - q_cost) / p_cost) * 100.0, 2) if p_cost > 0 else 0.0
        
        if q_cost < p_cost:
            winner = "QPSO"
        elif p_cost < q_cost:
            winner = "PSO"
        else:
            winner = "TIE"
            
        rows.append({
            "size": size,
            "riders": riders,
            "cap": cap,
            "qpso_cost": q_cost,
            "pso_cost": p_cost,
            "diff_pct": cost_diff_pct,
            "qpso_time": qpso_res["execution_time_ms"],
            "pso_time": pso_res["execution_time_ms"],
            "winner": winner
        })
    return rows

print("--- 1. CONGESTED WITH ALPHA 0.85 -> 0.40 ---")
rows_1 = run_suite("congested", 0.85, 0.40)
for r in rows_1:
    print(r)

print("\n--- 2. CONGESTED WITH ORIGINAL ALPHA 1.0 -> 0.50 ---")
rows_2 = run_suite("congested", 1.0, 0.50)
for r in rows_2:
    print(r)

print("\n--- 5A. CLEAR ROAD BASELINE (ALPHA 0.85 -> 0.40) ---")
rows_5a = run_suite("clear", 0.85, 0.40)
for r in rows_5a:
    print(r)

print("\n--- 5B. CONGESTED NETWORK (ALPHA 0.85 -> 0.40) ---")
rows_5b = run_suite("congested", 0.85, 0.40)
for r in rows_5b:
    print(r)
