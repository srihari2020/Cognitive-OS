import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { voiceService } from '../services/voiceService';

/* ═══════════════════════════════════════════════════
   INLINE SVG ICONS — No heavy libraries
   ═══════════════════════════════════════════════════ */

const MicIcon = ({ className }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const SendIcon = ({ className }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const CommandIcon = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
  </svg>
);

/* ═══════════════════════════════════════════════════
   PLACEHOLDER TEXTS — rotating, FRIDAY-style
   ═══════════════════════════════════════════════════ */

const PLACEHOLDERS = [
  "Ask me anything...",
  "Open apps, search, or control your system...",
  "Try \"open vscode\" or \"system info\"...",
  "What can I help you with?",
  "Search the web, open files, get system stats...",
];

const InputBox = memo(({
  value,
  onChange,
  onSend,
  isProcessing,
  isListening,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderFade, setPlaceholderFade] = useState(true);
  const [micState, setMicState] = useState('idle'); // idle | listening | processing
  const inputRef = useRef(null);
  const placeholderTimerRef = useRef(null);

  // Auto-focus when processing finishes
  useEffect(() => {
    if (!isProcessing) {
      inputRef.current?.focus();
    }
  }, [isProcessing]);

  // Sync mic state from props
  useEffect(() => {
    if (isProcessing) setMicState('processing');
    else if (isListening) setMicState('listening');
    else setMicState('idle');
  }, [isListening, isProcessing]);

  // Rotating placeholder animation
  useEffect(() => {
    if (value || isFocused) return; // Don't rotate when user is typing

    placeholderTimerRef.current = setInterval(() => {
      setPlaceholderFade(false);
      setTimeout(() => {
        setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDERS.length);
        setPlaceholderFade(true);
      }, 200);
    }, 4000);

    return () => {
      if (placeholderTimerRef.current) clearInterval(placeholderTimerRef.current);
    };
  }, [value, isFocused]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (value.trim() && !isProcessing) {
      onSend(value);
    }
  }, [value, isProcessing, onSend]);

  const handleMicClick = useCallback(() => {
    if (isProcessing) return;

    if (voiceService.isListening) {
      voiceService.stop();
      setMicState('idle');
    } else {
      voiceService.start(false);
      setMicState('listening');
    }
  }, [isProcessing]);

  const currentPlaceholder = isListening
    ? "Listening..."
    : isProcessing
      ? "Working on it..."
      : PLACEHOLDERS[placeholderIndex];

  return (
    <form
      onSubmit={handleSubmit}
      className={`friday-input relative flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 ${
        isFocused
          ? 'border-cyan-400/50 bg-white/[0.08] shadow-[0_0_20px_rgba(0,234,255,0.12)]'
          : 'border-white/[0.08] bg-white/[0.04]'
      }`}
    >
      {/* Command icon */}
      <CommandIcon className={`shrink-0 transition-colors duration-200 ${
        isFocused ? 'text-cyan-400' : 'text-white/20'
      }`} />

      {/* Input field */}
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder=" "
          disabled={isProcessing}
          className="w-full bg-transparent font-rajdhani text-[15px] font-medium text-[#e6f1ff] outline-none placeholder-transparent peer"
        />
        {/* Custom animated placeholder */}
        {!value && (
          <span
            className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[14px] font-rajdhani text-white/25 transition-opacity duration-300 ${
              placeholderFade ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {currentPlaceholder}
          </span>
        )}
      </div>

      {/* Mic button (3 states) */}
      <button
        type="button"
        onClick={handleMicClick}
        disabled={isProcessing}
        className={`friday-btn relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
          micState === 'listening'
            ? 'bg-cyan-400/20 text-cyan-300 shadow-[0_0_16px_rgba(0,234,255,0.25)]'
            : micState === 'processing'
              ? 'bg-white/5 text-white/30'
              : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60'
        }`}
        aria-label={micState === 'listening' ? 'Stop listening' : 'Start voice input'}
      >
        {/* Listening pulse ring */}
        {micState === 'listening' && (
          <span className="absolute inset-0 rounded-xl border border-cyan-400/40 mic-pulse-ring" />
        )}

        {/* Processing spinner */}
        {micState === 'processing' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" className="mic-spinner">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28 28" strokeLinecap="round" />
          </svg>
        ) : (
          <MicIcon className={micState === 'listening' ? 'text-cyan-300' : ''} />
        )}
      </button>

      {/* Send button */}
      <button
        type="submit"
        disabled={!value.trim() || isProcessing}
        className={`friday-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
          value.trim() && !isProcessing
            ? 'bg-cyan-400 text-[#0b0f1a] shadow-[0_0_12px_rgba(0,234,255,0.25)] hover:shadow-[0_0_20px_rgba(0,234,255,0.35)]'
            : 'bg-white/5 text-white/20'
        }`}
      >
        <SendIcon />
      </button>
    </form>
  );
});

export default InputBox;
