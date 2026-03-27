const store = {
  fps: 0,
  activeLoops: 0,
  backendStatus: "UNKNOWN",
  subscribers: new Set(),
};

const safeEmit = () => {
  store.subscribers.forEach((cb) => {
    try {
      cb({
        fps: store.fps,
        activeLoops: store.activeLoops,
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
    activeLoops: store.activeLoops,
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

export function beginLoop(name = "loop") {
  const key = `__cog_loop_${name}`;
  if (typeof window !== "undefined" && window[key]) return;
  if (typeof window !== "undefined") window[key] = true;
  store.activeLoops += 1;
  safeEmit();
}

export function endLoop(name = "loop") {
  const key = `__cog_loop_${name}`;
  if (typeof window !== "undefined" && !window[key]) return;
  if (typeof window !== "undefined") window[key] = false;
  store.activeLoops = Math.max(0, store.activeLoops - 1);
  safeEmit();
}
