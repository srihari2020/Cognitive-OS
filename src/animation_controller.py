import tkinter as tk
import math
import random

class AnimationController:
    def __init__(self):
        self.active_animations = {}

    def apply_ripple(self, widget, x, y, intensity: float):
        """Simulate a ripple effect on a widget."""
        if intensity <= 0.05: return

        # For standard Tkinter widgets, we can't easily draw ripples unless we use Canvas.
        # But we can simulate it by temporarily changing the widget's highlight/border.
        original_bg = widget.cget("background")
        
        def highlight(step):
            if step > 5:
                widget.config(background=original_bg)
                return
            
            # Brighten color temporarily
            color = "#3a3a3a" if step % 2 == 0 else "#4a4a4a"
            widget.config(background=color)
            widget.after(int(50 / intensity), lambda: highlight(step + 1))

        highlight(0)

    def shake_window(self, root, intensity: float):
        """Shake the entire root window."""
        if intensity <= 0.05: return

        original_geometry = root.geometry()
        try:
            # Parse current x, y
            parts = original_geometry.split("+")
            x, y = int(parts[1]), int(parts[2])
            size = parts[0]
        except:
            return

        def shake(step):
            if step > 10:
                root.geometry(original_geometry)
                return
            
            # Offset by random amount scaled by intensity
            dx = random.randint(-5, 5) * intensity
            dy = random.randint(-5, 5) * intensity
            root.geometry(f"{size}+{int(x+dx)}+{int(y+dy)}")
            root.after(20, lambda: shake(step + 1))

        shake(0)

    def apply_glow(self, widget, intensity: float):
        """Simulate a glow effect by pulsing the foreground or border color."""
        if intensity <= 0.05: return
        
        def pulse(step):
            # Oscillate alpha/brightness
            val = math.sin(step * 0.2) * 0.5 + 0.5
            brightness = int(200 + (55 * val * intensity))
            hex_color = f"#{brightness:02x}{brightness:02x}{brightness:02x}"
            
            try:
                widget.config(foreground=hex_color)
                # Continue pulse loop
                widget.after(100, lambda: pulse(step + 1))
            except:
                # Widget might have been destroyed
                pass

        pulse(0)

    def handle_parallax(self, widget, mouse_x, mouse_y, root_width, root_height, intensity: float):
        """Shift a widget slightly based on mouse position for a depth effect."""
        if intensity <= 0.05: return

        # Normalize mouse pos from -1 to 1
        nx = (mouse_x / root_width) * 2 - 1
        ny = (mouse_y / root_height) * 2 - 1
        
        # Max shift of 10 pixels scaled by intensity
        max_shift = 10 * intensity
        dx = nx * max_shift
        dy = ny * max_shift
        
        # We can't easily 'move' packed widgets, so we use place_configure if they are placed,
        # or we just skip it for simplicity in this prototype. 
        # For this demo, let's just use it as a concept for 'Smart' adjustments.
        pass

    def apply_expansion(self, widget, intensity: float):
        """Subtly expand a widget by changing its padding."""
        if intensity <= 0.05: return
        
        # Tkinter buttons use 'padding', but standard widgets might use 'padx'/'pady'
        try:
            current_padx = widget.pack_info().get('padx', 0)
            def pulse_expand(step):
                # Sine wave for expansion factor
                val = math.sin(step * 0.1) * 2 * intensity
                new_padx = max(0, int(current_padx + val))
                widget.pack_configure(padx=new_padx)
                widget.after(50, lambda: pulse_expand(step + 1))
            
            pulse_expand(0)
        except:
            pass

    def apply_focus_shift(self, widget, intensity: float):
        """Focus shift by subtly changing the background brightness."""
        if intensity <= 0.05: return
        
        original_bg = widget.cget("background")
        
        def highlight(step):
            val = math.sin(step * 0.1) * 0.5 + 0.5
            # Shift from dark grey to slightly lighter
            grey_val = int(43 + (20 * val * intensity)) # #2b2b2b is 43,43,43
            hex_color = f"#{grey_val:02x}{grey_val:02x}{grey_val:02x}"
            try:
                widget.config(background=hex_color)
                widget.after(100, lambda: highlight(step + 1))
            except:
                pass

        highlight(0)

    def apply_pre_action_hint(self, widget, intensity: float):
        """A 'pre-action' glow hint."""
        if intensity <= 0.05: return
        
        def glow(step):
            val = math.sin(step * 0.2) * 0.5 + 0.5
            # Shift border color if it has one, or use a specific hint color
            # For this prototype, we'll pulse the 'foreground' color between white and cyan
            r = int(255 - (55 * val * intensity))
            g = 255
            b = 255
            hex_color = f"#{r:02x}{g:02x}{b:02x}"
            try:
                widget.config(foreground=hex_color)
                widget.after(50, lambda: glow(step + 1))
            except:
                pass
        
        glow(0)

animation_controller = AnimationController()
