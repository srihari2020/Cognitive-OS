/**
 * geminiService.js
 * 
 * Central AI Brain for FRIDAY.
 * Supports Gemini and Grok (X.AI) dynamically.
 */

import memoryStore from "./memoryStore";

class GeminiService {
  constructor() {
    this.history = [];
    this.MAX_HISTORY = 10;
  }

  getProviderConfig() {
    return {
      provider: localStorage.getItem("ai_provider") || "gemini",
      geminiKey: localStorage.getItem("gemini_key"),
      grokKey: localStorage.getItem("grok_key")
    };
  }

  async ask(input, context = {}) {
    const { provider, geminiKey, grokKey } = this.getProviderConfig();

    // No key = silent fallback, no error shown
    if (provider === "gemini" && !geminiKey) return null;
    if (provider === "grok" && !grokKey) return null;

    try {
      const systemPrompt = `You are FRIDAY — a highly intelligent, proactive, and calm AI assistant (Iron Man style). 
Your tone is conversational, sophisticated, and respectful (always address the user as "sir"). 

Your primary goal is to understand user intent and respond with a JSON object containing:
1. "intent": The primary action type (e.g., "open_app", "search", "multi_step", "ui_action", "tab_control", "file_action", "set_volume", "chat").
2. "app": The target application name (e.g., "chrome", "vscode", "youtube", "whatsapp", "settings").
3. "action": The specific action for ui_action, tab_control, file_action (e.g., "click", "new_tab", "extract").
4. "query": Optional search query or target parameter.
5. "response": A natural, human-like verbal response for the user (be conversational, not robotic).
6. "thought": A brief internal monologue about your decision.

ALLOWED INTENTS:
- open_app: To launch a specific application or website.
- search: To perform a web search on Google or YouTube.
- multi_step: For commands with multiple actions (e.g., "open chrome and search for AI").
- ui_action: For mouse/scroll actions (action: click | scroll_down | scroll_up).
- tab_control: For browser tab management (action: new_tab | switch_tab | close_tab).
- file_action: For file operations (action: extract | zip).
- set_volume: To adjust system volume.
- chat: For general conversation when no specific system action is required.

MULTI-STEP COMMANDS:
If the user says "X and Y", set intent to "multi_step" and include BOTH actions in your response.
Example: "open edge and search for gemini"
{
  "intent": "multi_step",
  "steps": [
    { "intent": "open_app", "app": "edge" },
    { "intent": "search", "query": "gemini" }
  ],
  "response": "Opening Edge and searching for Gemini, sir.",
  "thought": "User wants to open browser then search"
}

SINGLE ACTION EXAMPLE:
User: "Open Chrome"
Response: {
  "intent": "open_app",
  "app": "chrome",
  "response": "Opening Chrome for you, sir.",
  "thought": "User wants to launch Chrome browser"
}

SEARCH EXAMPLE:
User: "Search for AI tools"
Response: {
  "intent": "search",
  "query": "AI tools",
  "response": "Searching for AI tools, sir.",
  "thought": "User wants to search Google"
}

ONLY return the JSON object. Do not include any other text.

CONTEXT:
Active App: ${context.activeApp || 'unknown'}
Time: ${new Date().toLocaleTimeString()}
Conversation History: ${JSON.stringify(memoryStore.getConversationHistory())}

User input: "${input}"`;

      if (provider === "gemini") {
        return this.callGemini(systemPrompt, geminiKey, input);
      } else {
        return this.callGrok(systemPrompt, grokKey, input);
      }

    } catch (error) {
      console.log("Gemini failed silently:", error.message);
      return null; // Return null — caller handles fallback
    }
  }

  async callGemini(prompt, key, input) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      });
    } catch (networkErr) {
      console.log("Gemini network error (silent):", networkErr.message);
      return null;
    }

    if (!res.ok) {
      console.log("Gemini HTTP error (silent):", res.status);
      return null;
    }

    const data = await res.json();
    console.log("Gemini response:", data);

    if (data.error) {
      console.log("Gemini API error (silent):", data.error.message);
      return null;
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.log("Gemini empty response (silent)");
      return null;
    }

    try {
      return this.parseResponse(rawText, input);
    } catch (parseErr) {
      console.log("Gemini parse error (silent):", parseErr.message);
      return null;
    }
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
          { role: "system", content: "You are FRIDAY. Respond in JSON only." },
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
    // Strip markdown fences and extract the first JSON object
    let jsonStr = rawText.replace(/```json|```/g, "").trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in Gemini response.");
    jsonStr = jsonMatch[0];

    const result = JSON.parse(jsonStr);

    // Update history
    this.history.push({ user: input, ai: result.response, intent: result.intent });
    if (this.history.length > this.MAX_HISTORY) this.history.shift();

    return result;
  }
}

export const geminiService = new GeminiService();

