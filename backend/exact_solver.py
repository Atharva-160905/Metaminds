"""
Exact solvers for small VRPTW instances (ground truth for benchmarking, practical up to ~8 stops).
Exhaustive enumeration of every delivery ordering combined with an optimal dynamic-programming
split into vehicle routes. No external solver dependencies.

- ExactVRPTSolver: standalone time-based cost model (kept for backwards compatibility).
- solve_exact_problem(): uses VRPProblem.eval_single_route directly, so the optimum is computed
  under exactly the same objective, penalties and fleet size as the metaheuristics.
"""

from typing import Dict, List, Tuple, Any, Optional
import itertools
import time
import math

class ExactVRPTSolver:
    def __init__(
        self,
        time_matrix: Dict[str, Dict[str, float]],
        depot_id: str,
        deliveries: List[Dict[str, Any]],
        num_vehicles: int = 2,
        max_capacity: float = 60.0
    ):
        self.time_matrix = time_matrix
        self.depot_id = depot_id
        self.deliveries = deliveries
        self.num_vehicles = max(1, num_vehicles)
        self.max_capacity = max_capacity
        self.num_deliveries = len(deliveries)
        
    def _evaluate_tour(self, order: Tuple[int, ...]) -> Tuple[float, List[List[int]]]:
        """Calculates exact trip cost and cuts tour across vehicles respecting capacity."""
        N = len(order)
        if N == 0:
            return 0.0, [[] for _ in range(self.num_vehicles)]
            
        # DP Split across vehicles
        INF = 1e9
        V = [INF] * (N + 1)
        P = [0] * (N + 1)
        V[0] = 0.0
        
        for i in range(N):
            if V[i] >= INF:
                continue
            load = 0.0
            curr = self.depot_id
            t_curr = 0.0
            tw_pen = 0.0
            
            for j in range(i + 1, N + 1):
                d_idx = order[j - 1]
                deliv = self.deliveries[d_idx]
                target = deliv["node_id"]
                load += deliv.get("weight_kg", 5.0)
                
                t_curr += self.time_matrix.get(curr, {}).get(target, 999.0)
                tw = deliv.get("time_window", [0.0, 300.0])
                if t_curr < tw[0]:
                    t_curr = tw[0]
                elif t_curr > tw[1]:
                    tw_pen += (t_curr - tw[1]) * 50.0
                t_curr += deliv.get("service_time_min", 3.0)
                curr = target
                
                ret_t = self.time_matrix.get(curr, {}).get(self.depot_id, 999.0)
                trip_t = t_curr + ret_t
                cap_pen = max(0.0, load - self.max_capacity) * 500.0
                    
                cost = trip_t + tw_pen + cap_pen
                if V[i] + cost < V[j]:
                    V[j] = V[i] + cost
                    P[j] = i
                    
        # Backtrack routes
        routes = []
        curr = N
        while curr > 0:
            prev = P[curr]
            routes.append(list(order[prev:curr]))
            curr = prev
        routes.reverse()
        
        # Check fleet constraint
        if len(routes) > self.num_vehicles:
            return INF, routes
            
        while len(routes) < self.num_vehicles:
            routes.append([])
            
        return V[N], routes

    def solve(self, time_limit_sec: float = 10.0) -> Dict[str, Any]:
        """Exhaustively searches all permutations to find the guaranteed mathematical global optimum."""
        start_time = time.perf_counter()
        best_cost = 1e9
        best_routes = []
        best_perm = None
        did_timeout = False
        
        indices = list(range(self.num_deliveries))
        
        # Enumerate all permutations
        for perm in itertools.permutations(indices):
            if (time.perf_counter() - start_time) > time_limit_sec:
                did_timeout = True
                break
                
            cost, routes = self._evaluate_tour(perm)
            if cost < best_cost:
                best_cost = cost
                best_routes = routes
                best_perm = perm
                
        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        
        formatted_routes = []
        for v_idx, r in enumerate(best_routes):
            stops = [self.depot_id] + [self.deliveries[i]["node_id"] for i in r] + [self.depot_id] if r else []
            formatted_routes.append({"vehicle_id": v_idx + 1, "stops": stops, "indices": r})
            
        if did_timeout:
            status = "Timeout (Suboptimal)" if best_cost < 1e8 else "Timeout (Infeasible)"
            is_optimal = False
        else:
            status = "Optimal" if best_cost < 1e8 else "Infeasible"
            is_optimal = best_cost < 1e8

        return {
            "status": status,
            "is_optimal": is_optimal,
            "exact_cost": round(float(best_cost), 4) if best_cost < 1e8 else None,
            "solve_time_ms": elapsed_ms,
            "routes": formatted_routes,
            "optimal_permutation": list(best_perm) if best_perm else []
        }


def solve_exact_problem(problem, time_limit_sec: float = 120.0) -> Dict[str, Any]:
    """
    Global optimum of `problem` (a VRPProblem) over all orderings and all splits into at most
    problem.num_riders routes, scored with problem.eval_single_route. Reports a timeout instead of
    optimality if the enumeration does not finish within time_limit_sec.
    """
    start_time = time.perf_counter()
    N = problem.num_deliveries
    K = problem.num_riders
    INF = float("inf")
    seg_cache: Dict[Tuple[int, ...], float] = {}

    def seg_cost(seg: Tuple[int, ...]) -> float:
        cost = seg_cache.get(seg)
        if cost is None:
            cost = problem.eval_single_route(list(seg))[0]
            seg_cache[seg] = cost
        return cost

    best_cost = INF
    best_routes: List[List[int]] = []
    did_timeout = False

    for perm in itertools.permutations(range(N)):
        if (time.perf_counter() - start_time) > time_limit_sec:
            did_timeout = True
            break
        # f[k][j]: cheapest cost of serving perm[:j] with exactly k routes
        f = [[INF] * (N + 1) for _ in range(K + 1)]
        back = [[-1] * (N + 1) for _ in range(K + 1)]
        f[0][0] = 0.0
        for k in range(1, K + 1):
            for j in range(1, N + 1):
                for i in range(k - 1, j):
                    if f[k - 1][i] == INF:
                        continue
                    c = f[k - 1][i] + seg_cost(perm[i:j])
                    if c < f[k][j]:
                        f[k][j] = c
                        back[k][j] = i
        k_best = min(range(1, K + 1), key=lambda k: f[k][N])
        if f[k_best][N] < best_cost - 1e-9:
            best_cost = f[k_best][N]
            routes, j, k = [], N, k_best
            while k > 0:
                i = back[k][j]
                routes.append(list(perm[i:j]))
                j, k = i, k - 1
            best_routes = list(reversed(routes))

    elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
    while len(best_routes) < K:
        best_routes.append([])
    return {
        "status": "Timeout (Suboptimal)" if did_timeout else "Optimal",
        "is_optimal": not did_timeout,
        "exact_cost": round(float(best_cost), 4) if best_cost < INF else None,
        "solve_time_ms": elapsed_ms,
        "routes": best_routes,
    }
