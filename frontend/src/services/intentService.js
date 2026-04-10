import { memoryStore } from './memoryStore';

export const intentService = {
  detectIntent(input) {
    const text = (input || '').trim().toLowerCase();
    if (!text) return null;

    // Smart Continuation: "open it"
    if (text === 'open it' || text === 'launch it') {
      const lastActionInput = memoryStore.getLastAction();
      if (lastActionInput) {
        // Recursively detect intent of the last action
        return this.detectIntent(lastActionInput);
      }
    }

    if (/^open\s+(vscode|vs\s?code|code)\b/.test(text)) {
      return { type: 'open_app', target: 'vscode' };
    }
    if (/^open\s+youtube\b/.test(text)) {
      return { type: 'open_url', target: 'https://youtube.com' };
    }
    const searchMatch = text.match(/^(?:search|google|search\s+for)\s+(.+)/i);
    if (searchMatch) {
      return { type: 'search', query: searchMatch[1].trim() };
    }
    return null;
  },
  async handleIntent(intent) {
    const bridge = window.electronAssistant;
    if (!bridge) throw new Error('Bridge unavailable');
    switch (intent.type) {
      case 'open_app': {
        const result = await bridge.launchApp(String(intent.target || '').toLowerCase());
        if (!result?.ok) throw new Error(result?.error || 'Launch failed');
        return 'Opening VS Code.';
      }
      case 'open_url': {
        const url = String(intent.target || '');
        await bridge.openExternal(url);
        return 'On it.';
      }
      case 'search': {
        const q = encodeURIComponent(String(intent.query || '').trim());
        await bridge.openExternal(`https://google.com/search?q=${q}`);
        return 'On it.';
      }
      default:
        throw new Error('Unknown intent');
    }
  }
};
