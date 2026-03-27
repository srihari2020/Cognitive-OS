const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAssistant", {
  setMode: (mode) => ipcRenderer.invoke("assistant:set-mode", mode),
  setClickThrough: (enabled) => ipcRenderer.invoke("assistant:set-click-through", enabled),
  setOrbProximity: (isNear) => ipcRenderer.invoke("assistant:set-orb-proximity", isNear),
  getRuntimeConfig: () => ipcRenderer.invoke("assistant:get-runtime-config"),
  toggle: () => ipcRenderer.invoke("assistant:toggle"),
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
