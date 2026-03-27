import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Lightning = () => {
  const points = [];
  let x = 50;
  let y = 50;
  for (let i = 0; i < 8; i++) {
    x += (Math.random() - 0.5) * 40;
    y += (Math.random() - 0.5) * 40;
    points.push(`${x},${y}`);
  }
  return (
    <motion.polyline
      points={points.join(' ')}
      fill="none"
      stroke="#d8b4fe"
      strokeWidth="2"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: [0, 1, 0] }}
      transition={{ duration: 0.2, repeat: Infinity, repeatDelay: Math.random() * 0.5 }}
    />
  );
};

export default function PurpleBlast({ isVisible }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden"
        >
          {/* Chromatic Aberration Layers (Shifted RGB) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.5, 0], scale: [1, 1.2, 1], x: [-10, 10, -10] }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-cyan-500/20 mix-blend-screen blur-xl"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.5, 0], scale: [1, 1.2, 1], x: [10, -10, 10] }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-red-500/20 mix-blend-screen blur-xl"
          />

          {/* Main Electrified Shockwave */}
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 15, opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-40 h-40 rounded-full border-[10px] border-purple-300 shadow-[0_0_150px_#a855f7,inset_0_0_80px_#a855f7] bg-white/20 backdrop-blur-[10px]"
          />
          
          {/* Lightning Fractal Container */}
          <svg width="100%" height="100%" viewBox="0 0 100 100" className="absolute inset-0 scale-[1.5]">
             <defs>
               <filter id="elecGlow">
                 <feGaussianBlur stdDeviation="1" result="blur" />
                 <feComposite in="SourceGraphic" in2="blur" operator="over" />
               </filter>
             </defs>
             {Array.from({ length: 15 }).map((_, i) => <Lightning key={i} />)}
             
             <motion.circle
               cx="50"
               cy="50"
               r="0"
               fill="none"
               stroke="#a855f7"
               strokeWidth="0.2"
               animate={{ r: 100, opacity: 0 }}
               transition={{ duration: 0.6 }}
             />
          </svg>

          {/* Singular White Singularity Pulse */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 2, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 0.5 }}
            className="w-20 h-20 bg-white rounded-full blur-[40px] shadow-[0_0_100px_white]"
          />

          {/* Screen Flash Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.3, times: [0, 0.1, 1] }}
            className="absolute inset-0 bg-purple-500 mix-blend-overlay"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
