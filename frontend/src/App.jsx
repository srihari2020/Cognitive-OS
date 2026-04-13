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

import ChatWidget from './components/ui/ChatWidget';
import SettingsPanel from './components/ui/SettingsPanel';

function AppContent() {
  const [responses, setResponses] = useState([
    createEntry('Online and ready. How can I help?', 'system'),
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [animationState, setAnimationState] = useState('IDLE');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState('Thinking...');
  const scrollRef = useRef(null);
  
  const thinkingMessages = [
    "Thinking...",
    "Analyzing your request...",
    "Consulting systems...",
    "One moment, sir...",
    "Processing..."
  ];

  useEffect(() => {
    let interval;
    if (isProcessing) {
      let i = 0;
      interval = setInterval(() => {
        setThinkingMessage(thinkingMessages[i % thinkingMessages.length]);
        i++;
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const { backendStatus, behaviorMode, switchMode } = useUI();
  const isElectron = !!(window.electron && window.electron.exec);

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
      // 1. AI Planning Step via Gemini/Grok
      const planResult = await intentService.generatePlan(text);
      
      if (planResult) {
        // Voice initial response (Conversational)
        if (planResult.response) {
          voiceService.speak(planResult.response);
          setResponses(prev => [
            ...prev,
            createEntry(planResult.response, 'assistant')
          ]);
        }

        // 2. Autonomous Execution Layer
        if (planResult.plan && planResult.plan.length > 0) {
          await runWorkflow(planResult.plan);
          // 3. Save to Memory
          memoryStore.saveInteraction(text, planResult.plan, { success: true });
        }

      } else {
        const fallback = "I'm having trouble processing that, sir. Please try again.";
        setResponses(prev => [...prev, createEntry(fallback, 'assistant')]);
        voiceService.speak(fallback);
      }

    } catch (error) {
      console.error('FRIDAY: Execution error:', error);
      const errorMsg = error.message || 'I encountered an error processing that request, sir.';
      setResponses(prev => [...prev, createEntry(errorMsg, 'assistant')]);
      voiceService.speak(errorMsg);
    } finally {
      setIsProcessing(false);
      if (!isVoiceSpeaking) setAnimationState('IDLE');
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0f1a] flex flex-col items-center">
      <BackgroundLayer />
      
      {/* HUD Decorations */}
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

      {/* Main Centered UI */}
      <div className="center-ui flex flex-col items-center justify-center h-full">
        <CoreOrb state={animationState} />
        
        <div className="flex flex-col items-center gap-8 mt-12">
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-cyan-400/60 font-mono text-[10px] uppercase tracking-[0.3em] animate-pulse"
            >
              {thinkingMessage}
            </motion.div>
          )}
          
          <MicButton 
            isListening={isVoiceListening}
            isSpeaking={isVoiceSpeaking}
            isProcessing={isProcessing}
            onClick={handleMicClick}
          />
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="px-6 py-2 rounded-full glass-ui border border-white/10 text-[10px] font-mono text-white/40 hover:text-cyan-400 hover:border-cyan-400/50 transition-all uppercase tracking-widest"
          >
            System Settings
          </button>
        </div>
      </div>

      {/* Manual Search */}
      <div className="absolute bottom-10 right-24 z-50">
        <CommandInput 
          onSubmit={handleSendCommand} 
          isProcessing={isProcessing} 
        />
      </div>

      {/* Floating ChatWidget */}
      <ChatWidget 
        isOpen={isChatOpen}
        onClose={setIsChatOpen}
        responses={responses}
        onSendCommand={handleSendCommand}
        isProcessing={isProcessing}
        isVoiceListening={isVoiceListening}
        isVoiceSpeaking={isVoiceSpeaking}
        onMicClick={handleMicClick}
        animationState={animationState}
        thinkingMessage={thinkingMessage}
      />

      {/* Settings Panel */}
      <SettingsPanel 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Message Feed (Legacy, only show in full UI) */}
      {!isChatOpen && (
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
      )}

      {/* System Status */}
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
