import React, { useEffect, useRef, useState } from 'react';
import GojoLogo from './components/GojoLogo';
import InputBox from './components/InputBox';
import ResponsePanel from './components/ResponsePanel';
import Suggestions from './components/Suggestions';
import SettingsPanel from './components/SettingsPanel';
import { commandRouter } from './services/commandRouter';
import { contextStore } from './services/contextStore';
import { commandService } from './services/api';
import { aiRouter } from './services/aiRouter';
import { memoryStore } from './services/memoryStore';
import { workflowService } from './services/workflowService';
import { intentService } from './services/intentService';
import { UIProvider, useUI } from './context/UIContext';
import { voiceService } from './services/voiceService';

const HARD_SAFE_MODE = false;
const PARTIAL_SAFE_MODE = true;

const INITIAL_FEATURE_FLAGS = {
  enableSuggestions: true,
  enableOrbAnimation: true,
  enableBackground: false, // Disabled heavy background
  enableCursor: false,     // Disabled custom cursor
};

// Removed unused ACTION_SHORTCUTS

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createEntry = (text, role = 'assistant', extra = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text,
  role,
  ...extra,
});

const OVERLAY_QUICK_SUGGESTIONS = [
  'System status',
  'Open VS Code',
  'Quick search',
];

function AppContent() {
  const [featureFlags, setFeatureFlags] = useState(INITIAL_FEATURE_FLAGS);
  const [responses, setResponses] = useState([
    createEntry('Online and ready. How can I help?', 'system'),
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
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState({ currentStep: -1, completed: [], error: null });
  const [commandHistory, setCommandHistory] = useState([]);
  const [followUpSuggestions, setFollowUpSuggestions] = useState([]);
  const [idleIntentLevel, setIdleIntentLevel] = useState('low');
  const scrollRef = useRef(null);
  const overlayShellRef = useRef(null);
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
  
  const LOADING_MESSAGES = [
    "Working on it...",
    "One moment...",
    "Looking into that...",
    "Almost there...",
    "Processing...",
  ];
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const isElectronOverlay = Boolean(window.electronAssistant);
  const isCompactOverlay = isElectronOverlay && new URLSearchParams(window.location.search).get('overlay') === '1';

  useEffect(() => {
    if (isCompactOverlay) return;
    let interval;
    if (isProcessing) {
      interval = setInterval(() => {
        setCurrentLoadingMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
      }, 2000); // Change message every 2 seconds
    } else {
      setCurrentLoadingMessage(LOADING_MESSAGES[0]); // Reset to default
    }
    return () => clearInterval(interval);
  }, [isCompactOverlay, isProcessing]);
  
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
    if (isCompactOverlay) return;
    const intervalId = setInterval(() => {
      if (isBackendOffline) {
        setSystemStatus({ status: 'OFFLINE', latency: '0MS' });
      }
    }, 5000); // 5s interval as requested for stability
    return () => clearInterval(intervalId);
  }, [isBackendOffline, isCompactOverlay]);

  useEffect(() => {
    if (isCompactOverlay) return;
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
  }, [isCompactOverlay]);

  useEffect(() => {
    if (isCompactOverlay) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }

    if (responses.length > 30) {
      setResponses((current) => current.slice(-30));
    }
  }, [responses, activeWorkflow, isCompactOverlay, isProcessing]);

  useEffect(() => {
    if (!isCompactOverlay) return;
    const frameId = requestAnimationFrame(() => setOverlayVisible(true));
    return () => cancelAnimationFrame(frameId);
  }, [isCompactOverlay]);

  useEffect(() => {
    if (!isCompactOverlay) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        window.electron?.invoke?.('toggle');
      }
    };
    const onMouseDown = (event) => {
      const shell = overlayShellRef.current;
      if (shell && !shell.contains(event.target)) {
        window.electronAssistant?.hideOverlay?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [isCompactOverlay]);

  useEffect(() => {
    if (isCompactOverlay) return;
    clearLifecycleTimeouts();
    setIsMerging(false);
    setIsDomainActive(false);
    if (performanceTier === 'critical') {
      setAnimationState('IDLE');
    }
  }, [cleanupSignal, isCompactOverlay, performanceTier]);

  useEffect(() => {
    if (isCompactOverlay) return;
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
  }, [isCompactOverlay]);

  useEffect(() => {
    if (!isElectronOverlay || isCompactOverlay) return;
    const nextMode = (isProcessing || isMerging || isDomainActive) ? 'processing' : assistantMode;
    window.electronAssistant.setMode(nextMode);
    if ((typeof stabilityMode !== 'undefined' && stabilityMode) || nextMode !== 'idle') {
      window.electronAssistant.setOrbProximity(true);
      window.electronAssistant.setClickThrough(false);
    } else {
      window.electronAssistant.setOrbProximity(false);
      window.electronAssistant.setClickThrough(true);
    }
  }, [assistantMode, isCompactOverlay, isElectronOverlay, isMerging, isProcessing, isDomainActive, stabilityMode]);

  useEffect(() => {
    if (!isElectronOverlay || isCompactOverlay || assistantMode !== 'idle' || (typeof stabilityMode !== 'undefined' && stabilityMode) || !featureFlags.enableOrbAnimation) return;
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
  }, [assistantMode, featureFlags.enableOrbAnimation, isCompactOverlay, isElectronOverlay, stabilityMode]);

  useEffect(() => {
    if (!isElectronOverlay || isCompactOverlay) return;

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
  }, [isCompactOverlay, isElectronOverlay]);

  useEffect(() => {
    if (isCompactOverlay) return;
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
  }, [isBackendOffline, isCompactOverlay, isMerging, isProcessing, isDomainActive, stabilityMode]);

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
    const aiResponse = await aiRouter.route(prompt, {
      persona: 'FRIDAY',
      providers: ['OpenAI', 'Gemini'],
      maxSentences: 2
    });
    return {
      text: aiResponse.text,
      provider: aiResponse.provider,
      role: aiResponse.status === 'ERROR' ? 'system' : 'assistant',
    };
  };

  const handleSendCommand = async (text) => {
    const prompt = text.trim();
    if (!prompt || isProcessing || activeWorkflow) return;

    // Reset follow-ups on new command
    setFollowUpSuggestions([]);

    // RESET OPTION: clear memory
    if (prompt.toLowerCase() === 'clear memory') {
      memoryStore.clear();
      contextStore.clear();
      setResponses([createEntry('Memory cleared. New session started.', 'system')]);
      speakResponse('Memory cleared.');
      return;
    }

    // Interrupt any current speaking when a new command is issued
    voiceService.cancel();

    if (isElectronOverlay) setAssistantMode('active');
    setDraft('');
    setIsSearching(false);
    setIsProcessing(true);
    setAnimationState('PROCESSING');
    
    // Memory Store: Save user input
    memoryStore.saveMessage('user', prompt);

    // Minimal interaction logic
    pushResponse(createEntry(prompt, 'user'));
    contextStore.recordAction('command', prompt);
    
    // Auto-Learning: Track command history
    const updatedHistory = [...commandHistory, prompt].slice(-10);
    setCommandHistory(updatedHistory);

    try {
      // 0. Intent Fast-Path
      const quickIntent = intentService.detectIntent(prompt);
      if (quickIntent) {
        try {
          const reply = await intentService.handleIntent(quickIntent);
          
          // Memory Store: Save action + assistant response
          memoryStore.saveAction(prompt);
          memoryStore.saveMessage('assistant', reply);
          setFollowUpSuggestions(['Want me to open something else?', 'Search more on this?']);

          pushResponse(createEntry(`[FRIDAY]: ${reply}`, 'action'));
          speakResponse(reply);
          setSystemStatus((current) => ({ ...current, status: 'ACTION COMPLETE' }));
          return;
        } catch {
          // Silent failover to next handler
        }
      }

      // 1. Local Command Routing (Regex/Hardcoded)
      const localRoute = await commandRouter.route(prompt);
      if (localRoute.handled) {
        // Memory Store: Save action + assistant response
        memoryStore.saveAction(prompt);
        const replyText = localRoute.isWorkflow ? localRoute.workflow.message : localRoute.message;
        memoryStore.saveMessage('assistant', replyText);
        setFollowUpSuggestions(['Want me to open something else?', 'Search more on this?']);

        if (localRoute.isWorkflow) {
          pushResponse(createEntry(`[FRIDAY]: ${localRoute.workflow.message}`, 'action'));
          speakResponse(localRoute.workflow.message);
          executeWorkflow(localRoute.workflow);
        } else {
          pushResponse(createEntry(`[FRIDAY]: ${localRoute.message}`, 'action'));
          speakResponse(localRoute.message);
        }
        setSystemStatus((current) => ({ ...current, status: 'ACTION COMPLETE' }));
        return;
      }

      // 2. AI-Assisted Intent Routing (Simplified)
      setSystemStatus((current) => ({ ...current, status: 'THINKING...' }));
      
      const result = await resolveAssistantResponse(prompt);
      const prefix = result.provider && result.provider !== 'backend' ? `[${result.provider}]` : '[FRIDAY]';
      
      // Memory Store: Save assistant response
      memoryStore.saveMessage('assistant', result.text);

      // Check for workflow in result
      if (result.workflow && result.workflow.steps?.length > 0) {
        // Memory Store: Save action for workflows too
        memoryStore.saveAction(prompt);
        setFollowUpSuggestions(['Want me to open something else?', 'Search more on this?']);

        const workflow = result.workflow;
        
        // Auto-Learning Check: If this is a repeat command, suggest saving
        const repeatCount = updatedHistory.filter(h => h.toLowerCase() === prompt.toLowerCase()).length;
        if (repeatCount >= 3) {
          const routineName = prompt.split(' ').slice(0, 2).join(' ') + ' routine';
          pushResponse(createEntry(`[FRIDAY]: I noticed you've requested this ${repeatCount} times. Would you like me to save this as a permanent routine called "${routineName}"?`, 'assistant'));
          speakResponse(`I've noticed you've requested this several times. Would you like me to save this as a permanent routine?`);
        }

        // Safety Confirmation: if steps > 2, ask first
        if (workflow.steps.length > 2) {
          pushResponse(createEntry(`${prefix}: ${result.text} (Requires confirmation for ${workflow.steps.length} steps)`, result.role));
          speakResponse(`${result.text}. This is a multi-step sequence. Should I proceed?`);
          setActiveWorkflow(workflow);
          setWorkflowStatus({ currentStep: -1, completed: [], error: null });
        } else {
          // Execute immediately for small workflows
          pushResponse(createEntry(`${prefix}: ${result.text}`, result.role));
          speakResponse(result.text);
          executeWorkflow(workflow);
        }
      } else {
        pushResponse(createEntry(`${prefix}: ${result.text}`, result.role));
        speakResponse(result.text);
      }

      setSystemStatus((current) => ({ ...current, status: result.provider === 'backend' ? 'ONLINE' : `${result.provider.toUpperCase()} LINK` }));
    } catch (error) {
      const message = "I’m having trouble reaching the service.";
      
      // Memory Store: Save assistant error response
      memoryStore.saveMessage('assistant', message);

      pushResponse(createEntry(`COMM LINK ERROR: ${message}`, 'system'));
      speakResponse(message);
      setSystemStatus((current) => ({ ...current, status: 'LINK ERROR' }));
    } finally {
      finalizeInteraction();
      setIsProcessing(false);
      if (isCompactOverlay) {
        window.electronAssistant?.hideOverlay?.();
      }
    }
  };

  const executeWorkflow = async (workflow) => {
    setActiveWorkflow(workflow);
    setWorkflowStatus({ currentStep: 0, completed: [], error: null });
    
    try {
      await workflowService.runWorkflow(
        workflow.steps,
        (index, step) => {
          setWorkflowStatus(prev => ({ ...prev, currentStep: index }));
          setSystemStatus({ status: `STEP ${index + 1}: ${step.action.toUpperCase()}` });
        },
        (index, step) => {
          setWorkflowStatus(prev => ({ ...prev, completed: [...prev.completed, index] }));
        }
      );
      
      pushResponse(createEntry(`[FRIDAY]: Workflow completed.`, 'action'));
      speakResponse('Workflow complete.');
      setSystemStatus({ status: 'WORKFLOW FINISHED' });
    } catch (error) {
      setWorkflowStatus(prev => ({ ...prev, error: error.message }));
      pushResponse(createEntry(`[FRIDAY]: Workflow stopped: ${error.message}`, 'system'));
      speakResponse(`I've encountered an issue: ${error.message}. Stopping the workflow.`);
      setSystemStatus({ status: 'WORKFLOW FAILED' });
    } finally {
      // Clear active workflow after a short delay to show "Completed" state
      setTimeout(() => {
        setActiveWorkflow(null);
        setWorkflowStatus({ currentStep: -1, completed: [], error: null });
      }, 3000);
    }
  };
