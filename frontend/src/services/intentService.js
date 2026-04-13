import { memoryStore } from './memoryStore';

const APP_MAP = {
  "youtube": "https://youtube.com",
  "whatsapp": "whatsapp://",
  "edge": "start msedge",
  "vs code": "code",
  "vscode": "code",
  "settings": "start ms-settings:",
  "chrome": "start chrome",
  "calculator": "calc",
  "notepad": "notepad",
  "spotify": "start spotify",
  "yt": "https://youtube.com"
};

let scannedApps = {};

/**
 * FRIDAY Intent Service
 * Responsible for understanding intent, resolving apps, and returning structured JSON actions.
 */
export const intentService = {
  async init() {
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
   * Step 1 & 2: Understand intent and extract entities.
   * Returns structured intent object.
   */
  detectIntent(input) {
    const text = (input || '').trim().toLowerCase();
    if (!text) return null;

    const result = {
      intent: "unknown",
      target: null,
      query: null,
      message: null,
      person: null,
      confidence: 0,
      response: "I'm not quite sure how to handle that request yet, sir."
    };

    // Memory-based continuation
    if (text === 'open it' || text === 'launch it' || text === 'do it') {
      const lastAction = memoryStore.getLastInteraction();
      if (lastAction && lastAction.intent) {
        return { ...lastAction.intent, response: `Executing that for you now, sir.` };
      }
    }

    // Intent: open_app
    const openMatch = text.match(/^(?:open|launch|start|run|go to)\s+(.+)/i);
    if (openMatch) {
      result.intent = "open_app";
      result.target = openMatch[1].trim();
      result.confidence = 0.95;
      result.response = `Opening ${result.target} for you, sir.`;
      return result;
    }

    // Intent: search_web
    const searchMatch = text.match(/^(?:search|google|search\s+for|look\s+up|find)\s+(.+)/i);
    if (searchMatch) {
      result.intent = "search_web";
      result.query = searchMatch[1].trim();
      result.confidence = 0.9;
      result.response = `Searching for "${result.query}" now, sir.`;
      return result;
    }

    // Intent: send_message
    const messageMatch = text.match(/^(?:send\s+message|text|message)\s+(?:to\s+)?([\w\s]+?)\s+(?:saying|that)\s+(.+)/i);
    if (messageMatch) {
      result.intent = "send_message";
      result.person = messageMatch[1].trim();
      result.message = messageMatch[2].trim();
      result.confidence = 0.85;
      result.response = `Sending that message to ${result.person} for you, sir.`;
      return result;
    }

    // Intent: system_action
    const systemActions = {
      "settings": "settings",
      "control panel": "settings",
      "shutdown": "shutdown",
      "restart": "restart",
      "sleep": "sleep"
    };
    if (systemActions[text]) {
      result.intent = "system_action";
      result.target = systemActions[text];
      result.confidence = 1.0;
      result.response = `Executing system ${result.target} now, sir.`;
      return result;
    }

    // Fallback: Chat/Unknown
    result.intent = "chat";
    result.query = text;
    result.confidence = 0.5;
    result.response = "I'm processing that information now, sir.";
    return result;
  },

  /**
   * Step 3 & 4: Decide action and execute.
   * Returns final structured JSON result.
   */
  async handleIntent(intent) {
    const bridge = window.electronAssistant;
    if (!bridge) throw new Error('FRIDAY: System bridge unavailable');

    const lastInteraction = memoryStore.getLastInteraction();
    const currentInput = intent.query || intent.target || "";

    // Memory check: Avoid repeating failures
    if (lastInteraction && lastInteraction.command === currentInput && lastInteraction.result?.status === "failed") {
      intent.response = `I still cannot locate ${intent.target} locally, sir. Should I search for it online instead?`;
      return { status: "failed", intent };
    }

    let actionResult = { success: false, status: "pending" };

    switch (intent.intent) {
      case 'open_app': {
        const target = intent.target.toLowerCase();
        
        // 1. Check static map with fuzzy matching
        let bestStaticMatch = this.findBestMatch(target, Object.keys(APP_MAP), 0.8);
        if (bestStaticMatch) {
          const cmd = APP_MAP[bestStaticMatch];
          if (cmd.startsWith('http')) {
            await bridge.openExternal(cmd);
            actionResult = { success: true, status: "completed" };
          } else {
            const res = await bridge.executeCommand(cmd);
            actionResult = { success: res.success, status: res.success ? "completed" : "failed" };
          }
          if (actionResult.success) {
            intent.response = `Opening ${bestStaticMatch} now, sir.`;
            return { ...actionResult, intent };
          }
        }

        // 2. Check scanned apps with fuzzy matching
        let bestScannedMatch = this.findBestMatch(target, Object.keys(scannedApps), 0.7);
        if (bestScannedMatch) {
          const path = scannedApps[bestScannedMatch];
          const res = await bridge.executeCommand(`start "" "${path}"`);
          actionResult = { success: res.success, status: res.success ? "completed" : "failed" };
          if (actionResult.success) {
            intent.response = `Launching ${bestScannedMatch} for you, sir.`;
            return { ...actionResult, intent };
          }
        }

        // 3. Fallback: Search online if not found
        intent.response = `I couldn't locate "${intent.target}" locally, sir. Would you like me to search for it online?`;
        return { success: false, status: "failed", intent };
      }

      case 'search_web': {
        const q = encodeURIComponent(intent.query);
        await bridge.openExternal(`https://google.com/search?q=${q}`);
        intent.response = `Searching for "${intent.query}" now, sir.`;
        return { success: true, status: "completed", intent };
      }

      case 'system_action': {
        if (intent.target === "settings") {
          await bridge.executeCommand("start ms-settings:");
          return { success: true, status: "completed", intent };
        }
        intent.response = `I'm sorry sir, I don't have permission for system ${intent.target} yet.`;
        return { success: false, status: "failed", intent };
      }

      default:
        return { success: false, status: "unknown", intent };
    }
  },

  findBestMatch(target, list, threshold) {
    let bestMatch = null;
    let highestScore = 0;
    for (const item of list) {
      const score = getSimilarity(target, item);
      if (score > threshold && score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    }
    return bestMatch;
  }
};

// Fuzzy Matching Helpers (Levenshtein)
function getSimilarity(s1, s2) {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}
