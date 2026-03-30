
import { providers, credentialManager } from './aiProviders';

/**
 * Intelligent Router for Multi-AI Provider system.
 * Handles provider selection, request normalization, and optional failover.
 */
class AIRouter {
  constructor() {
    this.activeProvider = null;
    this.lastAbortController = null;
    this.fallbackChain = ['OpenAI', 'Gemini', 'Claude'];
  }

  /**
   * Initializes the router with a selected provider.
   */
  async initialize(providerName) {
    const keys = credentialManager.loadKeys();
    const apiKey = keys[providerName];

    if (!apiKey) {
      throw new Error(`API Key for ${providerName} is missing.`);
    }

    const ProviderClass = providers[providerName];
    if (!ProviderClass) {
      throw new Error(`Provider ${providerName} is not supported.`);
    }

    this.activeProvider = new ProviderClass(apiKey);
    localStorage.setItem('active_ai_provider', providerName);
    return true;
  }

  /**
   * Routes a request to the active provider with concurrency control.
   */
  async route(text, options = {}) {
    // 1. Concurrency Control: Cancel previous request
    if (this.lastAbortController) {
      this.lastAbortController.abort();
    }
    this.lastAbortController = new AbortController();

    // 2. Initialize if not already done
    if (!this.activeProvider) {
      const savedProvider = localStorage.getItem('active_ai_provider') || 'OpenAI';
      try {
        await this.initialize(savedProvider);
      } catch (e) {
        // Failover if initial provider fails initialization (e.g., missing key)
        const nextProvider = this.fallbackChain.find(p => p !== savedProvider);
        if (nextProvider) {
          console.warn(`[AIRouter] ${savedProvider} initialization failed. Falling back to ${nextProvider}.`);
          await this.initialize(nextProvider);
        } else {
          throw e;
        }
      }
    }

    // 3. Execute request with failover
    try {
      const response = await this.activeProvider.sendMessage(text, {
        ...options,
        signal: this.lastAbortController.signal
      });

      // 4. Failover Logic (Optional)
      if (response.status === 'ERROR' && options.failover !== false) {
        console.warn(`[AIRouter] ${this.activeProvider.name} failed. Attempting failover.`);
        
        const nextProviderName = this.fallbackChain.find(p => p !== this.activeProvider.name);
        if (nextProviderName) {
          try {
            await this.initialize(nextProviderName);
            return await this.route(text, { ...options, failover: false });
          } catch (failoverError) {
            console.error(`[AIRouter] Failover to ${nextProviderName} failed.`, failoverError);
          }
        }
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return {
        text: `Routing failed: ${error.message}`,
        status: 'ERROR',
        provider: this.activeProvider?.name || 'ROUTER'
      };
    } finally {
      this.lastAbortController = null;
    }
  }

  /**
   * Returns current active provider info
   */
  getProviderInfo() {
    return {
      name: this.activeProvider?.name || 'NONE',
      available: this.fallbackChain.filter(p => !!credentialManager.loadKeys()[p])
    };
  }
}

export const aiRouter = new AIRouter();
