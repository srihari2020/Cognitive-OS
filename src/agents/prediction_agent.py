from src.context_builder import context_builder
from src.prediction_engine import prediction_engine
from src.agents.contracts import AgentContext, AgentResult


class PredictionAgent:
    """Specialized agent for next-action prediction and hinting."""

    def __init__(self, predictor=None, context_source=None):
        self.predictor = predictor or prediction_engine
        self.context_source = context_source or context_builder

    def run(self, context: AgentContext) -> AgentResult:
        prediction_context = self.context_source.build_context()
        suggestions = self.predictor.predict_next(prediction_context)
        prediction_payload = {
            "context": prediction_context,
            "next_intents": suggestions,
        }
        context.prediction = prediction_payload
        return AgentResult(ok=True, payload=prediction_payload)
