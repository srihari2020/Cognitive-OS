import React, { useState, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, ArrowRight, Mic, MicOff } from 'lucide-react';
import { useUI } from '../context/UIContext';

const InputBox = memo(({
  value,
  onInputChange,
  onSend,
  isProcessing,
  onSearchInteraction,
  onVoiceStateChange,
  startListeningSignal = 0,
}) => {
  const { uiMode, anticipation } = useUI();
  const speechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(Boolean(speechRecognitionCtor));
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  
  const isFocus = uiMode === 'focus';
  const isAnticipated = anticipation && !value.trim();

  useEffect(() => {
    if (!isProcessing) {
      inputRef.current?.focus();
    }
  }, [isProcessing]);

  useEffect(() => {
    if (!speechRecognitionCtor) {
      return;
    }

    const recognition = new speechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      onSearchInteraction?.(true);
      onVoiceStateChange?.(true);
    };

    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript || isProcessing) return;
      onInputChange?.(transcript);
      onSend(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      onSearchInteraction?.(false);
      onVoiceStateChange?.(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      onSearchInteraction?.(false);
      onVoiceStateChange?.(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      setIsListening(false);
      onVoiceStateChange?.(false);
    };
  }, [isProcessing, onInputChange, onSearchInteraction, onSend, onVoiceStateChange, speechRecognitionCtor]);

  useEffect(() => {
    if (!startListeningSignal || !voiceSupported || isProcessing || isListening || !recognitionRef.current) {
      return;
    }
    try {
      recognitionRef.current.start();
    } catch {
      return;
    }
  }, [startListeningSignal, voiceSupported, isProcessing, isListening]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim() && !isProcessing) {
      onSend(value);
    }
  };

  const startListening = () => {
    if (!voiceSupported || isProcessing || !recognitionRef.current) return;
    try {
      if (!isListening) {
        recognitionRef.current.start();
      }
    } catch {
      return;
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current || !isListening) return;
    try {
      recognitionRef.current.stop();
    } catch {
      return;
    }
  };

  return (
    <div className="relative w-full">
      {/* Ambient glow behind input */}
      <div
        className={`absolute inset-x-4 -top-3 h-20 rounded-full transition duration-500 ${
          isListening ? 'bg-red-500/16 blur-2xl' : isProcessing ? 'bg-purple-500/14 blur-2xl' : isFocused || isAnticipated ? 'bg-cyan-400/12 blur-2xl' : 'bg-cyan-400/6 blur-3xl'
        }`}
      />
      <form
        onSubmit={handleSubmit}
        onMouseEnter={() => onSearchInteraction?.(true)}
        onMouseLeave={() => !isFocused && onSearchInteraction?.(false)}
        className={`glass-panel relative px-4 py-4 transition duration-300 ${
          isListening
            ? 'border-red-400/50 shadow-[0_0_28px_rgba(248,113,113,0.15)]'
            : isProcessing
              ? 'thinking-glow border-purple-400/30'
              : isFocused || isAnticipated
                ? 'border-cyan-300/30 shadow-[0_0_24px_rgba(34,211,238,0.1)]'
                : ''
        }`}
      >
        {/* Status indicator orb */}
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors ${
          isListening
            ? 'border-red-400/40 bg-red-500/10 text-red-300'
            : isProcessing
              ? 'border-purple-400/35 bg-purple-500/10 text-purple-300'
              : 'border-white/10 bg-white/5 text-cyan-300'
        }`}>
          <motion.div
            animate={{ scale: isProcessing ? [1, 1.15, 1] : 1, opacity: isProcessing ? [0.55, 1, 0.55] : 0.8 }}
            transition={{ duration: 1.1, repeat: isProcessing ? Infinity : 0, ease: 'easeInOut' }}
            className="h-2.5 w-2.5 rounded-full bg-current"
          />
        </div>

        {/* Input area */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1">
          {/* Header labels */}
          <div className="flex items-center justify-between">
            <span className="mono-label" style={{ color: isListening ? '#fca5a5' : isProcessing ? '#d8b4fe' : 'rgba(255,255,255,0.45)' }}>
              {isListening ? 'Jarvis Mode' : isProcessing ? 'Neural Synthesis' : 'Command Interface'}
            </span>
            <span className={`font-rajdhani text-[10px] font-semibold uppercase tracking-[0.2em] ${
              isListening ? 'text-red-300' : isProcessing ? 'text-purple-300' : 'text-cyan-300/70'
            }`}>
              {isListening ? '● Recording' : isProcessing ? 'Thinking' : 'Ready'}
            </span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onInputChange?.(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              onSearchInteraction?.(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              onSearchInteraction?.(false);
            }}
            placeholder={isProcessing ? 'Synthesizing response...' : 'Ask JARVIS to act, search, or explain...'}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
            disabled={isProcessing || isListening}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Push-to-talk mic button with ring pulse */}
          <div className="relative">
            <motion.button
              type="button"
              onPointerDown={startListening}
              onPointerUp={stopListening}
              onPointerLeave={stopListening}
              onPointerCancel={stopListening}
              whileHover={!isProcessing && voiceSupported ? { scale: 1.06 } : undefined}
              whileTap={!isProcessing && voiceSupported ? { scale: 0.94 } : undefined}
              className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors ${
                !voiceSupported || isProcessing
                  ? 'border-white/8 bg-white/5 text-gray-600 cursor-not-allowed'
                  : isListening
                    ? 'border-red-300/50 bg-red-500/85 text-white'
                    : 'border-cyan-300/20 bg-cyan-400/8 text-cyan-300 hover:bg-cyan-400/14'
              }`}
              disabled={!voiceSupported || isProcessing}
              aria-label={isListening ? 'Stop listening' : 'Push to talk'}
              title={voiceSupported ? 'Hold to talk — JARVIS Mode' : 'Speech recognition unavailable'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </motion.button>
            {/* Pulsing ring when listening */}
            <AnimatePresence>
              {isListening && (
                <>
                  <motion.div
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-2xl border border-red-400/50"
                  />
                  <motion.div
                    initial={{ scale: 1, opacity: 0.3 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                    className="absolute inset-0 rounded-2xl border border-red-400/30"
                  />
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Send button */}
          {value.trim().length > 0 && !isProcessing && (
            <motion.button
              type="submit"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.06 }}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black transition-colors hover:bg-cyan-300"
            >
              <ArrowRight size={16} />
            </motion.button>
          )}
          {/* Keyboard hint */}
          <div className="hidden items-center gap-1.5 rounded-xl border border-white/8 bg-white/5 px-2.5 py-1.5 text-[9px] font-mono text-white/30 sm:flex">
            <Command size={9} />
            <span>ENTER</span>
          </div>
        </div>

        {/* Processing line animation */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0.2 }}
              animate={{ opacity: [0.2, 0.55, 0.2] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/70 to-transparent"
            />
          )}
        </AnimatePresence>
      </form>

      {/* Status footer */}
      <div className="mt-2 flex items-center justify-between px-2">
        <div className="flex items-center gap-2 mono-label" style={{ fontSize: '9px', letterSpacing: '0.24em' }}>
          <span className={`h-1.5 w-1.5 rounded-full status-dot-online ${isListening ? 'text-red-400 bg-red-400' : isProcessing ? 'text-purple-400 bg-purple-400' : 'text-cyan-300 bg-cyan-300'}`} />
          {isListening ? 'Voice Active' : isProcessing ? 'Neural Flow' : 'Connected'}
        </div>
        <div className="font-rajdhani text-[9px] font-medium uppercase tracking-[0.2em] text-white/25">
          {isFocus ? 'Focus Mode' : 'Sticky Dock'}
        </div>
      </div>
    </div>
  );
});

export default InputBox;
