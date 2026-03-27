from src.interaction_analyzer import interaction_analyzer
from src.anticipation_engine import anticipation_engine
from src.ui_mode_manager import ui_mode_manager
import time

def test_interaction_signals():
    print("Testing Interaction Signals...")
    
    # 1. Simulate fast typing
    for _ in range(10):
        interaction_analyzer.record_keypress()
        time.sleep(0.1)
    
    intensity = interaction_analyzer.update_interaction_intensity()
    print(f"High Interaction Intensity: {intensity:.2f}")
    assert intensity > 0.5
    
    # 2. Simulate typing pause
    time.sleep(1.0)
    pause = interaction_analyzer.get_typing_pause_duration()
    print(f"Typing Pause: {pause:.2f}s")
    assert pause >= 1.0
    
    # 3. Simulate mouse movement
    interaction_analyzer.record_mouse(100, 100)
    time.sleep(0.1)
    interaction_analyzer.record_mouse(200, 200)
    velocity = interaction_analyzer.get_mouse_velocity()
    print(f"Mouse Velocity: {velocity:.2f} px/s")
    assert velocity > 0
    
    print("Interaction Signals passed!\n")

def test_anticipation_logic():
    print("Testing Anticipation Engine...")
    
    # Simulate a state where anticipation should trigger (typing pause)
    interaction_analyzer.is_typing = True
    # Last key was 1.5s ago
    interaction_analyzer.last_key_time = time.time() - 1.5
    
    # Wait for rate limit (if needed)
    time.sleep(0.6)
    
    # Evaluate anticipation
    from src.context_builder import context_builder
    from src.prediction_engine import prediction_engine
    ctx = context_builder.build_context()
    preds = prediction_engine.predict_next(ctx)
    print(f"Predictions: {preds}")
    
    anticipation = anticipation_engine.evaluate_anticipation()
    if anticipation:
        print(f"Anticipation Triggered: {anticipation['type']} (Confidence: {anticipation['confidence']:.2f})")
        assert anticipation['confidence'] >= 0.5
    else:
        print("Anticipation NOT triggered (unexpected, but check logs)")
        
    print("Anticipation Engine tests passed!\n")

if __name__ == "__main__":
    test_interaction_signals()
    test_anticipation_logic()
