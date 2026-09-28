"""
build_city.py — One-time OSMnx data extraction for South-East Delhi (Okhla Phase I/II, Nehru Place, Kalkaji).

Run ONCE with internet:
    python backend/data/build_city.py

Outputs (saved to backend/data/):
    okhla_roads.json   — Road edges with geometry polylines and road types
    okhla_stops.json   — 50 delivery stops + depot location
    okhla_paths.json   — Precomputed shortest paths between all stops and depot

After running, the app loads these JSON files at startup — NO internet required at runtime.
"""

import os
import sys
import json
import math
import numpy as np
import networkx as nx

# Ensure we can import from the backend directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    import osmnx as ox
except ImportError:
    print("ERROR: osmnx not installed. Run: pip install osmnx")
    sys.exit(1)

# ============================================================================
# CONFIG
# ============================================================================

# Bounding box for Okhla Phase I/II, Nehru Place, Kalkaji (~3×3 km)
NORTH = 28.5560   # Lotus Temple / Nehru Place top
SOUTH = 28.5270   # Okhla Bird Sanctuary / Phase-II south
EAST  = 77.2860   # Yamuna / Sarita Vihar east
WEST  = 77.2400   # GK-I / Chirag Delhi west

# Depot location — near Okhla Phase-II center
DEPOT_LAT = 28.5350
DEPOT_LNG = 77.2720

SEED = 7
NUM_STOPS = 50
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# Road types to keep (filter out service roads, footpaths, etc.)
KEEP_HIGHWAY_TYPES = {'primary', 'secondary', 'tertiary', 'residential',
                       'primary_link', 'secondary_link', 'tertiary_link',
                       'trunk', 'trunk_link'}

# SVG canvas mapping
SVG_WIDTH = 1200.0
SVG_HEIGHT = 900.0
SVG_PADDING = 40.0

# ============================================================================
# HELPERS
# ============================================================================

def lat_lng_to_svg(lat, lng, bounds):
    """Convert lat/lng to SVG canvas coordinates."""
    lat_min, lat_max, lng_min, lng_max = bounds
    # Longitude → X (left to right)
    x = SVG_PADDING + (lng - lng_min) / (lng_max - lng_min) * (SVG_WIDTH - 2 * SVG_PADDING)
    # Latitude → Y (top to bottom, invert because lat increases upward)
    y = SVG_PADDING + (1.0 - (lat - lat_min) / (lat_max - lat_min)) * (SVG_HEIGHT - 2 * SVG_PADDING)
    return round(x, 2), round(y, 2)


def classify_road(highway_tag):
    """Classify OSM highway tag into display categories."""
    if isinstance(highway_tag, list):
        highway_tag = highway_tag[0]
    if highway_tag in ('primary', 'primary_link', 'trunk', 'trunk_link'):
        return 'primary'
    elif highway_tag in ('secondary', 'secondary_link'):
        return 'secondary'
    elif highway_tag in ('tertiary', 'tertiary_link'):
        return 'tertiary'
    else:
        return 'residential'


def get_road_name(edge_data):
    """Extract road name from OSM edge data."""
    name = edge_data.get('name', '')
    if isinstance(name, list):
        name = name[0]
    return name or ''


# ============================================================================
# MAIN BUILD
# ============================================================================

