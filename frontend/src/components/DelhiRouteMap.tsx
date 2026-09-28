import React, { useMemo, useState, useEffect } from 'react';
import { SyntheticCityData, RiderRoute, OkhlaRoadSegment } from '../types';
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
  Navigation,
  Truck,
  Compass
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

interface DelhiRouteMapProps {
  city: SyntheticCityData | null;
  riderRoutes?: RiderRoute[];
  numRiders?: number;
  title: string;
  theme: 'qpso' | 'pso';
  animProgress: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetAnim: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  hoveredVehicle?: number | null;
  onHoverVehicle?: (riderId: number | null) => void;
}

export const DelhiRouteMap: React.FC<DelhiRouteMapProps> = ({
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
  hoveredVehicle: externalHoveredVehicle,
  onHoverVehicle: externalOnHoverVehicle,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [internalHoveredVehicle, setInternalHoveredVehicle] = useState<number | null>(null);
  const hoveredVehicle = externalHoveredVehicle !== undefined ? externalHoveredVehicle : internalHoveredVehicle;
  const { theme: appTheme } = useTheme();
  const isDark = appTheme === 'dark';

  const setHoveredVehicle = (id: number | null) => {
    setInternalHoveredVehicle(id);
    if (externalOnHoverVehicle) {
      externalOnHoverVehicle(id);
    }
  };

  const [hoveredStop, setHoveredStop] = useState<any>(null);
  const [hoveredLandmark, setHoveredLandmark] = useState<any>(null);
  const [roads, setRoads] = useState<OkhlaRoadSegment[]>([]);
  const [isLoadingRoads, setIsLoadingRoads] = useState<boolean>(true);

  // Load real OpenStreetMap roads (cached client-side from static json or backend)
  useEffect(() => {
    let isMounted = true;
    const loadRoads = async () => {
      try {
        // Try static JSON first
        const res = await fetch('/data/okhla_roads.json');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.roads) {
            setRoads(data.roads);
            setIsLoadingRoads(false);
            return;
          }
        }
      } catch {
        // Ignore and fallback
      }

      try {
        const data = await api.getDelhiRoads();
        if (isMounted && data.roads) {
          setRoads(data.roads);
        }
      } catch (err) {
        console.error('Failed to load Delhi roads:', err);
      } finally {
        if (isMounted) setIsLoadingRoads(false);
      }
    };

    loadRoads();
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Calculate live vehicle positions along real curved road geometry
  const vehicleLiveStates = useMemo(() => {
    if (!city) return [];

    const depotX = city.depot?.x || 808.3;
    const depotY = city.depot?.y || 645.4;

    if (riderRoutes && riderRoutes.length > 0) {
      return riderRoutes.map((route, rIdx) => {
        const coords = route.waypoint_coords || [];
        if (coords.length < 2) {
          const angle = (2 * Math.PI * rIdx) / Math.max(1, riderRoutes.length);
          return {
            rider_id: route.rider_id,
            pos: { x: depotX + Math.cos(angle) * 32, y: depotY + Math.sin(angle) * 32 },
            completedPath: '',
            remainingPath: '',
            completedDeliveries: new Set<number>(),
            currentStopLabel: 'NSIC Central Hub (Staged)',
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

        // Track completed deliveries along the path
        const completedDlvIds = new Set<number>();
        const visitedThreshold = (segIndex / totalSegments);
        (route.deliveries || []).forEach((d, idx) => {
          if ((idx + 1) / (route.deliveries.length + 1) <= visitedThreshold) {
            completedDlvIds.add(d.delivery_id);
          }
        });

        // Target stop & ETA
        let currentStopLabel = 'Returning to Depot';
        let etaMin = Math.max(0, Math.round((1 - animProgress) * route.route_time_min));
        for (const d of route.deliveries || []) {
          if (!completedDlvIds.has(d.delivery_id)) {
            currentStopLabel = d.label || `Stop ${d.delivery_id}`;
            break;
          }
        }

        return {
          rider_id: route.rider_id,
          pos: { x: currX, y: currY },
          completedPath: completedPoints,
          remainingPath: remainingPoints,
          completedDeliveries: completedDlvIds,
          currentStopLabel,
          etaMin,
          progressPct: Math.round(animProgress * 100)
        };
      });
    }

    // When routes have not yet been computed: show all fleet vehicles staged around the hub!
    const fleetCount = numRiders || 4;
    return Array.from({ length: fleetCount }).map((_, rIdx) => {
      const angle = (2 * Math.PI * rIdx) / fleetCount;
      const radius = fleetCount > 5 ? 36 : 28;
      return {
        rider_id: rIdx + 1,
        pos: { x: depotX + Math.cos(angle) * radius, y: depotY + Math.sin(angle) * radius },
        completedPath: '',
        remainingPath: '',
        completedDeliveries: new Set<number>(),
        currentStopLabel: 'Stationed at Depot • Ready for Dispatch',
        etaMin: 0,
        progressPct: 0
      };
    });
  }, [city, riderRoutes, numRiders, animProgress]);

  // Group roads by hierarchy for optimal rendering layers
  const groupedRoads = useMemo(() => {
    const primary: OkhlaRoadSegment[] = [];
    const secondary: OkhlaRoadSegment[] = [];
    const tertiary: OkhlaRoadSegment[] = [];
    const residential: OkhlaRoadSegment[] = [];

    roads.forEach(r => {
      if (r.road_type === 'primary') primary.push(r);
      else if (r.road_type === 'secondary') secondary.push(r);
      else if (r.road_type === 'tertiary') tertiary.push(r);
      else residential.push(r);
    });

    return { primary, secondary, tertiary, residential };
  }, [roads]);

  return (
    <div className={`flex flex-col h-full rounded-2xl overflow-hidden border shadow-sm relative transition-colors ${
      isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
    }`}>
      {/* Header bar */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b backdrop-blur-md z-10 transition-colors ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50/95 border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            theme === 'qpso'
              ? 'bg-gradient-to-r from-emerald-400 to-teal-400 shadow-md shadow-emerald-500/50'
              : 'bg-gradient-to-r from-indigo-400 to-cyan-400 shadow-md shadow-indigo-500/50'
          }`} />
          <h3 className={`font-heading font-bold text-sm flex items-center gap-2 ${
            isDark ? 'text-slate-100' : 'text-slate-800'
          }`}>
            <span>{title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              OSM Drive Network • Okhla
            </span>
          </h3>
        </div>

        {/* Animation & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Speed control */}
          <div className={`flex items-center rounded-lg p-0.5 border text-xs ${
            isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-200/80 border-slate-300/60'
          }`}>
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangeSpeed(spd)}
                className={`px-2 py-0.5 rounded font-mono font-bold transition-all ${
                  playbackSpeed === spd
                    ? 'bg-amber-500 text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Play/Pause */}
          <button
            onClick={onTogglePlay}
            className={`p-1.5 rounded-lg border transition-all ${
              isPlaying
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300 shadow-sm'
                : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm'
            }`}
            title={isPlaying ? 'Pause Animation' : 'Play Animation'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Reset */}
          <button
            onClick={onResetAnim}
            className={`p-1.5 rounded-lg border transition-all ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
            }`}
            title="Reset to Depot"
          >
            <RotateCcw size={14} />
          </button>

          <div className={`h-4 w-px mx-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

          {/* Zoom controls */}
          <button
            onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.25))}
            className={`p-1.5 rounded-lg border transition-all ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
            }`}
            title="Zoom In"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.25))}
            className={`p-1.5 rounded-lg border transition-all ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
            }`}
            title="Zoom Out"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => setZoomLevel(1.0)}
            className={`p-1.5 rounded-lg border transition-all font-mono text-[10px] ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
            }`}
            title="Reset Zoom"
          >
            1x
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className={`flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${
        isDark ? 'bg-[#0B0F19]' : 'bg-[#F8FAFC]'
      }`}>
        {/* Loading overlay for roads */}
        {isLoadingRoads && (
          <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-sm z-20 ${
            isDark ? 'bg-slate-950/80' : 'bg-white/80'
          }`}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono text-amber-600 dark:text-amber-300">Loading 4,602 OSM Road Segments...</p>
            </div>
          </div>
        )}

        <svg
          viewBox="0 0 1200 900"
          className="w-full h-full object-contain select-none transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
        >
          <defs>
            {/* Background grid texture */}
            <pattern id="delhiGridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke={isDark ? "#1E293B" : "#E2E8F0"} strokeWidth="0.5" strokeOpacity={isDark ? 0.4 : 0.6} />
            </pattern>

            {/* Neon Glow Filters for Active Routes */}
            <filter id="delhiRouteGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="delhiHighlightGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6.0" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Yamuna river gradient */}
            <linearGradient id="yamunaRiverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isDark ? "#0284C7" : "#38BDF8"} stopOpacity="0.75" />
              <stop offset="50%" stopColor={isDark ? "#0369A1" : "#0284C7"} stopOpacity="0.85" />
              <stop offset="100%" stopColor={isDark ? "#075985" : "#0369A1"} stopOpacity="0.7" />
            </linearGradient>

            {/* Depot Pulse Gradient */}
            <radialGradient id="delhiDepotGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#D97706" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#92400E" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 1. Background Grid */}
          <rect width="1200" height="900" fill={isDark ? "#0B0F19" : "#F8FAFC"} />
          <rect width="1200" height="900" fill="url(#delhiGridPattern)" />

          {/* 2. Yamuna River Corridor (East Border) */}
          {city?.river_path && city.river_path.length > 1 && (
            <g className="delhi-yamuna-river">
              <polyline
                points={city.river_path.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill="none"
                stroke="url(#yamunaRiverGrad)"
                strokeWidth="45"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.6}
              />
              <text
                x="1155"
                y="460"
                fill="#38BDF8"
                fontSize="11"
                fontFamily="sans-serif"
                fontWeight="bold"
                letterSpacing="4"
                textAnchor="middle"
                opacity={0.7}
                transform="rotate(88, 1155, 460)"
              >
                ≈ YAMUNA RIVER ≈
              </text>
            </g>
          )}

          {/* 3. District Zone Watermarks */}
          {city?.districts?.map((dist, idx) => (
            <text
              key={`district-${idx}`}
              x={dist.x}
              y={dist.y}
              fill={isDark ? "#334155" : "#94A3B8"}
              fontSize="12"
              fontFamily="sans-serif"
              fontWeight="800"
              letterSpacing="2.5"
              textAnchor="middle"
              opacity={isDark ? 0.35 : 0.45}
            >
              {dist.name}
            </text>
          ))}

          {/* 4. REAL OPENSTREETMAP ROADS LAYER (4,602 Segments, Hierarchical SVG Styling) */}
          <g className="delhi-osm-roads">
            {/* A. Residential roads */}
            {groupedRoads.residential.map((road, idx) => (
              <polyline
                key={`res-${road.u}-${road.v}-${idx}`}
                points={road.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill="none"
                stroke={isDark ? "#334155" : "#E2E8F0"}
                strokeWidth={isDark ? "0.85" : "1.0"}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isDark ? 0.35 : 0.75}
              />
            ))}

            {/* B. Tertiary roads */}
            {groupedRoads.tertiary.map((road, idx) => (
              <polyline
                key={`tert-${road.u}-${road.v}-${idx}`}
                points={road.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill="none"
                stroke={isDark ? "#475569" : "#CBD5E1"}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isDark ? 0.65 : 0.85}
              />
            ))}

            {/* C. Secondary roads */}
            {groupedRoads.secondary.map((road, idx) => (
              <polyline
                key={`sec-${road.u}-${road.v}-${idx}`}
                points={road.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                fill="none"
                stroke={isDark ? "#64748B" : "#94A3B8"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isDark ? 0.85 : 0.95}
              />
            ))}

            {/* D. Primary / Trunk roads — Mathura Road (NH-2), Ring Road, Main Corridors */}
            {groupedRoads.primary.map((road, idx) => (
              <g key={`prim-${road.u}-${road.v}-${idx}`}>
                {/* Outer casing */}
                <polyline
                  points={road.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                  fill="none"
                  stroke={isDark ? "#1E293B" : "#CBD5E1"}
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.9}
                />
                {/* Inner golden/amber core */}
                <polyline
                  points={road.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
                />
                {/* Center dashed lane divider */}
                <polyline
                  points={road.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                  fill="none"
                  stroke={isDark ? "#FEF3C7" : "#FFFFFF"}
                  strokeWidth="0.9"
                  strokeDasharray="6, 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              </g>
            ))}
          </g>

          {/* 5. Fallback Edge lines if OSM roads still loading */}
          {roads.length === 0 && city?.edges?.map((edge, idx) => (
            <line
              key={`fallback-edge-${idx}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="#334155"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.5}
            />
          ))}

          {/* 6. Arterial Name Overlays */}
          <g className="delhi-corridor-titles" opacity={0.75}>
            <text
              x="580"
              y="440"
              fill="#FBBF24"
              fontSize="10"
              fontFamily="sans-serif"
              fontWeight="bold"
              letterSpacing="3"
              textAnchor="middle"
              transform="rotate(32, 580, 440)"
            >
              ◄ MATHURA ROAD (NH-2) ►
            </text>
            <text
              x="360"
              y="225"
              fill="#38BDF8"
              fontSize="10"
              fontFamily="sans-serif"
              fontWeight="bold"
              letterSpacing="3"
              textAnchor="middle"
            >
              ◄ OUTER RING ROAD ►
            </text>
            <text
              x="760"
              y="600"
              fill="#34D399"
              fontSize="9"
              fontFamily="sans-serif"
              fontWeight="bold"
              letterSpacing="2"
              textAnchor="middle"
            >
              OKHLA PHASE-I & II INDUSTRIAL SPINE
            </text>
          </g>

          {/* 7. Traffic Incidents Overlay */}
          {city?.edges?.filter(e => e.status === 'incident').map((edge, idx) => {
            const midX = (edge.x1 + edge.x2) / 2;
            const midY = (edge.y1 + edge.y2) / 2;
            return (
              <g key={`incident-${idx}`} className="cursor-pointer">
                <circle cx={midX} cy={midY} r="22" fill="#EF4444" fillOpacity="0.25" className="animate-ping" />
                <circle cx={midX} cy={midY} r="14" fill="#991B1B" stroke="#FEE2E2" strokeWidth="2" />
                <text x={midX} y={midY + 4} fill="#FFF" fontSize="10" textAnchor="middle" fontWeight="bold">⚠️</text>
                <rect x={midX - 50} y={midY - 30} width="100" height="18" rx="4" fill="#7F1D1D" stroke="#EF4444" strokeWidth="1" />
                <text x={midX} y={midY - 17} fill="#FEF2F2" fontSize="8" fontWeight="bold" textAnchor="middle">
                  CHOKEPOINT (+5.2x DELAY)
                </text>
              </g>
            );
          })}

          {/* 8. OPTIMIZED FLEET ROUTES (Following Stored Curved Road Geometry) */}
          <g className="delhi-routes-layer">
            {riderRoutes.map((route, rIdx) => {
              const live = vehicleLiveStates[rIdx];
              const color = getRiderColor(rIdx);
              if (!live || !route.waypoint_coords || route.waypoint_coords.length < 2) return null;

              const isHovered = hoveredVehicle === route.rider_id;
              const hasAnyHover = hoveredVehicle !== null;
              const routeOpacity = hasAnyHover ? (isHovered ? 1.0 : 0.2) : 0.85;
              const fullRoutePoints = (route.waypoint_coords || []).map(pt => `${pt.x},${pt.y}`).join(' ');

              return (
                <g
                  key={`route-${route.rider_id}`}
                  className="transition-opacity duration-200 cursor-pointer"
                  opacity={routeOpacity}
                  onMouseEnter={() => setHoveredVehicle(route.rider_id)}
                  onMouseLeave={() => setHoveredVehicle(null)}
                >
                  {/* Full Planned Route Baseline: Always visible across streets */}
                  {fullRoutePoints && (
                    <polyline
                      points={fullRoutePoints}
                      fill="none"
                      stroke={color.stroke}
                      strokeWidth={isHovered ? 3.8 : 2.4}
                      strokeDasharray="5, 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity={isHovered ? 0.85 : 0.45}
                    />
                  )}

                  {/* Remaining Path: Dashed translucent line along real streets */}
                  {live.remainingPath && (
                    <polyline
                      points={live.remainingPath}
                      fill="none"
                      stroke={color.stroke}
                      strokeWidth={isHovered ? 4.5 : 2.8}
                      strokeDasharray="6, 5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity={isHovered ? 0.95 : 0.65}
                      filter={isHovered ? 'url(#delhiHighlightGlow)' : undefined}
                    />
                  )}

                  {/* Completed Path: Solid vibrant luminous polyline along real streets */}
                  {live.completedPath && (
                    <polyline
                      points={live.completedPath}
                      fill="none"
                      stroke={color.stroke}
                      strokeWidth={isHovered ? 5.5 : 3.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity={1.0}
                      filter={isHovered ? 'url(#delhiHighlightGlow)' : 'url(#delhiRouteGlow)'}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* 9. REAL DELHI LANDMARKS (Architectural Badges) */}
          <g className="delhi-landmarks-layer">
            {city?.landmarks?.map((lm) => {
              const isHovered = hoveredLandmark?.id === lm.id;
              return (
                <g
                  key={lm.id}
                  transform={`translate(${lm.pos[0]}, ${lm.pos[1]})`}
                  onMouseEnter={() => setHoveredLandmark(lm)}
                  onMouseLeave={() => setHoveredLandmark(null)}
                  className="cursor-pointer transition-transform duration-200 hover:scale-125"
                >
                  <circle
                    cx="0"
                    cy="0"
                    r={isHovered ? 14 : 9}
                    fill={lm.type === 'depot' ? '#F59E0B' : '#1E293B'}
                    stroke={lm.type === 'depot' ? '#FEF3C7' : '#94A3B8'}
                    strokeWidth="1.8"
                    className="shadow-lg"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fontSize={isHovered ? 11 : 8}
                    fill="#FFF"
                  >
                    {lm.type === 'temple' ? '🛕' : lm.type === 'hospital' ? '🏥' : lm.type === 'commercial' ? '🏢' : lm.type === 'depot' ? '🏭' : '🏛️'}
                  </text>

                  {/* Label badge */}
                  <g transform="translate(0, 16)">
                    <rect
                      x="-55"
                      y="0"
                      width="110"
                      height="16"
                      rx="3"
                      fill="#0F172A"
                      stroke="#334155"
                      strokeWidth="1"
                      fillOpacity="0.9"
                    />
                    <text
                      x="0"
                      y="11"
                      textAnchor="middle"
                      fill="#E2E8F0"
                      fontSize="8"
                      fontWeight="bold"
                    >
                      {lm.short || lm.name}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* 10. DELIVERY STOP PINS (No junction dots — only real delivery stops) */}
          <g className="delhi-deliveries-layer">
            {city?.deliveries?.map((d) => {
              const assignedRider = deliveryVehicleMap.get(d.id);
              const color = assignedRider !== undefined ? getRiderColor(assignedRider) : { stroke: '#94A3B8', bg: '#475569' };
              const isVehicleHovered = hoveredVehicle !== null && assignedRider === (hoveredVehicle - 1);
              const isAnyVehicleHovered = hoveredVehicle !== null;
              const pinOpacity = isAnyVehicleHovered ? (isVehicleHovered ? 1.0 : 0.3) : 0.95;

              // Check if already visited by vehicle
              const live = assignedRider !== undefined ? vehicleLiveStates[assignedRider] : null;
              const isCompleted = live?.completedDeliveries?.has(d.id);

              return (
                <g
                  key={`deliv-${d.id}`}
                  transform={`translate(${d.pos[0]}, ${d.pos[1]})`}
                  opacity={pinOpacity}
                  onMouseEnter={() => setHoveredStop(d)}
                  onMouseLeave={() => setHoveredStop(null)}
                  className="cursor-pointer transition-transform duration-150 hover:scale-125"
                >
                  {/* Priority indicator ring */}
                  {d.priority === 'high' && (
                    <circle cx="0" cy="0" r="13" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="3, 2" />
                  )}

                  {/* Pin Circle */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isCompleted ? 6.5 : 8.5}
                    fill={isCompleted ? '#059669' : color.stroke}
                    stroke="#FFFFFF"
                    strokeWidth="1.6"
                    className="filter drop-shadow-md"
                  />

                  {/* Delivery Stop ID */}
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fontSize={isCompleted ? 6.5 : 7.5}
                    fill="#FFFFFF"
                    fontWeight="extrabold"
                    fontFamily="monospace"
                  >
                    {isCompleted ? '✓' : d.id}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 11. CENTRAL DEPOT — NSIC COMPLEX (OKHLA INDUSTRIAL ESTATE) */}
          {city?.depot && (
            <g transform={`translate(${city.depot.x}, ${city.depot.y})`} className="cursor-pointer">
              {/* Concentric radar rings */}
              <circle cx="0" cy="0" r="28" fill="url(#delhiDepotGlow)" className="animate-pulse" />
              <circle cx="0" cy="0" r="16" fill="#F59E0B" fillOpacity="0.25" className="animate-ping" />
              <circle cx="0" cy="0" r="12" fill="#D97706" stroke="#FEF3C7" strokeWidth="2.5" className="shadow-2xl" />
              <text x="0" y="4" textAnchor="middle" fontSize="10" fill="#FFF" fontWeight="bold">🏢</text>

              {/* Central Hub Banner */}
              <g transform="translate(0, 20)">
                <rect x="-65" y="0" width="130" height="18" rx="4" fill="#78350F" stroke="#F59E0B" strokeWidth="1.2" />
                <text x="0" y="12" textAnchor="middle" fill="#FEF3C7" fontSize="8" fontWeight="extrabold" letterSpacing="0.5">
                  NSIC CENTRAL DEPOT
                </text>
              </g>
            </g>
          )}

          {/* 12. ANIMATED FLEET VEHICLES (Driving along exact OSM curved streets) */}
          <g className="delhi-animated-vehicles">
            {vehicleLiveStates.map((vState, rIdx) => {
              const color = getRiderColor(rIdx);
              const isHovered = hoveredVehicle === vState.rider_id;

              return (
                <g
                  key={`vehicle-marker-${vState.rider_id}`}
                  transform={`translate(${vState.pos.x}, ${vState.pos.y})`}
                  className="cursor-pointer transition-transform duration-100 hover:scale-125"
                  onMouseEnter={() => setHoveredVehicle(vState.rider_id)}
                  onMouseLeave={() => setHoveredVehicle(null)}
                >
                  {/* Glowing Radar Halo */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isHovered ? 18 : 14}
                    fill={color.stroke}
                    fillOpacity="0.3"
                    className="animate-ping"
                  />

                  {/* Vehicle Body Pin */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isHovered ? 12 : 9.5}
                    fill={color.stroke}
                    stroke="#FFFFFF"
                    strokeWidth="2.0"
                    className="shadow-xl"
                  />

                  {/* Vehicle Icon / Number */}
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    fontSize="8"
                    fill="#FFFFFF"
                    fontWeight="extrabold"
                    fontFamily="monospace"
                  >
                    V{vState.rider_id}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating North Arrow Compass */}
        <div className={`absolute top-3 right-3 border rounded-lg p-2 flex flex-col items-center gap-0.5 backdrop-blur-md shadow-md pointer-events-none transition-colors ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200 shadow-sm'
        }`}>
          <Compass size={18} className="text-amber-500" />
          <span className="text-[9px] font-mono font-extrabold text-amber-600 dark:text-amber-300">N</span>
        </div>

        {/* Real-time Map Info Tag */}
        <div className={`absolute bottom-3 left-3 border rounded-lg px-3 py-1.5 backdrop-blur-md shadow-md flex items-center gap-3 text-[11px] font-mono transition-colors ${
          isDark ? 'bg-slate-900/85 border-slate-800 text-slate-300' : 'bg-white/95 border-slate-200 text-slate-700 shadow-sm'
        }`}>
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            4,602 OSM Roads Loaded
          </span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
          <span>50 Real Stops</span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
          <span>3 × 3 km SE-Delhi</span>
        </div>

        {/* Vehicle Hover Highlight Banner */}
        {hoveredVehicle !== null && (
          <div className={`absolute top-3 left-3 border rounded-xl p-3 backdrop-blur-md shadow-2xl z-30 max-w-xs animate-in fade-in slide-in-from-top-2 transition-colors ${
            isDark ? 'bg-slate-900/95 border-amber-500/50 text-slate-300' : 'bg-white/95 border-amber-500/50 text-slate-700 shadow-lg'
          }`}>
            {(() => {
              const live = vehicleLiveStates[hoveredVehicle - 1];
              const route = riderRoutes[hoveredVehicle - 1];
              const color = getRiderColor(hoveredVehicle - 1);
              if (!live || !route) return null;

              return (
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className={`flex items-center justify-between gap-2 border-b pb-1.5 ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}>
                    <span className={`font-heading font-bold flex items-center gap-1.5 ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      <Truck size={14} style={{ color: color.stroke }} />
                      Vehicle {hoveredVehicle}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                      {live.progressPct}% Done
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className={`block text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>TOTAL STOPS</span>
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{route.delivery_count}</span>
                    </div>
                    <div>
                      <span className={`block text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>CARGO LOAD</span>
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{route.total_load_kg} kg</span>
                    </div>
                    <div>
                      <span className={`block text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>NEXT STOP</span>
                      <span className="font-bold text-amber-600 dark:text-amber-300 truncate block">{live.currentStopLabel}</span>
                    </div>
                    <div>
                      <span className={`block text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>EST. REMAINING</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{live.etaMin} min</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Stop Tooltip on Hover */}
        {hoveredStop && (
          <div className={`absolute bottom-12 left-3 border rounded-lg p-2.5 backdrop-blur-md shadow-xl text-xs z-30 max-w-xs pointer-events-none transition-colors ${
            isDark ? 'bg-slate-900/95 border-slate-700 text-slate-300' : 'bg-white/95 border-slate-200 text-slate-700 shadow-md'
          }`}>
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold font-mono">
              <MapPin size={13} />
              {hoveredStop.label}
            </div>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{hoveredStop.locality}</p>
            <div className={`flex items-center gap-3 mt-1.5 text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>Priority: <b className={hoveredStop.priority === 'high' ? 'text-red-500' : (isDark ? 'text-slate-200' : 'text-slate-800')}>{hoveredStop.priority}</b></span>
              <span>Demand: <b>{hoveredStop.demand} pkg</b></span>
            </div>
          </div>
        )}

        {/* Landmark Tooltip on Hover */}
        {hoveredLandmark && (
          <div className={`absolute bottom-12 right-3 border rounded-lg p-2.5 backdrop-blur-md shadow-xl text-xs z-30 max-w-xs pointer-events-none transition-colors ${
            isDark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200 shadow-md'
          }`}>
            <div className={`flex items-center gap-1.5 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Building2 size={13} className="text-amber-500" />
              {hoveredLandmark.name}
            </div>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{hoveredLandmark.desc}</p>
            <span className={`text-[10px] font-mono block mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Lat: {hoveredLandmark.lat}, Lng: {hoveredLandmark.lng}
            </span>
          </div>
        )}
      </div>

      {/* Interactive Legend with Vehicle Hover Highlighting */}
      {(riderRoutes.length > 0 || (numRiders && numRiders > 0)) && (
        <div className={`px-3 py-2 border-t flex items-center justify-between text-xs flex-wrap gap-2 z-10 transition-colors ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`text-[11px] font-mono font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Fleet Hover:</span>
            {riderRoutes.length > 0 ? (
              riderRoutes.map((route, rIdx) => {
                const color = getRiderColor(rIdx);
                const isHovered = hoveredVehicle === route.rider_id;

                return (
                  <button
                    key={`pill-rider-${route.rider_id}`}
                    onMouseEnter={() => setHoveredVehicle(route.rider_id)}
                    onMouseLeave={() => setHoveredVehicle(null)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[11px] transition-all ${
                      isHovered
                        ? isDark ? 'bg-slate-800 border-amber-400 text-white shadow-md shadow-amber-500/20 scale-105' : 'bg-amber-50 border-amber-500 text-slate-900 shadow-md scale-105'
                        : isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600' : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.stroke }} />
                    <span>V{route.rider_id}</span>
                    <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>({route.delivery_count} stops)</span>
                  </button>
                );
              })
            ) : (
              Array.from({ length: numRiders || 4 }).map((_, rIdx) => {
                const riderId = rIdx + 1;
                const color = getRiderColor(rIdx);
                const isHovered = hoveredVehicle === riderId;

                return (
                  <button
                    key={`pill-rider-staged-${riderId}`}
                    onMouseEnter={() => setHoveredVehicle(riderId)}
                    onMouseLeave={() => setHoveredVehicle(null)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[11px] transition-all ${
                      isHovered
                        ? isDark ? 'bg-slate-800 border-amber-400 text-white shadow-md shadow-amber-500/20 scale-105' : 'bg-amber-50 border-amber-500 text-slate-900 shadow-md scale-105'
                        : isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600' : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.stroke }} />
                    <span>V{riderId}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400/80">(Staged)</span>
                  </button>
                );
              })
            )}
          </div>

          <div className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Hover vehicle or route to highlight path
          </div>
        </div>
      )}
    </div>
  );
};
