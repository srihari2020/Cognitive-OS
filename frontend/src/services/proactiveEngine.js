/**
 * proactiveEngine.js
 * 
 * The proactive core of FRIDAY.
 * Predicts user actions based on habits, time of day, and system state.
 */

import { memoryStore } from './memoryStore';
import { intentService } from './intentService';

class ProactiveEngine {
  constructor() {
    this.lastTriggeredTime = 0;
    this.THROTTLE_MS = 5 * 60 * 1000; // Reduced to 5 minutes for proactive suggestions
    this.CONFIDENCE_THRESHOLD = 0.8;
    this.AUTO_ACTION_THRESHOLD = 0.9; // Confidence for automatic execution
  }

  /**
   * Evaluates system state and habits to generate a proactive suggestion.
   */
  evaluate(currentState) {
    const now = new Date();
    const currentHour = now.getHours();
    const habits = memoryStore.getHabits();
    const workflows = memoryStore.getWorkflows();

    // 1. Throttle check
    if (Date.now() - this.lastTriggeredTime < this.THROTTLE_MS) return null;

    // 2. Multi-step Workflow Prediction
    for (const [name, workflow] of Object.entries(workflows)) {
      if (workflow.count >= 3) {
        const frequency = this.calculateTimeFrequency(workflow.timestamps, currentHour);
        if (frequency > this.CONFIDENCE_THRESHOLD) {
          this.lastTriggeredTime = Date.now();
          return {
            type: 'workflow',
            name: name,
            command: name, // Using workflow name as command for triggering
            confidence: frequency,
            autoAction: frequency > this.AUTO_ACTION_THRESHOLD,
            response: `It seems you're starting your "${name}" workflow, sir. Shall I set it up for you?`
          };
        }
      }
    }

    // 3. Time-based Habit Prediction (GOD MODE)
    for (const [cmd, data] of Object.entries(habits)) {
      if (data.count < 3) continue; // Minimum interactions to be a habit

      const frequencyAtCurrentTime = this.calculateTimeFrequency(data.timestamps, currentHour);
      
      if (frequencyAtCurrentTime > this.CONFIDENCE_THRESHOLD) {
        this.lastTriggeredTime = Date.now();
        return {
          type: 'habit',
          command: cmd,
          confidence: frequencyAtCurrentTime,
          autoAction: frequencyAtCurrentTime > this.AUTO_ACTION_THRESHOLD,
          response: `You usually run "${cmd}" around this time, sir. Shall I initialize it for you?`
        };
      }
    }

    // 4. Idle Intelligence
    if (currentState.idleTime > 30000) { // 30s idle (User request)
      const last = memoryStore.getLastInteraction();
      if (last && Date.now() - last.timestamp < 15 * 60000) { // Last action was within 15 mins
        this.lastTriggeredTime = Date.now();
        return {
          type: 'resume',
          command: last.command,
          response: `Would you like me to continue where you left off with ${last.command}, sir?`
        };
      }
    }

    return null;
  }

  /**
   * Calculates how frequently a command occurs at a specific hour.
   */
  calculateTimeFrequency(timestamps, targetHour) {
    if (!timestamps || timestamps.length === 0) return 0;
    
    const matches = timestamps.filter(ts => {
      const date = new Date(ts);
      return Math.abs(date.getHours() - targetHour) <= 1; // +/- 1 hour window
    });

    return matches.length / timestamps.length;
  }

  /**
   * Converts a suggestion into a plan using intentService.
   */
  getPlanForSuggestion(suggestion) {
    return intentService.generatePlan(suggestion.command);
  }
}

export const proactiveEngine = new ProactiveEngine();
