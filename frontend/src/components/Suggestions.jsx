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
  { text: "Sync Core", intent: "SYNC", icon: "Zap" }
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

    if (isSafeMode) {
      tick();
      intervalRef.current = setInterval(tick, 4000);
    } else if (registerLoop('suggestionsPoll', cleanup)) {
      tick();
      intervalRef.current = setInterval(tick, 4000);
    }

    return cleanup;
  }, [isSafeMode, backendStatus]);

  useEffect(() => {
    if (anticipation && anticipation.suggestions && anticipation.suggestions.length > 0) {
      const list = anticipation.suggestions.map(s => ({ ...s, icon: ICON_MAP[s.intent] ? s.intent : 'DEFAULT' }));
      setSuggestions(list);
    }
  }, [anticipation]);

  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suggestions.map((item, index) => {
        const Icon = ICON_MAP[item.icon] || ICON_MAP[item.intent] || Cpu;
        const isAnticipated = anticipation && index === 0 && intensity > 0.5 && !isSafeMode;

        return (
          <motion.button
            key={`${item.intent}-${index}`}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(item.text)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-200 ${
              isAnticipated
                ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-200 shadow-[0_0_16px_rgba(0,243,255,0.15)]'
                : 'border-white/8 bg-white/[0.04] text-white/55 hover:border-cyan-300/20 hover:bg-cyan-400/[0.06] hover:text-white/80'
            }`}
          >
            <Icon size={12} className={isAnticipated ? 'text-cyan-300' : 'text-white/40'} />
            <span className="whitespace-nowrap">{item.text}</span>
          </motion.button>
        );
      })}
    </div>
  );
});

export default Suggestions;
