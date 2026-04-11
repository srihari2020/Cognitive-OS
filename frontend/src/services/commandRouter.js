/**
 * commandRouter.js
 * 
 * Unified command router for Cognitive OS.
 * Architecture: UI → commandRouter →
 *   if Electron → local execution via IPC
 *   else → backend API fallback (http://localhost:8000/api/interaction)
 *
 * NEVER blocks browser mode. Always returns a result.
 */

const BACKEND_URL = 'http://localhost:8000/api/interaction';

/**
 * Fallback handler: sends command to FastAPI backend when not in Electron.
 */
async function fetchCommandHandler(input) {
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      handled: true,
      message: data.response || data.message || 'Command executed.',
    };
  } catch {
    return {
      handled: true,
      message: 'Backend offline. Please start the server (python server.py).',
    };
  }
}

/**
 * Browser-native handlers for commands that can run without backend or Electron.
 * Uses window.open() for URLs — works everywhere.
 */
function tryBrowserNative(normalized) {
  // YouTube
  if (/^(open|launch)\s+youtube\b/i.test(normalized)) {
    window.open('https://youtube.com', '_blank');
    return { handled: true, message: 'Opening YouTube.' };
  }

  // Chrome / Browser
  if (/^(open|launch)\s+chrome\b/i.test(normalized)) {
    window.open('https://google.com', '_blank');
    return { handled: true, message: 'Opening browser.' };
  }

  // Google Search
  const googleMatch = normalized.match(/^(?:search google(?: for)?|google|search(?: for)?)\s+(.+)$/i);
  if (googleMatch) {
    const query = encodeURIComponent(googleMatch[1].trim());
    window.open(`https://google.com/search?q=${query}`, '_blank');
    return { handled: true, message: 'Searching now.' };
  }

  return null; // Not a browser-native command
}

export const commandRouter = {
  route: async (input) => {
    const bridge = window.electronAssistant;
    const normalized = input.trim().toLowerCase();

    // 1. Check for basic browser-native overrides (mostly for non-Electron mode)
    if (!bridge) {
      const browserResult = tryBrowserNative(normalized);
      if (browserResult) return browserResult;
    }

    // 2. Delegate everything else to the smart backend
    // The backend now handles intent detection, fuzzy app matching, AI fallback, and memory.
    try {
      const response = await fetchCommandHandler(input);
      return response;
    } catch (error) {
      // Fallback if backend is offline and we are in Electron
      if (bridge) {
        if (normalized.includes('vscode')) {
          await bridge.launchApp('vscode');
          return { handled: true, message: 'Opening VS Code (local fallback).' };
        }
      }
      return { handled: true, message: 'I couldn\'t reach my core systems.' };
    }
  }
};
