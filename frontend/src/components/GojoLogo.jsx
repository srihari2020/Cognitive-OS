import React, { memo, useState } from 'react';

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
    <button
      type="button"
      onClick={onActivate}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-full border transition-all duration-500 ${
        !isExpanded ? 'scale-[0.92]' : 'scale-100'
      } ${
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
        <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-pulse scale-125" />
      )}
      
      {/* Speaking Waveform Pulse */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-pulse scale-110" />
      )}
      {/* Idle pulse ring */}
      <div className={`absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(0,243,255,0.2),transparent_62%)] animate-pulse ${isCharged ? 'opacity-50' : 'opacity-20'}`} />
      
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
        <circle
          cx="22"
          cy="36"
          r="12"
          fill="url(#orb-cyan)"
          opacity="0.88"
        />
        {/* Purple orb — right */}
        <circle
          cx="50"
          cy="36"
          r="12"
          fill="url(#orb-purple)"
          opacity="0.88"
        />
        {/* Center merge zone */}
        <circle
          cx="36"
          cy="36"
          r={isCharged ? 14 : 10}
          fill="rgba(255,255,255,0.1)"
        />
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
      {isProcessing && (
        <div className="absolute inset-0 rounded-full border border-purple-400/50 animate-ping" />
      )}
      {/* Hover energy charge outer ring */}
      {isHovered && !isProcessing && (
        <div className="absolute -inset-1 rounded-full border border-cyan-300/25" />
      )}
    </button>
  );
});

export default GojoLogo;
