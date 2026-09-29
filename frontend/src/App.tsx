import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SetupPanel } from './components/SetupPanel';
import { SideBySideComparison } from './components/SideBySideComparison';
import { ConvergenceChart } from './components/ConvergenceChart';
import { TrafficAlertBanner } from './components/TrafficAlertBanner';
import { EventLog } from './components/EventLog';
import { BenchmarkView } from './components/BenchmarkView';
import { AboutView } from './components/AboutView';
import { PuneLiveView } from './components/PuneLiveView';
import { DelhiLiveView } from './components/DelhiLiveView';
import { HomePage } from './components/HomePage';
import { DemoGuideModal } from './components/DemoGuideModal';
import { api } from './services/api';
import {
  SyntheticCityData,
  OptimizerResult,
  ComparisonMetrics,
  TrafficIncident,
  EventLogItem,
  BenchmarkResponse
} from './types';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Play, Sparkles, AlertCircle } from 'lucide-react';

const MainApp: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  // Navigation: Default to Home Page
  const [activeTab, setActiveTab] = useState<'home' | 'delhi-map' | 'live-map' | 'benchmark' | 'about'>('home');
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Setup Parameters
  const [numDeliveries, setNumDeliveries] = useState<number>(50);
  const [numRiders, setNumRiders] = useState<number>(5);
  const [riderCapacity, setRiderCapacity] = useState<number>(10);
  const [objective, setObjective] = useState<'time' | 'distance' | 'balanced'>('balanced');
  const [seed, setSeed] = useState<number>(42);

  // State
  const [city, setCity] = useState<SyntheticCityData | null>(null);
  const [qpsoResult, setQpsoResult] = useState<OptimizerResult | null>(null);
  const [psoResult, setPsoResult] = useState<OptimizerResult | null>(null);
  const [gaResult, setGaResult] = useState<OptimizerResult | null>(null);
  const [saResult, setSaResult] = useState<OptimizerResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonMetrics | null>(null);
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResponse | null>(null);

  // Loading States
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasOptimized, setHasOptimized] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Animation State
  const [animProgress, setAnimProgress] = useState<number>(0.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Event Log
  const [logs, setLogs] = useState<EventLogItem[]>([]);

  const addLog = useCallback((title: string, description: string, type: EventLogItem['type'] = 'info') => {
    const timeStr = new Date().toLocaleTimeString();
    const item: EventLogItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
      title,
      description,
      type,
    };
    setLogs((prev) => [item, ...prev]);
  }, []);

  // Check health on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        await api.checkHealth();
        setIsBackendConnected(true);
        addLog('Backend Connected', 'FastAPI service online on localhost:8000', 'success');
      } catch (err: any) {
        console.error('Initialization error:', err);
        setIsBackendConnected(false);
        addLog('Connection Warning', 'FastAPI backend not detected at localhost:8000. Ensure python main.py is running.', 'traffic');
      }
    };

    initApp();
  }, [addLog]);

  // Smooth Animation Loop using requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const durationSeconds = 12.0; // standard full route traversal duration at 1x

    const step = (now: number) => {
      if (lastTimeRef.current !== null) {
        const dt = (now - lastTimeRef.current) / 1000.0;
        setAnimProgress((prev) => {
          const next = prev + (dt * playbackSpeed) / durationSeconds;
          if (next >= 1.0) {
            setIsPlaying(false);
            return 1.0;
          }
          return next;
        });
      }
      lastTimeRef.current = now;
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Handle Problem Generation
  const handleGenerateProblem = async (
    targetDeliveries?: number,
    targetRiders?: number,
    targetCapacity?: number,
    targetSeed?: number
  ) => {
    try {
      setIsOptimizing(true);
      const delivs = targetDeliveries ?? numDeliveries;
      const riders = targetRiders ?? numRiders;
      const cap = targetCapacity ?? riderCapacity;
      const activeSeed = targetSeed ?? (Math.floor(Math.random() * 1000) + 1);

      if (targetDeliveries) setNumDeliveries(targetDeliveries);
      if (targetRiders) setNumRiders(targetRiders);
      if (targetCapacity) setRiderCapacity(targetCapacity);
      setSeed(activeSeed);

      const res = await api.generateProblem({
        num_deliveries: delivs,
        num_riders: riders,
        rider_capacity: cap,
        objective,
        seed: activeSeed,
      });
      setCity(res.city);
      setQpsoResult(null);
      setPsoResult(null);
      setGaResult(null);
      setSaResult(null);
      setComparison(null);
      setIncidents([]);
      setHasOptimized(false);
      setAnimProgress(0.0);
      setIsPlaying(false);
      addLog('Problem Initialized', `Loaded ${delivs} deliveries across ${riders} riders (Seed: ${activeSeed})`, 'info');
    } catch (err: any) {
      console.error(err);
      addLog('Generation Failed', err.message || 'Error generating problem', 'traffic');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSelectPreset = (p: { deliveries: number; riders: number; capacity: number }) => {
    handleGenerateProblem(p.deliveries, p.riders, p.capacity, 42);
  };

  // Handle Dual Optimization Run
  const handleRunOptimization = async () => {
    try {
      setIsOptimizing(true);
      addLog('Optimization Started', `Executing QPSO, PSO, GA & SA (Objective: ${objective.toUpperCase()})...`, 'info');

      const res = await api.runOptimization({
        num_particles: 35,
        seed,
      });

      setQpsoResult(res.qpso);
      setPsoResult(res.pso);
      setGaResult(res.ga || null);
      setSaResult(res.sa || null);
      setComparison(res.comparison);
      setCity(res.city);
      setHasOptimized(true);

      // Auto-start animated delivery run
      setAnimProgress(0.0);
      setIsPlaying(true);

      addLog(
        'QPSO Converged',
        `Best Cost: ${res.qpso.final_cost} in ${res.qpso.execution_time_ms} ms (${res.qpso.iterations} iterations)`,
        'qpso'
      );
      addLog(
        'PSO Converged',
        `Best Cost: ${res.pso.final_cost} in ${res.pso.execution_time_ms} ms (${res.pso.iterations} iterations)`,
        'pso'
      );
      if (res.ga) {
        addLog(
          'GA Converged',
          `Best Cost: ${res.ga.final_cost} in ${res.ga.execution_time_ms} ms (${res.ga.iterations} iterations)`,
          'info'
        );
      }
      if (res.sa) {
        addLog(
          'SA Converged',
          `Best Cost: ${res.sa.final_cost} in ${res.sa.execution_time_ms} ms (${res.sa.iterations} iterations)`,
          'info'
        );
      }

      const winMsg = res.comparison.winner === 'TIE'
        ? 'Both algorithms reached identical solution fitness.'
        : `${res.comparison.winner} had the lowest cost (${res.comparison.all_costs?.[res.comparison.winner]}).`;
      addLog('Dual Evaluation Result', winMsg, 'success');
    } catch (err: any) {
      console.error(err);
      addLog('Optimization Error', err.message || 'Error running optimization', 'traffic');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Handle Traffic Simulation Incident
  const handleSimulateTraffic = async () => {
    try {
      setIsOptimizing(true);
      const res = await api.simulateTraffic(2);
      setIncidents(res.incidents);
      setCity(res.city);
      addLog(
        'Traffic Incident Injected',
        `Severe slowdown on ${res.incidents.length} active road segment(s) (5x multiplier).`,
        'traffic'
      );
    } catch (err: any) {
      console.error(err);
      addLog('Traffic Sim Error', err.message || 'Error simulating traffic', 'traffic');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Handle Re-Optimization after Traffic Incident
  const handleReoptimize = async () => {
    try {
      setIsOptimizing(true);
      addLog('Re-Optimization Triggered', 'Re-computing shortest path matrices and rerouting riders around jammed roads...', 'info');

      const res = await api.reoptimize({
        num_particles: 35,
        seed,
      });

      setQpsoResult(res.qpso);
      setPsoResult(res.pso);
      if (res.ga) setGaResult(res.ga);
      if (res.sa) setSaResult(res.sa);
      setComparison(res.comparison);
      setCity(res.city);
      setIncidents(res.incidents);

      // Restart animation
      setAnimProgress(0.0);
      setIsPlaying(true);

      addLog('Re-Routing Complete', `New routes generated across 4 algorithms! Winner: ${res.comparison.winner} (${res.comparison.cost_diff_pct}% diff)`, 'success');
    } catch (err: any) {
      console.error(err);
      addLog('Re-optimize Error', err.message || 'Error during re-optimization', 'traffic');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Handle Guided Demo Steps
  const handleStepAction = async (stepNumber: number) => {
    if (stepNumber === 1) {
      // Step 1: Initialize
      setNumDeliveries(50);
      setNumRiders(5);
      setRiderCapacity(10);
      setObjective('balanced');
      const res = await api.generateProblem({
        num_deliveries: 50,
        num_riders: 5,
        rider_capacity: 10,
        objective: 'balanced',
        seed: 42,
      });
      setCity(res.city);
      setQpsoResult(null);
      setPsoResult(null);
      setGaResult(null);
      setSaResult(null);
      setComparison(null);
      setIncidents([]);
      setHasOptimized(false);
      setAnimProgress(0.0);
      setIsPlaying(false);
      addLog('Demo Step 1', 'Problem initialized with 50 packages and 5 riders.', 'info');
    } else if (stepNumber === 2) {
      // Step 2: Optimize
      await handleRunOptimization();
    } else if (stepNumber === 3) {
      // Step 3: Play animation
      setAnimProgress(0.0);
      setIsPlaying(true);
      addLog('Demo Step 3', 'Live rider delivery animation playback started.', 'info');
    } else if (stepNumber === 4) {
      // Step 4: Traffic incident
      await handleSimulateTraffic();
    } else if (stepNumber === 5) {
      // Step 5: Re-optimize
      await handleReoptimize();
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-cyan-500 selection:text-white ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* 1. Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isBackendConnected={isBackendConnected}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Backend Warning Banner if offline */}
        {!isBackendConnected && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle size={18} className="text-rose-400 flex-shrink-0" />
            <div>
              <strong className="font-bold block text-rose-200">Backend Server Offline</strong>
              Start the FastAPI server via <code className="bg-rose-950 px-1.5 py-0.5 rounded text-rose-200">python -m uvicorn main:app --reload --port 8000</code> in the <code className="bg-rose-950 px-1.5 py-0.5 rounded text-rose-200">backend/</code> directory.
            </div>
          </div>
        )}

        {/* TAB 0: HOME & GUIDED DEMO SHOWCASE (DEFAULT LANDING) */}
        {activeTab === 'home' && <HomePage onNavigateTab={setActiveTab} />}

        {/* TAB 1: DELHI OKHLA REAL OPENSTREETMAP DRIVE NETWORK (PRIMARY FLAGSHIP) */}
        {activeTab === 'delhi-map' && <DelhiLiveView />}

        {/* TAB 2: AUTHENTIC PUNE REAL ROAD NETWORK (SINHGAD & AMBEGAON) */}
        {activeTab === 'live-map' && <PuneLiveView />}

        {/* TAB 3: MULTI-SCALE BENCHMARK RESULTS */}
        {activeTab === 'benchmark' && (
          <BenchmarkView
            benchmarkData={benchmarkData}
            setBenchmarkData={setBenchmarkData}
            onLogEvent={addLog}
          />
        )}

        {/* TAB 4: ABOUT & SCIENTIFIC FOUNDATION */}
        {activeTab === 'about' && <AboutView />}
      </main>

      {/* Guided Presentation Modal */}
      <DemoGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onStepAction={handleStepAction}
        isOptimizing={isOptimizing}
      />

      {/* Footer */}
      <footer className={`border-t py-5 text-center text-xs transition-colors ${
        isDark ? 'bg-[#0B132B] border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-medium">Pheri • SIH 2026 Prototype Demonstration</span>
          <span className={`font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
            Deterministic Evaluation Suite • Real OpenStreetMap Drive Topology
          </span>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
};

export default App;
