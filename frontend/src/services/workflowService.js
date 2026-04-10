/**
 * workflowService.js
 * 
 * Handles sequential execution of multi-step plans.
 * Supports: open_app, open_url, open_folder, set_volume, search_google.
 */

export const workflowService = {
  /**
   * Executes a list of steps sequentially.
   * @param {Array} steps - [{ action: string, target: string }]
   * @param {Function} onStepStart - Callback for UI to highlight current step
   * @param {Function} onStepComplete - Callback for UI to mark step as completed
   */
  runWorkflow: async (steps, onStepStart, onStepComplete) => {
    const bridge = window.electronAssistant;
    if (!bridge) {
      throw new Error('Electron bridge not found. Cannot execute workflow.');
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (onStepStart) onStepStart(i, step);

      try {
        await workflowService.executeStep(step, bridge);
        if (onStepComplete) onStepComplete(i, step);
      } catch (error) {
        console.error(`Workflow failed at step ${i + 1}:`, error);
        throw new Error(`Step ${i + 1} (${step.action}) failed: ${error.message}`);
      }
    }

    return { success: true, message: 'Workflow completed successfully.' };
  },

  /**
   * Maps action strings to Electron bridge calls.
   */
  executeStep: async (step, bridge) => {
    const { action, target } = step;

    switch (action) {
      case 'open_app':
        const appResult = await bridge.launchApp(target.toLowerCase());
        if (!appResult?.ok) throw new Error(appResult?.error || `Could not launch ${target}`);
        break;

      case 'open_url':
        await bridge.openExternal(target);
        break;

      case 'open_folder':
        await bridge.openPath(target.toLowerCase());
        break;

      case 'set_volume':
        const vol = parseInt(target, 10);
        if (isNaN(vol)) throw new Error('Invalid volume level');
        const volResult = await bridge.setVolume(vol);
        if (!volResult?.ok) throw new Error(volResult?.error || 'Could not set volume');
        break;

      case 'search_google':
        const query = encodeURIComponent(target.trim());
        await bridge.openExternal(`https://google.com/search?q=${query}`);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Small delay between steps for better UI/UX and to avoid race conditions
    await new Promise(resolve => setTimeout(resolve, 800));
  }
};
