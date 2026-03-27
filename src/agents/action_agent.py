from src.action_engine import action_engine
from src.agents.contracts import AgentContext, AgentResult


class ActionAgent:
    """Specialized agent for action execution."""

    def __init__(self, engine=None):
        self.engine = engine or action_engine

    def run(self, context: AgentContext) -> AgentResult:
        action_result = self.engine.execute(context.intent)
        context.action = action_result
        return AgentResult(ok=True, payload=action_result)
