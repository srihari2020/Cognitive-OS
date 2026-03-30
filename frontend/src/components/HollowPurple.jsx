import React, { memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * HollowPurple — Orbital collision build-up + shockwave blast.
 *
 * States:
 *   IDLE       → nothing rendered
 *   PROCESSING → red + blue spheres orbit and spiral inward
 *   EXECUTING  → spheres collide at center → purple shockwave blast
 *   COMPLETE   → fade out
 */
const HollowPurple = memo(({ animationState, qualityLevel = 'HIGH' }) => {
  const isSimplified = qualityLevel === 'LOW' || qualityLevel === 'MEDIUM';
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const phaseRef = useRef('idle');

  const showOrbitals = animationState === 'PROCESSING';
  const showBlast = animationState === 'EXECUTING';
  const showAnything = showOrbitals || showBlast || animationState === 'COMPLETE';

  useEffect(() => {
    if (!showOrbitals) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    startRef.current = performance.now();
    phaseRef.current = 'orbiting';

    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = Math.min(w, h) * 0.28;
    const trailLength = isSimplified ? 6 : 12;

    // Trail history for energy tails
    const redTrail = [];
    const blueTrail = [];

    const draw = (now) => {
      const elapsed = (now - startRef.current) / 1000;
      ctx.clearRect(0, 0, w, h);

      // Spiral inward over time — radius shrinks from maxRadius to ~20px
      const spiralProgress = Math.min(1, elapsed / 3.5); // 3.5s to converge
      const eased = spiralProgress * spiralProgress; // ease-in for dramatic convergence
      const currentRadius = maxRadius * (1 - eased * 0.92);
      const speed = 2.2 + spiralProgress * 3.5; // accelerate as they converge

      const angle = elapsed * speed;

      // Red sphere (attraction) — clockwise
      const redX = cx + Math.cos(angle) * currentRadius;
      const redY = cy + Math.sin(angle) * currentRadius * 0.55;

      // Blue sphere (repulsion) — counter-clockwise, offset by PI
      const blueX = cx + Math.cos(angle + Math.PI) * currentRadius;
      const blueY = cy + Math.sin(angle + Math.PI) * currentRadius * 0.55;

      // Update trails
      redTrail.push({ x: redX, y: redY });
      blueTrail.push({ x: blueX, y: blueY });
      if (redTrail.length > trailLength) redTrail.shift();
      if (blueTrail.length > trailLength) blueTrail.shift();

      // Draw energy trails
      const drawTrail = (trail, color) => {
        for (let i = 0; i < trail.length; i++) {
          const t = i / trail.length;
          const alpha = t * 0.4;
          const size = 3 + t * 6;
          ctx.beginPath();
          ctx.arc(trail[i].x, trail[i].y, size, 0, Math.PI * 2);
          ctx.fillStyle = color.replace('ALPHA', alpha.toFixed(2));
          ctx.fill();
        }
      };

      drawTrail(redTrail, 'rgba(255,80,80,ALPHA)');
      drawTrail(blueTrail, 'rgba(80,140,255,ALPHA)');

      // Draw connection line between spheres (energy link)
      const linkAlpha = 0.06 + spiralProgress * 0.12;
      ctx.beginPath();
      ctx.moveTo(redX, redY);
      ctx.lineTo(blueX, blueY);
      ctx.strokeStyle = `rgba(168,85,247,${linkAlpha})`;
      ctx.lineWidth = 1 + spiralProgress * 2;
      ctx.stroke();

      // Draw center convergence glow
      if (spiralProgress > 0.3) {
        const glowAlpha = (spiralProgress - 0.3) * 0.35;
        const glowSize = 15 + spiralProgress * 30;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize);
        gradient.addColorStop(0, `rgba(168,85,247,${glowAlpha})`);
        gradient.addColorStop(0.5, `rgba(168,85,247,${glowAlpha * 0.4})`);
        gradient.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // RED sphere — main
      const redGlow = ctx.createRadialGradient(redX, redY, 0, redX, redY, 18 + spiralProgress * 8);
      redGlow.addColorStop(0, 'rgba(255,100,100,0.9)');
      redGlow.addColorStop(0.4, 'rgba(255,60,60,0.4)');
      redGlow.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.beginPath();
      ctx.arc(redX, redY, 18 + spiralProgress * 8, 0, Math.PI * 2);
      ctx.fillStyle = redGlow;
      ctx.fill();
      // Core
      ctx.beginPath();
      ctx.arc(redX, redY, 6 + spiralProgress * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,160,160,0.95)';
      ctx.fill();

      // BLUE sphere — main
      const blueGlow = ctx.createRadialGradient(blueX, blueY, 0, blueX, blueY, 18 + spiralProgress * 8);
      blueGlow.addColorStop(0, 'rgba(100,160,255,0.9)');
      blueGlow.addColorStop(0.4, 'rgba(60,120,255,0.4)');
      blueGlow.addColorStop(1, 'rgba(60,120,255,0)');
      ctx.beginPath();
      ctx.arc(blueX, blueY, 18 + spiralProgress * 8, 0, Math.PI * 2);
      ctx.fillStyle = blueGlow;
      ctx.fill();
      // Core
      ctx.beginPath();
      ctx.arc(blueX, blueY, 6 + spiralProgress * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160,200,255,0.95)';
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [showOrbitals, isSimplified]);

  // Clean canvas when orbitals stop
  useEffect(() => {
    if (!showOrbitals && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [showOrbitals]);

  return (
    <>
      {/* Orbital canvas — visible during PROCESSING */}
      <AnimatePresence>
        {showOrbitals && (
          <motion.canvas
            ref={canvasRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </AnimatePresence>

      {/* Blast shockwave — fires on EXECUTING */}
      <AnimatePresence>
        {showBlast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden"
          >
            {/* Primary shockwave ring */}
            <motion.div
              initial={{ scale: 0.1, opacity: 0.9 }}
              animate={{ scale: isSimplified ? 6 : 8, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute h-24 w-24 rounded-full border-2 border-purple-300/70"
            />
            {/* Secondary ring — thinner, faster */}
            <motion.div
              initial={{ scale: 0.15, opacity: 0.7 }}
              animate={{ scale: isSimplified ? 8 : 10, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute h-16 w-16 rounded-full border border-purple-200/40"
            />
            {/* Core purple flash */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute h-20 w-20 rounded-full bg-purple-400/35"
            />
            {/* Red remnant ring */}
            <motion.div
              initial={{ scale: 0.2, opacity: 0.5 }}
              animate={{ scale: 5, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
              className="absolute h-12 w-12 rounded-full border border-red-400/30"
            />
            {/* Blue remnant ring */}
            <motion.div
              initial={{ scale: 0.2, opacity: 0.5 }}
              animate={{ scale: 6, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="absolute h-12 w-12 rounded-full border border-blue-400/30"
            />
            {/* Screen flash */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.08, 0] }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 bg-purple-200"
            />
            {/* Radial energy burst */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.22, 0] }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.25),transparent_45%)]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default HollowPurple;
