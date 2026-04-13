/**
 * memoryStore.js
 * 
 * Lightweight memory store for FRIDAY behavior.
 * Remembers last 20 interactions.
 */

class MemoryStore {
  constructor() {
    this.interactions = []; // [{ command, intent, result, timestamp }]
    this.LIMIT = 20;
  }

  /**
   * Saves an interaction to memory.
   */
  saveInteraction(command, intent, result) {
    const interaction = {
      command,
      intent,
      result,
      timestamp: Date.now()
    };

    this.interactions.push(interaction);
    if (this.interactions.length > this.LIMIT) {
      this.interactions.shift();
    }
  }

  /**
   * Returns the last interaction.
   */
  getLastInteraction() {
    return this.interactions[this.interactions.length - 1] || null;
  }

  /**
   * Returns recent interactions for context.
   */
  getRecent(n = 5) {
    return this.interactions.slice(-n);
  }

  /**
   * Clears memory.
   */
  clear() {
    this.interactions = [];
  }
}

export const memoryStore = new MemoryStore();
