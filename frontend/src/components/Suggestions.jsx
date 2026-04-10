import React, { useState, useEffect, useRef, memo } from 'react';
import { commandService } from '../services/api';
import { useUI } from '../context/UIContext';
import { predictor } from '../services/predictor';

/* ═══════════════════════════════════════════════════
   INLINE SVG ICONS — Lightweight, no library
   ═══════════════════════════════════════════════════ */

const icons = {
  Cpu: (cls) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  ),
  Zap: (cls) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Globe: (cls) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Sparkles: (cls) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  ),
  Settings: (cls) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const getIcon = (name) => icons[name] || icons.Sparkles;

const DEFAULT_SUGGESTIONS = [
  { text: "System status", intent: "STATUS", icon: "Cpu", isProactive: false },
  { text: "Quick search", intent: "GOOGLE_SEARCH", icon: "Globe", isProactive: false },
  { text: "Open VS Code", intent: "OPEN_CODE", icon: "Zap", isProactive: false }
];

const Suggestions = memo(({ onSelect, isSafeMode }) => {
  const { anticipation, intensity, behaviorMode } = useUI();
  const [suggestions, setSuggestions] = useState([]);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let running = true;

    const tick = async () => {
      if (!running) return;

      if (behaviorMode === 'active') {
        setSuggestions([]);
        timeoutRef.current = setTimeout(tick, 5000);
        return;
      }

      if (behaviorMode === 'processing') {
        timeoutRef.current = setTimeout(tick, 5000);
        return;
      }

      try {
        const predictions = await predictor.getPredictions();
        const list = predictions.length > 0 ? predictions : DEFAULT_SUGGESTIONS;
        setSuggestions(list);
      } catch {
        setSuggestions(DEFAULT_SUGGESTIONS);
      }

      const nextDelay = 8000 + Math.random() * 5000;
      timeoutRef.current = setTimeout(tick, nextDelay);
    };

    tick();

    return () => {
      running = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isSafeMode]);

  useEffect(() => {
    if (anticipation?.suggestions?.length > 0) {
      const list = anticipation.suggestions.map(s => ({ ...s, icon: s.intent }));
      setSuggestions(list);
    }
  }, [anticipation]);

  if (!suggestions.length || behaviorMode === 'active') return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suggestions.map((item, index) => {
        const renderIcon = getIcon(item.icon) || getIcon(item.intent);
        const isAnticipated = item.isProactive || (anticipation && index === 0 && intensity > 0.5 && !isSafeMode);
        const actionString = item.executeRaw || item.action || item.text;

        return (
          <button
            key={`${item.intent}-${index}-${item.text}`}
            type="button"
            onClick={() => onSelect(actionString)}
            className={`friday-btn suggestion-chip flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-medium transition-all duration-200 ${
              isAnticipated
                ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100 shadow-[0_0_12px_rgba(0,234,255,0.15)]'
                : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-cyan-400/25 hover:bg-cyan-400/[0.06] hover:text-white/80 hover:shadow-[0_0_12px_rgba(0,234,255,0.08)]'
            }`}
          >
            {renderIcon(isAnticipated ? 'text-cyan-300' : 'text-white/40')}
            <span className="whitespace-nowrap">{item.text}</span>
          </button>
        );
      })}
    </div>
  );
});

export default Suggestions;
