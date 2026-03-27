import React, { useEffect, useRef, useState } from 'react';
import * as animeModule from 'animejs';
import { motion, useMotionValue, useSpring } from 'framer-motion';

// Robustly extract animate and stagger from the module
const animate = animeModule.animate || (animeModule.default && animeModule.default.animate) || animeModule.default;
const stagger = animeModule.stagger || (animeModule.default && animeModule.default.stagger);

const NODE_COUNT = 40;
const CONNECTION_MAX_DIST = 200;

export default function NeuralBackground() {
  const [nodes, setNodes] = useState([]);
  const containerRef = useRef(null);
  
  // Mouse tracking for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { damping: 50, stiffness: 200 });
  const springY = useSpring(mouseY, { damping: 50, stiffness: 200 });

  useEffect(() => {
    // Generate random nodes
    const newNodes = Array.from({ length: NODE_COUNT }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.1 + 0.05,
      offset: Math.random() * 1000
    }));
    setNodes(newNodes);

    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      mouseX.set((clientX - window.innerWidth / 2) / 30);
      mouseY.set((clientY - window.innerHeight / 2) / 30);
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Only run animation if animate is a function
    if (typeof animate === 'function') {
      try {
        animate({
          targets: '.neural-node',
          r: [
            { value: (el) => parseFloat(el.getAttribute('data-size')) * 1.5, duration: 1000, easing: 'easeOutQuad' },
            { value: (el) => parseFloat(el.getAttribute('data-size')), duration: 1000, easing: 'easeInQuad' }
          ],
          opacity: [
            { value: 0.8, duration: 800, easing: 'linear' },
            { value: 0.3, duration: 1200, easing: 'linear' }
          ],
          loop: true,
          delay: (typeof stagger === 'function') ? stagger(100) : 100
        });
      } catch (e) {
        console.error('Animejs pulse execution failed:', e);
      }
    } else {
      console.warn('Animejs animate is not a function:', animate);
    }

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      {/* Radial Gradient Glow following cursor */}
      <motion.div 
        style={{
          x: useSpring(mouseX, { damping: 50, stiffness: 100 }).get() * 20,
          y: useSpring(mouseY, { damping: 50, stiffness: 100 }).get() * 20,
        }}
        className="absolute inset-0 opacity-20 pointer-events-none"
        animate={{
          background: "radial-gradient(circle at 50% 50%, rgba(0, 243, 255, 0.15) 0%, transparent 70%)"
        }}
      />

      <motion.svg
        style={{ x: springX, y: springY }}
        className="w-full h-full opacity-40 scale-110"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f3ff" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="neonBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dynamic Connections (Lines) */}
        {nodes.map((node, i) => (
          nodes.slice(i + 1).map((targetNode, j) => {
            const dx = node.x - targetNode.x;
            const dy = node.y - targetNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 15) { // Connection threshold in SVG units
              return (
                <motion.line
                  key={`line-${i}-${j}`}
                  x1={`${node.x}%`}
                  y1={`${node.y}%`}
                  x2={`${targetNode.x}%`}
                  y2={`${targetNode.y}%`}
                  stroke="rgba(0, 243, 255, 0.15)"
                  strokeWidth="0.05"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 - dist / 15 }}
                />
              );
            }
            return null;
          })
        ))}

        {/* Pulsing Nodes */}
        {nodes.map((node) => (
          <g key={node.id}>
            <circle
              className="neural-node"
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r={node.size}
              data-size={node.size}
              fill="url(#nodeGlow)"
              filter="url(#neonBlur)"
            />
            <motion.circle
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r={node.size * 0.3}
              fill="#00f3ff"
              animate={{
                opacity: [0.2, 1, 0.2],
                scale: [1, 1.5, 1]
              }}
              transition={{
                duration: Math.random() * 2 + 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </g>
        ))}
      </motion.svg>
      
      {/* Noise overlay for texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
