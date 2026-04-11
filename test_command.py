from src.agents.orchestrator import orchestrator
import json

result = orchestrator.process('open vs')
print(json.dumps(result, indent=4))
