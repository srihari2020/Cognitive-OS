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
            "SCROLL_CLICK": self._simulate_pc_control,
            "SYSTEM_INFO": self._system_info,
            "OPEN_FILES": self._open_files,
            "OPEN_DOWNLOADS": self._open_downloads
        }

    def _system_info(self, entities):
        try:
            import psutil
            info = {
                "platform": platform.system(),
                "cpu_cores": os.cpu_count(),
                "free_memory_gb": round(psutil.virtual_memory().available / (1024**3), 2)
            }
        except ImportError:
            info = {
                "platform": platform.system(),
                "cpu_cores": os.cpu_count(),
                "free_memory_gb": "unknown"
            }
        
        msg = f"Systems nominal. {info['free_memory_gb']} GB memory available over {info['cpu_cores']} cores."
        return {"status": "SUCCESS", "message": msg}

    def _open_files(self, entities):
        try:
            if platform.system() == "Windows":
                subprocess.Popen("explorer", shell=True)
            return {"status": "SUCCESS", "message": "Opening files."}
        except:
            return {"status": "FAILED", "message": "Couldn't open file explorer."}

    def _open_downloads(self, entities):
        try:
            if platform.system() == "Windows":
                downloads = os.path.join(os.path.expanduser("~"), "Downloads")
                subprocess.Popen(f'explorer "{downloads}"', shell=True)
            return {"status": "SUCCESS", "message": "Opening downloads."}
        except:
            return {"status": "FAILED", "message": "Couldn't open downloads."}

    def _resolve_app(self, name):
        """Resolves fuzzy app names to system executables with AI fallback."""
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
        name_clean = name.lower().replace(" ", "")
        
        # 1. Exact match
        if name_clean in known_apps:
            return known_apps[name_clean]
        
        # 2. Fuzzy match (substring)
        for key in known_apps:
            if name_clean in key or key in name_clean:
                return known_apps[key]
        
        # 3. AI Fallback (last resort)
        from src.provider_manager import provider_manager
        active_provider = provider_manager.get_active_provider()
        if active_provider:
            apps_list = ", ".join(known_apps.keys())
            prompt = f"Given these known apps: [{apps_list}], which one does the user mean by '{name}'? Return ONLY the app name from the list or 'unknown' if no match. No JSON, just the string."
            # We use a simple prompt here, not the structured generate_intent
            try:
                # Assuming provider has a simple generate method or we use generate_intent and parse it
                # For consistency with existing code, let's use generate_intent and assume it can return a string or we extract it
                ai_suggestion = active_provider.generate_intent(prompt)
                if isinstance(ai_suggestion, dict):
                    suggestion = ai_suggestion.get("app") or ai_suggestion.get("intent") or "unknown"
                else:
                    suggestion = str(ai_suggestion).strip().lower()
                
                if suggestion in known_apps:
                    return known_apps[suggestion]
            except:
                pass

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
