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
  "spotify": "start spotify"
};

let scannedApps = {};

// Basic Levenshtein Distance for fuzzy matching
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

export const intentService = {
  async init() {
    const bridge = window.electronAssistant;
    if (bridge && bridge.scanApps) {
      try {
        scannedApps = await bridge.scanApps();
        console.log('Apps scanned:', Object.keys(scannedApps).length);
      } catch (e) {
        console.error('Failed to scan apps:', e);
      }
    }
  },

  detectIntent(input) {
    const text = (input || '').trim().toLowerCase();
    if (!text) return null;

    // Memory-based continuation
    if (text === 'open it' || text === 'launch it') {
      const lastAction = memoryStore.getLastInteraction();
      if (lastAction && lastAction.intent) {
        return lastAction.intent;
      }
    }

    // Intent: Open App / URL
    const openMatch = text.match(/^(?:open|launch|start)\s+(.+)/i);
    if (openMatch) {
      const target = openMatch[1].trim();
      return { type: 'open_app', target, query: text };
    }

    // Intent: Web Search
    const searchMatch = text.match(/^(?:search|google|search\s+for|look\s+up)\s+(.+)/i);
    if (searchMatch) {
      return { type: 'web_search', query: searchMatch[1].trim(), rawQuery: text };
    }

    // Intent: Message
    const messageMatch = text.match(/^(?:send\s+message|text|message)\s+(?:to\s+)?(.+)/i);
    if (messageMatch) {
      return { type: 'send_message', target: messageMatch[1].trim() };
    }

    return { type: 'chat', query: text };
  },

  async handleIntent(intent) {
    const bridge = window.electronAssistant;
    if (!bridge) throw new Error('Bridge unavailable');

    // Memory check: Avoid repeating failures
    const lastInteraction = memoryStore.getLastInteraction();
    const currentRaw = intent.query || intent.rawQuery || intent.query;
    if (lastInteraction && lastInteraction.command === currentRaw && lastInteraction.result.includes("couldn't locate")) {
      return "I still can't find that application. Should I look it up on Google instead?";
    }

    switch (intent.type) {
      case 'open_app': {
        const target = intent.target.toLowerCase();
        
        // 1. Check static map with fuzzy matching
        let bestStaticMatch = null;
        let highestStaticScore = 0;
        for (const key of Object.keys(APP_MAP)) {
          const score = getSimilarity(target, key);
          if (score > 0.8 && score > highestStaticScore) {
            highestStaticScore = score;
            bestStaticMatch = key;
          }
        }

        if (bestStaticMatch) {
          const cmd = APP_MAP[bestStaticMatch];
          if (cmd.startsWith('http')) {
            await bridge.openExternal(cmd);
            return `Opening ${bestStaticMatch} in your browser.`;
          } else {
            const result = await bridge.executeCommand(cmd);
            if (result.success) return `Opening ${bestStaticMatch} now.`;
          }
        }

        // 2. Check scanned apps with fuzzy matching
        let bestScannedMatch = null;
        let highestScannedScore = 0;
        for (const name of Object.keys(scannedApps)) {
          const score = getSimilarity(target, name);
          if (score > 0.7 && score > highestScannedScore) {
            highestScannedScore = score;
            bestScannedMatch = name;
          }
        }

        if (bestScannedMatch) {
          const path = scannedApps[bestScannedMatch];
          const result = await bridge.executeCommand(`start "" "${path}"`);
          if (result.success) return `Launching ${bestScannedMatch}.`;
        }

        // 3. Fallback to direct execution (for installed apps in PATH)
        const result = await bridge.executeCommand(target);
        if (result.success) return `Launching ${intent.target}.`;

        // 4. Final error handling
        return `I couldn't locate that application. Would you like me to search for it online?`;
      }

      case 'web_search': {
        const q = encodeURIComponent(intent.query);
        await bridge.openExternal(`https://google.com/search?q=${q}`);
        return `Searching for ${intent.query}.`;
      }

      case 'open_url': {
        await bridge.openExternal(intent.target);
        return "On it.";
      }

      case 'send_message': {
        return `Preparing message for ${intent.target}. Which platform should I use?`;
      }

      case 'chat': {
        return "I'm processing that information now.";
      }

      default:
        return "I'm not sure how to handle that request yet.";
    }
  }
};
