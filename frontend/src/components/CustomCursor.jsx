import React, { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const glowRef = useRef(null);
  const ringRef = useRef(null);
  const lastMoveRef = useRef(0);
  const isPointerRef = useRef(false);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    // Optimization: Cache interactive elements to avoid closest() or heavy matching
    const isClickable = (el) => {
      if (!el || el.nodeType !== 1) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || 
             el.getAttribute('role') === 'button' || el.hasAttribute('data-clickable');
    };

    const updateCursorStyle = (isPointer) => {
      if (!dotRef.current || !glowRef.current || !ringRef.current) return;
      
      const dotScale = isPointer ? 'scale(2.5)' : 'scale(1)';
      const glowScale = isPointer ? 'scale(1.5)' : 'scale(1)';
      const ringScale = isPointer ? 'scale(0.5)' : 'scale(1.2)';
      const ringOpacity = isPointer ? '0.8' : '0.4';

      dotRef.current.style.transform = `${dotRef.current.dataset.translate} ${dotScale}`;
      glowRef.current.style.transform = `${glowRef.current.dataset.translate} ${glowScale}`;
      ringRef.current.style.transform = `${ringRef.current.dataset.translate} ${ringScale}`;
      ringRef.current.style.opacity = ringOpacity;
    };

    const handlePointerOver = (e) => {
      const next = isClickable(e.target);
      if (next !== isPointerRef.current) {
        isPointerRef.current = next;
        updateCursorStyle(next);
      }
    };

    const handleMouseMove = (e) => {
      const now = performance.now();
      // Throttle to ~45ms (approx 22fps for the cursor follow, keeps main thread clear)
      if (now - lastMoveRef.current < 45) return;
      lastMoveRef.current = now;

      const { clientX: x, clientY: y } = e;
      
      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        if (dotRef.current) dotRef.current.style.opacity = '1';
        if (glowRef.current) glowRef.current.style.opacity = '0.2';
        if (ringRef.current) ringRef.current.style.opacity = '0.4';
      }

      // Use translate3d for hardware acceleration
      const translate = `translate3d(${x}px, ${y}px, 0)`;
      if (dotRef.current) {
        dotRef.current.dataset.translate = translate;
        dotRef.current.style.transform = `${translate} scale(${isPointerRef.current ? 2.5 : 1})`;
      }
      if (glowRef.current) {
        glowRef.current.dataset.translate = translate;
        glowRef.current.style.transform = `${translate} scale(${isPointerRef.current ? 1.5 : 1})`;
      }
      if (ringRef.current) {
        ringRef.current.dataset.translate = translate;
        ringRef.current.style.transform = `${translate} scale(${isPointerRef.current ? 0.5 : 1.2})`;
      }
    };

    const handleMouseLeave = () => {
      isVisibleRef.current = false;
      if (dotRef.current) dotRef.current.style.opacity = '0';
      if (glowRef.current) glowRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('pointerover', handlePointerOver, { passive: true, capture: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerover', handlePointerOver, { capture: true });
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const baseStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    opacity: 0,
    transition: 'opacity 0.2s ease, transform 0.1s ease-out', // Minimal smoothing
    zIndex: 10000,
  };

  return (
    <>
      <div
        ref={dotRef}
        className="w-3 h-3 bg-white rounded-full mix-blend-difference"
        style={{ ...baseStyle, marginLeft: '-6px', marginTop: '-6px' }}
      />
      <div
        ref={glowRef}
        className="w-32 h-32 rounded-full"
        style={{
          ...baseStyle,
          marginLeft: '-64px',
          marginTop: '-64px',
          background: 'radial-gradient(circle, rgba(0, 243, 255, 0.3) 0%, transparent 70%)',
          zIndex: 9999,
        }}
      />
      <div
        ref={ringRef}
        className="w-10 h-10 border border-neon-cyan rounded-full"
        style={{ ...baseStyle, marginLeft: '-20px', marginTop: '-20px', zIndex: 9999 }}
      />
    </>
  );
}
