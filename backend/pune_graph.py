"""
Real-World Road Network Model: Ambegaon - Vadgaon BK - Sinhgad Institutes Campus, Pune, Maharashtra.
High-Clarity GIS Projection & Structured Corridor Grid:
- Northern Arterial: Sinhgad Road (Dhayari Phata -> Manik Baug -> Vadgaon Bridge -> Vadgaon Phata -> Anand Nagar -> Hingne)
- Eastern Expressway: Mumbai-Bengaluru Highway NH 48 Bypass (Navale Bridge -> Ambegaon Flyover -> D-Mart -> Katraj Bypass)
- Central Zone: Sinhgad Vadgaon Campus Quad (SCOE, SKN Hospital, Sinhgad Law, Sports Complex, NBN Campus)
- Southern Zone: Ambegaon Gaothan, Ambegaon Valley & Residential Enclaves
"""

from typing import Dict, List, Tuple, Any, Optional
import networkx as nx
import numpy as np

class PuneCityGraph:
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.graph: nx.Graph = nx.Graph()
        
        self.width = 1200.0
        self.height = 900.0
        
        # Central Depot: Sinhgad Central Logistics Hub
        self.depot_node = "PUNE_SINHGAD_DEPOT"
        self.depot_pos = (340.0, 440.0)
        self.depot_lat, self.depot_lng = 18.4635, 73.8340
        
        self.delivery_nodes: List[Dict[str, Any]] = []
        self.active_incidents: List[Dict[str, Any]] = []
        
        # Real Pune Landmarks with cleanly spaced coordinate positions
        self.landmarks = [
            {
                "id": "SCOE",
                "name": "SCOE Engineering College",
                "short": "SCOE",
                "lat": 18.4645,
                "lng": 73.8355,
                "pos": (500.0, 440.0),
                "type": "college",
                "desc": "Sinhgad College of Engineering Main Campus"
            },
            {
                "id": "SKN_HOSPITAL",
                "name": "SKN Medical & Hospital",
                "short": "SKN Hospital",
                "lat": 18.4615,
                "lng": 73.8320,
                "pos": (220.0, 540.0),
                "type": "hospital",
                "desc": "Smt. Kashibai Navale General Hospital"
            },
            {
                "id": "NAVALE_BRIDGE",
                "name": "Navale Bridge (NH 48 Bypass)",
                "short": "Navale Bridge",
                "lat": 18.4600,
                "lng": 73.8470,
                "pos": (980.0, 380.0),
                "type": "bridge",
                "desc": "Major Expressway Interchange & Transit Choke"
            },
            {
                "id": "VADGAON_PHATA",
                "name": "Vadgaon Phata Chowk",
                "short": "Vadgaon Phata",
                "lat": 18.4720,
                "lng": 73.8310,
                "pos": (740.0, 210.0),
                "type": "junction",
                "desc": "Sinhgad Road Main Commercial Junction"
            },
            {
                "id": "AMBEGAON_DMART",
                "name": "Ambegaon D-Mart / Highway",
                "short": "D-Mart Ambegaon",
                "lat": 18.4510,
                "lng": 73.8430,
                "pos": (1020.0, 660.0),
                "type": "commercial",
                "desc": "Ambegaon BK Commercial Shopping Complex"
            },
            {
                "id": "DHAYARI_PHATA",
                "name": "Dhayari Phata (Sinhgad Rd)",
                "short": "Dhayari Phata",
                "lat": 18.4680,
                "lng": 73.8180,
                "pos": (160.0, 210.0),
                "type": "junction",
                "desc": "Western Entry Gate to Sinhgad Road"
            },
            {
                "id": "SINHGAD_LAW",
                "name": "Sinhgad Law & Dental College",
                "short": "Law College",
                "lat": 18.4655,
                "lng": 73.8385,
                "pos": (700.0, 440.0),
                "type": "college",
                "desc": "Sinhgad Law & Dental Campus"
            },
            {
                "id": "FUN_TIME",
                "name": "Fun Time Multiplex (Manik Baug)",
                "short": "Fun Time",
                "lat": 18.4770,
                "lng": 73.8260,
                "pos": (360.0, 210.0),
                "type": "commercial",
                "desc": "Manik Baug Retail & Entertainment Hub"
            },
            {
                "id": "NBN_SINHGAD",
                "name": "NBN Sinhgad Campus",
                "short": "NBN Campus",
                "lat": 18.4550,
                "lng": 73.8330,
                "pos": (700.0, 560.0),
                "type": "college",
                "desc": "NBN Sinhgad School of Engineering"
            },
            {
                "id": "AMBEGAON_VALLEY",
                "name": "Ambegaon Khurd Valley",
                "short": "Ambegaon Valley",
                "lat": 18.4480,
                "lng": 73.8360,
                "pos": (720.0, 760.0),
                "type": "residential",
                "desc": "Ambegaon Residential Hill Enclaves"
            }
        ]
        
        # Real Waterway: Mutha River Corridor across the North
        self.river_path = [
            (80.0, 110.0),
            (320.0, 125.0),
            (600.0, 115.0),
            (880.0, 130.0),
            (1140.0, 120.0)
        ]
        
        # City Zones for visual background grouping
        self.districts = [
            {"name": "MUTHA RIVER CORRIDOR", "x": 600, "y": 90, "type": "waterway"},
            {"name": "SINHGAD ROAD ARTERIAL", "x": 550, "y": 180, "type": "arterial"},
            {"name": "SINHGAD INSTITUTES VADGAON CAMPUS", "x": 480, "y": 380, "type": "campus"},
            {"name": "NH 48 MUMBAI-BENGALURU EXPRESSWAY", "x": 1050, "y": 480, "type": "highway"},
            {"name": "AMBEGAON BK RESIDENTIAL SECTOR", "x": 620, "y": 700, "type": "residential"}
        ]
        
        self.build_network()

    def build_network(self):
        """Builds a clear, structured graph topology of Ambegaon, Vadgaon, and Sinhgad Campus."""
        self.graph.clear()
        
        # 1. Clear Nodes Structure with exact layout coordinates
        nodes_data = [
            # Sinhgad Vadgaon Campus Hub
            ("PUNE_SINHGAD_DEPOT", 18.4635, 73.8340, (340.0, 440.0), "Sinhgad Central Hub (Depot)", "depot"),
            ("INT_SCOE_GATE", 18.4645, 73.8355, (500.0, 440.0), "SCOE Main Gate", "intersection"),
            ("INT_SKN_MED", 18.4615, 73.8320, (220.0, 540.0), "SKN Hospital & Medical College", "intersection"),
            ("INT_SINHGAD_LAW", 18.4655, 73.8385, (700.0, 440.0), "Sinhgad Law College Circle", "intersection"),
            ("INT_CAMPUS_SPORTS", 18.4580, 73.8345, (500.0, 560.0), "Sinhgad Sports Ground Chowk", "intersection"),
            ("INT_NBN_CAMPUS", 18.4550, 73.8330, (700.0, 560.0), "NBN Sinhgad Campus Road", "intersection"),
            
            # Sinhgad Road Main Arterial (West to East)
            ("INT_DHAYARI_PHATA", 18.4680, 73.8180, (160.0, 210.0), "Dhayari Phata Chowk", "intersection"),
            ("INT_FUN_TIME", 18.4770, 73.8260, (360.0, 210.0), "Manik Baug (Fun Time)", "intersection"),
            ("INT_VADGAON_BRIDGE", 18.4710, 73.8240, (560.0, 210.0), "Vadgaon Bridge Chowk", "intersection"),
            ("INT_VADGAON_PHATA", 18.4720, 73.8310, (740.0, 210.0), "Vadgaon Phata Main Chowk", "intersection"),
            ("INT_ANAND_NAGAR", 18.4750, 73.8370, (920.0, 210.0), "Anand Nagar Chowk", "intersection"),
            ("INT_HINGNE_KHURD", 18.4765, 73.8450, (1080.0, 210.0), "Hingne Khurd / Canal Road", "intersection"),
            
            # Vadgaon Central Intermediary Grid
            ("INT_VADGAON_MARKET", 18.4695, 73.8270, (560.0, 320.0), "Vadgaon Central Market", "intersection"),
            ("INT_CANAL_LINK", 18.4700, 73.8390, (860.0, 320.0), "Mutha Canal Link Chowk", "intersection"),
            
            # Mumbai-Bengaluru Highway NH 48 Bypass (North to South)
            ("INT_NAVALE_BRIDGE", 18.4600, 73.8470, (980.0, 380.0), "Navale Bridge Interchange", "intersection"),
            ("INT_HIGHWAY_AMBEGAON_N", 18.4560, 73.8450, (1020.0, 520.0), "Ambegaon Flyover Chowk", "intersection"),
            ("INT_AMBEGAON_DMART", 18.4510, 73.8430, (1020.0, 660.0), "Ambegaon D-Mart Commercial", "intersection"),
            ("INT_KATRAJ_BYPASS_S", 18.4470, 73.8410, (1020.0, 800.0), "Katraj-Dehu Bypass South", "intersection"),
            
            # Ambegaon Residential Grid
            ("INT_AMBEGAON_GAOTHAN", 18.4520, 73.8370, (520.0, 720.0), "Ambegaon Gaothan Chowk", "intersection"),
            ("INT_AMBEGAON_VALLEY", 18.4480, 73.8340, (720.0, 760.0), "Ambegaon Valley Rd", "intersection"),
            ("INT_AMBEGAON_PATHAN", 18.4500, 73.8390, (880.0, 740.0), "Ambegaon Pathan Enclave", "intersection"),
            ("INT_TELCO_COLONY", 18.4590, 73.8230, (220.0, 700.0), "Telco Colony / Dhayari Link", "intersection"),
        ]
        
        for n_id, lat, lng, pos, label, n_type in nodes_data:
            self.graph.add_node(
                n_id,
                lat=lat,
                lng=lng,
                pos=pos,
                label=label,
                type=n_type
            )
            
        # 2. Authentic Street Segments (Corridors, Connectors, and Arterials)
        road_segments = [
            # A. Sinhgad Road Main Arterial (50 km/h)
            ("INT_DHAYARI_PHATA", "INT_FUN_TIME", "Sinhgad Road (Manik Baug)", 50.0, 0.75),
            ("INT_FUN_TIME", "INT_VADGAON_BRIDGE", "Sinhgad Road (Vadgaon West)", 50.0, 0.70),
            ("INT_VADGAON_BRIDGE", "INT_VADGAON_PHATA", "Sinhgad Road (Vadgaon Central)", 50.0, 0.65),
            ("INT_VADGAON_PHATA", "INT_ANAND_NAGAR", "Sinhgad Road (Anand Nagar)", 50.0, 0.70),
            ("INT_ANAND_NAGAR", "INT_HINGNE_KHURD", "Sinhgad Road (Hingne Ext)", 50.0, 0.85),
            
            # B. NH 48 Expressway Bypass (65-70 km/h)
            ("INT_HINGNE_KHURD", "INT_NAVALE_BRIDGE", "NH 48 Hingne Approach", 65.0, 0.90),
            ("INT_NAVALE_BRIDGE", "INT_HIGHWAY_AMBEGAON_N", "NH 48 Mumbai-Pune Expressway", 70.0, 0.80),
            ("INT_HIGHWAY_AMBEGAON_N", "INT_AMBEGAON_DMART", "NH 48 Ambegaon Bypass", 70.0, 0.75),
            ("INT_AMBEGAON_DMART", "INT_KATRAJ_BYPASS_S", "NH 48 Katraj Expressway", 70.0, 0.80),
            
            # C. Sinhgad Vadgaon Campus Internal Grid (35 km/h)
            ("PUNE_SINHGAD_DEPOT", "INT_SCOE_GATE", "SCOE Central Avenue", 35.0, 0.40),
            ("PUNE_SINHGAD_DEPOT", "INT_SKN_MED", "SKN Medical Hospital Lane", 35.0, 0.45),
            ("INT_SCOE_GATE", "INT_SINHGAD_LAW", "Sinhgad Law College Ave", 35.0, 0.50),
            ("PUNE_SINHGAD_DEPOT", "INT_CAMPUS_SPORTS", "Campus Sports Complex Rd", 35.0, 0.55),
            ("INT_SCOE_GATE", "INT_CAMPUS_SPORTS", "SCOE Quad Link", 35.0, 0.40),
            ("INT_SINHGAD_LAW", "INT_NBN_CAMPUS", "Law-NBN Campus Link", 35.0, 0.45),
            ("INT_CAMPUS_SPORTS", "INT_NBN_CAMPUS", "NBN Sinhgad Link", 35.0, 0.50),
            
            # D. Campus to Sinhgad Road & Vadgaon Connectors
            ("INT_FUN_TIME", "PUNE_SINHGAD_DEPOT", "Manik Baug Hill Access", 40.0, 0.85),
            ("INT_VADGAON_BRIDGE", "INT_VADGAON_MARKET", "Vadgaon Bridge Descent", 40.0, 0.45),
            ("INT_VADGAON_MARKET", "INT_SCOE_GATE", "SCOE Vadgaon Main Gate Rd", 40.0, 0.55),
            ("INT_VADGAON_PHATA", "INT_CANAL_LINK", "Vadgaon Phata Link", 45.0, 0.55),
            ("INT_CANAL_LINK", "INT_SINHGAD_LAW", "Law College North Approach", 40.0, 0.50),
            
            # E. Navale Bridge Cross-Connectors (Crucial Traffic Arterials)
            ("INT_VADGAON_PHATA", "INT_NAVALE_BRIDGE", "Vadgaon-Navale Arterial Link", 45.0, 1.10),
            ("INT_CANAL_LINK", "INT_NAVALE_BRIDGE", "Mutha Canal to Navale Bridge", 40.0, 0.70),
            ("INT_SINHGAD_LAW", "INT_NAVALE_BRIDGE", "Sinhgad-Navale Connector", 45.0, 0.85),
            
            # F. Ambegaon Residential & Commercial Grid (40 km/h)
            ("INT_CAMPUS_SPORTS", "INT_AMBEGAON_GAOTHAN", "Sinhgad-Ambegaon South Rd", 40.0, 0.60),
            ("INT_NBN_CAMPUS", "INT_HIGHWAY_AMBEGAON_N", "NBN to Highway Flyover Rd", 40.0, 0.75),
            ("INT_AMBEGAON_GAOTHAN", "INT_AMBEGAON_VALLEY", "Ambegaon Gaothan Central", 35.0, 0.50),
            ("INT_AMBEGAON_VALLEY", "INT_AMBEGAON_PATHAN", "Ambegaon Valley Link", 35.0, 0.45),
            ("INT_AMBEGAON_PATHAN", "INT_AMBEGAON_DMART", "D-Mart Ambegaon Access", 40.0, 0.45),
            ("INT_AMBEGAON_VALLEY", "INT_KATRAJ_BYPASS_S", "Ambegaon to Katraj Bypass", 40.0, 0.65),
            
            # G. SKN Hospital & Dhayari/Telco Western Links
            ("INT_DHAYARI_PHATA", "INT_TELCO_COLONY", "Dhayari-Telco Service Lane", 40.0, 0.90),
            ("INT_SKN_MED", "INT_TELCO_COLONY", "SKN-Telco Link Road", 35.0, 0.60),
            ("INT_TELCO_COLONY", "INT_AMBEGAON_GAOTHAN", "Telco to Ambegaon Link", 35.0, 0.85),
        ]
        
        for u, v, road_name, speed, dist_km in road_segments:
            if u in self.graph.nodes and v in self.graph.nodes:
                base_time_min = round((dist_km / speed) * 60.0, 2)
                self.graph.add_edge(
                    u, v,
                    road_name=road_name,
                    distance=round(dist_km, 2),
                    speed_limit=speed,
                    base_time=base_time_min,
                    current_time=base_time_min,
                    congestion_factor=1.0,
                    status="normal"
                )

    def generate_deliveries(self, num_deliveries: int = 25, seed: Optional[int] = None) -> List[Dict[str, Any]]:
        """Generates delivery packages distributed cleanly across Sinhgad campus & Ambegaon localities."""
        active_seed = seed if seed is not None else self.seed
        rng = np.random.default_rng(active_seed)
        
        intersections = [n for n in self.graph.nodes() if n != self.depot_node]
        chosen_nodes = rng.choice(intersections, size=num_deliveries, replace=(num_deliveries > len(intersections)))
        
        delivery_localities = [
            "Sinhgad SCOE Hostel Quad", "SKN Hospital Resident Doctors Qtrs", "Sinhgad Dental Clinic",
            "Vadgaon Phata Commercial Market", "Anand Nagar Society", "Manik Baug Residency",
            "Navale Bridge Auto Plaza", "Ambegaon D-Mart Complex", "Dhayari Phata Junction",
            "NBN Sinhgad Tech Complex", "Ambegaon Valley Heights", "Hingne Canal Enclave"
        ]
        
        self.delivery_nodes = []
        for idx, node_id in enumerate(chosen_nodes):
            node_str = str(node_id)
            node_data = self.graph.nodes[node_str]
            pos = node_data["pos"]
            
            # Subtle jitter so delivery pins cluster cleanly around known intersections
            offset_x = rng.uniform(-16.0, 16.0)
            offset_y = rng.uniform(-16.0, 16.0)
            loc_label = delivery_localities[idx % len(delivery_localities)]
            
            self.delivery_nodes.append({
                "id": idx + 1,
                "node_id": node_str,
                "label": f"Stop {idx+1}: {loc_label}",
                "locality": loc_label,
                "pos": (round(pos[0] + offset_x, 2), round(pos[1] + offset_y, 2)),
                "base_pos": pos,
                "demand": 1,
                "priority": "high" if idx % 4 == 0 else "normal"
            })
            
        return self.delivery_nodes

    def get_shortest_path_matrices(self) -> Tuple[Dict[str, Dict[str, float]], Dict[str, Dict[str, float]], Dict[str, Dict[str, List[str]]]]:
        time_dict = dict(nx.all_pairs_dijkstra_path_length(self.graph, weight="current_time"))
        dist_dict = dict(nx.all_pairs_dijkstra_path_length(self.graph, weight="distance"))
        paths_dict = dict(nx.all_pairs_dijkstra_path(self.graph, weight="current_time"))
        return time_dict, dist_dict, paths_dict

    def inject_traffic_incident(self, candidate_edges: Optional[List[Tuple[str, str]]] = None, count: int = 2) -> List[Dict[str, Any]]:
        """Simulates real Pune traffic choke points (e.g. Navale Bridge rush hour, Vadgaon Phata jam)."""
        incidents = []
        
        priority_pune_chokes = [
            ("INT_VADGAON_PHATA", "INT_NAVALE_BRIDGE"),
            ("INT_NAVALE_BRIDGE", "INT_HIGHWAY_AMBEGAON_N"),
            ("INT_VADGAON_BRIDGE", "INT_VADGAON_PHATA"),
            ("INT_SCOE_GATE", "INT_VADGAON_MARKET"),
            ("INT_HIGHWAY_AMBEGAON_N", "INT_AMBEGAON_DMART")
        ]
        
        target_edges = []
        if candidate_edges and len(candidate_edges) > 0:
            unique_candidates = list(set(candidate_edges))
            sample_size = min(count, len(unique_candidates))
            indices = self.rng.choice(len(unique_candidates), size=sample_size, replace=False)
            target_edges = [unique_candidates[i] for i in indices]
        else:
            valid_chokes = [e for e in priority_pune_chokes if self.graph.has_edge(e[0], e[1])]
            sample_size = min(count, len(valid_chokes))
            indices = self.rng.choice(len(valid_chokes), size=sample_size, replace=False)
            target_edges = [valid_chokes[i] for i in indices]

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
                
        self.active_incidents = incidents
        return incidents

    def to_dict(self) -> Dict[str, Any]:
        nodes_out = [
            {
                "id": n,
                "x": round(data["pos"][0], 2),
                "y": round(data["pos"][1], 2),
                "lat": data.get("lat"),
                "lng": data.get("lng"),
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
            "region_name": "Ambegaon - Vadgaon BK - Sinhgad Institutes Campus, Pune",
            "city_name": "Pune, Maharashtra",
            "width": self.width,
            "height": self.height,
            "depot": {
                "id": self.depot_node,
                "label": "Sinhgad Central Hub (Depot)",
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
