import React, { useEffect, useRef } from 'react';
import Matter from 'matter-js';
import { useUI } from '../context/UIContext';
import { registerLoop, unregisterLoop } from '../utils/runtimeMetrics';

const MATH_SYMBOLS = ['∫', '∑', '∞', 'λ', '∂', '∅', '∇', '∏', '√', 'π'];

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
  const containerRef = useRef(null);
  const debrisContainerRef = useRef(null);
  const orbitalLayerRef = useRef(null);
  const blueSphereRef = useRef(null);
  const redSphereRef = useRef(null);
  const blueTrailRef = useRef(null);
  const redTrailRef = useRef(null);
  const turbulenceRef = useRef(null);
  const displacementRef = useRef(null);
  const engineRef = useRef(Matter.Engine.create());
  const rafRef = useRef(null);
  const debrisRefs = useRef({ bodies: [], elements: [] });
  const viewportRef = useRef({ width: window.innerWidth, height: window.innerHeight });
  const mouseRef = useRef({ x: 0, y: 0 });
  const orbitalStateRef = useRef({ angle: 0, velocity: 0.02, energy: 0, lastTime: 0 });
  const visualScaleRef = useRef(1);
  const maxActiveMsRef = useRef(0);
  const runtimeRef = useRef({ isSearching: false, isProcessing: false, isMerging: false, intensity: 1, uiMode: 'smart', animationState: 'IDLE' });

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseRef.current = { x: (e.clientX / window.innerWidth - 0.5) * 40, y: (e.clientY / window.innerHeight - 0.5) * 40 };
    };
    const handleResize = () => {
      viewportRef.current = { width: window.innerWidth, height: window.innerHeight };
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    runtimeRef.current = { isSearching, isProcessing, isMerging, intensity, uiMode, animationState, qualityLevel, qualityScalar };
  }, [isSearching, isProcessing, isMerging, intensity, uiMode, animationState, qualityLevel, qualityScalar]);

  useEffect(() => {
    const engine = engineRef.current;
    const world = engine.world;
    const { width, height } = viewportRef.current;
    engine.gravity.y = 0.05; // Reduced gravity for stability

    Matter.World.clear(world);

    const walls = [
      Matter.Bodies.rectangle(width / 2, height + 50, width, 100, { isStatic: true }),
      Matter.Bodies.rectangle(width / 2, -50, width, 100, { isStatic: true }),
      Matter.Bodies.rectangle(-50, height / 2, 100, height, { isStatic: true }),
      Matter.Bodies.rectangle(width + 50, height / 2, 100, height, { isStatic: true })
    ];
    Matter.Composite.add(world, walls);

    const bodies = [];
    const elements = [];

    if (!debrisContainerRef.current) return;
    debrisContainerRef.current.innerHTML = '';

    const fragment = document.createDocumentFragment();

    // STRICTLY REDUCED PARTICLE COUNT
    const particleCount = qualityLevel === 'HIGH' ? 12 : qualityLevel === 'MEDIUM' ? 8 : qualityLevel === 'LOW' ? 4 : 0;
    
    for (let i = 0; i < particleCount; i++) {
        const isBlue = i % 2 === 0;
        const x = Math.random() * width;
        const y = Math.random() * height;
        
        const body = Matter.Bodies.circle(x, y, 15, {
          restitution: 0.6,
          frictionAir: 0.05,
          plugin: { group: isBlue ? 'blue' : 'red' }
        });

        const el = document.createElement('div');
        el.className = `absolute pointer-events-none select-none font-mono font-black ${isBlue ? 'text-blue-500/40' : 'text-red-500/40'}`;
        el.style.fontSize = '18px';
        el.innerText = MATH_SYMBOLS[Math.floor(Math.random() * MATH_SYMBOLS.length)];
        
        fragment.appendChild(el);
        elements.push(el);
        bodies.push(body);
    }

    debrisContainerRef.current.appendChild(fragment);
    Matter.Composite.add(world, bodies);
    debrisRefs.current = { bodies, elements };

    return () => {
      Matter.Engine.clear(engine);
      Matter.World.clear(world);
      if (debrisContainerRef.current) {
        debrisContainerRef.current.innerHTML = '';
      }
    };
  }, [qualityLevel]);

  const stopAnimationLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      unregisterLoop('background');
    }
    orbitalStateRef.current.lastTime = 0;
  };

  const updateLoop = () => {
      const { width, height } = viewportRef.current;
      const { bodies, elements } = debrisRefs.current;
      if (!bodies || !elements) return;

      const { isSearching: searching, isProcessing: processing, isMerging: merging, intensity: uiIntensity, uiMode: mode, qualityScalar: qualityTarget } = runtimeRef.current;
      
      const activeFrame = searching || processing || merging || animationState !== 'IDLE';
      
      // STOP if not active or quality too low
      if (!activeFrame || qualityScalar <= 0.05) {
        stopAnimationLoop();
        return;
      }

      const engine = engineRef.current;
      const speedScale = 0.4; // Reduced global speed for stability
      Matter.Engine.update(engine, (1000 / 60) * speedScale);

      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const el = elements[i];
        if (!el) continue;

        const px = body.position.x;
        const py = body.position.y;
        
        // Use translate3d for hardware acceleration, avoid rotation if possible
        el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      }

      rafRef.current = requestAnimationFrame(updateLoop);
  };

  useEffect(() => {
    const shouldRun = allowNewAnimations && (isSearching || isProcessing || isMerging || animationState !== 'IDLE');
    
    if (shouldRun && !rafRef.current) {
      if (registerLoop('background', stopAnimationLoop)) {
        rafRef.current = requestAnimationFrame(updateLoop);
      }
    } else if (!shouldRun) {
      stopAnimationLoop();
    }
    return () => stopAnimationLoop();
  }, [isSearching, isProcessing, isMerging, animationState, allowNewAnimations]);

  useEffect(() => () => stopAnimationLoop(), []);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      <div ref={debrisContainerRef} className="absolute inset-0" />
      {/* Remove heavy filters and lighting layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60 pointer-events-none" />
    </div>
  );
}
