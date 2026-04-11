class SafetyGuard:
    def __init__(self):
        # List of dangerous keywords that should be blocked
        self.blocked_keywords = ["rm", "del", "format", "shutdown", "reboot", "mkfs"]
        
        # Shell special characters that might indicate command injection
        self.dangerous_chars = [">", "|", "&", ";", "`", "$"]

    def validate_intent(self, intent_obj):
        """
        Validates the intent for safety. 
        Only blocks truly dangerous commands.
        """
        intent = intent_obj.get("intent", "UNKNOWN")
        raw_input = intent_obj.get("raw_input", "").lower()
        entities = intent_obj.get("entities", {})
        
        # 1. Check raw input for dangerous keywords
        # We split by spaces to avoid blocking words like "deliver" or "format" in a sentence
        words = raw_input.replace("/", " ").replace("\\", " ").split()
        for word in words:
            if word in self.blocked_keywords:
                return {
                    "status": "BLOCKED",
                    "reason": f"Security violation: Command contains restricted keyword '{word}'."
                }

        # 2. Check for dangerous shell characters
        for char in self.dangerous_chars:
            if char in raw_input:
                return {
                    "status": "BLOCKED",
                    "reason": f"Security violation: Command contains restricted character '{char}'."
                }
        
        # 3. Check entities for the same risks
        for entity_value in entities.values():
            if isinstance(entity_value, str):
                entity_lower = entity_value.lower()
                entity_words = entity_lower.replace("/", " ").replace("\\", " ").split()
                for word in entity_words:
                    if word in self.blocked_keywords:
                        return {
                            "status": "BLOCKED",
                            "reason": f"Security violation: Argument contains restricted keyword '{word}'."
                        }
                for char in self.dangerous_chars:
                    if char in entity_lower:
                        return {
                            "status": "BLOCKED",
                            "reason": f"Security violation: Argument contains restricted character '{char}'."
                        }

        # All checks passed or intent is harmless (like OPEN_APP)
        return {
            "status": "ALLOWED",
            "reason": "Command validated."
        }

# Global instance
safety_guard = SafetyGuard()
