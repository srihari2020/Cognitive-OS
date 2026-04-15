const API_KEY_STORAGE_KEY = 'cognitive_os_api_keys';
const RETRY_DELAY_MS = 1000;
const MAX_503_ATTEMPTS = 2;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI Error: ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        status: 'SUCCESS',
        provider: this.name,
      };
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return {
        text: error.message,
        status: 'ERROR',
        provider: this.name,
      };
    }
  }
}

/**
 * AI Provider implementation for Google Gemini (gemini-2.5-flash)
 */
class GeminiProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'Gemini';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  }

  async sendMessage(messages, options = {}) {
    const signal = options.signal;
    const onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
    const userInput = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n\n');

    for (let attempt = 1; attempt <= MAX_503_ATTEMPTS; attempt += 1) {
      let response;

      try {
        response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: userInput },
                ],
              },
            ],
          }),
          signal,
        });
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        return {
          text: 'Network error',
          status: 'ERROR',
          provider: this.name,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          text: 'Invalid API key',
          status: 'ERROR',
          provider: this.name,
        };
      }

      if (response.status === 503) {
        if (attempt < MAX_503_ATTEMPTS) {
          if (onStatus) onStatus('AI busy, retrying...');
          await wait(RETRY_DELAY_MS);
          continue;
        }
        return {
          text: 'AI busy, try again',
          status: 'ERROR',
          provider: this.name,
        };
      }

      if (response.status >= 500) {
        return {
          text: 'Server error',
          status: 'ERROR',
          provider: this.name,
        };
      }

      if (!response.ok) {
        return {
          text: 'Network error',
          status: 'ERROR',
          provider: this.name,
        };
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        return {
          text: 'Gemini failed',
          status: 'ERROR',
          provider: this.name,
        };
      }

      return {
        text,
        status: 'SUCCESS',
        provider: this.name,
      };
    }

    return {
      text: 'AI busy, try again',
      status: 'ERROR',
      provider: this.name,
    };
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
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 300,
          messages: messages.map((message) => ({
            role: message.role === 'system' ? 'user' : message.role,
            content: message.content,
          })),
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Claude Error: ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.content[0].text,
        status: 'SUCCESS',
        provider: this.name,
      };
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return {
        text: error.message,
        status: 'ERROR',
        provider: this.name,
      };
    }
  }
}

/**
 * AI Provider implementation for Groq (llama-3.3-70b-versatile)
 */
class GroqProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'Groq';
    this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
  }

  async sendMessage(messages, options = {}) {
    const signal = options.signal;
    const onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
    const MAX_RETRIES = 2;
    const RETRY_DELAY_503 = 1000; // 1 second for 503
    const RETRY_DELAY_429 = 2000; // 2 seconds for 429

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      let response;

      try {
        response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
          }),
          signal,
        });
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        return {
          text: 'Network error',
          status: 'ERROR',
          provider: this.name,
        };
      }

      // Task 6.3: No-retry logic for auth errors (401, 403)
      if (response.status === 401 || response.status === 403) {
        return {
          text: 'Invalid API key',
          status: 'ERROR',
          provider: this.name,
        };
      }

      // Task 6.1: Retry logic for 503 status
      if (response.status === 503) {
        if (attempt < MAX_RETRIES) {
          if (onStatus) onStatus('AI busy, retrying...');
          await wait(RETRY_DELAY_503);
          continue;
        }
        return {
          text: 'AI busy, try again',
          status: 'ERROR',
          provider: this.name,
        };
      }

      // Task 6.2: Retry logic for 429 status
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          if (onStatus) onStatus('Rate limit hit, retrying...');
          await wait(RETRY_DELAY_429);
          continue;
        }
        return {
          text: 'AI busy, try again',
          status: 'ERROR',
          provider: this.name,
        };
      }

      // Task 6.4: No-retry logic for server errors (5xx excluding 503)
      if (response.status >= 500) {
        return {
          text: 'Server error',
          status: 'ERROR',
          provider: this.name,
        };
      }

      if (!response.ok) {
        return {
          text: 'Network error',
          status: 'ERROR',
          provider: this.name,
        };
      }

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        status: 'SUCCESS',
        provider: this.name,
      };
    }

    // This should not be reached, but added for completeness
    return {
      text: 'AI busy, try again',
      status: 'ERROR',
      provider: this.name,
    };
  }
}

export const credentialManager = {
  saveKeys(keys) {
    const encoded = btoa(JSON.stringify(keys));
    localStorage.setItem(API_KEY_STORAGE_KEY, encoded);
  },

  loadKeys() {
    const encoded = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!encoded) return {};
    try {
      return JSON.parse(atob(encoded));
    } catch (error) {
      console.error('Failed to load credentials:', error);
      return {};
    }
  },

  clearKeys() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  },
};

export const providers = {
  OpenAI: OpenAIProvider,
  Gemini: GeminiProvider,
  Claude: ClaudeProvider,
  Groq: GroqProvider,
};

export { GroqProvider };
