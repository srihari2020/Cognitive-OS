import os
import platform
import subprocess
from src.logger import logger

class AppRegistry:
    def __init__(self):
        self.registry = {}
        # Display names mapping for better FRIDAY responses
        self.display_names = {}
        
        self.aliases = {
            "todo": "microsoft to do",
            "todoist": "microsoft to do",
            "task": "microsoft to do",
            "store": "microsoft store",
            "microsoftstore": "microsoft store",
            "asus": "myasus",
            "myasus": "myasus",
            "browser": "chrome",
            "terminal": "wt",
            "vs": "code",
            "vscode": "code",
            "to do": "microsoft to do",
            "my asus": "myasus",
            "clock": "clock",
        }

        self.special_apps = {
            "settings": "ms-settings:",
            "store": "ms-windows-store:",
            "microsoftstore": "ms-windows-store:",
            "calculator": "calc",
            "notepad": "notepad",
            "clock": "ms-clock:",
            "photos": "ms-photos:",
            "camera": "microsoft.windows.camera:",
            "weather": "bingweather:",
            "maps": "bingmaps:",
            "vscode": "code",
            "code": "code",
            "edge": "msedge",
            "chrome": "chrome",
            "powershell": "powershell",
            "cmd": "cmd",
            "todo": "microsoft-to-do:",
            "microsofttodo": "microsoft-to-do:",
            "myasus": "myasus:",
            "asus": "myasus:",
        }
        if platform.system() == "Windows":
            self.rebuild_registry()

    def _normalize(self, text):
        """Strong normalization: lowercase and remove all spaces."""
        return "".join(text.lower().split())

    def _tokenize(self, text):
        """Tokenize by splitting on spaces and lowercasing."""
        return text.lower().split()

    def rebuild_registry(self):
        """Scans Windows Start Menu for installed application shortcuts (.lnk)."""
        logger.log_event("APP_REGISTRY", "Scanning system for installed applications...")
        
        # 1. Start with special Windows URIs
        for name, target in self.special_apps.items():
            norm_name = self._normalize(name)
            self.registry[norm_name] = target
            self.display_names[norm_name] = name.title()

        # 2. Scan Common and User Start Menu paths
        paths = [
            os.path.join(os.environ.get("ProgramData", "C:\\ProgramData"), "Microsoft\\Windows\\Start Menu\\Programs"),
            os.path.join(os.environ.get("AppData", ""), "Microsoft\\Windows\\Start Menu\\Programs"),
            # Add common installation paths for potential direct matching if lnk is missing
            "C:\\Program Files",
            "C:\\Program Files (x86)"
        ]

        for path in paths:
            if not os.path.exists(path):
                continue
            
            # For Start Menu, scan recursively for .lnk files
            if "Start Menu" in path:
                for root, dirs, files in os.walk(path):
                    for file in files:
                        if file.endswith(".lnk"):
                            app_name = file[:-4] # Remove .lnk
                            norm_name = self._normalize(app_name)
                            full_path = os.path.join(root, file)
                            
                            if norm_name not in self.registry or len(full_path) < len(self.registry[norm_name]):
                                self.registry[norm_name] = full_path
                                self.display_names[norm_name] = app_name
                    
                    # Also check folder names (e.g., "Microsoft To Do" folder containing "To Do.lnk")
                    folder_name = os.path.basename(root)
                    norm_folder = self._normalize(folder_name)
                    if norm_folder not in self.registry:
                        for file in files:
                            if file.endswith(".lnk"):
                                self.registry[norm_folder] = os.path.join(root, file)
                                self.display_names[norm_folder] = folder_name
                                break
            else:
                # For Program Files, just check top-level folder names
                try:
                    for folder in os.listdir(path):
                        norm_folder = self._normalize(folder)
                        if norm_folder not in self.registry:
                            # We don't have a target, but we mark it as "installed"
                            self.registry[norm_folder] = os.path.join(path, folder)
                            self.display_names[norm_folder] = folder
                except PermissionError:
                    continue

        logger.log_event("APP_REGISTRY", f"Registry built with {len(self.registry)} entries.")

    def resolve(self, name):
        """
        Smart resolution with strong normalization and token matching.
        Flow: Alias -> Exact Normalized -> Token Matching -> Contains Normalized
        """
        if not name: return None, None
        
        # 1. Check Aliases first
        low_input = name.lower().strip()
        if low_input in self.aliases:
            name = self.aliases[low_input]

        norm_input = self._normalize(name)
        input_tokens = self._tokenize(name)

        # 2. Exact normalized match
        if norm_input in self.registry:
            return self.registry[norm_input], self.display_names[norm_input]

        # 3. Token Matching (e.g., "my asus" -> "MyASUS")
        # Filter out common stop words to avoid false positives
        stop_words = {"to", "of", "the", "and", "a", "an", "in", "on", "at", "by", "for", "microsoft"}
        filtered_tokens = [t for t in input_tokens if t not in stop_words or len(input_tokens) == 1]
        if not filtered_tokens: filtered_tokens = input_tokens

        # Sort by length to prefer shorter/more exact matches
        sorted_apps = sorted(self.registry.keys(), key=len)
        for app_norm in sorted_apps:
            app_display = self.display_names[app_norm]
            app_tokens = self._tokenize(app_display)
            norm_display = self._normalize(app_display)
            
            # Check if all filtered tokens are present in the app's real tokens or normalized name
            if all(t in app_tokens or t in app_norm or t in norm_display for t in filtered_tokens):
                # Extra validation for short inputs: at least one token must match significantly
                if len(filtered_tokens) == 1 and len(filtered_tokens[0]) < 3:
                    if filtered_tokens[0] not in app_tokens and filtered_tokens[0] not in app_norm: 
                        continue
                
                # Special check for "to do" to avoid matching random apps with "do" in them
                if "todo" in norm_input and "todo" not in app_norm and "todo" not in norm_display:
                    # Unless it's a very good match (e.g. contains "microsoft" and "to" and "do")
                    if "microsoft" in app_norm and "do" in app_norm:
                        pass
                    else:
                        continue

                return self.registry[app_norm], app_display

        # 4. Fuzzy: Contains match (but only if norm_input is significant)
        if len(norm_input) > 2:
            for app_norm in sorted_apps:
                if norm_input in app_norm:
                    return self.registry[app_norm], self.display_names[app_norm]

        # 5. Last resort: check if the input is a substring of any display name
        for app_norm in sorted_apps:
            app_display = self.display_names[app_norm].lower()
            if low_input in app_display:
                return self.registry[app_norm], self.display_names[app_norm]

        return None, None

# Global instance
app_registry = AppRegistry()
