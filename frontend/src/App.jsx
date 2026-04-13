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
  const scrollRef = useRef(null);
  
  const { backendStatus } = useUI();

  useEffect(() => {
    // Initialize Intent Service
    intentService.init();

    // Initialize Voice Service
    voiceService.start(true); // Continuous listening for wake word "Arise"
    voiceService.onTranscript = (transcript) => {
      // Transcript updates are handled here if needed
    };

    voiceService.onCommand = (command) => {
      if (command && command.trim().length > 1) {
        handleSendCommand(command);
      }
    };

    voiceService.onStateChange = ({ isListening, isSpeaking, isWoken, isActive }) => {
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
    
    setIsProcessing(true);
    setAnimationState('PROCESSING');
    
    // Add user message
    const userMsg = createEntry(text, 'user');
    setResponses(prev => [...prev, userMsg]);

    try {
      // 1. AI Planning Step
      const planningEntry = createEntry("Planning workflow...", 'system', { isPlanning: true });
      setResponses(prev => [...prev, planningEntry]);
      
      const planResult = intentService.generatePlan(text);
      
      if (planResult && planResult.plan && planResult.plan.length > 0) {
        // Voice initial response
        voiceService.speak(planResult.response);

        // 2. Autonomous Execution Layer
        const workflowResult = await runWorkflow(planResult.plan, (current, total, step) => {
          const stepMsg = `Executing step ${current} of ${total}: ${step.action}...`;
          setResponses(prev => [
            ...prev.filter(r => !r.isPlanning),
            createEntry(stepMsg, 'system', { isPlanning: true })
          ]);
        });
        
        // Remove planning indicator
        setResponses(prev => prev.filter(r => !r.isPlanning));

        // 3. Save to Memory
        memoryStore.saveInteraction(text, planResult.plan, workflowResult);

        // 4. Final UI Feedback
        const finalStatus = workflowResult.success 
          ? "Workflow completed successfully, sir." 
          : `I ran into an issue, sir: ${workflowResult.error}`;
          
        setResponses(prev => [...prev, createEntry(finalStatus, 'assistant')]);
        if (workflowResult.success && !planResult.response.includes("completed")) {
          voiceService.speak("Workflow completed successfully, sir.");
        } else if (!workflowResult.success) {
          voiceService.speak("I ran into an issue executing the workflow, sir.");
        }
      } else {
        setResponses(prev => prev.filter(r => !r.isPlanning));
        const fallbackMsg = createEntry("I need more clarity on that request, sir.", 'assistant');
        setResponses(prev => [...prev, fallbackMsg]);
        voiceService.speak("I need more clarity on that request, sir.");
      }

    } catch (error) {
      console.error('Execution error:', error);
      const errorMsg = createEntry('I encountered an error processing that.', 'assistant');
      setResponses(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
      if (!isVoiceSpeaking) setAnimationState('IDLE');
    }
  };

  const handleMicClick = () => {
    if (isVoiceListening) {
      voiceService.stop();
    } else {
      voiceService.start();
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0f1a] flex flex-col items-center">
      <BackgroundLayer />
      {/* HUD Decorations */}
      <div className="hud-decoration">
        <div className="hud-line" style={{ top: '20%' }} />
        <div className="hud-line" style={{ bottom: '20%' }} />
        <div className="hud-line-v" style={{ left: '20%' }} />
        <div className="hud-line-v" style={{ right: '20%' }} />
        <div className="hud-bracket hud-bracket-tl" />
        <div className="hud-bracket hud-bracket-tr" />
        <div className="hud-bracket hud-bracket-bl" />
        <div className="hud-bracket hud-bracket-br" />
        <div className="hud-scanner" />
      </div>

      {/* Main Centered UI */}
      <div className="center-ui">
        <CoreOrb state={animationState} />
        
        <div className="flex flex-col items-center gap-4">
          <MicButton 
            isListening={isVoiceListening}
            isSpeaking={isVoiceSpeaking}
            isProcessing={isProcessing}
            onClick={handleMicClick}
          />
        </div>
      </div>

      {/* Manual Search Fallback (Bottom Right) */}
      <div className="absolute bottom-10 right-10 z-50">
        <CommandInput 
          onSubmit={handleSendCommand} 
          isProcessing={isProcessing} 
        />
      </div>

      {/* Message Feed (Lower Left) */}
      <div className="absolute bottom-10 left-10 w-full max-w-md z-50">
        <div 
          ref={scrollRef}
          className="max-h-60 overflow-y-auto no-scrollbar flex flex-col gap-3 px-6"
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
