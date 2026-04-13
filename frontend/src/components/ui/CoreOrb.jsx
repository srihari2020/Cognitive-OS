import React, { useEffect, useRef, memo } from 'react';
import anime from 'animejs/lib/anime.es.js';

/**
 * FRIDAY Core Orb
 * Centered animated AI core with multi-layered breathing effects.
 */
const CoreOrb = memo(({ state = 'IDLE', intensity = 1 }) => {
  const orbRef = useRef(null);
  const innerRef = useRef(null);
  const outerRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    if (!orbRef.current) return;

    // Base breathing animation
    const breathe = anime({
      targets: [innerRef.current, orbRef.current],
      scale: [0.98, 1.02],
      opacity: [0.7, 1],
      duration: 3000,
      easing: 'easeInOutSine',
      direction: 'alternate',
      loop: true,
      autoplay: true
    });

    // Rotation for the outer ring
    const rotate = anime({
      targets: ringRef.current,
      rotate: '1turn',
      duration: 10000,
      easing: 'linear',
      loop: true,
      autoplay: true
    });

    return () => {
      breathe.pause();
      rotate.pause();
    };
  }, []);

  useEffect(() => {
    // React to state changes
    if (state === 'PROCESSING') {
      anime({
        targets: innerRef.current,
        scale: [1, 1.2],
        duration: 500,
        easing: 'easeInOutQuad',
        direction: 'alternate',
        loop: true
      });
    } else if (state === 'LISTENING' || state === 'SPEAKING') {
      anime({
        targets: ringRef.current,
        strokeWidth: [1, 4],
        duration: 800,
        easing: 'easeInOutSine',
        direction: 'alternate',
        loop: true
      });
    } else {
      // Reset animations for IDLE
      anime({
        targets: [innerRef.current, ringRef.current],
        scale: 1,
        strokeWidth: 1,
        duration: 1000,
        easing: 'easeOutQuad'
      });
    }
  }, [state]);

  const getOrbColor = () => {
    switch (state) {
      case 'LISTENING': return '#00eaff';
      case 'PROCESSING': return '#7b2cff';
      case 'SPEAKING': return '#00eaff';
      case 'ERROR': return '#ff4d4d';
      default: return '#00eaff';
    }
  };

  const orbColor = getOrbColor();

  return (
    <div className="orb-container" ref={orbRef}>
      <svg width="200" height="200" viewBox="0 0 200 200" className="relative z-10">
        <defs>
          <radialGradient id="orbGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={orbColor} stopOpacity="0.8" />
            <stop offset="70%" stopColor={orbColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={orbColor} stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Ring */}
        <circle
          ref={ringRef}
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke={orbColor}
          strokeWidth="1"
          strokeDasharray="10 5"
          opacity="0.3"
        />

        {/* Outer Glow Layer */}
        <circle
          ref={outerRef}
          cx="100"
          cy="100"
          r="70"
          fill="url(#orbGradient)"
          opacity="0.4"
        />

        {/* Inner Core */}
        <circle
          ref={innerRef}
          cx="100"
          cy="100"
          r="40"
          fill={orbColor}
          filter="url(#glow)"
          opacity="0.8"
        />
        
        {/* Core Center Dot */}
        <circle
          cx="100"
          cy="100"
          r="5"
          fill="white"
          opacity="0.9"
        />
      </svg>
      
      {/* Absolute center text overlay */}
      <div className="absolute flex flex-col items-center pointer-events-none">
        <div className="orb-status-text">{state}</div>
      </div>
    </div>
  );
});

export default CoreOrb;
