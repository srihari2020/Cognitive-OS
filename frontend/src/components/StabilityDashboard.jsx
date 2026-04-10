import React, { memo } from 'react';
import { Activity, Zap, Shield, Cpu } from 'lucide-react';
import { useUI } from '../context/UIContext';

const StabilityDashboard = memo(() => {
  const { fps, performanceTier, backendStatus, intensity } = useUI();

  return (
    <div className="glass-ui rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Activity size={16} className="text-cyan-400" />
        <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Core Stability</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-[9px] text-white/20 uppercase font-bold">Pulse</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-mono font-bold text-white/80">{fps}</span>
            <span className="text-[8px] text-white/20 font-bold uppercase">fps</span>
          </div>
        </div>
        
        <div className="space-y-1">
          <span className="text-[9px] text-white/20 uppercase font-bold">Link</span>
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${backendStatus === 'ONLINE' ? 'bg-cyan-400 shadow-[0_0_8px_rgba(0,234,255,0.5)]' : 'bg-red-500'}`} />
            <span className={`text-[10px] font-bold uppercase ${backendStatus === 'ONLINE' ? 'text-cyan-400' : 'text-red-400'}`}>
              {backendStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Neural Intensity</span>
          <span className="text-[10px] font-mono text-cyan-400/80 font-bold">{Math.round(intensity * 100)}%</span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-1000"
            style={{ width: `${intensity * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
});

export default StabilityDashboard;
