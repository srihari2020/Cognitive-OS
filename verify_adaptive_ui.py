from src.ui_mode_manager import ui_mode_manager, UIMode
from src.performance_monitor import performance_monitor
import time

def test_ui_mode_manager():
    print("Testing UI Mode Manager...")
    
    # Test initial state (SMART)
    assert ui_mode_manager.current_mode == UIMode.SMART
    
    # Test manual override to CINEMATIC
    ui_mode_manager.set_mode(UIMode.CINEMATIC, manual=True)
    assert ui_mode_manager.current_mode == UIMode.CINEMATIC
    assert ui_mode_manager.get_intensity().ripple == 1.0
    
    # Test manual override to FOCUS
    ui_mode_manager.set_mode(UIMode.FOCUS, manual=True)
    assert ui_mode_manager.current_mode == UIMode.FOCUS
    assert ui_mode_manager.get_intensity().ripple == 0.1
    
    # Reset to SMART
    ui_mode_manager.manual_override = False
    ui_mode_manager.set_mode(UIMode.SMART, manual=False)
    
    # Test smart adjustment - Busy/Low Performance
    # context_factor=0.0 (typing), performance_factor=0.5 (30fps)
    ui_mode_manager.update_smart_intensity(context_factor=0.0, performance_factor=0.5)
    intensity = ui_mode_manager.get_intensity()
    print(f"Smart Intensity (Busy/Low Perf): {intensity}")
    assert intensity.ripple == 0.0 # 0.5 * 0.0 * 0.5
    
    # Test smart adjustment - Idle/High Performance
    # context_factor=1.0 (idle), performance_factor=1.0 (60fps)
    ui_mode_manager.update_smart_intensity(context_factor=1.0, performance_factor=1.0)
    intensity = ui_mode_manager.get_intensity()
    print(f"Smart Intensity (Idle/High Perf): {intensity}")
    assert intensity.ripple == 0.5 # 0.5 * 1.0 * 1.0
    
    print("UI Mode Manager tests passed!\n")

def test_performance_monitor():
    print("Testing Performance Monitor...")
    
    # Simulate some ticks
    for _ in range(10):
        performance_monitor.tick()
        time.sleep(0.016) # ~60fps
        
    fps = performance_monitor.get_fps()
    factor = performance_monitor.get_performance_factor()
    print(f"Simulated FPS: {fps:.2f}, Factor: {factor:.2f}")
    assert factor > 0.5
    
    # Simulate low performance
    for _ in range(70):
        performance_monitor.tick()
        time.sleep(0.05) # ~20fps
        
    fps = performance_monitor.get_fps()
    factor = performance_monitor.get_performance_factor()
    print(f"Simulated Low FPS: {fps:.2f}, Factor: {factor:.2f}")
    assert factor < 0.5
    
    print("Performance Monitor tests passed!\n")

if __name__ == "__main__":
    test_ui_mode_manager()
    test_performance_monitor()
