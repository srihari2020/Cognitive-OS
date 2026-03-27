import React, { useState, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, ArrowRight, Mic, MicOff } from 'lucide-react';
import { useUI } from '../context/UIContext';

const InputBox = memo(({ onSend, isProcessing, onSearchInteraction, onVoiceStateChange, startListeningSignal = 0 }) => {
  const { uiMode, anticipation } = useUI();
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  
  const isFocus = uiMode === 'focus';
  const isAnticipated = anticipation && !input.trim();

  useEffect(() => {
    if (!isProcessing) {
      inputRef.current?.focus();
    }
  }, [isProcessing]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
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
      setInput(transcript);
      onSend(transcript);
      setInput('');
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
    setVoiceSupported(true);

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
  }, [isProcessing, onSearchInteraction, onSend, onVoiceStateChange]);

  useEffect(() => {
    if (!startListeningSignal || !voiceSupported || isProcessing || isListening || !recognitionRef.current) {
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (_) {
      // Ignore browser start race.
    }
  }, [startListeningSignal, voiceSupported, isProcessing, isListening]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSend(input);
      setInput('');
    }
  };

  const handleMicClick = () => {
    if (!voiceSupported || isProcessing || !recognitionRef.current) return;

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    } catch (_) {
      // Start can throw if the browser is already listening.
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto group">
      {/* Outer Glow Effect */}
      <div 
        className={`absolute -inset-4 rounded-[40px] blur-[30px] transition-all duration-700 -z-10
                    ${isFocus ? 'opacity-5 scale-95' : 'opacity-20 scale-100'}
                    ${isListening ? 'bg-red-500/35 scale-105' : isFocused ? 'bg-purple-500/40' : isAnticipated ? 'bg-neon-cyan/40 scale-105' : 'bg-neon-cyan/20'}`} 
      />

      <form 
        onSubmit={handleSubmit}
        onMouseEnter={() => onSearchInteraction?.(true)}
        onMouseLeave={() => !isFocused && onSearchInteraction?.(false)}
        className={`relative flex items-center gap-4 p-2 transition-all duration-500 overflow-hidden
                    glass-panel border-2 ${isListening ? 'border-red-400/60 scale-[1.01] shadow-[0_0_30px_rgba(239,68,68,0.25)]' : isFocused ? 'border-purple-500/50 scale-[1.01]' : isAnticipated ? 'border-neon-cyan/50' : 'border-white/10'}
                    ${isFocus ? 'p-1' : 'p-2'}`}
      >
        <div className={`p-4 rounded-xl transition-colors duration-500 
                        ${isFocused ? 'bg-purple-500/10 text-purple-400' : isAnticipated ? 'bg-neon-cyan/10 text-neon-cyan' : 'bg-white/5 text-gray-400'}
                        ${isFocus ? 'opacity-40 scale-75' : 'opacity-100 scale-100'}`}>
          <div className={`w-5 h-5 border-2 rounded-full ${isFocused && !isFocus ? 'animate-pulse' : isAnticipated ? 'animate-bounce' : ''}`} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            onSearchInteraction?.(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            onSearchInteraction?.(false);
          }}
          placeholder={isProcessing ? "Processing command..." : "Awaiting system orchestration..."}
          className="flex-1 bg-transparent border-none outline-none text-white font-orbitron placeholder:text-gray-500 text-sm tracking-wider"
          disabled={isProcessing || isListening}
        />

        <div className="flex items-center gap-2 pr-2">
          <motion.button
            type="button"
            onClick={handleMicClick}
            whileHover={!isProcessing && voiceSupported ? { scale: 1.05 } : undefined}
            whileTap={!isProcessing && voiceSupported ? { scale: 0.95 } : undefined}
            className={`p-3 rounded-lg transition-colors ${
              !voiceSupported || isProcessing
                ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                : isListening
                  ? 'bg-red-500/90 text-white'
                  : 'bg-white/10 text-neon-cyan hover:bg-neon-cyan/20'
            }`}
            disabled={!voiceSupported || isProcessing}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            title={voiceSupported ? (isListening ? 'Stop listening' : 'Voice command') : 'Speech recognition unavailable'}
          >
            {isListening ? <MicOff size={18} className="animate-pulse" /> : <Mic size={18} />}
          </motion.button>

          {input.length > 0 && !isProcessing && (
            <motion.button
              type="submit"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.1 }}
              className="p-3 rounded-lg bg-neon-cyan text-black hover:bg-white transition-colors"
            >
              <ArrowRight size={18} />
            </motion.button>
          )}
          
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/5 text-[10px] text-gray-500 font-mono">
            <Command size={10} />
            <span>ENTER</span>
          </div>
        </div>

        {/* Dynamic Scan Divider */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"
            />
          )}
        </AnimatePresence>
      </form>

      {/* Suggestion Label */}
      <div className="flex justify-between items-center mt-4 px-2 font-mono text-[9px] uppercase tracking-[0.4em] text-gray-500 pointer-events-none">
        <div className="flex gap-4">
          <span className="text-white/20">CTRL+K: SYNC</span>
          <span className="text-white/20">SHIFT+ENTER: MULTILINE</span>
        </div>
        <div className="flex items-center gap-2">
           <span className={`w-1 h-1 rounded-full ${isListening ? 'bg-red-400 animate-pulse' : 'bg-neon-cyan animate-ping'}`} />
           {isListening ? 'LISTENING' : 'CONNECTED'}
        </div>
      </div>
    </div>
  );
});

export default InputBox;
