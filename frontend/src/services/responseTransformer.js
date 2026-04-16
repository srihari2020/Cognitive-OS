/**
 * responseTransformer.js
 * 
 * Converts AI JSON responses to natural, human-like messages
 */

const NATURAL_RESPONSES = {
  open_app: (target) => `Opening ${target}...`,
  search_web: (target) => `Searching for ${target}...`,
  scroll: (target) => `Scrolling ${target}...`,
  click: (target) => `Clicking ${target}...`,
  type: () => `Typing...`,
};

const ERROR_RESPONSES = {
  open_app: (target) => `Failed to open ${target}`,
  search_web: (target) => `Failed to search for ${target}`,
  default: () => 'Something went wrong',
};

export const responseTransformer = {
  /**
   * Transform AI response to natural language
   * @param {Object} aiResponse - AI response with kind, action, target, message
   * @param {Object} context - Execution context with success flag
   * @returns {string} Natural language message
   */
  transform(aiResponse, context = {}) {
    // If it's a chat response, return as-is
    if (aiResponse.kind === 'chat') {
      return aiResponse.message || '';
    }

    // If it's a command response
    if (aiResponse.kind === 'command') {
      const { action, target } = aiResponse;
      
      // Generate natural message based on success/failure
      if (context.success === false) {
        return this.generateErrorMessage(action, target, context.error);
      }
      
      return this.generateNaturalMessage(action, target);
    }

    // Fallback for unknown response types
    return aiResponse.message || '';
  },

  /**
   * Generate natural language message for successful action
   * @param {string} action - Action type
   * @param {string} target - Action target
   * @returns {string} Natural language message
   */
  generateNaturalMessage(action, target) {
    const generator = NATURAL_RESPONSES[action];
    if (generator) {
      return generator(target);
    }
    return `Executing ${action}...`;
  },

  /**
   * Generate user-friendly error message
   * @param {string} action - Action type
   * @param {string} target - Action target
   * @param {string} error - Error message
   * @returns {string} User-friendly error message
   */
  generateErrorMessage(action, target, error) {
    const generator = ERROR_RESPONSES[action] || ERROR_RESPONSES.default;
    return generator(target);
  },

  /**
   * Get tone setting
   * @returns {string} Tone setting
   */
  getTone() {
    return 'natural';
  },
};
