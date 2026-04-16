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

  // Helper function to execute with retry
  const executeWithRetry = async (executeFn, maxAttempts = 2) => {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await executeFn();
        if (result?.ok) {
          return { success: true, result, attempts: attempt };
        }
        lastError = result?.error || 'Unknown error';
        
        // Wait 500ms before retry (except on last attempt)
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        lastError = error.message || 'Execution error';
        
        // Wait 500ms before retry (except on last attempt)
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    return { success: false, error: lastError, attempts: maxAttempts };
  };

  switch (step.action) {
    case 'open_app': {
      if (!step.target) {
        return { status: 'failed', message: 'Invalid app command.' };
      }

      const result = await executeWithRetry(() => bridge.launchApp(step.target));
      
      if (!result.success) {
        console.error(`Failed to open ${step.target} after ${result.attempts} attempts:`, result.error);
        return { status: 'failed', message: `Failed to open ${step.target}` };
      }

      return { status: 'success', message: `Opened ${step.target}.`, retried: result.attempts > 1 };
    }

    case 'search_web': {
      if (!step.query || !step.query.trim()) {
        return { status: 'failed', message: 'Missing search target.' };
      }

      const url = `https://www.google.com/search?q=${encodeURIComponent(step.query)}`;
      const result = await executeWithRetry(() => electron.exec(`start ${url}`));
      
      if (!result.success) {
        console.error(`Failed to search for ${step.query} after ${result.attempts} attempts:`, result.error);
        return { status: 'failed', message: `Failed to search for ${step.query}` };
      }

      return { status: 'success', message: `Searched for ${step.query}.`, retried: result.attempts > 1 };
    }

    case 'ui_action': {
      if (!step.sub_action) {
        return { status: 'failed', message: 'Missing UI action.' };
      }

      const result = await executeWithRetry(() => bridge.uiAction({
        action: step.sub_action,
        target: step.target,
        x: step.x,
        y: step.y,
      }));

      if (!result.success) {
        console.error(`UI action failed after ${result.attempts} attempts:`, result.error);
        return { status: 'failed', message: result.error || 'UI action failed.' };
      }

      return { status: 'success', message: result.result.message || 'UI action completed.', retried: result.attempts > 1 };
    }

    case 'tab_control': {
      const result = await executeWithRetry(() => bridge.tabControl({ action: step.sub_action }));
      
      if (!result.success) {
        console.error(`Tab control failed after ${result.attempts} attempts:`, result.error);
        return { status: 'failed', message: result.error || 'Tab control failed.' };
      }
      
      return { status: 'success', message: result.result.message || 'Tab action completed.', retried: result.attempts > 1 };
    }

    default:
      return { status: 'failed', message: `Unknown action: ${step.action}` };
  }
}
