import React, { memo, useState, useEffect, useRef } from 'react';
import { useUI } from '../context/UIContext';

/* ═══════════════════════════════════════════════════
   INLINE SVG ICONS — FRIDAY style, lightweight
   ═══════════════════════════════════════════════════ */

const FridayIcon = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const UserIcon = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ActionIcon = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </svg>
);

const SystemIcon = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

function getRelativeTime(id) {
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

// Typewriter effect — fast, subtle, FRIDAY-like
const TypewriterText = memo(({ text, speed = 10 }) => {
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
        <span
          className="inline-block w-[2px] h-[14px] bg-cyan-400/80 ml-0.5 align-middle"
          style={{ animation: 'cursor-blink 0.7s step-end infinite' }}
        />
      )}
    </span>
  );
});

const ResponseCard = memo(({ response, isLatest }) => {
  const role = response.role || (response.text.includes('[FRIDAY]') || response.text.includes('[JARVIS]') ? 'assistant' : 'system');
  const relTime = getRelativeTime(response.id);

  const toneMap = {
    assistant: {
      icon: FridayIcon,
      label: 'Friday',
      badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      cardClass: 'border-cyan-500/10 bg-cyan-500/[0.03]',
    },
    user: {
      icon: UserIcon,
      label: 'You',
      badgeClass: 'bg-white/[0.06] text-white/60 border-white/10',
      cardClass: 'border-white/[0.06] bg-white/[0.03]',
    },
    action: {
      icon: ActionIcon,
      label: 'Action',
      badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      cardClass: 'border-emerald-500/10 bg-emerald-500/[0.03]',
    },
    system: {
      icon: SystemIcon,
      label: 'System',
      badgeClass: 'bg-white/5 text-white/40 border-white/[0.06]',
      cardClass: 'border-white/[0.05] bg-white/[0.02]',
    },
  };

  const tone = toneMap[role] || toneMap.system;
  const Icon = tone.icon;
  const shouldType = isLatest && (role === 'assistant' || role === 'action');

  return (
    <div
      className={`message-entry relative overflow-hidden transition-all duration-300 rounded-2xl p-4 mb-3 flex flex-col border ${tone.cardClass} ${
        role === 'user' ? 'ml-auto' : 'mr-auto'
      }`}
      style={{
        maxWidth: role === 'user' ? '75%' : '85%',
        animation: 'message-slide-in 0.3s ease-out forwards',
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tone.badgeClass}`}>
          <Icon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="font-rajdhani text-[10px] font-bold uppercase tracking-widest text-white/35">
              {tone.label}
            </span>
            <span className="text-[9px] text-white/15 font-mono">
              {relTime}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed tracking-wide text-white/85 font-inter">
            {shouldType ? <TypewriterText text={response.text} speed={10} /> : response.text}
          </p>
        </div>
      </div>
    </div>
  );
});

const ResponsePanel = memo(({ responses }) => {
  return (
    <div className="flex w-full flex-col">
      {responses.map((res, i) => (
        <ResponseCard
          key={res.id || i}
          response={res}
          isLatest={i === responses.length - 1}
        />
      ))}
    </div>
  );
});

export default ResponsePanel;
