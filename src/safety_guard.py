class SafetyGuard:
    def __init__(self):
        # List of allowed intents
        self.allowed_intents = ["OPEN_CODE", "OPEN_YOUTUBE", "GOOGLE_SEARCH", "TYPE_TEXT"]
        
        # Blocked patterns (dangerous words or symbols)
        self.blocked_patterns = [
            "rm -rf", "format c:", "del /f", "shutdown", "reboot", "sudo ", "mkfs",
            ">", "|", "&", ";", "`", "$", "\\" # Shell special characters
        ]

    def validate_intent(self, intent_obj):
        """
        Validates the detected intent and its entities for safety.
        Returns a structured safety response.
        """
        intent = intent_obj.get("intent")
        raw_input = intent_obj.get("raw_input", "")
        
        # 1. Check if intent is allowed
        if intent not in self.allowed_intents:
            if intent == "UNKNOWN":
                return {
                    "status": "BLOCKED",
                    "reason": "Unknown or vague intent detected. Please clarify your command."
                }
            return {
                "status": "BLOCKED",
                "reason": f"Action '{intent}' is not authorized by the current policy."
            }

        # 2. Check for risky patterns in raw input
        for pattern in self.blocked_patterns:
            if pattern in raw_input.lower():
                return {
                    "status": "BLOCKED",
                    "reason": f"Security violation: Input contains restricted pattern '{pattern}'."
                }
        
        # 3. Entity validation (additional check for arguments)
        entities = intent_obj.get("entities", {})
        for entity_value in entities.values():
            if isinstance(entity_value, str):
                for pattern in self.blocked_patterns:
                    if pattern in entity_value.lower():
                        return {
                            "status": "BLOCKED",
                            "reason": f"Security violation: Action argument contains restricted pattern '{pattern}'."
                        }

        # All checks passed
        return {
            "status": "ALLOWED",
            "reason": "Command validated against all safety rules."
        }

# Global instance
safety_guard = SafetyGuard()
