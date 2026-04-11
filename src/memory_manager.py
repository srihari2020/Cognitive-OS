import json
import os
import datetime
from src.logger import logger

class MemoryManager:
    def __init__(self, memory_file='memory.json'):
        self.memory_file = memory_file
        self.max_history = 5

    def _load_memory(self):
        """Loads memory from file or returns defaults."""
        if not os.path.exists(self.memory_file):
            return {"history": [], "last_apps": [], "last_search_query": ""}
        
        try:
            with open(self.memory_file, 'r') as f:
                data = json.load(f)
                # Handle migration from list to dict if needed
                if isinstance(data, list):
                    return {"history": data[-self.max_history:], "last_apps": [], "last_search_query": ""}
                return data
        except (json.JSONDecodeError, IOError) as e:
            logger.log_error(f"Failed to load memory: {e}")
            return {"history": [], "last_apps": [], "last_search_query": ""}

    def _save_memory(self, data):
        """Saves memory data to file."""
        try:
            with open(self.memory_file, 'w') as f:
                json.dump(data, f, indent=4)
        except IOError as e:
            logger.log_error(f"Failed to save memory: {e}")

    def save_interaction(self, command, intent_obj):
        """Saves a user interaction and updates last apps/searches."""
        memory = self._load_memory()
        
        interaction = {
            'timestamp': datetime.datetime.now().isoformat(),
            'command': command,
            'intent': intent_obj.get('intent', 'UNKNOWN'),
            'entities': intent_obj.get('entities', {})
        }
        
        # Update history
        memory['history'].append(interaction)
        memory['history'] = memory['history'][-self.max_history:]
        
        # Update last apps
        intent = intent_obj.get('intent')
        entities = intent_obj.get('entities', {})
        if intent == "OPEN_APP":
            app_name = entities.get('app_name')
            if app_name:
                memory['last_apps'].append(app_name)
                memory['last_apps'] = memory['last_apps'][-5:]
        elif intent == "OPEN_CODE":
            memory['last_apps'].append("vscode")
            memory['last_apps'] = memory['last_apps'][-5:]
        
        # Update last search
        if intent == "GOOGLE_SEARCH":
            query = entities.get('query')
            if query:
                memory['last_search_query'] = query

        self._save_memory(memory)
        logger.log_event("MEMORY_SAVE", f"Updated memory for: {command}")

    def get_history(self):
        """Retrieves history."""
        return self._load_memory().get('history', [])

    def get_last_app(self):
        """Returns the last opened app."""
        last_apps = self._load_memory().get('last_apps', [])
        return last_apps[-1] if last_apps else None

    def get_last_search(self):
        """Returns the last search query."""
        return self._load_memory().get('last_search_query')

    def get_recent(self, n=5):
        """Retrieves the N most recent interactions."""
        return self.get_history()[-n:]

# Global instance
memory_manager = MemoryManager()
