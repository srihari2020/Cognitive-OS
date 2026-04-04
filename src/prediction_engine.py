from collections import Counter
import datetime
from src.memory_manager import memory_manager

class PredictionEngine:
    def __init__(self):
        self.memory_manager = memory_manager

    def predict_next(self, context):
        """Predicts the next likely intents based on historical data and context."""
        history = self.memory_manager.get_history()
        if not history:
            return []

        # Simple frequency-based prediction
        intents = [interaction['intent'] for interaction in history if interaction['intent'] != 'UNKNOWN']
        intent_counts = Counter(intents)
        
        # Get the top 3 most frequent intents
        predictions = [intent for intent, count in intent_counts.most_common(3)]

        # Add time-based prediction (e.g., if it's morning, suggest opening code)
        now = datetime.datetime.now()
        if 8 <= now.hour < 12 and 'OPEN_CODE' not in predictions:
            predictions.insert(0, 'OPEN_CODE')

        return predictions[:3] # Return top 3 predictions

    def predict_next_from_history(self, frontend_history):
        """More advanced prediction based on frontend action history."""
        if not frontend_history:
            return []

        predictions = []
        recent_actions = [a['raw'].lower() for a in frontend_history[:5]]
        
        # Simple rule-based prediction from frontend history
        if any("code" in a for a in recent_actions):
            predictions.append({"text": "Continue coding?", "intent": "OPEN_CODE", "icon": "Code"})
        
        if any("search" in a for a in recent_actions):
            predictions.append({"text": "Refine search?", "intent": "GOOGLE_SEARCH", "icon": "Search"})

        if any("youtube" in a for a in recent_actions):
             predictions.append({"text": "More videos?", "intent": "OPEN_YOUTUBE", "icon": "Zap"})

        # Fallback to local memory if no frontend pattern found
        if not predictions:
            local_intents = self.predict_next({})
            for intent in local_intents:
                predictions.append({"text": f"Suggested: {intent.replace('_', ' ').capitalize()}", "intent": intent, "icon": "Sparkles"})

        return predictions[:3]

# Global instance
prediction_engine = PredictionEngine()
