from src.agents.contracts import AgentContext
from src.agents.intent_agent import IntentAgent
from src.agents.memory_agent import MemoryAgent
from src.agents.prediction_agent import PredictionAgent
from src.agents.action_agent import ActionAgent
from src.safety_guard import safety_guard
from src.logger import logger


class MultiAgentOrchestrator:
    """
    Orchestrates independent specialized agents using shared structured context.

    Flow:
      User Input -> Intent Agent -> Memory + Prediction Agents -> Action Agent
    """

    def __init__(
        self,
        intent_agent=None,
        memory_agent=None,
        prediction_agent=None,
        action_agent=None,
        guard=None,
    ):
        self.intent_agent = intent_agent or IntentAgent()
        self.memory_agent = memory_agent or MemoryAgent()
        self.prediction_agent = prediction_agent or PredictionAgent()
        self.action_agent = action_agent or ActionAgent()
        self.guard = guard or safety_guard

    def process(self, user_input: str) -> dict:
        context = AgentContext(user_input=user_input)
        logger.log_input(user_input)

        # 1) Intent Agent
        intent_result = self.intent_agent.run(context)
        logger.log_intent(intent_result.payload)

        # 2) Safety Gate (between understanding and execution)
        safety_status = self.guard.validate_intent(context.intent)
        context.safety = safety_status
        logger.log_safety(safety_status)

        # 3) Memory + Prediction Agents (independent, structured outputs)
        memory_result = self.memory_agent.run(context)
        prediction_result = self.prediction_agent.run(context)

        if safety_status.get("status") != "ALLOWED":
            blocked_action = {
                "status": "SKIPPED",
                "message": "Safety block prevented execution.",
            }
            context.action = blocked_action
            return {
                "user_input": user_input,
                "intent": context.intent.get("intent"),
                "safety": safety_status,
                "action": blocked_action,
                "agent_trace": {
                    "intent": intent_result.payload,
                    "memory": memory_result.payload,
                    "prediction": prediction_result.payload,
                },
            }

        # 4) Action Agent
        action_result = self.action_agent.run(context)
        logger.log_action(action_result.payload)

        return {
            "user_input": user_input,
            "intent": context.intent.get("intent"),
            "safety": safety_status,
            "action": action_result.payload,
            "agent_trace": {
                "intent": intent_result.payload,
                "memory": memory_result.payload,
                "prediction": prediction_result.payload,
            },
        }


orchestrator = MultiAgentOrchestrator()
