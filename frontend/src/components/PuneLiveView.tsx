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
import { AlgorithmScoreboardTable } from './AlgorithmScoreboardTable';
import { getRiderColor } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
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
  Layers,
  Dna,
  Thermometer
} from 'lucide-react';

export const PuneLiveView: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [city, setCity] = useState<SyntheticCityData | null>(null);
  const [numDeliveries, setNumDeliveries] = useState<number>(25);
  const [numRiders, setNumRiders] = useState<number>(4);
  const [riderCapacity, setRiderCapacity] = useState<number>(8);
  const [objective, setObjective] = useState<'balanced' | 'time' | 'distance'>('balanced');
  const [seed, setSeed] = useState<number>(42);

  const [qpsoResult, setQpsoResult] = useState<OptimizerResult | null>(null);
  const [psoResult, setPsoResult] = useState<OptimizerResult | null>(null);
  const [gaResult, setGaResult] = useState<OptimizerResult | null>(null);
  const [saResult, setSaResult] = useState<OptimizerResult | null>(null);
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
      setGaResult(null);
      setSaResult(null);
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
      addLog('Optimization Started', 'Executing QPSO, PSO, GA & SA on Pune road graph...', 'info');
      const res = await api.runPuneOptimization({
        num_particles: 30,
        max_iterations: 80,
        seed
      });
      setQpsoResult(res.qpso);
      setPsoResult(res.pso);
      setGaResult(res.ga || null);
      setSaResult(res.sa || null);
      setComparison(res.comparison);
      setCity(res.city);
      setAnimProgress(0);
      setIsPlaying(true);

      addLog(`Optimization Complete: ${res.comparison.winner} Won`, res.comparison.winner_reason || `${res.comparison.winner} achieved lowest cost across all algorithms.`, res.comparison.winner === 'QPSO' ? 'qpso' : 'pso');
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
      if (res.ga) setGaResult(res.ga);
      if (res.sa) setSaResult(res.sa);
      setComparison(res.comparison);
      setCity(res.city);
      setActiveIncidents(res.incidents);
      setAnimProgress(0);
      setIsPlaying(true);

      addLog('Re-Optimization Complete', `Fleet re-optimised: ${res.comparison.winner} had the lowest post-incident cost.`, res.comparison.winner === 'QPSO' ? 'qpso' : 'pso');
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
      <div className={`rounded-2xl p-5 sm:p-6 relative overflow-hidden border transition-colors ${
        isDark
          ? 'bg-gradient-to-r from-slate-900 via-slate-900/90 to-[#0c1836] border-cyan-900/50 shadow-2xl'
          : 'bg-gradient-to-r from-cyan-50/80 via-white to-blue-50/70 border-cyan-200/80 shadow-md'
      }`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md shadow-cyan-500/20">
                <MapPin size={12} className="animate-pulse" />
                AUTHENTIC PUNE GIS
              </span>
              <span className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Lat 18.4635°N | Lng 73.8340°E
              </span>
            </div>
            <h1 className={`text-2xl sm:text-3xl font-heading font-extrabold tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Ambegaon – Vadgaon BK – Sinhgad Campus
            </h1>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Real Pune road network featuring <strong className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>Sinhgad Road</strong>, <strong className={isDark ? 'text-amber-300' : 'text-amber-700'}>NH 48 Bypass (Navale Bridge)</strong>, <strong className={isDark ? 'text-emerald-300' : 'text-emerald-700'}>SCOE & SKN Hospital</strong>, and real-time dynamic traffic rerouting.
            </p>
          </div>

          {/* Quick Metrics / Status */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border backdrop-blur-md transition-colors ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-white/95 border-slate-200 shadow-sm'
          }`}>
            <div className={`text-center px-3 border-r ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <p className={`text-[10px] uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Depot Hub</p>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Sinhgad Gate</p>
            </div>
            <div className={`text-center px-3 border-r ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <p className={`text-[10px] uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Active Stops</p>
              <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{city?.deliveries.length || 0}</p>
            </div>
            <div className="text-center px-3">
              <p className={`text-[10px] uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Road Segments</p>
              <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{city?.edges.length || 0}</p>
            </div>
          </div>
        </div>

        {/* Real Pune Landmark Chips */}
        <div className={`mt-4 pt-3 border-t flex flex-wrap items-center gap-2 ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Key Landmarks:</span>
          {(city?.landmarks || []).slice(0, 7).map((lm) => (
            <span
              key={lm.id}
              className={`text-[10px] px-2 py-0.5 rounded-md font-medium flex items-center gap-1 border transition-colors ${
                isDark
                  ? 'bg-slate-800/90 text-slate-300 border-slate-700/60'
                  : 'bg-white text-slate-700 border-slate-200 shadow-sm'
              }`}
            >
              <Building2 size={10} className="text-cyan-600 dark:text-cyan-400" />
              {lm.name}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Control Toolbar */}
      <div className={`border rounded-xl p-4 shadow-sm transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Deliveries Count */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Deliveries: <span className="text-cyan-600 dark:text-cyan-400 font-bold">{numDeliveries}</span>
            </label>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={numDeliveries}
              onChange={(e) => setNumDeliveries(parseInt(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-cyan-500 ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            />
          </div>

          {/* Fleet Size */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Delivery Fleet: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{numRiders} Vans</span>
            </label>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={numRiders}
              onChange={(e) => setNumRiders(parseInt(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-500 ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            />
          </div>

          {/* Vehicle Capacity */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Capacity: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{riderCapacity} pkgs</span>
            </label>
            <input
              type="range"
              min="4"
              max="15"
              step="1"
              value={riderCapacity}
              onChange={(e) => setRiderCapacity(parseInt(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-500 ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            />
          </div>

          {/* Action: Generate Stops */}
          <div>
            <button
              onClick={handleGenerateProblem}
              disabled={isLoading || isOptimizing}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm'
              }`}
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
              className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Zap size={14} className={isOptimizing ? 'animate-bounce' : ''} />
              <span>{isOptimizing ? 'Optimizing...' : '⚡ Optimize Pune Routes'}</span>
            </button>
          </div>
        </div>

        {/* Secondary Dynamic Controls: Traffic Simulation & Reoptimization */}
        <div className={`mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateTraffic}
              disabled={isSimulatingTraffic || isOptimizing}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 disabled:opacity-50 ${
                isDark
                  ? 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border-rose-800/60'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-sm'
              }`}
            >
              <Flame size={13} className={isDark ? 'text-rose-400' : 'text-rose-600'} />
              <span>🚨 Inject Choke (Navale Bridge / Vadgaon Phata)</span>
            </button>

            <button
              onClick={handleReoptimize}
              disabled={isReoptimizing || isOptimizing}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 disabled:opacity-50 ${
                isDark
                  ? 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border-cyan-800/60'
                  : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-200 shadow-sm'
              }`}
            >
              <Activity size={13} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
              <span>🔄 Warm Dynamic Re-Routing</span>
            </button>
          </div>

          {/* Active Incident Counter */}
          {activeIncidents.length > 0 && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${
              isDark ? 'bg-rose-950/60 border-rose-800/80 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <AlertTriangle size={13} className="text-rose-500 animate-bounce" />
              <span className="text-xs font-semibold">
                {activeIncidents.length} active Pune choke point(s) disrupting transit
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. The 5 Key Measures Scoreboard Table */}
      {(qpsoResult || psoResult) && (
        <AlgorithmScoreboardTable
          qpsoResult={qpsoResult}
          psoResult={psoResult}
          gaResult={gaResult}
          saResult={saResult}
          comparison={comparison}
          title="Scoreboard: The 5 Key Measures (Pune Ambegaon)"
          subtitle="Real-world benchmark across On-Time Deliveries (%), Fleet Time (min), Distance (km), CO₂ / Vans Used, and Solve Latency with per-column winner highlights."
        />
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
        <div className={`border rounded-xl p-4 shadow-sm transition-colors ${
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <h4 className={`font-heading font-bold text-xs flex items-center gap-2 uppercase tracking-wider ${
              isDark ? 'text-slate-300' : 'text-slate-800'
            }`}>
              <Truck size={14} className="text-cyan-500" />
              <span>Fleet Vehicle Color Routing Breakdown</span>
            </h4>
            <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Color-coded route sectors</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: numRiders }).map((_, rIdx) => {
              const color = getRiderColor(rIdx);
              const qpsoRoute = qpsoResult?.solution.rider_routes[rIdx];
              const psoRoute = psoResult?.solution.rider_routes[rIdx];

              return (
                <div
                  key={`rider-legend-${rIdx}`}
                  className={`border rounded-xl p-2.5 flex flex-col justify-between transition-all ${
                    isDark ? 'bg-slate-950/80 hover:border-slate-600' : 'bg-slate-50/80 hover:border-slate-400 shadow-sm'
                  }`}
                  style={{ borderColor: `${color.stroke}60` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-3.5 h-3.5 rounded-md shadow-sm flex items-center justify-center text-[9px] font-black text-white"
                      style={{ backgroundColor: color.stroke, boxShadow: `0 0 8px ${color.glow}` }}
                    >
                      {rIdx + 1}
                    </div>
                    <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>Vehicle {rIdx + 1}</span>
                  </div>

                  <div className="space-y-1 text-[11px] font-mono">
                    <div className={`flex items-center justify-between ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <span>Stops:</span>
                      <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                        {qpsoRoute?.delivery_count || psoRoute?.delivery_count || 0} pkgs
                      </span>
                    </div>
                    <div className={`flex items-center justify-between ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <span>Dist:</span>
                      <span className="font-bold text-cyan-600 dark:text-cyan-300">
                        {(qpsoRoute?.route_dist_km || psoRoute?.route_dist_km || 0).toFixed(1)} km
                      </span>
                    </div>
                    <div className={`flex items-center justify-between ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <span>Time:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-300">
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
      <div className={`border rounded-xl p-4 shadow-sm transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`font-heading font-bold text-sm flex items-center gap-2 ${
            isDark ? 'text-slate-200' : 'text-slate-900'
          }`}>
            <Activity size={15} className="text-cyan-500" />
            <span>Pune Road Traffic & Quantum Dispatch Live Event Log</span>
          </h4>
          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Auto-updating telemetry</span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                log.type === 'traffic'
                  ? isDark ? 'bg-rose-950/30 border-rose-900/60 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800'
                  : log.type === 'qpso'
                  ? isDark ? 'bg-emerald-950/30 border-emerald-900/60 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : log.type === 'pso'
                  ? isDark ? 'bg-indigo-950/30 border-indigo-900/60 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                  : isDark ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="mt-0.5">
                {log.type === 'traffic' && <AlertTriangle size={13} className="text-rose-500" />}
                {log.type === 'qpso' && <Zap size={13} className="text-emerald-500" />}
                {log.type === 'pso' && <Clock size={13} className="text-indigo-500" />}
                {log.type === 'success' && <CheckCircle2 size={13} className="text-emerald-500" />}
                {log.type === 'info' && <MapPin size={13} className="text-cyan-500" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{log.title}</span>
                  <span className={`font-mono text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{log.timestamp}</span>
                </div>
                <p className={`mt-0.5 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{log.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
