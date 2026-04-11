import React, { memo, useEffect, useRef } from 'react';
import anime from 'animejs/lib/anime.es.js';
import { MicIcon } from './Icons';

const MicButton = memo(({ isListening, isSpeaking, onClick }) => {
  const buttonRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    if (!buttonRef.current || !glowRef.current) return;

    if (isListening) {
      anime({
        targets: buttonRef.current,
        scale: [1, 1.15],
        duration: 600,
        direction: 'alternate',
        loop: true,
        easing: 'easeInOutSine'
      });
      anime({
        targets: glowRef.current,
        opacity: [0.2, 0.6],
        scale: [1, 1.4],
        duration: 600,
        direction: 'alternate',
        loop: true,
        easing: 'easeOutQuad'
      });
    } else {
      anime({
        targets: [buttonRef.current, glowRef.current],
        scale: 1,
        opacity: 0,
        duration: 300,
        easing: 'easeOutQuad'
      });
    }

    return () => {
      if (buttonRef.current) anime.remove(buttonRef.current);
      if (glowRef.current) anime.remove(glowRef.current);
    };
  }, [isListening]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Dynamic Glow Layer */}
      <div 
        ref={glowRef}
        className="absolute inset-0 rounded-xl bg-cyan-400 opacity-0 pointer-events-none blur-md"
      />
      
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
          isListening 
            ? 'bg-cyan-400 text-black shadow-[0_0_20px_rgba(0,240,255,0.4)]' 
            : isSpeaking
              ? 'bg-purple-500 text-white'
              : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
        }`}
      >
        <MicIcon className={`h-5 w-5 ${isListening || isSpeaking ? 'animate-pulse' : ''}`} />
      </button>
    </div>
  );
});

export default MicButton;
