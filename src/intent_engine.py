import re
import json
from src.smart_router import smart_router
from src.logger import logger
from src.memory_manager import memory_manager
from src.provider_manager import provider_manager

class IntentEngine:
    def __init__(self):
        self.smart_router = smart_router
        self.patterns = {
            "OPEN_CODE": [r"open (?:vs\s?code|code|visual studio code)", r"launch code"],
            "OPEN_YOUTUBE": [r"open youtube", r"go to youtube", r"launch youtube"],
            "GOOGLE_SEARCH": [r"search (?:for )?(.+)", r"google (.+)", r"look up (.+)"],
            "TYPE_TEXT": [r"type (?:text )?\"(.+)\"", r"write \"(.+)\"", r"enter \"(.+)\""],
            "SYSTEM_INFO": [r"system info", r"check system", r"show system info", r"system status"],
            "OPEN_FILES": [r"open files", r"open explorer", r"show files", r"open documents"],
            "OPEN_DOWNLOADS": [r"open downloads", r"show downloads"]
        }
        self.context_patterns = {
            "OPEN_IT": [r"open it", r"open again", r"launch it", r"run it"],
            "SEARCH_MORE": [r"search more", r"google more", r"look up more"]
        }

    def detect_intent_simple(self, text):
        """FRIDAY-style simple intent detection with smart aliases."""
        text = text.lower().strip()
        
        # Smart Intent Aliases
        intents_map = {
            "play music": "spotify",
            "music": "spotify",
            "code something": "vscode",
            "code": "vscode",
            "browse internet": "chrome",
            "browse": "chrome",
            "internet": "chrome",
            "search": "google search",
            "calculate": "calculator",
            "write": "notepad",
            "notes": "notepad",
        }
        
        if text in intents_map:
            return "OPEN_APP", intents_map[text]

        if any(re.fullmatch(p, text) for p in self.context_patterns["OPEN_IT"]):
            return "OPEN_IT", None
        if any(re.fullmatch(p, text) for p in self.context_patterns["SEARCH_MORE"]):
            return "SEARCH_MORE", None
        if "open" in text or "launch" in text or "run" in text:
            return "OPEN_APP", self.extract_target(text)
        if "search" in text or "google" in text or "look up" in text:
            return "GOOGLE_SEARCH", self.extract_target(text)
        return "UNKNOWN", None

    def extract_target(self, text):
        """Extracts the core target from the command."""
        text = text.lower()
        # Remove common verbs and polite words
        for word in ["open", "launch", "run", "please", "can you", "search for", "search", "google", "look up"]:
            text = text.replace(word, "")
        return text.strip()

    def detect_intent(self, user_input):
        """
        Detects intent with context awareness, simple logic, and AI fallback.
        """
        user_input_lower = user_input.lower().strip()

        # 1) Handle context follow-ups and smart intents first
        intent, target = self.detect_intent_simple(user_input_lower)
        
        if intent == "OPEN_IT":
            last_app = memory_manager.get_last_app()
            if last_app:
                return {
                    "intent": "OPEN_APP",
                    "entities": {"app_name": last_app},
                    "confidence": 1.0,
                    "raw_input": user_input
                }
        elif intent == "SEARCH_MORE":
            last_search = memory_manager.get_last_search()
            if last_search:
                return {
                    "intent": "GOOGLE_SEARCH",
                    "entities": {"query": last_search},
                    "confidence": 1.0,
                    "raw_input": user_input
                }
        elif intent == "OPEN_APP":
            return {
                "intent": "OPEN_APP",
                "entities": {"app_name": target},
                "confidence": 0.9,
                "raw_input": user_input
            }
        elif intent == "GOOGLE_SEARCH":
            return {
                "intent": "GOOGLE_SEARCH",
                "entities": {"query": target},
                "confidence": 0.9,
                "raw_input": user_input
            }

        # 2) AI Fallback for structured action intent
        active_provider = provider_manager.get_active_provider()
        if active_provider:
            prompt = f"""
            Interpret the following user command for a futuristic AI assistant (FRIDAY).
            Command: "{user_input}"
            
            Return ONLY a valid JSON object with the following structure:
            {{
                "intent": "STRUCTURED_ACTION",
                "action": {{
                    "type": "open_app" | "web_task" | "system_control" | "chat",
                    "target": "app name" | "url" | "query",
                    "params": {{ ... additional parameters ... }}
                }},
                "response": "A short, calm, FRIDAY-style verbal response (e.g., 'On it.', 'Opening that now.')"
            }}
            """
            try:
                ai_response = active_provider.generate_intent(user_input, context={"system_prompt": prompt})
                if isinstance(ai_response, str):
                    cleaned = ai_response.strip().replace("```json", "").replace("```", "")
                    return json.loads(cleaned)
                return ai_response
            except Exception as e:
                logger.log_error(f"AI Intent Error: {str(e)}")

        return {
            "intent": "UNKNOWN",
            "entities": {},
            "confidence": 0.0,
            "raw_input": user_input
        }
