import React, { useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  FolderOpen,
  Globe,
  Minimize2,
  Search,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react';
import AntigravityBackground from './components/AntigravityBackground';
import GojoLogo from './components/GojoLogo';
import CustomCursor from './components/CustomCursor';
import InputBox from './components/InputBox';
import ResponsePanel from './components/ResponsePanel';
import Suggestions from './components/Suggestions';
import DomainExpansion from './components/DomainExpansion';
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
  enableBackground: true,
  enableCursor: true,
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

const getLocalSystemInfo = () => ({
  platform: navigator.platform || 'unknown',
  release: navigator.userAgent || 'browser',
  arch: 'web',
  hostname: window.location.hostname || 'local',
  totalMemoryGb: navigator.deviceMemory || 0,
  freeMemoryGb: navigator.deviceMemory || 0,
  cpuCores: navigator.hardwareConcurrency || 0,
  uptimeMinutes: 0,
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
  const [fpsDropCount, setFpsDropCount] = useState(0);
  const [assistantMode, setAssistantMode] = useState(!!window.electronAssistant ? 'idle' : 'active');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [idleIntentLevel, setIdleIntentLevel] = useState('low');
  const [systemStatus, setSystemStatus] = useState({ status: 'ACTIVE', latency: '1MS' });
  const [stabilityMode, setStabilityMode] = useState(false);
  const [lastActionTime, setLastActionTime] = useState(null);
  const scrollRef = useRef(null);
  const lifecycleTimeoutsRef = useRef([]);
  const orbButtonRef = useRef(null);
  const lastOrbNearRef = useRef(false);
  const idleIntentRef = useRef({
    lastX: 0,
    lastY: 0,
    lastTs: 0,
    hoverMs: 0,
    smoothedScore: 0,
    level: 'low',
  });
  const isElectronOverlay = Boolean(window.electronAssistant);
  const isDev = import.meta.env.DEV;
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

  // Behavior Mode Controller
  useEffect(() => {
    if (isProcessing || isMerging || isDomainActive) {
      setBehaviorMode('processing');
      return;
    }

    const idleTime = contextStore.getIdleTimeMs();
    if (idleTime > 15000) { // 15s idle for passive suggestions
      setBehaviorMode('idle');
    } else {
      setBehaviorMode('active');
    }

    const interval = setInterval(() => {
      const currentIdle = contextStore.getIdleTimeMs();
      if (isProcessing || isMerging || isDomainActive) {
        setBehaviorMode('processing');
      } else if (currentIdle > 15000) {
        setBehaviorMode('idle');
      } else {
        setBehaviorMode('active');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isProcessing, isMerging, isDomainActive, setBehaviorMode]);
  const isBackendOffline = backendStatus === 'OFFLINE';
  const providerInfo = aiRouter.getProviderInfo();

  useEffect(() => {
    console.log('[CognitiveOS] AppContent mount');
    return () => console.log('[CognitiveOS] AppContent unmount');
  }, []);

  useEffect(() => {
    const activeLoops = getActiveLoops();
    const shouldAllowBackground = featureFlags.enableBackground && (isSearching || isProcessing || isMerging || animationState !== 'IDLE');
    const unexpectedLoops = activeLoops.filter((name) => !(shouldAllowBackground && name === 'background'));

    if (unexpectedLoops.length > 0) {
      stopAllLoops();
    }

    if (fps > 0 && fps < 30) {
      setFpsDropCount((prev) => {
        const next = prev + 1;
        if (next >= 4) {
          setFeatureFlags((current) => ({
            ...current,
            enableBackground: false,
            enableCursor: false,
          }));
        }
        return next;
      });
    } else if (fps >= 45) {
      setFpsDropCount(0);
      setFeatureFlags((current) => ({
        ...current,
        enableBackground: INITIAL_FEATURE_FLAGS.enableBackground,
        enableCursor: INITIAL_FEATURE_FLAGS.enableCursor,
      }));
    }
  }, [animationState, featureFlags.enableBackground, fps, isMerging, isProcessing, isSearching]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const activeLoops = getActiveLoops();
      const isActive = isSearching || isProcessing || isMerging || animationState !== 'IDLE';
      if (!isActive && activeLoops.length > 0) {
        stopAllLoops();
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [animationState, isMerging, isProcessing, isSearching]);

  const clearLifecycleTimeouts = () => {
    lifecycleTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    lifecycleTimeoutsRef.current = [];
  };

  useEffect(() => () => clearLifecycleTimeouts(), []);

  useEffect(() => () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    // Initialize Voice Service
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

    // Auto-start listening for wake word
    voiceService.start(true);

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
      setStabilityMode(Boolean(config?.stabilityMode));
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
    if (stabilityMode || nextMode !== 'idle') {
      window.electronAssistant.setOrbProximity(true);
      window.electronAssistant.setClickThrough(false);
    } else {
      window.electronAssistant.setOrbProximity(false);
      window.electronAssistant.setClickThrough(true);
    }
  }, [assistantMode, isElectronOverlay, isMerging, isProcessing, isDomainActive, stabilityMode]);

  useEffect(() => {
    if (!isElectronOverlay || assistantMode !== 'idle' || stabilityMode || !featureFlags.enableOrbAnimation) return;
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
    setAnimationState('COMPLETE');
    const timeoutId = setTimeout(() => setAnimationState('IDLE'), 320);
    lifecycleTimeoutsRef.current.push(timeoutId);
  };

  const triggerDomainExpansion = async () => {
    if (qualityScalar <= 0.18) return;
    setAnimationState('EXECUTING');
    setIsDomainActive(true);
    await sleep(1200); // Wait for the full 4 phase 1200ms sequence
    setIsDomainActive(false);
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

    clearLifecycleTimeouts();
    if (isElectronOverlay) setAssistantMode('active');
    setDraft('');
    setIsSearching(false);
    setIsProcessing(true);
    setAnimationState('PROCESSING');
    startPerformanceSample(2200);
    syncAnticipationNow();
    pushResponse(createEntry(prompt, 'user'));
    contextStore.recordAction('command', prompt);

    try {
      // 1. Local Command Routing (Regex/Hardcoded)
      const localRoute = await commandRouter.route(prompt);
      if (localRoute.handled) {
        await triggerDomainExpansion();
        pushResponse(createEntry(`[JARVIS]: ${localRoute.message}`, 'action'));
        speakResponse(localRoute.message);
        setSystemStatus((current) => ({ ...current, status: 'ACTION COMPLETE' }));
        return;
      }

      // 2. AI-Assisted Intent Routing (Step 8)
      // We ask the AI to determine if this is a system action
      setSystemStatus((current) => ({ ...current, status: 'THINKING...' }));
      const aiResponse = await resolveAssistantResponse(prompt + " (If this is a request to open an app like VS Code, Chrome, or change volume, respond ONLY with a JSON object like: {\"action\": \"open\", \"target\": \"vscode\"} or {\"action\": \"volume\", \"value\": 50}. Otherwise, respond naturally.)");

      try {
        const intent = JSON.parse(aiResponse.text);
        if (intent.action === 'open' && intent.target) {
          const result = await commandRouter.route(`open ${intent.target}`);
          if (result.handled) {
            await triggerDomainExpansion();
            pushResponse(createEntry(`[JARVIS]: ${result.message}`, 'action'));
            speakResponse(result.message);
            setSystemStatus((current) => ({ ...current, status: 'ACTION COMPLETE' }));
            return;
          }
        } else if (intent.action === 'volume' && intent.value !== undefined) {
          const result = await commandRouter.route(`volume ${intent.value}`);
          if (result.handled) {
            await triggerDomainExpansion();
            pushResponse(createEntry(`[JARVIS]: ${result.message}`, 'action'));
            speakResponse(result.message);
            setSystemStatus((current) => ({ ...current, status: 'ACTION COMPLETE' }));
            return;
          }
        }
      } catch (e) {
        // Not a JSON intent, proceed to normal AI response
      }

      // 3. Normal AI Response (Chat)
      const result = await resolveAssistantResponse(prompt);
      await triggerDomainExpansion();
      const prefix = result.provider && result.provider !== 'backend' ? `[${result.provider}]` : '[JARVIS]';
      pushResponse(createEntry(`${prefix}: ${result.text}`, result.role));
      speakResponse(result.text);
      setSystemStatus((current) => ({ ...current, status: result.provider === 'backend' ? 'ONLINE' : `${result.provider.toUpperCase()} LINK` }));
    } catch (error) {
      await triggerDomainExpansion();
      const message = error?.message || 'Unable to process the request.';
      pushResponse(createEntry(`COMM LINK ERROR: ${message}`, 'system'));
      speakResponse(message);
      setSystemStatus((current) => ({ ...current, status: 'LINK ERROR' }));
    } finally {
      finalizeInteraction();
      setIsProcessing(false);
      startPerformanceSample(1200);
      syncAnticipationNow();
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
    <Motion.button
      ref={orbButtonRef}
      type="button"
      onClick={async () => {
        setAssistantMode('active');
        triggerDomainExpansion();
      }}
      whileTap={{ scale: 0.96 }}
      className={`absolute inset-0 m-auto flex h-28 w-28 items-center justify-center rounded-full border bg-black/65 transition-all duration-300 ${
        idleIntentLevel === 'high'
          ? 'border-cyan-300/85 shadow-[0_0_64px_rgba(34,211,238,0.45)]'
          : idleIntentLevel === 'medium'
            ? 'border-cyan-300/55 shadow-[0_0_40px_rgba(34,211,238,0.28)]'
            : 'border-white/12 shadow-[0_0_24px_rgba(34,211,238,0.16)]'
      }`}
      aria-label="Activate assistant"
    >
      <Motion.div
        animate={{
          scale: idleIntentLevel === 'high' ? [1, 1.2, 1] : [1, 1.06, 1],
          opacity: idleIntentLevel === 'high' ? [0.6, 1, 0.6] : [0.45, 0.75, 0.45],
        }}
        transition={{ duration: idleIntentLevel === 'high' ? 0.7 : 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="h-10 w-10 rounded-full bg-cyan-300"
      />
    </Motion.button>
  );

  return (
    <Motion.div
      animate={{ scale: isDomainActive ? 0.993 : 1 }}
      transition={{ duration: 0.18 }}
      className={`relative flex min-h-screen flex-col overflow-hidden selection:bg-purple-500/30 ${
        isElectronOverlay
          ? 'h-full w-full rounded-[22px] border border-white/10 bg-black/55 shadow-[0_20px_60px_rgba(0,0,0,0.55)]'
          : 'w-screen bg-black'
      }`}
    >
      {!stabilityMode && featureFlags.enableCursor && qualityScalar > 0.35 && <CustomCursor />}

      {isElectronOverlay && assistantMode === 'idle' ? (
        renderIdleOrb()
      ) : (
        <>
          {/* Always-on background — renders in LOW-COST CSS mode when idle */}
          {featureFlags.enableBackground && visualQuality !== 'OFF' && (
            <AntigravityBackground
              isSearching={isSearching}
              isProcessing={isProcessing}
              isMerging={isMerging}
              animationState={animationState}
              allowNewAnimations={visualQuality !== 'OFF' && featureFlags.enableBackground}
              qualityLevel={visualQuality}
              qualityScalar={qualityScalar}
            />
          )}
          <DomainExpansion isActive={isDomainActive} qualityLevel={visualQuality} />

          {/* Ambient radial overlays */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,243,255,0.06),transparent_28%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.06),transparent_30%)]" />

          {/* ═══════════════════════════════════════════════════
              MAIN LAYOUT — Centered, 3-column grid
              ═══════════════════════════════════════════════════ */}
          <div className="relative z-10 flex flex-1 flex-col px-4 py-4 md:px-6 md:py-5 overflow-hidden">
            <div className="mx-auto flex h-full w-full max-w-[1100px] min-h-0 flex-col gap-4">

              {/* ──────────── HEADER ──────────── */}
              <header className="glass-panel flex flex-wrap items-center gap-4 px-5 py-3.5 md:flex-nowrap md:gap-6">
                {/* Logo + Title */}
                <div className="flex min-w-0 items-center gap-3.5">
                  <GojoLogo
                    isProcessing={isProcessing}
                    isListening={isVoiceListening}
                    isSpeaking={isVoiceSpeaking}
                    enableAnimation={featureFlags.enableOrbAnimation}
                    isExpanded
                    onActivate={() => setAssistantMode('active')}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="font-orbitron text-xl font-black tracking-[0.14em] text-white">
                        COGNITIVE <span className="text-cyan-300">OS</span>
                      </h1>
                      <span className="font-rajdhani rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-white/40">
                        Jarvis Grid
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[9px] font-mono uppercase tracking-[0.24em] text-white/35">
                      <span className={`h-1.5 w-1.5 rounded-full status-dot-online ${isBackendOffline ? 'bg-red-400 text-red-400' : 'bg-cyan-300 text-cyan-300'}`} />
                      <span>{isBackendOffline ? 'Cloud AI' : 'Hybrid Core'}</span>
                      <span className="text-white/20">│</span>
                      <span>FPS {fps}</span>
                      <span className="text-white/20">│</span>
                      <span>{attentionLevel}</span>
                    </div>
                  </div>
                </div>

                {/* Spacer */}
                <div className="hidden md:block md:flex-1" />

                {/* Mode switcher */}
                <div className="flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] p-1">
                  {['cinematic', 'focus', 'smart'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setUiMode(mode)}
                      className={`rounded-full px-3 py-1.5 font-rajdhani text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-200 ${
                        uiMode === mode ? 'bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.15)]' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Settings + Minimize */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="rounded-xl border border-white/8 bg-white/[0.04] p-2.5 text-white/50 transition hover:bg-white/8 hover:text-white"
                    title="Neural Core Settings"
                  >
                    <SettingsIcon size={15} />
                  </button>
                  {isElectronOverlay && (
                    <button
                      type="button"
                      onClick={() => setAssistantMode('idle')}
                      className="rounded-xl border border-white/8 bg-white/[0.04] p-2.5 text-white/50 transition hover:bg-white/8 hover:text-white"
                      title="Collapse to idle orb"
                    >
                      <Minimize2 size={15} />
                    </button>
                  )}
                </div>
              </header>

              {/* ──────────── 3-COLUMN GRID ──────────── */}
              <main className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_1fr_0.78fr]">

                {/* ═══ LEFT: Neural Feed ═══ */}
                <section className="flex min-h-0 flex-col overflow-hidden glass-panel">
                  <div className="flex items-center justify-between gap-3 border-b border-white/6 px-5 py-3.5">
                    <div>
                      <div className="mono-label">Neural Feed</div>
                      <div className="mt-0.5 font-rajdhani text-[12px] font-medium text-white/60">Live interaction stream</div>
                    </div>
                    <div className="font-rajdhani text-[10px] font-medium text-white/25 tracking-wider">
                      {responses.length} entries
                    </div>
                  </div>
                  <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-3">
                    <ResponsePanel responses={responses} />
                    <AnimatePresence>
                      {isProcessing && (
                        <Motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mt-2 flex items-center gap-3 rounded-[18px] border border-purple-400/15 bg-purple-500/[0.04] px-4 py-2.5"
                        >
                          <Motion.div
                            animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0.9, 0.4] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                            className="h-2 w-2 rounded-full bg-purple-300"
                          />
                          <span className="mono-label text-purple-200/70" style={{ letterSpacing: '0.28em' }}>
                            Synthesizing
                          </span>
                        </Motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>

                {/* ═══ CENTER: Core State + Input ═══ */}
                <section className="flex min-h-0 flex-col gap-4">
                  {/* Core State Card */}
                  <div className="glass-panel p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mono-label">Core State</div>
                        <div className={`mt-2 font-rajdhani text-2xl font-bold tracking-wide ${
                          isVoiceListening ? 'text-red-300' : isProcessing ? 'text-purple-300' : 'text-white'
                        }`}>
                          {isVoiceListening ? 'Listening' : isProcessing ? 'Thinking' : 'Ready'}
                        </div>
                        <div className="mt-1.5 max-w-sm font-rajdhani text-[13px] font-medium leading-6 text-white/45">
                          Command routing, speech, and desktop actions remain online.
                        </div>
                      </div>
                      <div className="rounded-[18px] border border-white/8 bg-black/30 px-3.5 py-2.5 text-right">
                        <div className="mono-label" style={{ fontSize: '9px' }}>Provider</div>
                        <div className="mt-1.5 font-rajdhani text-[13px] font-semibold text-white">{providerInfo.name}</div>
                      </div>
                    </div>
                    {/* Stats row */}
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                      <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3.5 py-2.5">
                        <div className="mono-label" style={{ fontSize: '9px' }}>Status</div>
                        <div className="mt-1 font-rajdhani text-[13px] font-semibold text-white">{systemStatus.status}</div>
                      </div>
                      <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3.5 py-2.5">
                        <div className="mono-label" style={{ fontSize: '9px' }}>Intensity</div>
                        <div className="mt-1 font-rajdhani text-[13px] font-semibold text-white">{Math.round(intensity * 100)}%</div>
                      </div>
                      <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3.5 py-2.5">
                        <div className="mono-label" style={{ fontSize: '9px' }}>Latency</div>
                        <div className="mt-1 font-rajdhani text-[13px] font-semibold text-white">
                          {lastActionTime ? `${lastActionTime}ms` : systemStatus.latency}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sticky Input Dock */}
                  <div className="sticky-input-dock mt-auto flex flex-col gap-3 glass-panel p-4">
                    {featureFlags.enableSuggestions && (
                      <Suggestions onSelect={setDraft} isSafeMode={PARTIAL_SAFE_MODE} />
                    )}
                    {/* JARVIS divider */}
                    <div className="jarvis-divider" />
                    <InputBox
                      value={draft}
                      onInputChange={setDraft}
                      onSend={handleSendCommand}
                      isProcessing={isProcessing}
                      onSearchInteraction={(searching) => setIsSearching(searching)}
                      startListeningSignal={wakeStartSignal}
                      onVoiceStateChange={(listening) => {
                        setIsVoiceListening(listening);
                        if (listening) {
                          setAssistantMode('active');
                          setAnimationState('PROCESSING');
                        } else if (!isProcessing && !isDomainActive) {
                          setAnimationState('IDLE');
                        }
                      }}
                    />
                  </div>
                </section>

                {/* ═══ RIGHT: Quick Actions + Neural Mesh ═══ */}
                <section className="flex min-h-0 flex-col gap-4 overflow-y-auto no-scrollbar">
                  {/* Quick Actions */}
                  <div className="glass-panel p-4">
                    <div className="mb-3 mono-label">Quick Actions</div>
                    <div className="grid gap-2.5">
                      {ACTION_SHORTCUTS.map((shortcut) => {
                        const Icon = shortcut.icon;
                        return (
                          <button
                            key={shortcut.id}
                            type="button"
                            onClick={() => handleShortcut(shortcut)}
                            className={`group rounded-[18px] border px-3.5 py-3 text-left transition-all duration-200 border-white/8 bg-white/[0.03] hover:border-cyan-300/20 hover:bg-cyan-400/[0.04]`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors border-white/8 bg-white/[0.04] text-cyan-300/70 group-hover:bg-cyan-400/8 group-hover:text-cyan-300`}>
                                <Icon size={15} />
                              </div>
                              <div className="min-w-0">
                                <div className="font-rajdhani text-[13px] font-semibold text-white/85">{shortcut.title}</div>
                                <div className="font-rajdhani text-[10px] font-medium text-white/30">
                                  {shortcut.subtitle}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Neural Mesh Stats */}
                  <div className="glass-panel p-4">
                    <div className="mono-label">Neural Mesh</div>
                    <div className="mt-3 space-y-2.5">
                      <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3.5 py-2.5">
                        <div className="mono-label" style={{ fontSize: '9px' }}>Provider Keys</div>
                        <div className="mt-1 font-rajdhani text-[13px] font-semibold text-white">{providerInfo.available.length} connected</div>
                      </div>
                      <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3.5 py-2.5">
                        <div className="mono-label" style={{ fontSize: '9px' }}>Loop Budget</div>
                        <div className="mt-1 font-rajdhani text-[13px] font-semibold text-white">{getActiveLoops().length}/1 active</div>
                      </div>
                      <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3.5 py-2.5">
                        <div className="mono-label" style={{ fontSize: '9px' }}>Voice Link</div>
                        <div className={`mt-1 font-rajdhani text-[13px] font-semibold ${isVoiceListening ? 'text-red-300' : 'text-white'}`}>
                          {isVoiceListening ? 'Active' : 'Standby'}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </main>
            </div>
          </div>
        </>
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

      {isDev && <StabilityDashboard />}
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        )}
      </AnimatePresence>
    </Motion.div>
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
