import os
import platform
import subprocess
from src.logger import logger

class AppRegistry:
    def __init__(self):
        self.registry = {}
        # Display names mapping for better FRIDAY responses
        self.display_names = {}
        
        # User-requested human aliases
        self.aliases = {
            "music": "spotify",
            "browser": "chrome",
            "code": "vscode",
            "todo": "microsoft to do",
            "task": "microsoft to do",
            "store": "microsoft store",
            "asus": "myasus",
            "terminal": "wt",
            "vs": "vscode",
            "copilet": "copilot",
        }

        # Special Windows URI-based apps
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
            "edge": "msedge",
            "chrome": "chrome",
            "powershell": "powershell",
            "cmd": "cmd",
            "todo": "microsoft-to-do:",
            "microsofttodo": "microsoft-to-do:",
            "myasus": "myasus:",
            "copilot": "microsoft-edge-copilot:", # Copilot URI for Edge
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
        """Deep scan for installed .exe and .lnk applications on Windows."""
        logger.log_event("APP_REGISTRY", "Deep scanning system for applications...")
        
        # 1. Start with special Windows URIs
        for name, target in self.special_apps.items():
            norm_name = self._normalize(name)
            self.registry[norm_name] = target
            self.display_names[norm_name] = name.title()

        # 2. Define search paths for .exe and .lnk files
        scan_paths = [
            # Real installed application folders
            "C:\\Program Files",
            "C:\\Program Files (x86)",
            os.path.join(os.path.expanduser("~"), "AppData", "Local"),
            os.path.join(os.path.expanduser("~"), "AppData", "Roaming"),
            
            # Start Menu shortcuts (most accurate for user apps)
            os.path.join(os.environ.get("ProgramData", "C:\\ProgramData"), "Microsoft\\Windows\\Start Menu\\Programs"),
            os.path.join(os.environ.get("AppData", ""), "Microsoft\\Windows\\Start Menu\\Programs")
        ]

        for path in scan_paths:
            if not os.path.exists(path):
                continue
            
            # Use os.walk for deep scan (as requested)
            try:
                for root, dirs, files in os.walk(path):
                    # To avoid excessive "junk" (like uninstalls or internal tools), 
                    # we focus on .exe and .lnk files.
                    for file in files:
                        if file.endswith((".exe", ".lnk")):
                            # Basic name without extension
                            app_name = file.rsplit('.', 1)[0]
                            norm_name = self._normalize(app_name)
                            
                            # Skip common helper names to reduce noise
                            if any(x in norm_name for x in ["unins", "helper", "setup", "crash", "reporter", "update"]):
                                continue

                            full_path = os.path.join(root, file)
                            
                            # Priority: .lnk (Start Menu) > .exe (Direct)
                            if norm_name not in self.registry or file.endswith(".lnk"):
                                self.registry[norm_name] = full_path
                                self.display_names[norm_name] = app_name
                                
            except Exception as e:
                logger.log_error(f"Failed to scan path {path}: {e}")

        logger.log_event("APP_REGISTRY", f"Registry built with {len(self.registry)} applications detected.")

    def resolve(self, name):
        """
        Smart resolution with real system scan results.
        Flow: Alias -> Exact Normalized -> Token Matching -> Fuzzy Contains
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
        # Filter out common stop words
        stop_words = {"to", "of", "the", "and", "a", "an", "in", "on", "at", "by", "for", "microsoft"}
        filtered_tokens = [t for t in input_tokens if t not in stop_words or len(input_tokens) == 1]
        if not filtered_tokens: filtered_tokens = input_tokens

        # Sort by length to prefer shorter/more exact matches
        sorted_apps = sorted(self.registry.keys(), key=len)
        for app_norm in sorted_apps:
            app_display = self.display_names[app_norm]
            app_tokens = self._tokenize(app_display)
            norm_display = self._normalize(app_display)
            
            # Check if all filtered tokens are present
            if all(t in app_tokens or t in app_norm or t in norm_display for t in filtered_tokens):
                # Extra validation for short inputs
                if len(filtered_tokens) == 1 and len(filtered_tokens[0]) < 3:
                    if filtered_tokens[0] not in app_tokens and filtered_tokens[0] not in app_norm: 
                        continue
                
                # Special check for "todo" to avoid matching random apps with "do" in them
                if "todo" in norm_input and "todo" not in app_norm and "todo" not in norm_display:
                    if "microsoft" in app_norm and "do" in app_norm: pass
                    else: continue

                return self.registry[app_norm], app_display

        # 4. Fuzzy: Contains match (but only if norm_input is significant)
        if len(norm_input) > 2:
            for app_norm in sorted_apps:
                if norm_input in app_norm:
                    return self.registry[app_norm], self.display_names[app_norm]

        # 5. Last resort: Substring of display name
        for app_norm in sorted_apps:
            app_display = self.display_names[app_norm].lower()
            if low_input in app_display:
                return self.registry[app_norm], self.display_names[app_norm]

        return None, None

# Global instance
app_registry = AppRegistry()
