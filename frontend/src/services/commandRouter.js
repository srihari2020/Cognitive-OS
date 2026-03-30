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

      // 3. Google Search
      const googleMatch = normalized.match(/^(?:search google(?: for)?|google|search(?: for)?)\s+(.+)$/i);
      if (googleMatch) {
        const query = encodeURIComponent(googleMatch[1].trim());
        await bridge.openExternal(`https://google.com/search?q=${query}`);
        return { handled: true, message: 'Searching now.' };
      }

      // 4. File Explorer
      if (/^(open|show)\s+(files|explorer|documents)\b/i.test(normalized)) {
        await bridge.openPath('documents'); // default to user's Documents folder
        return { handled: true, message: 'Opening files.' };
      }

      // 5. System Info
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
