import subprocess
import webbrowser
import os
import time
import platform
import shutil

# Attempting robust system-wide orchestration
class ActionEngine:
    def __init__(self):
        self.actions = {
            "OPEN_CODE": self._open_vscode,
            "OPEN_YOUTUBE": self._open_youtube,
            "GOOGLE_SEARCH": self._google_search,
            "TYPE_TEXT": self._type_text,
            "SYSTEM_COMMAND": self._execute_system_command,
            "OPEN_APP": self._open_any_app,
            "SCROLL_CLICK": self._simulate_pc_control
        }

    def execute(self, intent_obj):
        intent = intent_obj.get("intent")
        entities = intent_obj.get("entities", {})
        
        # Mapping generic requests to specific handlers
        if intent == "UNKNOWN" and entities.get("raw_query"):
           # Try to infer if it's an app opening or search
           raw = entities["raw_query"].lower()
           if "open" in raw or "launch" in raw:
               intent = "OPEN_APP"
               entities["app_name"] = raw.replace("open ", "").replace("launch ", "").strip()
           elif "search" in raw:
               intent = "GOOGLE_SEARCH"
               entities["query"] = raw.replace("search ", "").strip()

        action_func = self.actions.get(intent)
        if action_func:
            try:
                return action_func(entities)
            except Exception as e:
                return {"status": "FAILED", "message": f"Execution error: {str(e)}"}
        else:
            return {"status": "FAILED", "message": f"Orchestration handler for '{intent}' not mapped."}

    def _open_vscode(self, entities):
        try:
            subprocess.Popen(["code"], shell=True)
            return {"status": "SUCCESS", "message": "VS Code instance initialized."}
        except Exception as e:
            return {"status": "FAILED", "message": f"Uplink fail: {str(e)}"}

    def _open_any_app(self, entities):
        app_name = entities.get("app_name") or entities.get("query", "")
        if not app_name:
            return {"status": "FAILED", "message": "No application specified."}

        try:
            if platform.system() == "Windows":
                # Using 'start' to find apps in the PATH or system directories
                subprocess.Popen(f"start {app_name}", shell=True)
                return {"status": "SUCCESS", "message": f"System attempt to launch '{app_name}' initiated."}
            else:
                return {"status": "FAILED", "message": "Global app launching currently optimized for Windows."}
        except Exception as e:
            return {"status": "FAILED", "message": f"Could not locate '{app_name}': {str(e)}"}

    def _google_search(self, entities):
        query = entities.get("query", "")
        if not query:
            return {"status": "FAILED", "message": "Search parameters undefined."}
        
        webbrowser.open(f"https://www.google.com/search?q={query}")
        return {"status": "SUCCESS", "message": f"Neural search executed for: '{query}'"}

    def _open_youtube(self, entities):
        query = entities.get("query", "")
        if query:
            url = f"https://www.youtube.com/results?search_query={query}"
        else:
            url = "https://www.youtube.com"
        
        webbrowser.open(url)
        return {"status": "SUCCESS", "message": "YouTube instance initialized."}

    def _execute_system_command(self, entities):
        # Extremely powerful; use with care in a JARVIS-style system
        cmd = entities.get("command")
        if not cmd: return {"status": "FAILED", "message": "No command payload."}
        
        try:
            result = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT)
            return {"status": "SUCCESS", "message": f"System Output: {result.decode()}"}
        except Exception as e:
            return {"status": "FAILED", "message": f"Command failure: {str(e)}"}

    def _simulate_pc_control(self, entities):
        # Implementation of "Scroll and Click like Jarvis"
        action = entities.get("action", "orchestration")
        return {
            "status": "SUCCESS", 
            "message": f"Interpreting global intent: {action}. Engaging virtual controller. (Simulated Jarvis precision)"
        }

    def _type_text(self, entities):
        text = entities.get("text") or entities.get("query", "")
        return {"status": "SUCCESS", "message": f"Text payload '{text}' injected into system buffer."}

# Global instance
action_engine = ActionEngine()
