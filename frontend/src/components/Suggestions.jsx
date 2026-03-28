import React, { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Globe, Settings, Cpu } from 'lucide-react';
import { commandService } from '../services/api';
import { useUI } from '../context/UIContext';
import { registerLoop, unregisterLoop } from '../utils/runtimeMetrics';

const ICON_MAP = {
  OPEN_CODE: Cpu,
  OPEN_YOUTUBE: Zap,
  GOOGLE_SEARCH: Globe,
  TYPE_TEXT: Sparkles,
  DEFAULT: Settings
};

const DEFAULT_SUGGESTIONS = [
  { text: "Initialize System Scan", intent: "SCAN", icon: "Sparkles" },
  { text: "Check Neural Hub", intent: "STATUS", icon: "Cpu" },
  { text: "Sync Core Sync", intent: "SYNC", icon: "Zap" }
];

const Suggestions = memo(({ onSelect, isSafeMode }) => {
  const { anticipation, intensity, backendStatus } = useUI();
  const [suggestions, setSuggestions] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (backendStatus === 'OFFLINE') {
      setSuggestions(DEFAULT_SUGGESTIONS);
      return;
    }

    let running = true;

    const tick = async () => {
      if (!running || backendStatus === 'OFFLINE' || commandService.isOffline()) return;
      try {
        const data = await commandService.getSuggestions();
        if (!running) return;
        const list = (data.suggestions && data.suggestions.length > 0)
          ? data.suggestions.map(s => ({ ...s, icon: ICON_MAP[s.intent] ? s.intent : 'DEFAULT' }))
          : DEFAULT_SUGGESTIONS;
        setSuggestions(list);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSuggestions(DEFAULT_SUGGESTIONS);
        }
      }
    };

    const cleanup = () => {
      running = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (!isSafeMode) unregisterLoop('suggestionsPoll');
    };

    // Poll every 4s. Only ONE interval exists per mount.
    if (isSafeMode) {
      tick();
      intervalRef.current = setInterval(tick, 4000);
    } else if (registerLoop('suggestionsPoll', cleanup)) {
      tick();
      intervalRef.current = setInterval(tick, 4000);
    }

    return cleanup;
  }, [isSafeMode, backendStatus]);

  // Update suggestions if anticipation provides new ones
  useEffect(() => {
    if (anticipation && anticipation.suggestions && anticipation.suggestions.length > 0) {
      const list = anticipation.suggestions.map(s => ({ ...s, icon: ICON_MAP[s.intent] ? s.intent : 'DEFAULT' }));
      setSuggestions(list);
    }
  }, [anticipation]);

  return (
    <motion.div 
      initial={isSafeMode ? undefined : { x: 100, opacity: 0 }}
      animate={isSafeMode ? { opacity: 1 } : { x: 0, opacity: 1 }}
      className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20"
    >
      {suggestions.map((item, index) => {
        const Icon = ICON_MAP[item.icon] || ICON_MAP[item.intent] || Cpu;
        const isAnticipated = anticipation && index === 0 && intensity > 0.5 && !isSafeMode;

        return (
          <motion.div
            key={`${item.intent}-${index}`}
            whileHover={isSafeMode ? undefined : { x: -10, scale: 1.05 }}
            animate={isAnticipated ? {
              x: -20,
              scale: 1.1,
              boxShadow: "0 0 20px rgba(0, 255, 255, 0.4)"
            } : isSafeMode ? {
              x: 0,
              scale: 1,
              opacity: 1
            } : {
              x: 0,
              scale: 1
            }}
            onClick={() => onSelect(item.text)}
            className={`glass-panel p-3 flex items-center gap-3 cursor-pointer group min-w-[50px] transition-all duration-300
                        ${isAnticipated ? 'min-w-[200px] border-neon-cyan/50' : isSafeMode ? 'min-w-[200px]' : 'hover:min-w-[200px]'}`}
          >
            <div className={`p-2 rounded-lg bg-black/50 transition-colors 
                            ${isAnticipated ? 'bg-neon-cyan/20' : 'group-hover:bg-neon-cyan/10'}`}>
              <Icon className={`w-5 h-5 text-neon-cyan ${isAnticipated ? 'animate-pulse' : ''}`} />
            </div>
            <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-opacity duration-300
                            ${isAnticipated || isSafeMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {item.text}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
});

export default Suggestions;
