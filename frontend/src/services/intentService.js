import { geminiService } from './geminiService';
import { backgroundService } from './BackgroundService';

const APP_MAP = {
  "youtube": "start https://youtube.com",
  "whatsapp": "start https://web.whatsapp.com",
  "edge": "start msedge",
  "vs code": "code",
  "vscode": "code",
  "settings": "start ms-settings:",
  "chrome": "start chrome",
  "calculator": "calc",
  "notepad": "notepad",
  "spotify": "start spotify",
  "yt": "start https://youtube.com",
  "github": "start https://github.com",
  "explorer": "explorer",
  "documents": "explorer shell:Personal",
  "downloads": "explorer shell:Downloads"
};

let scannedApps = {};

// Environment Detection
const isElectron = !!(window.electron && window.electron.exec);

/**
 * FRIDAY Intent Service (AI-Driven Version)
 * Uses Gemini as the primary brain, with a fallback pattern matcher.
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
        console.log('FRIDAY: System apps scanned:', Object.keys(scannedApps).length);
      } catch (e) {
        console.error('FRIDAY: Failed to scan system apps:', e);
      }
    }
  },

  /**
   * Generates a plan by consulting the Gemini Brain.
   */
  async generatePlan(text) {
    const currentState = backgroundService.getState();
    const context = {
      activeApp: currentState.activeApp,
      idleTime: currentState.idleTime
    };

    try {
      // 1. Ask Gemini for intent and natural response
      const geminiResult = await geminiService.ask(text, context);
      
      if (geminiResult && geminiResult.plan) {
        return {
          plan: geminiResult.plan,
          response: geminiResult.response,
          confidence: 0.9,
          thought: geminiResult.thought
        };
      }
    } catch (e) {
      console.error("Gemini Brain failure, falling back to local patterns:", e);
    }

    // 2. Local Fallback Pattern Matcher (Safety Net)
    return this.fallbackMatcher(text);
  },

  fallbackMatcher(text) {
    const input = text.toLowerCase().trim();
    const result = {
      plan: [],
      confidence: 0,
      response: "I'll handle that for you, sir.",
      thought: "Using local pattern matching fallback."
    };

    // Simple pattern matching for core commands
    if (input.includes('open') || input.includes('launch')) {
      const appName = input.replace(/(open|launch)/, '').trim();
      if (appName) {
        result.plan = [{ action: "open_app", target: appName }];
        result.confidence = 0.8;
        result.response = `Opening ${appName} for you, sir.`;
      }
    } else if (input.includes('search')) {
      const query = input.replace('search', '').trim();
      if (query) {
        result.plan = [{ action: "search_web", query: query, provider: "google" }];
        result.confidence = 0.8;
        result.response = `Searching for ${query} on Google, sir.`;
      }
    }

    return result;
  },

  findBestApp(target) {
    const name = target.toLowerCase().trim();
    
    // 1. Static Map
    if (APP_MAP[name]) return { name: target, cmd: APP_MAP[name], type: 'map' };

    // 2. Scanned Apps
    for (const [appName, appPath] of Object.entries(scannedApps)) {
      if (appName.toLowerCase().includes(name)) {
        return { name: appName, cmd: `"${appPath}"`, type: 'scanned' };
      }
    }
    return null;
  }
};
