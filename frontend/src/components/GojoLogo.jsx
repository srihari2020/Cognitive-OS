import React, { memo, useState } from 'react';

/**
 * FRIDAY Orb — Clean, minimal, alive.
 * States: idle (soft glow), processing (breathe pulse), listening (cyan ring), speaking (subtle pulse)
 */
const GojoLogo = memo(({
  isProcessing = false,
  enableAnimation = false,
  isExpanded = true,
  onActivate,
  isListening = false,
  isSpeaking = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = enableAnimation && (isHovered || isProcessing || isListening || isSpeaking);

  return (
    <button
      type="button"
      onClick={onActivate}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`friday-btn relative flex h-[56px] w-[56px] items-center justify-center rounded-full border transition-all duration-500 ${
        !isExpanded ? 'scale-[0.92]' : 'scale-100'
      } ${
        isProcessing || isListening
          ? 'border-cyan-400/40 bg-cyan-400/10 friday-orb-processing'
          : isSpeaking
            ? 'border-cyan-300/50 bg-cyan-400/[0.08] shadow-[0_0_24px_rgba(0,234,255,0.2)]'
            : isHovered
              ? 'border-cyan-400/30 bg-white/[0.06] shadow-[0_0_20px_rgba(0,234,255,0.12)]'
              : 'border-white/[0.08] bg-white/[0.04] shadow-[0_0_8px_rgba(0,234,255,0.04)]'
      }`}
    >
      {/* Listening ring */}
      {isListening && (
        <span className="absolute inset-0 rounded-full border border-cyan-400/30 mic-pulse-ring" />
      )}

      {/* Speaking subtle glow */}
      {isSpeaking && (
        <span className="absolute inset-1 rounded-full bg-cyan-400/10" style={{ animation: 'friday-breathe 2s ease-in-out infinite' }} />
      )}

      {/* Core orb SVG */}
      <svg width="56" height="56" viewBox="0 0 56 56" className="relative z-10">
        <defs>
          <radialGradient id="friday-orb-grad" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="rgba(0,234,255,0.25)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Ambient glow */}
        <circle cx="28" cy="28" r={isActive ? 22 : 18} fill="url(#friday-orb-grad)" opacity={isActive ? 0.6 : 0.3} className="transition-all duration-500" />

        {/* Core ring */}
        <circle
          cx="28" cy="28" r="14"
          fill="none"
          stroke={isProcessing ? 'rgba(0,234,255,0.5)' : 'rgba(255,255,255,0.12)'}
          strokeWidth="1.5"
          className="transition-all duration-300"
        />

        {/* Inner dot */}
        <circle
          cx="28" cy="28"
          r={isActive ? 5 : 4}
          fill={isListening ? '#00eaff' : isProcessing ? '#67e8f9' : 'rgba(255,255,255,0.3)'}
          className="transition-all duration-500"
        />

        {/* Label */}
        <text
          x="28" y="46"
          textAnchor="middle"
          fill="rgba(255,255,255,0.25)"
          fontSize="7"
          fontWeight="700"
          className="font-orbitron"
          letterSpacing="0.15em"
        >
          CO
        </text>
      </svg>

      {/* Processing ring animation */}
      {isProcessing && (
        <svg className="absolute inset-0 w-full h-full friday-spin" viewBox="0 0 56 56">
          <circle
            cx="28" cy="28" r="26"
            fill="none"
            stroke="rgba(0,234,255,0.3)"
            strokeWidth="1"
            strokeDasharray="20 60"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
});

export default GojoLogo;
