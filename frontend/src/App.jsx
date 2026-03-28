import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AntigravityBackground from './components/AntigravityBackground';
import GojoLogo from './components/GojoLogo';
import CustomCursor from './components/CustomCursor';
import InputBox from './components/InputBox';
import ResponsePanel from './components/ResponsePanel';
import Suggestions from './components/Suggestions';
import PurpleBlast from './components/PurpleBlast';
import StabilityDashboard from './components/StabilityDashboard';
import { Minimize2 } from 'lucide-react';
import { commandService } from './services/api';
import { UIProvider, useUI } from './context/UIContext';
import { getActiveLoops, stopAllLoops } from './utils/runtimeMetrics';

// CRITICAL: Hard safe mode must mount no effects, loops, or listeners.
const HARD_SAFE_MODE = false; // Transitioned to PARTIAL SAFE MODE
const PARTIAL_SAFE_MODE = true;

const INITIAL_FEATURE_FLAGS = {
  enableSuggestions: true,
  enableOrbAnimation: true,
  enableBackground: true,
  enableCursor: true,
};

function AppContent() {
  const [featureFlags, setFeatureFlags] = useState(INITIAL_FEATURE_FLAGS);
  
  useEffect(() => {
    console.log('[CognitiveOS] AppContent mount (PARTIAL SAFE MODE)');
    console.log(`[CognitiveOS] Initial Feature Flags:`, INITIAL_FEATURE_FLAGS);
    return () => console.log('[CognitiveOS] AppContent unmount');
  }, []);

  const { uiMode, setUiMode, intensity, fps, isUserActive, attentionLevel, startPerformanceSample, syncAnticipationNow, cleanupSignal, performanceTier, visualQuality, qualityScalar, backendStatus } = useUI();
  const isBackendOffline = backendStatus === 'OFFLINE';
  const [responses, setResponses] = useState([
    { id: 'initial', text: 'SYSTEM ONLINE. Adaptive protocols engaged.' }
  ]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isShowingBlast, setIsShowingBlast] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [wakeStartSignal, setWakeStartSignal] = useState(0);
  const [animationState, setAnimationState] = useState('IDLE');
  const [fpsDropCount, setFpsDropCount] = useState(0);
  const [assistantMode, setAssistantMode] = useState(Boolean(window.electronAssistant) ? 'idle' : 'active');
  const [idleIntentLevel, setIdleIntentLevel] = useState('low');
  const [systemStatus, setSystemStatus] = useState({ status: 'ACTIVE', latency: '1MS' });
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
  const [stabilityMode, setStabilityMode] = useState(false);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    // Loop Safety Check
    const activeLoops = getActiveLoops();
    // Allow 'orb' loop only while processing
    const unexpectedLoops = activeLoops.filter(name => isProcessing ? (name !== 'orb') : true);
    
    if (unexpectedLoops.length > 0) {
      console.warn(`[CognitiveOS] SAFETY ALERT: ${unexpectedLoops.length} unexpected loops found: ${unexpectedLoops.join(', ')}. Stopping all.`);
      stopAllLoops();
    }
    
    // Performance Guard Monitoring
    if (fps > 0 && fps < 30) {
      setFpsDropCount(prev => {
        const next = prev + 1;
        if (next >= 5) { // Increased to 5 checks for better stability
          if (featureFlags.enableOrbAnimation || featureFlags.enableBackground) {
            console.warn(`[CognitiveOS] PERFORMANCE GUARD: Persistent low FPS detected (${fps}). Throttling animations.`);
            setFeatureFlags(prevFlags => ({
              ...prevFlags,
              enableOrbAnimation: false,
              enableBackground: false
            }));
          }
        }
        return next;
      });
    } else if (fps >= 45) { // Lower recovery threshold
      setFpsDropCount(0);
      if (!featureFlags.enableOrbAnimation || !featureFlags.enableBackground) {
        setFeatureFlags(prevFlags => ({
          ...prevFlags,
          enableOrbAnimation: INITIAL_FEATURE_FLAGS.enableOrbAnimation,
          enableBackground: INITIAL_FEATURE_FLAGS.enableBackground
        }));
      }
    }

    if (activeLoops.length > 2) { // Lower threshold for PARTIAL SAFE MODE
      console.warn(`[CognitiveOS] PERFORMANCE GUARD: Loop count high (${activeLoops.length}). Stopping animations.`);
      setFeatureFlags(prev => ({
        ...prev,
        enableOrbAnimation: false,
        enableBackground: false
      }));
    }
  }, [fps, featureFlags, isProcessing]);

  // Periodic Performance Monitoring
  useEffect(() => {
    const intervalId = setInterval(() => {
      const activeLoops = getActiveLoops();
      
      // Cleanup verification: If no animation is running, loops must be 0
      const isAnimating = isSearching || isProcessing || isMerging || isShowingBlast || animationState !== 'IDLE';
      if (!isAnimating && activeLoops.length > 0) {
        // Only suggestionsPoll is allowed if not in safe mode
        const heavyLoops = PARTIAL_SAFE_MODE ? activeLoops : activeLoops.filter(l => l !== 'suggestionsPoll');
        if (heavyLoops.length > 0) {
          stopAllLoops();
        }
      }
    }, 5000);
    return () => clearInterval(intervalId);
  }, [fps, featureFlags, isSearching, isProcessing, isMerging, isShowingBlast, animationState, responses.length]);

  const clearLifecycleTimeouts = () => {
    lifecycleTimeoutsRef.current.forEach((id) => clearTimeout(id));
    lifecycleTimeoutsRef.current = [];
  };

  useEffect(() => () => clearLifecycleTimeouts(), []);
  useEffect(() => () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    
    // Performance State Cleanup: Limit history size to 30 entries
    if (responses.length > 30) {
      setResponses(prev => prev.slice(-30));
    }
  }, [responses]);

  useEffect(() => {
    // Automatic cleanup when governor enters critical tier.
    clearLifecycleTimeouts();
    setIsMerging(false);
    setIsShowingBlast(false);
    if (performanceTier === 'critical') {
      setAnimationState('IDLE');
    }
  }, [cleanupSignal, performanceTier]);

  useEffect(() => {
    let mounted = true;
    if (!window.electronAssistant?.getRuntimeConfig) return;
    window.electronAssistant.getRuntimeConfig().then((cfg) => {
      if (!mounted) return;
      setStabilityMode(Boolean(cfg?.stabilityMode));
      if (cfg?.stabilityMode) {
        setAssistantMode('active');
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isElectronOverlay) return;
    const nextMode = (isProcessing || isMerging || isShowingBlast) ? 'processing' : assistantMode;
    window.electronAssistant.setMode(nextMode);
    if (stabilityMode || nextMode !== 'idle') {
      window.electronAssistant.setOrbProximity(true);
      window.electronAssistant.setClickThrough(false);
    } else {
      window.electronAssistant.setOrbProximity(false);
      window.electronAssistant.setClickThrough(true);
    }
  }, [isElectronOverlay, assistantMode, isProcessing, isMerging, isShowingBlast, stabilityMode]);

  useEffect(() => {
    if (!isElectronOverlay || assistantMode !== 'idle' || stabilityMode || (PARTIAL_SAFE_MODE && !featureFlags.enableOrbAnimation)) return;
    let frameId = null;
    let pendingMouse = null;
    const toUnit = (v) => Math.max(0, Math.min(1, v));

    const updateIntentFromMouse = (event) => {
      const orb = orbButtonRef.current;
      if (!orb) return;
      const rect = orb.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const now = performance.now();

      const prevTs = idleIntentRef.current.lastTs || now;
      const dt = Math.max(1, now - prevTs);
      const dxPrev = event.clientX - idleIntentRef.current.lastX;
      const dyPrev = event.clientY - idleIntentRef.current.lastY;
      const velocity = Math.sqrt(dxPrev * dxPrev + dyPrev * dyPrev) / dt;

      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const orbRadius = Math.max(rect.width, rect.height) * 0.5;

      const hoverBand = orbRadius * 2.2;
      const inHoverBand = distance <= hoverBand;
      const hoverMs = inHoverBand
        ? Math.min(4000, idleIntentRef.current.hoverMs + dt)
        : Math.max(0, idleIntentRef.current.hoverMs - dt * 1.5);

      // Distance closer => stronger intent, velocity slower near orb => stronger intent.
      const distanceScore = toUnit(1 - (distance - orbRadius) / (hoverBand - orbRadius));
      const velocityScore = toUnit(1 - velocity / 1.2);
      const hoverScore = toUnit(hoverMs / 1200);

      const weightedScore = (distanceScore * 0.55) + (velocityScore * 0.2) + (hoverScore * 0.25);
      const smoothedScore = idleIntentRef.current.smoothedScore * 0.85 + weightedScore * 0.15;

      let nextLevel = idleIntentRef.current.level;
      // Hysteresis thresholds prevent flicker.
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

      setIdleIntentLevel((prev) => (prev === nextLevel ? prev : nextLevel));

      const nearOrb = nextLevel !== 'low';
      if (nearOrb !== lastOrbNearRef.current) {
        lastOrbNearRef.current = nearOrb;
        window.electronAssistant.setOrbProximity(nearOrb);
      }

      if (nextLevel === 'high') {
        window.electronAssistant.setOrbProximity(true);
        window.electronAssistant.setClickThrough(false);
        setAssistantMode('active');
      }
    };

    const onMouseMove = (e) => {
      pendingMouse = e;
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
  }, [isElectronOverlay, assistantMode, stabilityMode]);

  useEffect(() => {
    if (!isElectronOverlay) return;
    const unsubscribe = window.electronAssistant.onVisibilityChange((payload) => {
      if (payload?.visible) {
        setAssistantMode('active');
      }
    });
    const unsubscribeUpdate = window.electronAssistant.onUpdateReady(() => {
      setSystemStatus((prev) => ({ ...prev, status: 'UPDATE READY' }));
    });
    return () => {
      unsubscribe?.();
      unsubscribeUpdate?.();
    };
  }, [isElectronOverlay]);

  useEffect(() => {
    if (stabilityMode || PARTIAL_SAFE_MODE || isBackendOffline) return;
    let mounted = true;
    const intervalId = setInterval(async () => {
      if (isProcessing || isMerging || isShowingBlast) return;
      const wake = await commandService.consumeWakeWord();
      if (!mounted || !wake?.triggered) return;
      setWakeStartSignal((prev) => prev + 1);
      setAnimationState('PROCESSING');
    }, 1500);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [isProcessing, isMerging, isShowingBlast, stabilityMode, isBackendOffline]);

  const speakResponse = (text) => {
    if (!window.speechSynthesis || !text) return;
    const safeText = text.replace(/^\[JARVIS\]:\s*/i, '').trim();
    if (!safeText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(safeText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const handleSendCommand = async (text) => {
    clearLifecycleTimeouts();
    if (isElectronOverlay) setAssistantMode('active');
    setIsSearching(false);
    setIsProcessing(true);
    setAnimationState('PROCESSING');
    startPerformanceSample(2200);
    syncAnticipationNow();
    
    if (isBackendOffline) {
      setResponses(prev => [...prev, {
        id: `err-${Date.now()}`,
        text: `[SYSTEM]: Connection lost. Neural core is in local fallback mode.`
      }]);
      return;
    }

    try {
      const result = await commandService.send(text);
      
      // Stage 1: Trigger Energy Convergence (Merging/Execution)
      setAnimationState('EXECUTING');
      if (!stabilityMode && visualQuality !== 'OFF') {
        setIsMerging(true);
        await new Promise(r => setTimeout(r, 1000)); // Convergence duration
      }

      // Stage 2: Trigger The Hollow Purple Blast
      if (!stabilityMode && qualityScalar > 0.55) {
        setIsShowingBlast(true);
        await new Promise(r => setTimeout(r, 800)); // Blast duration
      }

      // Stage 3: Show Response / Open App
      const newResponse = {
        id: Math.random().toString(36).substr(2, 9),
        text: `[JARVIS]: ${result.action.message || 'Processing complete.'}`,
        intent: result.intent
      };
      setResponses(prev => [...prev, newResponse]);
      speakResponse(newResponse.text);
      
      // Reset cinematic states
      setIsShowingBlast(false);
      setIsMerging(false);
      setAnimationState('COMPLETE');
      const timeoutId = setTimeout(() => setAnimationState('IDLE'), 500);
      lifecycleTimeoutsRef.current.push(timeoutId);
    } catch (error) {
      setResponses(prev => [...prev, {
        id: `err-${Date.now()}`,
        text: `COMM LINK ERROR: ${error.message}`
      }]);
      speakResponse(`Communication link error: ${error.message}`);
      setAnimationState('COMPLETE');
      const timeoutId = setTimeout(() => setAnimationState('IDLE'), 500);
      lifecycleTimeoutsRef.current.push(timeoutId);
    } finally {
      setIsProcessing(false);
      startPerformanceSample(1200);
      syncAnticipationNow();
    }
  };

  return (
    <motion.div 
      animate={stabilityMode || PARTIAL_SAFE_MODE ? undefined : { scale: isShowingBlast ? 0.98 : 1 }}
      transition={stabilityMode || PARTIAL_SAFE_MODE ? undefined : { duration: 0.2 }}
      className={`relative overflow-hidden flex flex-col selection:bg-purple-500/30 ${
        isElectronOverlay
          ? 'w-full h-full rounded-[22px] border border-white/10 bg-black/45 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.55)]'
          : 'w-screen h-screen bg-black'
      }`}
    >
      {PARTIAL_SAFE_MODE && (
        <div className="absolute top-2 left-2 z-[100] px-2 py-1 rounded-md border border-yellow-500/50 bg-yellow-500/10 font-mono text-[8px] text-yellow-500 tracking-widest pointer-events-none">
          PARTIAL SAFE MODE ACTIVE
        </div>
      )}
      {!stabilityMode && featureFlags.enableCursor && qualityScalar > 0.35 && <CustomCursor />}

      {isElectronOverlay && assistantMode === 'idle' && featureFlags.enableOrbAnimation ? (
        <button
          ref={orbButtonRef}
          type="button"
          onClick={() => setAssistantMode('active')}
          className={`absolute inset-0 m-auto w-24 h-24 rounded-full bg-black/60 flex items-center justify-center cursor-pointer transition-all duration-300 ${
            idleIntentLevel === 'medium'
              ? 'border border-neon-cyan/70 shadow-[0_0_58px_rgba(0,243,255,0.48)]'
              : 'border border-neon-cyan/40 shadow-[0_0_40px_rgba(0,243,255,0.35)]'
          }`}
          aria-label="Activate assistant"
        >
          <div className={`w-8 h-8 rounded-full bg-neon-cyan/80 shadow-[0_0_24px_rgba(0,243,255,0.8)] ${
            idleIntentLevel === 'low' ? 'animate-pulse' : 'animate-ping'
          }`} />
        </button>
      ) : isElectronOverlay && assistantMode === 'idle' ? (
        <div className="absolute inset-0 m-auto w-12 h-12 rounded-full border border-neon-cyan/40 bg-black/40 flex items-center justify-center">
           <div className="w-2 h-2 rounded-full bg-neon-cyan" />
        </div>
      ) : (
        <>
          {/* Cinematic Physics Background */}
          {!stabilityMode && featureFlags.enableBackground && visualQuality !== 'OFF' && (
            <AntigravityBackground
              isSearching={isSearching}
              isProcessing={isProcessing}
              isMerging={isMerging}
              animationState={animationState}
              allowNewAnimations={visualQuality !== 'OFF'}
              qualityLevel={visualQuality}
              qualityScalar={qualityScalar}
            />
          )}
          
          {/* Fullscreen Transition Blast */}
          {!stabilityMode && !PARTIAL_SAFE_MODE && qualityScalar > 0.55 && (
            <PurpleBlast isVisible={isShowingBlast} qualityLevel={visualQuality} />
          )}

          {/* Cinematic Header */}
          <header className="relative z-30 w-full p-6 flex justify-between items-start pointer-events-none">
        <motion.div 
          initial={PARTIAL_SAFE_MODE ? undefined : { y: -20, opacity: 0 }}
          animate={PARTIAL_SAFE_MODE ? { opacity: 1 } : { y: 0, opacity: 1 }}
          className="flex items-center gap-4 pointer-events-auto"
        >
          <GojoLogo isProcessing={isProcessing} enableAnimation={featureFlags.enableOrbAnimation} />
          <div className="flex flex-col">
            <h1 className="font-orbitron text-2xl font-black tracking-tighter text-white">
              COGNITIVE <span className="text-neon-cyan">OS</span>
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono tracking-widest uppercase">
              <span className={`w-2 h-2 rounded-full ${isBackendOffline ? 'bg-red-500' : 'bg-neon-cyan'} ${PARTIAL_SAFE_MODE || isBackendOffline ? '' : 'animate-pulse'}`} />
              Intelligence Core v2.0 | FPS: {fps} | {attentionLevel} | {isBackendOffline ? 'BACKEND OFFLINE' : `LOOPS: ${getActiveLoops().length}`}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-4 pointer-events-auto bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/5"
        >
          <select 
            value={uiMode} 
            onChange={(e) => setUiMode(e.target.value)}
            className="bg-transparent text-white text-[10px] font-mono uppercase tracking-widest outline-none cursor-pointer"
          >
            <option value="cinematic">Cinematic</option>
            <option value="focus">Focus</option>
            <option value="smart">Smart</option>
          </select>
        </motion.div>

        <div className="p-4 glass-panel border border-white/5 flex gap-8 font-mono text-[10px] text-neon-cyan tracking-widest pointer-events-auto items-center">
          <div className="flex gap-4 border-r border-white/10 pr-6 mr-2">
            {['CINEMATIC', 'FOCUS', 'SMART'].map(m => (
              <button 
                key={m}
                onClick={() => setUiMode(m.toLowerCase())}
                className={`transition-all cursor-pointer ${uiMode === m.toLowerCase() ? 'text-white border-b border-purple-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-6">
            <div>HZ: <span className={fps < 60 ? 'text-red-500 font-bold' : 'text-white'}>{fps}</span></div>
            <div className="hidden md:block">INTENSITY: <span className="text-white">{Math.round(intensity * 100)}%</span></div>
            <div>STATUS: <span className={isBackendOffline ? 'text-red-500 font-bold' : 'text-white'}>{isBackendOffline ? 'BACKEND OFFLINE' : (isVoiceListening ? 'LISTENING' : systemStatus.status)}</span></div>
          </div>
        </div>
          {isElectronOverlay && (
            <button
              type="button"
              onClick={() => setAssistantMode('idle')}
              className="pointer-events-auto ml-3 p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Collapse assistant"
              title="Collapse to idle orb"
            >
              <Minimize2 size={14} />
            </button>
          )}
          </header>

          {/* Interaction Feed */}
          <main 
            ref={scrollRef}
            className="relative z-20 flex-1 w-full max-w-4xl mx-auto px-6 overflow-y-auto no-scrollbar pt-10 pb-40"
          >
            <ResponsePanel responses={responses} />
            
            <AnimatePresence>
              {isProcessing && !isMerging && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="mt-4 p-4 glass-panel border-l-2 border-purple-500 flex items-center gap-3"
                >
                  <div className="w-1 h-1 bg-purple-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-mono text-purple-400 uppercase tracking-[0.3em] font-black">
                     ACCELERATING NEURAL CORE...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Jarvis Command Console (Fixed) */}
          <footer className={`fixed bottom-0 left-0 w-full z-40 p-8 pt-20 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none transition-opacity duration-300 ${isMerging ? 'opacity-0' : 'opacity-100'}`}>
            <div className="max-w-3xl mx-auto relative pointer-events-auto">
              <InputBox 
                onSend={handleSendCommand} 
                isProcessing={isProcessing} 
                onSearchInteraction={(searching) => setIsSearching(searching)}
                startListeningSignal={wakeStartSignal}
                onVoiceStateChange={(listening) => {
                  setIsVoiceListening(listening);
                  if (listening) {
                    setAssistantMode('active');
                    setAnimationState('PROCESSING');
                  } else if (!isProcessing && !isMerging && !isShowingBlast) {
                    setAnimationState('IDLE');
                  }
                }}
              />
              <div className="absolute -top-32 right-0 w-full flex justify-end">
                {featureFlags.enableSuggestions && <Suggestions onSelect={handleSendCommand} isSafeMode={PARTIAL_SAFE_MODE} />}
              </div>
            </div>
          </footer>

          {/* Background Lighting */}
          <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-neon-cyan/5 blur-[150px] -z-10" />
          <div className="fixed bottom-10 left-10 w-[400px] h-[400px] bg-neon-purple/5 blur-[150px] -z-10" />
        </>
      )}
      {isElectronOverlay && assistantMode !== 'idle' && (
        <button
          type="button"
          onClick={() => window.electronAssistant.toggle()}
          className="absolute top-3 right-3 z-50 w-2.5 h-2.5 rounded-full bg-red-400/70 hover:bg-red-300 transition-colors"
          aria-label="Hide assistant"
          title="Hide assistant"
        />
      )}
      {isElectronOverlay && assistantMode === 'idle' && (
        <button
          type="button"
          onClick={() => window.electronAssistant.toggle()}
          className="absolute top-3 right-3 z-50 w-2.5 h-2.5 rounded-full bg-white/30 hover:bg-white/50 transition-colors"
          aria-label="Hide assistant"
          title="Hide assistant"
        />
      )}
      {isDev && <StabilityDashboard />}
    </motion.div>
  );
}

export default function App() {
  useEffect(() => {
    console.log('[CognitiveOS] App mount');
    return () => console.log('[CognitiveOS] App unmount');
  }, []);

  if (HARD_SAFE_MODE) {
    console.log('[CognitiveOS] HARD_SAFE_MODE active');
    return (
      <div className="w-screen h-screen bg-black text-white flex items-center justify-center">
        <div className="px-6 py-5 rounded-xl border border-white/10 bg-white/5 font-mono text-sm tracking-widest">
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
