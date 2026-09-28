import React, { useState } from 'react';
import { RiderRoute, Delivery } from '../types';
import { getRiderColor } from '../utils/colors';
import {
  Truck,
  Package,
  Weight,
  Clock,
  Navigation,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface FleetVehiclesTableProps {
  numRiders: number;
  riderCapacityKg: number;
  riderRoutes?: RiderRoute[];
  deliveries?: Delivery[];
  hoveredVehicle: number | null;
  onHoverVehicle: (riderId: number | null) => void;
  title?: string;
}

export const FleetVehiclesTable: React.FC<FleetVehiclesTableProps> = ({
  numRiders,
  riderCapacityKg,
  riderRoutes = [],
  deliveries = [],
  hoveredVehicle,
  onHoverVehicle,
  title = "Fleet Vehicles Manifest & Payload Distribution"
}) => {
  const [expandedRider, setExpandedRider] = useState<number | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Fallback vehicle types for authentic realistic presentation
  const vehicleNames = [
    "Van 1 • Tata Ace EV (Electric)",
    "Van 2 • Mahindra Treo Zor EV",
    "Van 3 • Piaggio Ape E-Xtra",
    "Van 4 • Euler HiLoad EV",
    "Van 5 • Ashok Leyland Bada Dost",
    "Van 6 • Tata Ace Gold Diesel",
    "Van 7 • Mahindra Bolero Maxi Truck",
    "Van 8 • Eicher Pro EV Carrier"
  ];

  // Build rows for all numRiders vehicles
  const vehicleRows = Array.from({ length: numRiders }).map((_, rIdx) => {
    const riderId = rIdx + 1;
    const color = getRiderColor(rIdx);
    const route = riderRoutes.find(r => r.rider_id === riderId);

    const hasRoute = !!route && route.delivery_count > 0;
    const deliveryCount = route ? route.delivery_count : 0;
    const totalWeightKg = route ? route.total_load_kg : 0.0;
    const routeDistKm = route ? route.route_dist_km : 0.0;
    const routeTimeMin = route ? route.route_time_min : 0.0;
    const assignedDeliveries = route ? route.deliveries : [];

    const capacityRatio = riderCapacityKg > 0 ? (totalWeightKg / riderCapacityKg) : 0;
    const capacityPct = Math.min(100, Math.round(capacityRatio * 100));

    let capacityBadgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    let capacityBarColor = "bg-emerald-500";
    if (capacityRatio > 0.95) {
      capacityBadgeColor = "text-rose-400 bg-rose-500/10 border-rose-500/30";
      capacityBarColor = "bg-rose-500";
    } else if (capacityRatio > 0.75) {
      capacityBadgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/30";
      capacityBarColor = "bg-amber-500";
    }

    return {
      riderId,
      name: vehicleNames[rIdx % vehicleNames.length],
      color,
      hasRoute,
      deliveryCount,
      totalWeightKg,
      capacityPct,
      capacityBadgeColor,
      capacityBarColor,
      routeDistKm,
      routeTimeMin,
      assignedDeliveries,
    };
  });

  // Calculate totals
  const totalPackagesAssigned = vehicleRows.reduce((acc, v) => acc + v.deliveryCount, 0);
  const totalWeightCarriedKg = Number(vehicleRows.reduce((acc, v) => acc + v.totalWeightKg, 0).toFixed(1));
  const activeFleetCount = vehicleRows.filter(v => v.hasRoute).length;
  const avgWeightPerVan = activeFleetCount > 0 ? (totalWeightCarriedKg / activeFleetCount).toFixed(1) : "0.0";

  return (
    <div className={`rounded-2xl overflow-hidden border shadow-sm transition-colors ${
      isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200'
    }`}>
      {/* Table Header */}
      <div className={`px-5 py-3.5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-md">
            <Truck size={16} className="font-extrabold" />
          </div>
          <div>
            <h3 className={`font-heading font-bold text-sm flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              <span>{title}</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {numRiders} Fleet Vehicles
              </span>
            </h3>
            <p className={`text-[11px] mt-0.5 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Live payload distribution, parcel weight tracking, and per-vehicle route schedules.
            </p>
          </div>
        </div>

        {/* Quick KPI Stat Chips */}
        <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Package size={13} className="text-amber-500" />
            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>PARCELS:</span>
            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalPackagesAssigned || deliveries.length}</span>
          </div>

          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Weight size={13} className="text-emerald-500" />
            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>TOTAL WEIGHT:</span>
            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalWeightCarriedKg} kg</span>
          </div>

          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>AVG LOAD:</span>
            <span className="text-emerald-600 dark:text-emerald-300 font-bold">{avgWeightPerVan} kg</span>
          </div>

          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>CAPACITY/VAN:</span>
            <span className="text-violet-600 dark:text-violet-300 font-bold">{riderCapacityKg} kg</span>
          </div>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`border-b text-[11px] font-mono uppercase ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
              <th className="py-3 px-4 font-bold">Vehicle / Driver</th>
              <th className="py-3 px-4 font-bold">Status</th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Package size={13} className="text-amber-400" />
                  <span>Packages Assigned</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Weight size={13} className="text-emerald-400" />
                  <span>Payload Weight</span>
                  <span className="text-[9px] text-slate-500 font-normal">(kg)</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Layers size={13} className="text-violet-400" />
                  <span>Capacity Utilization</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Navigation size={13} className="text-indigo-400" />
                  <span>Distance</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-sky-400" />
                  <span>Route Time</span>
                </div>
              </th>
              <th className="py-3 px-4 font-bold text-center">Package Stops</th>
            </tr>
          </thead>

          <tbody className={`divide-y text-xs font-mono ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {vehicleRows.map((v) => {
              const isHovered = hoveredVehicle === v.riderId;
              const isExpanded = expandedRider === v.riderId;

              return (
                <React.Fragment key={`fleet-v-${v.riderId}`}>
                  <tr
                    onMouseEnter={() => onHoverVehicle(v.riderId)}
                    onMouseLeave={() => onHoverVehicle(null)}
                    className={`transition-all cursor-pointer ${
                      isHovered
                        ? isDark ? 'bg-slate-800/80 shadow-md ring-1 ring-amber-500/50' : 'bg-amber-50 shadow-sm ring-1 ring-amber-400'
                        : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Vehicle Identity */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20 shrink-0"
                          style={{ backgroundColor: v.color.stroke }}
                        />
                        <div>
                          <div className={`font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            <span>V{v.riderId}</span>
                            <span className={`text-[10px] font-sans font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              ({v.name})
                            </span>
                          </div>
                          <span className={`text-[10px] block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            Assigned Sector #{v.riderId}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {v.hasRoute ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 size={11} />
                          Dispatched ({v.deliveryCount} stops)
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}>
                          <Clock size={11} />
                          Stationed at Hub
                        </span>
                      )}
                    </td>

                    {/* Packages Assigned */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {v.deliveryCount}
                      </span>
                      <span className={`text-[10px] ml-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>pkgs</span>
                    </td>

                    {/* Payload Weight */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {v.totalWeightKg}
                        </span>
                        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>/ {riderCapacityKg} kg</span>
                      </div>
                    </td>

                    {/* Capacity Utilization Progress Bar */}
                    <td className="py-3.5 px-4 whitespace-nowrap min-w-[140px]">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className={`px-1.5 py-0.2 rounded border font-bold ${v.capacityBadgeColor}`}>
                          {v.capacityPct}%
                        </span>
                        <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {(riderCapacityKg - v.totalWeightKg).toFixed(1)} kg free
                        </span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${v.capacityBarColor}`}
                          style={{ width: `${v.capacityPct}%` }}
                        />
                      </div>
                    </td>

                    {/* Distance */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {v.hasRoute ? `${v.routeDistKm} km` : '—'}
                      </span>
                    </td>

                    {/* Route Time */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {v.hasRoute ? `${v.routeTimeMin} min` : '—'}
                      </span>
                    </td>

                    {/* Package Stops Dropdown Trigger */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-center">
                      {v.assignedDeliveries.length > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRider(isExpanded ? null : v.riderId);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all inline-flex items-center gap-1 border ${
                            isDark
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-300'
                          }`}
                        >
                          <span>{v.assignedDeliveries.length} Parcels</span>
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      ) : (
                        <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>None</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Parcel Stop Details Drawer */}
                  {isExpanded && v.assignedDeliveries.length > 0 && (
                    <tr className={`border-b transition-colors ${
                      isDark ? 'bg-slate-950/90 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <td colSpan={8} className="p-3">
                        <div className={`border rounded-lg p-3 ${
                          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1">
                              <Package size={12} />
                              Vehicle {v.riderId} Manifest — Sequential Stop & Parcel Weights
                            </span>
                            <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              Total: {v.assignedDeliveries.length} packages ({v.totalWeightKg} kg)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] font-mono">
                            {v.assignedDeliveries.map((deliv: any, idx: number) => (
                              <div
                                key={`v-${v.riderId}-deliv-${deliv.delivery_id}-${idx}`}
                                className={`border rounded-md p-2 flex items-center justify-between gap-2 ${
                                  isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="truncate">
                                  <span className="text-amber-500 font-bold block text-[10px]">
                                    #{idx + 1} • Stop {deliv.delivery_id}
                                  </span>
                                  <span className={`text-[10px] truncate block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {deliv.label || `Delivery ${deliv.delivery_id}`}
                                  </span>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block text-[10px]">
                                    {deliv.weight_kg ? `${deliv.weight_kg} kg` : '5.0 kg'}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block">
                                    ETA: {deliv.eta_min ? `${deliv.eta_min}m` : '—'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Instructions */}
      <div className={`px-5 py-2.5 border-t flex items-center justify-between text-[11px] font-mono transition-colors ${
        isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}>
        <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Van loads come from the decoded routes; overloads are penalised in the route cost</span>
        </span>
        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          Hover vehicle row to highlight route on map
        </span>
      </div>
    </div>
  );
};
