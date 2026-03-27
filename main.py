import sys
import os

# Add the project root to sys.path to ensure absolute imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.ui import start_ui
from src.logger import logger

def main():
    """
    Cognitive OS - Production Prototype Entry Point
    """
    try:
        print("Cognitive OS is starting...")
        logger.log_event("SYSTEM", "Application session started.")
        
        # Launch the UI
        start_ui()
        
        logger.log_event("SYSTEM", "Application session ended gracefully.")
        print("Cognitive OS has shut down.")
        
    except Exception as e:
        error_msg = f"CRITICAL SYSTEM ERROR: {str(e)}"
        print(error_msg)
        if 'logger' in locals():
            logger.log_error(error_msg)
        sys.exit(1)

if __name__ == "__main__":
    main()
