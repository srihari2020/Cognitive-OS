/**
 * contextStore.js
 * 
 * Lightweight memory store for tracking recent user actions, allowing the system
 * to become proactive and predict next steps based on recent history and idle time.
 */

const MAX_HISTORY = 10;

class ContextStore {
  constructor() {
    this.history = [];
    this.lastActiveTimestamp = Date.now();
    this.frequencyMap = {};
    this.activeApp = "Cognitive OS"; // Default
  }

  recordAction(actionType, rawInput, metadata = {}) {
    this.lastActiveTimestamp = Date.now();
    const now = new Date();
    
    const action = {
      id: crypto.randomUUID(),
      timestamp: now.getTime(),
      timeOfDay: now.getHours() + ":" + now.getMinutes(),
      type: actionType, // e.g., 'command', 'search'
      raw: rawInput,
      ...metadata
    };

    this.history.unshift(action);

    // Track frequency
    const key = rawInput.toLowerCase().trim();
    this.frequencyMap[key] = (this.frequencyMap[key] || 0) + 1;

    if (this.history.length > MAX_HISTORY) {
      this.history.pop();
    }
  }

  getHistory() {
    return [...this.history];
  }

  getFrequencyMap() {
    return { ...this.frequencyMap };
  }

  getIdleTimeMs() {
    return Date.now() - this.lastActiveTimestamp;
  }

  setActiveApp(appName) {
    this.activeApp = appName;
  }

  getActiveApp() {
    return this.activeApp;
  }
  
  clear() {
    this.history = [];
    this.lastActiveTimestamp = Date.now();
    this.frequencyMap = {};
  }
}

export const contextStore = new ContextStore();
