import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageCard from './MessageCard';
import MicButton from './MicButton';
import CommandInput from './CommandInput';
import CoreOrb from './CoreOrb';

const ChatWidget = ({ 
  isOpen, 
  onClose, 
  responses, 
  onSendCommand, 
  isProcessing, 
  isVoiceListening, 
  isVoiceSpeaking,
  onMicClick,
  animationState,
  thinkingMessage
}) => {
  const scrollRef = useRef(null);
  const dragConstraintsRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [responses, isOpen]);

  return (
    <div ref={dragConstraintsRef} className="fixed inset-0 z-[99] pointer-events-none">
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-auto">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              drag
              dragConstraints={dragConstraintsRef}
              dragElastic={0.1}
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="max-w-sm max-h-[80vh] glass-ui border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden cursor-grab"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-md cursor-move">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(0,234,255,0.5)]" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">FRIDAY Interface</span>
                </div>
                <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Messages */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar"
              >
                {responses.map((res) => (
                  <motion.div
                    key={res.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <MessageCard role={res.role} content={res.text} />
                  </motion.div>
                ))}
                {isProcessing && (
                  <div className="flex flex-col gap-2 p-2">
                    <div className="flex gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/40 animate-bounce" style={{ animationDelay: '200ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/40 animate-bounce" style={{ animationDelay: '400ms' }} />
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400/60 animate-pulse">{thinkingMessage}</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-md flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <CommandInput 
                      onSubmit={onSendCommand}
                      isProcessing={isProcessing}
                      compact
                    />
                  </div>
                  <MicButton 
                    isListening={isVoiceListening}
                    isSpeaking={isVoiceSpeaking}
                    isProcessing={isProcessing}
                    onClick={onMicClick}
                    compact
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Toggle (Orb) */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onClose(!isOpen)}
          className={`w-14 h-14 rounded-full glass-ui border border-white/10 flex items-center justify-center shadow-2xl transition-all duration-500 ${
            isOpen ? 'bg-cyan-400/20 border-cyan-400/50' : 'bg-white/5 hover:bg-white/10'
          }`}
        >
          <div className="relative w-full h-full scale-[0.6]">
            <CoreOrb state={animationState} size={80} />
          </div>
        </motion.button>
      </div>
    </div>
  );
};

export default ChatWidget;
