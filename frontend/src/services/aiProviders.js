
const API_KEY_STORAGE_KEY = 'cognitive_os_api_keys';

/**
 * AI Provider implementation for OpenAI (ChatGPT)
 */
class OpenAIProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'OpenAI';
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
  }

  async sendMessage(text, options = {}) {
    const controller = options.signal ? null : new AbortController();
    const signal = options.signal || controller.signal;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: options.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: text }],
          temperature: 0.7
        }),
        signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `OpenAI Error: ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        status: 'SUCCESS',
        provider: this.name
      };
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return {
        text: `Error from ${this.name}: ${error.message}`,
        status: 'ERROR',
        provider: this.name
      };
    }
  }
}

/**
 * AI Provider implementation for Google Gemini
 */
class GeminiProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'Gemini';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  }

  async sendMessage(text, options = {}) {
    const controller = options.signal ? null : new AbortController();
    const signal = options.signal || controller.signal;

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }]
        }),
        signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Gemini Error: ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.candidates[0].content.parts[0].text,
        status: 'SUCCESS',
        provider: this.name
      };
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return {
        text: `Error from ${this.name}: ${error.message}`,
        status: 'ERROR',
        provider: this.name
      };
    }
  }
}

/**
 * AI Provider implementation for Anthropic (Claude)
 */
class ClaudeProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'Claude';
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  async sendMessage(text, options = {}) {
    const controller = options.signal ? null : new AbortController();
    const signal = options.signal || controller.signal;

    try {
      // NOTE: Claude requires specific headers for CORS if called from browser, 
      // but in Electron renderer with contextIsolation it might need a proxy or 
      // specialized handling if Anthropic blocks direct browser requests.
      // We'll use a standard fetch first.
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true' // Some SDKs require this
        },
        body: JSON.stringify({
          model: options.model || 'claude-3-haiku-20240307',
          max_tokens: 1024,
          messages: [{ role: 'user', content: text }]
        }),
        signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Claude Error: ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.content[0].text,
        status: 'SUCCESS',
        provider: this.name
      };
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return {
        text: `Error from ${this.name}: ${error.message}`,
        status: 'ERROR',
        provider: this.name
      };
    }
  }
}

/**
 * Securely store API keys in localStorage (basic encryption for demonstration)
 * In a real production app, use Electron's safeStorage or a dedicated secure vault.
 */
export const credentialManager = {
  saveKeys(keys) {
    // Basic obfuscation (not real encryption, but keeps keys out of plain sight in localstorage)
    const encoded = btoa(JSON.stringify(keys));
    localStorage.setItem(API_KEY_STORAGE_KEY, encoded);
  },

  loadKeys() {
    const encoded = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!encoded) return {};
    try {
      return JSON.parse(atob(encoded));
    } catch (e) {
      console.error('Failed to load credentials:', e);
      return {};
    }
  },

  clearKeys() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
};

export const providers = {
  OpenAI: OpenAIProvider,
  Gemini: GeminiProvider,
  Claude: ClaudeProvider
};
