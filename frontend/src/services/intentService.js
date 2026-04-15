import { geminiService } from './geminiService';
import { backgroundService } from './BackgroundService';

const ALLOWED_APPS = {
  chrome: "start chrome",
  edge: "start msedge",
  vscode: "code",
  youtube: "start https://youtube.com",
  whatsapp: "start https://web.whatsapp.com",
  settings: "start ms-settings:",
  calculator: "calc",
  notepad: "notepad",
  explorer: "explorer"
};

// 3-LAYER EXECUTION SYSTEM

// Layer 1: URL Handler (opens in default browser)
const URL_MAP = {
  youtube: "https://youtube.com",
  google: "https://google.com",
  gmail: "https://mail.google.com",
  github: "https://github.com",
  whatsapp: "https://web.whatsapp.com",
  twitter: "https://twitter.com",
  facebook: "https://facebook.com",
  reddit: "https://reddit.com"
};

// Layer 2: System Apps (Windows Settings, etc.)
const SYSTEM_APPS = {
  settings: "start ms-settings:",
  bluetooth: "start ms-settings:bluetooth",
  wifi: "start ms-settings:network",
  network: "start ms-settings:network",
  sound: "start ms-settings:sound",
  display: "start ms-settings:display",
  privacy: "start ms-settings:privacy"
};

// Layer 3: Desktop Apps (installed applications)
const DESKTOP_APPS = {
  vscode: "code",
  code: "code",
  chrome: "start chrome",
  edge: "start msedge",
  notepad: "notepad",
  calculator: "calc",
  calc: "calc",
  explorer: "explorer",
  spotify: "start spotify",
  discord: "start discord",
  slack: "start slack"
};

let scannedApps = {};

// Environment Detection
const isElectron = !!(window.electron && window.electron.exec);

/**
 * FRIDAY Intent Service (AI-Driven & Safety-Validated)
 * Uses Gemini for decision making, with strict validation rules.
 */
