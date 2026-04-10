from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import sys
import subprocess
import platform
import webbrowser

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# ═══════════════════════════════════════════════════
# RESILIENT IMPORTS — never crash on missing modules
# ═══════════════════════════════════════════════════
router = None
suggestion_engine = None
prediction_engine = None
context_builder = None
interaction_analyzer = None
anticipation_engine = None
logger = None
wake_controller = None
wake_listener = None

try:
    from src.router import router as _router
    router = _router
except Exception:
    pass

try:
    from src.suggestion_engine import suggestion_engine as _se
    suggestion_engine = _se
except Exception:
    pass

try:
    from src.prediction_engine import prediction_engine as _pe
    prediction_engine = _pe
except Exception:
    pass

try:
    from src.context_builder import context_builder as _cb
    context_builder = _cb
except Exception:
    pass

try:
    from src.interaction_analyzer import interaction_analyzer as _ia
    interaction_analyzer = _ia
except Exception:
    pass

try:
    from src.anticipation_engine import anticipation_engine as _ae
    anticipation_engine = _ae
except Exception:
    pass

try:
    from src.logger import logger as _logger
    logger = _logger
except Exception:
    pass

try:
    from src.wake_word_listener import WakeWordController, WakeWordListener
    wake_controller = WakeWordController()
    wake_listener = WakeWordListener(controller=wake_controller)
except Exception:
    pass


def safe_log(event_type, message):
    """Log only if logger module loaded successfully."""
    if logger:
        try:
            logger.log_event(event_type, message)
        except Exception:
            pass


def safe_log_error(message):
    """Log error only if logger module loaded successfully."""
    if logger:
        try:
            logger.log_error(message)
        except Exception:
            pass


app = FastAPI(title="Cognitive OS API Bridge")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════

class CommandRequest(BaseModel):
    command: str

class InteractionInput(BaseModel):
    input: str

class InteractionEvent(BaseModel):
    event_type: str
    x: float = 0
    y: float = 0

class PredictRequest(BaseModel):
    history: list


# ═══════════════════════════════════════════════════
# CORE ROUTE: /api/interaction
# This is the unified command endpoint for browser mode.
# Handles: open apps, search, system info, files, etc.
# ═══════════════════════════════════════════════════

def get_system_info():
    """Gather basic system information."""
    info = {
        "platform": platform.system(),
        "platform_version": platform.version(),
        "architecture": platform.machine(),
        "processor": platform.processor(),
        "python_version": platform.python_version(),
    }
    
    # Memory info (Windows)
    try:
        if platform.system() == "Windows":
            result = subprocess.check_output(
                'wmic OS get FreePhysicalMemory /value',
                shell=True, stderr=subprocess.DEVNULL
            ).decode().strip()
            for line in result.split('\n'):
                if 'FreePhysicalMemory' in line:
                    free_kb = int(line.split('=')[1].strip())
                    info["free_memory_gb"] = round(free_kb / 1024 / 1024, 2)
    except Exception:
        info["free_memory_gb"] = "unknown"

    # CPU cores
    try:
        info["cpu_cores"] = os.cpu_count() or "unknown"
    except Exception:
        info["cpu_cores"] = "unknown"
    
    return info


@app.post("/api/interaction")
async def handle_interaction(data: InteractionInput):
    """
    Unified command handler for browser mode.
    Receives { "input": "open vscode" } and executes the command.
    """
    text = data.input.strip().lower()
    safe_log("API", f"Interaction received: {text}")

    try:
        # VS Code
        if any(kw in text for kw in ["open vscode", "open vs code", "open code", "launch vscode", "launch code"]):
            subprocess.Popen("code", shell=True)
            return {"response": "Opening VS Code."}

        # YouTube
        if "youtube" in text and ("open" in text or "launch" in text):
            webbrowser.open("https://youtube.com")
            return {"response": "Opening YouTube."}

        # Chrome / Browser
        if any(kw in text for kw in ["open chrome", "launch chrome", "open browser"]):
            if platform.system() == "Windows":
                subprocess.Popen('start chrome', shell=True)
            else:
                webbrowser.open("https://google.com")
            return {"response": "Opening browser."}

        # Google Search
        if "search" in text:
            # Extract query after "search" or "search for" or "search google for"
            query = text
            for prefix in ["search google for", "search for", "google", "search"]:
                if query.startswith(prefix):
                    query = query[len(prefix):].strip()
                    break
            if query:
                webbrowser.open(f"https://www.google.com/search?q={query}")
                return {"response": f"Searching for: {query}"}
            return {"response": "What would you like to search for?"}

        # System Info
        if any(kw in text for kw in ["system info", "system status", "check system", "show system"]):
            info = get_system_info()
            msg = (
                f"System: {info['platform']} {info.get('platform_version', '')}\n"
                f"Architecture: {info['architecture']}\n"
                f"CPU Cores: {info['cpu_cores']}\n"
                f"Free Memory: {info.get('free_memory_gb', 'unknown')} GB\n"
                f"Python: {info['python_version']}"
            )
            return {"response": msg}

        # File Explorer
        if any(kw in text for kw in ["open files", "open explorer", "open documents", "show files"]):
            if platform.system() == "Windows":
                subprocess.Popen("explorer", shell=True)
            return {"response": "Opening file explorer."}

        # Downloads
        if "open downloads" in text or "show downloads" in text:
            if platform.system() == "Windows":
                downloads = os.path.join(os.path.expanduser("~"), "Downloads")
                subprocess.Popen(f'explorer "{downloads}"', shell=True)
            return {"response": "Opening downloads folder."}

        # Open any app (generic)
        if text.startswith("open ") or text.startswith("launch "):
            app_name = text.replace("open ", "").replace("launch ", "").strip()
            if platform.system() == "Windows":
                subprocess.Popen(f"start {app_name}", shell=True)
                return {"response": f"Attempting to open {app_name}."}
            return {"response": f"Cannot open {app_name} on this platform."}

        # Not recognized — pass to orchestrator if available
        if router:
            try:
                result = router.process_command(data.input)
                msg = result.get("action", {}).get("message", str(result))
                return {"response": msg}
            except Exception as e:
                return {"response": f"Processing error: {str(e)}"}

        return {"response": f"Command not recognized: {text}"}

    except Exception as e:
        safe_log_error(f"Interaction error: {str(e)}")
        return {"response": f"Error executing command: {str(e)}"}


