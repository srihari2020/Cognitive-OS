import { memoryStore } from './memoryStore';

const APP_MAP = {
  "youtube": "https://youtube.com",
  "whatsapp": "https://web.whatsapp.com",
  "edge": "start msedge",
  "vs code": "code",
  "vscode": "code",
  "settings": "start ms-settings:",
  "chrome": "start chrome",
  "calculator": "calc",
  "notepad": "notepad",
  "spotify": "start spotify",
  "yt": "https://youtube.com",
  "github": "https://github.com"
};

let scannedApps = {};

/**
 * FRIDAY Intent Service (Autonomous Workflow Version)
 * Generates multi-step plans for complex tasks.
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
   * AI Planning Step: Converts user input into a multi-step workflow plan.
   */
  generatePlan(input) {
    const text = (input || '').trim().toLowerCase();
    if (!text) return null;

    // Default response structure
    const result = {
      plan: [],
      response: "I'm planning that workflow for you now, sir.",
      confidence: 0
    };

    // 1. Memory-based reuse
    if (text === 'send it again' || text === 'do it again' || text === 'repeat last') {
      const lastAction = memoryStore.getLastInteraction();
      if (lastAction && lastAction.plan) {
        return { 
          plan: lastAction.plan, 
          response: "Repeating the last workflow for you, sir.",
          confidence: 1.0 
        };
      }
    }

    // 2. Complex Scenario: Coding Setup
    if (text.includes('coding setup') || text.includes('setup for work')) {
      result.plan = [
        { action: "open_app", target: "vscode" },
        { action: "open_app", target: "chrome" },
        { action: "open_app", target: "github" }
      ];
      result.response = "Initializing your coding environment now, sir.";
      result.confidence = 0.98;
      return result;
    }

    // 3. Complex Scenario: Messaging
    const messageMatch = text.match(/^(?:send\s+message|text|message)\s+(?:to\s+)?([\w\s]+?)\s+(?:saying|that)\s+(.+)/i);
    if (messageMatch) {
      const person = messageMatch[1].trim();
      const msg = messageMatch[2].trim();
      result.plan = [
        { action: "open_app", target: "whatsapp" },
        { action: "find_contact", target: person },
        { action: "send_message", message: msg, person: person }
      ];
      result.response = `Preparing to send that message to ${person}, sir.`;
      result.confidence = 0.95;
      return result;
    }

    // 4. Complex Scenario: Search and Play (YouTube)
    const playMatch = text.match(/^(?:search|find|play)\s+(.+?)\s+(?:on\s+youtube|and\s+play\s+it)/i);
    if (playMatch) {
      const query = playMatch[1].trim();
      result.plan = [
        { action: "open_app", target: "youtube" },
        { action: "search_web", query: query, provider: "youtube" },
        { action: "click_element", target: "first_result" }
      ];
      result.response = `Searching for "${query}" on YouTube and playing the first result, sir.`;
      result.confidence = 0.92;
      return result;
    }

    // 5. Single Step Fallbacks
    const openMatch = text.match(/^(?:open|launch|start)\s+(.+)/i);
    if (openMatch) {
      result.plan = [{ action: "open_app", target: openMatch[1].trim() }];
      result.response = `Opening ${openMatch[1].trim()} for you, sir.`;
      result.confidence = 0.95;
      return result;
    }

    const searchMatch = text.match(/^(?:search|google|find)\s+(.+)/i);
    if (searchMatch) {
      result.plan = [{ action: "search_web", query: searchMatch[1].trim() }];
      result.response = `Searching for "${searchMatch[1].trim()}" now, sir.`;
      result.confidence = 0.9;
      return result;
    }

    // Default Chat
    result.plan = [{ action: "chat", query: text }];
    result.response = "I'm processing that information now, sir.";
    result.confidence = 0.5;
    return result;
  },

  /**
   * Internal Matcher for App Resolution
   */
  findBestApp(target) {
    const normalized = target.toLowerCase();
    
    // 1. Static Map
    let bestMatch = null;
    let highestScore = 0;
    for (const key of Object.keys(APP_MAP)) {
      const score = getSimilarity(normalized, key);
      if (score > 0.8 && score > highestScore) {
        highestScore = score;
        bestMatch = key;
      }
    }
    if (bestMatch) return { type: 'map', cmd: APP_MAP[bestMatch], name: bestMatch };

    // 2. Scanned Apps
    bestMatch = null;
    highestScore = 0;
    for (const name of Object.keys(scannedApps)) {
      const score = getSimilarity(normalized, name);
      if (score > 0.7 && score > highestScore) {
        highestScore = score;
        bestMatch = name;
      }
    }
    if (bestMatch) return { type: 'scanned', cmd: scannedApps[bestMatch], name: bestMatch };

    return null;
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
