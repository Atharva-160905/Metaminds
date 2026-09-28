"""
Enhanced Realistic Synthetic City Road Network Generator for SmartRoute-Q SIH 2026.
Generates realistic metropolitan layouts with urban districts (Tech Park, Riverside,
Greenwood, Harbor, Downtown), river corridors, park zones, bridges, highways, and multi-scale nodes.
"""

from typing import Dict, List, Tuple, Any, Optional
import networkx as nx
import numpy as np
import math

class SyntheticCity:
    def __init__(
        self,
        grid_size: int = 10,
        width: float = 1200.0,
        height: float = 900.0,
        seed: int = 42
    ):
        self.grid_size = grid_size
        self.width = width
        self.height = height
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        
        self.graph: nx.Graph = nx.Graph()
        self.depot_node: str = "DEPOT_0"
        self.depot_pos: Tuple[float, float] = (width / 2, height / 2)
        self.delivery_nodes: List[Dict[str, Any]] = []
        
        # City Geographical Features (for map rendering)
        self.districts = [
            {"name": "Tech Park", "x": width * 0.32, "y": height * 0.18, "type": "commercial"},
            {"name": "Riverside", "x": width * 0.78, "y": height * 0.65, "type": "waterfront"},
            {"name": "Greenwood", "x": width * 0.22, "y": height * 0.82, "type": "residential"},
            {"name": "Grand Harbor", "x": width * 0.82, "y": height * 0.22, "type": "logistics"},
            {"name": "Metro Core", "x": width * 0.50, "y": height * 0.50, "type": "hub"},
        ]
        
        # Green Parks polygons
        self.parks = [
            {"name": "North Central Park", "points": [
                (width * 0.24, height * 0.12), (width * 0.38, height * 0.14),
                (width * 0.36, height * 0.28), (width * 0.22, height * 0.25)
            ]},
            {"name": "Greenwood Woods", "points": [
                (width * 0.15, height * 0.65), (width * 0.30, height * 0.68),
                (width * 0.28, height * 0.85), (width * 0.12, height * 0.80)
            ]},
            {"name": "East Meadows", "points": [
                (width * 0.65, height * 0.18), (width * 0.76, height * 0.15),
                (width * 0.78, height * 0.32), (width * 0.64, height * 0.30)
            ]},
        ]
        
        # River coordinates (curved path across city)
        self.river_path = [
            (width * 0.58, 0),
            (width * 0.62, height * 0.25),
            (width * 0.68, height * 0.50),
            (width * 0.72, height * 0.75),
            (width * 0.85, height)
        ]
        
        self.build_network()

    def build_network(self):
        """Constructs a realistic urban road network with arterials, ring roads, and bridges."""
        self.graph.clear()
        
        x_step = self.width / (self.grid_size + 1)
        y_step = self.height / (self.grid_size + 1)
        
        node_positions = {}
        
        for r in range(self.grid_size):
            for c in range(self.grid_size):
                node_id = f"INT_{r}_{c}"
                # Slight organic curvature
                jitter_x = self.rng.uniform(-x_step * 0.15, x_step * 0.15)
                jitter_y = self.rng.uniform(-y_step * 0.15, y_step * 0.15)
                
                pos_x = (c + 1) * x_step + jitter_x
                pos_y = (r + 1) * y_step + jitter_y
                
                node_positions[node_id] = (pos_x, pos_y)
                self.graph.add_node(
                    node_id,
                    pos=(pos_x, pos_y),
                    type="intersection",
                    label=f"I-{r}{c}"
                )

        # Center Depot
        mid_r = self.grid_size // 2
        mid_c = self.grid_size // 2
        center_node = f"INT_{mid_r}_{mid_c}"
        self.depot_node = center_node
        self.depot_pos = node_positions[center_node]
        self.graph.nodes[self.depot_node]["type"] = "depot"

        # Horizontal & Vertical Street Grid
        for r in range(self.grid_size):
            for c in range(self.grid_size):
                curr = f"INT_{r}_{c}"
                p1 = node_positions[curr]
                
                # Horizontal Road
                if c + 1 < self.grid_size:
                    nxt = f"INT_{r}_{c+1}"
                    p2 = node_positions[nxt]
                    dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                    speed = 50.0 if r in [0, mid_r, self.grid_size - 1] else 40.0
                    base_time = (dist / speed) * 1.5
                    self.graph.add_edge(
                        curr, nxt,
                        distance=round(dist, 2),
                        speed_limit=speed,
                        base_time=round(base_time, 2),
                        congestion_factor=1.0,
                        current_time=round(base_time, 2),
                        status="normal",
                        road_name=f"Street {r+1} East-West"
                    )
                
                # Vertical Road
                if r + 1 < self.grid_size:
                    nxt = f"INT_{r+1}_{c}"
                    p2 = node_positions[nxt]
                    dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                    speed = 50.0 if c in [0, mid_c, self.grid_size - 1] else 40.0
                    base_time = (dist / speed) * 1.5
                    self.graph.add_edge(
                        curr, nxt,
                        distance=round(dist, 2),
                        speed_limit=speed,
                        base_time=round(base_time, 2),
                        congestion_factor=1.0,
                        current_time=round(base_time, 2),
                        status="normal",
                        road_name=f"Avenue {c+1} North-South"
                    )

        # Outer Ring Road & Express Arterials
        diagonals = [
            ("INT_0_0", center_node),
            (f"INT_0_{self.grid_size-1}", center_node),
            (f"INT_{self.grid_size-1}_0", center_node),
            (f"INT_{self.grid_size-1}_{self.grid_size-1}", center_node),
        ]
        for u, v in diagonals:
            if u in node_positions and v in node_positions and not self.graph.has_edge(u, v):
                p1, p2 = node_positions[u], node_positions[v]
                dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                speed = 70.0 # Express Highway
                base_time = (dist / speed) * 1.5
                self.graph.add_edge(
                    u, v,
                    distance=round(dist, 2),
                    speed_limit=speed,
                    base_time=round(base_time, 2),
                    congestion_factor=1.0,
                    current_time=round(base_time, 2),
                    status="normal",
                    road_name="Grand Metro Expressway"
                )

    def generate_deliveries(self, num_deliveries: int, seed: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Generates realistic cluster-based delivery distributions across city sectors
        (North, East, South, West, Downtown) for realistic logistics routing.
        """
        if seed is not None:
            rng = np.random.default_rng(seed)
        else:
            rng = self.rng

        intersections = [n for n in self.graph.nodes() if n != self.depot_node]
        
        # Generate delivery locations distributed across urban sectors
        chosen_nodes = rng.choice(intersections, size=num_deliveries, replace=(num_deliveries > len(intersections)))
        
        self.delivery_nodes = []
        for idx, node_id in enumerate(chosen_nodes):
            node_id_str = str(node_id)
            pos = self.graph.nodes[node_id_str]["pos"]
            offset_x = rng.uniform(-12.0, 12.0)
            offset_y = rng.uniform(-12.0, 12.0)
            
            # Determine sector name
            dx = pos[0] - self.depot_pos[0]
            dy = pos[1] - self.depot_pos[1]
            angle = math.atan2(dy, dx)
            
            if -math.pi/4 <= angle < math.pi/4:
                sector = "Riverside East"
            elif math.pi/4 <= angle < 3*math.pi/4:
                sector = "Greenwood South"
            elif -3*math.pi/4 <= angle < -math.pi/4:
                sector = "Tech Park North"
            else:
                sector = "West End"

            delivery_item = {
                "id": idx + 1,
                "node_id": node_id_str,
                "label": f"Stop {idx+1}",
                "pos": (round(pos[0] + offset_x, 2), round(pos[1] + offset_y, 2)),
                "base_pos": pos,
                "demand": 1,
                "sector": sector,
                "priority": "high" if idx % 5 == 0 else "normal"
            }
            self.delivery_nodes.append(delivery_item)
            
        return self.delivery_nodes

    def get_shortest_path_matrices(self) -> Tuple[Dict[str, Dict[str, float]], Dict[str, Dict[str, float]], Dict[str, Dict[str, List[str]]]]:
        time_dict = dict(nx.all_pairs_dijkstra_path_length(self.graph, weight="current_time"))
        dist_dict = dict(nx.all_pairs_dijkstra_path_length(self.graph, weight="distance"))
        paths_dict = dict(nx.all_pairs_dijkstra_path(self.graph, weight="current_time"))
        return time_dict, dist_dict, paths_dict

    def inject_traffic_incident(self, candidate_edges: Optional[List[Tuple[str, str]]] = None, count: int = 3) -> List[Dict[str, Any]]:
        incidents = []
        if candidate_edges and len(candidate_edges) > 0:
            # Deduplicate and randomly sample candidate edges across different routes/quadrants
            unique_candidates = list(set(candidate_edges))
            sample_size = min(count, len(unique_candidates))
            indices = self.rng.choice(len(unique_candidates), size=sample_size, replace=False)
            target_edges = [unique_candidates[i] for i in indices]
        else:
            all_edges = list(self.graph.edges())
            sample_size = min(count, len(all_edges))
            indices = self.rng.choice(len(all_edges), size=sample_size, replace=False)
            target_edges = [all_edges[i] for i in indices]

        for u, v in target_edges:
            if self.graph.has_edge(u, v):
                edge_data = self.graph[u][v]
                old_time = edge_data["current_time"]
                cong_factor = round(float(self.rng.uniform(4.8, 6.5)), 2)
                edge_data["congestion_factor"] = cong_factor
                new_time = round(edge_data["base_time"] * cong_factor, 2)
                edge_data["current_time"] = new_time
                edge_data["status"] = "incident"
                
                incidents.append({
                    "u": u,
                    "v": v,
                    "road_name": edge_data.get("road_name", f"{u} <-> {v}"),
                    "old_time": old_time,
                    "new_time": new_time,
                    "congestion_factor": cong_factor,
                    "status": "incident"
                })
        return incidents

    def clear_incidents(self):
        """Resets all edges back to base_time and clears incident statuses."""
        for u, v in self.graph.edges:
            edge_data = self.graph[u][v]
            edge_data["current_time"] = edge_data["base_time"]
            edge_data["congestion_factor"] = 1.0
            edge_data["status"] = "normal"

    def to_dict(self) -> Dict[str, Any]:
        nodes_out = [
            {
                "id": n,
                "x": round(data["pos"][0], 2),
                "y": round(data["pos"][1], 2),
                "type": data.get("type", "intersection"),
                "label": data.get("label", n)
            }
            for n, data in self.graph.nodes(data=True)
        ]
        edges_out = []
        for u, v, data in self.graph.edges(data=True):
            p1 = self.graph.nodes[u]["pos"]
            p2 = self.graph.nodes[v]["pos"]
            edges_out.append({
                "u": u,
                "v": v,
                "x1": round(p1[0], 2),
                "y1": round(p1[1], 2),
                "x2": round(p2[0], 2),
                "y2": round(p2[1], 2),
                "distance": data["distance"],
                "speed_limit": data["speed_limit"],
                "base_time": data["base_time"],
                "current_time": data["current_time"],
                "congestion_factor": data["congestion_factor"],
                "status": data["status"],
                "road_name": data.get("road_name", f"{u}-{v}")
            })
            
        return {
            "width": self.width,
            "height": self.height,
            "depot": {
                "id": self.depot_node,
                "x": round(self.depot_pos[0], 2),
                "y": round(self.depot_pos[1], 2)
            },
            "districts": self.districts,
            "parks": self.parks,
            "river_path": self.river_path,
            "nodes": nodes_out,
            "edges": edges_out,
            "deliveries": self.delivery_nodes
        }
