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

    const systemPrompt = this.buildSystemPrompt(input, context);

    if (provider === "gemini") {
      return this.callGemini(systemPrompt, geminiKey, input, options);
    }

    try {
      return this.callGrok(systemPrompt, grokKey, input);
    } catch (error) {
      throw new Error(error?.message || "Network error");
    }
  }

  buildSystemPrompt(input, context) {
    const historyContext = this.conversationHistory.length > 0
      ? this.conversationHistory.map((item) => `User: ${item.user}\nAssistant: ${item.assistant}`).join("\n")
      : "No previous conversation";

    return `You are a modern AI assistant for a desktop environment.

STYLE:
- Sound natural, modern, and human
- Keep replies short unless the user asks for more detail
- Do not use robotic honorifics or stiff phrasing
- Do not invent fallback replies

TASK:
Understand the user's request and return valid JSON with:
1. "message": the assistant's natural reply
2. "actions": an array of actions to execute, if any

ACTION TYPES:
- { "type": "open_app", "target": "chrome" }
- { "type": "search", "query": "AI tools", "provider": "google" }
- { "type": "ui_action", "action": "click" }
- { "type": "tab_control", "action": "new_tab" }
- { "type": "file_action", "action": "extract", "target": "file.zip" }
- { "type": "set_volume", "level": 50 }

RULES:
1. Return only valid JSON
2. Keep "message" concise and human-like
3. Use an empty actions array for pure conversation
4. Do not use phrases like "sir"
5. Do not include extra commentary outside the JSON

CONTEXT:
Active App: ${context.activeApp || "unknown"}
Time: ${new Date().toLocaleTimeString()}
Recent Conversation:
${historyContext}

User request: "${input}"`;
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

      try {
        return this.parseResponse(text, input);
      } catch {
        throw new Error("Gemini failed");
      }
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
          { role: "system", content: "Return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const rawText = data.choices[0].message.content;
    return this.parseResponse(rawText, input);
  }

  parseResponse(rawText, input) {
    let jsonStr = rawText.replace(/```json|```/g, "").trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in AI response.");
    jsonStr = jsonMatch[0];

    const result = JSON.parse(jsonStr);

    if (!result.message) {
      throw new Error("AI response missing 'message' field");
    }

    if (!result.actions) {
      result.actions = [];
    }

    this.conversationHistory.push({
      user: input,
      assistant: result.message
    });

    if (this.conversationHistory.length > this.MAX_HISTORY) {
      this.conversationHistory.shift();
    }

    return result;
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}

export const geminiService = new GeminiService();
