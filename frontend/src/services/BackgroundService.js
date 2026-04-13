/**
 * BackgroundService.js
 * 
 * Always-on background loop for FRIDAY (GOD MODE).
 * Tracks context, activity, and triggers proactive suggestions.
 */

import { proactiveEngine } from './proactiveEngine';
import { commandService } from './api';
import { memoryStore } from './memoryStore';

class BackgroundService {
  constructor() {
    this.interval = null;
    this.LOOP_INTERVAL_MS = 12000; // 12 seconds
    this.lastActivityTime = Date.now();
    this.isActive = false;
    this.onProactiveSuggestion = null;
    this.onWakeWordTriggered = null;

    this.state = {
      lastActions: [],
      time: new Date(),
      activeApp: 'unknown',
      idleTime: 0
    };
  }

  start(callbacks = {}) {
    if (this.isActive) return;
    this.isActive = true;
    this.onProactiveSuggestion = callbacks.onProactiveSuggestion;
    this.onWakeWordTriggered = callbacks.onWakeWordTriggered;

    // Track activity (mouse, keyboard)
    window.addEventListener('mousemove', () => this.recordActivity());
    window.addEventListener('keydown', () => this.recordActivity());

    this.interval = setInterval(() => this.tick(), this.LOOP_INTERVAL_MS);
    console.log('FRIDAY: Background Service (GOD MODE) started.');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isActive = false;
    window.removeEventListener('mousemove', () => this.recordActivity());
    window.removeEventListener('keydown', () => this.recordActivity());
  }

  recordActivity() {
    this.lastActivityTime = Date.now();
  }

  async tick() {
    const now = Date.now();
    this.state.time = new Date();
    this.state.idleTime = now - this.lastActivityTime;

    // 1. Check Wake Word ("Arise")
    const wakeData = await commandService.consumeWakeWord();
    if (wakeData && wakeData.triggered) {
      if (this.onWakeWordTriggered) {
        this.onWakeWordTriggered();
      }
    }

    // 2. Evaluate Proactive Engine
    const suggestion = proactiveEngine.evaluate(this.state);
    if (suggestion && this.onProactiveSuggestion) {
      this.onProactiveSuggestion(suggestion);
    }

    // 3. Track Active App (If in Electron)
    if (window.electronAssistant && window.electronAssistant.getActiveApp) {
      try {
        const activeApp = await window.electronAssistant.getActiveApp();
        this.state.activeApp = activeApp || 'unknown';
      } catch (e) {
        // Fallback or ignore
      }
    }
  }

  getState() {
    return this.state;
  }
}

export const backgroundService = new BackgroundService();
