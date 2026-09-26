import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SyntheticCityData,
  OptimizerResult,
  ComparisonMetrics,
  TrafficIncident,
  EventLogItem
} from '../types';
import { api } from '../services/api';
import { PuneRouteMap } from './PuneRouteMap';
import { getRiderColor } from '../utils/colors';
import {
  MapPin,
  Play,
  RotateCcw,
  Zap,
  AlertTriangle,
  Flame,
  CheckCircle2,
  TrendingUp,
  Clock,
  Navigation,
  Sparkles,
  Building2,
  Truck,
  ShieldCheck,
  Activity,
  Layers
} from 'lucide-react';

export const PuneLiveView: React.FC = () => {
  const [city, setCity] = useState<SyntheticCityData | null>(null);
  const [numDeliveries, setNumDeliveries] = useState<number>(25);
  const [numRiders, setNumRiders] = useState<number>(4);
  const [riderCapacity, setRiderCapacity] = useState<number>(8);
  const [objective, setObjective] = useState<'balanced' | 'time' | 'distance'>('balanced');
  const [seed, setSeed] = useState<number>(42);

  const [qpsoResult, setQpsoResult] = useState<OptimizerResult | null>(null);
  const [psoResult, setPsoResult] = useState<OptimizerResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonMetrics | null>(null);
  const [activeIncidents, setActiveIncidents] = useState<TrafficIncident[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isSimulatingTraffic, setIsSimulatingTraffic] = useState<boolean>(false);
  const [isReoptimizing, setIsReoptimizing] = useState<boolean>(false);

  // Playback Animation States
  const [animProgress, setAnimProgress] = useState<number>(0.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const animFrameRef = useRef<number | null>(null);

  // Event Logs
  const [logs, setLogs] = useState<EventLogItem[]>([
    {
      id: 'log-0',
      timestamp: new Date().toLocaleTimeString(),
      title: 'Pune Road GIS Initialized',
      description: 'Loaded authentic Sinhgad Campus, Vadgaon BK, and Ambegaon road topology.',
      type: 'info'
    }
  ]);

  const addLog = (title: string, description: string, type: EventLogItem['type']) => {
    setLogs(prev => [
      {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        title,
        description,
        type
      },
      ...prev.slice(0, 19)
    ]);
  };

  // 1. Initial Load of Pune Network
  const fetchPuneNetwork = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getPuneNetwork();
      setCity(data.city);
      addLog('GIS Map Loaded', `Rendered ${data.city.landmarks?.length || 10} landmarks and ${data.city.edges.length} real road segments.`, 'success');
    } catch (err) {
      console.error('Failed to load Pune network:', err);
      addLog('Error Loading GIS', 'Could not connect to Pune map endpoint.', 'warning');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPuneNetwork();
  }, [fetchPuneNetwork]);

  // 2. Generate Delivery Problems across Sinhgad/Ambegaon
  const handleGenerateProblem = async () => {
    try {
      setIsLoading(true);
      const newSeed = Math.floor(Math.random() * 10000);
      setSeed(newSeed);
      const res = await api.generatePuneProblem({
        num_deliveries: numDeliveries,
        num_riders: numRiders,
        rider_capacity: riderCapacity,
        objective,
        seed: newSeed
      });
      setCity(res.city);
      setQpsoResult(null);
      setPsoResult(null);
      setComparison(null);
      setActiveIncidents([]);
      setAnimProgress(0);
      setIsPlaying(false);
      addLog('Stops Distributed', `Generated ${numDeliveries} delivery packages across Sinhgad campus & Ambegaon localities.`, 'info');
    } catch (err) {
      console.error(err);
      addLog('Generation Failed', 'Could not distribute delivery packages.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Dual Metaheuristic Optimization on Pune Map
  const handleRunOptimization = async () => {
    try {
      setIsOptimizing(true);
      addLog('Optimization Started', 'Executing Quantum-Inspired QPSO vs Classical PSO on Pune road graph...', 'info');
      const res = await api.runPuneOptimization({
        num_particles: 30,
        max_iterations: 80,
        seed
      });
      setQpsoResult(res.qpso);
      setPsoResult(res.pso);
      setComparison(res.comparison);
      setCity(res.city);
      setAnimProgress(0);
      setIsPlaying(true);

      const winText = res.comparison.winner === 'QPSO'
        ? `QPSO achieved ${Math.abs(res.comparison.cost_diff_pct)}% lower total cost.`
        : res.comparison.winner === 'PSO'
        ? `PSO achieved ${Math.abs(res.comparison.cost_diff_pct)}% lower total cost.`
        : 'Both algorithms achieved matching routing quality.';

      addLog(`Optimization Complete: ${res.comparison.winner} Won`, winText, res.comparison.winner === 'QPSO' ? 'qpso' : 'pso');
    } catch (err) {
      console.error(err);
      addLog('Optimization Failed', 'Error running dual metaheuristic routing.', 'warning');
    } finally {
      setIsOptimizing(false);
    }
  };

  // 4. Simulate Real Pune Traffic Incident
  const handleSimulateTraffic = async () => {
    try {
      setIsSimulatingTraffic(true);
      const res = await api.simulatePuneTraffic(2);
      setActiveIncidents(res.incidents);
      setCity(res.city);
      const names = res.incidents.map(i => i.road_name).join(' & ');
      addLog('🚨 Pune Traffic Choke Injected', `Severe congestion on ${names} (4.5x - 6.2x delay factor).`, 'traffic');
    } catch (err) {
      console.error(err);
      addLog('Traffic Simulation Failed', 'Could not inject road congestion.', 'warning');
    } finally {
      setIsSimulatingTraffic(false);
    }
  };

  // 5. Dynamic Warm-Started Re-Optimization
  const handleReoptimize = async () => {
    try {
      setIsReoptimizing(true);
      addLog('Dynamic Re-Routing', 'Running warm-started particle adaptation around Pune road blocks...', 'info');
      const res = await api.reoptimizePune({
        num_particles: 30,
        max_iterations: 75,
        seed: seed + 50
      });
      setQpsoResult(res.qpso);
      setPsoResult(res.pso);
      setComparison(res.comparison);
      setCity(res.city);
      setActiveIncidents(res.incidents);
      setAnimProgress(0);
      setIsPlaying(true);

      addLog('Re-Optimization Complete', `Dynamic fleet re-routed: ${res.comparison.winner} found safest detours.`, res.comparison.winner === 'QPSO' ? 'qpso' : 'pso');
    } catch (err) {
      console.error(err);
      addLog('Re-Optimization Failed', 'Could not re-route around incidents.', 'warning');
    } finally {
      setIsReoptimizing(false);
    }
  };

  // Animation Loop for live vehicle movement
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      const deltaMs = currentTime - lastTime;
      lastTime = currentTime;

      // Base cycle: 14 seconds for complete delivery route
      const progressDelta = (deltaMs / (14000 / playbackSpeed));

      setAnimProgress(prev => {
        const next = prev + progressDelta;
        if (next >= 1.0) {
          return 0.0; // Loop seamlessly
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 1. Hero Regional Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-[#0c1836] border border-cyan-900/50 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md shadow-cyan-500/20">
                <MapPin size={12} className="animate-pulse" />
                AUTHENTIC PUNE GIS
              </span>
              <span className="text-slate-400 text-xs font-mono">
                Lat 18.4635°N | Lng 73.8340°E
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
              Ambegaon – Vadgaon BK – Sinhgad Campus
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Real Pune road network featuring <strong className="text-cyan-300">Sinhgad Road</strong>, <strong className="text-amber-300">NH 48 Bypass (Navale Bridge)</strong>, <strong className="text-emerald-300">SCOE & SKN Hospital</strong>, and real-time dynamic traffic rerouting.
            </p>
          </div>

          {/* Quick Metrics / Status */}
          <div className="flex items-center gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800 backdrop-blur-md">
            <div className="text-center px-3 border-r border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase font-mono">Depot Hub</p>
              <p className="text-xs font-bold text-emerald-400">Sinhgad Gate</p>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase font-mono">Active Stops</p>
              <p className="text-xs font-bold text-white">{city?.deliveries.length || 0}</p>
            </div>
            <div className="text-center px-3">
              <p className="text-[10px] text-slate-400 uppercase font-mono">Road Segments</p>
              <p className="text-xs font-bold text-cyan-400">{city?.edges.length || 0}</p>
            </div>
          </div>
        </div>

        {/* Real Pune Landmark Chips */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">Key Landmarks:</span>
          {(city?.landmarks || []).slice(0, 7).map((lm) => (
            <span
              key={lm.id}
              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/60 font-medium flex items-center gap-1"
            >
              <Building2 size={10} className="text-cyan-400" />
              {lm.name}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Control Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Deliveries Count */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Deliveries: <span className="text-cyan-400 font-bold">{numDeliveries}</span>
            </label>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={numDeliveries}
              onChange={(e) => setNumDeliveries(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Fleet Size */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Delivery Fleet: <span className="text-emerald-400 font-bold">{numRiders} Vans</span>
            </label>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={numRiders}
              onChange={(e) => setNumRiders(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Vehicle Capacity */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Capacity: <span className="text-indigo-400 font-bold">{riderCapacity} pkgs</span>
            </label>
            <input
              type="range"
              min="4"
              max="15"
              step="1"
              value={riderCapacity}
              onChange={(e) => setRiderCapacity(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Action: Generate Stops */}
          <div>
            <button
              onClick={handleGenerateProblem}
              disabled={isLoading || isOptimizing}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all border border-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Redistribute Stops</span>
            </button>
          </div>

          {/* Action: Run Dual Optimization */}
          <div>
            <button
              onClick={handleRunOptimization}
              disabled={isLoading || isOptimizing || isReoptimizing}
              className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Zap size={14} className={isOptimizing ? 'animate-bounce' : ''} />
              <span>{isOptimizing ? 'Optimizing...' : '⚡ Optimize Pune Routes'}</span>
            </button>
          </div>
        </div>

        {/* Secondary Dynamic Controls: Traffic Simulation & Reoptimization */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateTraffic}
              disabled={isSimulatingTraffic || isOptimizing}
              className="py-1.5 px-3 bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Flame size={13} className="text-rose-400" />
              <span>🚨 Inject Choke (Navale Bridge / Vadgaon Phata)</span>
            </button>

            <button
              onClick={handleReoptimize}
              disabled={isReoptimizing || isOptimizing}
              className="py-1.5 px-3 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Activity size={13} className="text-cyan-400" />
              <span>🔄 Warm Dynamic Re-Routing</span>
            </button>
          </div>

          {/* Active Incident Counter */}
          {activeIncidents.length > 0 && (
            <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/80 px-3 py-1 rounded-lg">
              <AlertTriangle size={13} className="text-rose-400 animate-bounce" />
              <span className="text-xs text-rose-300 font-medium">
                {activeIncidents.length} active Pune choke point(s) disrupting transit
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Comparison Metrics Header Banner */}
      {comparison && (
        <div className={`p-4 rounded-xl border transition-all ${
          comparison.winner === 'QPSO'
            ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/40'
            : comparison.winner === 'PSO'
            ? 'bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-950/40'
            : 'bg-slate-900 border-slate-700'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-base shadow-md ${
                comparison.winner === 'QPSO'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-400 text-slate-950'
                  : comparison.winner === 'PSO'
                  ? 'bg-gradient-to-br from-indigo-500 to-blue-400 text-white'
                  : 'bg-slate-700 text-white'
              }`}>
                🏆
              </div>
              <div>
                <h4 className="font-heading font-bold text-base text-white flex items-center gap-2">
                  <span>{comparison.winner === 'QPSO' ? 'Quantum-Inspired QPSO' : comparison.winner === 'PSO' ? 'Classical PSO' : 'Optimal Tie'} Leader</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-white/10 text-white">
                    {Math.abs(comparison.cost_diff_pct)}% Difference
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  {comparison.winner_reason || 'Evaluated across authentic Sinhgad/Ambegaon transit corridors.'}
                </p>
              </div>
            </div>

            {/* Side-by-Side Quick Summary Stats */}
            <div className="flex items-center gap-4 bg-slate-950/70 px-4 py-2 rounded-xl border border-slate-800 font-mono text-xs">
              <div>
                <span className="text-emerald-400 font-bold block">QPSO Cost</span>
                <span className="text-white text-sm font-extrabold">{qpsoResult?.final_cost.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 block">{qpsoResult?.execution_time_ms}ms</span>
              </div>
              <div className="h-7 w-px bg-slate-800" />
              <div>
                <span className="text-indigo-400 font-bold block">PSO Cost</span>
                <span className="text-white text-sm font-extrabold">{psoResult?.final_cost.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 block">{psoResult?.execution_time_ms}ms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Dual Map Visualizer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[620px]">
        {/* Left Map: Quantum-Inspired QPSO */}
        <div className="h-full">
          <PuneRouteMap
            city={city}
            riderRoutes={qpsoResult?.solution.rider_routes}
            title="Quantum-Inspired QPSO Routing (Pune)"
            theme="qpso"
            animProgress={animProgress}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(prev => !prev)}
            onResetAnim={() => setAnimProgress(0)}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={setPlaybackSpeed}
          />
        </div>

        {/* Right Map: Classical PSO */}
        <div className="h-full">
          <PuneRouteMap
            city={city}
            riderRoutes={psoResult?.solution.rider_routes}
            title="Classical PSO Routing (Pune)"
            theme="pso"
            animProgress={animProgress}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(prev => !prev)}
            onResetAnim={() => setAnimProgress(0)}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={setPlaybackSpeed}
          />
        </div>
      </div>

      {/* 5. Fleet Vehicle Route Colors & Metrics Legend */}
      {(qpsoResult || psoResult) && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="font-heading font-bold text-xs text-slate-300 flex items-center gap-2 uppercase tracking-wider">
              <Truck size={14} className="text-cyan-400" />
              <span>Fleet Vehicle Color Routing Breakdown</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-500">Color-coded route sectors</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: numRiders }).map((_, rIdx) => {
              const color = getRiderColor(rIdx);
              const qpsoRoute = qpsoResult?.solution.rider_routes[rIdx];
              const psoRoute = psoResult?.solution.rider_routes[rIdx];

              return (
                <div
                  key={`rider-legend-${rIdx}`}
                  className="bg-slate-950/80 border rounded-xl p-2.5 flex flex-col justify-between transition-all hover:border-slate-600"
                  style={{ borderColor: `${color.stroke}40` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-3.5 h-3.5 rounded-md shadow-sm flex items-center justify-center text-[9px] font-black text-white"
                      style={{ backgroundColor: color.stroke, boxShadow: `0 0 8px ${color.glow}` }}
                    >
                      {rIdx + 1}
                    </div>
                    <span className="font-bold text-xs text-white">Vehicle {rIdx + 1}</span>
                  </div>

                  <div className="space-y-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Stops:</span>
                      <span className="font-bold text-slate-200">
                        {qpsoRoute?.delivery_count || psoRoute?.delivery_count || 0} pkgs
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Dist:</span>
                      <span className="font-bold text-cyan-300">
                        {(qpsoRoute?.route_dist_km || psoRoute?.route_dist_km || 0).toFixed(1)} km
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Time:</span>
                      <span className="font-bold text-emerald-300">
                        {(qpsoRoute?.route_time_min || psoRoute?.route_time_min || 0).toFixed(1)} min
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Incident & Optimization Live Audit Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-heading font-bold text-sm text-slate-200 flex items-center gap-2">
            <Activity size={15} className="text-cyan-400" />
            <span>Pune Road Traffic & Quantum Dispatch Live Event Log</span>
          </h4>
          <span className="text-[10px] font-mono text-slate-500">Auto-updating telemetry</span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                log.type === 'traffic'
                  ? 'bg-rose-950/30 border-rose-900/60 text-rose-200'
                  : log.type === 'qpso'
                  ? 'bg-emerald-950/30 border-emerald-900/60 text-emerald-200'
                  : log.type === 'pso'
                  ? 'bg-indigo-950/30 border-indigo-900/60 text-indigo-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300'
              }`}
            >
              <div className="mt-0.5">
                {log.type === 'traffic' && <AlertTriangle size={13} className="text-rose-400" />}
                {log.type === 'qpso' && <Zap size={13} className="text-emerald-400" />}
                {log.type === 'pso' && <Clock size={13} className="text-indigo-400" />}
                {log.type === 'success' && <CheckCircle2 size={13} className="text-emerald-400" />}
                {log.type === 'info' && <MapPin size={13} className="text-cyan-400" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{log.title}</span>
                  <span className="font-mono text-[10px] text-slate-500">{log.timestamp}</span>
                </div>
                <p className="mt-0.5 text-slate-400 leading-snug">{log.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
