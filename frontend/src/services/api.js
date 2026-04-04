import { setBackendStatus } from '../utils/runtimeMetrics';

const API_BASE_URL = 'http://localhost:8000/api';

let isBackendOffline = false;
let lastOfflineLogTime = 0;
const OFFLINE_LOG_COOLDOWN = 60000; // Log once per minute
let healthCheckTimeout = null;
let retryDelay = 1000; // Start with 1s

// Request Control: Singleton pattern for critical requests
const activeRequests = new Map(); // url -> AbortController

const updateBackendStatus = (offline) => {
  if (isBackendOffline !== offline) {
    isBackendOffline = offline;
    setBackendStatus(offline ? 'OFFLINE' : 'ONLINE');
    
    if (offline) {
      startHealthCheck();
    } else {
      stopHealthCheck();
    }
  }
};

const startHealthCheck = () => {
  if (healthCheckTimeout) return;
  
  const scheduleNext = () => {
    healthCheckTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/status`, { 
          signal: AbortSignal.timeout(2000),
          cache: 'no-store'
        });
        if (response.ok) {
          updateBackendStatus(false);
        } else {
          throw new Error('Not OK');
        }
      } catch (_) {
        // Exponential backoff: 1s -> 2s -> 4s -> 8s -> 10s max
        retryDelay = Math.min(retryDelay * 2, 10000);
        scheduleNext();
      }
    }, retryDelay);
  };

  scheduleNext();
};

const stopHealthCheck = () => {
  if (healthCheckTimeout) {
    clearTimeout(healthCheckTimeout);
    healthCheckTimeout = null;
  }
};

async function safeFetch(url, options = {}, silent = false) {
  // STRICT GLOBAL LOCK: Block all requests if backend is offline
  if (isBackendOffline && !url.endsWith('/status')) {
    return Promise.reject(new Error('BACKEND_OFFLINE'));
  }

  // Concurrency Control: Cancel previous request to same endpoint
  if (activeRequests.has(url)) {
    activeRequests.get(url).abort();
    activeRequests.delete(url);
  }

  const controller = new AbortController();
  activeRequests.set(url, controller);

  try {
    // Second guard right before fetch to minimize concurrent burst during transition
    if (isBackendOffline && !url.endsWith('/status')) {
      throw new Error('BACKEND_OFFLINE');
    }
    const response = await fetch(url, { ...options, signal: controller.signal });
    activeRequests.delete(url);
    
    if (response.ok) {
      updateBackendStatus(false);
      return response;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    activeRequests.delete(url);
    if (error.name === 'AbortError') throw error;
    
    // Any other error (CONNECTION_REFUSED, etc.) triggers offline mode
    updateBackendStatus(true);
    throw error;
  }
}

export const commandService = {
  /**
   * Debug: Return count of active requests
   */
  getActiveRequestCount() {
    return activeRequests.size;
  },

  /**
   * Sends a command to the Cognitive OS backend.
   */
  async send(command) {
    try {
      const response = await safeFetch(`${API_BASE_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      return await response.json();
    } catch (error) {
      if (error.message === 'BACKEND_OFFLINE') throw new Error('Backend is currently unreachable.');
      throw error;
    }
  },

  /**
   * Fetches real-time suggestions.
   */
  async getSuggestions() {
    try {
      const response = await safeFetch(`${API_BASE_URL}/suggestions`, {}, true);
      return await response.json();
    } catch (error) {
      return { suggestions: [] };
    }
  },

  /**
   * Checks system status.
   */
  async getStatus() {
    try {
      const response = await safeFetch(`${API_BASE_URL}/status`, {}, true);
      return await response.json();
    } catch (error) {
      return { status: 'OFFLINE' };
    }
  },

  /**
   * Syncs user interaction with the backend.
   */
  async recordInteraction(eventType, x = 0, y = 0) {
    try {
      await safeFetch(`${API_BASE_URL}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, x, y }),
      }, true);
    } catch (error) {
      // Fail silently
    }
  },

  /**
   * Gets real-time anticipation signals from the backend.
   */
  async getAnticipation() {
    try {
      const response = await safeFetch(`${API_BASE_URL}/anticipation`, {}, true);
      return await response.json();
    } catch (error) {
      return null;
    }
  },

  /**
   * Consumes wake-word trigger state from backend.
   */
  async consumeWakeWord() {
    try {
      const response = await safeFetch(`${API_BASE_URL}/wake-word/consume`, {}, true);
      return await response.json();
    } catch (error) {
      return { triggered: false, timestamp: 0 };
    }
  },

  /**
   * Gets AI-assisted predictions based on history.
   */
  async getAIPredictions(history) {
    try {
      const response = await safeFetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }),
      });
      return await response.json();
    } catch (error) {
      return { predictions: [] };
    }
  },

  /**
   * Helper to check current offline state
   */
  isOffline() {
    return isBackendOffline;
  }
};
