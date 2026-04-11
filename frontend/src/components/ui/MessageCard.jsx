import React, { memo, useEffect, useRef } from 'react';
import anime from 'animejs/lib/anime.es.js';
import { FridayIcon } from './Icons';

const MessageCard = memo(({ role, content, provider }) => {
  const cardRef = useRef(null);

  useEffect(() => {
    if (!cardRef.current) return;
    anime({
      targets: cardRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
      scale: [0.98, 1],
      duration: 400,
      easing: 'easeOutCubic'
    });
  }, []);

  const handleMouseEnter = () => {
    if (!cardRef.current) return;
    anime({
      targets: cardRef.current,
      translateY: -4,
      duration: 300,
      easing: 'easeOutQuad'
    });
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    anime({
      targets: cardRef.current,
      translateY: 0,
      duration: 300,
      easing: 'easeOutQuad'
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`message-card flex flex-col gap-2 p-4 rounded-2xl border transition-colors duration-300 ${
        role === 'user'
          ? 'ml-auto border-white/10 bg-white/5 text-white max-w-[75%]'
          : 'mr-auto border-cyan-500/20 bg-cyan-500/[0.03] text-cyan-50 max-w-[85%]'
      }`}
    >
      <div className="flex items-center gap-2">
        {role === 'assistant' && (
          <FridayIcon className="w-3 h-3 text-cyan-400" />
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
          {role === 'user' ? 'User' : (provider || 'FRIDAY')}
        </span>
      </div>
      <p className="text-[14px] leading-relaxed font-medium">
        {content}
      </p>
    </div>
  );
});

export default MessageCard;
