import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Terminal } from 'lucide-react';
import { useUI } from '../context/UIContext';

const ResponseCard = memo(({ response, index, isOld }) => {
  const { uiMode } = useUI();
  const isFocus = uiMode === 'focus';
  const isJarvis = response.text.includes('[JARVIS]');
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ 
        opacity: isFocus ? (isOld ? 0.3 : 1) : 1, 
        y: 0, 
        scale: 1 
      }}
      className={`${isFocus ? 'mb-2' : 'mb-8'} relative group transition-all duration-500`}
    >
      <div className={`${isFocus ? 'p-4' : 'p-8'} glass-panel border ${isJarvis ? 'border-purple-500/30' : 'border-neon-cyan/20'} relative overflow-hidden transition-all`}>
        {/* Animated Background Glow for Jarvis responses */}
        {isJarvis && !isFocus && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
        )}
        
        <div className={`flex items-start ${isFocus ? 'gap-4' : 'gap-6'} relative z-10`}>
          <div className={`p-4 rounded-xl ${isJarvis ? 'bg-purple-500/10 text-purple-400' : 'bg-neon-cyan/10 text-neon-cyan'} border border-white/5 
                          ${isFocus ? 'scale-75' : 'scale-100'} transition-transform`}>
            {isJarvis ? <Sparkles size={24} /> : <Terminal size={24} />}
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
               <span className={`text-[10px] font-mono uppercase tracking-[0.4em] ${isJarvis ? 'text-purple-400' : 'text-neon-cyan/60'}`}>
                {isJarvis ? 'Neural Feed' : 'Telemetry'}
               </span>
               <span className="text-[8px] font-mono text-gray-500">#{response.id}</span>
            </div>
            <p className={`${isFocus ? 'text-xs' : 'text-sm'} text-gray-200 leading-relaxed font-inter tracking-wide transition-all`}>
              {response.text}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

const ResponsePanel = memo(({ responses }) => {
  return (
    <div className="flex flex-col w-full">
      <AnimatePresence mode="popLayout">
        {responses.map((res, i) => (
          <ResponseCard 
            key={res.id || i} 
            response={res} 
            index={i} 
            isOld={i < responses.length - 1} 
          />
        ))}
      </AnimatePresence>
    </div>
  );
});

export default ResponsePanel;
