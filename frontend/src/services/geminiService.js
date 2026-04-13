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

    if (provider === "gemini" && !geminiKey) {
      return { response: "Please connect your Gemini API key first, sir.", plan: [], thought: "No API key." };
    }
    if (provider === "grok" && !grokKey) {
      return { response: "Please connect your Grok API key first, sir.", plan: [], thought: "No API key." };
    }

    try {
      const systemPrompt = `You are FRIDAY — a highly intelligent, proactive, and calm AI assistant (Iron Man style). 
Your tone is conversational, sophisticated, and respectful (always address the user as "sir"). 

Your primary goal is to understand user intent and respond with a JSON object containing:
1. "intent": The primary action type (e.g., "open_app", "search", "ui_action", "tab_control", "file_action", "set_volume", "chat").
2. "app": The target application name (e.g., "chrome", "vscode", "youtube", "whatsapp").
3. "action": The specific action for ui_action, tab_control, file_action (e.g., "click", "new_tab", "extract").
4. "query": Optional search query or target parameter.
5. "response": A natural, human-like verbal response for the user.
6. "thought": A brief internal monologue about your decision.

ALLOWED INTENTS:
- open_app: To launch a specific application.
- search: To perform a web search on Google or YouTube.
- ui_action: For mouse/scroll actions (action: click | scroll_down | scroll_up).
- tab_control: For browser tab management (action: new_tab | switch_tab | close_tab).
- file_action: For file operations (action: extract | zip).
- set_volume: To adjust system volume.
- chat: For general conversation when no specific system action is required.

EXAMPLE:
User: "Open Chrome and search for AI tools"
Response: {
  "intent": "search",
  "app": "chrome",
  "query": "AI tools",
  "response": "Certainly, sir. Opening Chrome and searching for the latest AI tools for you.",
  "thought": "User wants to research AI tools. I'll launch the browser and perform the search directly."
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
      console.error("AI Error:", error);
      return {
        intent: "chat",
        response: "I'm having trouble connecting to AI, but I can still execute system commands, sir.",
        plan: [],
        thought: "API call failed: " + error.message
      };
    }
  }

  async callGemini(prompt, key, input) {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: prompt }] }
        ]
      })
    });

    if (!res.ok) {
      if (res.status === 404) {
        // Fallback for 404
        return this.fallbackResponse(input);
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gemini HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log("Gemini response:", data);

    if (data.error) throw new Error(data.error.message);

    if (!data.candidates || data.candidates.length === 0) {
      return this.fallbackResponse(input);
    }

    const rawText = data.candidates[0].content.parts[0].text;
    if (!rawText) return this.fallbackResponse(input);

    return this.parseResponse(rawText, input);
  }

  fallbackResponse(input) {
    const defaultApps = ['chrome', 'vscode', 'youtube', 'whatsapp', 'notepad'];
    let targetApp = null;
    let intent = "chat";
    let intentAction = null;
    
    // detect open app intent
    if (input.toLowerCase().includes('open ') || input.toLowerCase().includes('launch ')) {
        intent = "open_app";
        for (const app of defaultApps) {
            if (input.toLowerCase().includes(app)) {
                targetApp = app;
                break;
            }
        }
    }

    const fallbackResult = {
        intent: intent,
        app: targetApp,
        action: intentAction,
        response: targetApp ? `Opening ${targetApp} right away, sir.` : "I am having trouble processing that right now, sir.",
        thought: "API failed. Used fallback logic."
    };
    
    // Update history
    this.history.push({ user: input, ai: fallbackResult.response, intent: fallbackResult.intent });
    if (this.history.length > this.MAX_HISTORY) this.history.shift();

    return fallbackResult;
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

