import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registerLoop, unregisterLoop } from '../utils/runtimeMetrics';

export default function PurpleBlast({ isVisible, qualityLevel = 'HIGH' }) {
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const isSimplified = qualityLevel === 'LOW' || qualityLevel === 'MEDIUM';

  const stopEffect = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      unregisterLoop('purple');
    }
  };

  useEffect(() => {
    if (isVisible) {
      startTimeRef.current = performance.now();
      
      const update = (now) => {
        const elapsed = now - startTimeRef.current;
        if (elapsed > 1500) { // Safety auto-stop at 1.5s
          stopEffect();
          return;
        }
        rafRef.current = requestAnimationFrame(update);
      };

      if (registerLoop('purple', stopEffect)) {
        rafRef.current = requestAnimationFrame(update);
      }
    } else {
      stopEffect();
    }
    return () => stopEffect();
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden"
        >
          {/* Performance Optimized Shockwave: Use transform/scale/opacity only */}
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: isSimplified ? 10 : 20, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`w-40 h-40 rounded-full border-[4px] border-purple-400/60 bg-purple-500/10 
                       ${isSimplified ? '' : 'shadow-[0_0_100px_rgba(168,85,247,0.4)]'}`}
            style={{ willChange: 'transform, opacity' }}
          />

          {/* Core Singularity Pulse: Simplified for zero GPU impact */}
          {!isSimplified && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2, 4], opacity: [0, 0.8, 0] }}
              transition={{ duration: 0.6, ease: "circOut" }}
              className="absolute w-20 h-20 bg-white/40 rounded-full blur-[20px]"
              style={{ willChange: 'transform, opacity' }}
            />
          )}

          {/* Minimal Screen Flash: Direct opacity animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-purple-600/30 mix-blend-screen"
            style={{ willChange: 'opacity' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
