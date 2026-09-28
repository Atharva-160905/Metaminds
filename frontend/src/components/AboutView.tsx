import React from 'react';
import { Cpu, ShieldCheck, Zap, AlertTriangle, Layers, GitBranch, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const AboutView: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Intro Card */}
      <div className={`rounded-3xl p-8 border shadow-sm transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 rounded-2xl shadow-lg">
            <Cpu size={28} />
          </div>
          <div>
            <h1 className={`text-2xl font-black font-heading ${isDark ? 'text-white' : 'text-slate-900'}`}>
              QuantaRoute: Project Architecture & Foundations
            </h1>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Smart India Hackathon (SIH 2026) • Transportation & Logistics Track
            </p>
          </div>
        </div>

        <div className={`prose max-w-none text-sm space-y-3 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <p className={`text-base font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Our system helps a last-mile delivery company decide which rider should deliver which packages, in what sequence, and along which road network routes, taking into account road connectivity and dynamic traffic congestion.
          </p>
          <p>
            We evaluate and contrast a <strong>Quantum-Inspired Particle Swarm Optimization (QPSO)</strong> algorithm against standard <strong>Classical Particle Swarm Optimization (PSO)</strong> on identical Capacitated Vehicle Routing Problem (CVRP) instances with traffic awareness.
          </p>
        </div>

        {/* Clear Hardware Clarification Banner */}
        <div className={`mt-6 p-4 rounded-2xl flex items-start gap-3.5 border ${
          isDark
            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
            : 'bg-emerald-50/90 border-emerald-300 text-emerald-900'
        }`}>
          <ShieldCheck size={22} className={`mt-0.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
          <div className="text-xs leading-relaxed">
            <strong className={`font-bold text-sm block mb-0.5 ${isDark ? 'text-emerald-300' : 'text-emerald-950'}`}>
              Important Scientific Note on Quantum-Inspired Optimization:
            </strong>
            We are <strong>NOT</strong> using a physical quantum computer or quantum hardware (e.g., QPU / IBM Quantum / D-Wave).
            <strong> QPSO is a quantum-inspired metaheuristic algorithm</strong> that simulates quantum mechanics principles (such as wave-function probability collapse and delta-potential-well attraction) running efficiently on standard classical CPUs.
          </div>
        </div>
      </div>

      {/* Algorithm Comparison Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* QPSO Box */}
        <div className={`rounded-3xl p-6 border shadow-sm flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-emerald-500/40' : 'bg-white border-emerald-200'
        }`}>
          <div>
            <div className={`flex items-center gap-2.5 mb-3 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              <Zap size={20} />
              <h3 className="text-lg font-bold font-heading">Quantum-Inspired PSO (QPSO)</h3>
            </div>
            <ul className={`space-y-2.5 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span><strong>No Velocity Vector:</strong> Particles exist in a quantum state governed by a probability wave function.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span><strong>Mean Best Position ($mbest$):</strong> Coordinates across all personal bests to guide global swarm cohesion.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span><strong>Delta Potential Well:</strong> Allows particles to appear anywhere in space, drastically reducing premature convergence into local minima.</span>
              </li>
            </ul>
          </div>
          <div className={`mt-4 pt-3 border-t text-[11px] font-mono p-2.5 rounded-xl ${
            isDark
              ? 'border-emerald-900/60 text-emerald-300 bg-emerald-950/40'
              : 'border-emerald-100 text-emerald-800 bg-emerald-50/80'
          }`}>
            $X_i(t+1) = p_i \pm \alpha |mbest - X_i(t)| \ln(1/u)$
          </div>
        </div>

        {/* Classical PSO Box */}
        <div className={`rounded-3xl p-6 border shadow-sm flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-cyan-500/40' : 'bg-white border-cyan-200'
        }`}>
          <div>
            <div className={`flex items-center gap-2.5 mb-3 ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
              <Zap size={20} />
              <h3 className="text-lg font-bold font-heading">Classical PSO Baseline</h3>
            </div>
            <ul className={`space-y-2.5 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />
                <span><strong>Velocity-Displacement:</strong> Uses explicit particle velocities updated by inertia weight and cognitive/social attraction.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />
                <span><strong>Inertia Decay ($w$):</strong> Balances exploration in early iterations and exploitation in later steps.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />
                <span><strong>Local Minima Susceptibility:</strong> Can occasionally become trapped in complex high-dimensional non-convex landscapes.</span>
              </li>
            </ul>
          </div>
          <div className={`mt-4 pt-3 border-t text-[11px] font-mono p-2.5 rounded-xl ${
            isDark
              ? 'border-cyan-900/60 text-cyan-300 bg-cyan-950/40'
              : 'border-cyan-100 text-cyan-800 bg-cyan-50/80'
          }`}>
            $V_i(t+1) = wV_i + c_1 r_1(P_i - X_i) + c_2 r_2(G - X_i)$
          </div>
        </div>
      </div>

      {/* Constraints & Objectives */}
      <div className={`rounded-3xl p-6 border shadow-sm transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <h3 className={`text-base font-bold font-heading mb-3 flex items-center gap-2 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          <Layers size={18} className={isDark ? 'text-slate-400' : 'text-slate-700'} />
          <span>VRP Problem Formulation & Constraints</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className={`p-3 rounded-xl border ${
            isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <strong className={`block mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>1. Fleet Constraints</strong>
            Each rider starts from the central Depot, serves a batch of assigned delivery packages up to their max capacity, and returns to the Depot.
          </div>
          <div className={`p-3 rounded-xl border ${
            isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <strong className={`block mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>2. Shortest Path Routing</strong>
            Between consecutive delivery targets, riders navigate the underlying road network using Dijkstra shortest path taking live traffic congestion into account.
          </div>
          <div className={`p-3 rounded-xl border ${
            isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <strong className={`block mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>3. Objective Functions</strong>
            Supports Minimum Travel Time, Minimum Distance, and Balanced Multi-Objective (w_time &middot; T + w_dist &middot; D).
          </div>
        </div>
      </div>

      {/* Limitations & Future Roadmap */}
      <div className={`rounded-3xl p-6 shadow-xl border transition-colors ${
        isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200 shadow-sm'
      }`}>
        <h3 className="text-base font-bold font-heading mb-3 flex items-center gap-2 text-cyan-500">
          <GitBranch size={18} />
          <span>Real-World Limitations & Future Extensions</span>
        </h3>
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <div>
            <h4 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Prototype Scope & Assumptions:</h4>
            <p className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              This prototype utilizes deterministic synthetic city graphs and simulated incident injection to guarantee reproducible evaluation without requiring external paid APIs or live traffic tracking during evaluation.
            </p>
          </div>
          <div>
            <h4 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Future Industrial Enhancements:</h4>
            <ul className={`space-y-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <li>• Turn restrictions and live traffic feeds on the OpenStreetMap network.</li>
              <li>• Ant Colony Optimisation (ACO) as an additional baseline.</li>
              <li>• EV Battery charge level & dynamic recharging station routing.</li>
              <li>• Standard VRPLIB benchmark instances alongside the city scenarios.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
