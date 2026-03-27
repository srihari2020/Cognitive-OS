import React, { useEffect, useRef } from 'react';
import Matter from 'matter-js';
import { useUI } from '../context/UIContext';
import { beginLoop, endLoop } from '../utils/runtimeMetrics';

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
    engine.gravity.y = 0.1;

    Matter.World.clear(world);

    const walls = [
      Matter.Bodies.rectangle(width / 2, height + 100, width, 200, { isStatic: true }),
      Matter.Bodies.rectangle(width / 2, -100, width, 200, { isStatic: true }),
      Matter.Bodies.rectangle(-100, height / 2, 200, height, { isStatic: true }),
      Matter.Bodies.rectangle(width + 100, height / 2, 200, height, { isStatic: true })
    ];
    Matter.Composite.add(world, walls);

    const bodies = [];
    const elements = [];

    if (!debrisContainerRef.current) return;
    debrisContainerRef.current.innerHTML = '';

    const fragment = document.createDocumentFragment();

    const particleCount = qualityLevel === 'HIGH' ? 50 : qualityLevel === 'MEDIUM' ? 32 : qualityLevel === 'LOW' ? 18 : 0;
    for (let i = 0; i < particleCount; i++) {
        const isBlue = i < 25;
        const x = isBlue ? Math.random() * (width / 3) : width - Math.random() * (width / 3);
        const y = Math.random() * height;
        
        const body = Matter.Bodies.circle(x, y, 20, {
          restitution: 0.9,
          frictionAir: 0.02,
          plugin: { group: isBlue ? 'blue' : 'red' }
        });

        const el = document.createElement('div');
        el.className = `absolute pointer-events-none select-none font-mono font-black ${isBlue ? 'text-blue-400' : 'text-red-400'} opacity-60 transition-opacity duration-500`;
        el.style.fontSize = '24px';
        el.style.textShadow = `0 0 10px ${isBlue ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`;
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
      endLoop('antigravityRaf');
    }
    orbitalStateRef.current.lastTime = 0;
    if (blueTrailRef.current && redTrailRef.current) {
      blueTrailRef.current.style.opacity = '0';
      redTrailRef.current.style.opacity = '0';
    }
  };

  const updateLoop = () => {
      const { width, height } = viewportRef.current;
      const { bodies, elements } = debrisRefs.current;
      if (!bodies || !elements) return;

      const { isSearching: searching, isProcessing: processing, isMerging: merging, intensity: uiIntensity, uiMode: mode, qualityScalar: qualityTarget } = runtimeRef.current;
      visualScaleRef.current += (qualityTarget - visualScaleRef.current) * 0.08;
      const quality = Math.max(0, Math.min(1, visualScaleRef.current));
      const activeFrame = searching || processing || merging;
      if (!activeFrame || quality <= 0.02) {
        stopAnimationLoop();
        return;
      }

      const engine = engineRef.current;
      engine.gravity.y = processing || searching ? 0 : 0.2;
      const speedScale = 0.55 + quality * 0.7;
      Matter.Engine.update(engine, (1000 / 60) * speedScale);

      const now = performance.now();
      const last = orbitalStateRef.current.lastTime || now;
      const delta = Math.min(32, now - last);
      orbitalStateRef.current.lastTime = now;

      const isOrbiting = processing && !merging;
      const orbitEnergyTarget = isOrbiting ? 1 : 0;
      const energyLerp = isOrbiting ? 0.02 : 0.06;
      orbitalStateRef.current.energy += (orbitEnergyTarget - orbitalStateRef.current.energy) * energyLerp;
      const orbitEnergy = Math.max(0, Math.min(1, orbitalStateRef.current.energy));

      const mergeShake = merging ? 15 : 0;
      const orbitShake = isOrbiting ? 3 + orbitEnergy * 8 : 0;
      const shakeX = ((Math.random() - 0.5) * (mergeShake + orbitShake)) * uiIntensity * quality;
      const shakeY = ((Math.random() - 0.5) * (mergeShake + orbitShake)) * uiIntensity * quality;
      
      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${shakeX - mouseRef.current.x * 0.1 * uiIntensity}px, ${shakeY - mouseRef.current.y * 0.1 * uiIntensity}px, 0)`;
      }

      if (isOrbiting && blueSphereRef.current && redSphereRef.current) {
        const minViewport = Math.min(width, height);
        const sphereSize = width * 0.3;
        const centerX = width * 0.5;
        const centerY = height * 0.48;
        const radiusBase = minViewport * 0.24 * (0.9 + uiIntensity * 0.15) * (0.88 + quality * 0.12);
        const radius = radiusBase * (1 - orbitEnergy * 0.45);

        const accel = (0.00002 + orbitEnergy * 0.00008) * (0.75 + uiIntensity * 0.5) * (0.6 + quality * 0.8);
        orbitalStateRef.current.velocity = Math.min(0.22, orbitalStateRef.current.velocity + accel * delta);
        orbitalStateRef.current.angle += orbitalStateRef.current.velocity * delta * 0.06;
        const angle = orbitalStateRef.current.angle;

        const blueX = centerX + radius * Math.cos(angle);
        const blueY = centerY + radius * Math.sin(angle);
        const redX = centerX + radius * Math.cos(angle + Math.PI);
        const redY = centerY + radius * Math.sin(angle + Math.PI);
        const pulse = 1 + (Math.sin(angle * 4) * 0.04 + orbitEnergy * 0.12) * quality;
        const blurPx = (8 + orbitEnergy * 24) * (0.4 + quality * 0.7);
        const bloom = (0.35 + orbitEnergy * 0.9) * (0.45 + quality * 0.55);

        blueSphereRef.current.style.transform = `translate3d(${blueX - sphereSize / 2}px, ${blueY - sphereSize / 2}px, 0) scale(${pulse})`;
        redSphereRef.current.style.transform = `translate3d(${redX - sphereSize / 2}px, ${redY - sphereSize / 2}px, 0) scale(${pulse})`;
        blueSphereRef.current.style.opacity = `${1 - orbitEnergy * 0.05}`;
        redSphereRef.current.style.opacity = `${1 - orbitEnergy * 0.05}`;
        blueSphereRef.current.style.filter = `drop-shadow(0 0 ${35 + orbitEnergy * 70}px rgba(59,130,246,${bloom})) blur(${blurPx * 0.18}px)`;
        redSphereRef.current.style.filter = `drop-shadow(0 0 ${35 + orbitEnergy * 70}px rgba(239,68,68,${bloom})) blur(${blurPx * 0.18}px)`;

        if (blueTrailRef.current && redTrailRef.current) {
          const trailLength = (0.85 + orbitEnergy * 1.1) * (0.75 + quality * 0.25);
          const trailOpacity = (0.15 + orbitEnergy * 0.55) * quality;
          const blueAngle = angle + Math.PI * 0.5;
          const redAngle = angle + Math.PI * 1.5;
          blueTrailRef.current.style.opacity = `${trailOpacity}`;
          redTrailRef.current.style.opacity = `${trailOpacity}`;
          blueTrailRef.current.style.transform = `translate3d(${blueX - 160}px, ${blueY - 40}px, 0) rotate(${blueAngle}rad) scale(${trailLength}, ${0.8 + orbitEnergy * 0.35})`;
          redTrailRef.current.style.transform = `translate3d(${redX - 160}px, ${redY - 40}px, 0) rotate(${redAngle}rad) scale(${trailLength}, ${0.8 + orbitEnergy * 0.35})`;
        }
      } else {
        orbitalStateRef.current.velocity += (0.02 - orbitalStateRef.current.velocity) * 0.12;
        if (blueSphereRef.current && redSphereRef.current) {
          blueSphereRef.current.style.transform = '';
          redSphereRef.current.style.transform = '';
          blueSphereRef.current.style.opacity = '';
          redSphereRef.current.style.opacity = '';
          blueSphereRef.current.style.filter = '';
          redSphereRef.current.style.filter = '';
        }
        if (blueTrailRef.current && redTrailRef.current) {
          blueTrailRef.current.style.opacity = '0';
          redTrailRef.current.style.opacity = '0';
        }
      }

      if (orbitalLayerRef.current) {
        const chroma = (isOrbiting ? 0.01 + orbitEnergy * 0.03 : 0) * quality;
        orbitalLayerRef.current.style.filter = (merging || isOrbiting) && uiIntensity > 0.2 ? `url(#gravityRipple) saturate(${1 + chroma * 12})` : 'none';
      }
      if (turbulenceRef.current) {
        const base = merging ? 0.05 : isOrbiting ? 0.012 + orbitEnergy * 0.015 : 0.008;
        turbulenceRef.current.setAttribute('baseFrequency', `${base * (0.6 + quality * 0.4)}`);
      }
      if (displacementRef.current) {
        const displacement = (merging ? 80 * uiIntensity : isOrbiting ? (18 + orbitEnergy * 26) * uiIntensity : 0) * quality;
        displacementRef.current.setAttribute('scale', `${displacement}`);
      }

      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const el = elements[i];
        if (!el) continue;

        const group = body.plugin.group;
        
        if (searching || processing) {
          const targetX = group === 'blue' ? width * 0.15 : width * 0.85;
          const targetY = height * 0.4;
          
          if (merging) {
             const dx = (width/2 + (Math.random()-0.5)*15) - body.position.x;
             const dy = (height/2 + (Math.random()-0.5)*15) - body.position.y;
             Matter.Body.applyForce(body, body.position, { x: dx * 0.018 * uiIntensity, y: dy * 0.018 * uiIntensity });
          } else {
             const dx = body.position.x - targetX;
             const dy = body.position.y - targetY;
             const dist = Math.sqrt(dx*dx + dy*dy) || 1;
             const forceMag = 0.0006 * body.mass * uiIntensity * (0.5 + quality * 0.5);
             Matter.Body.applyForce(body, body.position, { x: -dx * forceMag / dist, y: -dy * forceMag / dist });
             const orbitSpeed = (processing ? 0.01 : 0.004) * uiIntensity * (0.45 + quality * 0.55);
             Matter.Body.applyForce(body, body.position, { x: -dy * orbitSpeed, y: dx * orbitSpeed });
          }
        }
        
        const px = body.position.x - mouseRef.current.x * 0.15 * uiIntensity;
        const py = body.position.y - mouseRef.current.y * 0.15 * uiIntensity;
        el.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${body.angle}rad)`;
        el.style.opacity = mode === 'focus' ? '0.1' : '0.6';
      }

      rafRef.current = requestAnimationFrame(updateLoop);
  };

  useEffect(() => {
    const shouldRun = allowNewAnimations && (isSearching || isProcessing || isMerging || animationState === 'PROCESSING' || animationState === 'EXECUTING');
    if (shouldRun && !rafRef.current) {
      orbitalStateRef.current.lastTime = 0;
      beginLoop('antigravityRaf');
      rafRef.current = requestAnimationFrame(updateLoop);
    } else if (!shouldRun) {
      stopAnimationLoop();
    }
    return () => {
      if (!shouldRun) {
        stopAnimationLoop();
      }
    };
  }, [isSearching, isProcessing, isMerging, animationState, allowNewAnimations]);

  useEffect(() => () => stopAnimationLoop(), []);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden bg-[#000] pointer-events-none">
      {/* Cinematic Filters Container */}
      <svg className="absolute inset-0 w-full h-full opacity-0 pointer-events-none">
        <defs>
          <filter id="gravityRipple">
            <feTurbulence ref={turbulenceRef} type="fractalNoise" baseFrequency="0.01" numOctaves="3" result="noise" />
            <feDisplacementMap ref={displacementRef} in="SourceGraphic" in2="noise" scale="0" />
          </filter>
        </defs>
      </svg>

      <div
        ref={orbitalLayerRef}
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{ filter: isMerging && intensity > 0.2 ? 'url(#gravityRipple)' : 'none' }}
      >
        {/* Glowing Earths (Adaptive) */}
        <div className={`absolute inset-0 flex justify-between items-center px-[8vw] transition-opacity duration-1000 ${uiMode === 'focus' ? 'opacity-0' : 'opacity-100'}`}>
            {/* Blue Earth (Left) */}
            <div 
            ref={blueSphereRef}
            className={`relative w-[30vw] h-[30vw] will-change-transform transition-all duration-700 transform ${isMerging ? 'translate-x-[35vw] scale-[0.6] opacity-0 blur-lg' : 'scale-100 opacity-100 blur-0'}`}
            style={{ filter: 'drop-shadow(0 0 50px rgba(59,130,246,0.3))' }}
            >
            <div className="absolute -inset-[30%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute inset-0 bg-gradient-radial from-blue-400/40 via-blue-900/90 to-black rounded-full backdrop-blur-[60px] border-[3px] border-white/30 shadow-[inset_0_0_100px_rgba(59,130,246,0.8)]" />
            <div className="absolute top-[15%] left-[20%] w-[30%] h-[25%] bg-white/40 blur-[25px] rounded-full rotate-[-20deg]" />
            </div>

            {/* Red Earth (Right) */}
            <div 
            ref={redSphereRef}
            className={`relative w-[30vw] h-[30vw] will-change-transform transition-all duration-700 transform ${isMerging ? 'translate-x-[-35vw] scale-[0.6] opacity-0 blur-lg' : 'scale-100 opacity-100 blur-0'}`}
            style={{ filter: 'drop-shadow(0 0 50px rgba(239,68,68,0.3))' }}
            >
            <div className="absolute -inset-[30%] bg-red-500/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute inset-0 bg-gradient-radial from-red-400/40 via-red-900/90 to-black rounded-full backdrop-blur-[60px] border-[3px] border-white/30 shadow-[inset_0_0_100px_rgba(239,68,68,0.8)]" />
            <div className="absolute top-[15%] left-[20%] w-[30%] h-[25%] bg-white/40 blur-[25px] rounded-full rotate-[-20deg]" />
            </div>
        </div>

        <div
          ref={blueTrailRef}
          className="absolute w-[320px] h-[80px] rounded-full pointer-events-none opacity-0 will-change-transform"
          style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.55) 0%, rgba(59,130,246,0.18) 45%, rgba(59,130,246,0) 100%)', filter: 'blur(12px)' }}
        />
        <div
          ref={redTrailRef}
          className="absolute w-[320px] h-[80px] rounded-full pointer-events-none opacity-0 will-change-transform"
          style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.55) 0%, rgba(239,68,68,0.18) 45%, rgba(239,68,68,0) 100%)', filter: 'blur(12px)' }}
        />

        <div ref={debrisContainerRef} className="absolute inset-0" />
      </div>

      {/* Cinematic Overlays */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-transparent to-black/80 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] animate-pulse bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
