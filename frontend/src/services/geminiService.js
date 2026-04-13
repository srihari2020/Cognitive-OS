/**
 * geminiService.js
 * 
 * Powered by Gemini-Pro.
 * The central brain for FRIDAY's decision making.
 */

const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // Placeholder for user to fill
const GEMINI_MODEL = "gemini-pro";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

class GeminiService {
  constructor() {
    this.history = [];
    this.MAX_HISTORY = 10;
  }

  async ask(input, context = {}) {
    try {
      const systemPrompt = `You are FRIDAY — a highly intelligent, proactive, and calm AI assistant (Iron Man style). 
Your tone is conversational, sophisticated, and respectful (always address the user as "sir"). 

Your primary goal is to understand user intent and respond with a JSON object containing:
1. "response": A natural, human-like verbal response.
2. "plan": An array of action steps if a task is required.
3. "thought": A brief internal monologue about your decision.

AVAILABLE ACTIONS:
- { "action": "open_app", "target": "app_name" }
- { "action": "ui_action", "sub_action": "click | scroll_down | scroll_up" }
- { "action": "tab_control", "sub_action": "new_tab | switch_tab | close_tab" }
- { "action": "file_action", "sub_action": "extract | zip", "target": "path" }
- { "action": "search_web", "query": "search term", "provider": "google | youtube" }
- { "action": "set_volume", "target": 50 }

EXAMPLE:
User: "Open Chrome and search for AI tools"
Response: {
  "response": "Certainly, sir. Opening Chrome and searching for the latest AI tools for you.",
  "plan": [
    { "action": "open_app", "target": "chrome" },
    { "action": "search_web", "query": "latest AI tools", "provider": "google" }
  ],
  "thought": "User wants to research AI tools. I'll launch the browser and perform the search directly."
}

CONTEXT:
Active App: ${context.activeApp || 'unknown'}
Time: ${new Date().toLocaleTimeString()}
Last Interactions: ${JSON.stringify(this.history.slice(-3))}

User input: "${input}"`;

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const rawText = data.candidates[0].content.parts[0].text;
      
      // Clean up JSON if Gemini wraps it in code blocks
      const jsonStr = rawText.replace(/```json|```/g, "").trim();
      const result = JSON.parse(jsonStr);

      // Update history
      this.history.push({ input, response: result.response, plan: result.plan });
      if (this.history.length > this.MAX_HISTORY) this.history.shift();

      return result;

    } catch (error) {
      console.error("Gemini Error:", error);
      return {
        response: "I'm having trouble connecting to my central processing unit, sir. I'll try my best with my local systems.",
        plan: null,
        thought: "API call failed. Falling back to local intent parsing."
      };
    }
  }
}

export const geminiService = new GeminiService();