def main():
    print("=" * 70)
    print("  OSMnx Road Network Builder — Delhi Okhla / Nehru Place / Kalkaji")
    print("=" * 70)

    # 1. Download road network from OpenStreetMap
    print("\n[1/6] Downloading road network from OpenStreetMap...")
    print(f"       Bounding box: N={NORTH}, S={SOUTH}, E={EAST}, W={WEST}")

    G = ox.graph_from_bbox(
        bbox=(WEST, SOUTH, EAST, NORTH),
        network_type='drive',
        simplify=True,
        retain_all=False,
        truncate_by_edge=True
    )

    print(f"       Raw graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    # 2. Filter to keep only desired road types
    print("\n[2/6] Filtering road types (primary/secondary/tertiary/residential)...")
    edges_to_remove = []
    for u, v, k, data in G.edges(keys=True, data=True):
        highway = data.get('highway', '')
        if isinstance(highway, list):
            highway_set = set(highway)
        else:
            highway_set = {highway}
        if not highway_set.intersection(KEEP_HIGHWAY_TYPES):
            edges_to_remove.append((u, v, k))

    G.remove_edges_from(edges_to_remove)

    # Keep largest strongly connected component so all nodes can reach each other
    if nx.is_strongly_connected(G):
        pass
    else:
        sccs = list(nx.strongly_connected_components(G))
        if sccs:
            largest_scc = max(sccs, key=len)
            G = G.subgraph(largest_scc).copy()

    # Remove isolated nodes
    isolated = list(nx.isolates(G))
    G.remove_nodes_from(isolated)

    print(f"       Filtered connected graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    # 3. Build coordinate bounds for SVG mapping
    bounds = (SOUTH, NORTH, WEST, EAST)

    # 4. Export roads as edge list with geometry polylines
    print("\n[3/6] Extracting road geometry polylines...")
    roads = []
    for u, v, k, data in G.edges(keys=True, data=True):
        # Get geometry (linestring of points along the road)
        if 'geometry' in data:
            coords = list(data['geometry'].coords)  # [(lng, lat), ...]
        else:
            # Straight line between nodes
            u_data = G.nodes[u]
            v_data = G.nodes[v]
            coords = [(u_data['x'], u_data['y']), (v_data['x'], v_data['y'])]

        # Convert to SVG coordinates
        svg_points = []
        for lng, lat in coords:
            sx, sy = lat_lng_to_svg(lat, lng, bounds)
            svg_points.append([sx, sy])

        road_type = classify_road(data.get('highway', 'residential'))
        road_name = get_road_name(data)
        length_m = data.get('length', 0)
        oneway = data.get('oneway', False)
        max_speed = data.get('maxspeed', '')
        if isinstance(max_speed, list):
            max_speed = max_speed[0]

        roads.append({
            'u': int(u),
            'v': int(v),
            'road_type': road_type,
            'road_name': road_name,
            'length_m': round(length_m, 1),
            'oneway': bool(oneway),
            'maxspeed': str(max_speed),
            'points': svg_points
        })

    print(f"       Exported {len(roads)} road segments with polyline geometry")

    # 5. Pick depot and 50 stops
    print(f"\n[4/6] Selecting depot and {NUM_STOPS} delivery stops (seed={SEED})...")
    rng = np.random.default_rng(SEED)

    # Find nearest node to depot location
    depot_node = ox.nearest_nodes(G, DEPOT_LNG, DEPOT_LAT)
    depot_data = G.nodes[depot_node]
    depot_svg = lat_lng_to_svg(depot_data['y'], depot_data['x'], bounds)

    print(f"       Depot node: {depot_node} at ({depot_data['y']:.5f}, {depot_data['x']:.5f})")

    # Get all candidate nodes (exclude depot)
    all_nodes = [n for n in G.nodes() if n != depot_node]

    # Pick stops spread across the network
    stop_node_ids = rng.choice(all_nodes, size=min(NUM_STOPS, len(all_nodes)), replace=False)

    # Delhi delivery locality names for realistic labels
    locality_names = [
        "Nehru Place IT Tower", "Lotus Temple Complex", "Kalkaji Mandir Market",
        "Govindpuri Metro Colony", "Okhla Phase-I Block A", "NSIC Exhibition Ground",
        "Jasola Vihar DLF Tower", "Apollo Hospital Delivery", "Sarita Vihar Society",
        "Okhla Phase-II Workshop", "Kalindi Kunj Gate", "Harkesh Nagar Office",
        "GK-I M Block Boutique", "Chirag Delhi Enclave", "Madanpur Khadar Cluster",
        "Okhla Bird Sanctuary Office", "Ring Road Junction Box", "Mathura Road Warehouse",
        "Tughlakabad Colony", "Sangam Vihar Market", "Kalkaji Extension Shop",
        "Nehru Place Epicentre", "Govindpuri Extension", "Jasola Village Complex",
        "Phase-II Industrial Plot", "DND Flyway Service Area", "Okhla Mandi",
        "Nehru Enclave Residence", "Lotus Colony Gate", "Kalkaji DDA Flats",
        "Govindpuri Jhuggi Area", "Okhla Phase-I Block B", "NSIC Tool Room",
        "Jasola Apollo Lane", "Sarita Vihar Pocket-D", "Phase-II EcoTech Park",
        "Kalindi Kunj Park Entry", "Harkesh Nagar Metro Exit", "GK-I N Block",
        "Chirag Delhi Metro Stn", "Madanpur Extension", "Bird Sanctuary Trail",
        "Ring Road Service Lane", "Mathura Road Flyover", "Tughlakabad Ext Colony",
        "Sangam Vihar Sector-J", "Kalkaji Temple Lane", "Nehru Place Hind Cinema",
        "Govindpuri Depot Lane", "Jasola District Centre"
    ]

    stops = []
    for idx, node_id in enumerate(stop_node_ids):
        node_id_int = int(node_id)
        nd = G.nodes[node_id_int]
        sx, sy = lat_lng_to_svg(nd['y'], nd['x'], bounds)
        # Small jitter for visual clarity when nodes overlap
        jx = float(rng.uniform(-6, 6))
        jy = float(rng.uniform(-6, 6))
        loc_name = locality_names[idx % len(locality_names)]

        stops.append({
            'id': idx + 1,
            'node_id': node_id_int,
            'label': f"Stop {idx + 1}: {loc_name}",
            'locality': loc_name,
            'lat': round(nd['y'], 6),
            'lng': round(nd['x'], 6),
            'pos': [round(sx + jx, 2), round(sy + jy, 2)],
            'base_pos': [round(sx, 2), round(sy, 2)],
            'demand': 1,
            'priority': 'high' if idx % 4 == 0 else 'normal'
        })

    stops_data = {
        'depot': {
            'id': 'DELHI_OKHLA_DEPOT',
            'node_id': int(depot_node),
            'label': 'NSIC Complex — Central Depot',
            'lat': round(depot_data['y'], 6),
            'lng': round(depot_data['x'], 6),
            'pos': list(depot_svg)
        },
        'stops': stops,
        'seed': SEED
    }

    print(f"       Depot at SVG ({depot_svg[0]}, {depot_svg[1]})")
    print(f"       {len(stops)} delivery stops selected")

    # 6. Compute shortest paths between depot and all stops, and between all pairs of stops
    print(f"\n[5/6] Computing shortest paths (Dijkstra) between depot and {len(stops)} stops...")

    # Build list of key nodes: depot + all stops
    key_nodes = [int(depot_node)] + [s['node_id'] for s in stops]

    # Compute shortest path lengths and paths for all key node pairs
    paths_data = {}
    path_count = 0
    failed_pairs = 0

    for src in key_nodes:
        paths_data[str(src)] = {}
        for tgt in key_nodes:
            if src == tgt:
                paths_data[str(src)][str(tgt)] = {
                    'distance_m': 0,
                    'path_nodes': [src],
                    'svg_path': []
                }
                continue

            try:
                path_nodes = nx.shortest_path(G, src, tgt, weight='length')
                path_length = nx.shortest_path_length(G, src, tgt, weight='length')

                # Convert path to SVG polyline
                svg_path = []
                for i in range(len(path_nodes) - 1):
                    u_node = path_nodes[i]
                    v_node = path_nodes[i + 1]

                    # Find the edge (may have multiple keys in multigraph)
                    if G.has_edge(u_node, v_node):
                        edge_data = G[u_node][v_node]
                        # Get first key's data
                        first_key = list(edge_data.keys())[0]
                        edata = edge_data[first_key]

                        if 'geometry' in edata:
                            coords = list(edata['geometry'].coords)
                        else:
                            u_d = G.nodes[u_node]
                            v_d = G.nodes[v_node]
                            coords = [(u_d['x'], u_d['y']), (v_d['x'], v_d['y'])]

                        # Check direction — geometry might be reversed
                        u_d = G.nodes[u_node]
                        first_coord = coords[0]
                        dist_to_first = (first_coord[0] - u_d['x'])**2 + (first_coord[1] - u_d['y'])**2
                        last_coord = coords[-1]
                        dist_to_last = (last_coord[0] - u_d['x'])**2 + (last_coord[1] - u_d['y'])**2

                        if dist_to_last < dist_to_first:
                            coords = list(reversed(coords))

                        for lng, lat in coords:
                            sx, sy = lat_lng_to_svg(lat, lng, bounds)
                            svg_path.append([sx, sy])
                    else:
                        # Fallback: straight line
                        u_d = G.nodes[u_node]
                        v_d = G.nodes[v_node]
                        sx1, sy1 = lat_lng_to_svg(u_d['y'], u_d['x'], bounds)
                        sx2, sy2 = lat_lng_to_svg(v_d['y'], v_d['x'], bounds)
                        svg_path.append([sx1, sy1])
                        svg_path.append([sx2, sy2])

                # Deduplicate consecutive identical points
                deduped = [svg_path[0]]
                for pt in svg_path[1:]:
                    if pt != deduped[-1]:
                        deduped.append(pt)

                paths_data[str(src)][str(tgt)] = {
                    'distance_m': round(path_length, 1),
                    'path_nodes': [int(n) for n in path_nodes],
                    'svg_path': deduped
                }
                path_count += 1
            except nx.NetworkXNoPath:
                failed_pairs += 1
                paths_data[str(src)][str(tgt)] = {
                    'distance_m': 999999,
                    'path_nodes': [],
                    'svg_path': []
                }

    print(f"       Computed {path_count} shortest paths ({failed_pairs} unreachable pairs)")

    # 7. Save JSON files
    print(f"\n[6/6] Saving JSON files to {OUTPUT_DIR}/...")

    roads_path = os.path.join(OUTPUT_DIR, 'okhla_roads.json')
    stops_path = os.path.join(OUTPUT_DIR, 'okhla_stops.json')
    paths_path = os.path.join(OUTPUT_DIR, 'okhla_paths.json')

    with open(roads_path, 'w') as f:
        json.dump({
            'region_name': 'Okhla Phase I/II — Nehru Place — Kalkaji — Jasola, South-East Delhi',
            'city_name': 'New Delhi, India',
            'bbox': {'north': NORTH, 'south': SOUTH, 'east': EAST, 'west': WEST},
            'svg_width': SVG_WIDTH,
            'svg_height': SVG_HEIGHT,
            'num_nodes': G.number_of_nodes(),
            'num_edges': G.number_of_edges(),
            'roads': roads
        }, f, indent=2)

    with open(stops_path, 'w') as f:
        json.dump(stops_data, f, indent=2)

    with open(paths_path, 'w') as f:
        json.dump(paths_data, f)  # No indent — this file can be large

    roads_size = os.path.getsize(roads_path) / 1024
    stops_size = os.path.getsize(stops_path) / 1024
    paths_size = os.path.getsize(paths_path) / 1024

    print(f"\n{'=' * 70}")
    print(f"  BUILD COMPLETE!")
    print(f"  okhla_roads.json  — {roads_size:.1f} KB ({len(roads)} road segments)")
    print(f"  okhla_stops.json  — {stops_size:.1f} KB (depot + {len(stops)} stops)")
    print(f"  okhla_paths.json  — {paths_size:.1f} KB ({path_count} shortest paths)")
    print(f"{'=' * 70}")


if __name__ == '__main__':
    main()
