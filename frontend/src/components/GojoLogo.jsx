import React, { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registerLoop, unregisterLoop } from '../utils/runtimeMetrics';

const GojoLogo = memo(({ isProcessing = false, enableAnimation = false }) => {
  const [isMerging, setIsMerging] = useState(false);
  const blueSphereRef = useRef(null);
  const redSphereRef = useRef(null);
  const purpleCoreRef = useRef(null);
  const rafRef = useRef(null);
  const angleRef = useRef(0);

  const stopAnimationLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      unregisterLoop('orb');
    }
  };

  const updateLoop = () => {
    if (!isProcessing || !enableAnimation) {
      stopAnimationLoop();
      return;
    }

    angleRef.current += 0.04; // Slightly slower for stability
    const angle = angleRef.current;
    const distance = 35; // Tighter orbit
    
    // Direct attribute manipulation for zero CSS recalculation
    if (blueSphereRef.current && redSphereRef.current) {
      const bx = Math.cos(angle) * distance;
      const by = Math.sin(angle) * distance;
      const rx = Math.cos(angle + Math.PI) * distance;
      const ry = Math.sin(angle + Math.PI) * distance;

      blueSphereRef.current.setAttribute('cx', (60 + bx).toString());
      blueSphereRef.current.setAttribute('cy', (100 + by).toString());
      redSphereRef.current.setAttribute('cx', (140 + rx).toString());
      redSphereRef.current.setAttribute('cy', (100 + ry).toString());
    }

    // Pulse effect for purple core if merging - using simple scale
    if (purpleCoreRef.current && isMerging) {
      const pulse = 1 + Math.sin(angle * 2) * 0.08;
      purpleCoreRef.current.setAttribute('transform', `scale(${pulse})`);
    }

    rafRef.current = requestAnimationFrame(updateLoop);
  };

  useEffect(() => {
    if (isProcessing && enableAnimation) {
      if (!rafRef.current) {
        // Strict: Only register and run while processing
        if (registerLoop('orb', stopAnimationLoop)) {
          rafRef.current = requestAnimationFrame(updateLoop);
        }
      }
    } else {
      // Immediate Stop when processing ends or animation is disabled
      stopAnimationLoop();
      // Reset positions to baseline immediately
      if (blueSphereRef.current) {
        blueSphereRef.current.setAttribute('cx', '60');
        blueSphereRef.current.setAttribute('cy', '100');
      }
      if (redSphereRef.current) {
        redSphereRef.current.setAttribute('cx', '140');
        redSphereRef.current.setAttribute('cy', '100');
      }
      if (purpleCoreRef.current) {
        purpleCoreRef.current.setAttribute('transform', 'scale(1)');
      }
    }

    return () => stopAnimationLoop();
  }, [isProcessing, enableAnimation]);

  return (
    <div 
      className="relative w-32 h-32 flex items-center justify-center cursor-pointer group"
      onMouseEnter={() => setIsMerging(true)}
      onMouseLeave={() => setIsMerging(false)}
    >
      <svg width="100%" height="100%" viewBox="0 0 200 200">
        <defs>
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

        {/* Blue Energy (Lapse) - Minimal Visual Cost */}
        <circle
          ref={blueSphereRef}
          cx="60"
          cy="100"
          r="30"
          fill="url(#blueEnergy)"
          opacity="0.5"
        />

        {/* Red Energy (Reversal) - Minimal Visual Cost */}
        <circle
          ref={redSphereRef}
          cx="140"
          cy="100"
          r="30"
          fill="url(#redEnergy)"
          opacity="0.5"
        />

        {/* Purple Singularity - Optimized Path */}
        <AnimatePresence>
          {isMerging && (
            <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1.2 }} exit={{ opacity: 0, scale: 2 }}>
              <circle
                ref={purpleCoreRef}
                cx="100"
                cy="100"
                r="40"
                fill="url(#purpleCore)"
                className="origin-center"
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
