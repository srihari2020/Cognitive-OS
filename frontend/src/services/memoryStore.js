/**
 * memoryStore.js
 * 
 * Enhanced memory store for FRIDAY.
 * Handles interaction history, habit learning, and frequency tracking.
 */

class MemoryStore {
  constructor() {
    this.interactions = this.loadFromLocal('friday_interactions') || [];
    this.habits = this.loadFromLocal('friday_habits') || {}; // { "command": { count: 0, timestamps: [] } }
    this.workflows = this.loadFromLocal('friday_workflows') || {}; // { "name": { count: 0, steps: [], timestamps: [] } }
    this.LIMIT = 50;
  }

  saveInteraction(command, plan, result) {
    const interaction = {
      command,
      plan,
      result,
      timestamp: Date.now()
    };

    this.interactions.push(interaction);
    if (this.interactions.length > this.LIMIT) this.interactions.shift();
    
    this.updateHabits(command);
    
    // Check if this interaction was part of a multi-step plan
    if (plan && plan.length > 1) {
      this.updateWorkflow(command, plan);
    }
    
    this.saveToLocal('friday_interactions', this.interactions);
  }

  updateHabits(command) {
    if (!command || typeof command !== 'string') return;
    const cmd = command.toLowerCase().trim();
    if (!this.habits[cmd]) {
      this.habits[cmd] = { count: 0, timestamps: [] };
    }
    this.habits[cmd].count++;
    this.habits[cmd].timestamps.push(Date.now());
    
    // Keep only last 20 timestamps for frequency analysis
    if (this.habits[cmd].timestamps.length > 20) this.habits[cmd].timestamps.shift();
    
    this.saveToLocal('friday_habits', this.habits);
  }

  updateWorkflow(name, steps) {
    if (!name || !steps) return;
    const key = name.toLowerCase().trim();
    if (!this.workflows[key]) {
      this.workflows[key] = { count: 0, steps: steps, timestamps: [] };
    }
    this.workflows[key].count++;
    this.workflows[key].timestamps.push(Date.now());

    if (this.workflows[key].timestamps.length > 20) this.workflows[key].timestamps.shift();

    this.saveToLocal('friday_workflows', this.workflows);
  }

  getLastInteraction() {
    return this.interactions[this.interactions.length - 1] || null;
  }

  getHabits() {
    return this.habits;
  }

  getWorkflows() {
    return this.workflows;
  }

  saveToLocal(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('FRIDAY: LocalStorage save error:', e);
    }
  }

  loadFromLocal(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }
}

export const memoryStore = new MemoryStore();
