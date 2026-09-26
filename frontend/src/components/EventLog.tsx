import React from 'react';
import { EventLogItem } from '../types';
import { List, CheckCircle2, AlertTriangle, Zap, Info, Clock } from 'lucide-react';

interface EventLogProps {
  logs: EventLogItem[];
  onClear: () => void;
}

export const EventLog: React.FC<EventLogProps> = ({ logs, onClear }) => {
  const getIcon = (type: EventLogItem['type']) => {
    switch (type) {
      case 'qpso':
        return <Zap size={13} className="text-emerald-500" />;
      case 'pso':
        return <Zap size={13} className="text-cyan-500" />;
      case 'traffic':
        return <AlertTriangle size={13} className="text-red-500" />;
      case 'success':
        return <CheckCircle2 size={13} className="text-emerald-600" />;
      default:
        return <Info size={13} className="text-slate-400" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <List size={16} className="text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900 font-heading">Simulation Event Log</h3>
        </div>
        <button
          onClick={onClear}
          className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto max-h-48 space-y-2 pr-1 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-slate-400 text-center py-6 text-xs italic">
            No events logged yet. Start simulation to see real-time updates.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2 hover:bg-slate-100/70 transition-colors"
            >
              <div className="mt-0.5">{getIcon(log.type)}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800">{log.title}</span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock size={10} />
                    {log.timestamp}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-sans mt-0.5">{log.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