export const intentService = {
  async init() {
    // 🚫 BACKGROUND SCANNING DISABLED: Only runs on user action
    if (!window.ALLOW_BACKGROUND) {
      console.log("🚫 Background init blocked (user action required)");
      return;
    }

    if (!isElectron) {
      console.warn("FRIDAY: Intent service initialization skipped in browser mode.");
      return;
    }

    // LOAD FROM CACHE FIRST (instant startup)
    const cached = localStorage.getItem("friday_scanned_apps");
    if (cached) {
      try {
        scannedApps = JSON.parse(cached);
        console.log("Apps loaded from cache:", Object.keys(scannedApps).length);
      } catch (e) {
        console.warn("Failed to parse cached apps:", e);
      }
    }

    // 🚫 BACKGROUND SCAN DISABLED: No automatic scanning
    // Scan only happens when user triggers a command
  },

  async scanAppsInBackground() {
    // 🚫 BACKGROUND SCANNING DISABLED: Only runs on user action
    if (!window.ALLOW_BACKGROUND) {
      console.log("🚫 Background scan blocked (user action required)");
      return;
    }

    const bridge = window.electronAssistant;
    if (!bridge || !bridge.scanApps) return;

    try {
      console.log("Background app scan started...");
      const apps = await bridge.scanApps();
      scannedApps = apps;
      
      // CACHE RESULTS
      localStorage.setItem("friday_scanned_apps", JSON.stringify(apps));
      console.log("Apps scanned and cached:", Object.keys(apps).length);
    } catch (e) {
      console.error('FRIDAY: Background app scan failed:', e);
    }
  },

  /**
   * Manual refresh for apps list (can be called from UI)
   */
  async refreshApps() {
    console.log("Manual app refresh triggered");
    await this.scanAppsInBackground();
  },

  /**
   * Generates a validated plan by consulting Gemini.
   * ARCHITECTURE: Gemini-first for both conversation and actions
   */
  async generatePlan(text, options = {}) {
    // 🚫 STOP EMPTY/INVALID INPUT: Block auto-calls with no content
    if (!text || text.trim() === "") {
      console.log("🚫 Blocked empty command execution");
      return { intent: "chat", plan: [], response: "", confidence: 0, source: "blocked" };
    }

    // 🚫 BACKGROUND INTENT GENERATION DISABLED: Only runs on user action
    if (!window.ALLOW_BACKGROUND) {
      console.log("🚫 Intent generation blocked (user action required)");
      return { intent: "chat", plan: [], response: "", confidence: 0, source: "blocked" };
    }

    const input = text.trim();
    const currentState = backgroundService.getState();
    const context = { activeApp: currentState.activeApp, idleTime: currentState.idleTime };

    // ALWAYS TRY GEMINI FIRST - handles both conversation and actions
    const geminiData = await geminiService.ask(input, context, options);

    // Validate Gemini response — null or missing data
    if (!geminiData || !geminiData.message) {
      throw new Error("AI provider failed to return a proper response.");
    }

    // Extract natural message and actions from Gemini
    const { message, actions } = geminiData;

    // Build plan from Gemini's actions
    const plan = this.buildPlanFromActions(actions || []);

    console.log("Gemini conversation:", message);
    if (plan.length > 0) {
      console.log("Gemini actions:", actions);
    }

    return {
      intent: plan.length > 0 ? "action" : "chat",
      plan: plan,
      response: message, // Natural conversational response from Gemini
      confidence: 0.95,
      source: "gemini"
    };
  },

  /**
   * Converts Gemini actions to executable plan
   */
  buildPlanFromActions(actions) {
    const plan = [];

    for (const action of actions) {
      const actionType = action.type;
      const target = action.target;
      const query = action.query;
      const provider = action.provider;
      const level = action.level;
      const subAction = action.action;

      switch (actionType) {
        case "open_app": {
          if (!target) break;
          const appInfo = this.findBestApp(target);
          if (appInfo && appInfo.cmd) {
            plan.push({ action: "open_app", target: appInfo.name, cmd: appInfo.cmd });
          }
          break;
        }

        case "search": {
          if (!query) break;
          const searchProvider = provider || "google";
          plan.push({ action: "search_web", query: query, provider: searchProvider });
          break;
        }

        case "ui_action": {
          if (["click", "scroll_down", "scroll_up"].includes(subAction)) {
            plan.push({ action: "ui_action", sub_action: subAction });
          }
          break;
        }

        case "tab_control": {
          if (["new_tab", "switch_tab", "close_tab"].includes(subAction)) {
            plan.push({ action: "tab_control", sub_action: subAction });
          }
          break;
        }

        case "file_action": {
          if (["extract", "zip"].includes(subAction) && target) {
            plan.push({ action: "file_action", sub_action: subAction, target: target });
          }
          break;
        }

        case "set_volume": {
          if (typeof level === "number") {
            plan.push({ action: "set_volume", target: level });
          }
          break;
        }

        default:
          // Unknown action type, skip
          break;
      }
    }

    return plan;
  },

  findBestApp(target) {
    const name = target.toLowerCase().trim();
    
    // LAYER 1: URL Handler (highest priority for web services)
    if (URL_MAP[name]) {
      return { name: target, cmd: `start ${URL_MAP[name]}`, type: "url" };
    }

    // LAYER 2: System Apps (Windows Settings)
    if (SYSTEM_APPS[name]) {
      return { name: target, cmd: SYSTEM_APPS[name], type: "system" };
    }

    // LAYER 3: Desktop Apps (installed applications)
    if (DESKTOP_APPS[name]) {
      return { name: target, cmd: DESKTOP_APPS[name], type: "desktop" };
    }

    // LAYER 4: Scanned Apps (fuzzy matching)
    for (const [appName, appPath] of Object.entries(scannedApps)) {
      if (appName.toLowerCase().includes(name) || name.includes(appName.toLowerCase())) {
        return { name: appName, cmd: `start "" "${appPath}"`, type: "scanned" };
      }
    }
    
    // LAYER 5: Last resort - try generic start command
    return { name: target, cmd: `start "" "${target}"`, type: "fallback" };
  }
};
