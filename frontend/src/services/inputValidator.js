/**
 * inputValidator.js
 * 
 * Validates all commands originate from explicit user actions
 */

const DEBOUNCE_WINDOW_MS = 500;

class InputValidator {
  constructor() {
    this.lastCommand = null;
    this.lastCommandTime = 0;
  }

  /**
   * Validate input and options
   * @param {string} input - User input text
   * @param {Object} options - Input options with userTriggered, source, timestamp
   * @returns {Object} Validation result with valid, sanitized, error
   */
  validate(input, options = {}) {
    // Check userTriggered flag
    if (!this.isUserTriggered(options)) {
      return {
        valid: false,
        sanitized: '',
        error: 'Unauthorized: command not user-triggered',
      };
    }

    // Sanitize input
    const sanitized = this.sanitize(input);

    // Check for empty input
    if (!sanitized) {
      return {
        valid: false,
        sanitized: '',
        error: 'Empty input',
      };
    }

    // Check for duplicate within debounce window
    const now = Date.now();
    if (
      this.lastCommand === sanitized &&
      now - this.lastCommandTime <= DEBOUNCE_WINDOW_MS
    ) {
      return {
        valid: false,
        sanitized,
        error: 'Duplicate command within debounce window',
      };
    }

    // Validate source
    const validSources = ['voice', 'text', 'chat'];
    if (options.source && !validSources.includes(options.source)) {
      return {
        valid: false,
        sanitized,
        error: `Invalid source: ${options.source}`,
      };
    }

    // Update last command tracking
    this.lastCommand = sanitized;
    this.lastCommandTime = now;

    return {
      valid: true,
      sanitized,
      error: null,
    };
  }

  /**
   * Check if command is user-triggered
   * @param {Object} options - Input options
   * @returns {boolean} True if user-triggered
   */
  isUserTriggered(options) {
    return options.userTriggered === true;
  }

  /**
   * Sanitize input text
   * @param {string} input - Raw input text
   * @returns {string} Sanitized input
   */
  sanitize(input) {
    if (typeof input !== 'string') {
      return '';
    }
    return input.trim();
  }

  /**
   * Reset validator state
   */
  reset() {
    this.lastCommand = null;
    this.lastCommandTime = 0;
  }
}

export const inputValidator = new InputValidator();
