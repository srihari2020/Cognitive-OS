import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { commandService } from '../services/api';
import { beginLoop, endLoop, setMetricsFps, subscribeMetrics } from '../utils/runtimeMetrics';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [uiMode, setUiMode] = useState('smart'); // 'cinematic', 'focus', 'smart'
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

  const QUALITY_TO_SCALAR = {
    HIGH: 1,
    MEDIUM: 0.72,
    LOW: 0.42,
    OFF: 0,
  };

  const stopPerformanceSample = () => {
    if (fpsSamplerRef.current.frameId) {
      cancelAnimationFrame(fpsSamplerRef.current.frameId);
      endLoop('fpsSampler');
    }
    fpsSamplerRef.current = { running: false, frameId: null, until: 0 };
    fpsRef.current = [];
  };

  const startPerformanceSample = (durationMs = 1500) => {
    const now = performance.now();
    if (fpsSamplerRef.current.running) {
      fpsSamplerRef.current.until = Math.max(fpsSamplerRef.current.until, now + durationMs);
      return;
    }

    fpsSamplerRef.current.running = true;
    fpsSamplerRef.current.until = now + durationMs;
    lastTimeRef.current = now;
    fpsRef.current = [];

    const sample = (time) => {
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (delta > 0) {
        fpsRef.current.push(1000 / delta);
      }

      if (time >= fpsSamplerRef.current.until) {
        const avg = fpsRef.current.length
          ? fpsRef.current.reduce((a, b) => a + b, 0) / fpsRef.current.length
          : fps;
        const rounded = Math.round(avg);
        setFps(rounded);
        setMetricsFps(rounded);

        // Dynamic Performance Scaling in Smart Mode
        if (uiMode === 'smart' && avg < 60) {
          setIntensity(0.4);
        } else if (uiMode === 'smart' && avg > 100) {
          setIntensity(1);
        }

        stopPerformanceSample();
        return;
      }

      fpsSamplerRef.current.frameId = requestAnimationFrame(sample);
    };

    beginLoop('fpsSampler');
    fpsSamplerRef.current.frameId = requestAnimationFrame(sample);
  };

  const syncAnticipationNow = async () => {
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
    startPerformanceSample(1200);
    syncAnticipationNow();
    return () => stopPerformanceSample();
  }, [uiMode]);

  // Automatic stability governor.
  useEffect(() => {
    const unsubscribe = subscribeMetrics((payload) => {
      metricsRef.current.fps = payload.fps || metricsRef.current.fps;
      metricsRef.current.activeLoops = payload.activeLoops || 0;
      setActiveLoops(payload.activeLoops || 0);
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

    const smoothId = setInterval(() => {
      const target = targetQualityRef.current;
      setQualityScalar((prev) => {
        const next = prev + (target - prev) * 0.18;
        return Math.abs(next - prev) < 0.01 ? target : next;
      });
    }, 250);

    return () => {
      unsubscribe();
      clearInterval(controlId);
      clearInterval(smoothId);
    };
  }, [fps, performanceTier, visualQuality]);

  // Activity Monitor + throttled sync (event-driven only)
  useEffect(() => {
    const handleActivity = (e) => {
      interactionBurstRef.current.push(Date.now());
      if (interactionBurstRef.current.length > 60) {
        interactionBurstRef.current.shift();
      }
      setIsUserActive(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      // Throttle backend interaction sync (every 200ms)
      const now = Date.now();
      if (now - lastSyncRef.current > 200) {
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
    startPerformanceSample,
    syncAnticipationNow
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => useContext(UIContext);
