const { app, BrowserWindow, globalShortcut, ipcMain, screen, session } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const log = require("electron-log/main");
const { autoUpdater } = require("electron-updater");

// HARD SAFE MODE: reduce GPU/system risk while debugging crashes.
app.disableHardwareAcceleration();

const DEV_URL = process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:5173";
const isDev = !app.isPackaged;
const HOTKEY = "CommandOrControl+Shift+Space";
const STABILITY_MODE = true;
const MODE_SIZES = {
  idle: { width: 1200, height: 800 },
  active: { width: 1200, height: 800 },
  processing: { width: 1200, height: 800 },
};

let mainWindow = null;
let currentMode = "active";
let isPointerNearOrb = false;
let isClickThroughEnabled = false;
let backendProcess = null;
let backendStartAttempted = false;
let updateCheckStarted = false;

function getProjectRoot() {
  return path.join(__dirname, "..", "..");
}

function getIconPath() {
  return path.join(__dirname, "..", "build", "icon.ico");
}

function ensureLogDir() {
  const logDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

function wireAppLogging() {
  const logDir = ensureLogDir();
  log.transports.file.resolvePathFn = () => path.join(logDir, "desktop.log");
  log.transports.file.level = "info";
  log.info("Cognitive OS desktop boot");

  process.on("uncaughtException", (error) => {
    log.error("uncaughtException", error);
  });
  process.on("unhandledRejection", (reason) => {
    log.error("unhandledRejection", reason);
  });
}

function appendBackendOutput(stream, fileName) {
  if (!stream) return;
  const outputPath = path.join(ensureLogDir(), fileName);
  stream.on("data", (chunk) => {
    fs.appendFile(outputPath, chunk, () => {});
  });
}

function startBackend() {
  if (backendProcess || backendStartAttempted) return;
  backendStartAttempted = true;

  try {
    if (app.isPackaged) {
      const backendExe = path.join(process.resourcesPath, "backend", "cognitive-backend.exe");
      backendProcess = spawn(backendExe, [], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, UVICORN_WORKERS: "1", COGNITIVE_STABILITY_MODE: "1" },
      });
    } else {
      const projectRoot = getProjectRoot();
      backendProcess = spawn("python", ["server.py"], {
        cwd: projectRoot,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, UVICORN_WORKERS: "1", COGNITIVE_STABILITY_MODE: "1" },
      });
    }

    appendBackendOutput(backendProcess.stdout, "backend.stdout.log");
    appendBackendOutput(backendProcess.stderr, "backend.stderr.log");
    backendProcess.on("exit", () => {
      log.info("Backend process exited");
      backendProcess = null;
    });
    log.info("Backend process started");
  } catch (_error) {
    log.error("Backend process failed to start", _error);
    backendProcess = null;
  }
}

function stopBackend() {
  if (!backendProcess) return;
  try {
    backendProcess.kill();
  } catch (_error) {
    // Ignore kill errors during shutdown.
  } finally {
    backendProcess = null;
  }
}

function positionWindowAtBottomRight(win, width, height) {
  const display = screen.getPrimaryDisplay();
  const { x, y, width: workWidth, height: workHeight } = display.workArea;
  const margin = 20;
  const targetX = x + workWidth - width - margin;
  const targetY = y + workHeight - height - margin;
  win.setBounds({ x: targetX, y: targetY, width, height }, true);
}

function applyMode(mode) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const size = MODE_SIZES[mode] || MODE_SIZES.active;
  currentMode = mode;
  mainWindow.setResizable(true);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.center();
  updateClickThroughState();
}

function setClickThrough(nextEnabled) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // Stability mode keeps interaction deterministic and disables pass-through.
  const forcedEnabled = STABILITY_MODE ? false : nextEnabled;
  if (isClickThroughEnabled === forcedEnabled) return;
  isClickThroughEnabled = forcedEnabled;
  mainWindow.setIgnoreMouseEvents(forcedEnabled, { forward: true });
}

function updateClickThroughState() {
  const shouldPassThrough = currentMode === "idle" && !isPointerNearOrb;
  setClickThrough(shouldPassThrough);
}

function createMainWindow() {
  const preloadPath = path.join(__dirname, "preload.cjs");
  const iconPath = getIconPath();
  log.info("Creating main window (safe config)");
  mainWindow = new BrowserWindow({
    width: MODE_SIZES.active.width,
    height: MODE_SIZES.active.height,
    minWidth: 800,
    minHeight: 600,
    center: true,
    transparent: false,
    frame: true,
    hasShadow: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    show: false,
    backgroundColor: "#090b11",
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setVisibleOnAllWorkspaces(false);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.center();

  if (app.isPackaged) {
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL(DEV_URL);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerHotkey() {
  globalShortcut.register(HOTKEY, () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      return;
    }
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("assistant:visibility", { visible: true, mode: currentMode });
  });
}

function configureAutoUpdater() {
  if (STABILITY_MODE) {
    log.info("Updater skipped in stability mode");
    return;
  }
  if (updateCheckStarted) return;
  updateCheckStarted = true;
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => log.info("Updater: checking for updates"));
  autoUpdater.on("update-available", (info) => {
    log.info("Updater: update available", info?.version || "unknown");
    autoUpdater.downloadUpdate().catch((err) => log.error("Updater: download failed", err));
  });
  autoUpdater.on("update-not-available", () => log.info("Updater: no updates"));
  autoUpdater.on("error", (err) => log.error("Updater error", err));
  autoUpdater.on("update-downloaded", () => {
    log.info("Updater: update downloaded, will install on quit");
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("assistant:update-ready");
    }
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => log.error("Updater check failed", err));
  }, 7000);
}

app.whenReady().then(() => {
  wireAppLogging();
  log.info("App ready (backend disabled temporarily)");
  // startBackend(); // DISABLED: backend spawn can overload system

  // Harden session with production CSP headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // DEV ONLY: Bypass CSP to allow Vite HMR and inline script injection
    if (isDev) {
      callback({});
      return;
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "connect-src 'self' http://localhost:8000 http://127.0.0.1:* ws://127.0.0.1:* ws://localhost:*; " +
          "img-src 'self' data: https:;"
        ],
      },
    });
  });

  createMainWindow();
  registerHotkey();
  configureAutoUpdater();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  // stopBackend(); // backend disabled
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

ipcMain.handle("assistant:set-mode", (_event, mode) => {
  applyMode(mode);
  return { ok: true };
});

ipcMain.handle("assistant:set-click-through", (_event, enabled) => {
  // Explicit override from renderer; mode logic still reapplies on next mode/proximity update.
  setClickThrough(Boolean(enabled));
  return { ok: true, enabled: isClickThroughEnabled };
});

ipcMain.handle("assistant:set-orb-proximity", (_event, isNear) => {
  isPointerNearOrb = Boolean(isNear);
  updateClickThroughState();
  return { ok: true, near: isPointerNearOrb, clickThrough: isClickThroughEnabled };
});

ipcMain.handle("assistant:toggle", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { visible: false };
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return { visible: false };
  }
  mainWindow.show();
  mainWindow.focus();
  return { visible: true };
});

ipcMain.handle("assistant:get-runtime-config", () => ({
  stabilityMode: STABILITY_MODE,
  clickThroughEnabled: false,
}));