// Removed unused handleShortcut
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

  if (isCompactOverlay) {
    return (
      <div className={`overlay h-screen w-screen ${overlayVisible ? 'show' : ''}`}>
        <div
          ref={overlayShellRef}
          className="mx-auto mt-2 w-full max-w-[420px] rounded-2xl border border-white/15 bg-[#0a1222]/95 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
        >
          <div className="mb-2 flex gap-2">
            {OVERLAY_QUICK_SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDraft(item)}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70 hover:border-cyan-400/30 hover:text-cyan-200"
              >
                {item}
              </button>
            ))}
          </div>
          <InputBox
            value={draft}
            onChange={setDraft}
            onSend={handleSendCommand}
            isProcessing={isProcessing}
            isListening={isVoiceListening}
          />
        </div>
      </div>
    );
  }

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
              
              {/* Workflow Execution Preview */}
              {activeWorkflow && (
                <div className="workflow-preview glass-ui rounded-2xl p-6 mb-4 border border-cyan-500/20 bg-cyan-500/5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 animate-pulse">
                         <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                       </svg>
                      <h3 className="font-rajdhani text-sm font-bold uppercase tracking-widest text-cyan-100">
                        Autonomous Workflow
                      </h3>
                    </div>
                    {workflowStatus.currentStep === -1 ? (
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-tighter">Awaiting Confirmation</span>
                    ) : (
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-tighter">
                        Executing {workflowStatus.currentStep + 1} / {activeWorkflow.steps.length}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {activeWorkflow.steps.map((step, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 ${
                          workflowStatus.currentStep === idx 
                            ? 'bg-cyan-500/20 border border-cyan-500/30' 
                            : workflowStatus.completed.includes(idx)
                              ? 'opacity-40'
                              : 'opacity-70'
                        }`}
                      >
                        <div className={`h-2 w-2 rounded-full ${
                          workflowStatus.currentStep === idx 
                            ? 'bg-cyan-400 animate-ping' 
                            : workflowStatus.completed.includes(idx)
                              ? 'bg-emerald-400'
                              : 'bg-white/20'
                        }`} />
                        <span className="text-xs font-mono text-white/80">
                          {step.action.replace('_', ' ')}: <span className="text-cyan-300">{step.target}</span>
                        </span>
                        {workflowStatus.completed.includes(idx) && (
                          <span className="ml-auto text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Done</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {workflowStatus.currentStep === -1 && (
                    <div className="mt-6 flex gap-3">
                      <button 
                        onClick={() => executeWorkflow(activeWorkflow)}
                        className="flex-1 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/30 text-cyan-100 text-xs font-bold uppercase tracking-widest transition-all"
                      >
                        Execute Plan
                      </button>
                      <button 
                        onClick={() => setActiveWorkflow(null)}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-bold uppercase tracking-widest transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {workflowStatus.error && (
                    <div className="mt-4 p-2 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-mono">
                      ERROR: {workflowStatus.error}
                    </div>
                  )}
                </div>
              )}

              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-6">
                  <div className="loader" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/60 loading-dots">{currentLoadingMessage}</span>
                </div>
              )}
            </div>

            {/* Input Area (Sticky Bottom) */}
            <div className="sticky bottom-0 z-20 bg-[#0a0f19]/90 backdrop-blur-md p-4 border-t border-white/10">
              <div className="mx-auto max-w-[900px] flex flex-col gap-3">
                {featureFlags.enableSuggestions && !isProcessing && (
                  <Suggestions onSelect={setDraft} isSafeMode={PARTIAL_SAFE_MODE} extraSuggestions={followUpSuggestions} />
                )}
                <div className="relative">
                  <InputBox
                    value={draft}
                    onChange={setDraft}
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
    // App lifecycle — no console spam
    return () => {};
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
