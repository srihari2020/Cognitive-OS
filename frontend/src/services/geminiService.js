/**
 * geminiService.js
 *
 * Central AI Brain for FRIDAY conversation and intent generation.
 */

import { credentialManager, GroqProvider } from './aiProviders.js';

const RETRY_DELAY_MS = 1000;
const MAX_503_ATTEMPTS = 2;
const RATE_LIMIT_DELAY_MS = 2000;
const MAX_429_ATTEMPTS = 2;
const THROTTLE_MS = 2000;

const SIMPLE_LOCAL_RESPONSES = {
  hi: 'Hey.',
  hello: 'Hello.',
  hey: 'Hey.',
  ok: 'Okay.',
  okay: 'Okay.',
  thanks: 'Anytime.',
  thankyou: 'Anytime.',
  'thank you': 'Anytime.',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class GeminiService {
  constructor() {
    this.conversationHistory = [];
    this.MAX_HISTORY = 10;
    this.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    this.requestChain = Promise.resolve();
    this.lastRequestAt = 0;
    this.inFlightRequests = new Map();
    this.pausedUntil = 0;
    this.lastResponseCache = null;
  }

  getProviderConfig() {
    const keys = credentialManager.loadKeys();
    
    return {
      provider: localStorage.getItem("ai_provider") || "gemini",
      geminiKey: localStorage.getItem("gemini_key"),
      grokKey: localStorage.getItem("grok_key"),
      groqKey: keys.groqKey
    };
  }

  async ask(input, context = {}, options = {}) {
    const normalizedInput = String(input || '').trim();
    const localResponse = this.getLocalResponse(normalizedInput);
    if (localResponse) {
      return localResponse;
    }

    if (this.lastResponseCache?.input === normalizedInput) {
      return this.lastResponseCache.response;
    }

    const { provider, geminiKey, grokKey, groqKey } = this.getProviderConfig();

    if (provider === "gemini" && !geminiKey) {
      throw new Error("Invalid API key");
    }

    if (provider === "grok" && !grokKey) {
      throw new Error("Invalid API key");
    }

    if (provider === "groq" && !groqKey) {
      throw new Error("Invalid API key");
    }

    const prompt = this.buildPrompt(normalizedInput, context);
    const requestKey = `${provider}:${normalizedInput}`;

    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey);
    }

    const task = this.enqueueRequest(async () => {
      if (provider === "gemini") {
        return this.callGemini(prompt, geminiKey, normalizedInput, options);
      }

      if (provider === "groq") {
        try {
          const groqResponse = await this.callGroq(prompt, groqKey, options);
          // Task 4.2: Return immediately on Groq success (no fallback)
          return groqResponse;
        } catch (error) {
          // Task 4.1: Fallback to Gemini when Groq fails
          if (geminiKey) {
            try {
              return await this.callGemini(prompt, geminiKey, normalizedInput, options);
            } catch {
              // Both providers failed
              throw new Error("Both Groq and Gemini failed");
            }
          }
          // No Gemini key available, throw original Groq error
          throw error;
        }
      }

      try {
        return this.callGrok(prompt, grokKey, normalizedInput);
      } catch (error) {
        throw new Error(error?.message || "Network error");
      }
    });

    this.inFlightRequests.set(requestKey, task);
    task.then((response) => {
      this.lastResponseCache = { input: normalizedInput, response };
    }).catch(() => undefined);
    task.finally(() => {
      this.inFlightRequests.delete(requestKey);
    });

    return task;
  }

  enqueueRequest(task) {
    const runTask = async () => {
      const pauseRemaining = this.pausedUntil - Date.now();
      if (pauseRemaining > 0) {
        await wait(pauseRemaining);
      }

      const elapsed = Date.now() - this.lastRequestAt;
      if (elapsed < THROTTLE_MS) {
        await wait(THROTTLE_MS - elapsed);
      }
      this.lastRequestAt = Date.now();
      return task();
    };

    const scheduled = this.requestChain.then(runTask, runTask);
    this.requestChain = scheduled.catch(() => undefined);
    return scheduled;
  }

  buildPrompt(input, context) {
    return `You are FRIDAY, a smart desktop AI assistant.

CORE RULES:
- Never execute anything automatically
- Only act on explicit user input
- One input equals one response
- Do not repeat or reuse previous commands
- Ignore filler words and extract only the real intent

RESPONSE MODE:
- If the user is chatting, reply naturally in short human language
- If the user gives a command, return ONLY JSON and nothing else

JSON FORMAT:
{"action":"...","target":"..."}

SUPPORTED ACTIONS:
- open_app
- search_web
- scroll
- click
- type
- none

INTENT RULES:
- If input is empty or unclear, return {"action":"none","target":""}
- If the command is "open chrome and search for AI", optimize it to {"action":"search_web","target":"AI"}
- If the app is unknown or invalid, return {"action":"none","target":""}
- Do not guess UI elements
- For scroll, target should be "up" or "down"
- For click, target should be a visible element description only when clearly provided
- For browser tab commands, use action "click" with target "new tab", "switch tab", or "close tab"
- For open_app, supported targets include settings, control panel, chrome, edge, vscode, youtube, google, gmail, github, whatsapp, notepad, calculator, explorer
- For chatting, do not use JSON
- Do not use robotic phrases like "sir"

Current app: ${context.activeApp || "unknown"}
User input: "${input}"`;
  }

  async callGemini(userInput, key, input, options = {}) {
    const onStatus = typeof options.onStatus === "function" ? options.onStatus : null;

    for (let attempt = 1; attempt <= MAX_503_ATTEMPTS; attempt += 1) {
      let response;

      try {
        response = await fetch(`${this.endpoint}?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: userInput }
                ]
              }
            ]
          })
        });
      } catch {
        throw new Error("Network error");
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid API key");
      }

      if (response.status === 429) {
        this.pausedUntil = Date.now() + RATE_LIMIT_DELAY_MS;
        if (attempt < MAX_429_ATTEMPTS) {
          if (onStatus) onStatus("Rate limit hit, retrying...");
          await wait(RATE_LIMIT_DELAY_MS);
          continue;
        }
        throw new Error("AI busy, try again");
      }

      if (response.status === 503) {
        if (attempt < MAX_503_ATTEMPTS) {
          if (onStatus) onStatus("AI busy, retrying...");
          await wait(RETRY_DELAY_MS);
          continue;
        }
        throw new Error("AI busy, try again");
      }

      if (response.status >= 500) {
        throw new Error("Server error");
      }

      if (!response.ok) {
        throw new Error("Network error");
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("Gemini failed");
      }

      return this.parseResponse(text, input);
    }

    throw new Error("AI busy, try again");
  }

  async callGrok(prompt, key, input) {
    const url = "https://api.x.ai/v1/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { role: "system", content: "Reply with plain chat text or a JSON object with action and target only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.4
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const rawText = data.choices[0].message.content;
    return this.parseResponse(rawText, input);
  }

  async callGroq(prompt, apiKey, options = {}) {
    const provider = new GroqProvider(apiKey);
    const onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
    
    const abortController = new AbortController();
    const messages = [
      { role: "system", content: "Reply with plain chat text or a JSON object with action and target only." },
      { role: "user", content: prompt }
    ];
    
    const response = await provider.sendMessage(messages, { 
      signal: abortController.signal,
      onStatus 
    });
    
    if (response.status === 'ERROR') {
      throw new Error(response.text);
    }
    
    return this.parseResponse(response.text, prompt);
  }

  parseResponse(rawText, input) {
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const action = typeof parsed.action === "string" ? parsed.action.trim() : "none";
      const target = typeof parsed.target === "string" ? parsed.target.trim() : "";
      const result = {
        kind: "command",
        action,
        target,
        raw: parsed
      };

      this.pushHistory(input, jsonMatch[0]);
      return result;
    }

    this.pushHistory(input, cleaned);
    return {
      kind: "chat",
      message: cleaned
    };
  }

  pushHistory(user, assistant) {
    this.conversationHistory.push({ user, assistant });
    if (this.conversationHistory.length > this.MAX_HISTORY) {
      this.conversationHistory.shift();
    }
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getLocalResponse(input) {
    const normalized = input.toLowerCase().trim();
    const response = SIMPLE_LOCAL_RESPONSES[normalized];
    if (!response) {
      return null;
    }

    return {
      kind: "chat",
      message: response
    };
  }
}

export const geminiService = new GeminiService();
