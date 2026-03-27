import time
import collections

class PerformanceMonitor:
    def __init__(self, target_fps=60):
        self.target_fps = target_fps
        self.last_time = time.time()
        self.frame_times = collections.deque(maxlen=60)  # Keep last 60 frame times
        self.current_fps = 0.0

    def tick(self):
        """Called every frame update to calculate FPS."""
        now = time.time()
        delta = now - self.last_time
        self.last_time = now
        
        if delta > 0:
            self.frame_times.append(delta)
            avg_delta = sum(self.frame_times) / len(self.frame_times)
            self.current_fps = 1.0 / avg_delta if avg_delta > 0 else 0.0

    def get_fps(self):
        return self.current_fps

    def get_performance_factor(self) -> float:
        """
        Returns a factor from 0.0 (very low performance) to 1.0 (target FPS reached).
        """
        if self.current_fps >= self.target_fps:
            return 1.0
        # If FPS is below target, reduce intensity proportionally
        # Minimum factor is 0.1 to avoid completely disabling UI in edge cases
        return max(0.1, min(1.0, self.current_fps / self.target_fps))

performance_monitor = PerformanceMonitor()
