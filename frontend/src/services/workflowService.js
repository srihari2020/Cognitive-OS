/**
 * workflowService.js
 * 
 * Handles sequential execution of multi-step plans.
 * Supports: open_app, open_url, open_folder, set_volume, search_google.
 * 
 * Architecture: Works in both Electron and browser mode.
 * - Electron: uses bridge IPC
 * - Browser: uses window.open() for URLs, backend API for system actions
 */

const BACKEND_URL = 'http://localhost:8000/api/interaction';

async function backendFallback(input) {
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { response: 'Backend offline' };
  }
}

export const workflowService = {
  /**
   * Executes a list of steps sequentially.
   * @param {Array} steps - [{ action: string, target: string }]
   * @param {Function} onStepStart - Callback for UI to highlight current step
   * @param {Function} onStepComplete - Callback for UI to mark step as completed
   */
  runWorkflow: async (steps, onStepStart, onStepComplete) => {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (onStepStart) onStepStart(i, step);

      try {
        await workflowService.executeStep(step);
        if (onStepComplete) onStepComplete(i, step);
      } catch (error) {
        throw new Error(`Step ${i + 1} (${step.action}) failed: ${error.message}`);
      }
    }

    return { success: true, message: 'Workflow completed successfully.' };
  },

  /**
   * Executes a single step. Uses Electron bridge if available, otherwise browser fallback.
   */
  executeStep: async (step) => {
    const bridge = window.electronAssistant;
    const { action, target } = step;

    // ═══ Electron path ═══
    if (bridge) {
      switch (action) {
        case 'open_app': {
          const appResult = await bridge.launchApp(target.toLowerCase());
          if (!appResult?.ok) throw new Error(appResult?.error || `Could not launch ${target}`);
          break;
        }
        case 'open_url':
          await bridge.openExternal(target);
          break;
        case 'open_folder':
          await bridge.openPath(target.toLowerCase());
          break;
        case 'set_volume': {
          const vol = parseInt(target, 10);
          if (isNaN(vol)) throw new Error('Invalid volume level');
          const volResult = await bridge.setVolume(vol);
          if (!volResult?.ok) throw new Error(volResult?.error || 'Could not set volume');
          break;
        }
        case 'search_google': {
          const query = encodeURIComponent(target.trim());
          await bridge.openExternal(`https://google.com/search?q=${query}`);
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } else {
      // ═══ Browser fallback ═══
      switch (action) {
        case 'open_url':
          window.open(target, '_blank');
          break;
        case 'search_google': {
          const query = encodeURIComponent(target.trim());
          window.open(`https://google.com/search?q=${query}`, '_blank');
          break;
        }
        case 'open_app':
          await backendFallback(`open ${target}`);
          break;
        case 'open_folder':
          await backendFallback(`open ${target}`);
          break;
        case 'set_volume':
          await backendFallback(`set volume ${target}`);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // Small delay between steps for UI feedback
    await new Promise(resolve => setTimeout(resolve, 800));
  }
};
