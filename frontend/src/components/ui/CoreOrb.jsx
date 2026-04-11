import React, { useEffect, useRef, memo } from 'react';
import anime from 'animejs/lib/anime.es.js';

const CoreOrb = memo(({ state = 'idle' }) => {
  const orbRef = useRef(null);
  const ringRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    // Safety check: ensure elements exist
    if (!orbRef.current || !ringRef.current) return;

    // Stop and clear previous animations to prevent memory leaks/glitches
    if (animationRef.current) {
      animationRef.current.pause();
    }
    anime.remove([orbRef.current, ringRef.current]);

    // Setup animations based on current state
    if (state === 'listening') {
      animationRef.current = anime({
        targets: orbRef.current,
        scale: [1, 1.2],
        opacity: [0.8, 1],
        boxShadow: '0 0 40px #00f0ff',
        duration: 800,
        direction: 'alternate',
        loop: true,
        easing: 'easeInOutSine'
      });
      anime({
        targets: ringRef.current,
        rotate: '360deg',
        duration: 2000,
        loop: true,
        easing: 'linear'
      });
    } else if (state === 'processing') {
      animationRef.current = anime({
        targets: orbRef.current,
        scale: [1.1, 1],
        opacity: [1, 0.6],
        duration: 400,
        direction: 'alternate',
        loop: true,
        easing: 'easeInOutQuad'
      });
      anime({
        targets: ringRef.current,
        rotate: '360deg',
        duration: 1000,
        loop: true,
        easing: 'linear'
      });
    } else {
      // Idle pulse state (FRIDAY style)
      animationRef.current = anime({
        targets: orbRef.current,
        scale: [1, 1.05],
        opacity: [0.7, 0.9],
        boxShadow: '0 0 20px #00f0ff',
        duration: 2000,
        direction: 'alternate',
        loop: true,
        easing: 'easeInOutQuad'
      });
      anime({
        targets: ringRef.current,
        rotate: '360deg',
        duration: 10000,
        loop: true,
        easing: 'linear'
      });
    }

    return () => {
      if (animationRef.current) animationRef.current.pause();
      anime.remove([orbRef.current, ringRef.current]);
    };
  }, [state]);

  return (
    <div className="fixed top-8 left-8 z-[100] flex items-center justify-center">
      {/* Outer HUD Ring */}
      <svg ref={ringRef} className="absolute w-24 h-24 opacity-30" viewBox="0 0 100 100">
        <circle 
          cx="50" cy="50" r="45" 
          fill="none" 
          stroke="#00f0ff" 
          strokeWidth="1" 
          strokeDasharray="15 10" 
        />
      </svg>
      
      {/* Core Orb */}
      <div 
        ref={orbRef}
        className="w-14 h-14 rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #00f0ff, #001a2e)',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          boxShadow: '0 0 20px #00f0ff'
        }}
      />
    </div>
  );
});

export default CoreOrb;
