/**
 * commandRouter.js
 * 
 * Intercepts user voice/text inputs before they hit the AI backend.
 * Responsible for parsing precise desktop actions (open Chrome, search Google, etc)
 * and triggering the local Electron IPC handlers securely.
 * 
 * Returns minimal, JARVIS-style TTS confirmation phrases.
 */

export const commandRouter = {
  route: async (input) => {
    // We only route local system commands if running natively in the Electron shell.
    const bridge = window.electronAssistant;
    if (!bridge) {
      return { handled: false };
    }

    const normalized = input.trim().toLowerCase();

    try {
      // 1. YouTube
      if (/^(open|launch)\s+youtube\b/i.test(normalized)) {
        await bridge.openExternal('https://youtube.com');
        return { handled: true, message: 'Opening YouTube.' };
      }

      // 2. Chrome
      if (/^(open|launch)\s+chrome\b/i.test(normalized)) {
        const result = await bridge.launchApp('chrome');
        if (!result?.ok) throw new Error(result?.error || 'Unable to launch Chrome.');
        return { handled: true, message: 'Opening Chrome.' };
      }

      // 3. VS Code
      if (/^(open|launch)\s+(vscode|code|vs code)\b/i.test(normalized)) {
        const result = await bridge.launchApp('vscode');
        if (!result?.ok) throw new Error(result?.error || 'Unable to launch VS Code.');
        return { handled: true, message: 'Opening VS Code.' };
      }

      // 4. Volume Control
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

      // 5. Google Search
      const googleMatch = normalized.match(/^(?:search google(?: for)?|google|search(?: for)?)\s+(.+)$/i);
      if (googleMatch) {
        const query = encodeURIComponent(googleMatch[1].trim());
        await bridge.openExternal(`https://google.com/search?q=${query}`);
        return { handled: true, message: 'Searching now.' };
      }

      // 6. File Explorer
      if (/^(open|show)\s+(files|explorer|documents)\b/i.test(normalized)) {
        await bridge.openPath('documents'); // default to user's Documents folder
        return { handled: true, message: 'Opening files.' };
      }

      if (/^(open|show)\s+(downloads)\b/i.test(normalized)) {
        await bridge.openPath('downloads');
        return { handled: true, message: 'Opening downloads.' };
      }

      // 8. Preset Routines
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

      // 7. System Info
      if (/^(system info|show system info|system status|check system)\b/i.test(normalized)) {
        const info = await bridge.getSystemInfo();
        if (!info?.ok) throw new Error('Unable to fetch stats.');
        const response = `Systems nominal. ${info.freeMemoryGb} gigabytes of memory available over ${info.cpuCores} cores.`;
        return { handled: true, message: response };
      }

      // Not a whitelisted desktop command, fallback to AI.
      return { handled: false };

    } catch (error) {
      throw new Error(`Command failure: ${error.message}`);
    }
  }
};
