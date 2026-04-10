import React, { useState, useEffect, useRef, memo } from 'react';
import { Sparkles, Zap, Globe, Settings, Cpu } from 'lucide-react';
import { commandService } from '../services/api';
import { useUI } from '../context/UIContext';
import { registerLoop, unregisterLoop } from '../utils/runtimeMetrics';
import { predictor } from '../services/predictor';

const ICON_MAP = {
  OPEN_CODE: Cpu,
  OPEN_YOUTUBE: Zap,
  GOOGLE_SEARCH: Globe,
  TYPE_TEXT: Sparkles,
  DEFAULT: Settings,
  Cpu: Cpu,
  Zap: Zap,
  Globe: Globe,
  Settings: Settings,
  Sparkles: Sparkles
};

const DEFAULT_SUGGESTIONS = [
  { text: "Initialize System Scan", intent: "SCAN", icon: "Sparkles", isProactive: false },
  { text: "Check Neural Hub", intent: "STATUS", icon: "Cpu", isProactive: false },
  { text: "Sync Core", intent: "SYNC", icon: "Zap", isProactive: false }
];

const Suggestions = memo(({ onSelect, isSafeMode }) => {
  const { anticipation, intensity, behaviorMode } = useUI();
  const [suggestions, setSuggestions] = useState([]);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let running = true;

    const tick = async () => {
      if (!running) return;
      
      // Behavior Mode check: active -> no interruption
      if (behaviorMode === 'active') {
        setSuggestions([]);
        timeoutRef.current = setTimeout(tick, 5000);
        return;
      }

      // processing -> locked
      if (behaviorMode === 'processing') {
        timeoutRef.current = setTimeout(tick, 5000);
        return;
      }

      try {
        const predictions = await predictor.getPredictions();
        const list = predictions.length > 0 ? predictions : DEFAULT_SUGGESTIONS;
        setSuggestions(list);
      } catch (error) {
        setSuggestions(DEFAULT_SUGGESTIONS);
      }

      // Update every 5-10s as requested
      const nextDelay = 8000 + Math.random() * 5000; // Increased interval for stability (8-13s)
      timeoutRef.current = setTimeout(tick, nextDelay);
    };

    tick();

    return () => {
      running = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isSafeMode]); // Removed behaviorMode dependency for fewer re-runs

  useEffect(() => {
    // Override local predictions if the remote AI pushes active anticipations
    if (anticipation && anticipation.suggestions && anticipation.suggestions.length > 0) {
      const list = anticipation.suggestions.map(s => ({ ...s, icon: s.intent }));
      setSuggestions(list);
    }
  }, [anticipation]);

  if (!suggestions.length || behaviorMode === 'active') return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suggestions.map((item, index) => {
        const Icon = ICON_MAP[item.icon] || ICON_MAP[item.intent] || Cpu;
        const isAnticipated = item.isProactive || (anticipation && index === 0 && intensity > 0.5 && !isSafeMode);

        const actionString = item.executeRaw || item.action || item.text;

        return (
          <button
            key={`${item.intent}-${index}-${item.text}`}
            type="button"
            onClick={() => onSelect(actionString)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-medium transition-all duration-500 ${
              isAnticipated
                ? 'border-cyan-300/50 bg-cyan-400/10 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.2)] animate-pulse'
                : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90 hover:scale-105'
            }`}
          >
            <Icon size={14} className={isAnticipated ? 'text-cyan-300' : 'text-white/50'} />
            <span className="whitespace-nowrap">{item.text}</span>
          </button>
        );
      })}
    </div>
  );
});

export default Suggestions;
