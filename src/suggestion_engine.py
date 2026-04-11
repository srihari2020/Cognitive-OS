from difflib import SequenceMatcher
from src.app_registry import app_registry
from src.memory_manager import memory_manager

class SuggestionEngine:
    def __init__(self):
        self.suggestion_templates = {
            "OPEN_CODE": "Open VS Code to start working?",
            "OPEN_YOUTUBE": "Open YouTube?",
            "GOOGLE_SEARCH": "Search for something on Google?",
            "TYPE_TEXT": "Type some text?"
        }
        self.intents = {
            "play music": "spotify",
            "music": "spotify",
            "code something": "visual studio code",
            "code": "visual studio code",
            "browse internet": "chrome",
            "browse": "chrome",
            "internet": "chrome",
            "search": "google search",
            "calculate": "calculator",
            "write": "notepad",
            "notes": "notepad",
        }

    def _similarity(self, a, b):
        """Calculates similarity ratio between two strings."""
        return SequenceMatcher(None, a.lower(), b.lower()).ratio()

    def suggest_apps(self, query):
        """
        Smart app suggestions with fuzzy matching and memory-based ranking.
        """
        if not query or len(query) < 1:
            return []

        query_lower = query.lower().strip()
        results = []
        
        # 1. Check Intent-based aliases first
        for intent_phrase, app_alias in self.intents.items():
            if query_lower in intent_phrase or intent_phrase in query_lower:
                target, display = app_registry.resolve(app_alias)
                if display:
                    # High priority for intent matches
                    results.append({"name": display, "score": 1.0, "type": "intent"})

        # 2. Fuzzy match against registry
        memory_freq = memory_manager.get_frequency()
        
        for norm_name, display_name in app_registry.display_names.items():
            # Check against display name and normalized name
            score_display = self._similarity(query_lower, display_name)
            score_norm = self._similarity(query_lower, norm_name)
            score = max(score_display, score_norm)
            
            # Boost score based on memory frequency
            freq = memory_freq.get(display_name.lower(), 0)
            score += min(freq * 0.05, 0.3) # Max boost of 0.3
            
            if score > 0.4:
                # Avoid duplicates from intent matching
                if not any(r["name"] == display_name for r in results):
                    results.append({"name": display_name, "score": score, "type": "app"})

        # Sort by score and return top 5
        results.sort(key=lambda x: x["score"], reverse=True)
        
        # Return unique names
        seen = set()
        final_suggestions = []
        for r in results:
            if r["name"] not in seen:
                final_suggestions.append(r["name"])
                seen.add(r["name"])
                if len(final_suggestions) >= 5:
                    break
                    
        return final_suggestions

    def generate_suggestions(self, predicted_intents):
        """Legacy support for proactive suggestions."""
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
