import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { voiceService } from '../../services/voiceService';
import MicButton from './MicButton';
import { SendIcon, CommandIcon } from './Icons';

const PLACEHOLDERS = [
  "Ask me anything...",
  "Open apps, search, or control your system...",
  "Try \"open vscode\" or \"system info\"...",
  "What can I help you with?",
  "Search the web, open files, get system stats...",
];

const CommandInput = memo(({
  value,
  onChange,
  onSend,
  isProcessing,
  isListening,
  isSpeaking,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const placeholderTimerRef = useRef(null);

  useEffect(() => {
    if (!isProcessing) inputRef.current?.focus();
  }, [isProcessing]);

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

  useEffect(() => {
    if (value || isFocused) return;
    placeholderTimerRef.current = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(placeholderTimerRef.current);
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
    if (isListening) voiceService.stop();
    else voiceService.start();
  }, [isListening]);

  return (
    <div className="relative w-full">
      {/* Suggestions Dropdown */}
      {showSuggestions && isFocused && (
        <div className="absolute bottom-full left-0 right-0 mb-4 overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0b0f1a]/95 backdrop-blur-xl shadow-2xl z-50">
          <div className="p-2">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-cyan-400/50 mb-1">
              Neural Predictions
            </div>
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => handleSuggestionClick(s)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left text-[14px] font-medium text-cyan-50/80 hover:bg-white/5 hover:text-cyan-300 transition-all rounded-xl group"
              >
                <CommandIcon className="w-4 h-4 opacity-40 group-hover:text-cyan-400" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 bg-white/[0.03] ${
          isFocused || isListening ? 'border-cyan-400/40 bg-white/[0.06]' : 'border-white/5'
        }`}
      >
        <MicButton 
          isListening={isListening} 
          isSpeaking={isSpeaking} 
          onClick={handleMicClick} 
        />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isListening ? "Listening..." : PLACEHOLDERS[placeholderIndex]}
          disabled={isProcessing}
          className="flex-1 bg-transparent text-[15px] font-medium text-cyan-50 placeholder-white/20 outline-none"
        />

        <button
          type="submit"
          disabled={!value.trim() || isProcessing}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
            value.trim() && !isProcessing
              ? 'bg-cyan-400 text-[#0b0f1a] shadow-lg shadow-cyan-400/20 hover:scale-105'
              : 'bg-white/5 text-white/20'
          }`}
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
});

export default CommandInput;
