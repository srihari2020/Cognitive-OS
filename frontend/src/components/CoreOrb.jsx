import React, { memo } from 'react';

/**
 * CoreOrb - Top left persistent FRIDAY indicator.
 * Uses only CSS animations for high performance.
 */
const CoreOrb = memo(({ state = 'idle' }) => {
  return (
    <div className="fixed top-6 left-6 z-[100] pointer-events-none">
      <div className={`core-orb ${state === 'listening' ? 'mic-active' : ''} ${state === 'processing' ? 'processing' : ''}`} />
      
      {/* Subtle HUD ring around the orb */}
      <svg className="absolute -inset-2 w-[76px] h-[76px] opacity-20" viewBox="0 0 100 100">
        <circle 
          cx="50" cy="50" r="48" 
          fill="none" 
          stroke="#00f0ff" 
          strokeWidth="1" 
          strokeDasharray="10 20"
          className="hud-ring"
        />
      </svg>
    </div>
  );
});

export default CoreOrb;
