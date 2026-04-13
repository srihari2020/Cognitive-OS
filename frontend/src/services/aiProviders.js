
const API_KEY_STORAGE_KEY = 'cognitive_os_api_keys';

/**
 * AI Provider implementation for OpenAI (gpt-4o-mini)
 */
class OpenAIProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'OpenAI';
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
  }

  async sendMessage(messages, options = {}) {
    const signal = options.signal;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`OpenAI Error: ${response.status}`);
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
        text: error.message,
        status: 'ERROR',
        provider: this.name
      };
    }
  }
}

/**
 * AI Provider implementation for Google Gemini (gemini-1.5-flash)
 */
class GeminiProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'Gemini';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
  }

  async sendMessage(messages, options = {}) {
    const signal = options.signal;

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: messages.filter(m => m.role === 'user').map(m => ({ parts: [{ text: m.content }] }))
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Gemini Error: ${response.status}`);
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
        text: error.message,
        status: 'ERROR',
        provider: this.name
      };
    }
  }
}

/**
 * AI Provider implementation for Anthropic (claude-3-haiku-20240307)
 */
class ClaudeProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'Claude';
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  async sendMessage(messages, options = {}) {
    const signal = options.signal;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 300,
          messages: messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })) // Claude doesn't have system role
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Claude Error: ${response.status}`);
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
        text: error.message,
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
