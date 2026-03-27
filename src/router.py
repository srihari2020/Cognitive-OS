from src.agents.orchestrator import orchestrator

class Router:
    def __init__(self):
        self.orchestrator = orchestrator

    def process_command(self, user_input):
        """
        Main decision loop for Cognitive OS.
        Delegates to multi-agent orchestrator.
        Returns a dictionary with the final result.
        """
        return self.orchestrator.process(user_input)

# Global instance
router = Router()
