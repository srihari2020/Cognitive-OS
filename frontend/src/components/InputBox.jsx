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
  isSpeaking,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderFade, setPlaceholderFade] = useState(true);
  const [micState, setMicState] = useState('idle'); // idle | listening | processing
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const placeholderTimerRef = useRef(null);

  // Auto-focus when processing finishes
  useEffect(() => {
    if (!isProcessing) {
      inputRef.current?.focus();
    }
  }, [isProcessing]);

  // Fetch suggestions on query change
  useEffect(() => {
    if (value.length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch('http://localhost:8000/api/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: value }),
        });
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [value]);

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
      setShowSuggestions(false);
    }
  }, [value, isProcessing, onSend]);

  const handleSuggestionClick = useCallback((suggestion) => {
    onSend(`open ${suggestion}`);
    setShowSuggestions(false);
  }, [onSend]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      voiceService.stop();
    } else {
      voiceService.start();
    }
  }, [isListening]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Suggestions Dropdown */}
      {showSuggestions && isFocused && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0f1a]/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)] z-50">
          <div className="p-2">
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-400/60 border-b border-white/[0.05] mb-1">
              Smart Suggestions
            </div>
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => handleSuggestionClick(s)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[14px] font-medium text-[#e6f1ff] transition-all hover:bg-white/[0.08] hover:text-cyan-300 group rounded-xl"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 group-hover:bg-cyan-400/20 group-hover:text-cyan-400 transition-colors">
                  <CommandIcon className="w-3.5 h-3.5" />
                </div>
                <span>{s}</span>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <SendIcon className="w-3.5 h-3.5 rotate-[-45deg]" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`command-box relative flex items-center gap-3 px-4 py-3 transition-all duration-300 ${
          isFocused || isListening
            ? 'border-cyan-400/50 bg-white/[0.08]'
            : 'border-white/[0.08] bg-white/[0.04]'
        }`}
      >
        <button
          type="button"
          onClick={handleMicClick}
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
            isListening 
              ? 'mic-active text-black scale-110' 
              : isSpeaking
                ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
          }`}
        >
          {isListening && (
            <div className="absolute inset-0 rounded-xl bg-cyan-400 animate-ping opacity-25" />
          )}
          {isSpeaking && (
            <div className="absolute inset-0 rounded-xl bg-purple-500 animate-pulse opacity-20" />
          )}
          <MicIcon className={`h-5 w-5 ${isListening || isSpeaking ? 'animate-pulse' : ''}`} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isListening ? "Listening..." : "Speak or type a command..."}
          disabled={isProcessing}
          className="flex-1 bg-transparent text-[15px] font-medium text-[#e6f1ff] placeholder-white/20 outline-none"
        />

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
    </div>
  );
});

export default InputBox;
