from collections import Counter
from src.memory_manager import memory_manager
from src.logger import logger

class UserProfile:
    def __init__(self):
        self.memory_manager = memory_manager

    def build_profile(self):
        """Builds a user profile based on interaction history."""
        history = self.memory_manager.get_history()
        
        if not history:
            return {
                "most_used_intents": [],
                "frequent_entities": {},
                "total_interactions": 0
            }

        intents = [interaction.get('intent') for interaction in history if interaction.get('intent') != 'UNKNOWN']
        intent_counts = Counter(intents)
        
        # Extract entities for frequent actions (e.g., common search terms)
        entities_list = []
        for interaction in history:
            entities = interaction.get('entities', {})
            for key, value in entities.items():
                if isinstance(value, str):
                    entities_list.append(f"{key}:{value.lower()}")
        
        entity_counts = Counter(entities_list)

        profile = {
            "most_used_intents": [intent for intent, count in intent_counts.most_common(3)],
            "frequent_entities": dict(entity_counts.most_common(5)),
            "total_interactions": len(history)
        }
        
        logger.log_event("PROFILE_BUILD", f"Profile updated. Total interactions: {profile['total_interactions']}")
        return profile

# Global instance
user_profile = UserProfile()
