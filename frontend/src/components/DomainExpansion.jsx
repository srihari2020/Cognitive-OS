import React, { memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registerLoop, unregisterLoop } from '../utils/runtimeMetrics';

const DomainExpansion = memo(({ isActive, qualityLevel = 'HIGH' }) => {
  const isSimplified = qualityLevel === 'LOW' || qualityLevel === 'MEDIUM';
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (!isActive) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        unregisterLoop('domain');
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    startTimeRef.current = performance.now();

    // Init starfield dots (max 20)
    const particleCount = isSimplified ? 10 : 20;
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 2 + 0.1, // depth for parallax
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.2,
      baseX: Math.random() * w,
      baseY: Math.random() * h
    }));

    const stopLoop = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        unregisterLoop('domain');
      }
    };

    const draw = (now) => {
      const elapsed = now - startTimeRef.current;
      ctx.clearRect(0, 0, w, h);

      // We handle CSS overlays for rigid phases. Canvas only kicks in smoothly.
      if (elapsed > 100) {
        let voidAlpha = 0;
        if (elapsed < 400) {
          voidAlpha = (elapsed - 100) / 300; 
        } else if (elapsed < 1000) {
          voidAlpha = 1;
        } else if (elapsed <= 1200) {
          voidAlpha = Math.max(0, 1 - ((elapsed - 1000) / 200));
        }

        ctx.globalAlpha = voidAlpha;

        // Space distortion grid
        ctx.strokeStyle = 'rgba(0, 234, 255, 0.05)'; // Electric blue faint tint
        ctx.lineWidth = 1;
        const gridSize = 80;
        const gridOffset = (elapsed * 0.03) % gridSize; 
        
        ctx.beginPath();
        for (let x = gridOffset; x < w; x += gridSize) {
          ctx.moveTo(x, 0); ctx.lineTo(x, h);
        }
        for (let y = gridOffset; y < h; y += gridSize) {
          ctx.moveTo(0, y); ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Starfield Particles with subtle mouse parallax
        const cx = w / 2;
        const cy = h / 2;
        const dx = (mouseRef.current.x - cx) * 0.05;
        const dy = (mouseRef.current.y - cy) * 0.05;

        particles.forEach(p => {
          // Slow floating up/left
          p.baseX -= 0.15 * p.z;
          p.baseY -= 0.1 * p.z;
          if (p.baseX < 0) p.baseX = w;
          if (p.baseY < 0) p.baseY = h;

          const px = p.baseX - dx * p.z;
          const py = p.baseY - dy * p.z;

          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(123, 44, 255, ${p.opacity * voidAlpha})`; // Violet tint
          ctx.fill();
        });

        ctx.globalAlpha = 1.0;
      }

      if (elapsed < 1200) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        stopLoop();
      }
    };

    if (registerLoop('domain', stopLoop)) {
      rafRef.current = requestAnimationFrame(draw);
    }

    return () => {
      stopLoop();
    };
  }, [isActive, isSimplified]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden"
        >
          {/* PHASE 1: Slight screen dim (rgba black overlay 0.2) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 bg-black/20"
          />

          {/* Infinite Void Space Vignette (Deep Black / Edge darkness) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_100%)]"
          />

          {/* PHASE 3 Canvas (Starfield / Grid) */}
          <canvas ref={canvasRef} className="absolute inset-0" />

          {/* PHASE 2: Radial expansion ring (purple/blue gradient) */}
          {/* scale 0 -> 3, opacity 0.6 -> 0 */}
          <motion.div
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: isSimplified ? 2.5 : 3, opacity: 0 }}
            transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
            className="absolute h-64 w-64 rounded-full border-[6px]"
            style={{
              borderColor: 'rgba(0,0,0,0)',
              background: 'radial-gradient(circle, transparent 50%, rgba(123,44,255,0.4) 80%, rgba(0,234,255,0.8) 100%)',
              maskImage: 'radial-gradient(circle, transparent 96%, black 100%)',
              WebkitMaskImage: 'radial-gradient(circle, transparent 96%, black 100%)',
            }}
          />

          {/* PHASE 1: Center orb glow intensifies */}
          <motion.div
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 0.3 }}
            transition={{ duration: 0.1 }}
            className="absolute h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(0,234,255,0.9)_0%,transparent_70%)]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default DomainExpansion;
