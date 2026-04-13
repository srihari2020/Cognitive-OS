import React, { memo, useEffect, useRef } from 'react';
import anime from 'animejs/lib/anime.es.js';

/**
 * FRIDAY Mic Button
 * Large circular button with anime.js animated waves.
 */
const MicButton = memo(({ isListening, isSpeaking, isProcessing, onClick }) => {
  const wave1Ref = useRef(null);
  const wave2Ref = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    let animations = [];

    if (isListening || isSpeaking || isProcessing) {
      animations.push(
        anime({
          targets: wave1Ref.current,
          scale: [0.8, 1.5],
          opacity: [0.5, 0],
          duration: 1500,
          easing: 'easeOutExpo',
          loop: true
        })
      );

      animations.push(
        anime({
          targets: wave2Ref.current,
          scale: [0.8, 2],
          opacity: [0.3, 0],
          duration: 2000,
          delay: 500,
          easing: 'easeOutExpo',
          loop: true
        })
      );
    }

    if (isListening) {
      animations.push(
        anime({
          targets: buttonRef.current,
          boxShadow: [
            '0 0 0px rgba(0, 234, 255, 0)',
            '0 0 30px rgba(0, 234, 255, 0.6)'
          ],
          duration: 800,
          direction: 'alternate',
          easing: 'easeInOutSine',
          loop: true
        })
      );
    }

    return () => {
      animations.forEach(a => a.pause());
    };
  }, [isListening, isSpeaking, isProcessing]);

  return (
    <div className="relative flex flex-col items-center gap-6 mt-8">
      <div className="relative w-20 h-20">
        {/* Animated Background Waves */}
        <div 
          ref={wave1Ref}
          className="absolute inset-0 rounded-full border border-cyan-400/30 pointer-events-none opacity-0"
        />
        <div 
          ref={wave2Ref}
          className="absolute inset-0 rounded-full border border-cyan-400/20 pointer-events-none opacity-0"
        />

        {/* Main Button */}
        <button
          ref={buttonRef}
          onClick={onClick}
          className={`relative z-20 w-full h-full rounded-full flex items-center justify-center transition-all duration-500 glass-ui friday-btn ${
            isListening ? 'border-cyan-400 bg-cyan-400/20' : 
            isProcessing ? 'border-purple-500 bg-purple-500/20' : 'border-white/10 hover:border-white/30'
          }`}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isListening ? 'text-cyan-400' : 'text-white'}>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>
      </div>
      
      {/* Helper Text */}
      <div className={`text-[10px] font-mono tracking-[0.2em] text-cyan-400 uppercase transition-opacity duration-300 ${isListening ? 'opacity-100' : 'opacity-40'}`}>
        {isListening ? 'Listening...' : isProcessing ? 'Processing...' : 'Click to Speak'}
      </div>
    </div>
  );
});

export default MicButton;
