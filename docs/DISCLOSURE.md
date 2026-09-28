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
The Home page walks through one Delhi Okhla scenario (40 stops, 6 vans). The script replays that walkthrough through
the live API for 60 seeds and uses the first seed where QPSO has the lowest post-incident cost as the worked example.
It is labelled as an example. The number of seeds each algorithm won across all 60 is shown in the Benchmark tab.

## 4. Hardware statement
QPSO is a classical algorithm inspired by quantum mechanics. It runs on ordinary CPUs; no quantum hardware is used or claimed.
