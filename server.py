from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import sys

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.router import router
from src.suggestion_engine import suggestion_engine
from src.prediction_engine import prediction_engine
from src.context_builder import context_builder
from src.interaction_analyzer import interaction_analyzer
from src.anticipation_engine import anticipation_engine
from src.ui_mode_manager import ui_mode_manager
from src.logger import logger
from src.wake_word_listener import WakeWordController, WakeWordListener

app = FastAPI(title="Cognitive OS API Bridge")
wake_controller = WakeWordController()
wake_listener = WakeWordListener(controller=wake_controller)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CommandRequest(BaseModel):
    command: str

class InteractionEvent(BaseModel):
    event_type: str # 'mousemove', 'keydown'
    x: float = 0
    y: float = 0

@app.post("/api/command")
async def execute_command(request: CommandRequest):
    try:
        logger.log_event("API", f"Received command: {request.command}")
        # Mark activity on backend
        interaction_analyzer.record_keypress()
        result = router.process_command(request.command)
        return result
    except Exception as e:
        logger.log_error(f"API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.log_error(f"Unhandled server error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

@app.post("/api/interaction")
async def record_interaction(event: InteractionEvent):
    """Bridge frontend events to backend analyzer."""
    if event.event_type == 'mousemove':
        interaction_analyzer.record_mouse(event.x, event.y)
    elif event.event_type == 'keydown':
        interaction_analyzer.record_keypress()
    return {"status": "OK"}

@app.get("/api/anticipation")
async def get_anticipation():
    """Get backend-driven anticipation signals."""
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
        context = context_builder.build_context()
        predicted_intents = prediction_engine.predict_next(context)
        suggestions = suggestion_engine.generate_suggestions(predicted_intents)
        return {"suggestions": suggestions}
    except Exception as e:
        logger.log_error(f"API Suggestion Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class PredictRequest(BaseModel):
    history: list

@app.post("/api/predict")
async def predict_intent(request: PredictRequest):
    """AI-assisted prediction based on user action history."""
    try:
        # Pass history to prediction engine for more advanced analysis
        predictions = prediction_engine.predict_next_from_history(request.history)
        return {"predictions": predictions}
    except Exception as e:
        logger.log_error(f"API Predict Error: {str(e)}")
        # Fallback to empty list if prediction fails
        return {"predictions": []}

@app.get("/api/status")
async def get_status():
    return {"status": "ONLINE"}


@app.post("/api/wake-word/trigger")
async def trigger_wake_word():
    wake_controller.trigger("endpoint")
    return {"status": "OK"}


@app.get("/api/wake-word/consume")
async def consume_wake_word():
    return wake_controller.consume()


@app.on_event("startup")
async def startup_event():
    logger.log_event("SYSTEM", "API bridge startup")
    wake_listener.start()


@app.on_event("shutdown")
async def shutdown_event():
    logger.log_event("SYSTEM", "API bridge shutdown")
    wake_listener.stop()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
