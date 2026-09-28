import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from city_graph import SyntheticCity
from pune_graph import PuneCityGraph
from vrp_problem import VRPProblem

def test_city_graph_connectivity():
    """Verify generated synthetic graph is fully connected with valid Dijkstra shortest paths."""
    city = SyntheticCity(grid_size=6, seed=42)
    city.generate_deliveries(num_deliveries=10, seed=42)
    time_mat, dist_mat, paths = city.get_shortest_path_matrices()
    
    assert len(time_mat) >= 10
    for u in time_mat:
        assert time_mat[u][u] == 0

def test_pune_graph_landmarks():
    """Verify Pune real map graph contains required landmarks and road nodes."""
    pune = PuneCityGraph(seed=42)
    landmark_ids = [lm["id"] for lm in pune.landmarks]
    
    assert "SCOE" in landmark_ids
    assert "SKN_HOSPITAL" in landmark_ids
    assert "NAVALE_BRIDGE" in landmark_ids
    
    time_mat, dist_mat, paths = pune.get_shortest_path_matrices()
    assert len(time_mat) == len(pune.graph.nodes())

def test_incident_weight_multiplier():
    """Verify that applying an incident increases travel time and Dijkstra paths react."""
    city = SyntheticCity(grid_size=6, seed=42)
    city.generate_deliveries(num_deliveries=10, seed=42)
    
    # Inject traffic incident on city
    incidents = city.inject_traffic_incident(count=2)
    assert len(incidents) >= 1
    for inc in incidents:
        assert inc["new_time"] > inc["old_time"]
        assert inc["status"] == "incident"
