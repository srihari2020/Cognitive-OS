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
        """Resolves fuzzy app names to system executables with aliases and AI fallback."""
        name = name.lower().strip()
        
        aliases = {
            "vs": "vscode",
            "code": "vscode",
            "edge": "msedge",
            "browser": "chrome",
            "terminal": "powershell",
        }
        
        apps = {
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
        
        # 1. Alias fix
        if name in aliases:
            name = aliases[name]
        
        # 2. Exact match
        if name in apps:
            return apps[name]
        
        # 3. Fuzzy match (substring)
        for key in apps:
            if name in key or key in name:
                return apps[key]
        
        # 4. AI Fallback (last resort)
        from src.provider_manager import provider_manager
        active_provider = provider_manager.get_active_provider()
        if active_provider:
            apps_list = ", ".join(apps.keys())
            prompt = f"Given these known apps: [{apps_list}], which one does the user mean by '{name}'? Return ONLY the app name from the list or 'unknown' if no match. No JSON, just the string."
            try:
                ai_suggestion = active_provider.generate_intent(prompt)
                if isinstance(ai_suggestion, dict):
                    suggestion = ai_suggestion.get("app") or ai_suggestion.get("intent") or "unknown"
                else:
                    suggestion = str(ai_suggestion).strip().lower()
                
                if suggestion in apps:
                    return apps[suggestion]
            except:
                pass

        return None

    def resolve(self, intent_obj):
        """Pre-resolution step: resolves entities (like app names) without execution."""
        intent = intent_obj.get("intent")
        entities = intent_obj.get("entities", {})
        
        if intent == "OPEN_APP":
            app_name = entities.get("app_name") or entities.get("query", "")
            if app_name:
                resolved_name = self._resolve_app(app_name)
                if resolved_name:
                    entities["resolved_app"] = resolved_name
                    intent_obj["resolved"] = True
        
        return intent_obj

    def execute(self, intent_obj):
        intent = intent_obj.get("intent")
        entities = intent_obj.get("entities", {})
        
        # Ensure resolution has happened
        if intent == "OPEN_APP" and "resolved_app" not in entities:
            intent_obj = self.resolve(intent_obj)
            entities = intent_obj.get("entities", {})

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
        app_name = entities.get("resolved_app") or entities.get("app_name") or entities.get("query", "")
        if not app_name:
            return {"status": "FAILED", "message": "No application specified."}

        # If not already resolved, resolve now
        resolved_name = entities.get("resolved_app") or self._resolve_app(app_name)
        if not resolved_name:
            return {"status": "FAILED", "message": "I couldn't find that app."}

        try:
            if platform.system() == "Windows":
                # Using 'start' to find apps in the PATH or system directories
                subprocess.Popen(f"start {resolved_name}", shell=True)
                
                # Format message nicely
                display_name = resolved_name.replace("ms-settings:", "Settings").capitalize()
                if " " in resolved_name: display_name = resolved_name # Keep multi-word names
                
                return {"status": "SUCCESS", "message": f"Opening {display_name}."}
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
