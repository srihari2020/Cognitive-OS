// ==========================================
// Imports
// ==========================================
const { app, BrowserWindow, globalShortcut, ipcMain, screen, session, shell, desktopCapturer } = require("electron");
const path = require("path");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const fsPromises = fs.promises;
const os = require("os");
const robot = require("robotjs");
const log = require("electron-log/main");
const { autoUpdater } = require("electron-updater");
const loudness = require("loudness");

// ==========================================
// Config & State
// ==========================================
// Set speed of mouse movements
robot.setMouseDelay(2);

// Cache for scanned applications
let cachedApps = {};

// HARD SAFE MODE: reduce GPU/system risk while debugging crashes.
app.disableHardwareAcceleration();

const DEV_URL = process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:5173";
const isDev = !app.isPackaged;
const HOTKEY = "Alt+Space";
const FULL_HOTKEY = "CommandOrControl+Shift+Space";
const STABILITY_MODE = false;
const MODE_SIZES = {
  idle: { width: 1200, height: 800 },
  active: { width: 1200, height: 800 },
  processing: { width: 1200, height: 800 },
  handy: { width: 320, height: 500 },
  overlay: { width: 440, height: 160 },
};

let mainWindow = null;
let overlayWindow = null;
let currentMode = "active";
let isPointerNearOrb = false;
let isClickThroughEnabled = false;
let backendProcess = null;
let backendStartAttempted = false;
let updateCheckStarted = false;

// ==========================================
// Helper Functions
// ==========================================

// Helper to scan for installed apps on Windows (optimized with depth limit)
async function scanInstalledApps() {
  log.info("Scanning for applications...");
  
  // Return cached if available and recent (less than 1 hour old)
  if (cachedApps && Object.keys(cachedApps).length > 0) {
    const cacheAge = Date.now() - (cachedApps._timestamp || 0);
    if (cacheAge < 3600000) { // 1 hour
      log.info(`Using cached apps (${Object.keys(cachedApps).length} apps)`);
      return cachedApps;
    }
  }

  const apps = new Map();
  const searchPaths = [
    "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
    path.join(process.env.APPDATA, "Microsoft\\Windows\\Start Menu\\Programs"),
  ];

  const scanDir = async (dir, depth = 0) => {
    // Limit recursion depth to prevent deep scanning
    if (depth > 3) return;
    
    try {
      if (!await fsPromises.access(dir).then(() => true).catch(() => false)) return;
      const files = await fsPromises.readdir(dir, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          await scanDir(fullPath, depth + 1);
        } else if (file.isFile()) {
          if (file.name.endsWith(".lnk")) {
            const name = path.basename(file.name, ".lnk").toLowerCase();
            if (!apps.has(name)) {
              apps.set(name, fullPath);
            }
          } else if (file.name.endsWith(".exe")) {
            const name = path.basename(file.name, ".exe").toLowerCase();
            if (!apps.has(name)) {
              apps.set(name, fullPath);
            }
          }
        }
      }
    } catch (e) {
      // Silently skip inaccessible directories
    }
  };

  for (const dir of searchPaths) {
    await scanDir(dir);
  }

  const result = Object.fromEntries(apps);
  result._timestamp = Date.now(); // Add timestamp for cache validation
  cachedApps = result;
  log.info(`Found ${Object.keys(cachedApps).length} applications.`);
  return cachedApps;
}

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

function positionWindowTopCenter(win, width, height) {
  const display = screen.getPrimaryDisplay();
  const { x, y, width: workWidth } = display.workArea;
  const marginTop = 18;
  const targetX = x + Math.round((workWidth - width) / 2);
  const targetY = y + marginTop;
  win.setBounds({ x: targetX, y: targetY, width, height }, true);
}

function applyMode(mode) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const size = MODE_SIZES[mode] || MODE_SIZES.active;
  currentMode = mode;

  if (mode === "handy") {
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;
    const margin = 20;
    
    mainWindow.setResizable(true); // Temporarily allow resize to set size
    mainWindow.setSize(size.width, size.height, true);
    mainWindow.setPosition(screenWidth - size.width - margin, screenHeight - size.height - margin, true);
    mainWindow.setAlwaysOnTop(true, "floating");
    mainWindow.setResizable(false);
  } else {
    mainWindow.setResizable(true);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setSize(size.width, size.height, true);
    mainWindow.center();
  }
  
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
  log.info("Creating main window");
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    center: true,
    transparent: false,
    frame: true,
    hasShadow: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    fullscreen: false,
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

