"""
Empirical Latency Profiling Script for /api/reoptimize at N = 50, 100, 250, 500 deliveries.
Measures:
1. Dijkstra matrix refresh time (ms)
2. QPSO execution time (ms)
3. PSO execution time (ms)
4. Total HTTP request-response latency (ms)
"""

import urllib.request
import json
import time

def profile_reoptimize_latency():
    scales = [50, 100, 250, 500]
    print(f"{'Scale (N)':<10} | {'Riders':<7} | {'Dijkstra (ms)':<14} | {'QPSO (ms)':<11} | {'PSO (ms)':<11} | {'Total Req (ms)':<14} | {'Confidence'}")
    print("-" * 88)
    
    results = []
    
    for n in scales:
        riders = max(3, int(n / 10))
        cap = max(10, int(n / riders * 1.2))
        
        # 1. Generate problem
        gen_req = urllib.request.Request(
            'http://127.0.0.1:8000/api/problem/generate',
            data=json.dumps({
                'num_deliveries': n,
                'num_riders': riders,
                'rider_capacity': cap,
                'objective': 'balanced'
            }).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(gen_req)
        
        # 2. Initial optimize
        opt_req = urllib.request.Request(
            'http://127.0.0.1:8000/api/optimize',
            data=json.dumps({'num_particles': 30}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(opt_req)
        
        # 3. Simulate traffic
        traf_req = urllib.request.Request(
            'http://127.0.0.1:8000/api/traffic/simulate',
            data=json.dumps({'incident_count': 2}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(traf_req)
        
        # 4. Measure end-to-end /api/reoptimize latency
        t0 = time.perf_counter()
        reopt_req = urllib.request.Request(
            'http://127.0.0.1:8000/api/reoptimize',
            data=json.dumps({'num_particles': 30}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        reopt_res = urllib.request.urlopen(reopt_req)
        total_client_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        
        payload = json.loads(reopt_res.read().decode('utf-8'))
        timing = payload["timing"]
        conf = payload.get("convergence_confidence", {}).get("qpso_status", "N/A")
        
        dijkstra_ms = timing["dijkstra_refresh_ms"]
        qpso_ms = timing["qpso_ms"]
        pso_ms = timing["pso_ms"]
        total_req_ms = timing["total_request_ms"]
        
        print(f"{n:<10} | {riders:<7} | {dijkstra_ms:<14.2f} | {qpso_ms:<11.2f} | {pso_ms:<11.2f} | {total_client_ms:<14.2f} | {conf}")
        
        results.append({
            "num_deliveries": n,
            "riders": riders,
            "dijkstra_ms": dijkstra_ms,
            "qpso_ms": qpso_ms,
            "pso_ms": pso_ms,
            "total_client_ms": total_client_ms,
            "confidence": conf
        })

if __name__ == "__main__":
    profile_reoptimize_latency()
