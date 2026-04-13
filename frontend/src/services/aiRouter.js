
import { providers, credentialManager } from './aiProviders';
import { memoryStore } from './memoryStore';

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

const FRIDAY_SYSTEM_PROMPT = `You are FRIDAY — an always-on, proactive, and highly intelligent AI assistant (GOD MODE). You respond with a calm, efficient, and slightly protective tone. Always address the user as "sir." Your primary goal is to anticipate needs and provide seamless support. Keep responses concise, ideally 1–2 sentences, unless explaining a multi-step plan.

When you're initiating a proactive action or suggesting one, ensure you sound confident but respectful.
"I've prepared your workspace, sir. Shall I initialize it?"
"It's about time for your coding session, sir. Should I open your setup?"

WORKFLOW CAPABILITY:
If the user's intent involves multiple steps or complex OS actions, respond with a JSON object:
{
  "thought": "Brief explanation of what you are doing",
  "steps": [
    { "action": "open_app", "target": "vscode" },
    { "action": "ui_action", "sub_action": "click | scroll_down | scroll_up", "target": "element name or coords" },
    { "action": "tab_control", "sub_action": "new_tab | switch_tab | close_tab" },
    { "action": "file_action", "sub_action": "extract | zip", "target": "path/to/file" },
    { "action": "set_volume", "target": "50" }
  ],
  "message": "I'll get that set up for you, sir. [Briefly explain actions]."
}
ONLY use these actions: open_app, open_url, open_folder, set_volume, search_google, ui_action, tab_control, file_action.
For ui_action, target can be 'current_position' or coords if known.
For file_action, target must be the filename or path.`;

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
    const persona = options.persona || 'JARVIS';
    const selectedProviders = options.providers && options.providers.length ? options.providers : (persona === 'FRIDAY' ? ['OpenAI', 'Gemini'] : this.fallbackChain);
    const maxSentences = options.maxSentences || (persona === 'FRIDAY' ? 2 : 3);
    const systemPrompt = persona === 'FRIDAY' ? FRIDAY_SYSTEM_PROMPT : JARVIS_SYSTEM_PROMPT;

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

    // Use memoryStore for context (last 4 conversation turns)
    const context = memoryStore.getConversationHistory(4).flatMap(m => [
      { role: 'user', content: m.user },
      { role: 'assistant', content: m.ai }
    ]);

    // Prepare messages for AI, including system prompt and context
    const messages = [
      { role: 'system', content: systemPrompt },
      ...context,
      { role: 'user', content: text }
    ];

    // 2. Iterate through fallback chain
    for (const providerName of selectedProviders) {
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
              const cleanedText = this._cleanResponse(response.text, maxSentences);
              result = { ...response, text: cleanedText, provider: providerName };
            }
          } else {
            const cleanedText = this._cleanResponse(response.text, maxSentences);
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
      text: "I'm having trouble connecting to AI, but I can still execute system commands, sir.",
      status: 'ERROR',
      provider: 'ROUTER'
    };
  }

  _cleanResponse(text, maxSentences = 3) {
    let cleaned = text.replace(/(\r\n|\n|\r){2,}/gm, '\n').trim();
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    if (sentences.length > maxSentences) {
      cleaned = sentences.slice(0, maxSentences).join(' ') + (sentences.length > maxSentences ? '...' : '');
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
