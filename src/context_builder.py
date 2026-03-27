import datetime
from src.memory_manager import memory_manager
from src.user_profile import user_profile

class ContextBuilder:
    def __init__(self):
        self.memory_manager = memory_manager
        self.user_profile = user_profile

    def build_context(self):
        """Generates a context object combining recent history and user profile."""
        recent_history = self.memory_manager.get_recent(5)
        profile = self.user_profile.build_profile()
        
        # Format recent actions for the LLM prompt
        recent_actions_summary = [
            f"Command: '{item.get('command')}' -> Intent: {item.get('intent')}"
            for item in recent_history
        ]

        context = {
            "recent_actions": recent_actions_summary,
            "frequent_intents": profile.get("most_used_intents", []),
            "frequent_entities": profile.get("frequent_entities", {}),
            "time_context": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        return context

# Global instance
context_builder = ContextBuilder()