function createOverlayWindow() {
  const preloadPath = path.join(__dirname, "preload.cjs");
  const iconPath = getIconPath();
  const overlayWidth = 420;
  const overlayHeight = 120;

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
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

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setMenuBarVisibility(false);
  positionWindowTopCenter(overlayWindow, overlayWidth, overlayHeight);

  if (app.isPackaged) {
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    overlayWindow.loadFile(indexPath, { search: "overlay=1" });
  } else {
    overlayWindow.loadURL(`${DEV_URL}?overlay=1`);
  }

  overlayWindow.on("blur", () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      overlayWindow.hide();
    }
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

function registerHotkey() {
  globalShortcut.register(HOTKEY, () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
      return;
    }
    overlayWindow.show();
    overlayWindow.focus();
    overlayWindow.webContents.send("assistant:visibility", { visible: true, mode: "overlay" });
  });

  globalShortcut.register(FULL_HOTKEY, () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
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

// ==========================================
// App Lifecycle
// ==========================================

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
          "connect-src 'self' http://localhost:8000 http://127.0.0.1:* ws://127.0.0.1:* ws://localhost:* https://api.openai.com https://generativelanguage.googleapis.com https://api.anthropic.com; " +
          "img-src 'self' data: https:;"
        ],
      },
    });
  });

  createMainWindow();
  createOverlayWindow();
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

// ==========================================
// IPC Handlers
// ==========================================

// IPC handler for scanning applications
ipcMain.handle("assistant:scan-apps", async () => {
  if (Object.keys(cachedApps).length === 0) {
    return await scanInstalledApps();
  }
  return cachedApps;
});

ipcMain.handle("scan-apps", async () => {
  try {
    const apps = [];
    const programDirs = [
      "C:\\Program Files",
      "C:\\Program Files (x86)"
    ];

    for (const dir of programDirs) {
      if (!fs.existsSync(dir)) continue;

      const items = fs.readdirSync(dir);
      apps.push(...items);
    }
    console.log("Apps found:", apps.length);
    return apps;
  } catch (err) {
    console.error("Scan apps error:", err);
    return [];
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
  if (!overlayWindow || overlayWindow.isDestroyed()) return { visible: false };
  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
    return { visible: false };
  }
  overlayWindow.show();
  overlayWindow.focus();
  return { visible: true };
});

ipcMain.handle("assistant:hide-overlay", () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return { visible: false };
  overlayWindow.hide();
  return { visible: false };
});

ipcMain.handle("assistant:open-external", async (_event, url) => {
  if (!url || typeof url !== "string") return { ok: false, error: "Invalid URL" };
  await shell.openExternal(url);
  return { ok: true };
});

// Alias: preload exposes openExternal via "open-external" channel
ipcMain.handle("open-external", async (_event, url) => {
  if (!url || typeof url !== "string") return { ok: false, error: "Invalid URL" };
  await shell.openExternal(url);
  return { ok: true };
});

// Handler for window.electron.exec used by executor.js
ipcMain.handle("exec", async (_event, cmd) => {
  if (!cmd || typeof cmd !== "string") return { ok: false, error: "Invalid command" };
  log.info("Executing command:", cmd);
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        log.warn("exec error:", error.message);
        resolve({ ok: false, error: error.message });
      } else {
        log.info("exec success:", stdout.trim() || "(no output)");
        resolve({ ok: true, stdout: stdout.trim() });
      }
    });
  });
});

ipcMain.handle("assistant:open-path", async (_event, target) => {
  const normalizedTarget = target === "documents"
    ? app.getPath("documents")
    : target === "downloads"
      ? app.getPath("downloads")
      : target;

  if (!normalizedTarget || typeof normalizedTarget !== "string") {
    return { ok: false, error: "Invalid path target" };
  }

  const result = await shell.openPath(normalizedTarget);
  return { ok: !result, error: result || null };
});

