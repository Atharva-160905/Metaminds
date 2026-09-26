import React, { useState } from 'react';
import { Sparkles, CheckCircle2, ArrowRight, Play, AlertTriangle, RefreshCw, X, ChevronRight } from 'lucide-react';

interface DemoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStepAction: (stepNumber: number) => Promise<void>;
  isOptimizing: boolean;
}

export const DemoGuideModal: React.FC<DemoGuideModalProps> = ({
  isOpen,
  onClose,
  onStepAction,
  isOptimizing,
}) => {
  const [currentStep, setCurrentStep] = useState(1);

  if (!isOpen) return null;

  const steps = [
    {
      step: 1,
      title: 'Problem Setup (50 Orders / 5 Riders)',
      description: 'Generates a clean synthetic city road network with 50 delivery orders, 5 riders with capacity limits, and a central logistics hub.',
      actionText: '1. Initialize Problem Environment',
      buttonIcon: <Play size={14} />
    },
    {
      step: 2,
      title: 'Run Dual Optimization (QPSO vs Classical PSO)',
      description: 'Executes Quantum-Inspired Particle Swarm Optimization and Classical PSO simultaneously on the exact same problem with identical random seed.',
      actionText: '2. Run QPSO & PSO Swarms',
      buttonIcon: <Sparkles size={14} />
    },
    {
      step: 3,
      title: 'Inspect Live Animated Delivery Fleet',
      description: 'Watch riders move along waypoints. Completed route segments become solid glowing paths; target points check off with ETAs.',
      actionText: '3. Play Animated Fleet Playback',
      buttonIcon: <Play size={14} />
    },
    {
      step: 4,
      title: 'Simulate Traffic Congestion Incident',
      description: 'Injects a severe real-time traffic slowdown (e.g. 5x travel time spike) directly on road segments currently traversed by delivery riders.',
      actionText: '4. Inject Road Incident',
      buttonIcon: <AlertTriangle size={14} />
    },
    {
      step: 5,
      title: 'Re-Optimize for Dynamic Avoidance',
      description: 'Swarm re-evaluates the congested road network graph and discovers new bypass routes that avoid the traffic bottleneck.',
      actionText: '5. Re-Route Fleet',
      buttonIcon: <RefreshCw size={14} />
    }
  ];

  const curr = steps[currentStep - 1];

  const handleExecuteCurrentStep = async () => {
    await onStepAction(currentStep);
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0B132B] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 rounded-xl">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-white">
                SIH Live Demonstration Guide
              </h3>
              <p className="text-xs text-slate-400">Step-by-step guided presentation workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="bg-slate-100 px-6 py-3 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2">
            {steps.map((s) => (
              <button
                key={s.step}
                onClick={() => setCurrentStep(s.step)}
                className={`w-7 h-7 rounded-full text-xs font-bold font-mono transition-all ${
                  s.step === currentStep
                    ? 'bg-slate-900 text-white shadow'
                    : s.step < currentStep
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s.step < currentStep ? '✓' : s.step}
              </button>
            ))}
          </div>
          <span className="text-xs font-bold font-mono text-slate-600">
            Step {currentStep} of {steps.length}
          </span>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              Demo Phase {currentStep}
            </span>
            <h4 className="text-xl font-bold text-slate-900 font-heading mt-2">
              {curr.title}
            </h4>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              {curr.description}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Judge Demonstration Talking Point:</span>
            </div>
            {currentStep === 1 && (
              <p>Highlight that both algorithms receive identical graph topology, package coordinates, and vehicle capacities for an uncompromised fair evaluation.</p>
            )}
            {currentStep === 2 && (
              <p>Point out the real-time convergence curve below: QPSO searches the continuous space via quantum wave-function collapse, while Classical PSO uses velocity updates.</p>
            )}
            {currentStep === 3 && (
              <p>Show how the completed route trail turns solid and glowing behind the rider, giving instant visual clarity on fleet delivery progression.</p>
            )}
            {currentStep === 4 && (
              <p>Notice how the affected road segment turns red and travel time jumps from 5 min to 25+ min due to simulated incident.</p>
            )}
            {currentStep === 5 && (
              <p>Notice how both optimizers reroute riders around the congested red segment, lowering overall fleet travel time.</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40"
          >
            Previous Step
          </button>

          <button
            onClick={handleExecuteCurrentStep}
            disabled={isOptimizing}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {isOptimizing ? (
              <>
                <RefreshCw size={14} className="animate-spin text-emerald-400" />
                <span>Executing Step...</span>
              </>
            ) : (
              <>
                {curr.buttonIcon}
                <span>{curr.actionText}</span>
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
