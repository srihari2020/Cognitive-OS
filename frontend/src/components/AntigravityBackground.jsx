import React, { useEffect, useMemo, useRef } from 'react';
import { useUI } from '../context/UIContext';
import { registerLoop, unregisterLoop } from '../utils/runtimeMetrics';

const PARTICLE_MAP = {
  HIGH: 14,
  MEDIUM: 12,
  LOW: 10,
  OFF: 0,
};

export default function AntigravityBackground({
  isSearching,
  isProcessing,
  isMerging,
  animationState,
  allowNewAnimations = true,
  qualityLevel = 'HIGH',
  qualityScalar = 1,
}) {
  const { intensity, uiMode } = useUI();
  const orbitalLayerRef = useRef(null);
  const particleRefs = useRef([]);
  const glowRef = useRef(null);
  const rafRef = useRef(null);
  const particleModelRef = useRef([]);
  const viewportRef = useRef({ width: window.innerWidth, height: window.innerHeight, cx: window.innerWidth / 2, cy: window.innerHeight / 2 });
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const runtimeRef = useRef({ isSearching: false, isProcessing: false, isMerging: false, intensity: 1, uiMode: 'smart', animationState: 'IDLE' });
  const particleCount = PARTICLE_MAP[qualityLevel] ?? 12;
  const particles = useMemo(() => Array.from({ length: particleCount }, (_, index) => index), [particleCount]);

  const isActive = isSearching || isProcessing || isMerging || animationState !== 'IDLE';

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      // Update glow position via CSS (idle-safe, no RAF needed)
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${e.clientX - 140}px, ${e.clientY - 140}px, 0)`;
      }
    };
    const handleResize = () => {
      viewportRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
        cx: window.innerWidth / 2,
        cy: window.innerHeight / 2,
      };
      // Re-seed CSS particle positions on resize
      seedCSSParticles();
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    runtimeRef.current = { isSearching, isProcessing, isMerging, intensity, uiMode, animationState, qualityLevel, qualityScalar };
  }, [isSearching, isProcessing, isMerging, intensity, uiMode, animationState, qualityLevel, qualityScalar]);

  // Seed particle positions and CSS animation properties
  const seedCSSParticles = () => {
    const { width, height } = viewportRef.current;
    particleModelRef.current = particles.map((index) => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = 1.5 + Math.random() * 2.5;
      const orbitRadius = 80 + Math.random() * 220;
      const driftX = 10 + Math.random() * 30;
      const driftY = 10 + Math.random() * 25;
      const driftX2 = -(8 + Math.random() * 20);
      const driftY2 = 5 + Math.random() * 18;
      const duration = 12 + Math.random() * 18;
      const delay = -(Math.random() * duration);
      const opacity = 0.25 + Math.random() * 0.2;
      const tint = index % 3 === 0
        ? 'rgba(0,243,255,0.75)'
        : index % 3 === 1
          ? 'rgba(168,85,247,0.65)'
          : 'rgba(0,200,255,0.55)';

      return { x, y, radius, orbitRadius, driftX, driftY, driftX2, driftY2, duration, delay, opacity, tint,
        orbitOffset: (Math.PI * 2 * index) / Math.max(1, particles.length),
        speed: 0.00018 + Math.random() * 0.00022,
        drift: 8 + Math.random() * 20,
      };
    });
    particleRefs.current = particleRefs.current.slice(0, particles.length);
  };

  useEffect(() => {
    seedCSSParticles();
    // Apply CSS idle animation to each particle
    applyCSSIdleMode();
  }, [particles]);

  // Apply CSS-only animation (0 JS loops)
  const applyCSSIdleMode = () => {
    particleModelRef.current.forEach((p, index) => {
      const el = particleRefs.current[index];
      if (!el) return;
      el.style.setProperty('--px', `${p.x}px`);
      el.style.setProperty('--py', `${p.y}px`);
      el.style.setProperty('--po', `${p.opacity}`);
      el.style.setProperty('--drift-x', `${p.driftX}px`);
      el.style.setProperty('--drift-y', `${p.driftY}px`);
      el.style.setProperty('--drift-x2', `${p.driftX2}px`);
      el.style.setProperty('--drift-y2', `${p.driftY2}px`);
      el.style.width = `${p.radius * 2}px`;
      el.style.height = `${p.radius * 2}px`;
      el.style.background = p.tint;
      el.style.animation = `particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`;
      el.style.opacity = `${p.opacity}`;
    });
  };

  // Clear CSS animation and switch to RAF-driven transforms
  const clearCSSIdleMode = () => {
    particleModelRef.current.forEach((_, index) => {
      const el = particleRefs.current[index];
      if (!el) return;
      el.style.animation = 'none';
    });
  };

  const stopAnimationLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      unregisterLoop('background');
    }
  };

  const updateLoop = (now) => {
    const { isSearching: searching, isProcessing: processing, isMerging: merging, intensity: uiIntensity, uiMode: mode, qualityScalar: qualityTarget, animationState: currentAnimationState } = runtimeRef.current;
    const activeFrame = searching || processing || merging || currentAnimationState !== 'IDLE';

    if (!activeFrame || qualityTarget <= 0.05) {
      // Switch back to CSS idle mode
      stopAnimationLoop();
      applyCSSIdleMode();
      return;
    }

    const { cx, cy } = viewportRef.current;
    const pullX = (mouseRef.current.x - cx) * 0.03;
    const pullY = (mouseRef.current.y - cy) * 0.03;

    particleModelRef.current.forEach((particle, index) => {
      const element = particleRefs.current[index];
      if (!element) return;
      const orbit = particle.orbitOffset + now * particle.speed;
      const speedMult = processing ? 1.6 : 1;
      const x = cx + Math.cos(orbit * speedMult) * particle.orbitRadius + Math.sin(orbit * 2.2) * particle.drift + pullX;
      const y = cy + Math.sin(orbit * speedMult) * (particle.orbitRadius * 0.42) + Math.cos(orbit * 1.8) * particle.drift + pullY;
      const opacity = 0.28 + Math.sin(orbit * 2 + index) * 0.18 + Math.min(uiIntensity, 1) * 0.18;
      const scale = mode === 'focus' ? 0.9 : processing ? 1.2 : 1;
      element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      element.style.opacity = `${Math.max(0.18, Math.min(0.78, opacity))}`;
      element.style.background = particle.tint;
      element.style.width = `${particle.radius * 2}px`;
      element.style.height = `${particle.radius * 2}px`;
    });

    if (orbitalLayerRef.current) {
      orbitalLayerRef.current.style.transform = `translate3d(${pullX * 0.18}px, ${pullY * 0.18}px, 0)`;
      orbitalLayerRef.current.style.opacity = `${Math.min(0.6, 0.22 + uiIntensity * 0.25)}`;
    }

    if (glowRef.current) {
      glowRef.current.style.opacity = processing ? '0.38' : '0.22';
    }

    rafRef.current = requestAnimationFrame(updateLoop);
  };

  useEffect(() => {
    const shouldRunRAF = allowNewAnimations && isActive;
    if (shouldRunRAF && !rafRef.current) {
      clearCSSIdleMode();
      if (registerLoop('background', stopAnimationLoop)) {
        rafRef.current = requestAnimationFrame(updateLoop);
      }
    } else if (!shouldRunRAF) {
      stopAnimationLoop();
      applyCSSIdleMode();
    }
    return () => stopAnimationLoop();
  }, [isSearching, isProcessing, isMerging, animationState, allowNewAnimations]);

  useEffect(() => () => stopAnimationLoop(), []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Mouse-reactive glow orb */}
      <div
        ref={glowRef}
        className="mouse-glow absolute h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,243,255,0.14),transparent_64%)]"
        style={{ opacity: 0.18 }}
      />
      {/* Orbital particle layer */}
      <div ref={orbitalLayerRef} className="absolute inset-0" style={{ opacity: 0.5 }}>
        {particles.map((particle) => (
          <span
            key={particle}
            ref={(element) => {
              particleRefs.current[particle] = element;
            }}
            className="absolute rounded-full will-change-transform"
          />
        ))}
      </div>
      {/* Ambient radial gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,243,255,0.06),transparent_36%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.06),transparent_38%)]" />
      {/* Subtle grid overlay for JARVIS feel */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,243,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,243,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  );
}
