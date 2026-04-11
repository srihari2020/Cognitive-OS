from src.memory_manager import memory_manager
from src.agents.contracts import AgentContext, AgentResult


class MemoryAgent:
    """Specialized agent for persistence and interaction history."""

    def __init__(self, manager=None):
        self.manager = manager or memory_manager

    def run(self, context: AgentContext) -> AgentResult:
        # Load existing context for other agents to use
        context.memory = {
            "last_app": self.manager.get_last_app(),
            "last_search": self.manager.get_last_search(),
            "history": self.manager.get_recent(3)
        }
        
        # Only save if we have a detected intent (not during initial loading)
        if context.intent:
            self.manager.save_interaction(context.user_input, context.intent)
        
        memory_payload = {
            "recent": self.manager.get_recent(5),
            "last_app": context.memory["last_app"],
            "last_search": context.memory["last_search"]
        }
        return AgentResult(ok=True, payload=memory_payload)
