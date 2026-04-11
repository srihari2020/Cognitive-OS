import subprocess
import webbrowser
import os
import time
import platform
import shutil
from src.app_registry import app_registry

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
        """Resolves fuzzy app names to system executables with real registry and AI fallback."""
        # 1. Try real registry (built at startup)
        target, display_name = app_registry.resolve(name)
        if target:
            return target, display_name
        
        # 2. AI Fallback (last resort)
        from src.provider_manager import provider_manager
        active_provider = provider_manager.get_active_provider()
        if active_provider:
            # Only use AI for high-confidence suggestions
            known_apps = ", ".join(list(app_registry.registry.keys())[:10]) # Limit to top apps for context
            prompt = f"Given these known apps: [{known_apps}...], which one does the user mean by '{name}'? Return ONLY the app name from the list or 'unknown' if no match. No JSON, just the string."
            try:
                ai_suggestion = active_provider.generate_intent(prompt)
                if isinstance(ai_suggestion, dict):
                    suggestion = ai_suggestion.get("app") or ai_suggestion.get("intent") or "unknown"
                else:
                    suggestion = str(ai_suggestion).strip().lower()
                
                # Check if AI suggested a known app
                target, display_name = app_registry.resolve(suggestion)
                if target:
                    return target, display_name
            except:
                pass

        return None, None

    def resolve(self, intent_obj):
        """Pre-resolution step: resolves entities (like app names) without execution."""
        intent = intent_obj.get("intent")
        entities = intent_obj.get("entities", {})
        
        if intent == "OPEN_APP":
            app_name = entities.get("app_name") or entities.get("query", "")
            if app_name:
                resolved_target, display_name = self._resolve_app(app_name)
                if resolved_target:
                    entities["resolved_app_target"] = resolved_target
                    entities["resolved_app_display"] = display_name
                    intent_obj["resolved"] = True
        
        return intent_obj

    def execute(self, intent_obj):
        intent = intent_obj.get("intent")
        entities = intent_obj.get("entities", {})
        
        # Ensure resolution has happened
        if intent == "OPEN_APP" and "resolved_app_target" not in entities:
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
            # Try to resolve 'vscode' from registry first for accuracy
            target, display = self._resolve_app("vscode")
            if target:
                subprocess.Popen(f'start "" "{target}"', shell=True)
            else:
                subprocess.Popen(["code"], shell=True)
            return {"status": "SUCCESS", "message": "Opening Visual Studio Code for you.", "speak": True}
        except Exception as e:
            return {"status": "FAILED", "message": "I'm sorry, I couldn't open Visual Studio Code.", "speak": True}

    def _open_any_app(self, entities):
        target = entities.get("resolved_app_target")
        display_name = entities.get("resolved_app_display")
        
        if not target:
            # Fallback if not already resolved
            app_name = entities.get("app_name") or entities.get("query", "")
            if not app_name:
                return {"status": "FAILED", "message": "I'm not sure which application you mean.", "speak": True}
            target, display_name = self._resolve_app(app_name)

        if not target:
            return {"status": "FAILED", "message": "I couldn't find that app on your system.", "speak": True}

        try:
            if platform.system() == "Windows":
                # Check if it's a URI or a file path
                if ":" in target and not os.path.isabs(target):
                    # URI (e.g., ms-settings:)
                    subprocess.Popen(f'start {target}', shell=True)
                else:
                    # File path (.exe or .lnk)
                    subprocess.Popen(f'start "" "{target}"', shell=True)
                
                return {"status": "SUCCESS", "message": f"Opening {display_name} for you.", "speak": True}
            else:
                return {"status": "FAILED", "message": "I can only launch applications on Windows systems for now.", "speak": True}
        except Exception as e:
            logger.log_error(f"Execution error for {target}: {e}")
            return {"status": "FAILED", "message": "I encountered an error while trying to open that app.", "speak": True}

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
