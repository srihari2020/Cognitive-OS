import React, { useEffect, useRef, useState } from 'react';
import CoreOrb from './components/ui/CoreOrb';
import MicButton from './components/ui/MicButton';
import MessageCard from './components/ui/MessageCard';
import { commandService } from './services/api';
import { UIProvider, useUI } from './context/UIContext';
import { voiceService } from './services/voiceService';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_FEATURE_FLAGS = {
  enableSuggestions: true,
  enableOrbAnimation: true,
};

const createEntry = (text, role = 'assistant', extra = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text,
  role,
  ...extra,
});

import CommandInput from './components/ui/CommandInput';

import BackgroundLayer from './components/ui/BackgroundLayer';

import { intentService } from './services/intentService';
import { runWorkflow } from './services/executor';
import { memoryStore } from './services/memoryStore';
import { proactiveEngine } from './services/proactiveEngine';

function AppContent() {
  const [responses, setResponses] = useState([
    createEntry('Online and ready. How can I help?', 'system'),
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [animationState, setAnimationState] = useState('IDLE');
  const [isTextMode, setIsTextMode] = useState(false);
  const scrollRef = useRef(null);
  
  const { backendStatus, behaviorMode, switchMode } = useUI();
  const isElectron = !!(window.electron && window.electron.exec);

  const isHandyMode = behaviorMode === 'handy';

  useEffect(() => {
    if (!isElectron) {
      setResponses(prev => [...prev, createEntry('SYSTEM ERROR: Bridge unavailable. Please run in Electron.', 'system')]);
      return;
    }

    // Initialize Intent Service
    intentService.init();

    // Initialize Voice Service
    voiceService.onResult = (command) => {
      if (command && command.trim().length > 1) {
        handleSendCommand(command);
      }
    };

    voiceService.onStateChange = ({ isListening, isSpeaking }) => {
      setIsVoiceListening(isListening);
      setIsVoiceSpeaking(isSpeaking);
      if (isListening) setAnimationState('LISTENING');
      else if (isSpeaking) setAnimationState('SPEAKING');
      else if (isProcessing) setAnimationState('PROCESSING');
      else setAnimationState('IDLE');
    };

    return () => {
      voiceService.stop();
      voiceService.cancel();
    };
  }, []);

  const handleMicClick = () => {
    if (!isElectron) return;
    if (isVoiceListening) {
      voiceService.stop();
    } else {
      voiceService.start();
      setIsTextMode(false); // Switch away from text if mic clicked
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [responses]);

  const handleSendCommand = async (text) => {
    if (!text.trim() || isProcessing) return;
    if (!isElectron) {
      setResponses(prev => [...prev, createEntry('Cannot execute: Running in browser mode.', 'system')]);
      return;
    }
    
    setIsProcessing(true);
    setAnimationState('PROCESSING');
    
    // Add user message
    const userMsg = createEntry(text, 'user');
    setResponses(prev => [...prev, userMsg]);

    try {
      // 1. AI Planning Step via Gemini
      const planningEntry = createEntry("Consulting Gemini...", 'system', { isPlanning: true });
      setResponses(prev => [...prev, planningEntry]);
      
      const planResult = await intentService.generatePlan(text);
      
      if (planResult && planResult.plan && planResult.plan.length > 0) {
        // Voice initial response (Conversational)
        voiceService.speak(planResult.response);
        setResponses(prev => [
          ...prev.filter(r => !r.isPlanning),
          createEntry(planResult.response, 'assistant')
        ]);

        // 2. Autonomous Execution Layer
        const workflowResult = await runWorkflow(planResult.plan, (current, total, step) => {
          // Silent execution or minimal feedback for natural feel
        });
        
        // 3. Save to Memory
        memoryStore.saveInteraction(text, planResult.plan, workflowResult);

      } else {
        setResponses(prev => prev.filter(r => !r.isPlanning));
        const conversationalResponse = planResult.response || "I'm not quite sure how to help with that, sir.";
        setResponses(prev => [...prev, createEntry(conversationalResponse, 'assistant')]);
        voiceService.speak(conversationalResponse);
      }

    } catch (error) {
      console.error('Execution error:', error);
      const errorMsg = createEntry('I encountered an error processing that request, sir.', 'assistant');
      setResponses(prev => [...prev, errorMsg]);
      voiceService.speak("I encountered an error processing that request, sir.");
    } finally {
      setIsProcessing(false);
      if (!isVoiceSpeaking) setAnimationState('IDLE');
    }
  };

  const toggleHandyMode = () => {
    const nextMode = behaviorMode === 'handy' ? 'active' : 'handy';
    switchMode(nextMode);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0f1a] flex flex-col items-center">
      <BackgroundLayer />
      
      {/* HUD Decorations (Static) */}
      <div className="hud-decoration opacity-20 pointer-events-none">
        <div className="hud-line" style={{ top: '20%' }} />
        <div className="hud-line" style={{ bottom: '20%' }} />
        <div className="hud-line-v" style={{ left: '20%' }} />
        <div className="hud-line-v" style={{ right: '20%' }} />
        <div className="hud-bracket hud-bracket-tl" />
        <div className="hud-bracket hud-bracket-tr" />
        <div className="hud-bracket hud-bracket-bl" />
        <div className="hud-bracket hud-bracket-br" />
      </div>

      {/* Main Centered UI (Stable) */}
      <div className="center-ui flex flex-col items-center justify-center h-full">
        <CoreOrb state={animationState} />
        
        <div className="flex flex-col items-center gap-8 mt-12">
          <MicButton 
            isListening={isVoiceListening}
            isSpeaking={isVoiceSpeaking}
            isProcessing={isProcessing}
            onClick={handleMicClick}
          />
          
          <button 
            onClick={toggleHandyMode}
            className="px-6 py-2 rounded-full glass-ui border border-white/10 text-[10px] font-mono text-white/40 hover:text-cyan-400 hover:border-cyan-400/50 transition-all uppercase tracking-widest"
          >
            {behaviorMode === 'handy' ? 'Disable Assist Mode' : 'Enable Assist Mode'}
          </button>
        </div>
      </div>

      {/* Manual Search (Bottom Right) */}
      <div className="absolute bottom-10 right-10 z-50">
        <CommandInput 
          onSubmit={handleSendCommand} 
          isProcessing={isProcessing} 
        />
      </div>

      {/* Message Feed (Lower Left) */}
      <div className="absolute bottom-10 left-10 w-full max-w-md z-50 pointer-events-none">
        <div 
          ref={scrollRef}
          className="max-h-60 overflow-y-auto no-scrollbar flex flex-col gap-3 px-6 pointer-events-auto"
        >
          <AnimatePresence mode="popLayout">
            {responses.slice(-5).map((res) => (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <MessageCard role={res.role} content={res.text} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* System Status (Top Right) */}
      <div className="absolute top-6 right-8 flex items-center gap-4 glass-ui p-3 rounded-xl border-white/5 pointer-events-none">
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">System Status</span>
          <span className={`text-[10px] font-mono font-bold ${backendStatus === 'OFFLINE' ? 'text-red-500' : 'text-cyan-400'}`}>
            {backendStatus}
          </span>
        </div>
        <div className={`status-dot-pulse ${backendStatus === 'OFFLINE' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-cyan-400 shadow-[0_0_10px_rgba(0,234,255,0.5)]'}`} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <UIProvider>
      <AppContent />
    </UIProvider>
  );
}
