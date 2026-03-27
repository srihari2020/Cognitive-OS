import json
import os
import datetime
from src.logger import logger

class MemoryManager:
    def __init__(self, memory_file='memory.json'):
        self.memory_file = memory_file

    def save_interaction(self, command, intent_obj):
        """Saves a user interaction to the memory file."""
        interaction = {
            'timestamp': datetime.datetime.now().isoformat(),
            'command': command,
            'intent': intent_obj.get('intent', 'UNKNOWN'),
            'entities': intent_obj.get('entities', {})
        }
        
        history = self.get_history()
        history.append(interaction)
        
        try:
            with open(self.memory_file, 'w') as f:
                json.dump(history, f, indent=4)
            logger.log_event("MEMORY_SAVE", f"Saved interaction: {command}")
        except IOError as e:
            logger.log_error(f"Failed to save memory: {e}")

    def get_history(self):
        """Retrieves the full interaction history from the memory file."""
        if not os.path.exists(self.memory_file):
            return []
        
        try:
            with open(self.memory_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.log_error(f"Failed to load memory: {e}")
            return []

    def get_recent(self, n=10):
        """Retrieves the N most recent interactions."""
        history = self.get_history()
        return history[-n:]

# Global instance
memory_manager = MemoryManager()