# ═══════════════════════════════════════════════════
# LEGACY ROUTES (kept for backward compatibility)
# ═══════════════════════════════════════════════════

@app.post("/api/command")
async def execute_command(request: CommandRequest):
    try:
        safe_log("API", f"Received command: {request.command}")
        if interaction_analyzer:
            interaction_analyzer.record_keypress()
        if router:
            result = router.process_command(request.command)
            return result
        # Fallback if router didn't load
        return {"action": {"status": "FALLBACK", "message": "Backend modules not fully loaded. Command received."}}
    except Exception as e:
        safe_log_error(f"API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    safe_log_error(f"Unhandled server error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.post("/api/interaction-event")
async def record_interaction(event: InteractionEvent):
    """Bridge frontend mouse/keyboard events to backend analyzer."""
    if interaction_analyzer:
        if event.event_type == 'mousemove':
            interaction_analyzer.record_mouse(event.x, event.y)
        elif event.event_type == 'keydown':
            interaction_analyzer.record_keypress()
    return {"status": "OK"}


@app.get("/api/anticipation")
async def get_anticipation():
    """Get backend-driven anticipation signals."""
    if not anticipation_engine or not interaction_analyzer:
        return {"anticipation": None, "intensity_score": 0, "attention_level": "IDLE"}
    
    anticipation = anticipation_engine.evaluate_anticipation()
    intensity_score = interaction_analyzer.update_interaction_intensity()
    attention_level = anticipation_engine.get_attention_level()
    
    return {
        "anticipation": anticipation,
        "intensity_score": intensity_score,
        "attention_level": attention_level
    }


@app.get("/api/suggestions")
async def get_suggestions():
    try:
        if not context_builder or not prediction_engine or not suggestion_engine:
            return {"suggestions": []}
        context = context_builder.build_context()
        predicted_intents = prediction_engine.predict_next(context)
        suggestions = suggestion_engine.generate_suggestions(predicted_intents)
        return {"suggestions": suggestions}
    except Exception as e:
        safe_log_error(f"API Suggestion Error: {str(e)}")
        return {"suggestions": []}


@app.post("/api/predict")
async def predict_intent(request: PredictRequest):
    """AI-assisted prediction based on user action history."""
    try:
        if not prediction_engine:
            return {"predictions": []}
        predictions = prediction_engine.predict_next_from_history(request.history)
        return {"predictions": predictions}
    except Exception as e:
        safe_log_error(f"API Predict Error: {str(e)}")
        return {"predictions": []}


@app.get("/api/status")
async def get_status():
    return {"status": "ONLINE"}


@app.post("/api/wake-word/trigger")
async def trigger_wake_word():
    if wake_controller:
        wake_controller.trigger("endpoint")
    return {"status": "OK"}


@app.get("/api/wake-word/consume")
async def consume_wake_word():
    if wake_controller:
        return wake_controller.consume()
    return {"triggered": False, "timestamp": 0}


@app.on_event("startup")
async def startup_event():
    safe_log("SYSTEM", "API bridge startup")
    if wake_listener:
        try:
            wake_listener.start()
        except Exception:
            pass


@app.on_event("shutdown")
async def shutdown_event():
    safe_log("SYSTEM", "API bridge shutdown")
    if wake_listener:
        try:
            wake_listener.stop()
        except Exception:
            pass

if __name__ == "__main__":
    print("Cognitive OS Backend starting on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
