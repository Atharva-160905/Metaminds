# Research Integrity & Experimental Disclosure

## 1. Where the numbers come from
- Every figure in the Benchmark tab and the Home page example is produced by `python scripts/run_real_benchmarks.py`
  and stored in `frontend/src/data/benchmark_results.json`. Nothing is typed in by hand.
- Seeds 1–10 are used for every problem size and traffic condition. Tables report the mean and standard deviation
  over those seeds, plus how many seeds each algorithm won.
- On-time percentages are measured from the decoded routes (arrival after the delivery window counts as late).

## 2. Fairness
- QPSO, PSO, GA and SA get the same instances, seeds, population size (30), iteration budget, solution encoding,
  decoder and local search. SA makes the same number of objective evaluations per iteration as the swarms.
- Each method uses standard literature settings (QPSO α 1.0 → 0.5; PSO w 0.9 → 0.4, c₁ = c₂ = 2.0); none is tuned
  per problem size or per city.
- The Greedy Nearest-Neighbour baseline is included in every comparison and counts as a winner when it has the lowest cost.
- Optimality gaps use an exact solver that shares the same cost model.

## 3. The Home page example
The Home page walks through one Delhi Okhla scenario (40 stops, 6 vans, 2 incidents). The whole walkthrough is computed
by one backend call (`/api/delhi/demo`) on a private problem and cached, so it gives the same routes and costs on every
visit, whatever is clicked and however many people use the site at once.
The script runs that same endpoint for 60 seeds and picks the worked example with a fixed rule: the first seed where
QPSO has the lowest cost in both the initial plan and the re-route. It is labelled as an example, and the page states how
many of the 60 seeds meet that rule. The number of seeds each algorithm won across all 60 is shown in the Benchmark tab.

## 4. Real-time dispatch studies (Benchmark studies 5–7)
These studies look at conditions where QPSO is expected to be strong: tight time budgets, small zones and fast
re-routing. The conditions (checkpoints 5/10/20 iterations, 20-stop zones, the Delhi re-route) were fixed before the
script was run. All methods get the same budget, and every result is published whichever method wins.
- **Study 5, tight budget:** each method's cost after 5, 10 and 20 iterations, as % above the best final cost that seed.
- **Study 6, zone dispatch:** 100/250/500 stops split into ~20-stop zones by direction from the depot, with vans shared in
  proportion. The page also shows the unsplit cost, and splitting costs more in total. This study compares the methods
  on zone-sized problems; it does not show that splitting is the better plan.
- **Study 7, re-route speed:** the Delhi warm-started re-optimisation on all 60 seeds, measured the same way as Study 5.

## 5. Hardware statement
QPSO is a classical algorithm inspired by quantum mechanics. It runs on ordinary CPUs; no quantum hardware is used or claimed.
