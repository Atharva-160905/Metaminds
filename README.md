# Pheri 🚀
### Quantum-Inspired Intelligent Traffic Route Optimization in Transportation Systems Using Metaheuristic Optimization
*Smart India Hackathon (SIH 2026) Prototype Demonstration*

---

## 🌟 Overview

**Pheri** is an intelligent logistics and urban traffic routing system designed for last-mile delivery fleets. It solves the **Capacitated Vehicle Routing Problem (CVRP)** over dynamic synthetic road networks by comparing:
1. **Quantum-Behaved Particle Swarm Optimization (QPSO)** (Quantum Delta-Potential Well / Mean-Best Model)
2. **Classical Particle Swarm Optimization (PSO)** (Shi & Eberhart Inertia-Weighted Velocity Model)

Both algorithms operate on the **exact same road network, delivery package distribution, rider fleet constraints, and evaluation budget** without fabrication or hardcoded biases.

---

## 🛠 Tech Stack

- **Backend**: Python 3.13, FastAPI, NetworkX, NumPy, Pydantic, Uvicorn
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Simulation**: Synthetic Grid + Arterial + Ring Road graph with dynamic congestion multipliers and shortest-path caching.

---

## 🚀 How to Run the Application

### 1. Start the Backend API (FastAPI)
```bash
# Open a terminal in d:\SIH\backend
cd backend
python -m uvicorn main:app --reload --port 8000
```
Backend will be available at: **`http://localhost:8000`** (Swagger docs at `http://localhost:8000/docs`).

### 2. Start the Frontend Dashboard (React + Vite)
```bash
# Open a terminal in d:\SIH\frontend
cd frontend
npm run dev
```
Open your browser at: **`http://localhost:5173`**

---

## 🎯 Key Features for SIH Presentation

1. **Side-by-Side Dual Optimizer Visualizer**:
   - **Left Panel (Emerald Green)**: Quantum-Inspired QPSO solution.
   - **Right Panel (Cyan Blue)**: Classical PSO baseline.
2. **Live Animated Vehicle Movement & Glowing Completed Trails**:
   - Riders smoothly traverse shortest road network paths.
   - **Completed route segments turn solid, thick, and glowing**.
   - Not-yet-traveled segments remain dashed and subdued.
   - Delivery nodes turn green with a checkmark `✓` upon arrival.
3. **Dynamic Traffic Congestion & Incident Injection**:
   - "Simulate Traffic" injects realistic 5x delay spikes on active road segments (pulsing red roads).
   - "Re-Optimize" re-computes graph weights and shows both swarms dynamically rerouting around bottlenecks.
4. **Real-Time Convergence Curve**:
   - Recharts line plot showing QPSO vs Classical PSO best fitness across all iterations.
5. **Multi-Scale Empirical Benchmark Suite**:
   - Tests and compares both algorithms across 20, 50, 100, 250, and 500 deliveries.
   - Plots Solution Cost vs Scale and Execution Runtime vs Scale.
6. **Interactive Demo Walkthrough Guide**:
   - Built-in step-by-step presentation assistant for judges.

---

## 📊 Reproducing the Benchmark

```bash
python scripts/run_real_benchmarks.py     # writes frontend/src/data/benchmark_results.json
python -m pytest tests                    # consistency, fairness and exact-solver checks
```

The Benchmark tab and the Home page example read only from that JSON file. See [docs/DISCLOSURE.md](docs/DISCLOSURE.md)
for seeds, budgets and how the Home page example is chosen, and [docs/formulation.md](docs/formulation.md) for the model.

---

## 🔬 Scientific Honesty & Quantum-Inspired Clarification

> **Note on Quantum Computing**:
> We are **NOT** using physical quantum computers (QPU / superconducting hardware). **QPSO is a quantum-inspired metaheuristic algorithm** that mathematically simulates quantum wave-function collapse and delta-potential-well attraction running on standard classical CPUs.
