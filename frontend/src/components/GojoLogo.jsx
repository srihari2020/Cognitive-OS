import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GojoLogo = memo(() => {
  const [isMerging, setIsMerging] = useState(false);

  return (
    <div 
      className="relative w-32 h-32 flex items-center justify-center cursor-pointer group"
      onMouseEnter={() => setIsMerging(true)}
      onMouseLeave={() => setIsMerging(false)}
    >
      <svg width="100%" height="100%" viewBox="0 0 200 200" className="drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
        <defs>
          <filter id="energyFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" />
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          
          <radialGradient id="blueEnergy" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          
          <radialGradient id="redEnergy" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          
          <radialGradient id="purpleCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="60%" stopColor="#7e22ce" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Blue Energy (Lapse) */}
        <motion.circle
          cx="60"
          cy="100"
          r="40"
          fill="url(#blueEnergy)"
          filter="url(#energyFilter)"
          animate={{
            x: isMerging ? 40 : 0,
            opacity: isMerging ? 0 : 0.8,
            scale: isMerging ? 0.5 : 1
          }}
          transition={{ duration: 0.6, ease: "circIn" }}
        />

        {/* Red Energy (Reversal) */}
        <motion.circle
          cx="140"
          cy="100"
          r="40"
          fill="url(#redEnergy)"
          filter="url(#energyFilter)"
          animate={{
            x: isMerging ? -40 : 0,
            opacity: isMerging ? 0 : 0.8,
            scale: isMerging ? 0.5 : 1
          }}
          transition={{ duration: 0.6, ease: "circIn" }}
        />

        {/* Purple Singularity (Hollow Purple) */}
        <AnimatePresence>
          {isMerging && (
            <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1.2 }} exit={{ opacity: 0, scale: 2 }}>
              <circle
                cx="100"
                cy="100"
                r="50"
                fill="url(#purpleCore)"
                filter="url(#energyFilter)"
                className="animate-pulse"
              />
              <motion.circle
                cx="100"
                cy="100"
                r="55"
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeDasharray="10 5"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </motion.g>
          )}
        </AnimatePresence>

        {/* Static Logo Text Core */}
        <text
          x="100"
          y="108"
          textAnchor="middle"
          fill="white"
          fontSize="24"
          fontWeight="900"
          className="font-orbitron tracking-widest pointer-events-none"
        >
          CO
        </text>
      </svg>
    </div>
  );
});

export default GojoLogo;
