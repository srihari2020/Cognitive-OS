from src.interaction_analyzer import interaction_analyzer
from src.prediction_engine import prediction_engine
from src.suggestion_engine import suggestion_engine
from src.context_builder import context_builder
import time

class AnticipationEngine:
    def __init__(self):
        self.current_prediction = None
        self.last_update = time.time()
        self.anticipation_threshold = 0.7  # Score required to trigger pre-action hints

    def evaluate_anticipation(self):
        """
        Evaluate if we should trigger a pre-action hint.
        Returns a dict of action suggestions if anticipation is high.
        """
        now = time.time()
        if now - self.last_update < 0.5:  # Rate limit predictions to 2Hz
            return None
            
        self.last_update = now
        
        # 1. Get predicted next actions
        context = context_builder.build_context()
        predictions = prediction_engine.predict_next(context)
        
        if not predictions:
            return None
            
        # 2. Analyze user interaction
        # If the user is typing fast, don't distract with anticipation
        if interaction_analyzer.is_typing and interaction_analyzer.get_typing_pause_duration() < 0.3:
            return None
            
        # 3. Detect if user is "drifting" towards an action (e.g. idle or typing pause)
        # Higher score if idle or if they just finished typing
        typing_pause = interaction_analyzer.get_typing_pause_duration()
        drift_score = min(1.0, typing_pause / 2.0) if not interaction_analyzer.is_typing else 0.5
        
        # 4. Combine with prediction confidence (if we had it, for now use frequency-based)
        # Let's say we anticipate if they've been idle for > 1s or if they just paused typing
        if drift_score >= 0.5:
            # Generate suggestions
            suggestions = suggestion_engine.generate_suggestions(predictions)
            return {
                "suggestions": suggestions,
                "confidence": drift_score,
                "type": "TYPING_PAUSE" if interaction_analyzer.is_typing else "IDLE_PREDICTION"
            }
            
        return None

    def get_attention_level(self):
        """Return a string describing user attention state."""
        intensity = interaction_analyzer.update_interaction_intensity()
        if intensity > 0.8:
            return "HIGH_INTENSITY"
        elif intensity > 0.3:
            return "ACTIVE"
        else:
            return "IDLE"

anticipation_engine = AnticipationEngine()
