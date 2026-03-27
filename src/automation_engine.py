from src.logger import logger

class AutomationEngine:
    def __init__(self, enabled=False):
        self.enabled = enabled
        self.safe_actions = ["OPEN_CODE", "OPEN_YOUTUBE"] # Actions safe for auto-execution

    def toggle_automation(self, enabled):
        self.enabled = enabled
        logger.log_event("AUTOMATION_TOGGLE", f"Automation enabled: {self.enabled}")

    def maybe_automate(self, suggestion):
        """Automatically executes a suggestion if automation is enabled and the action is safe."""
        if self.enabled and suggestion['intent'] in self.safe_actions:
            logger.log_event("AUTOMATION_EXECUTE", f"Automating suggestion: {suggestion['text']}")
            # In a real system, this would trigger the router to execute the action
            return True
        return False

# Global instance
automation_engine = AutomationEngine()
