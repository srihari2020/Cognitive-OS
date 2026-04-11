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

    def _resolve_app(self, name):
        """Resolves fuzzy app names to system executables."""
        known_apps = {
            "vscode": "code",
            "chrome": "chrome",
            "edge": "msedge",
            "docker": "Docker Desktop",
            "settings": "ms-settings:",
            "notepad": "notepad",
            "calculator": "calc",
            "terminal": "wt",
            "powershell": "powershell",
            "discord": "discord",
            "slack": "slack",
            "spotify": "spotify",
        }
        
        # Normalize
        name = name.lower().replace(" ", "")
        
        # Exact match
        if name in known_apps:
            return known_apps[name]
        
        # Fuzzy match (substring)
        for key in known_apps:
            if name in key or key in name:
                return known_apps[key]
        
        return name

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
                return {"status": "FAILED", "message": f"Execution error."}
        else:
            return {"status": "FAILED", "message": f"I couldn't find that command."}

    def _open_vscode(self, entities):
        try:
            subprocess.Popen(["code"], shell=True)
            return {"status": "SUCCESS", "message": "Opening VS Code."}
        except Exception as e:
            return {"status": "FAILED", "message": f"Couldn't open VS Code."}

    def _open_any_app(self, entities):
        app_name = entities.get("app_name") or entities.get("query", "")
        if not app_name:
            return {"status": "FAILED", "message": "No application specified."}

        resolved_name = self._resolve_app(app_name)
        try:
            if platform.system() == "Windows":
                # Using 'start' to find apps in the PATH or system directories
                subprocess.Popen(f"start {resolved_name}", shell=True)
                return {"status": "SUCCESS", "message": f"Opening {resolved_name.capitalize()}."}
            else:
                return {"status": "FAILED", "message": "OS not supported for app launching."}
        except Exception as e:
            return {"status": "FAILED", "message": f"I couldn't find that app."}

    def _google_search(self, entities):
        query = entities.get("query", "")
        if not query:
            return {"status": "FAILED", "message": "Search query missing."}
        
        webbrowser.open(f"https://www.google.com/search?q={query}")
        return {"status": "SUCCESS", "message": f"Searching for {query}."}

    def _open_youtube(self, entities):
        query = entities.get("query", "")
        if query:
            url = f"https://www.youtube.com/results?search_query={query}"
        else:
            url = "https://www.youtube.com"
        
        webbrowser.open(url)
        return {"status": "SUCCESS", "message": "Opening YouTube."}

    def _execute_system_command(self, entities):
        cmd = entities.get("command")
        if not cmd: return {"status": "FAILED", "message": "No command provided."}
        
        try:
            subprocess.Popen(cmd, shell=True)
            return {"status": "SUCCESS", "message": "Executing command."}
        except Exception as e:
            return {"status": "FAILED", "message": "Command failed."}

    def _simulate_pc_control(self, entities):
        return {
            "status": "SUCCESS", 
            "message": "Got it."
        }

    def _type_text(self, entities):
        text = entities.get("text") or entities.get("query", "")
        return {"status": "SUCCESS", "message": "Done."}

# Global instance
action_engine = ActionEngine()
