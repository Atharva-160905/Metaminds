import React, { useMemo, useState } from 'react';
import { SyntheticCityData, RiderRoute } from '../types';
import { getRiderColor } from '../utils/colors';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Plus,
  Minus,
  Maximize2,
  AlertTriangle,
  Flame,
  ShieldAlert
} from 'lucide-react';

interface CityRouteMapProps {
  city: SyntheticCityData | null;
  riderRoutes?: RiderRoute[];
  numRiders?: number;
  title: string;
  theme: 'qpso' | 'pso';
  animProgress: number; // 0.0 to 1.0
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetAnim: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const CityRouteMap: React.FC<CityRouteMapProps> = ({
  city,
  riderRoutes = [],
  numRiders,
  title,
  theme,
  animProgress,
  isPlaying,
  onTogglePlay,
  onResetAnim,
  playbackSpeed,
  onChangeSpeed,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [hoveredVehicle, setHoveredVehicle] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);

  // Map vehicle index to deliveries for color-coded pin matching
  const deliveryVehicleMap = useMemo(() => {
    const map = new Map<number, number>();
    riderRoutes.forEach((route, rIdx) => {
      (route.deliveries || []).forEach((d) => {
        map.set(d.delivery_id, rIdx);
      });
    });
    return map;
  }, [riderRoutes]);

  // Calculate live vehicle positions, completed paths, and ETA tooltips
  const vehicleLiveStates = useMemo(() => {
    if (!city) return [];

    const depotX = city.depot?.x || 600;
    const depotY = city.depot?.y || 450;

    if (!riderRoutes || riderRoutes.length === 0) {
      const fleetCount = numRiders || 5;
      return Array.from({ length: fleetCount }).map((_, rIdx) => {
        const angle = (2 * Math.PI * rIdx) / fleetCount;
        const radius = fleetCount > 5 ? 32 : 24;
        return {
          rider_id: rIdx + 1,
          pos: { x: depotX + Math.cos(angle) * radius, y: depotY + Math.sin(angle) * radius },
          completedPath: '',
          remainingPath: '',
          completedDeliveries: [],
          currentStopLabel: 'Stationed at Hub (Ready)',
          etaMin: 0,
          progressPct: 0
        };
      });
    }

    return riderRoutes.map((route, rIdx) => {
      const coords = route.waypoint_coords || [];
      if (coords.length < 2) {
        return {
          rider_id: route.rider_id,
          pos: city.depot,
          completedPath: '',
          remainingPath: '',
          completedDeliveries: [],
          currentStopLabel: 'Depot',
          etaMin: 0,
          progressPct: 0
        };
      }

      const totalSegments = coords.length - 1;
      const effectiveT = Math.min(0.9999, Math.max(0, animProgress)) * totalSegments;
      const segIndex = Math.floor(effectiveT);
      const segRatio = effectiveT - segIndex;

      const p1 = coords[segIndex];
      const p2 = coords[segIndex + 1] || p1;

      const currX = p1.x + (p2.x - p1.x) * segRatio;
      const currY = p1.y + (p2.y - p1.y) * segRatio;

      let completedPoints = coords.slice(0, segIndex + 1).map(pt => `${pt.x},${pt.y}`).join(' ');
      completedPoints += ` ${currX},${currY}`;

      let remainingPoints = `${currX},${currY}`;
      if (segIndex + 1 < coords.length) {
        remainingPoints += ' ' + coords.slice(segIndex + 1).map(pt => `${pt.x},${pt.y}`).join(' ');
      }

      // Completed deliveries
      const completedDlvIds = new Set<number>();
      const visitedNodes = new Set(coords.slice(0, segIndex + 1).map(pt => pt.id));

      let nextTargetStop = 'Depot Return';
      let nextEta = 1;

      (route.deliveries || []).forEach((d) => {
        if (visitedNodes.has(d.node_id)) {
          completedDlvIds.add(d.delivery_id);
        } else if (nextTargetStop === 'Depot Return') {
          nextTargetStop = d.label;
          nextEta = Math.max(1, Math.round(d.eta_min * (1 - animProgress) + 1));
        }
      });

      return {
        rider_id: route.rider_id,
        pos: { x: currX, y: currY },
        completedPath: completedPoints,
        remainingPath: remainingPoints,
        completedDeliveries: Array.from(completedDlvIds),
        currentStopLabel: nextTargetStop,
        etaMin: nextEta,
        progressPct: Math.round(animProgress * 100)
      };
    });
  }, [city, riderRoutes, animProgress]);

  if (!city) {
    return (
      <div className="w-full h-[520px] bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-medium">
        Loading synthetic street map network...
      </div>
    );
  }

  const allCompletedDeliveryIds = new Set(
    vehicleLiveStates.flatMap(v => v.completedDeliveries)
  );

  const totalDeliveries = city.deliveries.length;
  const completedCount = allCompletedDeliveryIds.size;
  const completionPercentage = totalDeliveries > 0 ? Math.round((completedCount / totalDeliveries) * 100) : 0;

  // River SVG Path string
  const riverPathString = city.river_path && city.river_path.length > 0
    ? `M ${city.river_path[0][0]} ${city.river_path[0][1]} ` +
      city.river_path.slice(1).map((pt, i) => {
        const prev = city.river_path![i];
        const cx = (prev[0] + pt[0]) / 2;
        const cy = (prev[1] + pt[1]) / 2;
        return `Q ${cx} ${cy} ${pt[0]} ${pt[1]}`;
      }).join(' ')
    : '';

  // Filter incident edges
  const incidentEdges = city.edges.filter(e => e.status === 'incident');

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-md flex flex-col transition-all duration-300">
      {/* 1. Header Toolbar */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${theme === 'qpso' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
          <span className="font-bold text-slate-800 text-xs font-heading tracking-wide uppercase">
            {title}
          </span>
          {incidentEdges.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-300 animate-pulse">
              <AlertTriangle size={11} />
              {incidentEdges.length} Incidents Active
            </span>
          )}
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-xs">
          <button
            onClick={onTogglePlay}
            className="p-1 hover:bg-slate-100 text-slate-700 rounded transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={13} className="text-amber-600" /> : <Play size={13} className="text-emerald-600 fill-emerald-600" />}
          </button>
          <button
            onClick={onResetAnim}
            className="p-1 hover:bg-slate-100 text-slate-500 rounded transition-colors"
            title="Reset Vehicle Positions"
          >
            <RotateCcw size={13} />
          </button>
          <div className="h-3 w-px bg-slate-200 mx-1" />
          <button
            onClick={() => {
              const speeds = [0.5, 1, 2, 4];
              const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
              onChangeSpeed(speeds[nextIdx]);
            }}
            className="flex items-center gap-0.5 text-[11px] text-slate-600 font-mono hover:text-slate-900 px-1 font-semibold"
          >
            <FastForward size={11} />
            <span>{playbackSpeed}x</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive SVG Map Canvas */}
      <div className="relative w-full h-[470px] bg-[#EEF2F6] select-none overflow-hidden">
        <svg
          viewBox={`0 0 ${city.width} ${city.height}`}
          className="w-full h-full transition-transform duration-200"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center'
          }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Soft grid pattern for urban blocks */}
            <pattern id="urban-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#E2E8F0" strokeWidth="0.75" />
            </pattern>
            {/* Route Glow Filter */}
            <filter id="route-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Traffic Incident Warning Glow */}
            <filter id="incident-aura-filter" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Base Map Background */}
          <rect width={city.width} height={city.height} fill="#EEF2F6" />
          <rect width={city.width} height={city.height} fill="url(#urban-grid)" />

          {/* 1. Green Parks & Natural Zones */}
          {city.parks?.map((park, idx) => {
            const pointsStr = park.points.map(p => `${p[0]},${p[1]}`).join(' ');
            return (
              <g key={`park-${idx}`}>
                <polygon
                  points={pointsStr}
                  fill="#DCFCE7"
                  stroke="#BBF7D0"
                  strokeWidth="1.5"
                  className="transition-colors hover:fill-emerald-200"
                />
              </g>
            );
          })}

          {/* 2. Curved Blue Riverway */}
          {riverPathString && (
            <path
              d={riverPathString}
              fill="none"
              stroke="#BAE6FD"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          )}

          {/* 3. District Watermark Labels */}
          {city.districts?.map((d, idx) => (
            <text
              key={`dist-${idx}`}
              x={d.x}
              y={d.y}
              textAnchor="middle"
              fill="#64748B"
              fontSize="13"
              fontWeight="600"
              fontFamily="Inter, sans-serif"
              letterSpacing="0.05em"
              opacity="0.6"
            >
              {d.name}
            </text>
          ))}

          {/* 4. Road Network (Real OSM Roads or Synthetic Topology) */}
          {city.roads && city.roads.length > 0 ? (
            <g className="real-osm-roads-layer">
              {/* Residential roads - faint */}
              {city.roads.filter(r => r.road_type === 'residential').map((r, idx) => (
                <polyline
                  key={`osm-res-${idx}`}
                  points={r.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="0.85"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.35}
                />
              ))}
              {/* Tertiary roads - normal */}
              {city.roads.filter(r => r.road_type === 'tertiary').map((r, idx) => (
                <polyline
                  key={`osm-tert-${idx}`}
                  points={r.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                  fill="none"
                  stroke="#64748B"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.65}
                />
              ))}
              {/* Secondary roads - medium */}
              {city.roads.filter(r => r.road_type === 'secondary').map((r, idx) => (
                <polyline
                  key={`osm-sec-${idx}`}
                  points={r.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              ))}
              {/* Primary / Trunk roads - thicker */}
              {city.roads.filter(r => r.road_type === 'primary').map((r, idx) => (
                <g key={`osm-prim-${idx}`}>
                  <polyline
                    points={r.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                    fill="none"
                    stroke="#CBD5E1"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={r.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}
            </g>
          ) : (
            <>
              {/* Secondary Road Network (White/Gray Road Underlay) */}
              {city.edges.map((edge, idx) => {
                const isIncident = edge.status === 'incident';
                return (
                  <line
                    key={`base-edge-${idx}`}
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke={isIncident ? '#FEE2E2' : '#FFFFFF'}
                    strokeWidth={isIncident ? 7 : 4.5}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Road Infill Lines */}
              {city.edges.map((edge, idx) => {
                const isIncident = edge.status === 'incident';
                const isCongested = edge.status === 'congested';

                let stroke = '#CBD5E1';
                let width = 2;

                if (isIncident) {
                  stroke = '#EF4444';
                  width = 4.5;
                } else if (isCongested) {
                  stroke = '#FB923C';
                  width = 3;
                }

                return (
                  <line
                    key={`edge-line-${idx}`}
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke={stroke}
                    strokeWidth={width}
                    strokeLinecap="round"
                  />
                );
              })}
            </>
          )}

          {/* 5. Traffic Incident Highlight Zone & Warning Badge (Matching User Request) */}
          {incidentEdges.map((edge, idx) => {
            const midX = (edge.x1 + edge.x2) / 2;
            const midY = (edge.y1 + edge.y2) / 2;

            return (
              <g key={`incident-marker-${idx}`} className="cursor-pointer">
                {/* Translucent Red Incident Warning Zone Rectangle */}
                <rect
                  x={Math.min(edge.x1, edge.x2) - 16}
                  y={Math.min(edge.y1, edge.y2) - 16}
                  width={Math.abs(edge.x2 - edge.x1) + 32}
                  height={Math.abs(edge.y2 - edge.y1) + 32}
                  rx="10"
                  fill="#FEE2E2"
                  fillOpacity="0.55"
                  stroke="#EF4444"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  className="animate-pulse"
                />

                {/* Pulsing Red Radar Ring at Midpoint */}
                <circle
                  cx={midX}
                  cy={midY}
                  r="18"
                  fill="#EF4444"
                  fillOpacity="0.2"
                  className="animate-ping"
                />

                {/* Traffic Incident Shield Badge */}
                <circle
                  cx={midX}
                  cy={midY}
                  r="12"
                  fill="#EF4444"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  className="filter drop-shadow-md"
                />
                <text
                  x={midX}
                  y={midY + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#FFFFFF"
                  fontWeight="bold"
                >
                  ⚠️
                </text>

                {/* Floating Traffic Delay Bubble */}
                <g transform={`translate(${midX - 45}, ${midY - 34})`}>
                  <rect
                    x="0"
                    y="0"
                    width="90"
                    height="20"
                    rx="5"
                    fill="#991B1B"
                    className="filter drop-shadow-md"
                  />
                  <polygon
                    points="40,20 45,25 50,20"
                    fill="#991B1B"
                  />
                  <text
                    x="45"
                    y="13"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#FFFFFF"
                  >
                    {`JAM: ${edge.current_time}m (5x)`}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 6. Planned & Completed Vehicle Routes (Strict Sector Petals) */}
          {riderRoutes.map((route, rIdx) => {
            const color = getRiderColor(rIdx);
            const liveState = vehicleLiveStates[rIdx];
            const isHovered = hoveredVehicle === route.rider_id;
            const routeOpacity = hoveredVehicle !== null ? (isHovered ? 1.0 : 0.2) : 1.0;

            return (
              <g
                key={`route-group-${route.rider_id}`}
                className="transition-opacity duration-200"
                opacity={routeOpacity}
                onMouseEnter={() => setHoveredVehicle(route.rider_id)}
                onMouseLeave={() => setHoveredVehicle(null)}
              >
                {/* Remaining Route (Lighter, dashed) */}
                {liveState?.remainingPath && (
                  <polyline
                    points={liveState.remainingPath}
                    fill="none"
                    stroke={color.stroke}
                    strokeWidth={isHovered ? 4 : 2.5}
                    strokeDasharray="5 4"
                    strokeOpacity={isHovered ? 0.8 : 0.4}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}

                {/* Completed Route (Vibrant Solid with glow) */}
                {liveState?.completedPath && (
                  <polyline
                    points={liveState.completedPath}
                    fill="none"
                    stroke={color.stroke}
                    strokeWidth={isHovered ? 5 : 3.5}
                    strokeOpacity={0.95}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    filter="url(#route-glow-filter)"
                  />
                )}
              </g>
            );
          })}

          {/* 7. Delivery Pin Drop Markers */}
          {city.deliveries.map((dlv) => {
            const isDone = allCompletedDeliveryIds.has(dlv.id);
            const assignedVehicleIdx = deliveryVehicleMap.get(dlv.id) ?? 0;
            const pinColor = getRiderColor(assignedVehicleIdx);

            return (
              <g
                key={`pin-${dlv.id}`}
                className="cursor-pointer transition-transform duration-200 hover:scale-125"
                onMouseEnter={() => setHoveredNode(dlv)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Pin Shadow */}
                <ellipse
                  cx={dlv.pos[0]}
                  cy={dlv.pos[1] + 2}
                  rx="4"
                  ry="2"
                  fill="#000000"
                  opacity="0.25"
                />

                {/* Map Pin Path */}
                <path
                  d={`M ${dlv.pos[0]} ${dlv.pos[1]} 
                      C ${dlv.pos[0] - 5} ${dlv.pos[1] - 8} ${dlv.pos[0] - 6} ${dlv.pos[1] - 14} ${dlv.pos[0]} ${dlv.pos[1] - 14} 
                      C ${dlv.pos[0] + 6} ${dlv.pos[1] - 14} ${dlv.pos[0] + 5} ${dlv.pos[1] - 8} ${dlv.pos[0]} ${dlv.pos[1]} Z`}
                  fill={isDone ? '#10B981' : pinColor.stroke}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />

                {/* Pin Inner Center Circle */}
                <circle
                  cx={dlv.pos[0]}
                  cy={dlv.pos[1] - 8.5}
                  r="2.5"
                  fill="#FFFFFF"
                />
              </g>
            );
          })}

          {/* 8. Central Depot / Warehouse Badge (🏠) */}
          <g className="cursor-pointer">
            <circle
              cx={city.depot.x}
              cy={city.depot.y}
              r="18"
              fill="#0F172A"
              stroke="#FFFFFF"
              strokeWidth="3"
              className="filter drop-shadow-md"
            />
            <text
              x={city.depot.x}
              y={city.depot.y + 6}
              textAnchor="middle"
              fontSize="16"
              fill="#FFFFFF"
            >
              🏠
            </text>
          </g>

          {/* 9. Live Moving Vehicle Icons & Floating Tooltips */}
          {vehicleLiveStates.map((vState, rIdx) => {
            const color = getRiderColor(rIdx);
            const isHovered = hoveredVehicle === vState.rider_id;

            return (
              <g key={`live-veh-${vState.rider_id}`}>
                <circle
                  cx={vState.pos.x}
                  cy={vState.pos.y}
                  r="9"
                  fill={color.stroke}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  className="filter drop-shadow-lg"
                />
                <circle
                  cx={vState.pos.x}
                  cy={vState.pos.y}
                  r="3.5"
                  fill="#FFFFFF"
                />

                {/* Floating Tooltip over Active Moving Vehicle */}
                {(rIdx === 0 || isHovered) && (
                  <g
                    transform={`translate(${vState.pos.x + 8}, ${vState.pos.y - 48})`}
                    className="pointer-events-none transition-all duration-100"
                  >
                    <rect
                      x="0"
                      y="0"
                      width="108"
                      height="40"
                      rx="6"
                      fill="#FFFFFF"
                      stroke="#E2E8F0"
                      strokeWidth="1"
                      className="filter drop-shadow-md"
                    />
                    <polygon
                      points="0,30 -6,36 4,36"
                      fill="#FFFFFF"
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text x="8" y="13" fontSize="10" fontWeight="bold" fill="#0F172A">
                      {`Vehicle ${vState.rider_id}`}
                    </text>
                    <text x="8" y="24" fontSize="8.5" fill="#64748B">
                      {`En route to ${vState.currentStopLabel}`}
                    </text>
                    <text x="8" y="34" fontSize="8.5" fontWeight="600" fill="#059669">
                      {`ETA: ${vState.etaMin} min`}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* 3. Floating Top-Left Legend */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-xl p-3 shadow-md z-10 text-xs">
          <div className="space-y-1.5 font-medium text-slate-700">
            {riderRoutes.map((route, rIdx) => {
              const color = getRiderColor(rIdx);
              const isHovered = hoveredVehicle === route.rider_id;

              return (
                <div
                  key={`leg-${route.rider_id}`}
                  onMouseEnter={() => setHoveredVehicle(route.rider_id)}
                  onMouseLeave={() => setHoveredVehicle(null)}
                  className={`flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded transition-colors ${
                    isHovered ? 'bg-slate-100 font-bold' : ''
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.stroke }} />
                  <span className="text-slate-800 text-[11px] font-semibold">{`Vehicle ${route.rider_id}`}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Bottom-Right Zoom Controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-white border border-slate-200 rounded-xl shadow-md p-1 z-10">
          <button
            onClick={() => setZoomLevel(prev => Math.min(2.0, prev + 0.2))}
            className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition-colors"
            title="Zoom In"
          >
            <Plus size={14} />
          </button>
          <div className="h-px bg-slate-200" />
          <button
            onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.2))}
            className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition-colors"
            title="Zoom Out"
          >
            <Minus size={14} />
          </button>
          <div className="h-px bg-slate-200" />
          <button
            onClick={() => setZoomLevel(1.0)}
            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded transition-colors"
            title="Reset Zoom"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* 5. Bottom Delivery Progress Bar */}
      <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-900">
            {`Delivery Progress (${theme.toUpperCase()})`}
          </span>
          <span className="font-mono font-bold text-slate-700">
            {`${completedCount} / ${totalDeliveries} delivered (${completionPercentage}%)`}
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              theme === 'qpso'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-blue-500 to-cyan-400'
            }`}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
