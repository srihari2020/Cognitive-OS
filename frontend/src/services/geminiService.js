/**
 * geminiService.js
 * 
 * Central AI Brain for FRIDAY.
 * Supports Gemini and Grok (X.AI) dynamically.
 */

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
3. "query": Optional search query or target parameter.
4. "response": A natural, human-like verbal response for the user.
5. "thought": A brief internal monologue about your decision.

ALLOWED INTENTS:
- open_app: To launch a specific application.
- search: To perform a web search on Google or YouTube.
- ui_action: For mouse/scroll actions (sub_action: click | scroll_down | scroll_up).
- tab_control: For browser tab management (sub_action: new_tab | switch_tab | close_tab).
- file_action: For file operations (sub_action: extract | zip).
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
Last Interactions: ${JSON.stringify(this.history.slice(-3))}

User input: "${input}"`;

      if (provider === "gemini") {
        return this.callGemini(systemPrompt, geminiKey, input);
      } else {
        return this.callGrok(systemPrompt, grokKey, input);
      }

    } catch (error) {
      console.error("AI Error:", error);
      return {
        response: "I'm having trouble reaching the AI service, sir. Please check your connection and API keys.",
        plan: null,
        thought: "API call failed."
      };
    }
  }

  async callGemini(prompt, key, input) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 1024,
          response_mime_type: "application/json"
        }
      })
    });

    const data = await res.json();
    console.log("FRIDAY: Gemini response:", data);

    if (data.error) throw new Error(data.error.message);

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("I couldn't process that request, sir.");
    }

    const rawText = data.candidates[0].content.parts[0].text;
    return this.parseResponse(rawText, input);
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
    const jsonStr = rawText.replace(/```json|```/g, "").trim();
    const result = JSON.parse(jsonStr);

    this.history.push({ input, response: result.response, intent: result.intent });
    if (this.history.length > this.MAX_HISTORY) this.history.shift();

    return result;
  }
}

export const geminiService = new GeminiService();

