import time

class CacheManager:
    def __init__(self, ttl_seconds=3600):
        """Initializes a cache with a time-to-live (TTL) for its entries."""
        self.cache = {}
        self.ttl = ttl_seconds

    def get(self, key):
        """Retrieves an item from the cache if it exists and has not expired."""
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry['timestamp'] < self.ttl:
                return entry['value']
            else:
                # Entry has expired, so remove it
                del self.cache[key]
        return None

    def set(self, key, value):
        """Adds an item to the cache with the current timestamp."""
        self.cache[key] = {
            'value': value,
            'timestamp': time.time()
        }

# Global instance
cache_manager = CacheManager()
