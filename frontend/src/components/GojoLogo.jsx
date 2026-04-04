import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GojoLogo = memo(({ 
  isProcessing = false, 
  enableAnimation = false, 
  isExpanded = true, 
  onActivate,
  isListening = false,
  isSpeaking = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isCharged = enableAnimation && (isHovered || isProcessing || isListening || isSpeaking);

  return (
    <motion.button
      type="button"
      onClick={onActivate}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileTap={{ scale: 0.96 }}
      animate={isExpanded ? { scale: 1 } : { scale: 0.92 }}
      className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-full border transition-all duration-500 ${
        isProcessing || isListening
          ? 'border-purple-400/40 bg-black/70 thinking-glow'
          : isSpeaking
            ? 'border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_32px_rgba(34,211,238,0.3)]'
            : isHovered
              ? 'border-cyan-300/40 bg-black/65 shadow-[0_0_32px_rgba(0,243,255,0.2)]'
              : 'border-white/10 bg-black/55 shadow-[0_0_16px_rgba(0,243,255,0.08)]'
      }`}
    >
      {/* Listening Waveform Pulse */}
      {isListening && (
        <motion.div
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-cyan-400/20"
        />
      )}
      
      {/* Speaking Waveform Pulse */}
      {isSpeaking && (
        <motion.div
          animate={{
            scale: [1, 1.2, 1.1, 1.3, 1],
            opacity: [0.3, 0.6, 0.4, 0.7, 0.3],
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-purple-400/20"
        />
      )}
      {/* Idle pulse ring */}
      <motion.div
        animate={{
          scale: isCharged ? [1, 1.12, 1] : [1, 1.04, 1],
          opacity: isCharged ? [0.3, 0.55, 0.3] : [0.15, 0.28, 0.15],
        }}
        transition={{ duration: isCharged ? 0.9 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(0,243,255,0.2),transparent_62%)]"
      />
      {/* Energy charge ring (hover/processing) */}
      <motion.div
        animate={{
          scale: isCharged ? [0.9, 1.2, 0.95] : [0.96, 1.02, 0.96],
          opacity: isCharged ? [0.2, 0.48, 0.18] : [0.08, 0.16, 0.08],
        }}
        transition={{ duration: isCharged ? 0.8 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.22),transparent_60%)]"
      />
      <svg width="72" height="72" viewBox="0 0 72 72" className="relative z-10">
        <defs>
          <radialGradient id="orb-cyan" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="orb-purple" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        {/* Cyan orb — left */}
        <motion.circle
          cx="22"
          cy="36"
          r="12"
          fill="url(#orb-cyan)"
          animate={{ cx: isCharged ? [22, 26, 22] : 22, cy: isCharged ? [36, 33, 36] : 36 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          opacity="0.88"
        />
        {/* Purple orb — right */}
        <motion.circle
          cx="50"
          cy="36"
          r="12"
          fill="url(#orb-purple)"
          animate={{ cx: isCharged ? [50, 46, 50] : 50, cy: isCharged ? [36, 39, 36] : 36 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          opacity="0.88"
        />
        {/* Center merge zone */}
        <motion.circle
          cx="36"
          cy="36"
          r={isCharged ? 14 : 10}
          fill="rgba(255,255,255,0.1)"
          animate={{ scale: isCharged ? [1, 1.18, 0.98] : [1, 1.04, 1] }}
          transition={{ duration: isCharged ? 0.8 : 2.1, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Energy charge ring stroke */}
        {isHovered && (
          <motion.circle
            cx="36"
            cy="36"
            r="32"
            fill="none"
            stroke="rgba(0,243,255,0.3)"
            strokeWidth="1"
            strokeDasharray="12 6"
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: 360, opacity: 0.6 }}
            transition={{ rotate: { duration: 4, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.3 } }}
          />
        )}
        <text
          x="36"
          y="40"
          textAnchor="middle"
          fill="white"
          fontSize="14"
          fontWeight="900"
          className="font-orbitron tracking-[0.35em]"
        >
          CO
        </text>
      </svg>
      {/* Processing ring */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1.08 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.24 }}
            className="absolute inset-0 rounded-full border border-purple-400/50"
          />
        )}
      </AnimatePresence>
      {/* Hover energy charge outer ring */}
      <AnimatePresence>
        {isHovered && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.2 }}
            className="absolute -inset-1 rounded-full border border-cyan-300/25"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
});

export default GojoLogo;
