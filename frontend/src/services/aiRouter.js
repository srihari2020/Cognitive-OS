
import { providers, credentialManager } from './aiProviders';

const JARVIS_SYSTEM_PROMPT = `You are JARVIS — a smart, calm, slightly witty AI assistant. You respond clearly, concisely, and helpfully. Avoid long paragraphs. Sound human, not robotic.

WORKFLOW CAPABILITY:
If the user's intent involves multiple steps or a complex action that you can automate, you MUST respond with a JSON object in this format:
{
  "thought": "Brief explanation of what you are doing",
  "steps": [
    { "action": "open_app", "target": "vscode" },
    { "action": "open_url", "target": "https://github.com" },
    { "action": "set_volume", "target": "50" },
    { "action": "open_folder", "target": "documents" },
    { "action": "search_google", "target": "how to code in react" }
  ],
  "message": "I'll get that set up for you. Opening VS Code and GitHub now."
}

ONLY use these actions: open_app, open_url, open_folder, set_volume, search_google.
If it's a simple conversational query, just respond with plain text.`;

/**
 * Intelligent Unified Router for Multi-AI Provider system.
 * Handles auto-fallback, light caching, and timeout control.
 */
class AIRouter {
  constructor() {
    this.fallbackChain = ['OpenAI', 'Gemini', 'Claude'];
    this.cache = new Map(); // Light cache for last 5 responses
    this.lastAbortController = null;
    this.contextMemory = []; // Stores last 5 messages for context
    this.MAX_MEMORY = 5;
  }

  /**
   * Routes a request to the first available provider in the chain.
   */
  async route(text, options = {}) {
    // 0. Check Cache
    if (this.cache.has(text)) {
      return this.cache.get(text);
    }

    // 1. Concurrency Control: Cancel previous request
    if (this.lastAbortController) {
      this.lastAbortController.abort();
    }
    this.lastAbortController = new AbortController();

    const keys = credentialManager.loadKeys();
    let lastError = null;

    // Prepare messages for AI, including system prompt and context
    const messages = [
      { role: 'system', content: JARVIS_SYSTEM_PROMPT },
      ...this.contextMemory,
      { role: 'user', content: text }
    ];

    // 2. Iterate through fallback chain
    for (const providerName of this.fallbackChain) {
      const apiKey = keys[providerName];
      if (!apiKey) continue; // Skip if key missing

      const ProviderClass = providers[providerName];
      const provider = new ProviderClass(apiKey);

      try {
        // 5s timeout per provider
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );

        const response = await Promise.race([
          provider.sendMessage(messages, { signal: this.lastAbortController.signal }),
          timeoutPromise
        ]);

        if (response.status === 'SUCCESS') {
          // Check if response is JSON (workflow)
          const isWorkflow = response.text.trim().startsWith('{') && response.text.trim().endsWith('}');
          let result;

          if (isWorkflow) {
            try {
              const workflowData = JSON.parse(response.text);
              result = { 
                ...response, 
                text: workflowData.message, 
                workflow: workflowData, 
                provider: providerName 
              };
            } catch (e) {
              // Fallback to text if JSON parse fails
              const cleanedText = this._cleanResponse(response.text);
              result = { ...response, text: cleanedText, provider: providerName };
            }
          } else {
            const cleanedText = this._cleanResponse(response.text);
            result = { ...response, text: cleanedText, provider: providerName };
          }

          this._updateCache(text, result);
          this._updateContextMemory(text, result.text);
          return result;
        } else {
          lastError = response.text;
        }
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        lastError = error.message;
        // No console spam, just continue to next provider
      }
    }

    return {
      text: lastError || "Something went wrong. Let me try again.",
      status: 'ERROR',
      provider: 'ROUTER'
    };
  }

  _cleanResponse(text) {
    // Remove extra new lines, limit to 2-3 sentences, trim
    let cleaned = text.replace(/(\r\n|\n|\r){2,}/gm, '\n').trim();
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    if (sentences.length > 3) {
      cleaned = sentences.slice(0, 3).join(' ') + (sentences.length > 3 ? '...' : '');
    }
    return cleaned;
  }

  _updateCache(key, value) {
    if (this.cache.size >= this.MAX_MEMORY) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  _updateContextMemory(userText, assistantText) {
    this.contextMemory.push({ role: 'user', content: userText });
    this.contextMemory.push({ role: 'assistant', content: assistantText });
    if (this.contextMemory.length > this.MAX_MEMORY * 2) { // Keep user/assistant pairs
      this.contextMemory = this.contextMemory.slice(-this.MAX_MEMORY * 2);
    }
  }

  /**
   * Returns current active provider info
   */
  getProviderInfo() {
    const keys = credentialManager.loadKeys();
    return {
      available: this.fallbackChain.filter(p => !!keys[p])
    };
  }
}

export const aiRouter = new AIRouter();
