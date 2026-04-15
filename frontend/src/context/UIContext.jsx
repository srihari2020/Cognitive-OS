import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { commandService } from '../services/api';
import { registerLoop, unregisterLoop, setMetricsFps, subscribeMetrics } from '../utils/runtimeMetrics';

const UIContext = createContext();

import { backgroundService } from '../services/BackgroundService';
import { aiRouter } from '../services/aiRouter';
import { commandRouter } from '../services/commandRouter';

export const UIProvider = ({ children }) => {
  const [uiMode, setUiMode] = useState('smart'); // 'cinematic', 'focus', 'smart'
  const [behaviorMode, setBehaviorMode] = useState('active'); // 'idle', 'active', 'processing', 'handy'
  const [intensity, setIntensity] = useState(1);
  const [fps, setFps] = useState(120);
  const [isUserActive, setIsUserActive] = useState(false);
  const [anticipation, setAnticipation] = useState(null);
  const [attentionLevel, setAttentionLevel] = useState('IDLE');
  const [activeLoops, setActiveLoops] = useState(0);
  const [performanceTier, setPerformanceTier] = useState('normal'); // normal | degraded | critical
  const [visualQuality, setVisualQuality] = useState('HIGH'); // HIGH | MEDIUM | LOW | OFF
  const [qualityScalar, setQualityScalar] = useState(1);
  const [cleanupSignal, setCleanupSignal] = useState(0);
  const [backendStatus, setBackendStatusInternal] = useState('UNKNOWN');
  
  // GOD MODE states
  const [suggestion, setSuggestion] = useState(null);
  const [isAutoActionPending, setIsAutoActionPending] = useState(false);
  const [autoActionTimeout, setAutoActionTimeout] = useState(null);
  const [notification, setNotification] = useState(null);

  const processCommand = async (command) => {
    const prevMode = behaviorMode;
    setBehaviorMode('processing');
    try {
      const result = await commandRouter.route(command);
      setNotification({ message: result.message, type: result.handled === false ? 'error' : 'success' });
      
      // Auto transition to handy mode if we launched an app or url
      const isLaunchAction = /(open|launch|start|search|google|youtube|whatsapp)/i.test(command);
      if (isLaunchAction && prevMode !== 'handy') {
        setTimeout(() => {
          setBehaviorMode('handy');
          if (window.electronAssistant && window.electronAssistant.setMode) {
            window.electronAssistant.setMode('handy');
          }
        }, 1500);
      } else {
        setBehaviorMode(prevMode);
      }
      
      return result;
    } catch (error) {
      setNotification({ message: error?.message || 'Something went wrong.', type: 'error' });
      setBehaviorMode(prevMode);
    }
  };

  const switchMode = (mode) => {
    setBehaviorMode(mode);
    if (window.electronAssistant && window.electronAssistant.setMode) {
      window.electronAssistant.setMode(mode);
    }
  };

  const handleProactiveSuggestion = async (sug) => {
    // DISABLED: No auto-execution, only show suggestion
    console.log("Proactive suggestion (display only, no auto-exec):", sug);
    setSuggestion(sug);
    // Auto-action completely disabled
  };

  const cancelAutoAction = () => {
    if (autoActionTimeout) {
      clearTimeout(autoActionTimeout);
      setAutoActionTimeout(null);
    }
    setIsAutoActionPending(false);
    setSuggestion(null);
  };

  const handleWakeWordTriggered = () => {
    console.log('FRIDAY: "Arise" detected.');
    setNotification({ message: 'Ready when you are.', type: 'info' });
    // Potential voice trigger logic here
  };

  useEffect(() => {
    // DISABLED: BackgroundService can suggest but NOT auto-execute
    // backgroundService.start({
    //   onProactiveSuggestion: handleProactiveSuggestion,
    //   onWakeWordTriggered: handleWakeWordTriggered
    // });
    console.log("App ready — no auto actions, user-triggered only");

    // return () => backgroundService.stop();
  }, []);
  
  const fpsRef = useRef([]);
  const lastTimeRef = useRef(performance.now());
  const idleTimerRef = useRef(null);
  const lastSyncRef = useRef(0);
  const fpsSamplerRef = useRef({ running: false, frameId: null, until: 0 });
  const metricsRef = useRef({ fps: 120, activeLoops: 0, memoryMb: 0 });
  const memoryTrendRef = useRef([]);
  const recoveryRef = useRef(0);
  const targetQualityRef = useRef(1);
  const loopTrendRef = useRef([]);
  const interactionBurstRef = useRef([]);
  const activityThrottleRef = useRef(0);

  const QUALITY_TO_SCALAR = {
    HIGH: 1,
    MEDIUM: 0.72,
    LOW: 0.42,
    OFF: 0,
  };

  const stopPerformanceSample = () => {
    if (fpsSamplerRef.current.frameId) {
      clearInterval(fpsSamplerRef.current.frameId);
    }
    fpsSamplerRef.current = { running: false, frameId: null, until: 0 };
    fpsRef.current = [];
  };

  const startPerformanceSample = (durationMs = 1500) => {
    // If user is idle and not in a special animation state, don't start a new sample
    if (!isUserActive && !fpsSamplerRef.current.running) return;
    
    const now = performance.now();
    if (fpsSamplerRef.current.running) {
      fpsSamplerRef.current.until = Math.max(fpsSamplerRef.current.until, now + durationMs);
      return;
    }

    fpsSamplerRef.current.running = true;
    fpsSamplerRef.current.until = now + durationMs;
    lastTimeRef.current = now;
    fpsRef.current = [];

    // Use a throttled interval for FPS estimation instead of a loop
    const tick = () => {
      const time = performance.now();
      
      // If user became idle or component stopped running, kill the interval
      if (!isUserActive && !fpsSamplerRef.current.running) {
        stopPerformanceSample();
        return;
      }

      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (delta > 0) {
        fpsRef.current.push(1000 / delta);
      }

      if (time >= fpsSamplerRef.current.until) {
        const avg = fpsRef.current.length
          ? fpsRef.current.reduce((a, b) => a + b, 0) / fpsRef.current.length
          : fps;
        
        // Cap FPS display to 60 for consistency and perceived stability
        const cappedAvg = Math.min(avg, 60);
        const rounded = Math.round(cappedAvg);
        
        setFps(rounded);
        setMetricsFps(rounded);

        // Dynamic Performance Scaling in Smart Mode
        if (uiMode === 'smart' && avg < 45) {
          setIntensity(0.4);
        } else if (uiMode === 'smart' && avg > 55) {
          setIntensity(1);
        }

        stopPerformanceSample();
        return;
      }
    };

    // No registerLoop: fpsSampler is now a standard throttled interval
    fpsSamplerRef.current.frameId = setInterval(tick, 100);
    tick(); // Immediate first tick
  };

  const syncAnticipationNow = async () => {
    if (backendStatus === 'OFFLINE' || commandService.isOffline()) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 800) return;
    lastSyncRef.current = now;
    const data = await commandService.getAnticipation();
    if (!data) return;
    setAnticipation(data.anticipation);
    setAttentionLevel(data.attention_level);

    if (uiMode === 'smart') {
      const attentionFactor = data.attention_level === 'HIGH_INTENSITY' ? 0.2 :
                             data.attention_level === 'ACTIVE' ? 0.6 : 1.0;
      setIntensity(attentionFactor);
    }
  };

  // Event-driven baseline sample (on mount/mode switch)
  useEffect(() => {
    if (isUserActive) {
      startPerformanceSample(1200);
      syncAnticipationNow();
    }
    return () => stopPerformanceSample();
  }, [uiMode, isUserActive]);

  // Automatic stability governor.
  useEffect(() => {
    const unsubscribe = subscribeMetrics((payload) => {
      metricsRef.current.fps = payload.fps || metricsRef.current.fps;
      metricsRef.current.activeLoops = payload.activeLoops || 0;
      setActiveLoops(payload.activeLoops || 0);
      if (payload.backendStatus && payload.backendStatus !== backendStatus) {
        setBackendStatusInternal(payload.backendStatus);
      }
    });

    const controlId = setInterval(() => {
      const fpsNow = metricsRef.current.fps || fps;
      const loopsNow = metricsRef.current.activeLoops || 0;
      const memory = performance?.memory?.usedJSHeapSize
        ? performance.memory.usedJSHeapSize / 1024 / 1024
        : 0;
      if (memory > 0) {
        metricsRef.current.memoryMb = memory;
        const trend = memoryTrendRef.current;
        trend.push(memory);
        if (trend.length > 6) trend.shift();
      }

      const trend = memoryTrendRef.current;
      const hasGrowthTrend =
        trend.length >= 5 &&
        trend.every((v, i) => i === 0 || v >= trend[i - 1]) &&
        (trend[trend.length - 1] - trend[0] > 40);

      const loopTrend = loopTrendRef.current;
      loopTrend.push(loopsNow);
      if (loopTrend.length > 8) loopTrend.shift();
      const loopsAccelerating =
        loopTrend.length >= 4 &&
        (loopTrend[loopTrend.length - 1] - loopTrend[0] >= 2);

      const nowTs = Date.now();
      const recentInteractions = interactionBurstRef.current.filter((t) => nowTs - t < 1800).length;
      const interactionSpike = recentInteractions > 28;

      // Early warning risk score for preemptive scaling before FPS collapse.
      const predictiveRisk =
        (loopsAccelerating ? 0.34 : 0) +
        (hasGrowthTrend ? 0.36 : 0) +
        (interactionSpike ? 0.2 : 0) +
        (fpsNow < 56 ? 0.16 : 0);

      let nextTier = performanceTier;
      let targetQuality = visualQuality;

      if (fpsNow < 24 || loopsNow > 8 || (hasGrowthTrend && trend[trend.length - 1] > 500)) {
        nextTier = 'critical';
        targetQuality = 'OFF';
      } else if (fpsNow < 34 || loopsNow > 6 || hasGrowthTrend) {
        nextTier = 'critical';
        targetQuality = 'LOW';
      } else if (fpsNow < 50 || loopsNow > 4) {
        nextTier = 'degraded';
        targetQuality = 'MEDIUM';
      } else if (predictiveRisk >= 0.5) {
        // Preemptive and gentle: step down one level before visible degradation.
        nextTier = 'degraded';
        targetQuality = visualQuality === 'HIGH' ? 'MEDIUM' : visualQuality;
      } else if (fpsNow > 58 && loopsNow <= 2) {
        recoveryRef.current += 1;
        if (recoveryRef.current >= 3) {
          nextTier = 'normal';
          targetQuality = 'HIGH';
        }
      } else {
        recoveryRef.current = 0;
      }

      if (nextTier !== performanceTier) {
        setPerformanceTier(nextTier);
      }

      if (targetQuality !== visualQuality) {
        setVisualQuality(targetQuality);
        targetQualityRef.current = QUALITY_TO_SCALAR[targetQuality];
      }

      if (targetQuality === 'OFF') {
        setCleanupSignal((prev) => prev + 1);
        setIntensity(0.2);
      } else if (targetQuality === 'LOW') {
        setIntensity(0.3);
      } else if (targetQuality === 'MEDIUM') {
        setIntensity(0.5);
      }
    }, 2000);

    // Smooth scaling at 1s cadence (idle-safe). No sub-second polling.
    const smoothId = setInterval(() => {
      const target = targetQualityRef.current;
      setQualityScalar((prev) => {
        if (Math.abs(target - prev) < 0.02) return target;
        return prev + (target - prev) * 0.35;
      });
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(controlId);
      clearInterval(smoothId);
    };
  }, [fps, performanceTier, visualQuality]);

  // Activity Monitor + throttled sync (event-driven only)
  useEffect(() => {
    const handleActivity = (e) => {
      // Throttle activity processing to avoid mousemove floods (30–60ms).
      const now = Date.now();
      if (now - activityThrottleRef.current < 60) return;
      activityThrottleRef.current = now;
      interactionBurstRef.current.push(Date.now());
      if (interactionBurstRef.current.length > 60) {
        interactionBurstRef.current.shift();
      }
      setIsUserActive(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      // Throttle backend interaction sync (every 250ms)
      if (now - lastSyncRef.current > 250) {
        const x = e.clientX || 0;
        const y = e.clientY || 0;
        commandService.recordInteraction(e.type, x, y);
      }

      // Auto-Focus on activity if Smart
      if (uiMode === 'smart') {
         setIntensity(0.5);
      }
      startPerformanceSample(900);
      syncAnticipationNow();

      idleTimerRef.current = setTimeout(() => {
        setIsUserActive(false);
        // Reset FPS baseline to 60 when idle to prevent stuck low values
        setFps(60);
        setMetricsFps(60);
        
        if (uiMode === 'smart') setIntensity(1);
      }, 5000); // Resume Cinematic after 5s idle
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [uiMode]);

  const value = {
    uiMode,
    setUiMode,
    behaviorMode,
    setBehaviorMode,
    intensity: uiMode === 'focus' ? 0.1 : intensity,
    fps,
    isUserActive,
    anticipation,
    attentionLevel,
    activeLoops,
    performanceTier,
    visualQuality,
    qualityScalar,
    allowHeavyVisuals: visualQuality !== 'OFF',
    allowNewAnimations: visualQuality !== 'OFF',
    cleanupSignal,
    backendStatus,
    startPerformanceSample,
    syncAnticipationNow,
    suggestion,
    isAutoActionPending,
    cancelAutoAction,
    notification,
    setNotification,
    processCommand,
    switchMode
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => useContext(UIContext);
