import time
import collections
import math

class InteractionAnalyzer:
    def __init__(self):
        # Mouse tracking
        self.mouse_history = collections.deque(maxlen=20)  # Stores (x, y, timestamp)
        self.hover_start_time = None
        self.hover_target = None
        
        # Typing tracking
        self.last_key_time = time.time()
        self.typing_pauses = collections.deque(maxlen=10)
        self.is_typing = False
        
        # Interaction intensity
        self.interaction_intensity = 0.0  # 0.0 to 1.0

    def record_mouse(self, x, y, target=None):
        """Record mouse position and detect intent patterns."""
        now = time.time()
        self.mouse_history.append((x, y, now))
        
        # Detect hover with intent
        if target:
            if self.hover_target == target:
                # Still hovering same target
                pass
            else:
                self.hover_target = target
                self.hover_start_time = now
        else:
            self.hover_target = None
            self.hover_start_time = None

    def record_keypress(self):
        """Record a keypress and analyze typing rhythm."""
        now = time.time()
        pause = now - self.last_key_time
        if pause < 2.0:  # Only count as 'typing' if pause is short
            self.typing_pauses.append(pause)
            self.is_typing = True
        else:
            self.is_typing = False
            
        self.last_key_time = now

    def get_mouse_velocity(self):
        """Calculate current mouse velocity (px/sec)."""
        if len(self.mouse_history) < 2:
            return 0.0
        
        # Get last 5 points for a smoother velocity calculation
        points = list(self.mouse_history)[-5:]
        total_dist = 0
        total_time = points[-1][2] - points[0][2]
        
        if total_time <= 0:
            return 0.0
            
        for i in range(1, len(points)):
            dx = points[i][0] - points[i-1][0]
            dy = points[i][1] - points[i-1][1]
            total_dist += math.sqrt(dx*dx + dy*dy)
            
        return total_dist / total_time

    def get_typing_pause_duration(self):
        """Get current time since last keypress."""
        return time.time() - self.last_key_time

    def get_hover_intent_score(self, target):
        """Calculate how likely a user is to click a target based on hover time."""
        if self.hover_target != target or not self.hover_start_time:
            return 0.0
            
        hover_duration = time.time() - self.hover_start_time
        # Return a score from 0 to 1 after 0.5s of hovering
        return min(1.0, hover_duration / 0.5)

    def update_interaction_intensity(self):
        """Update the overall interaction intensity score (0.0 to 1.0)."""
        velocity = self.get_mouse_velocity()
        typing_pause = self.get_typing_pause_duration()
        
        # Normalize velocity (0 to 1000 px/sec)
        norm_v = min(1.0, velocity / 1000.0)
        
        # Typing intensity: 1.0 if typing fast, 0.0 if paused > 2s
        norm_t = 1.0 if self.is_typing and typing_pause < 0.5 else 0.0
        
        # Combined score
        self.interaction_intensity = (norm_v * 0.4) + (norm_t * 0.6)
        return self.interaction_intensity

interaction_analyzer = InteractionAnalyzer()
