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

/**
 * Runs a multi-step workflow plan autonomously.
 */
export const runWorkflow = async (plan, onStepStart) => {
  if (!isElectron) {
    return { success: false, error: "System bridge unavailable. Please run in Electron, sir." };
  }

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
      
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(`FRIDAY: Step ${i + 1} failed:`, e);
      return { success: false, error: e.message, results };
    }
  }
  return { success: true, results };
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
      // Safety Rule: Only use pre-validated cmd from intentService
      if (step.cmd) {
        electron.exec(step.cmd);
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
      return { status: "success", message: "Processing information." };
    }

    default:
      return { status: "failed", message: `Unknown action: ${step.action}` };
  }
}
