"""
Real-World Road Network Model: South-East Delhi — Okhla Phase I/II, Nehru Place, Kalkaji, Jasola.
Approximately 3 × 3 km urban logistics zone powered by real OpenStreetMap (OSMnx) drive network.

GIS Reference Coordinates (WGS-84):
  NW Corner ≈ 28.5560 N, 77.2400 E   (Nehru Place / Lotus Temple / GK-I)
  SE Corner ≈ 28.5270 N, 77.2860 E   (Okhla Industrial Phase-II / Kalindi Kunj / Jasola)

Features:
  - 4,602 real OpenStreetMap road segments (primary, secondary, tertiary, residential)
  - 50 real-world delivery stops across Okhla, Nehru Place, Kalkaji, Jasola, Govindpuri
  - NSIC Complex central depot
  - Precomputed Dijkstra shortest paths following curved street polylines
  - Full support for QPSO, PSO, GA, SA optimization and dynamic traffic incidents
"""

import os
import json
from typing import Dict, List, Tuple, Any, Optional
import networkx as nx
import numpy as np


class DelhiCityGraph:
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.graph: nx.Graph = nx.Graph()

        self.width = 1200.0
        self.height = 900.0

        # Paths to precomputed OSMnx data
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
        roads_file = os.path.join(data_dir, 'okhla_roads.json')
        stops_file = os.path.join(data_dir, 'okhla_stops.json')
        paths_file = os.path.join(data_dir, 'okhla_paths.json')

        self.is_real_osm = False
        self.roads: List[Dict[str, Any]] = []
        self.roads_summary: Dict[str, Any] = {}
        self.all_stops: List[Dict[str, Any]] = []
        self.paths_data: Dict[str, Any] = {}
        self.active_incidents: List[Dict[str, Any]] = []
        self.incident_affected_nodes: set = set()

        # Real Delhi Landmarks in the 3×3 km Okhla/Nehru Place/Kalkaji box (Exact SVG positions)
        self.landmarks = [
            {
                "id": "NEHRU_PLACE",
                "name": "Nehru Place IT Hub",
                "short": "Nehru Place",
                "lat": 28.5490,
                "lng": 77.2530,
                "pos": (356.52, 237.93),
                "type": "commercial",
                "desc": "South Delhi's premier IT & electronics district"
            },
            {
                "id": "LOTUS_TEMPLE",
                "name": "Lotus Temple (Bahai House)",
                "short": "Lotus Temple",
                "lat": 28.5535,
                "lng": 77.2588,
                "pos": (497.74, 110.69),
                "type": "landmark",
                "desc": "Iconic Bahai House of Worship"
            },
            {
                "id": "KALKAJI_MANDIR",
                "name": "Kalkaji Mandir Complex",
                "short": "Kalkaji Mandir",
                "lat": 28.5505,
                "lng": 77.2555,
                "pos": (417.39, 195.52),
                "type": "temple",
                "desc": "Historic Kalkaji Mandir & Metro Interchange"
            },
            {
                "id": "OKHLA_NSIC",
                "name": "NSIC Complex Okhla (Depot)",
                "short": "NSIC Depot",
                "lat": 28.53459,
                "lng": 77.271555,
                "pos": (808.3, 645.39),
                "type": "depot",
                "desc": "National Small Industries Corporation — Fleet Central Hub"
            },
            {
                "id": "GOVINDPURI_METRO",
                "name": "Govindpuri Metro Station",
                "short": "Govindpuri",
                "lat": 28.5440,
                "lng": 77.2640,
                "pos": (624.35, 379.31),
                "type": "transit",
                "desc": "Violet Line Metro Station & Market"
            },
            {
                "id": "APOLLO_JASOLA",
                "name": "Apollo Hospital Jasola",
                "short": "Apollo Jasola",
                "lat": 28.5330,
                "lng": 77.2810,
                "pos": (1038.26, 690.34),
                "type": "hospital",
                "desc": "Indraprastha Apollo Hospital Medical District"
            },
            {
                "id": "OKHLA_PHASE2",
                "name": "Okhla Phase-II Industrial",
                "short": "Okhla Ph-II",
                "lat": 28.5310,
                "lng": 77.2720,
                "pos": (819.13, 746.9),
                "type": "industrial",
                "desc": "Okhla Industrial Estate Phase-II Workshops"
            },
            {
                "id": "HARKESH_NAGAR",
                "name": "Harkesh Nagar OKHLA",
                "short": "Harkesh Nagar",
                "lat": 28.5350,
                "lng": 77.2740,
                "pos": (867.83, 633.79),
                "type": "transit",
                "desc": "Harkesh Nagar OKHLA Metro Station"
            },
            {
                "id": "GK1_MARKET",
                "name": "GK-I M Block Market",
                "short": "GK-I Market",
                "lat": 28.5520,
                "lng": 77.2430,
                "pos": (113.04, 153.1),
                "type": "commercial",
                "desc": "Greater Kailash-I Commercial Avenue"
            },
            {
                "id": "OKHLA_BIRD",
                "name": "Okhla Bird Sanctuary / Kalindi",
                "short": "Bird Sanctuary",
                "lat": 28.5280,
                "lng": 77.2760,
                "pos": (916.52, 831.72),
                "type": "landmark",
                "desc": "Okhla Bird Sanctuary & Kalindi Kunj Ghat"
            }
        ]

        # Yamuna River corridor (East boundary)
        self.river_path = [
            (1140.0, 20.0),
            (1155.0, 200.0),
            (1170.0, 420.0),
            (1185.0, 640.0),
            (1160.0, 820.0),
            (1140.0, 900.0)
        ]

        # Neighborhood zones
        self.districts = [
            {"name": "NEHRU PLACE — IT CORRIDOR", "x": 320, "y": 210, "type": "commercial"},
            {"name": "KALKAJI — TEMPLE ZONE", "x": 420, "y": 170, "type": "residential"},
            {"name": "GOVINDPURI — TRANSIT HUB", "x": 580, "y": 350, "type": "transit"},
            {"name": "OKHLA PHASE-I INDUSTRIAL", "x": 750, "y": 550, "type": "industrial"},
            {"name": "OKHLA PHASE-II INDUSTRIAL", "x": 800, "y": 780, "type": "industrial"},
            {"name": "JASOLA — CORPORATE SECTOR", "x": 1000, "y": 620, "type": "commercial"},
            {"name": "YAMUNA RIVER BASIN", "x": 1130, "y": 480, "type": "waterway"},
        ]

        # Try to load precomputed real OSMnx data
        if os.path.exists(roads_file) and os.path.exists(stops_file) and os.path.exists(paths_file):
            try:
                self._load_osmnx_data(roads_file, stops_file, paths_file)
                self.is_real_osm = True
            except Exception as e:
                print(f"[DelhiCityGraph] Warning: Failed to load OSMnx files: {e}. Falling back to synthetic.")
                self._build_fallback_network()
        else:
            print("[DelhiCityGraph] OSMnx files not found. Using fallback topology.")
            self._build_fallback_network()

    def _load_osmnx_data(self, roads_file: str, stops_file: str, paths_file: str):
        """Loads precomputed OpenStreetMap JSON data."""
        with open(stops_file, 'r', encoding='utf-8') as f:
            stops_json = json.load(f)

        with open(paths_file, 'r', encoding='utf-8') as f:
            self.paths_data = json.load(f)

        with open(roads_file, 'r', encoding='utf-8') as f:
            roads_json = json.load(f)

        self.roads = roads_json.get('roads', [])
        road_type_counts = {}
        for r in self.roads:
            rt = r.get('road_type', 'residential')
            road_type_counts[rt] = road_type_counts.get(rt, 0) + 1

        self.roads_summary = {
            "total_segments": len(self.roads),
            "by_type": road_type_counts,
            "region": roads_json.get('region_name', 'Okhla, South-East Delhi'),
            "num_nodes": roads_json.get('num_nodes', 1808),
            "num_edges": roads_json.get('num_edges', 4602)
        }

        depot_data = stops_json['depot']
        self.depot_node = str(depot_data['node_id'])
        self.depot_pos = tuple(depot_data['pos'])
        self.depot_lat = depot_data['lat']
        self.depot_lng = depot_data['lng']
        self.depot_label = depot_data.get('label', 'NSIC Complex — Central Depot')

        self.all_stops = stops_json['stops']

        # Populate internal NetworkX graph for compatibility
        self.graph.clear()
        self.graph.add_node(
            self.depot_node,
            pos=self.depot_pos,
            lat=self.depot_lat,
            lng=self.depot_lng,
            label=self.depot_label,
            type="depot"
        )

        for s in self.all_stops:
            s_id = str(s['node_id'])
            self.graph.add_node(
                s_id,
                pos=tuple(s['pos']),
                lat=s['lat'],
                lng=s['lng'],
                label=s['label'],
                type="stop"
            )

        print(f"[DelhiCityGraph] Successfully loaded OSMnx network: {len(self.roads)} road segments, {len(self.all_stops)} stops, {len(self.paths_data)} path origins.")

    def _build_fallback_network(self):
        """Fallback synthetic topology if OSMnx JSONs are absent."""
        self.depot_node = "DELHI_OKHLA_DEPOT"
        self.depot_pos = (808.3, 645.39)
        self.depot_lat, self.depot_lng = 28.53459, 77.271555
        self.depot_label = "NSIC Complex — Central Depot"

        self.graph.clear()
        self.graph.add_node(self.depot_node, pos=self.depot_pos, lat=self.depot_lat, lng=self.depot_lng, label=self.depot_label, type="depot")

    def generate_deliveries(self, num_deliveries: int = 25, seed: Optional[int] = None) -> List[Dict[str, Any]]:
        """Selects delivery packages distributed across real Delhi Okhla stops."""
        active_seed = seed if seed is not None else self.seed
        rng = np.random.default_rng(active_seed)

        if self.is_real_osm and self.all_stops:
            # Pick from real stops
            sample_count = min(num_deliveries, len(self.all_stops))
            chosen_indices = rng.choice(len(self.all_stops), size=sample_count, replace=False)

            self.delivery_nodes = []
            for d_idx, stop_idx in enumerate(chosen_indices):
                stop = self.all_stops[stop_idx]
                node_id = str(stop['node_id'])
                pos = tuple(stop['pos'])
                weight_kg = round(float(rng.uniform(2.5, 12.0)), 1)

                self.delivery_nodes.append({
                    "id": d_idx + 1,
                    "node_id": node_id,
                    "label": stop['label'],
                    "locality": stop.get('locality', f"Stop {d_idx + 1}"),
                    "lat": stop['lat'],
                    "lng": stop['lng'],
                    "pos": pos,
                    "base_pos": tuple(stop['base_pos']),
                    "demand": 1,
                    "weight_kg": weight_kg,
                    "priority": stop.get('priority', 'normal')
                })
        else:
            self.delivery_nodes = []
            for i in range(num_deliveries):
                weight_kg = round(float(rng.uniform(2.5, 12.0)), 1)
                self.delivery_nodes.append({
                    "id": i + 1,
                    "node_id": f"STOP_{i + 1}",
                    "label": f"Stop {i + 1}: Delhi Locality",
                    "locality": f"Locality {i + 1}",
                    "pos": (300.0 + (i % 5) * 150.0, 200.0 + (i // 5) * 120.0),
                    "base_pos": (300.0 + (i % 5) * 150.0, 200.0 + (i // 5) * 120.0),
                    "demand": 1,
                    "weight_kg": weight_kg,
                    "priority": "normal"
                })

        return self.delivery_nodes

    def get_shortest_path_matrices(self) -> Tuple[Dict[str, Dict[str, float]], Dict[str, Dict[str, float]], Dict[str, Dict[str, List[str]]]]:
        """
        Returns (time_dict, dist_dict, paths_dict) computed from real OpenStreetMap Dijkstra shortest paths.
        Distances are in km, times are in minutes (based on 35 km/h urban speed, modified by incidents).
        """
        if self.is_real_osm and self.paths_data:
            time_dict: Dict[str, Dict[str, float]] = {}
            dist_dict: Dict[str, Dict[str, float]] = {}
            paths_dict: Dict[str, Dict[str, List[str]]] = {}

            # All relevant node IDs (depot + delivery stops)
            relevant_nodes = [self.depot_node] + [d['node_id'] for d in self.delivery_nodes]
            relevant_set = set(relevant_nodes)

            base_speed_kmh = 35.0  # Typical urban delivery speed in Delhi

            for src in relevant_nodes:
                time_dict[src] = {}
                dist_dict[src] = {}
                paths_dict[src] = {}

                src_paths = self.paths_data.get(src, {})

                for tgt in relevant_nodes:
                    if src == tgt:
                        time_dict[src][tgt] = 0.0
                        dist_dict[src][tgt] = 0.0
                        paths_dict[src][tgt] = [src]
                        continue

                    path_info = src_paths.get(tgt)
                    if path_info and path_info.get('distance_m', 999999) < 900000:
                        dist_km = round(path_info['distance_m'] / 1000.0, 3)

                        # Congestion calculation
                        cong = 1.0
                        if src in self.incident_affected_nodes or tgt in self.incident_affected_nodes:
                            cong = 5.2

                        eff_speed = max(5.0, base_speed_kmh / cong)
                        time_min = round((dist_km / eff_speed) * 60.0, 2)

                        time_dict[src][tgt] = time_min
                        dist_dict[src][tgt] = dist_km
                        paths_dict[src][tgt] = [str(n) for n in path_info.get('path_nodes', [src, tgt])]
                    else:
                        # Fallback Euclidean
                        p1 = self.graph.nodes[src]['pos'] if src in self.graph.nodes else (0, 0)
                        p2 = self.graph.nodes[tgt]['pos'] if tgt in self.graph.nodes else (0, 0)
                        dist_km = round(np.hypot(p1[0] - p2[0], p1[1] - p2[1]) / 250.0, 2)
                        time_dict[src][tgt] = round((dist_km / base_speed_kmh) * 60.0, 2)
                        dist_dict[src][tgt] = dist_km
                        paths_dict[src][tgt] = [src, tgt]

            return time_dict, dist_dict, paths_dict

        else:
            time_dict = dict(nx.all_pairs_dijkstra_path_length(self.graph, weight="current_time"))
            dist_dict = dict(nx.all_pairs_dijkstra_path_length(self.graph, weight="distance"))
            paths_dict = dict(nx.all_pairs_dijkstra_path(self.graph, weight="current_time"))
            return time_dict, dist_dict, paths_dict

    def get_detailed_path_coords(self, src: str, tgt: str) -> List[List[float]]:
        """Returns the exact curved road SVG polyline points [[x, y], ...] from src to tgt."""
        if not self.paths_data:
            return []
        src_entry = self.paths_data.get(str(src), {})
        tgt_entry = src_entry.get(str(tgt), {})
        return tgt_entry.get('svg_path', [])

    def get_detailed_route_coords(self, node_sequence: List[str]) -> List[Dict[str, Any]]:
        """
        Takes a sequence of nodes [depot, stop_1, stop_2, ..., depot] and stitches together
        the real curved street geometry from OpenStreetMap shortest paths.
        """
        if not self.paths_data or len(node_sequence) < 2:
            return []

        detailed_coords: List[Dict[str, Any]] = []

        for i in range(len(node_sequence) - 1):
            src = str(node_sequence[i])
            tgt = str(node_sequence[i + 1])
            pts = self.get_detailed_path_coords(src, tgt)

            if pts:
                for pt_idx, pt in enumerate(pts):
                    # Avoid duplicate adjacent points at segment boundaries
                    if detailed_coords:
                        last = detailed_coords[-1]
                        if abs(last['x'] - pt[0]) < 0.1 and abs(last['y'] - pt[1]) < 0.1:
                            continue

                    detailed_coords.append({
                        "id": f"{src}_{tgt}_{pt_idx}",
                        "x": round(float(pt[0]), 2),
                        "y": round(float(pt[1]), 2)
                    })
            else:
                # Fallback to straight line between node positions
                pos1 = self.graph.nodes[src]['pos'] if src in self.graph.nodes else (0, 0)
                pos2 = self.graph.nodes[tgt]['pos'] if tgt in self.graph.nodes else (0, 0)
                detailed_coords.append({"id": f"{src}_direct", "x": round(pos1[0], 2), "y": round(pos1[1], 2)})
                detailed_coords.append({"id": f"{tgt}_direct", "x": round(pos2[0], 2), "y": round(pos2[1], 2)})

        return detailed_coords

    def inject_traffic_incident(self, candidate_edges: Optional[List[Tuple[str, str]]] = None, count: int = 2) -> List[Dict[str, Any]]:
        """Simulates authentic Delhi traffic choke points (Mathura Road, Nehru Place, Govindpuri)."""
        incidents = []
        self.incident_affected_nodes.clear()

        delhi_chokepoints = [
            ("Mathura Road (NH-2) near Nehru Place Flyover", "Waterlogging / Heavy Gridlock"),
            ("Okhla Phase-II Main Workshop Spine", "Truck Breakdown / Lane Blocked"),
            ("Govindpuri Metro Intersection", "Signal Failure & Heavy Traffic"),
            ("Ring Road Kalkaji Mandir Underpass", "VIP Movement / Diverted Lanes"),
            ("Kalindi Kunj Ghat Road", "Yamuna Bridge Construction Bottleneck"),
        ]

        # Select delivery stops to be in congested zones
        if self.delivery_nodes:
            sample_size = min(count, len(self.delivery_nodes))
            chosen = self.rng.choice(self.delivery_nodes, size=sample_size, replace=False)

            for idx, d in enumerate(chosen):
                node_id = str(d['node_id'])
                self.incident_affected_nodes.add(node_id)
                choke_title, reason = delhi_chokepoints[idx % len(delhi_chokepoints)]
                cong_factor = round(float(self.rng.uniform(4.8, 6.2)), 2)

                incidents.append({
                    "u": node_id,
                    "v": self.depot_node,
                    "road_name": f"{choke_title} — {d['locality']}",
                    "reason": reason,
                    "old_time": 8.5,
                    "new_time": round(8.5 * cong_factor, 1),
                    "congestion_factor": cong_factor,
                    "status": "incident"
                })

        self.active_incidents = incidents
        return incidents

    def clear_incidents(self):
        """Resets all Delhi edges back to base_time and clears active incidents."""
        for u, v in self.graph.edges:
            edge_data = self.graph[u][v]
            edge_data["current_time"] = edge_data["base_time"]
            edge_data["congestion_factor"] = 1.0
            edge_data["status"] = "normal"
        self.incident_affected_nodes.clear()
        self.active_incidents = []

    def to_dict(self) -> Dict[str, Any]:
        """Serializes the city model for frontend rendering."""
        # Include delivery nodes and depot
        nodes_out = [
            {
                "id": self.depot_node,
                "x": round(self.depot_pos[0], 2),
                "y": round(self.depot_pos[1], 2),
                "lat": self.depot_lat,
                "lng": self.depot_lng,
                "type": "depot",
                "label": self.depot_label
            }
        ]

        for d in self.delivery_nodes:
            nodes_out.append({
                "id": str(d['node_id']),
                "x": round(d['pos'][0], 2),
                "y": round(d['pos'][1], 2),
                "lat": d.get('lat'),
                "lng": d.get('lng'),
                "type": "stop",
                "label": d['label']
            })

        # Edges for incidents
        edges_out = []
        for inc in self.active_incidents:
            u_node = inc["u"]
            u_pos = self.graph.nodes[u_node]["pos"] if u_node in self.graph.nodes else (500, 500)
            edges_out.append({
                "u": u_node,
                "v": self.depot_node,
                "x1": round(u_pos[0], 2),
                "y1": round(u_pos[1], 2),
                "x2": round(self.depot_pos[0], 2),
                "y2": round(self.depot_pos[1], 2),
                "distance": 3.2,
                "speed_limit": 35.0,
                "base_time": inc.get("old_time", 8.0),
                "current_time": inc.get("new_time", 42.0),
                "congestion_factor": inc.get("congestion_factor", 5.2),
                "status": "incident",
                "road_name": inc["road_name"]
            })

        return {
            "region_name": "Okhla Phase I/II — Nehru Place — Kalkaji — Jasola, South-East Delhi (OpenStreetMap Drive Network)",
            "city_name": "New Delhi, India",
            "width": self.width,
            "height": self.height,
            "is_real_osm": self.is_real_osm,
            "roads_summary": self.roads_summary,
            "depot": {
                "id": self.depot_node,
                "label": self.depot_label,
                "x": round(self.depot_pos[0], 2),
                "y": round(self.depot_pos[1], 2),
                "lat": self.depot_lat,
                "lng": self.depot_lng
            },
            "landmarks": self.landmarks,
            "districts": self.districts,
            "river_path": self.river_path,
            "nodes": nodes_out,
            "edges": edges_out,
            "deliveries": self.delivery_nodes
        }
