import React, { useEffect, useRef, useState } from 'react';
import {
  Cpu,
  FolderOpen,
  Globe,
  Minimize2,
  Search,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react';
import GojoLogo from './components/GojoLogo';
import InputBox from './components/InputBox';
import ResponsePanel from './components/ResponsePanel';
import Suggestions from './components/Suggestions';
import StabilityDashboard from './components/StabilityDashboard';
import SettingsPanel from './components/SettingsPanel';
import { commandRouter } from './services/commandRouter';
import { contextStore } from './services/contextStore';
import { commandService } from './services/api';
import { aiRouter } from './services/aiRouter';
import { UIProvider, useUI } from './context/UIContext';
import { getActiveLoops, stopAllLoops } from './utils/runtimeMetrics';

import { voiceService } from './services/voiceService';

const HARD_SAFE_MODE = false;
const PARTIAL_SAFE_MODE = true;

const INITIAL_FEATURE_FLAGS = {
  enableSuggestions: true,
  enableOrbAnimation: true,
  enableBackground: false, // Disabled heavy background
  enableCursor: false,     // Disabled custom cursor
};

const ACTION_SHORTCUTS = [
  { id: 'chrome', title: 'Open Chrome', subtitle: 'Browser shell', icon: Globe, command: 'open chrome' },
  { id: 'youtube', title: 'Open YouTube', subtitle: 'Media portal', icon: Sparkles, command: 'open youtube' },
  { id: 'google', title: 'Search Google', subtitle: 'Query URL', icon: Search, command: 'search google for Cognitive OS' },
  { id: 'files', title: 'Open Files', subtitle: 'Explorer', icon: FolderOpen, command: 'open files' },
  { id: 'system', title: 'System Info', subtitle: 'OS stats', icon: Cpu, command: 'system info' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createEntry = (text, role = 'assistant', extra = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text,
  role,
  ...extra,
});

function AppContent() {
  const [featureFlags, setFeatureFlags] = useState(INITIAL_FEATURE_FLAGS);
  const [responses, setResponses] = useState([
    createEntry('System online. Awaiting command stream.', 'system'),
  ]);
  const [draft, setDraft] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isDomainActive, setIsDomainActive] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [wakeStartSignal, setWakeStartSignal] = useState(0);
  const [animationState, setAnimationState] = useState('IDLE');
  const [assistantMode, setAssistantMode] = useState('active');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ status: 'ACTIVE', latency: '1MS' });
  const [stabilityMode, setStabilityMode] = useState(false);
  const [idleIntentLevel, setIdleIntentLevel] = useState('low');
  const scrollRef = useRef(null);
  const lifecycleTimeoutsRef = useRef([]);
  const orbButtonRef = useRef(null);
  const idleIntentRef = useRef({
    lastX: 0,
    lastY: 0,
    lastTs: 0,
    hoverMs: 0,
    smoothedScore: 0,
    level: 'low',
  });
  
  const isElectronOverlay = Boolean(window.electronAssistant);
  const {
    uiMode,
    setUiMode,
    behaviorMode,
    setBehaviorMode,
    intensity,
    fps,
    attentionLevel,
    startPerformanceSample,
    syncAnticipationNow,
    cleanupSignal,
    performanceTier,
    visualQuality,
    qualityScalar,
    backendStatus,
  } = useUI();

  const isBackendOffline = backendStatus === 'OFFLINE';
  const providerInfo = aiRouter.getProviderInfo();

  const clearLifecycleTimeouts = () => {
    lifecycleTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    lifecycleTimeoutsRef.current = [];
  };

  // 1. STABILITY: Disable heavy background and mouse reactive systems
  useEffect(() => {
    if (typeof stabilityMode !== 'undefined' && stabilityMode) {
      setFeatureFlags(prev => ({
        ...prev,
        enableBackground: false,
        enableCursor: false
      }));
    }
  }, [stabilityMode]);

  // 2. STABILITY: Single async loop for status if needed, otherwise events only
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isBackendOffline) {
        setSystemStatus({ status: 'OFFLINE', latency: '0MS' });
      }
    }, 5000); // 5s interval as requested for stability
    return () => clearInterval(intervalId);
  }, [isBackendOffline]);

  useEffect(() => {
    // Initialize Voice Service - Click to speak mode
    voiceService.onTranscript = (transcript) => {
      if (transcript.length > 0) {
        setDraft(transcript);
      }
    };

    voiceService.onCommand = (command) => {
      if (command && command.trim().length > 1) {
        handleSendCommand(command);
      }
    };

    voiceService.onStateChange = ({ isListening, isSpeaking }) => {
      setIsVoiceListening(isListening);
      setIsVoiceSpeaking(isSpeaking);
      if (isListening) setAnimationState('PROCESSING');
      else if (!isSpeaking && !isProcessing) setAnimationState('IDLE');
    };

    // Manual start only, no auto-continuous
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

    if (responses.length > 30) {
      setResponses((current) => current.slice(-30));
    }
  }, [responses]);

  useEffect(() => {
    clearLifecycleTimeouts();
    setIsMerging(false);
    setIsDomainActive(false);
    if (performanceTier === 'critical') {
      setAnimationState('IDLE');
    }
  }, [cleanupSignal, performanceTier]);

  useEffect(() => {
    let mounted = true;
    if (!window.electronAssistant?.getRuntimeConfig) return;

    window.electronAssistant.getRuntimeConfig().then((config) => {
      if (!mounted) return;
      if (typeof setStabilityMode !== 'undefined') {
        setStabilityMode(Boolean(config?.stabilityMode));
      }
      if (config?.stabilityMode) {
        setAssistantMode('active');
      }
    }).catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isElectronOverlay) return;
    const nextMode = (isProcessing || isMerging || isDomainActive) ? 'processing' : assistantMode;
    window.electronAssistant.setMode(nextMode);
    if ((typeof stabilityMode !== 'undefined' && stabilityMode) || nextMode !== 'idle') {
      window.electronAssistant.setOrbProximity(true);
      window.electronAssistant.setClickThrough(false);
    } else {
      window.electronAssistant.setOrbProximity(false);
      window.electronAssistant.setClickThrough(true);
    }
  }, [assistantMode, isElectronOverlay, isMerging, isProcessing, isDomainActive, stabilityMode]);

  useEffect(() => {
    if (!isElectronOverlay || assistantMode !== 'idle' || (typeof stabilityMode !== 'undefined' && stabilityMode) || !featureFlags.enableOrbAnimation) return;
    let frameId = null;
    let pendingMouse = null;
    const toUnit = (value) => Math.max(0, Math.min(1, value));

    const updateIntentFromMouse = (event) => {
      const orb = orbButtonRef.current;
      if (!orb) return;
      const rect = orb.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const now = performance.now();
      const previousTimestamp = idleIntentRef.current.lastTs || now;
      const delta = Math.max(1, now - previousTimestamp);
      const dxPrevious = event.clientX - idleIntentRef.current.lastX;
      const dyPrevious = event.clientY - idleIntentRef.current.lastY;
      const velocity = Math.sqrt(dxPrevious * dxPrevious + dyPrevious * dyPrevious) / delta;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const orbRadius = Math.max(rect.width, rect.height) * 0.5;
      const hoverBand = orbRadius * 2.2;
      const hoverMs = distance <= hoverBand
        ? Math.min(4000, idleIntentRef.current.hoverMs + delta)
        : Math.max(0, idleIntentRef.current.hoverMs - delta * 1.5);
      const distanceScore = toUnit(1 - (distance - orbRadius) / (hoverBand - orbRadius));
      const velocityScore = toUnit(1 - velocity / 1.2);
      const hoverScore = toUnit(hoverMs / 1200);
      const weightedScore = (distanceScore * 0.55) + (velocityScore * 0.2) + (hoverScore * 0.25);
      const smoothedScore = idleIntentRef.current.smoothedScore * 0.85 + weightedScore * 0.15;

      let nextLevel = idleIntentRef.current.level;
      if (nextLevel === 'low' && smoothedScore > 0.58) nextLevel = 'medium';
      else if (nextLevel === 'medium' && smoothedScore > 0.82) nextLevel = 'high';
      else if (nextLevel === 'high' && smoothedScore < 0.72) nextLevel = 'medium';
      else if (nextLevel === 'medium' && smoothedScore < 0.46) nextLevel = 'low';

      idleIntentRef.current = {
        lastX: event.clientX,
        lastY: event.clientY,
        lastTs: now,
        hoverMs,
        smoothedScore,
        level: nextLevel,
      };

      setIdleIntentLevel((current) => (current === nextLevel ? current : nextLevel));

      const nearOrb = nextLevel !== 'low';
      if (nearOrb !== lastOrbNearRef.current) {
        lastOrbNearRef.current = nearOrb;
        window.electronAssistant.setOrbProximity(nearOrb);
      }

      if (nextLevel === 'high') {
        window.electronAssistant.setClickThrough(false);
        setAssistantMode('active');
      }
    };

    const onMouseMove = (event) => {
      pendingMouse = event;
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        if (pendingMouse) updateIntentFromMouse(pendingMouse);
      });
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      lastOrbNearRef.current = false;
      idleIntentRef.current = {
        lastX: 0,
        lastY: 0,
        lastTs: 0,
        hoverMs: 0,
        smoothedScore: 0,
        level: 'low',
      };
      setIdleIntentLevel('low');
      window.electronAssistant.setOrbProximity(false);
    };
  }, [assistantMode, featureFlags.enableOrbAnimation, isElectronOverlay, stabilityMode]);

  useEffect(() => {
    if (!isElectronOverlay) return;

    const unsubscribeVisibility = window.electronAssistant.onVisibilityChange((payload) => {
      if (payload?.visible) {
        setAssistantMode('active');
        contextStore.setActiveApp('Cognitive OS'); // Default when app is visible
      }
    });

    const unsubscribeUpdate = window.electronAssistant.onUpdateReady(() => {
      setSystemStatus((current) => ({ ...current, status: 'UPDATE READY' }));
    });

    return () => {
      unsubscribeVisibility?.();
      unsubscribeUpdate?.();
    };
  }, [isElectronOverlay]);

  useEffect(() => {
    if (stabilityMode || PARTIAL_SAFE_MODE || isBackendOffline) return;
    let mounted = true;

    const intervalId = setInterval(async () => {
      if (isProcessing || isMerging || isDomainActive) return;
      const wake = await commandService.consumeWakeWord();
      if (!mounted || !wake?.triggered) return;
      setWakeStartSignal((current) => current + 1);
      setAnimationState('PROCESSING');
    }, 1500);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [isBackendOffline, isMerging, isProcessing, isDomainActive, stabilityMode]);

  const pushResponse = (entry) => {
    setResponses((current) => [...current, entry].slice(-30));
  };

  const finalizeInteraction = () => {
    setIsMerging(false);
    setAnimationState('IDLE');
  };

  const triggerDomainExpansion = async () => {
    // Disabled for stability
    return;
  };

  const speakResponse = (text) => {
    if (!text) return;
    const safeText = text.replace(/^\[[^\]]+\]:\s*/i, '').trim();
    if (!safeText) return;
    
    // JARVIS voice configuration
    voiceService.speak(safeText, () => {
      if (!isProcessing) setAnimationState('IDLE');
    });
  };

  const resolveAssistantResponse = async (prompt) => {
    if (!isBackendOffline) {
      try {
        const result = await commandService.send(prompt);
        return {
          text: result?.action?.message || 'Processing complete.',
          provider: 'backend',
          role: 'assistant',
        };
      } catch {
        // Fallback to direct AI if backend fails
      }
    }

    // Direct AI routing with fallback
    const aiResponse = await aiRouter.route(prompt);
    return {
      text: aiResponse.text,
      provider: aiResponse.provider,
      role: aiResponse.status === 'ERROR' ? 'system' : 'assistant',
    };
  };

  const handleSendCommand = async (text) => {
    const prompt = text.trim();
    if (!prompt || isProcessing) return;

    // Interrupt any current speaking when a new command is issued
    voiceService.cancel();

    if (isElectronOverlay) setAssistantMode('active');
    setDraft('');
    setIsSearching(false);
    setIsProcessing(true);
    setAnimationState('PROCESSING');
    
    // Minimal interaction logic
    pushResponse(createEntry(prompt, 'user'));
    contextStore.recordAction('command', prompt);

    try {
      // 1. Local Command Routing (Regex/Hardcoded)
      const localRoute = await commandRouter.route(prompt);
      if (localRoute.handled) {
        pushResponse(createEntry(`[JARVIS]: ${localRoute.message}`, 'action'));
        speakResponse(localRoute.message);
        setSystemStatus((current) => ({ ...current, status: 'ACTION COMPLETE' }));
        return;
      }

      // 2. AI-Assisted Intent Routing (Simplified)
      setSystemStatus((current) => ({ ...current, status: 'THINKING...' }));
      
      const result = await resolveAssistantResponse(prompt);
      const prefix = result.provider && result.provider !== 'backend' ? `[${result.provider}]` : '[JARVIS]';
      pushResponse(createEntry(`${prefix}: ${result.text}`, result.role));
      speakResponse(result.text);
      setSystemStatus((current) => ({ ...current, status: result.provider === 'backend' ? 'ONLINE' : `${result.provider.toUpperCase()} LINK` }));
    } catch (error) {
      const message = error?.message || 'Unable to process the request.';
      pushResponse(createEntry(`COMM LINK ERROR: ${message}`, 'system'));
      speakResponse(message);
      setSystemStatus((current) => ({ ...current, status: 'LINK ERROR' }));
    } finally {
      finalizeInteraction();
      setIsProcessing(false);
    }
  };

  const handleShortcut = (shortcut) => {
    if (shortcut.id === 'google') {
      const query = draft.trim() || 'Cognitive OS';
      handleSendCommand(`search google for ${query}`);
      return;
    }
    handleSendCommand(shortcut.command);
  };

  const renderIdleOrb = () => (
    <button
      ref={orbButtonRef}
      type="button"
      onClick={async () => {
        setAssistantMode('active');
      }}
      className={`absolute inset-0 m-auto flex h-28 w-28 items-center justify-center rounded-full border bg-black/65 transition-all duration-300 ${
        idleIntentLevel === 'high'
          ? 'border-cyan-300/85 shadow-[0_0_64px_rgba(34,211,238,0.45)]'
          : idleIntentLevel === 'medium'
            ? 'border-cyan-300/55 shadow-[0_0_40px_rgba(34,211,238,0.28)]'
            : 'border-white/12 shadow-[0_0_24px_rgba(34,211,238,0.16)]'
      }`}
      aria-label="Activate assistant"
    >
      <div
        className={`h-10 w-10 rounded-full bg-cyan-300 animate-pulse ${
          idleIntentLevel === 'high' ? 'scale-125' : 'scale-100'
        }`}
      />
    </button>
  );

  return (
    <div
      className={`relative flex h-screen w-screen flex-col overflow-hidden bg-[#0b0f1a] selection:bg-purple-500/30 ${
        isElectronOverlay
          ? 'rounded-[22px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.55)]'
          : ''
      }`}
    >
      {isElectronOverlay && assistantMode === 'idle' ? (
        renderIdleOrb()
      ) : (
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex h-full w-full max-w-[900px] min-h-0 flex-col">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <GojoLogo
                  isProcessing={isProcessing}
                  isListening={isVoiceListening}
                  isSpeaking={isVoiceSpeaking}
                  enableAnimation={featureFlags.enableOrbAnimation}
                  isExpanded
                  onActivate={() => (voiceService.isListening ? voiceService.stop() : voiceService.start(false))}
                />
                <div>
                    <h1 className="font-orbitron text-lg font-black tracking-widest text-white logo-glow">
                      COGNITIVE <span className="text-cyan-300">OS</span>
                    </h1>
                    <div className="flex items-center gap-2 text-[9px] font-mono text-white/30 uppercase tracking-tighter">
                      <span className={`status-dot-pulse ${isBackendOffline ? 'bg-red-500' : 'bg-emerald-400 shadow-[0_0_8px_#00ff9f]'}`} />
                      <span>{systemStatus.status}</span>
                      <span>•</span>
                      <span>FPS {fps}</span>
                    </div>
                  </div>
              </div>
            </header>

            {/* Message Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar scroll-smooth">
              <ResponsePanel responses={responses} />
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-6">
                  <div className="loader" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/60 loading-dots">Thinking</span>
                </div>
              )}
            </div>

            {/* Input Area (Sticky Bottom) */}
            <div className="sticky bottom-0 z-20 bg-[#0a0f19]/90 backdrop-blur-md p-4 border-t border-white/10">
              <div className="mx-auto max-w-[900px] flex flex-col gap-3">
                {featureFlags.enableSuggestions && !isProcessing && (
                  <Suggestions onSelect={setDraft} isSafeMode={PARTIAL_SAFE_MODE} />
                )}
                <div className="relative">
                  <InputBox
                    value={draft}
                    onInputChange={setDraft}
                    onSend={handleSendCommand}
                    isProcessing={isProcessing}
                    isListening={isVoiceListening}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isElectronOverlay && (
        <button
          type="button"
          onClick={() => window.electronAssistant.toggle()}
          className={`absolute top-3 right-3 z-50 h-3 w-3 rounded-full transition-colors ${
            assistantMode === 'idle' ? 'bg-white/30 hover:bg-white/50' : 'bg-red-400/70 hover:bg-red-300'
          }`}
          aria-label="Hide assistant"
          title="Hide assistant"
        />
      )}

      {isSettingsOpen && <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    console.log('[CognitiveOS] App mount');
    return () => console.log('[CognitiveOS] App unmount');
  }, []);

  if (HARD_SAFE_MODE) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-5 font-mono text-sm tracking-widest">
          HARD SAFE MODE ACTIVE
        </div>
      </div>
    );
  }

  return (
    <UIProvider>
      <AppContent />
    </UIProvider>
  );
}
