/**
 * memoryStore.js
 * 
 * Lightweight memory store for context awareness.
 * Remembers recent messages and actions (last 6).
 */

class MemoryStore {
  constructor() {
    this.history = [];   // [{ role: 'user' | 'assistant', text: string }]
    this.actions = [];   // [string] - last inputs that triggered an action
    this.LIMIT = 6;
  }

  /**
   * Saves a message to history.
   */
  saveMessage(role, text) {
    this.history.push({ role, text });
    if (this.history.length > this.LIMIT) {
      this.history.shift();
    }
  }

  /**
   * Saves an action (input) to actions history.
   * Filters out continuation commands to avoid recursion.
   */
  saveAction(input) {
    const text = (input || '').trim().toLowerCase();
    if (text === 'open it' || text === 'launch it') return;

    this.actions.push(input);
    if (this.actions.length > this.LIMIT) {
      this.actions.shift();
    }
  }

  /**
   * Returns the last N history items.
   */
  getRecentHistory(n = 4) {
    return this.history.slice(-n);
  }

  /**
   * Returns the last action taken.
   */
  getLastAction() {
    return this.actions[this.actions.length - 1] || null;
  }

  /**
   * Clears history and actions.
   */
  clear() {
    this.history = [];
    this.actions = [];
  }
}

export const memoryStore = new MemoryStore();
