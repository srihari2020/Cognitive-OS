import re
from src.smart_router import smart_router
from src.logger import logger

class IntentEngine:
    def __init__(self):
        self.smart_router = smart_router
        self.patterns = {
            "OPEN_CODE": [r"open (?:vs\s?code|code|visual studio code)", r"launch code"],
            "OPEN_YOUTUBE": [r"open youtube", r"go to youtube", r"launch youtube"],
            "GOOGLE_SEARCH": [r"search (?:for )?(.+)", r"google (.+)", r"look up (.+)"],
            "TYPE_TEXT": [r"type (?:text )?\"(.+)\"", r"write \"(.+)\"", r"enter \"(.+)\""]
        }

    def detect_intent(self, user_input):
        """
        Detects intent using the smart router, with a rule-based fallback.
        """
        # The smart router handles caching, complexity analysis, and provider selection
        intent_data = self.smart_router.get_intent(user_input)
        
        if intent_data:
            logger.log_event("SMART_ROUTER_SUCCESS", f"Data: {intent_data}")
            return {
                "intent": intent_data.get("intent", "UNKNOWN"),
                "confidence": intent_data.get("confidence", 0.0),
                "entities": intent_data.get("entities", {}),
                "raw_input": user_input
            }
        
        logger.log_event("SMART_ROUTER_FAIL", "Falling back to rule-based detection.")
        return self.detect_intent_rule_based(user_input)

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
