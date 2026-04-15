/**
 * executor.js
 *
 * Handles validated single-step execution through the Electron bridge.
 */

const isElectron = !!(window.electron && window.electron.exec);

let userTriggerArmed = false;
let isExecuting = false;

export function allowExecution() {
  userTriggerArmed = true;
}

export const runWorkflow = async (plan, onStepStart) => {
  if (!isElectron) {
    return { success: false, error: 'System bridge unavailable. Please run this in Electron.' };
  }

  if (!userTriggerArmed) {
    return { success: false, error: 'Unauthorized execution path blocked.' };
  }

  if (isExecuting) {
    return { success: false, error: 'Already executing a command.' };
  }

  if (!Array.isArray(plan) || plan.length === 0) {
    userTriggerArmed = false;
    return { success: true, results: [] };
  }

  userTriggerArmed = false;
  isExecuting = true;

  try {
    const results = [];

    for (let index = 0; index < plan.length; index += 1) {
      const step = plan[index];
      if (onStepStart) onStepStart(index + 1, plan.length, step);

      const result = await executeStep(step);
      console.log('Execution result:', result);
      results.push(result);

      if (result.status === 'failed') {
        return { success: false, error: result.message, results };
      }
    }

    return { success: true, results };
  } finally {
    isExecuting = false;
  }
};

async function executeStep(step) {
  const electron = window.electron;
  const bridge = window.electronAssistant;

  if (!electron || !electron.exec || !bridge) {
    return { status: 'failed', message: 'System bridge unavailable.' };
  }

  if (!step || !step.action) {
    return { status: 'failed', message: 'Invalid command step.' };
  }

  switch (step.action) {
    case 'open_app': {
      if (!step.cmd || !step.target) {
        return { status: 'failed', message: 'Invalid app command.' };
      }

      const result = await electron.exec(step.cmd);
      if (!result?.ok) {
        return { status: 'failed', message: `Failed to open ${step.target}: ${result?.error || 'Unknown error'}` };
      }

      return { status: 'success', message: `Opened ${step.target}.` };
    }

    case 'search_web': {
      if (!step.query || !step.query.trim()) {
        return { status: 'failed', message: 'Missing search target.' };
      }

      const url = `https://www.google.com/search?q=${encodeURIComponent(step.query)}`;
      const result = await electron.exec(`start ${url}`);
      if (!result?.ok) {
        return { status: 'failed', message: `Failed to search for ${step.query}: ${result?.error || 'Unknown error'}` };
      }

      return { status: 'success', message: `Searched for ${step.query}.` };
    }

    case 'ui_action': {
      if (!step.sub_action) {
        return { status: 'failed', message: 'Missing UI action.' };
      }

      const res = await bridge.uiAction({
        action: step.sub_action,
        target: step.target,
        x: step.x,
        y: step.y,
      });

      if (!res?.ok) {
        return { status: 'failed', message: res?.error || 'UI action failed.' };
      }

      return { status: 'success', message: res.message || 'UI action completed.' };
    }

    case 'tab_control': {
      const res = await bridge.tabControl({ action: step.sub_action });
      if (!res?.ok) {
        return { status: 'failed', message: res?.error || 'Tab control failed.' };
      }
      return { status: 'success', message: res.message || 'Tab action completed.' };
    }

    default:
      return { status: 'failed', message: `Unknown action: ${step.action}` };
  }
}
