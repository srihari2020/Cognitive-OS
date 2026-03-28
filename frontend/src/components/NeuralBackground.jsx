import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const NODE_COUNT = 40;
const CONNECTION_MAX_DIST = 200;

export default function NeuralBackground({ active = false }) {
  const [nodes, setNodes] = useState([]);
  const containerRef = useRef(null);
  const lastMoveRef = useRef(0);
  
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
      if (!active) return;
      const now = performance.now();
      if (now - lastMoveRef.current < 60) return;
      lastMoveRef.current = now;
      const { clientX, clientY } = e;
      mouseX.set((clientX - window.innerWidth / 2) / 30);
      mouseY.set((clientY - window.innerHeight / 2) / 30);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [active, mouseX, mouseY]);

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
                opacity: active ? [0.2, 1, 0.2] : 0.2,
                scale: active ? [1, 1.35, 1] : 1
              }}
              transition={{
                duration: Math.random() * 2 + 1,
                repeat: active ? 6 : 0,
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
