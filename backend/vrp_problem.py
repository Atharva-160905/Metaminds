"""
Capacitated Vehicle Routing Problem (CVRP) Formulation & Decoder for SmartRoute-Q.
Sector-Guided Continuous Random-Key Formulation:
- Global quadrant guidance via polar angle theta_i keeps vehicle routes non-overlapping in separate sectors.
- Continuous particle values X_i actively optimize stop sequencing and boundary package allocation.
- Both QPSO and Classical PSO actively navigate the continuous space to find different optimal routes.
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import math

class VRPProblem:
    def __init__(
        self,
        city,
        deliveries: List[Dict[str, Any]],
        num_riders: int = 5,
        rider_capacity: int = 10,
        objective: str = "balanced", # "time", "distance", "balanced"
        w_time: float = 0.6,
        w_dist: float = 0.4
    ):
        self.city = city
        self.deliveries = deliveries
        self.num_deliveries = len(deliveries)
        self.num_riders = max(1, num_riders)
        self.rider_capacity = max(1, rider_capacity)
        self.objective = objective
        self.w_time = w_time
        self.w_dist = w_dist
        
        # Precompute all-pairs shortest paths
        self.time_matrix, self.dist_matrix, self.path_routes = self.city.get_shortest_path_matrices()
        self.depot_node = self.city.depot_node
        self.depot_pos = self.city.depot_pos
        
        # Delivery node ID lookup
        self.delivery_node_ids = [d["node_id"] for d in self.deliveries]
        
        # Calculate exact polar angle and distance from depot for every delivery node
        self.polar_angles = np.zeros(self.num_deliveries)
        self.radial_distances = np.zeros(self.num_deliveries)
        
        for i, d in enumerate(self.deliveries):
            dx = d["pos"][0] - self.depot_pos[0]
            dy = d["pos"][1] - self.depot_pos[1]
            angle = math.atan2(dy, dx)
            if angle < 0:
                angle += 2 * math.pi
            self.polar_angles[i] = angle
            self.radial_distances[i] = math.hypot(dx, dy)
            
        # Reference normalization baselines for balanced objective
        self.t_ref = 100.0
        self.d_ref = 500.0
        self._calculate_reference_baselines()

    def _calculate_reference_baselines(self):
        sample_times = []
        sample_dists = []
        for nid in self.delivery_node_ids:
            t = self.time_matrix.get(self.depot_node, {}).get(nid, 10.0)
            d = self.dist_matrix.get(self.depot_node, {}).get(nid, 50.0)
            sample_times.append(t)
            sample_dists.append(d)
        if sample_times:
            self.t_ref = max(1.0, float(np.mean(sample_times)) * self.num_deliveries * 1.2)
            self.d_ref = max(1.0, float(np.mean(sample_dists)) * self.num_deliveries * 1.2)

    def refresh_matrices(self):
        self.time_matrix, self.dist_matrix, self.path_routes = self.city.get_shortest_path_matrices()
        self._calculate_reference_baselines()

    def _get_permutation(self, vec: np.ndarray) -> np.ndarray:
        """
        Combines geographic polar sector angle with particle continuous variables:
        - Polar angle (theta_i * 4.0) maintains overall quadrant cluster separation.
        - Particle perturbation (vec * 0.4) allows the optimizer to trade boundary nodes
          and optimize stop sequencing within each vehicle route.
        """
        bounded_vec = np.clip(vec, -5.0, 5.0) * 0.4
        keys = (self.polar_angles * 4.0) + bounded_vec
        return np.argsort(keys)

    def decode_particle(self, particle: np.ndarray) -> Dict[str, Any]:
        """
        Decodes a particle vector into fully structured vehicle routes.
        """
        vec = particle[:self.num_deliveries]
        permutation = self._get_permutation(vec)
        
        items_per_rider = max(1, min(self.rider_capacity, int(np.ceil(self.num_deliveries / self.num_riders))))
        rider_routes: List[List[int]] = [[] for _ in range(self.num_riders)]
        
        assigned_count = 0
        for r_idx in range(self.num_riders):
            if assigned_count >= self.num_deliveries:
                break
            if r_idx == self.num_riders - 1:
                take = self.num_deliveries - assigned_count
            else:
                take = min(items_per_rider, self.num_deliveries - assigned_count)
            
            chunk = permutation[assigned_count : assigned_count + take].tolist()
            rider_routes[r_idx] = chunk
            assigned_count += take

        penalty = 0.0
        for r_list in rider_routes:
            if len(r_list) > self.rider_capacity:
                overflow = len(r_list) - self.rider_capacity
                penalty += overflow * 5000.0

        routes_data = []
        total_time = 0.0
        total_dist = 0.0

        for r_idx in range(self.num_riders):
            deliv_indices = rider_routes[r_idx]
            route_time = 0.0
            route_dist = 0.0
            waypoint_nodes = [self.depot_node]
            curr_node = self.depot_node
            cumulative_time = 0.0
            cumulative_dist = 0.0
            delivery_details = []
            
            for d_idx in deliv_indices:
                d_info = self.deliveries[d_idx]
                target_node = d_info["node_id"]
                
                seg_time = self.time_matrix.get(curr_node, {}).get(target_node, 999.0)
                seg_dist = self.dist_matrix.get(curr_node, {}).get(target_node, 999.0)
                seg_path = self.path_routes.get(curr_node, {}).get(target_node, [curr_node, target_node])
                
                route_time += seg_time
                route_dist += seg_dist
                cumulative_time += seg_time
                cumulative_dist += seg_dist
                
                if len(seg_path) > 1:
                    waypoint_nodes.extend(seg_path[1:])
                else:
                    waypoint_nodes.append(target_node)
                
                delivery_details.append({
                    "delivery_id": d_info["id"],
                    "delivery_index": d_idx,
                    "label": d_info["label"],
                    "node_id": target_node,
                    "pos": d_info["pos"],
                    "eta_min": round(cumulative_time, 2),
                    "dist_cum": round(cumulative_dist, 2)
                })
                curr_node = target_node

            if len(deliv_indices) > 0:
                ret_time = self.time_matrix.get(curr_node, {}).get(self.depot_node, 999.0)
                ret_dist = self.dist_matrix.get(curr_node, {}).get(self.depot_node, 999.0)
                ret_path = self.path_routes.get(curr_node, {}).get(self.depot_node, [curr_node, self.depot_node])
                
                route_time += ret_time
                route_dist += ret_dist
                cumulative_time += ret_time
                cumulative_dist += ret_dist
                
                if len(ret_path) > 1:
                    waypoint_nodes.extend(ret_path[1:])
                else:
                    waypoint_nodes.append(self.depot_node)

            total_time += route_time
            total_dist += route_dist
            
            waypoint_coords = []
            for wn in waypoint_nodes:
                if wn in self.city.graph.nodes:
                    pos = self.city.graph.nodes[wn]["pos"]
                    waypoint_coords.append({"id": wn, "x": round(pos[0], 2), "y": round(pos[1], 2)})
            
            routes_data.append({
                "rider_id": r_idx + 1,
                "delivery_count": len(deliv_indices),
                "deliveries": delivery_details,
                "route_time_min": round(route_time, 2),
                "route_dist_km": round(route_dist, 2),
                "waypoint_nodes": waypoint_nodes,
                "waypoint_coords": waypoint_coords
            })

        if self.objective == "time":
            fitness = total_time + penalty
        elif self.objective == "distance":
            fitness = total_dist + penalty
        else:
            norm_t = (total_time / self.t_ref) if self.t_ref > 0 else total_time
            norm_d = (total_dist / self.d_ref) if self.d_ref > 0 else total_dist
            fitness = (self.w_time * norm_t * 100.0 + self.w_dist * norm_d * 100.0) + penalty

        return {
            "fitness": round(float(fitness), 4),
            "total_time_min": round(float(total_time), 2),
            "total_dist_km": round(float(total_dist), 2),
            "penalty": round(float(penalty), 2),
            "rider_routes": routes_data,
            "permutation": permutation.tolist()
        }

    def evaluate(self, particle: np.ndarray) -> float:
        """
        Active particle fitness evaluator:
        Evaluates the exact routing cost of the permutation generated by particle vector.
        """
        vec = particle[:self.num_deliveries]
        permutation = self._get_permutation(vec)
        
        items_per_rider = max(1, min(self.rider_capacity, int(np.ceil(self.num_deliveries / self.num_riders))))
        total_time = 0.0
        total_dist = 0.0
        penalty = 0.0
        assigned_count = 0
        
        for r_idx in range(self.num_riders):
            if assigned_count >= self.num_deliveries:
                break
            if r_idx == self.num_riders - 1:
                take = self.num_deliveries - assigned_count
            else:
                take = min(items_per_rider, self.num_deliveries - assigned_count)
            
            chunk = permutation[assigned_count : assigned_count + take]
            assigned_count += take
            
            if len(chunk) > self.rider_capacity:
                penalty += (len(chunk) - self.rider_capacity) * 5000.0
                
            curr_node = self.depot_node
            for d_idx in chunk:
                target_node = self.delivery_node_ids[d_idx]
                total_time += self.time_matrix.get(curr_node, {}).get(target_node, 999.0)
                total_dist += self.dist_matrix.get(curr_node, {}).get(target_node, 999.0)
                curr_node = target_node
                
            if len(chunk) > 0:
                total_time += self.time_matrix.get(curr_node, {}).get(self.depot_node, 999.0)
                total_dist += self.dist_matrix.get(curr_node, {}).get(self.depot_node, 999.0)

        if self.objective == "time":
            return float(total_time + penalty)
        elif self.objective == "distance":
            return float(total_dist + penalty)
        else:
            norm_t = (total_time / self.t_ref) if self.t_ref > 0 else total_time
            norm_d = (total_dist / self.d_ref) if self.d_ref > 0 else total_dist
            return float((self.w_time * norm_t * 100.0 + self.w_dist * norm_d * 100.0) + penalty)
