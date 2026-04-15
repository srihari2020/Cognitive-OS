import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CoreOrb from './components/ui/CoreOrb';
import MicButton from './components/ui/MicButton';
import MessageCard from './components/ui/MessageCard';
import { UIProvider, useUI } from './context/UIContext';
import { voiceService } from './services/voiceService';
import CommandInput from './components/ui/CommandInput';
import BackgroundLayer from './components/ui/BackgroundLayer';
import { intentService } from './services/intentService';
import { runWorkflow, allowExecution } from './services/executor';
import { memoryStore } from './services/memoryStore';
import ChatWidget from './components/ui/ChatWidget';
import SettingsPanel from './components/ui/SettingsPanel';

const createEntry = (text, role = 'assistant', extra = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text,
  role,
  ...extra,
});

const THINKING_MESSAGES = [
  'Thinking...',
  'Analyzing your request...',
  'Working on it...',
  'Checking the response...',
  'Processing...',
];

const MotionDiv = motion.div;

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
  const isProcessingRef = useRef(false);
  const activeInputRef = useRef('');
  const queuedInputsRef = useRef([]);
  const [queueSize, setQueueSize] = useState(0);
  const isOverlayRoute = new URLSearchParams(window.location.search).get('overlay') === '1';

  useEffect(() => {
    let interval;
    if (isProcessing) {
      let index = 0;
      interval = setInterval(() => {
        setThinkingMessage(THINKING_MESSAGES[index % THINKING_MESSAGES.length]);
        index += 1;
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const { backendStatus } = useUI();
  const isElectron = !!(window.electron && window.electron.exec);

  const clearCommandState = useCallback(() => {
    activeInputRef.current = '';
    localStorage.removeItem('lastCommand');
    localStorage.removeItem('pendingCommand');
    localStorage.removeItem('autoExecute');
  }, []);

  const enqueueCommand = useCallback((text, options = {}) => {
    const normalizedInput = (text || '').trim();
    if (!normalizedInput) {
      return false;
    }

    if (activeInputRef.current === normalizedInput) {
      return false;
    }

    const alreadyQueued = queuedInputsRef.current.some((item) => item.text === normalizedInput);
    if (alreadyQueued) {
      return false;
    }

    queuedInputsRef.current.push({ text: normalizedInput, options });
    setQueueSize(queuedInputsRef.current.length);
    return true;
  }, []);

  const handleMicClick = useCallback(() => {
    if (!isElectron) return;
    if (isProcessingRef.current) return;

    if (isVoiceListening) {
      voiceService.stop();
      return;
    }

    window.ALLOW_BACKGROUND = true;
    allowExecution();
    voiceService.start();
  }, [isElectron, isVoiceListening]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [responses]);

  const handleSendCommand = useCallback(async (text, options = {}) => {
    const normalizedInput = (text || '').trim();
    const isUserTriggered = options.userTriggered === true;

    if (!isUserTriggered) {
      return;
    }

    if (!normalizedInput) {
      return;
    }

    if (isProcessingRef.current) {
      enqueueCommand(normalizedInput, options);
      return;
    }

    if (activeInputRef.current === normalizedInput) {
      return;
    }

    isProcessingRef.current = true;
    activeInputRef.current = normalizedInput;
    localStorage.setItem('pendingCommand', normalizedInput);
    localStorage.setItem('lastCommand', normalizedInput);

    window.ALLOW_BACKGROUND = true;
    allowExecution();

    if (!isElectron) {
      setResponses((prev) => [...prev, createEntry('Cannot execute in browser mode.', 'system')]);
      isProcessingRef.current = false;
      setIsProcessing(false);
      window.ALLOW_BACKGROUND = false;
      clearCommandState();
      return;
    }

    setIsProcessing(true);
    setAnimationState('PROCESSING');
    setResponses((prev) => [...prev, createEntry(normalizedInput, 'user')]);

    try {
      const planResult = await intentService.generatePlan(normalizedInput, {
        onStatus: (statusMessage) => {
          setResponses((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.role === 'system' && lastMessage?.text === statusMessage) {
              return prev;
            }
            return [...prev, createEntry(statusMessage, 'system')];
          });
        },
      });

      if (planResult?.response) {
        const shouldSpeak = !planResult.response.trim().startsWith('{');
        if (shouldSpeak) {
          voiceService.speak(planResult.response);
        }
        setResponses((prev) => [...prev, createEntry(planResult.response, 'assistant')]);
      }

      if (planResult?.plan?.length > 0) {
        const executionResult = await runWorkflow(planResult.plan);
        memoryStore.saveInteraction(normalizedInput, planResult.plan, executionResult);

        if (!executionResult?.success) {
          throw new Error(executionResult?.error || 'Execution failed.');
        }

        const launchedApp = planResult.plan.some((step) => step.action === 'open_app' || step.action === 'search_web');
        if (launchedApp && window.electronAssistant?.enterAssistantMode) {
          try {
            await window.electronAssistant.enterAssistantMode();
          } catch (modeError) {
            console.error('Failed to enter assistant mode:', modeError);
          }
        }
      }
    } catch (error) {
      const message = error?.message || 'Network error';
      setResponses((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'system' && lastMessage?.text === message) {
          return prev;
        }
        return [...prev, createEntry(message, 'system')];
      });
    } finally {
      window.ALLOW_BACKGROUND = false;
      isProcessingRef.current = false;
      setIsProcessing(false);
      clearCommandState();
      if (!isVoiceSpeaking) {
        setAnimationState('IDLE');
      }

      if (queuedInputsRef.current.length > 0) {
        const nextItem = queuedInputsRef.current.shift();
        setQueueSize(queuedInputsRef.current.length);
        if (nextItem) {
          window.setTimeout(() => {
            handleSendCommand(nextItem.text, nextItem.options);
          }, 0);
        }
      }
    }
  }, [clearCommandState, enqueueCommand, isElectron, isVoiceSpeaking]);

  useEffect(() => {
    window.ALLOW_BACKGROUND = false;
    clearCommandState();

    if (!isElectron) {
      setResponses((prev) => [...prev, createEntry('System bridge unavailable. Run this in Electron.', 'system')]);
      return undefined;
    }

    intentService.init();

    voiceService.onResult = (command) => {
      handleSendCommand(command, { userTriggered: true, source: 'voice' });
    };

    voiceService.onStateChange = ({ isListening, isSpeaking }) => {
      setIsVoiceListening(isListening);
      setIsVoiceSpeaking(isSpeaking);
      if (isListening) setAnimationState('LISTENING');
      else if (isSpeaking) setAnimationState('SPEAKING');
      else if (isProcessingRef.current) setAnimationState('PROCESSING');
      else setAnimationState('IDLE');
    };

    return () => {
      voiceService.onResult = null;
      voiceService.onStateChange = null;
      voiceService.stop();
      voiceService.cancel();
    };
  }, [clearCommandState, handleSendCommand, isElectron]);

  if (isOverlayRoute) {
    return (
      <div className="relative w-full h-screen overflow-hidden bg-transparent">
        <div className="absolute top-3 right-4 z-[120] flex items-center gap-2">
          {queueSize > 0 && (
            <div className="glass-ui rounded-full px-3 py-1 text-[10px] text-cyan-300">
              {queueSize} queued
            </div>
          )}
          <button
            onClick={() => window.electronAssistant?.expandMainWindow?.()}
            className="glass-ui rounded-full px-3 py-1 text-[10px] text-white/80 hover:text-white"
          >
            Expand
          </button>
        </div>

        <ChatWidget
          isOpen
          onClose={() => {}}
          responses={responses}
          onSendCommand={(text) => handleSendCommand(text, { userTriggered: true, source: 'chat' })}
          isProcessing={isProcessing}
          isVoiceListening={isVoiceListening}
          isVoiceSpeaking={isVoiceSpeaking}
          onMicClick={handleMicClick}
          animationState={animationState}
          thinkingMessage={thinkingMessage}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-x-hidden overflow-y-hidden bg-[#0b0f1a] flex flex-col items-center">
      <BackgroundLayer />

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

      <div className="center-ui">
        <CoreOrb state={animationState} />

        <div className="flex flex-col items-center gap-8 mt-12">
          {isProcessing && (
            <MotionDiv
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-cyan-400/60 font-mono text-[10px] uppercase tracking-[0.3em] animate-pulse"
            >
              {thinkingMessage}
            </MotionDiv>
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

      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50">
        <CommandInput
          onSubmit={(text) => handleSendCommand(text, { userTriggered: true, source: 'input' })}
          isProcessing={isProcessing}
        />
      </div>

      <ChatWidget
        isOpen={isChatOpen}
        onClose={setIsChatOpen}
        responses={responses}
        onSendCommand={(text) => handleSendCommand(text, { userTriggered: true, source: 'chat' })}
        isProcessing={isProcessing}
        isVoiceListening={isVoiceListening}
        isVoiceSpeaking={isVoiceSpeaking}
        onMicClick={handleMicClick}
        animationState={animationState}
        thinkingMessage={thinkingMessage}
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {!isChatOpen && (
        <div className="absolute bottom-10 left-10 w-full max-w-md z-50 pointer-events-none">
          <div
            ref={scrollRef}
            className="max-h-60 overflow-y-auto no-scrollbar flex flex-col gap-3 px-6 pointer-events-auto"
          >
            <AnimatePresence mode="popLayout">
              {responses.slice(-5).map((res) => (
                <MotionDiv
                  key={res.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <MessageCard role={res.role} content={res.text} />
                </MotionDiv>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="absolute top-6 right-8 flex items-center gap-4 glass-ui p-3 rounded-xl border-white/5 pointer-events-none">
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">System Status</span>
          <span className={`text-[10px] font-mono font-bold ${backendStatus === 'OFFLINE' ? 'text-red-500' : 'text-cyan-400'}`}>
            {backendStatus}
          </span>
        </div>
        <div className={`status-dot-pulse ${backendStatus === 'OFFLINE' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-cyan-400 shadow-[0_0_10px_rgba(0,234,255,0.5)]'}`} />
      </div>

      {queueSize > 0 && (
        <div className="absolute top-6 left-8 glass-ui rounded-full px-3 py-1 text-[10px] text-cyan-300">
          {queueSize} queued
        </div>
      )}
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
