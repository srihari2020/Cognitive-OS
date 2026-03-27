import re

class ComplexityAnalyzer:
    def __init__(self):
        self.low_complexity_patterns = [
            r"^open", r"^launch", r"^start", r"^run",
            r"^type", r"^write", r"^enter",
            r"^scroll", r"^go to"
        ]
        self.medium_complexity_patterns = [
            r"^search", r"^google", r"^find", r"^look up"
        ]
        self.high_complexity_patterns = [
            r"^what is", r"^explain", r"^summarize", r"^compare", r"^tell me about"
        ]

    def analyze_complexity(self, command):
        """Analyzes the complexity of a command based on predefined rules."""
        command = command.lower().strip()

        if any(re.search(pattern, command) for pattern in self.high_complexity_patterns):
            return "HIGH"
        if any(re.search(pattern, command) for pattern in self.medium_complexity_patterns):
            return "MEDIUM"
        if any(re.search(pattern, command) for pattern in self.low_complexity_patterns):
            return "LOW"
        
        # Default to medium if no specific pattern matches but it's not empty
        return "MEDIUM" if command else "LOW"

# Global instance
complexity_analyzer = ComplexityAnalyzer()
