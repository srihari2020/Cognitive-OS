import re
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
        """FRIDAY-style simple intent detection."""
        text = text.lower()
        if any(re.fullmatch(p, text) for p in self.context_patterns["OPEN_IT"]):
            return "OPEN_IT"
        if any(re.fullmatch(p, text) for p in self.context_patterns["SEARCH_MORE"]):
            return "SEARCH_MORE"
        if "open" in text or "launch" in text or "run" in text:
            return "OPEN_APP"
        if "search" in text or "google" in text or "look up" in text:
            return "GOOGLE_SEARCH"
        return "UNKNOWN"

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

        # 1) Handle context follow-ups first (FRIDAY style)
        intent = self.detect_intent_simple(user_input_lower)
        
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
            target = self.extract_target(user_input_lower)
            return {
                "intent": "OPEN_APP",
                "entities": {"app_name": target},
                "confidence": 0.9,
                "raw_input": user_input
            }
        elif intent == "GOOGLE_SEARCH":
            target = self.extract_target(user_input_lower)
            return {
                "intent": "GOOGLE_SEARCH",
                "entities": {"query": target},
                "confidence": 0.9,
                "raw_input": user_input
            }

        # 2) Try smart router for more complex stuff
        intent_data = self.smart_router.get_intent(user_input)
        if intent_data and intent_data.get("intent") != "UNKNOWN":
            logger.log_event("SMART_ROUTER_SUCCESS", f"Data: {intent_data}")
            return {
                "intent": intent_data.get("intent", "UNKNOWN"),
                "confidence": intent_data.get("confidence", 0.0),
                "entities": intent_data.get("entities", {}),
                "raw_input": user_input
            }
        
        # 3) Fallback to rule-based patterns
        rule_data = self.detect_intent_rule_based(user_input)
        if rule_data.get("intent") != "UNKNOWN":
            return rule_data

        # 4) AI Fallback with context
        logger.log_event("AI_FALLBACK", f"Engaging AI fallback for: {user_input}")
        active_provider = provider_manager.get_active_provider()
        if active_provider:
            history = memory_manager.get_recent(3)
            history_str = "\n".join([f"User: {h['command']} -> Intent: {h['intent']}" for h in history])
            context_prompt = f"Previous interactions:\n{history_str}\n\nCurrent Input: {user_input}\n\nAnalyze the intent and return JSON with 'intent' and 'entities'."
            ai_result = active_provider.generate_intent(context_prompt)
            if ai_result:
                return {
                    "intent": ai_result.get("intent", "UNKNOWN"),
                    "confidence": 0.7,
                    "entities": ai_result.get("entities", {}),
                    "raw_input": user_input
                }

        return rule_data

    def detect_intent_rule_based(self, user_input):
        """
        Legacy rule-based detection for fallback and low-complexity commands.
        """
        user_input_lower = user_input.lower().strip()
        
        for intent, patterns in self.patterns.items():
            for pattern in patterns:
                match = re.search(pattern, user_input_lower)
                if match:
                    entities = {}
                    if match.groups():
                        if intent == "GOOGLE_SEARCH":
                            entities["query"] = match.group(1)
                        elif intent == "TYPE_TEXT":
                            entities["text"] = match.group(1)
                    
                    return {
                        "intent": intent,
                        "confidence": 0.9, # High confidence for rule-based match
                        "entities": entities,
                        "raw_input": user_input
                    }
        
        return {
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "entities": {},
            "raw_input": user_input
        }

# Global instance
intent_engine = IntentEngine()
