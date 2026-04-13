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

let scannedApps = {};

// Environment Detection
const isElectron = !!(window.electron && window.electron.exec);

/**
 * FRIDAY Intent Service (AI-Driven & Safety-Validated)
 * Uses Gemini for decision making, with strict validation rules.
 */
export const intentService = {
  async init() {
    if (!isElectron) {
      console.warn("FRIDAY: Intent service initialization skipped in browser mode.");
      return;
    }

    const bridge = window.electronAssistant;
    if (bridge && bridge.scanApps) {
      try {
        scannedApps = await bridge.scanApps();
      } catch (e) {
        console.error('FRIDAY: Failed to scan system apps:', e);
      }
    }
  },

  /**
   * Generates a validated plan by consulting Gemini.
   */
  async generatePlan(text) {
    const currentState = backgroundService.getState();
    const context = {
      activeApp: currentState.activeApp,
      idleTime: currentState.idleTime
    };

    try {
      // 1. Get Intent from Gemini Brain
      const geminiData = await geminiService.ask(text, context);
      
      // 2. Validate and Construct Plan
      const validatedPlan = this.validateAndBuildPlan(geminiData);

      return {
        plan: validatedPlan,
        response: geminiData.response,
        confidence: validatedPlan.length > 0 ? 0.95 : 0.5,
        thought: geminiData.thought
      };
    } catch (e) {
      console.error("Gemini Brain failure:", e);
      return this.fallbackMatcher(text);
    }
  },

  /**
   * ACTION VALIDATOR (STRICT SAFETY LAYER)
   */
  validateAndBuildPlan(data) {
    const plan = [];
    const intent = data.intent;
    const app = (data.app || "").toLowerCase().trim();

    // Safety Rule: Only execute whitelisted intents
    switch (intent) {
      case "open_app":
        if (ALLOWED_APPS[app]) {
          plan.push({ action: "open_app", target: app, cmd: ALLOWED_APPS[app] });
        } else {
          // Check scanned apps for safety fallback
          const scanned = this.findScannedApp(app);
          if (scanned) plan.push({ action: "open_app", target: scanned.name, cmd: scanned.cmd });
        }
        break;

      case "search":
        if (data.query) {
          const provider = app === "youtube" ? "youtube" : "google";
          plan.push({ action: "search_web", query: data.query, provider });
        }
        break;

      case "ui_action":
        if (["click", "scroll_down", "scroll_up"].includes(data.sub_action)) {
          plan.push({ action: "ui_action", sub_action: data.sub_action });
        }
        break;

      case "tab_control":
        if (["new_tab", "switch_tab", "close_tab"].includes(data.sub_action)) {
          plan.push({ action: "tab_control", sub_action: data.sub_action });
        }
        break;

      case "file_action":
        if (["extract", "zip"].includes(data.sub_action) && data.target) {
          plan.push({ action: "file_action", sub_action: data.sub_action, target: data.target });
        }
        break;

      case "set_volume":
        if (typeof data.target === "number") {
          plan.push({ action: "set_volume", target: data.target });
        }
        break;

      default:
        // "chat" intent or unknown intent results in empty plan (no system action)
        break;
    }

    return plan;
  },

  findScannedApp(name) {
    for (const [appName, appPath] of Object.entries(scannedApps)) {
      if (appName.toLowerCase().includes(name)) {
        return { name: appName, cmd: `"${appPath}"` };
      }
    }
    return null;
  },

  fallbackMatcher(text) {
    const input = text.toLowerCase().trim();
    if (input.includes("open chrome")) {
      return {
        plan: [{ action: "open_app", target: "chrome", cmd: ALLOWED_APPS.chrome }],
        response: "Opening Chrome for you, sir.",
        confidence: 0.9
      };
    }
    return { plan: [], response: "I'm processing that information now, sir.", confidence: 0.5 };
  }
};

