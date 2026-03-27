import React, { useEffect, useMemo, useRef, useState } from "react";
import { commandService } from "../services/api";
import { subscribeMetrics, setBackendStatus } from "../utils/runtimeMetrics";

function getMemoryMb() {
  const memory = performance?.memory;
  if (!memory?.usedJSHeapSize) return "N/A";
  return `${Math.round(memory.usedJSHeapSize / 1024 / 1024)} MB`;
}

export default function StabilityDashboard() {
  const [snapshot, setSnapshot] = useState({
    fps: 0,
    activeLoops: 0,
    memory: "N/A",
    backendStatus: "UNKNOWN",
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeMetrics((payload) => {
      if (!mountedRef.current) return;
      setSnapshot((prev) => ({
        ...prev,
        fps: payload.fps,
        activeLoops: payload.activeLoops,
        backendStatus: payload.backendStatus,
      }));
    });

    const sampleId = setInterval(() => {
      if (!mountedRef.current) return;
      const mem = getMemoryMb();
      setSnapshot((prev) => (prev.memory === mem ? prev : { ...prev, memory: mem }));
    }, 1000);

    const backendId = setInterval(async () => {
      const status = await commandService.getStatus();
      const next = status?.status || "OFFLINE";
      setBackendStatus(next);
    }, 4000);

    return () => {
      mountedRef.current = false;
      unsubscribe();
      clearInterval(sampleId);
      clearInterval(backendId);
    };
  }, []);

  const fpsTone = useMemo(() => {
    if (snapshot.fps >= 60) return "text-green-300";
    if (snapshot.fps >= 40) return "text-yellow-300";
    return "text-red-300";
  }, [snapshot.fps]);

  return (
    <div className="fixed bottom-4 left-4 z-[999] pointer-events-none rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-[10px] font-mono tracking-wide text-gray-200 backdrop-blur-md">
      <div>FPS: <span className={fpsTone}>{snapshot.fps}</span></div>
      <div>LOOPS: {snapshot.activeLoops}</div>
      <div>MEM: {snapshot.memory}</div>
      <div>BACKEND: {snapshot.backendStatus}</div>
    </div>
  );
}
