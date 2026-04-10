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

    // ═══════════════════════════════════════
    // PATH 1: Electron IPC (native desktop)
    // ═══════════════════════════════════════
    if (bridge) {
      try {
        // YouTube
        if (/^(open|launch)\s+youtube\b/i.test(normalized)) {
          await bridge.openExternal('https://youtube.com');
          return { handled: true, message: 'Opening YouTube.' };
        }

        // Chrome
        if (/^(open|launch)\s+chrome\b/i.test(normalized)) {
          const result = await bridge.launchApp('chrome');
          if (!result?.ok) throw new Error(result?.error || 'Unable to launch Chrome.');
          return { handled: true, message: 'Opening Chrome.' };
        }

        // VS Code
        if (/^(open|launch)\s+(vscode|code|vs code)\b/i.test(normalized)) {
          const result = await bridge.launchApp('vscode');
          if (!result?.ok) throw new Error(result?.error || 'Unable to launch VS Code.');
          return { handled: true, message: 'Opening VS Code.' };
        }

        // Volume Control
        const volMatch = normalized.match(/^(?:set|change|volume)\s+(?:volume\s+to\s+)?(\d+)(?:%)?$/i) ||
                         normalized.match(/^(?:volume)\s+(\d+)(?:%)?$/i);
        if (volMatch) {
          const level = parseInt(volMatch[1], 10);
          const result = await bridge.setVolume(level);
          if (!result?.ok) throw new Error(result?.error || 'Unable to set volume.');
          return { handled: true, message: `Volume set to ${level} percent.` };
        }

        if (normalized.includes('volume up')) {
          const current = await bridge.getVolume();
          const next = Math.min((current?.volume || 0) + 10, 100);
          await bridge.setVolume(next);
          return { handled: true, message: `Volume increased to ${next} percent.` };
        }

        if (normalized.includes('volume down')) {
          const current = await bridge.getVolume();
          const next = Math.max((current?.volume || 0) - 10, 0);
          await bridge.setVolume(next);
          return { handled: true, message: `Volume decreased to ${next} percent.` };
        }

        // Google Search
        const googleMatch = normalized.match(/^(?:search google(?: for)?|google|search(?: for)?)\s+(.+)$/i);
        if (googleMatch) {
          const query = encodeURIComponent(googleMatch[1].trim());
          await bridge.openExternal(`https://google.com/search?q=${query}`);
          return { handled: true, message: 'Searching now.' };
        }

        // File Explorer
        if (/^(open|show)\s+(files|explorer|documents)\b/i.test(normalized)) {
          await bridge.openPath('documents');
          return { handled: true, message: 'Opening files.' };
        }

        if (/^(open|show)\s+(downloads)\b/i.test(normalized)) {
          await bridge.openPath('downloads');
          return { handled: true, message: 'Opening downloads.' };
        }

        // Preset Routines
        if (normalized === 'start coding') {
          return {
            handled: true,
            isWorkflow: true,
            workflow: {
              steps: [
                { action: 'open_app', target: 'vscode' },
                { action: 'open_url', target: 'https://github.com' }
              ],
              message: "Initializing workspace. Opening VS Code and GitHub."
            }
          };
        }

        if (normalized === 'focus mode') {
          return {
            handled: true,
            isWorkflow: true,
            workflow: {
              steps: [
                { action: 'set_volume', target: '10' },
                { action: 'open_app', target: 'vscode' }
              ],
              message: "Activating focus mode. Reducing volume and opening VS Code."
            }
          };
        }

        // System Info
        if (/^(system info|show system info|system status|check system)\b/i.test(normalized)) {
          const info = await bridge.getSystemInfo();
          if (!info?.ok) throw new Error('Unable to fetch stats.');
          const response = `Systems nominal. ${info.freeMemoryGb} gigabytes of memory available over ${info.cpuCores} cores.`;
          return { handled: true, message: response };
        }

        // Not a whitelisted Electron command → fall through to AI
        return { handled: false };

      } catch (error) {
        return { handled: true, message: `Command error: ${error.message}` };
      }
    }

    // ═══════════════════════════════════════
    // PATH 2: Browser mode (no Electron)
    // ═══════════════════════════════════════

    // 2a. Try browser-native actions first (window.open for URLs)
    const browserResult = tryBrowserNative(normalized);
    if (browserResult) return browserResult;

    // 2b. Everything else → backend API fallback
    // This covers: open vscode, system info, open files, etc.
    return await fetchCommandHandler(input);
  }
};
