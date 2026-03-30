import React, { memo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Terminal, User, Zap } from 'lucide-react';
import { useUI } from '../context/UIContext';

function getRelativeTime(id) {
  // Extract timestamp from ID format: "role-timestamp-random"
  const parts = id?.split('-');
  if (!parts || parts.length < 2) return '';
  const ts = parseInt(parts[1], 10);
  if (!ts || isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 5000) return 'now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// Typewriter effect for assistant messages
const TypewriterText = memo(({ text, speed = 12 }) => {
  const [displayedLength, setDisplayedLength] = useState(0);
  const frameRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (!text) return;
    startRef.current = performance.now();
    setDisplayedLength(0);

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const chars = Math.min(text.length, Math.floor(elapsed / speed));
      setDisplayedLength(chars);
      if (chars < text.length) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [text, speed]);

  const isComplete = displayedLength >= text.length;

  return (
    <span>
      {text.slice(0, displayedLength)}
      {!isComplete && (
        <span className="inline-block w-[2px] h-[14px] bg-current ml-0.5 align-middle" style={{ animation: 'cursor-blink 0.8s step-end infinite' }} />
      )}
    </span>
  );
});

const ResponseCard = memo(({ response, isOld, isLatest }) => {
  const { uiMode } = useUI();
  const isFocus = uiMode === 'focus';
  const role = response.role || (response.text.includes('[JARVIS]') ? 'assistant' : 'system');
  const relTime = getRelativeTime(response.id);

  const toneMap = {
    assistant: {
      icon: Sparkles,
      label: 'Jarvis',
      accent: 'border-purple-400/25 bg-purple-500/[0.05]',
      textColor: 'text-purple-100',
      badge: 'bg-purple-500/12 text-purple-300',
      iconGlow: 'shadow-[0_0_12px_rgba(168,85,247,0.15)]',
    },
    user: {
      icon: User,
      label: 'Operator',
      accent: 'border-cyan-300/22 bg-cyan-400/[0.03]',
      textColor: 'text-cyan-50',
      badge: 'bg-cyan-400/12 text-cyan-200',
      iconGlow: 'shadow-[0_0_12px_rgba(0,243,255,0.12)]',
    },
    action: {
      icon: Zap,
      label: 'Action',
      accent: 'border-emerald-400/22 bg-emerald-500/[0.03]',
      textColor: 'text-emerald-50',
      badge: 'bg-emerald-500/12 text-emerald-200',
      iconGlow: 'shadow-[0_0_12px_rgba(52,211,153,0.12)]',
    },
    system: {
      icon: Terminal,
      label: 'System',
      accent: 'border-white/8 bg-white/[0.025]',
      textColor: 'text-gray-200',
      badge: 'bg-white/8 text-gray-400',
      iconGlow: '',
    },
  };
  const tone = toneMap[role] || toneMap.system;
  const Icon = tone.icon;
  const shouldType = isLatest && (role === 'assistant' || role === 'action');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: isFocus ? (isOld ? 0.38 : 1) : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`${isFocus ? 'mb-2' : 'mb-3'} relative`}
    >
      <div className={`relative overflow-hidden rounded-[22px] border px-4 py-3 transition-colors ${tone.accent}`}>
        {/* Subtle top-left shine */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_40%)] opacity-40" />
        <div className={`relative z-10 flex items-start ${isFocus ? 'gap-2.5' : 'gap-3'}`}>
          {/* Icon */}
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 ${tone.badge} ${tone.iconGlow}`}>
            <Icon size={15} />
          </div>
          {/* Content */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="font-rajdhani text-[10px] font-semibold uppercase tracking-[0.28em] text-white/50">
                {tone.label}
              </span>
              <span className="font-rajdhani text-[9px] font-medium text-white/20 tracking-wider">
                {relTime}
              </span>
            </div>
            <p className={`${isFocus ? 'text-xs' : 'text-[13px]'} leading-[1.7] tracking-[0.01em] ${tone.textColor}`}>
              {shouldType ? <TypewriterText text={response.text} speed={14} /> : response.text}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

const ResponsePanel = memo(({ responses }) => {
  return (
    <div className="flex w-full flex-col">
      <AnimatePresence mode="popLayout">
        {responses.map((res, i) => (
          <ResponseCard
            key={res.id || i}
            response={res}
            isOld={i < responses.length - 1}
            isLatest={i === responses.length - 1}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});

export default ResponsePanel;
