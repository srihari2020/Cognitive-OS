const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAssistant", {
  setMode: (mode) => ipcRenderer.invoke("assistant:set-mode", mode),
  setClickThrough: (enabled) => ipcRenderer.invoke("assistant:set-click-through", enabled),
  setOrbProximity: (isNear) => ipcRenderer.invoke("assistant:set-orb-proximity", isNear),
  getRuntimeConfig: () => ipcRenderer.invoke("assistant:get-runtime-config"),
  toggle: () => ipcRenderer.invoke("assistant:toggle"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openPath: (target) => ipcRenderer.invoke("assistant:open-path", target),
  launchApp: (appName) => ipcRenderer.invoke("assistant:launch-app", appName),
  setVolume: (level) => ipcRenderer.invoke("assistant:set-volume", level),
  getVolume: () => ipcRenderer.invoke("assistant:get-volume"),
  getSystemInfo: () => ipcRenderer.invoke("assistant:get-system-info"),
  hideOverlay: () => ipcRenderer.invoke("assistant:hide-overlay"),
  executeCommand: (command) => ipcRenderer.invoke("execute-command", command),
  scanApps: () => ipcRenderer.invoke("scan-apps"),
  onVisibilityChange: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("assistant:visibility", handler);
    return () => ipcRenderer.removeListener("assistant:visibility", handler);
  },
  onUpdateReady: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = () => callback();
    ipcRenderer.on("assistant:update-ready", handler);
    return () => ipcRenderer.removeListener("assistant:update-ready", handler);
  },
});

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, payload) => {
    if (channel === "toggle") return ipcRenderer.invoke("assistant:toggle");
    if (channel === "hideOverlay") return ipcRenderer.invoke("assistant:hide-overlay", payload);
    return Promise.resolve({ ok: false, error: "Unsupported channel" });
  },
});
