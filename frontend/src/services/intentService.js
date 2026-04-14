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
   * ARCHITECTURE: Gemini-first, silent fallback on any failure
   */
  async generatePlan(text) {
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

    // ALWAYS TRY GEMINI FIRST
    const geminiData = await geminiService.ask(input, context);

    // Validate Gemini response — null or missing intent → fallback silently
    if (!geminiData || !geminiData.intent) {
      return this.fallbackMatcher(text);
    }

    // chat-only intent with no actionable data → fallback
    if (geminiData.intent === "chat" && (!geminiData.app && !geminiData.query)) {
      // Still return the chat response if it has one
      if (geminiData.response) {
        return { intent: "chat", plan: [], response: geminiData.response, source: "gemini" };
      }
      return this.fallbackMatcher(text);
    }

    // Build plan from Gemini's decision
    const validatedPlan = this.validateAndBuildPlan(geminiData);

    // Log cleanly — only log defined values
    const logTarget = geminiData.app || geminiData.query || geminiData.intent;
    console.log("Gemini decision:", geminiData.intent, logTarget);

    return {
      intent: geminiData.intent,
      plan: validatedPlan,
      response: geminiData.response || "",
      confidence: validatedPlan.length > 0 ? 0.95 : 0.5,
      thought: geminiData.thought,
      source: "gemini"
    };
  },

  /**
   * MULTI-INTENT HANDLER: Splits "X and Y" into sequential steps
   */
  handleMultiIntent(input) {
    const steps = input.split(" and ").map(s => s.trim());
    const plan = [];
    let response = "";

    console.log("Multi-intent detected:", steps);

    for (const step of steps) {
      // Parse each step independently
      if (step.startsWith("open ") || step.startsWith("launch ")) {
        const appName = step.replace(/^(open|launch)\s+/i, "").trim();
        const appInfo = this.findBestApp(appName);
        if (appInfo && appInfo.cmd) {
          plan.push({ action: "open_app", target: appInfo.name, cmd: appInfo.cmd });
          response += `Opening ${appName}. `;
        }
      } else if (step.includes("search for") || step.startsWith("search ")) {
        const query = step.replace(/.*search\s+(for\s+)?/i, "").trim();
        plan.push({ action: "search_web", query: query, provider: "google" });
        response += `Searching for ${query}. `;
      } else if (step.match(/youtube|google|gmail|github|chrome|edge|vscode|settings/i)) {
        // Direct service/app access
        const match = step.match(/youtube|google|gmail|github|chrome|edge|vscode|settings|notepad|calculator/i);
        if (match) {
          const service = match[0].toLowerCase();
          const appInfo = this.findBestApp(service);
          if (appInfo && appInfo.cmd) {
            plan.push({ action: "open_app", target: service, cmd: appInfo.cmd });
            response += `Opening ${service}. `;
          }
        }
      }
    }

    return {
      intent: "multi_step",
      plan: plan,
      response: response.trim() || "Executing your commands, sir.",
      confidence: 0.9,
      thought: "Multi-intent split execution"
    };
  },

  /**
   * ACTION VALIDATOR (STRICT SAFETY LAYER)
   */
  validateAndBuildPlan(data) {
    const plan = [];
    const intent = data.intent;

    // Handle multi-step commands from Gemini
    if (intent === "multi_step" && data.steps && Array.isArray(data.steps)) {
      console.log("Processing multi-step from Gemini:", data.steps);
      for (const step of data.steps) {
        const stepPlan = this.validateAndBuildPlan(step);
        plan.push(...stepPlan);
      }
      return plan;
    }

    const app = (data.app || "").toLowerCase().trim();
    const action = (data.action || "").toLowerCase().trim(); // For sub-actions
    const query = data.query;
    const target = data.target; // For file actions

    // Safety Rule: Only execute whitelisted intents
    switch (intent) {
      case "open_app": {
        if (!app) break; // Guard: skip if no app defined
        const appInfo = this.findBestApp(app);
        if (appInfo && appInfo.cmd) {
          plan.push({ action: "open_app", target: appInfo.name, cmd: appInfo.cmd });
        }
        break;
      }

      case "search": {
        if (!query) break; // Guard: skip if no query
        const provider = app === "youtube" ? "youtube" : "google";
        plan.push({ action: "search_web", query: query, provider });
        break;
      }

      case "ui_action":
        if (["click", "scroll_down", "scroll_up"].includes(action)) {
          plan.push({ action: "ui_action", sub_action: action });
        }
        break;

      case "tab_control":
        if (["new_tab", "switch_tab", "close_tab"].includes(action)) {
          plan.push({ action: "tab_control", sub_action: action });
        }
        break;

      case "file_action":
        if (["extract", "zip"].includes(action) && target) {
          plan.push({ action: "file_action", sub_action: action, target: target });
        }
        break;

      case "set_volume":
        if (typeof query === "number") { // query field for volume level
          plan.push({ action: "set_volume", target: query });
        }
        break;

      case "chat":
        // No system action, purely conversational
        break;

      default:
        // Unknown intent, no plan generated
        break;
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
  },

  fallbackMatcher(text) {
    const input = text.toLowerCase().trim();
    
    console.log("Using fallback matcher (Gemini unavailable)");
    
    // FALLBACK MULTI-INTENT: Handle "X and Y" commands when Gemini is down
    if (input.includes(" and ")) {
      return this.handleMultiIntent(input);
    }
    
    // CRITICAL: Keyword-based INSTANT execution (NO AI dependency)
    const appPatterns = [
      // System Apps
      { keywords: ["settings", "setting"], app: "settings", cmd: "start ms-settings:", response: "Opening Settings for you, sir." },
      { keywords: ["bluetooth"], app: "bluetooth", cmd: "start ms-settings:bluetooth", response: "Opening Bluetooth settings, sir." },
      { keywords: ["wifi", "wi-fi", "network"], app: "wifi", cmd: "start ms-settings:network", response: "Opening Network settings, sir." },
      
      // URLs
      { keywords: ["youtube"], app: "youtube", cmd: "start https://youtube.com", response: "Opening YouTube for you, sir." },
      { keywords: ["google"], app: "google", cmd: "start https://google.com", response: "Opening Google for you, sir." },
      { keywords: ["gmail"], app: "gmail", cmd: "start https://mail.google.com", response: "Opening Gmail for you, sir." },
      { keywords: ["github"], app: "github", cmd: "start https://github.com", response: "Opening GitHub for you, sir." },
      
      // Desktop Apps
      { keywords: ["chrome", "browser"], app: "chrome", cmd: "start chrome", response: "Opening Chrome for you, sir." },
      { keywords: ["vscode", "vs code", "code editor", "visual studio"], app: "vscode", cmd: "code", response: "Opening VS Code for you, sir." },
      { keywords: ["edge"], app: "edge", cmd: "start msedge", response: "Opening Edge for you, sir." },
      { keywords: ["notepad"], app: "notepad", cmd: "notepad", response: "Opening Notepad for you, sir." },
      { keywords: ["calculator", "calc"], app: "calculator", cmd: "calc", response: "Opening Calculator for you, sir." },
      { keywords: ["explorer", "file explorer", "files"], app: "explorer", cmd: "explorer", response: "Opening File Explorer for you, sir." },
    ];

    for (const pattern of appPatterns) {
      if (pattern.keywords.some(kw => input.includes(kw))) {
        console.log("Fallback matched:", pattern.app, "→", pattern.cmd);
        return {
          intent: "open_app",
          app: pattern.app,
          plan: [{ action: "open_app", target: pattern.app, cmd: pattern.cmd }],
          response: pattern.response,
          confidence: 0.85,
          source: "fallback"
        };
      }
    }

    return { 
      intent: "chat", 
      plan: [], 
      response: "", 
      confidence: 0.5,
      source: "fallback"
    };
  }
};

