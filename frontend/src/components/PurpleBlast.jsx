import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PurpleBlast({ isVisible, qualityLevel = 'HIGH' }) {
  const isSimplified = qualityLevel === 'LOW' || qualityLevel === 'MEDIUM';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden"
        >
          {/* Primary shockwave ring — center origin, radial scale */}
          <motion.div
            initial={{ scale: 0.1, opacity: 0.9 }}
            animate={{ scale: isSimplified ? 6 : 8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute h-24 w-24 rounded-full border-2 border-purple-300/70"
          />
          {/* Secondary ring — thinner, faster for depth */}
          <motion.div
            initial={{ scale: 0.15, opacity: 0.7 }}
            animate={{ scale: isSimplified ? 8 : 10, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute h-16 w-16 rounded-full border border-purple-200/40"
          />
          {/* Core flash — no blur, just opacity and scale */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0.6 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute h-16 w-16 rounded-full bg-purple-200/30"
          />
          {/* Subtle screen flash — very low opacity */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.06, 0] }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 bg-white"
          />
          {/* Radial energy burst — no heavy blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.2, 0] }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.2),transparent_50%)]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
