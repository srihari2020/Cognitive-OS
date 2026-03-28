const store = {
  fps: 0,
  backendStatus: "UNKNOWN",
  subscribers: new Set(),
};

// Global loop registry with optional stop callbacks (failsafe).
const loopRegistry = new Map(); // name -> { startedAt, stop }
const LOOP_THRESHOLD = 4;

const safeEmit = () => {
  store.subscribers.forEach((cb) => {
    try {
      cb({
        fps: store.fps,
        activeLoops: loopRegistry.size,
        backendStatus: store.backendStatus,
      });
    } catch (_) {
      // Ignore subscriber errors to keep metrics lightweight.
    }
  });
};

export function subscribeMetrics(callback) {
  if (typeof callback !== "function") return () => {};
  store.subscribers.add(callback);
  callback({
    fps: store.fps,
    activeLoops: loopRegistry.size,
    backendStatus: store.backendStatus,
  });
  return () => store.subscribers.delete(callback);
}

export function setMetricsFps(fps) {
  const next = Number.isFinite(fps) ? Math.round(fps) : 0;
  if (store.fps === next) return;
  store.fps = next;
  safeEmit();
}

export function setBackendStatus(status) {
  if (store.backendStatus === status) return;
  store.backendStatus = status;
  safeEmit();
}

export function registerLoop(name, stop) {
  if (!name) return false;
  if (loopRegistry.has(name)) return true;

  if (loopRegistry.size >= LOOP_THRESHOLD) {
    // Failsafe: stop everything we know about, then refuse new loop.
    try {
      // eslint-disable-next-line no-console
      console.warn(`[CognitiveOS] LOOP FAILSAFE: threshold exceeded (${loopRegistry.size}). Stopping loops.`);
    } catch (_) {}
    stopAllLoops();
    return false;
  }

  loopRegistry.set(name, { startedAt: Date.now(), stop: typeof stop === "function" ? stop : null });
  safeEmit();
  return true;
}

export function unregisterLoop(name) {
  if (!loopRegistry.has(name)) return;
  loopRegistry.delete(name);
  safeEmit();
}

export function getActiveLoops() {
  return Array.from(loopRegistry.keys());
}

export function stopAllLoops() {
  for (const [name, info] of loopRegistry.entries()) {
    try {
      info.stop?.();
    } catch (_) {
      // ignore stop errors
    }
    loopRegistry.delete(name);
  }
  safeEmit();
}

// Backwards-compatible aliases used across the codebase.
export function beginLoop(name = "loop", stop) {
  return registerLoop(name, stop);
}

export function endLoop(name = "loop") {
  return unregisterLoop(name);
}
