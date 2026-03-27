from src.intent_engine import intent_engine
from src.agents.contracts import AgentContext, AgentResult


class IntentAgent:
    """Specialized agent for intent understanding."""

    def __init__(self, engine=None):
        self.engine = engine or intent_engine

    def run(self, context: AgentContext) -> AgentResult:
        intent_obj = self.engine.detect_intent(context.user_input)
        context.intent = intent_obj
        return AgentResult(ok=True, payload=intent_obj)
