import logging
import datetime
import os

class CognitiveLogger:
    def __init__(self, log_dir="logs"):
        self.log_dir = log_dir
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir)
            
        self.logger = logging.getLogger("CognitiveOS")
        self.logger.setLevel(logging.INFO)
        
        # File Handler
        log_file = os.path.join(self.log_dir, f"session_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
        fh = logging.FileHandler(log_file)
        fh.setLevel(logging.INFO)
        
        # Formatter
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        fh.setFormatter(formatter)
        
        self.logger.addHandler(fh)

        # Add a stream handler to also print to console
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        ch.setFormatter(formatter)
        self.logger.addHandler(ch)

    def log_event(self, event_type, data):
        """
        Logs a structured event to the log file.
        """
        message = f"[{event_type}] {data}"
        self.logger.info(message)

    def log_input(self, user_input):
        self.log_event("INPUT", f"User said: {user_input}")

    def log_intent(self, intent_obj):
        self.log_event("INTENT", f"Detected: {intent_obj}")

    def log_safety(self, safety_status):
        self.log_event("SAFETY", f"Status: {safety_status}")

    def log_action(self, action_result):
        self.log_event("ACTION", f"Result: {action_result}")

    def log_error(self, error_msg):
        self.logger.error(f"[ERROR] {error_msg}")

# Global instance
logger = CognitiveLogger()
