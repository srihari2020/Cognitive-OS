const API_BASE_URL = 'http://localhost:8000/api';

export const commandService = {
  /**
   * Sends a command to the Cognitive OS backend.
   */
  async send(command) {
    try {
      const response = await fetch(`${API_BASE_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'System error');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  /**
   * Fetches real-time suggestions.
   */
  async getSuggestions() {
    try {
      const response = await fetch(`${API_BASE_URL}/suggestions`);
      if (!response.ok) throw new Error('Failed to fetch suggestions');
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
      const response = await fetch(`${API_BASE_URL}/status`);
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
      await fetch(`${API_BASE_URL}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, x, y }),
      });
    } catch (error) {
      // Fail silently for background sync
    }
  },

  /**
   * Gets real-time anticipation signals from the backend.
   */
  async getAnticipation() {
    try {
      const response = await fetch(`${API_BASE_URL}/anticipation`);
      if (!response.ok) throw new Error('Failed to fetch anticipation');
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
      const response = await fetch(`${API_BASE_URL}/wake-word/consume`);
      if (!response.ok) throw new Error('Failed to consume wake word');
      return await response.json();
    } catch (error) {
      return { triggered: false, timestamp: 0 };
    }
  }
};
