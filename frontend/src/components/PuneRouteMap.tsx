import React, { useMemo, useState } from 'react';
import { SyntheticCityData, RiderRoute, PuneLandmark } from '../types';
import { getRiderColor } from '../utils/colors';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Maximize2,
  Building2,
  MapPin,
  Flame,
  AlertTriangle,
  Layers,
  Sparkles,
  Navigation
} from 'lucide-react';

interface PuneRouteMapProps {
  city: SyntheticCityData | null;
  riderRoutes?: RiderRoute[];
  title: string;
  theme: 'qpso' | 'pso';
  animProgress: number; // 0.0 to 1.0
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetAnim: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const PuneRouteMap: React.FC<PuneRouteMapProps> = ({
  city,
  riderRoutes = [],
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
  const [hoveredLandmark, setHoveredLandmark] = useState<any>(null);

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

  // Calculate live vehicle positions along real Pune road geometry
  const vehicleLiveStates = useMemo(() => {
    if (!city || !riderRoutes || riderRoutes.length === 0) return [];

    return riderRoutes.map((route, rIdx) => {
      const coords = route.waypoint_coords || [];
      if (coords.length < 2) {
        return {
          rider_id: route.rider_id,
          pos: city.depot,
          completedPath: '',
          remainingPath: '',
          completedDeliveries: [],
          currentStopLabel: 'Sinhgad Central Hub',
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

  // Build River SVG path string
  const riverPathD = useMemo(() => {
    if (!city || !city.river_path || city.river_path.length < 2) return '';
    const pts = city.river_path;
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const midX = (prev[0] + curr[0]) / 2;
      const midY = (prev[1] + curr[1]) / 2;
      d += ` Q ${prev[0]} ${prev[1]}, ${midX} ${midY} T ${curr[0]} ${curr[1]}`;
    }
    return d;
  }, [city?.river_path]);

  if (!city) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950 text-slate-500 rounded-xl border border-slate-800">
        <p className="text-sm">Loading Pune GIS Network...</p>
      </div>
    );
  }

  const isQPSO = theme === 'qpso';
  const themeColor = isQPSO ? '#10B981' : '#6366F1';
  const glowColor = isQPSO ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)';

  return (
    <div className="flex flex-col h-full bg-[#070D1E] rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0B1428] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shadow-md"
            style={{ backgroundColor: themeColor, boxShadow: `0 0 10px ${glowColor}` }}
          />
          <h3 className="font-heading font-bold text-sm text-slate-100 tracking-wide flex items-center gap-2">
            <span>{title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
              Sinhgad / Ambegaon Live Grid
            </span>
          </h3>
        </div>

        {/* Map Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-950/80 rounded-lg p-0.5 border border-slate-800">
          <button
            onClick={() => setZoomLevel(prev => Math.max(0.75, prev - 0.15))}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
            title="Zoom Out"
          >
            <Minus size={13} />
          </button>
          <span className="text-[10px] font-mono text-slate-400 px-1">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel(prev => Math.min(1.8, prev + 0.15))}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
            title="Zoom In"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={() => setZoomLevel(1.0)}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors ml-0.5"
            title="Reset View"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Main SVG Map Area */}
      <div className="relative flex-1 bg-[#050B17] overflow-hidden">
        <svg
          viewBox={`0 0 ${city.width} ${city.height}`}
          className="w-full h-full cursor-crosshair transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
        >
          <defs>
            {/* GIS Clean Grid Pattern */}
            <pattern id="puneGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0D1930" strokeWidth="0.6" />
            </pattern>

            {/* River Gradient */}
            <linearGradient id="puneRiverGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#0369a1" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#082f49" stopOpacity="0.35" />
            </linearGradient>

            {/* Incident Alert Filter */}
            <filter id="puneIncidentGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.0" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Route Glow Filter */}
            <filter id="puneRouteGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Grid */}
          <rect width={city.width} height={city.height} fill="#050B17" />
          <rect width={city.width} height={city.height} fill="url(#puneGrid)" />

          {/* 1. Regional Shaded Zones (Visual Geography) */}
          {/* Sinhgad Campus Green Quad */}
          <rect
            x="200"
            y="390"
            width="600"
            height="230"
            rx="24"
            fill="#064E3B"
            fillOpacity="0.12"
            stroke="#10B981"
            strokeWidth="1.2"
            strokeDasharray="6, 6"
            strokeOpacity="0.35"
          />
          <text x="500" y="415" fill="#10B981" fontSize="11" fontFamily="sans-serif" fontWeight="800" textAnchor="middle" opacity="0.4" letterSpacing="3">
            SINHGAD INSTITUTES CAMPUS QUAD
          </text>

          {/* Ambegaon Residential Sector */}
          <rect
            x="200"
            y="650"
            width="750"
            height="180"
            rx="20"
            fill="#1E1B4B"
            fillOpacity="0.12"
            stroke="#6366F1"
            strokeWidth="1.0"
            strokeDasharray="4, 4"
            strokeOpacity="0.25"
          />
          <text x="575" y="675" fill="#818CF8" fontSize="10" fontFamily="sans-serif" fontWeight="700" textAnchor="middle" opacity="0.4" letterSpacing="2.5">
            AMBEGAON BK RESIDENTIAL SECTOR
          </text>

          {/* 2. Natural Waterway: Mutha River Corridor */}
          {riverPathD && (
            <g className="pune-river-layer" opacity={0.9}>
              <path
                d={riverPathD}
                fill="none"
                stroke="url(#puneRiverGrad)"
                strokeWidth="32"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={riverPathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="14, 8"
                opacity={0.6}
              />
              <text x="600" y="105" fill="#38bdf8" fontSize="11" fontFamily="sans-serif" fontWeight="800" textAnchor="middle" opacity="0.7" letterSpacing="3">
                ~ MUTHA RIVER & CANAL CORRIDOR ~
              </text>
            </g>
          )}

          {/* 3. Base Road Network */}
          <g className="pune-roads-layer">
            {city.edges.map((edge, idx) => {
              const isIncident = edge.status === 'incident';
              const isHighway = edge.road_name?.includes('NH 48') || edge.road_name?.includes('Expressway') || edge.speed_limit >= 65;
              const isSinhgadRd = edge.road_name?.includes('Sinhgad Road');
              const isCampus = edge.road_name?.includes('Campus') || edge.road_name?.includes('SCOE') || edge.road_name?.includes('SKN') || edge.road_name?.includes('Law');

              let strokeColor = '#172A46';
              let strokeW = 3.5;

              if (isHighway) {
                strokeColor = '#d97706';
                strokeW = 6.0;
              } else if (isSinhgadRd) {
                strokeColor = '#0891b2';
                strokeW = 5.0;
              } else if (isCampus) {
                strokeColor = '#059669';
                strokeW = 4.0;
              }

              if (isIncident) {
                strokeColor = '#ef4444';
                strokeW = 7.0;
              }

              return (
                <g key={`edge-${edge.u}-${edge.v}-${idx}`}>
                  {/* Road Base */}
                  <line
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    opacity={isIncident ? 0.95 : 0.8}
                    filter={isIncident ? 'url(#puneIncidentGlow)' : undefined}
                  />

                  {/* Highway Center Dashed Stripe */}
                  {isHighway && !isIncident && (
                    <line
                      x1={edge.x1}
                      y1={edge.y1}
                      x2={edge.x2}
                      y2={edge.y2}
                      stroke="#fef08a"
                      strokeWidth="1.2"
                      strokeDasharray="8, 6"
                      opacity={0.85}
                    />
                  )}

                  {/* Sinhgad Road White Center Line */}
                  {isSinhgadRd && !isIncident && (
                    <line
                      x1={edge.x1}
                      y1={edge.y1}
                      x2={edge.x2}
                      y2={edge.y2}
                      stroke="#cffafe"
                      strokeWidth="1.0"
                      strokeDasharray="6, 5"
                      opacity={0.7}
                    />
                  )}

                  {/* Road Incident Animation */}
                  {isIncident && (
                    <g>
                      <line
                        x1={edge.x1}
                        y1={edge.y1}
                        x2={edge.x2}
                        y2={edge.y2}
                        stroke="#fef08a"
                        strokeWidth="2.5"
                        strokeDasharray="6, 6"
                        className="animate-pulse"
                      />
                      <circle
                        cx={(edge.x1 + edge.x2) / 2}
                        cy={(edge.y1 + edge.y2) / 2}
                        r="12"
                        fill="#ef4444"
                        fillOpacity="0.85"
                        className="animate-ping"
                      />
                      <circle
                        cx={(edge.x1 + edge.x2) / 2}
                        cy={(edge.y1 + edge.y2) / 2}
                        r="9"
                        fill="#991b1b"
                        stroke="#fee2e2"
                        strokeWidth="1.5"
                      />
                      <text
                        x={(edge.x1 + edge.x2) / 2}
                        y={(edge.y1 + edge.y2) / 2 + 3}
                        fill="#fff"
                        fontSize="8"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        ⚠️
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* 4. Arterial Labels directly in Road Corridors */}
          <g className="pune-corridor-titles" opacity={0.65}>
            <text x="600" y="195" fill="#22d3ee" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle" letterSpacing="2">
              ◄ SINHGAD ROAD (MAIN ARTERIAL) ►
            </text>
            <text
              x="1055"
              y="580"
              fill="#fbbf24"
              fontSize="10"
              fontFamily="sans-serif"
              fontWeight="bold"
              textAnchor="middle"
              letterSpacing="2"
              transform="rotate(90, 1055, 580)"
            >
              ◄ NH 48 MUMBAI-BENGALURU EXPRESSWAY ►
            </text>
          </g>

          {/* 5. Optimized Routes with Distinct Vehicle Colors */}
          <g className="pune-routes-layer">
            {riderRoutes.map((route, rIdx) => {
              const live = vehicleLiveStates[rIdx];
              const color = getRiderColor(rIdx);
              if (!live || !route.waypoint_coords || route.waypoint_coords.length < 2) return null;
              const isHovered = hoveredVehicle === route.rider_id;

              return (
                <g
                  key={`route-${route.rider_id}`}
                  onMouseEnter={() => setHoveredVehicle(route.rider_id)}
                  onMouseLeave={() => setHoveredVehicle(null)}
                >
                  {/* Remaining Route (Dashed Preview) */}
                  {live.remainingPath && (
                    <polyline
                      points={live.remainingPath}
                      fill="none"
                      stroke={color.stroke}
                      strokeWidth={isHovered ? 3.5 : 2.5}
                      strokeDasharray="6, 5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity={isHovered ? 0.8 : 0.45}
                    />
                  )}

                  {/* Completed Route (Solid Vibrant with Glow) */}
                  {live.completedPath && (
                    <polyline
                      points={live.completedPath}
                      fill="none"
                      stroke={color.stroke}
                      strokeWidth={isHovered ? 5.5 : 4.0}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity={0.95}
                      filter="url(#puneRouteGlow)"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* 6. Clean Non-Overlapping Landmark Badges */}
          <g className="pune-landmarks-layer">
            {(city.landmarks || []).map((lm: any) => {
              let badgeBg = '#0F172A';
              let badgeBorder = '#059669';
              let badgeText = '#6EE7B7';
              let emoji = '📍';

              if (lm.type === 'college') {
                badgeBorder = '#10B981';
                badgeText = '#A7F3D0';
                emoji = '🎓';
              } else if (lm.type === 'hospital') {
                badgeBorder = '#E11D48';
                badgeText = '#FDA4AF';
                emoji = '🏥';
              } else if (lm.type === 'bridge') {
                badgeBorder = '#F59E0B';
                badgeText = '#FDE68A';
                emoji = '🌉';
              } else if (lm.type === 'commercial') {
                badgeBorder = '#6366F1';
                badgeText = '#C7D2FE';
                emoji = '🛒';
              } else if (lm.type === 'junction') {
                badgeBorder = '#06B6D4';
                badgeText = '#A5F3FC';
                emoji = '🚦';
              }

              const labelStr = lm.short || lm.name;
              const boxW = Math.max(70, labelStr.length * 6.5 + 24);

              return (
                <g
                  key={`landmark-${lm.id}`}
                  className="cursor-pointer transition-transform hover:scale-110"
                  onMouseEnter={() => setHoveredLandmark(lm)}
                  onMouseLeave={() => setHoveredLandmark(null)}
                >
                  {/* Node Dot */}
                  <circle
                    cx={lm.pos[0]}
                    cy={lm.pos[1]}
                    r="5"
                    fill={badgeBorder}
                    stroke="#000"
                    strokeWidth="1.5"
                  />
                  {/* Neat Floating Pill Badge Above Node */}
                  <rect
                    x={lm.pos[0] - boxW / 2}
                    y={lm.pos[1] - 22}
                    width={boxW}
                    height="16"
                    rx="8"
                    fill={badgeBg}
                    fillOpacity="0.9"
                    stroke={badgeBorder}
                    strokeWidth="1.2"
                  />
                  <text
                    x={lm.pos[0]}
                    y={lm.pos[1] - 10}
                    fill={badgeText}
                    fontSize="8.5"
                    fontFamily="sans-serif"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {emoji} {labelStr}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 7. Central Logistics Hub (Depot) */}
          <g className="pune-depot-layer">
            <circle
              cx={city.depot.x}
              cy={city.depot.y}
              r="16"
              fill="#10B981"
              fillOpacity="0.25"
              stroke="#10B981"
              strokeWidth="2"
              className="animate-pulse"
            />
            <circle
              cx={city.depot.x}
              cy={city.depot.y}
              r="9"
              fill="#064E3B"
              stroke="#34D399"
              strokeWidth="2"
            />
            {/* Depot Badge Below */}
            <rect
              x={city.depot.x - 70}
              y={city.depot.y + 14}
              width="140"
              height="18"
              rx="9"
              fill="#064E3B"
              stroke="#34D399"
              strokeWidth="1.5"
            />
            <text
              x={city.depot.x}
              y={city.depot.y + 26}
              fill="#A7F3D0"
              fontSize="9"
              fontFamily="sans-serif"
              textAnchor="middle"
              fontWeight="bold"
            >
              🏢 SINHGAD CENTRAL HUB
            </text>
          </g>

          {/* 8. Delivery Package Pins Colored by Assigned Vehicle */}
          <g className="pune-deliveries-layer">
            {city.deliveries.map((deliv) => {
              const assignedRiderIdx = deliveryVehicleMap.get(deliv.id);
              const pinColor = assignedRiderIdx !== undefined ? getRiderColor(assignedRiderIdx) : null;
              const isCompleted = vehicleLiveStates[assignedRiderIdx || 0]?.completedDeliveries.includes(deliv.id);

              return (
                <g
                  key={`deliv-${deliv.id}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredNode(deliv)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <circle
                    cx={deliv.pos[0]}
                    cy={deliv.pos[1]}
                    r={isCompleted ? 4.5 : 6.5}
                    fill={isCompleted ? '#10B981' : (pinColor ? pinColor.fill : '#94A3B8')}
                    stroke={pinColor ? pinColor.stroke : '#0B132B'}
                    strokeWidth="2"
                    opacity={isCompleted ? 0.6 : 0.95}
                  />
                  {!isCompleted && (
                    <text
                      x={deliv.pos[0]}
                      y={deliv.pos[1] - 8}
                      fill="#FFFFFF"
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                      stroke="#000"
                      strokeWidth="0.4"
                    >
                      {deliv.id}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* 9. Live Fleet Vehicles Colored by Vehicle Index */}
          <g className="pune-vehicles-layer">
            {vehicleLiveStates.map((v, vIdx) => {
              const vColor = getRiderColor(vIdx);
              return (
                <g
                  key={`vehicle-${v.rider_id}`}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredVehicle(v.rider_id)}
                  onMouseLeave={() => setHoveredVehicle(null)}
                >
                  {/* Glowing Vehicle Aura */}
                  <circle
                    cx={v.pos.x}
                    cy={v.pos.y}
                    r="14"
                    fill={vColor.fill}
                    fillOpacity="0.35"
                    className="animate-ping"
                  />
                  {/* Vehicle Body Pin */}
                  <circle
                    cx={v.pos.x}
                    cy={v.pos.y}
                    r="8.5"
                    fill="#0F172A"
                    stroke={vColor.stroke}
                    strokeWidth="2.8"
                  />
                  <circle
                    cx={v.pos.x}
                    cy={v.pos.y}
                    r="4.0"
                    fill={vColor.fill}
                  />
                  <rect
                    x={v.pos.x - 16}
                    y={v.pos.y - 18}
                    width="32"
                    height="12"
                    rx="3"
                    fill="#0F172A"
                    stroke={vColor.stroke}
                    strokeWidth="1.2"
                  />
                  <text
                    x={v.pos.x}
                    y={v.pos.y - 9}
                    fill="#FFFFFF"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    V{v.rider_id}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Dynamic Tooltip: Hovered Node / Delivery */}
        {hoveredNode && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-900/95 border border-slate-700 text-white text-xs p-2.5 rounded-lg shadow-xl backdrop-blur-md"
            style={{
              left: `${(hoveredNode.pos[0] / city.width) * 100}%`,
              top: `${(hoveredNode.pos[1] / city.height) * 100}%`,
              transform: 'translate(-50%, -125%)',
            }}
          >
            <p className="font-bold text-cyan-300 flex items-center gap-1.5">
              <MapPin size={13} />
              {hoveredNode.label || `Stop #${hoveredNode.id}`}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Locality: <span className="font-semibold text-white">{hoveredNode.locality || 'Vadgaon/Ambegaon'}</span>
            </p>
          </div>
        )}

        {/* Dynamic Tooltip: Hovered Landmark */}
        {hoveredLandmark && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-900/95 border border-emerald-500/50 text-white text-xs p-2.5 rounded-lg shadow-2xl backdrop-blur-md"
            style={{
              left: `${(hoveredLandmark.pos[0] / city.width) * 100}%`,
              top: `${(hoveredLandmark.pos[1] / city.height) * 100}%`,
              transform: 'translate(-50%, -125%)',
            }}
          >
            <p className="font-bold text-emerald-300 flex items-center gap-1.5">
              <Building2 size={14} />
              {hoveredLandmark.name}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {hoveredLandmark.desc || 'Pune Landmark Corridor'}
            </p>
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] uppercase font-mono">
              {hoveredLandmark.type} zone
            </span>
          </div>
        )}
      </div>

      {/* Playback & Animation Controller Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0B1428] border-t border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-white shadow transition-all ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500'
                : isQPSO
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'Pause' : 'Play Simulation'}</span>
          </button>

          <button
            onClick={onResetAnim}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors"
            title="Reset Simulation"
          >
            <RotateCcw size={13} />
          </button>

          {/* Playback Speed Multipliers */}
          <div className="flex items-center gap-0.5 bg-slate-950 rounded-md p-0.5 border border-slate-800">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangeSpeed(spd)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                  playbackSpeed === spd
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Progress Slider */}
        <div className="flex items-center gap-3 flex-1 max-w-xs mx-4">
          <span className="text-[10px] font-mono text-slate-400">Progress</span>
          <div className="relative flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full transition-all duration-75"
              style={{
                width: `${Math.round(animProgress * 100)}%`,
                backgroundColor: themeColor
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-300 font-bold">
            {Math.round(animProgress * 100)}%
          </span>
        </div>

        {/* Route Stats Summary */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <div>
            Stops: <span className="text-white font-bold">{city.deliveries.length}</span>
          </div>
          <div>
            Vans: <span className="text-white font-bold">{riderRoutes.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
