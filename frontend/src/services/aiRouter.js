
import { providers, credentialManager } from './aiProviders';

/**
 * Intelligent Unified Router for Multi-AI Provider system.
 * Handles auto-fallback, light caching, and timeout control.
 */
class AIRouter {
  constructor() {
    this.fallbackChain = ['OpenAI', 'Gemini', 'Claude'];
    this.cache = new Map(); // Light cache for last 5 responses
    this.lastAbortController = null;
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
          provider.sendMessage(text, { signal: this.lastAbortController.signal }),
          timeoutPromise
        ]);

        if (response.status === 'SUCCESS') {
          // Success! Update cache and return
          const result = { ...response, provider: providerName };
          this._updateCache(text, result);
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
      text: lastError || "All AI providers failed or no keys configured.",
      status: 'ERROR',
      provider: 'ROUTER'
    };
  }

  _updateCache(key, value) {
    if (this.cache.size >= 5) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
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