ipcMain.handle("assistant:launch-app", (_event, appName) => {
  if (!appName || typeof appName !== "string") {
    return { ok: false, error: "Invalid app name" };
  }

  // Security: Restricted whitelist of allowed apps
  const whitelist = {
    vscode: "code",
    chrome: "start chrome",
    explorer: "explorer",
    notepad: "notepad",
    calculator: "calc",
  };

  const command = whitelist[appName.toLowerCase()];
  if (!command) {
    return { ok: false, error: "App not in security whitelist." };
  }

  return new Promise((resolve) => {
    try {
      const child = spawn("powershell.exe", ["-NoProfile", "-Command", `Start-Process "${command}"`], {
        windowsHide: true,
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      resolve({ ok: true });
    } catch (error) {
      resolve({ ok: false, error: error.message });
    }
  });
});

ipcMain.handle("assistant:get-active-app", async () => {
  return new Promise((resolve) => {
    try {
      // Get the title of the foreground window via PowerShell
      const command = `(Get-Process | Where-Object { $_.MainWindowHandle -eq (Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name "Win32GetForegroundWindow" -Namespace "Win32Functions" -PassThru)::GetForegroundWindow() }).ProcessName`;
      
      const child = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let output = "";
      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.on("close", () => {
        resolve(output.trim() || "unknown");
      });
    } catch (error) {
      resolve("unknown");
    }
  });
});

ipcMain.handle("assistant:ui-action", (_event, { action, target, x, y }) => {
  try {
    switch (action) {
      case "click":
        if (x !== undefined && y !== undefined) {
          robot.moveMouse(x, y);
        }
        robot.mouseClick();
        return { ok: true, message: "Clicked, sir." };
      
      case "scroll_down":
        robot.scrollMouse(0, -100);
        return { ok: true, message: "Scrolling down, sir." };
      
      case "scroll_up":
        robot.scrollMouse(0, 100);
        return { ok: true, message: "Scrolling up, sir." };
      
      case "move_mouse":
        if (x !== undefined && y !== undefined) {
          robot.moveMouse(x, y);
          return { ok: true, message: `Moved mouse to ${x}, ${y}, sir.` };
        }
        return { ok: false, error: "Coordinates missing" };

      default:
        return { ok: false, error: `Unknown UI action: ${action}` };
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("assistant:tab-control", (_event, { action }) => {
  try {
    switch (action) {
      case "new_tab":
        robot.keyTap("t", "control");
        return { ok: true, message: "New tab opened, sir." };
      
      case "switch_tab":
        robot.keyTap("tab", "control");
        return { ok: true, message: "Switched tab, sir." };
      
      case "close_tab":
        robot.keyTap("w", "control");
        return { ok: true, message: "Tab closed, sir." };
      
      default:
        return { ok: false, error: `Unknown tab action: ${action}` };
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("assistant:file-action", async (_event, { action, target }) => {
  if (!target) return { ok: false, error: "No target file/folder specified." };
  
  const normalizedTarget = path.isAbsolute(target) ? target : path.join(app.getPath("documents"), target);

  return new Promise((resolve) => {
    try {
      let command;
      switch (action) {
        case "extract":
          // powershell Expand-Archive -Path file.zip -DestinationPath ./
          command = `powershell -Command "Expand-Archive -Path '${normalizedTarget}' -DestinationPath '${path.dirname(normalizedTarget)}' -Force"`;
          break;
        
        case "zip":
          // powershell Compress-Archive -Path folder -DestinationPath folder.zip
          command = `powershell -Command "Compress-Archive -Path '${normalizedTarget}' -DestinationPath '${normalizedTarget}.zip' -Force"`;
          break;
        
        default:
          return resolve({ ok: false, error: `Unknown file action: ${action}` });
      }

      exec(command, (error, stdout, stderr) => {
        if (error) {
          resolve({ ok: false, error: stderr || error.message });
        } else {
          resolve({ ok: true, message: `${action === "extract" ? "Extracted" : "Zipped"} successfully, sir.` });
        }
      });
    } catch (error) {
      resolve({ ok: false, error: error.message });
    }
  });
});

ipcMain.handle("assistant:set-volume", async (_event, level) => {
  try {
    const vol = Math.min(Math.max(parseInt(level, 10), 0), 100);
    await loudness.setVolume(vol);
    return { ok: true, volume: vol };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("assistant:get-volume", async () => {
  try {
    const vol = await loudness.getVolume();
    return { ok: true, volume: vol };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("assistant:get-system-info", () => ({
  ok: true,
  platform: os.platform(),
  release: os.release(),
  arch: os.arch(),
  hostname: os.hostname(),
  totalMemoryGb: Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(1)),
  freeMemoryGb: Number((os.freemem() / 1024 / 1024 / 1024).toFixed(1)),
  cpuCores: os.cpus().length,
  uptimeMinutes: Math.round(os.uptime() / 60),
}));

ipcMain.handle("assistant:get-runtime-config", () => ({
  stabilityMode: STABILITY_MODE,
  clickThroughEnabled: false,
}));
