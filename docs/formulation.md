# SmartRoute-Q: Mathematical Formulation (CVRPTW with dynamic travel times)

This document describes exactly what the code in `backend/vrp_problem.py` optimises.

---

## 1. Road network and travel times
The road network is a weighted graph $G = (V, E)$. Each edge has a length $d_e$ (km) and a travel time
$\tau_e = \tau_e^{\text{base}} \cdot c_e$, where $c_e \ge 1$ is a congestion factor ($c_e = 1$ normally,
about 5 on edges hit by a simulated traffic incident).

Between every pair of relevant locations (depot $0$ and customers $C = \{1,\dots,N\}$) we precompute
shortest-path travel times $t_{ij}$ and distances $d_{ij}$ with Dijkstra. When an incident changes $c_e$,
the matrices are recomputed and the optimisers re-plan (warm start).

## 2. Fleet and customers
- $K$ identical vans with capacity $Q$ (kg) and maximum shift length $T^{\max} = 240$ min, all starting and ending at the depot.
- Customer $i$ has parcel weight $q_i$ (kg), service time $s_i = 3$ min and delivery window $[e_i, l_i]$ (minutes after dispatch).

## 3. Route cost
For one van visiting customers $r = (r_1, \dots, r_m)$ in order, arrival times follow
$a_{r_1} = t_{0 r_1}$, $a_{r_{k+1}} = \max(a_{r_k}, e_{r_k}) + s_{r_k} + t_{r_k r_{k+1}}$
(arriving early means waiting until $e_i$; it is not penalised). The route's total time $T_r$ includes the
return to the depot, and $D_r$ is its total distance.

$$
\text{cost}(r) = w_t T_r + w_d D_r
+ 50 \sum_{i \in r} \max(0, a_i - l_i)
+ 500 \max\big(0, \textstyle\sum_{i \in r} q_i - Q\big)
+ 100 \max(0, T_r - T^{\max})
$$

with $(w_t, w_d) = (0.6, 0.4)$ for the default *balanced* objective, $(1, 0)$ for *time* and $(0, 1)$ for *distance*.

## 4. Objective and constraints
$$
\min \sum_{k=1}^{K} \text{cost}(r_k)
\quad \text{s.t. every customer is in exactly one route } r_k .
$$

Assignment (each customer served exactly once, by at most $K$ vans) is enforced by construction in the decoder.
Capacity, delivery windows and shift length are **soft constraints** handled with the penalty terms above, so every
candidate solution can be evaluated and compared; a solution with zero penalty satisfies all of them.

## 5. Solution encoding (shared by QPSO, PSO, GA and SA)
- A candidate is a vector $x \in [-10, 10]^N$ of random keys. Sorting the keys gives an ordering of the customers.
- The ordering is split into $K$ consecutive groups: a new van starts when the next parcel would exceed $Q$,
  the van reaches its balanced share of the total load, or its stop quota is full. The last van takes whatever remains.
- Each van visits its customers earliest-deadline-first.
- The search objective is the total cost of these routes. The best solution found is then polished with the same
  2-opt (within a route) and relocate (between routes) local search for every algorithm.

## 6. Optimisers
| Method | Update rule | Settings |
|---|---|---|
| QPSO | $x_i \leftarrow p_i \pm \alpha\,\lvert m_{\text{best}} - x_i\rvert \ln(1/u)$, with $p_i = \varphi P_i + (1-\varphi) G$ | $\alpha$: 1.0 → 0.5 |
| PSO | $v \leftarrow w v + c_1 r_1 (P_i - x_i) + c_2 r_2 (G - x_i)$, $x \leftarrow x + v$ | $w$: 0.9 → 0.4, $c_1 = c_2 = 2.0$ |
| GA | Tournament selection, BLX-α crossover, Gaussian mutation, elitism 2 | crossover 0.85, mutation 0.15 |
| SA | Local key moves / swaps, Metropolis acceptance, exponential cooling | 3 restarts |
| Greedy NN | Nearest feasible stop, van by van (baseline) | — |

All metaheuristics use the same population size, iteration budget, decoder and local search, and in the application
their initial population contains the greedy tour plus random vectors.

## 7. Exact reference
For small instances (6–8 customers), `exact_solver.solve_exact_problem` enumerates every ordering and every split into
at most $K$ routes, scoring routes with the same cost function. This gives the proven optimum used to measure each
optimiser's gap.
