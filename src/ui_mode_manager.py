from enum import Enum
from dataclasses import dataclass

class UIMode(Enum):
    CINEMATIC = "CINEMATIC"
    FOCUS = "FOCUS"
    SMART = "SMART"

@dataclass
class UIIntensity:
    ripple: float  # 0.0 to 1.0
    camera_shake: float
    glow: float
    parallax: float

class UIModeManager:
    def __init__(self):
        self.current_mode = UIMode.SMART
        self.manual_override = False
        
        # Define base intensities for each mode
        self.mode_configs = {
            UIMode.CINEMATIC: UIIntensity(ripple=1.0, camera_shake=1.0, glow=1.0, parallax=1.0),
            UIMode.FOCUS: UIIntensity(ripple=0.1, camera_shake=0.0, glow=0.1, parallax=0.0),
            UIMode.SMART: UIIntensity(ripple=0.5, camera_shake=0.3, glow=0.5, parallax=0.5)
        }
        
        # Current active intensity (can be dynamically adjusted in SMART mode)
        self.active_intensity = self.mode_configs[UIMode.SMART]

    def set_mode(self, mode: UIMode, manual=True):
        self.current_mode = mode
        if manual:
            self.manual_override = True
            self.active_intensity = self.mode_configs[mode]
        else:
            if not self.manual_override:
                self.active_intensity = self.mode_configs[mode]

    def update_smart_intensity(self, context_factor: float, performance_factor: float, attention_factor: float = 1.0):
        """
        Dynamically adjust intensity for SMART mode.
        context_factor: 0.0 (typing/busy) to 1.0 (idle)
        performance_factor: 0.0 (low FPS) to 1.0 (high FPS)
        attention_factor: 0.0 (high focus/intensity) to 1.0 (low/idle)
        """
        if self.current_mode != UIMode.SMART or self.manual_override:
            return

        # Blend base SMART settings with factors
        base = self.mode_configs[UIMode.SMART]
        
        # When attention is HIGH (intensity is high), reduce effects to keep UI responsive and non-distracting
        # So we use attention_factor (which is 1.0 when idle/low intensity, and lower when active)
        multiplier = context_factor * performance_factor * attention_factor
        
        self.active_intensity = UIIntensity(
            ripple=base.ripple * (1.0 if attention_factor < 0.5 else 0.5), # Allow ripples during high activity
            camera_shake=base.camera_shake * multiplier,
            glow=base.glow * multiplier,
            parallax=base.parallax * multiplier
        )

    def get_intensity(self) -> UIIntensity:
        return self.active_intensity

ui_mode_manager = UIModeManager()
