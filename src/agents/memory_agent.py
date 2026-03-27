from src.memory_manager import memory_manager
from src.agents.contracts import AgentContext, AgentResult


class MemoryAgent:
    """Specialized agent for persistence and interaction history."""

    def __init__(self, manager=None):
        self.manager = manager or memory_manager

    def run(self, context: AgentContext) -> AgentResult:
        self.manager.save_interaction(context.user_input, context.intent)
        recent = self.manager.get_recent(5)
        history_count = len(self.manager.get_history())
        memory_payload = {"recent": recent, "history_count": history_count}
        context.memory = memory_payload
        return AgentResult(ok=True, payload=memory_payload)
