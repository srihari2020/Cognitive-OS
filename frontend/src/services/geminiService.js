/**
 * geminiService.js
 *
 * Central AI Brain for FRIDAY conversation and intent generation.
 */

const RETRY_DELAY_MS = 1000;
const MAX_503_ATTEMPTS = 2;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class GeminiService {
  constructor() {
    this.conversationHistory = [];
    this.MAX_HISTORY = 10;
    this.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  }

  getProviderConfig() {
    return {
      provider: localStorage.getItem("ai_provider") || "gemini",
      geminiKey: localStorage.getItem("gemini_key"),
      grokKey: localStorage.getItem("grok_key")
    };
  }

  async ask(input, context = {}, options = {}) {
    const { provider, geminiKey, grokKey } = this.getProviderConfig();

    if (provider === "gemini" && !geminiKey) {
      throw new Error("Invalid API key");
    }

    if (provider === "grok" && !grokKey) {
      throw new Error("Invalid API key");
    }

    const prompt = this.buildPrompt(input, context);

    if (provider === "gemini") {
      return this.callGemini(prompt, geminiKey, input, options);
    }

    try {
      return this.callGrok(prompt, grokKey, input);
    } catch (error) {
      throw new Error(error?.message || "Network error");
    }
  }

  buildPrompt(input, context) {
    const historyContext = this.conversationHistory.length > 0
      ? this.conversationHistory.map((item) => `User: ${item.user}\nAssistant: ${item.assistant}`).join("\n")
      : "No previous conversation";

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
- For open_app, supported targets include settings, chrome, edge, vscode, youtube, google, gmail, github, whatsapp, notepad, calculator, explorer
- For chatting, do not use JSON
- Do not use robotic phrases like "sir"

CONTEXT:
Active App: ${context.activeApp || "unknown"}
Time: ${new Date().toLocaleTimeString()}
Recent Conversation:
${historyContext}

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
}

export const geminiService = new GeminiService();
