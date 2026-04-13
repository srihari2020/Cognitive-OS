/**
 * executor.js (Autonomous Workflow Version)
 * 
 * Handles step-by-step execution of multi-step plans.
 */

import { intentService } from './intentService';

/**
 * Runs a multi-step workflow plan autonomously.
 */
export const runWorkflow = async (plan, onStepStart) => {
  const results = [];
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    if (onStepStart) onStepStart(i + 1, plan.length, step);
    
    try {
      const result = await executeStep(step);
      results.push(result);
      
      // If a critical step fails, we stop the workflow
      if (result.status === "failed") {
        return { success: false, error: result.message, results };
      }
      
      // Small delay between steps for visual feedback and system stability
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(`FRIDAY: Step ${i + 1} failed:`, e);
      return { success: false, error: e.message, results };
    }
  }
  return { success: true, results };
};

/**
 * Executes a single action step.
 */
async function executeStep(step) {
  const bridge = window.electronAssistant;
  if (!bridge) throw new Error("System bridge unavailable, sir.");

  switch (step.action) {
    case "open_app": {
      const app = intentService.findBestApp(step.target);
      if (!app) return { status: "failed", message: `I couldn't locate ${step.target} locally, sir.` };
      
      if (app.type === 'map' && app.cmd.startsWith('http')) {
        await bridge.openExternal(app.cmd);
      } else {
        const res = await bridge.executeCommand(app.cmd);
        if (!res.success) return { status: "failed", message: `Failed to launch ${app.name}, sir.` };
      }
      return { status: "success", message: `Launched ${app.name}.` };
    }

    case "search_web": {
      const url = step.provider === "youtube" 
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(step.query)}`
        : `https://www.google.com/search?q=${encodeURIComponent(step.query)}`;
      await bridge.openExternal(url);
      return { status: "success", message: `Searched for ${step.query}.` };
    }

    case "find_contact": {
      // Placeholder for Puppeteer/Automation logic
      // For now, we simulate finding the contact in the opened app
      return { status: "success", message: `Located contact: ${step.target}.` };
    }

    case "send_message": {
      // Placeholder for Puppeteer/Automation logic
      return { status: "success", message: `Message prepared for ${step.person}.` };
    }

    case "click_element": {
      // Placeholder for DOM automation logic
      return { status: "success", message: `Clicked element: ${step.target}.` };
    }

    case "chat": {
      return { status: "success", message: "Processing information." };
    }

    default:
      return { status: "failed", message: `Unknown action: ${step.action}` };
  }
}
