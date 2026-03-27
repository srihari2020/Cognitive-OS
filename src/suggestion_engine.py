class SuggestionEngine:
    def __init__(self):
        self.suggestion_templates = {
            "OPEN_CODE": "Open VS Code to start working?",
            "OPEN_YOUTUBE": "Open YouTube?",
            "GOOGLE_SEARCH": "Search for something on Google?",
            "TYPE_TEXT": "Type some text?"
        }

    def generate_suggestions(self, predicted_intents):
        """Converts a list of predicted intents into user-friendly suggestions."""
        suggestions = []
        for intent in predicted_intents:
            if intent in self.suggestion_templates:
                suggestions.append({
                    'text': self.suggestion_templates[intent],
                    'intent': intent
                })
        return suggestions

# Global instance
suggestion_engine = SuggestionEngine()
