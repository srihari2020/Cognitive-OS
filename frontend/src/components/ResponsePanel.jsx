import React, { memo, useState, useEffect, useRef } from 'react';
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
      accent: 'border-purple-500/20 bg-purple-500/5',
      textColor: 'text-purple-100',
      badge: 'bg-purple-500/10 text-purple-300',
    },
    user: {
      icon: User,
      label: 'Operator',
      accent: 'border-cyan-500/20 bg-cyan-500/5',
      textColor: 'text-cyan-50',
      badge: 'bg-cyan-500/10 text-cyan-200',
    },
    action: {
      icon: Zap,
      label: 'Action',
      accent: 'border-emerald-500/20 bg-emerald-500/5',
      textColor: 'text-emerald-50',
      badge: 'bg-emerald-500/10 text-emerald-200',
    },
    system: {
      icon: Terminal,
      label: 'System',
      accent: 'border-white/10 bg-white/5',
      textColor: 'text-gray-200',
      badge: 'bg-white/10 text-gray-400',
    },
  };
  const tone = toneMap[role] || toneMap.system;
  const Icon = tone.icon;
  const shouldType = isLatest && (role === 'assistant' || role === 'action');

  return (
    <div 
      className={`message-entry relative overflow-hidden glass-ui transition-all duration-300 ${
        role === 'user' ? 'message-user bg-cyan-500/5' : 'message-ai'
      } max-w-[85%] rounded-2xl p-4 mb-4 flex flex-col`}
      style={{
        alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
        animation: 'message-in 0.3s ease-out forwards'
      }}
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 ${tone.badge}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="font-rajdhani text-[10px] font-bold uppercase tracking-widest text-white/40">
              {tone.label}
            </span>
            <span className="text-[9px] text-white/20">
              {relTime}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed tracking-wide text-white/90">
            {shouldType ? <TypewriterText text={response.text} speed={14} /> : response.text}
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
          isOld={i < responses.length - 1}
          isLatest={i === responses.length - 1}
        />
      ))}
    </div>
  );
});

export default ResponsePanel;
