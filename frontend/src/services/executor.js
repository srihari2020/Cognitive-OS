/**
 * executor.js (Autonomous Workflow Version)
 * 
 * Handles step-by-step execution of multi-step plans via Electron bridge.
 */

import { intentService } from './intentService';

// Environment Detection
const isElectron = !!(window.electron && window.electron.exec);

if (!isElectron) {
  console.warn("FRIDAY: Running in browser mode — OS execution disabled, sir.");
}

// GLOBAL EXECUTION LOCK (MOST IMPORTANT)
let USER_TRIGGER = false;

/**
 * Explicitly unlocks the next execution.
 * MUST be called from a user-initiated event handler.
 */
export function allowExecution() {
  USER_TRIGGER = true;
  console.log("🔒 Execution UNLOCKED by user trigger.");
}

// Execution throttling to prevent duplicate triggers
let isExecuting = false;

/**
 * Runs a multi-step workflow plan autonomously.
 */
export const runWorkflow = async (plan, onStepStart) => {
  if (!isElectron) {
    return { success: false, error: "System bridge unavailable. Please run in Electron, sir." };
  }

  // GLOBAL LOCK CHECK
  if (!USER_TRIGGER) {
    console.warn("🚫 BLOCKED execution attempt without user trigger.");
    return { success: false, error: "Unauthorized execution path blocked." };
  }

  // Throttle: prevent duplicate execution
  if (isExecuting) {
    console.log("Execution already in progress, skipping duplicate request");
    return { success: false, error: "Already executing a command" };
  }

  // Consume the trigger
  USER_TRIGGER = false;
  isExecuting = true;

  try {
    const results = [];
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      if (onStepStart) onStepStart(i + 1, plan.length, step);
      
      try {
        const result = await executeStep(step);
        results.push(result);
        
        if (result.status === "failed") {
          return { success: false, error: result.message, results };
        }
        
        // Longer delay for multi-step commands (e.g., open app then search)
        const delay = plan.length > 1 && step.action === "open_app" ? 2000 : 800;
        await new Promise(r => setTimeout(r, delay));
      } catch (e) {
        console.error(`FRIDAY: Step ${i + 1} failed:`, e);
        return { success: false, error: e.message, results };
      }
    }
    return { success: true, results };
  } finally {
    // Release lock after 1.5s to prevent rapid re-execution
    setTimeout(() => {
      isExecuting = false;
    }, 1500);
  }
};

/**
 * Executes a single action step via window.electron.exec or bridge.
 */
async function executeStep(step) {
  const electron = window.electron;
  const bridge = window.electronAssistant;

  if (!electron || !electron.exec) {
    return { status: "failed", message: "System bridge unavailable, sir." };
  }

  switch (step.action) {
    case "open_app": {
      // Use pre-validated cmd from intentService (already has correct routing)
      if (step.cmd) {
        console.log("Executing app command:", step.cmd);
        const result = await electron.exec(step.cmd);
        if (result && !result.ok) {
          console.error("App execution failed:", result.error);
          return { status: "failed", message: `Failed to open ${step.target}: ${result.error}` };
        }
        return { status: "success", message: `Opening ${step.target}, sir.` };
      }
      return { status: "failed", message: `I couldn't locate ${step.target} locally, sir.` };
    }

    case "open_folder": {
      const res = await bridge.openPath(step.target);
      if (!res.ok) return { status: "failed", message: `I couldn't open ${step.target}, sir.` };
      return { status: "success", message: `Opened folder: ${step.target}.` };
    }

    case "set_volume": {
      const res = await bridge.setVolume(step.target);
      if (!res.ok) return { status: "failed", message: `Failed to set volume, sir.` };
      return { status: "success", message: `Volume set to ${step.target}%.` };
    }

    case "ui_action": {
      const res = await bridge.uiAction({ action: step.sub_action, target: step.target, x: step.x, y: step.y });
      if (!res.ok) return { status: "failed", message: res.error };
      return { status: "success", message: res.message };
    }

    case "tab_control": {
      const res = await bridge.tabControl({ action: step.sub_action });
      if (!res.ok) return { status: "failed", message: res.error };
      return { status: "success", message: res.message };
    }

    case "file_action": {
      const res = await bridge.fileAction({ action: step.sub_action, target: step.target });
      if (!res.ok) return { status: "failed", message: res.error };
      return { status: "success", message: res.message };
    }

    case "search_web": {
      // Safety Rule: Use encodeURIComponent for query parameters
      const baseUrl = step.provider === "youtube" 
        ? "https://www.youtube.com/results?search_query="
        : "https://www.google.com/search?q=";
      const url = `${baseUrl}${encodeURIComponent(step.query)}`;
      electron.exec(`start ${url}`);
      return { status: "success", message: `Searching for ${step.query}, sir.` };
    }

    case "chat": {
      return { status: "success", message: step.message };
    }

    default:
      return { status: "failed", message: `Unknown action: ${step.action}` };
  }
}
