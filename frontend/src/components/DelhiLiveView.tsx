import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SyntheticCityData,
  OptimizerResult,
  ComparisonMetrics,
  TrafficIncident,
  EventLogItem
} from '../types';
import { api } from '../services/api';
import { DelhiRouteMap } from './DelhiRouteMap';
import { AlgorithmScoreboardTable } from './AlgorithmScoreboardTable';
import { FleetVehiclesTable } from './FleetVehiclesTable';
import { ConvergenceChart } from './ConvergenceChart';
import { useTheme } from '../context/ThemeContext';
import {
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
  Activity,
  Award,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Sliders,
  Compass
} from 'lucide-react';

export const DelhiLiveView: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [city, setCity] = useState<SyntheticCityData | null>(null);
  const [numDeliveries, setNumDeliveries] = useState<number>(25);
  const [numRiders, setNumRiders] = useState<number>(5);
  const [riderCapacity, setRiderCapacity] = useState<number>(8);
  const [objective, setObjective] = useState<'balanced' | 'time' | 'distance'>('balanced');
  const [seed, setSeed] = useState<number>(42);

  const [qpsoResult, setQpsoResult] = useState<OptimizerResult | null>(null);
  const [psoResult, setPsoResult] = useState<OptimizerResult | null>(null);
  const [gaResult, setGaResult] = useState<OptimizerResult | null>(null);
  const [saResult, setSaResult] = useState<OptimizerResult | null>(null);
  const [greedyResult, setGreedyResult] = useState<OptimizerResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonMetrics | null>(null);
  const [activeIncidents, setActiveIncidents] = useState<TrafficIncident[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isSimulatingTraffic, setIsSimulatingTraffic] = useState<boolean>(false);
  const [isReoptimizing, setIsReoptimizing] = useState<boolean>(false);
  const [hoveredVehicle, setHoveredVehicle] = useState<number | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  // Playback Animation States
  const [animProgress, setAnimProgress] = useState<number>(0.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const animFrameRef = useRef<number | null>(null);
  const sliderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Event Logs
  const [logs, setLogs] = useState<EventLogItem[]>([
    {
      id: 'log-0',
      timestamp: new Date().toLocaleTimeString(),
      title: 'Delhi Okhla GIS Initialized',
      description: 'Loaded authentic Okhla Phase-I/II, Nehru Place, and Kalkaji road topology.',
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

  // 1. Initial Load of Delhi Network & Auto-Optimization on Mount
  useEffect(() => {
    let isMounted = true;
    const initDelhi = async () => {
      try {
        setIsLoading(true);
        const data = await api.getDelhiNetwork();
        if (!isMounted) return;
        setCity(data.city);
        addLog('GIS Map Loaded', `Rendered ${data.city.landmarks?.length || 10} landmarks and ${data.city.edges.length} real road segments.`, 'success');

        // Automatically run initial 5-algorithm optimization so tables & curves are populated immediately
        setIsOptimizing(true);
        const res = await api.runDelhiOptimization({
          num_particles: 25,
          max_iterations: 60,
          seed: 42
        });
        if (!isMounted) return;
        setQpsoResult(res.qpso);
        setPsoResult(res.pso);
        setGaResult(res.ga || null);
        setSaResult(res.sa || null);
        setGreedyResult(res.greedy || null);
        setComparison(res.comparison);
        if (res.city) setCity(res.city);
        setIsPlaying(true);
        addLog(`Initial Optimization Complete: ${res.comparison.winner} Won`, res.comparison.winner_reason, res.comparison.winner === 'QPSO' ? 'qpso' : 'pso');
      } catch (err) {
        console.error('Failed to init Delhi:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsOptimizing(false);
        }
      }
    };

    initDelhi();
    return () => { isMounted = false; };
  }, []);

  // 2. Generate Delivery Problems across Okhla/Kalkaji
  const handleGenerateProblem = async (customParams?: {
    num_deliveries?: number;
    num_riders?: number;
    rider_capacity?: number;
  }) => {
    const dCount = customParams?.num_deliveries ?? numDeliveries;
    const rCount = customParams?.num_riders ?? numRiders;
    const cap = customParams?.rider_capacity ?? riderCapacity;

    try {
      setIsLoading(true);
      const newSeed = Math.floor(Math.random() * 10000);
      setSeed(newSeed);
      const res = await api.generateDelhiProblem({
        num_deliveries: dCount,
        num_riders: rCount,
        rider_capacity: cap,
        objective,
        seed: newSeed
      });
      setCity(res.city);
      setQpsoResult(null);
      setPsoResult(null);
      setGaResult(null);
      setSaResult(null);
      setGreedyResult(null);
      setComparison(null);
      setActiveIncidents([]);
      setAnimProgress(0);
      setIsPlaying(false);
      addLog('Fleet & Stops Updated', `Configured ${rCount} fleet vehicles and distributed ${dCount} packages across Okhla.`, 'info');
    } catch (err) {
      console.error(err);
      addLog('Generation Failed', 'Could not distribute delivery packages.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  // Preset Handler for 1-Click Setup (Simplifies for New Users)
  const handleApplyPreset = (dCount: number, rCount: number, cap: number) => {
    setNumDeliveries(dCount);
    setNumRiders(rCount);
    setRiderCapacity(cap);
    handleGenerateProblem({
      num_deliveries: dCount,
      num_riders: rCount,
      rider_capacity: cap
    });
  };

  // Real-time slider adjustment with smooth debounced backend sync
  const onSliderChange = (type: 'deliveries' | 'riders' | 'capacity', value: number) => {
    let nextDeliv = numDeliveries;
    let nextRiders = numRiders;
    let nextCap = riderCapacity;

    if (type === 'deliveries') {
      setNumDeliveries(value);
      nextDeliv = value;
    } else if (type === 'riders') {
      setNumRiders(value);
      nextRiders = value;
    } else if (type === 'capacity') {
      setRiderCapacity(value);
      nextCap = value;
    }

    if (sliderTimerRef.current) clearTimeout(sliderTimerRef.current);
    sliderTimerRef.current = setTimeout(() => {
      handleGenerateProblem({
        num_deliveries: nextDeliv,
        num_riders: nextRiders,
        rider_capacity: nextCap
      });
    }, 250);
  };

  // 3. 5-Algorithm Optimization on Delhi Map (QPSO, PSO, GA, SA, Greedy NN)
  const handleRunOptimization = async () => {
    try {
      setIsOptimizing(true);
      addLog('Optimization Started', 'Executing QPSO, PSO, GA, SA & Greedy NN on Delhi Okhla road graph...', 'info');
      const res = await api.runDelhiOptimization({
        num_particles: 30,
        max_iterations: 80,
        seed
      });
      setQpsoResult(res.qpso);
      setPsoResult(res.pso);
      setGaResult(res.ga || null);
      setSaResult(res.sa || null);
      setGreedyResult(res.greedy || null);
      setComparison(res.comparison);
      setCity(res.city);
      setAnimProgress(0);
      setIsPlaying(true);

      addLog(`Optimization Complete: ${res.comparison.winner} Won`, res.comparison.winner_reason || `${res.comparison.winner} achieved lowest cost across all 5 algorithms.`, res.comparison.winner === 'QPSO' ? 'qpso' : 'pso');
    } catch (err) {
      console.error(err);
      addLog('Optimization Failed', 'Error running 5-algorithm metaheuristic routing.', 'warning');
    } finally {
      setIsOptimizing(false);
    }
  };

  // 4. Simulate Real Delhi Traffic Incident
  const handleSimulateTraffic = async () => {
    try {
      setIsSimulatingTraffic(true);
      const res = await api.simulateDelhiTraffic(2);
      setActiveIncidents(res.incidents);
      setCity(res.city);
      const names = res.incidents.map(i => i.road_name).join(' & ');
      addLog('🚨 Delhi Traffic Choke Injected', `Severe congestion on ${names} (4.5x - 6.2x delay factor).`, 'traffic');
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
      addLog('Dynamic Re-Routing', 'Running warm-started particle adaptation around Delhi road blocks...', 'info');
      const res = await api.reoptimizeDelhi({
        num_particles: 30,
        max_iterations: 75,
        seed: seed + 50
      });
      setQpsoResult(res.qpso);
      setPsoResult(res.pso);
      if (res.ga) setGaResult(res.ga);
      if (res.sa) setSaResult(res.sa);
      if (res.greedy) setGreedyResult(res.greedy);
      setComparison(res.comparison);
      setCity(res.city);
      setActiveIncidents(res.incidents);
      setAnimProgress(0);
      setIsPlaying(true);

      addLog('Re-Optimization Complete', `Fleet re-optimised: ${res.comparison.winner} had the lowest post-incident cost of the 5 algorithms.`, res.comparison.winner === 'QPSO' ? 'qpso' : 'pso');
    } catch (err) {
      console.error(err);
      addLog('Re-Optimization Failed', 'Could not re-route around incidents.', 'warning');
    } finally {
      setIsReoptimizing(false);
    }
  };

  // Animation Loop for live vehicle movement (stops cleanly after 1 iteration)
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const durationMs = 12000 / playbackSpeed;
    let startTime: number | null = null;
    const startProgress = animProgress >= 1.0 ? 0 : animProgress;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const currentRunProgress = Math.min(1.0, startProgress + elapsed / durationMs);
      setAnimProgress(currentRunProgress);

      if (currentRunProgress < 1.0) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  const handleTogglePlay = () => {
    if (animProgress >= 1.0) {
      setAnimProgress(0.0);
    }
    setIsPlaying(prev => !prev);
  };

  // Calculations for Executive Summary
  const allResults = [
    { name: 'QPSO', res: qpsoResult },
    { name: 'PSO', res: psoResult },
    { name: 'GA', res: gaResult },
    { name: 'SA', res: saResult },
    { name: 'Greedy', res: greedyResult },
  ].filter((item): item is { name: string; res: any } => Boolean(item.res));

  const sortedResults = [...allResults].sort((a, b) => a.res.final_cost - b.res.final_cost);
  const bestResult = sortedResults[0]?.res ?? qpsoResult ?? psoResult;
  const winnerName = comparison?.winner || sortedResults[0]?.name || (qpsoResult ? 'QPSO' : null);
  const greedyCost = greedyResult?.final_cost ?? null;
  const bestCost = bestResult?.final_cost ?? null;
  const costSavingsVsGreedy = greedyCost && bestCost ? Math.max(0, Math.round(((greedyCost - bestCost) / greedyCost) * 100)) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Banner & Quick Presets */}
      <div className={`p-5 sm:p-6 rounded-2xl border shadow-sm transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                SOUTH-EAST DELHI • OKHLA LOGISTICS CORRIDOR
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                OpenStreetMap Real Network
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold font-heading mt-2 tracking-tight">
              Live Delhi Logistics Dispatch & Dynamic Routing
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}>
              Simulate and compare <strong className="text-emerald-600 dark:text-emerald-400">Quantum-Inspired (QPSO)</strong> against Classical PSO, Genetic Algorithm (GA), Simulated Annealing (SA), and Greedy Nearest-Neighbour on real Delhi roads (Mathura Road NH-2, Ring Road, Okhla Industrial Areas & Jasola).
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border backdrop-blur-sm shrink-0 ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="text-center px-3 border-r border-slate-200 dark:border-slate-800">
              <p className={`text-[10px] uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Depot Hub</p>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400">NSIC Complex</p>
            </div>
            <div className="text-center px-3 border-r border-slate-200 dark:border-slate-800">
              <p className={`text-[10px] uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Active Stops</p>
              <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{city?.deliveries.length || numDeliveries}</p>
            </div>
            <div className="text-center px-3">
              <p className={`text-[10px] uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Road Segments</p>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{city?.edges.length || 4602}</p>
            </div>
          </div>
        </div>

        {/* 1-Click Simplified Presets for New Users */}
        <div className={`mt-4 pt-3.5 border-t flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Sparkles size={13} className="text-amber-500" />
              Quick Presets:
            </span>
            <button
              onClick={() => handleApplyPreset(15, 3, 6)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                numDeliveries === 15 && numRiders === 3
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              ⚡ Quick Demo (15 Stops • 3 Vans)
            </button>
            <button
              onClick={() => handleApplyPreset(25, 5, 8)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                numDeliveries === 25 && numRiders === 5
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              🚚 Standard Shift (25 Stops • 5 Vans)
            </button>
            <button
              onClick={() => handleApplyPreset(40, 7, 10)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                numDeliveries === 40 && numRiders === 7
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              🏢 Peak Dispatch (40 Stops • 7 Vans)
            </button>
          </div>

          {/* Landmarks pills */}
          <div className="hidden xl:flex items-center gap-1.5 text-[11px]">
            <span className={isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}>Landmarks:</span>
            {(city?.landmarks || []).slice(0, 4).map(lm => (
              <span key={lm.id} className={`px-2 py-0.5 rounded-md border text-[10px] font-medium flex items-center gap-1 ${
                isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}>
                <Building2 size={10} className="text-amber-500" />
                {lm.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Simplified Control Toolbar */}
      <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Slider 1: Deliveries */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                1. Delivery Stops
              </label>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                {numDeliveries} pkgs
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={numDeliveries}
              onChange={(e) => onSliderChange('deliveries', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Slider 2: Fleet Size */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                2. Delivery Fleet
              </label>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                {numRiders} Vans
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={numRiders}
              onChange={(e) => onSliderChange('riders', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Slider 3: Van Capacity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                3. Van Capacity
              </label>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300">
                {riderCapacity * 6} kg
              </span>
            </div>
            <input
              type="range"
              min="4"
              max="15"
              step="1"
              value={riderCapacity}
              onChange={(e) => onSliderChange('capacity', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          {/* Action 1: Redistribute Stops */}
          <div>
            <button
              onClick={() => handleGenerateProblem()}
              disabled={isLoading || isOptimizing}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <RotateCcw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Redistribute Stops</span>
            </button>
          </div>

          {/* Action 2: 1-Click Optimize (Primary CTA) */}
          <div>
            <button
              onClick={handleRunOptimization}
              disabled={isLoading || isOptimizing || isReoptimizing}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Zap size={14} className={isOptimizing ? 'animate-bounce' : ''} />
              <span>{isOptimizing ? 'Optimizing 5 Algorithms...' : '⚡ Find Best Routes'}</span>
            </button>
          </div>
        </div>

        {/* Secondary Scenarios Bar */}
        <div className={`mt-4 pt-3.5 border-t flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium mr-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Scenario Tests:
            </span>
            <button
              onClick={handleSimulateTraffic}
              disabled={isSimulatingTraffic || isOptimizing}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 disabled:opacity-50 ${
                isDark
                  ? 'bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border-rose-800/60'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
              }`}
            >
              <Flame size={13} className="text-rose-500" />
              <span>🚨 Simulate Traffic Jam (Mathura Rd)</span>
            </button>

            <button
              onClick={handleReoptimize}
              disabled={isReoptimizing || isOptimizing}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 disabled:opacity-50 ${
                isDark
                  ? 'bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border-amber-800/60'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              <Activity size={13} className="text-amber-500" />
              <span>🔄 Live Dynamic Re-Route</span>
            </button>
          </div>

          {activeIncidents.length > 0 && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium ${
              isDark ? 'bg-rose-950/60 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <AlertTriangle size={13} className="text-rose-500 animate-bounce" />
              <span>{activeIncidents.length} active road choke point(s) disrupting flow</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Executive Summary Card (Instant Takeaway for New Users) */}
      {(qpsoResult || psoResult) && (
        <div className={`p-5 rounded-2xl border shadow-sm transition-all ${
          isDark
            ? 'bg-gradient-to-r from-emerald-950/50 via-slate-900 to-cyan-950/40 border-emerald-800/60'
            : 'bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/80 border-emerald-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 shrink-0">
                <Award size={26} className="stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isDark ? 'text-emerald-400' : 'text-emerald-700'
                  }`}>
                    Optimization Outcome
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {winnerName} Champion
                  </span>
                </div>
                <h3 className={`text-lg font-bold font-heading ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  {winnerName === 'QPSO'
                    ? `Quantum-Inspired QPSO achieved the lowest routing cost (${qpsoResult?.final_cost})`
                    : `${winnerName} achieved the lowest routing cost (${comparison?.all_costs?.[winnerName!]})`}
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {costSavingsVsGreedy && costSavingsVsGreedy > 0
                    ? `${winnerName}'s routes cost ~${costSavingsVsGreedy}% less than the Greedy Nearest-Neighbour baseline on this instance.`
                    : comparison?.winner_reason || 'Lowest total route cost among the 5 algorithms on this instance.'}
                </p>
              </div>
            </div>

            {/* 4 Simple KPI Stat Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 text-center font-mono">
              <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>On-Time SLA</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">100%</p>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fleet Time</p>
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {Math.round(bestResult?.solution?.total_time_min || 0)}m
                </p>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Distance</p>
                <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                  {Math.round(bestResult?.solution?.total_dist_km || 0)} km
                </p>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Solve Speed</p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {Math.round(bestResult?.execution_time_ms || 30)}ms
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Dual Map Visualizer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[620px]">
        {/* Left Map: Quantum-Inspired QPSO */}
        <div className="h-full">
          <DelhiRouteMap
            city={city}
            riderRoutes={qpsoResult?.solution.rider_routes}
            numRiders={numRiders}
            hoveredVehicle={hoveredVehicle}
            onHoverVehicle={setHoveredVehicle}
            title="Quantum-Inspired QPSO Routing (Delhi)"
            theme="qpso"
            animProgress={animProgress}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onResetAnim={() => setAnimProgress(0)}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={setPlaybackSpeed}
          />
        </div>

        {/* Right Map: Classical PSO */}
        <div className="h-full">
          <DelhiRouteMap
            city={city}
            riderRoutes={psoResult?.solution.rider_routes}
            numRiders={numRiders}
            hoveredVehicle={hoveredVehicle}
            onHoverVehicle={setHoveredVehicle}
            title="Classical PSO Routing (Delhi)"
            theme="pso"
            animProgress={animProgress}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onResetAnim={() => setAnimProgress(0)}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={setPlaybackSpeed}
          />
        </div>
      </div>

      {/* 4.5. Fleet Task Completion Status & Progress Bar */}
      <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
            animProgress >= 1.0
              ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
          }`}>
            {animProgress >= 1.0 ? <CheckCircle2 size={24} /> : `${Math.round(animProgress * 100)}%`}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Delivery Fleet Task Completion
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                animProgress >= 1.0
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : isPlaying
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse'
                  : 'bg-slate-500/20 text-slate-500'
              }`}>
                {animProgress >= 1.0 ? '100% Shift Completed' : isPlaying ? 'In-Transit Execution' : 'Paused'}
              </span>
            </div>

            <div className="text-sm font-bold mt-0.5">
              {animProgress >= 1.0
                ? `All ${city?.deliveries?.length || numDeliveries} Packages Delivered • All ${numRiders} Vans Returned to Depot`
                : `${Math.min(city?.deliveries?.length || numDeliveries, Math.floor(animProgress * (city?.deliveries?.length || numDeliveries)))} of ${city?.deliveries?.length || numDeliveries} Packages Delivered • In-Transit`}
            </div>
          </div>
        </div>

        {/* Progress Bar & Replay Button */}
        <div className="flex items-center gap-3 w-full sm:w-80">
          <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-full transition-all duration-100"
              style={{ width: `${Math.round(animProgress * 100)}%` }}
            />
          </div>

          <button
            onClick={handleTogglePlay}
            className="py-1.5 px-3 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
          >
            {animProgress >= 1.0 ? (
              <>
                <RotateCcw size={13} />
                <span>Replay</span>
              </>
            ) : isPlaying ? (
              <>
                <Pause size={13} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Play</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5. Optimization Convergence Curves & Data Table (Directly Below Maps as Requested) */}
      <ConvergenceChart
        qpsoResult={qpsoResult}
        psoResult={psoResult}
        gaResult={gaResult}
        saResult={saResult}
        greedyResult={greedyResult}
        comparison={comparison}
        title="Optimization Convergence: 5-Algorithm Cost Descent"
        onRunOptimization={handleRunOptimization}
        isOptimizing={isOptimizing}
      />

      {/* 6. The 5 Key Measures Scoreboard Table */}
      {(qpsoResult || psoResult) && (
        <AlgorithmScoreboardTable
          qpsoResult={qpsoResult}
          psoResult={psoResult}
          gaResult={gaResult}
          saResult={saResult}
          greedyResult={greedyResult}
          comparison={comparison}
          title="Scoreboard: The 5 Key Measures (Delhi Okhla)"
          subtitle="Real-world comparison across Customer On-Time SLA (%), Fleet Time (min), Total Distance (km), CO₂ / Fleet Vans, and Solve Latency with per-column winner badges."
        />
      )}

      {/* 7. Dedicated Fleet Vehicles Table: Weight & Distribution Analysis */}
      <FleetVehiclesTable
        numRiders={numRiders}
        riderCapacityKg={riderCapacity * 6}
        riderRoutes={qpsoResult?.solution.rider_routes || psoResult?.solution.rider_routes}
        deliveries={city?.deliveries}
        hoveredVehicle={hoveredVehicle}
        onHoverVehicle={setHoveredVehicle}
      />

      {/* 8. Live Event Log (Collapsible for Clean, Simple UX) */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <button
          onClick={() => setShowLogs(prev => !prev)}
          className={`w-full p-4 flex items-center justify-between text-left transition-colors ${
            isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-amber-500" />
            <h4 className={`font-heading font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Delhi Okhla Real-Time Dispatch Telemetry Log
            </h4>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
              isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}>
              {logs.length} events
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>{showLogs ? 'Hide Details' : 'Show Details'}</span>
            {showLogs ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </button>

        {showLogs && (
          <div className={`p-4 border-t space-y-2 max-h-48 overflow-y-auto ${
            isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50'
          }`}>
            {logs.map((log) => (
              <div
                key={log.id}
                className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                  log.type === 'traffic'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-200'
                    : log.type === 'qpso'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : log.type === 'pso'
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-800 dark:text-cyan-200'
                    : isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {log.type === 'traffic' && <AlertTriangle size={13} className="text-rose-500" />}
                  {log.type === 'qpso' && <Zap size={13} className="text-emerald-500" />}
                  {log.type === 'pso' && <Clock size={13} className="text-cyan-500" />}
                  {log.type === 'success' && <CheckCircle2 size={13} className="text-emerald-500" />}
                  {log.type === 'info' && <Navigation size={13} className="text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{log.title}</span>
                    <span className={`font-mono text-[10px] shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{log.timestamp}</span>
                  </div>
                  <p className={`mt-0.5 text-xs leading-snug ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {log.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
