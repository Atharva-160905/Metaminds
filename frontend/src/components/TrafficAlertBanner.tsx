import React from 'react';
import { TrafficIncident } from '../types';
import { AlertTriangle, Clock, ArrowRight, Zap, RefreshCw } from 'lucide-react';

interface TrafficAlertBannerProps {
  incidents: TrafficIncident[];
  onReoptimize: () => void;
  isOptimizing: boolean;
}

export const TrafficAlertBanner: React.FC<TrafficAlertBannerProps> = ({
  incidents,
  onReoptimize,
  isOptimizing,
}) => {
  if (!incidents || incidents.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-red-950/90 via-rose-900/90 to-slate-900 border border-red-500/60 text-white p-4 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse-slow">
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-2.5 bg-red-600/30 border border-red-400 rounded-xl text-red-300">
          <AlertTriangle size={22} className="animate-bounce" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm text-red-200">
              Active Traffic Incidents Detected
            </span>
            <span className="bg-red-500 text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {incidents.length} Roads Jammed
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-red-200/80">
            {incidents.map((inc, i) => (
              <span key={i} className="flex items-center gap-1.5 font-mono">
                <span className="text-white font-semibold">{inc.road_name}:</span>
                <span className="line-through text-red-300/70">{inc.old_time} min</span>
                <ArrowRight size={12} className="text-amber-400" />
                <span className="text-amber-300 font-bold">{inc.new_time} min</span>
                <span className="text-[10px] bg-red-500/30 px-1 rounded text-red-200">
                  {inc.congestion_factor}x delay
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onReoptimize}
        disabled={isOptimizing}
        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all whitespace-nowrap"
      >
        {isOptimizing ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            <span>Re-Routing Fleet...</span>
          </>
        ) : (
          <>
            <Zap size={14} className="fill-slate-950" />
            <span>Re-Optimize to Avoid Traffic</span>
          </>
        )}
      </button>
    </div>
  );
};
