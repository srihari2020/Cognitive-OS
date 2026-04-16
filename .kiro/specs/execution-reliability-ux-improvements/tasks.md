# Implementation Plan: Execution Reliability & UX Improvements

## Overview

This implementation plan breaks down the execution reliability and UX improvements into discrete coding tasks. The approach follows a layered architecture: input validation → command pipeline → local app mapping → execution engine → response transformation → UI. Each task builds incrementally, with testing integrated throughout to catch errors early.

## Tasks

- [ ] 1. Set up core project structure and interfaces
  - Create TypeScript interfaces for all core components (InputValidator, CommandPipeline, LocalAppMapper, ExecutionEngine, ResponseTransformer)
  - Define data models (Command, ExecutionState, AppRegistry, UIState, Message)
  - Set up testing framework (vitest) with fast-check for property-based testing
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [ ] 2. Implement Input Validator
  - [ ] 2.1 Create InputValidator class with validation logic
    - Implement `validate()` method to check userTriggered flag, empty input, and duplicates
    - Implement `isUserTriggered()` method to verify flag is true
    - Implement `sanitize()` method to trim and normalize input
    - Add duplicate detection with 500ms debounce window
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3_
  
  - [ ]* 2.2 Write property test for user-triggered execution only
    - **Property 1: User-Triggered Execution Only**
    - **Validates: Requirements 1.1, 1.2, 1.4**
  
  - [ ]* 2.3 Write property test for input validation rejection
    - **Property 2: Input Validation Rejects Invalid Input**
    - **Validates: Requirements 2.1**
  
  - [ ]* 2.4 Write property test for duplicate command prevention
    - **Property 3: Duplicate Command Prevention**
    - **Validates: Requirements 2.2**
  
  - [ ]* 2.5 Write property test for input sanitization
    - **Property 4: Input Sanitization**
    - **Validates: Requirements 2.3**

- [ ] 3. Implement Local App Mapper
  - [ ] 3.1 Create LocalAppMapper class with strict command maps
    - Define SYSTEM_APPS, DESKTOP_APPS, and URL_MAP constants with predefined mappings
    - Implement `resolve()` method with priority order: system → desktop → url → scanned
    - Implement case-insensitive matching using lowercase keys
    - Return null for unknown apps (no guessing)
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 25.2_
  
  - [ ] 3.2 Implement app registry management
    - Create AppRegistry data structure with separate maps for each app type
    - Implement `register()` method to add new app commands
    - Implement `getAvailable()` method to list all registered apps
    - Add lastScanAt timestamp for cache expiration
    - _Requirements: 3.6, 25.1, 25.3, 25.4_
  
  - [ ] 3.3 Implement system app scanning
    - Implement `scan()` method to discover installed apps
    - Limit directory recursion depth to 3 levels
    - Cache scan results for 1 hour
    - Skip inaccessible directories silently
    - Limit cached apps to 500 entries
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 17.4_
  
  - [ ]* 3.4 Write property test for strict app mapping determinism
    - **Property 5: Strict App Mapping Determinism**
    - **Validates: Requirements 3.1**
  
  - [ ]* 3.5 Write property test for unknown apps return null
    - **Property 6: Unknown Apps Return Null**
    - **Validates: Requirements 3.2, 3.5**
  
  - [ ]* 3.6 Write property test for case-insensitive app resolution
    - **Property 7: Case-Insensitive App Resolution**
    - **Validates: Requirements 3.4**
  
  - [ ]* 3.7 Write property test for scan cache expiration
    - **Property 27: Scan Cache Expiration**
    - **Validates: Requirements 15.2, 25.4**
  
  - [ ]* 3.8 Write property test for app cache size limit
    - **Property 31: App Cache Size Limit**
    - **Validates: Requirements 17.4**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Execution Engine
  - [ ] 5.1 Create ExecutionEngine class with retry logic
    - Implement `execute()` method to execute commands via Electron bridge
    - Implement `retry()` method with 500ms wait and max 2 attempts
    - Implement `validate()` method to check command validity
    - Add logging for all execution attempts with timestamps
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 26.1, 26.2_
  
  - [ ] 5.2 Implement command execution flow
    - Execute command via child_process.exec (non-blocking)
    - Handle success and failure results
    - Set retry flag when retry succeeds
    - Return ExecutionResult with success, message, error, retried, and attempts
    - _Requirements: 4.4, 4.5, 14.4_
  
  - [ ] 5.3 Add command injection prevention
    - Use whitelist of allowed commands
    - No shell interpolation of user input
    - Use child_process.spawn with array arguments
    - Validate all commands before execution
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 19.2_
  
  - [ ]* 5.4 Write property test for retry attempt limit
    - **Property 8: Retry Attempt Limit**
    - **Validates: Requirements 4.3**
  
  - [ ]* 5.5 Write property test for retry on failure
    - **Property 9: Retry on Failure**
    - **Validates: Requirements 4.1**
  
  - [ ]* 5.6 Write property test for error result on double failure
    - **Property 10: Error Result on Double Failure**
    - **Validates: Requirements 4.2**
  
  - [ ]* 5.7 Write property test for success without retry
    - **Property 11: Success Without Retry**
    - **Validates: Requirements 4.4**
  
  - [ ]* 5.8 Write property test for command whitelist enforcement
    - **Property 32: Command Whitelist Enforcement**
    - **Validates: Requirements 18.2**
  
  - [ ]* 5.9 Write property test for no shell interpolation
    - **Property 33: No Shell Interpolation**
    - **Validates: Requirements 18.3**

- [ ] 6. Implement Response Transformer
  - [ ] 6.1 Create ResponseTransformer class with natural language conversion
    - Define NATURAL_RESPONSES map for success messages
    - Define ERROR_RESPONSES map for error messages
    - Implement `transform()` method to convert AI JSON to natural language
    - Implement `generateNaturalMessage()` method for action-based messages
    - Implement `getTone()` method to return tone setting
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ] 6.2 Add output sanitization
    - Sanitize all output before display
    - Remove JSON syntax from output
    - Ensure no raw technical data is exposed
    - _Requirements: 19.4_
  
  - [ ]* 6.3 Write property test for natural language transformation
    - **Property 12: Natural Language Transformation**
    - **Validates: Requirements 5.1, 5.2**
  
  - [ ]* 6.4 Write property test for success message format
    - **Property 13: Success Message Format**
    - **Validates: Requirements 5.3**
  
  - [ ]* 6.5 Write property test for output sanitization
    - **Property 37: Output Sanitization**
    - **Validates: Requirements 19.4**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Command Pipeline
  - [ ] 8.1 Create CommandPipeline class with orchestration logic
    - Implement `process()` method to handle full command flow
    - Implement `classify()` method to determine command type (app, web, chat, system)
    - Implement `route()` method to route to appropriate handler
    - Add execution state management (isExecuting flag, currentCommand)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 24.1, 24.2, 24.3, 24.4, 24.5_
  
  - [ ] 8.2 Implement error handling for all scenarios
    - Handle app not found (null from LocalAppMapper)
    - Handle execution failure (retry exhausted)
    - Handle AI service unavailable (fallback to keywords)
    - Handle concurrent execution (queue commands)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.3, 12.4_
  
  - [ ] 8.3 Implement command queue management
    - Add commands to queue when isExecuting is true
    - Process next queued command after current completes
    - Clear queue after each command execution
    - Display queue size indicator
    - _Requirements: 1.3, 12.1, 12.3, 17.3_
  
  - [ ] 8.4 Add AI response validation
    - Validate AI responses against allowed action types
    - Perform local validation before execution
    - Log validation decisions
    - _Requirements: 19.1, 19.3, 26.3_
  
  - [ ]* 8.5 Write property test for command classification
    - **Property 14: Command Classification**
    - **Validates: Requirements 6.1**
  
  - [ ]* 8.6 Write property test for app command routing
    - **Property 15: App Command Routing**
    - **Validates: Requirements 6.2**
  
  - [ ]* 8.7 Write property test for null result handling
    - **Property 21: Null Result Handling**
    - **Validates: Requirements 9.1, 9.3**
  
  - [ ]* 8.8 Write property test for AI fallback on failure
    - **Property 22: AI Fallback on Failure**
    - **Validates: Requirements 11.1**
  
  - [ ]* 8.9 Write property test for local commands work without AI
    - **Property 23: Local Commands Work Without AI**
    - **Validates: Requirements 11.4**
  
  - [ ]* 8.10 Write property test for concurrent command queueing
    - **Property 24: Concurrent Command Queueing**
    - **Validates: Requirements 12.1**
  
  - [ ]* 8.11 Write property test for sequential queue processing
    - **Property 25: Sequential Queue Processing**
    - **Validates: Requirements 12.3**
  
  - [ ]* 8.12 Write property test for queue cleared after execution
    - **Property 30: Queue Cleared After Execution**
    - **Validates: Requirements 1.3, 17.3**
  
  - [ ]* 8.13 Write property test for AI response action validation
    - **Property 34: AI Response Action Validation**
    - **Validates: Requirements 19.1**
  
  - [ ]* 8.14 Write property test for command verification before execution
    - **Property 35: Command Verification Before Execution**
    - **Validates: Requirements 19.2**
  
  - [ ]* 8.15 Write property test for local validation of AI commands
    - **Property 36: Local Validation of AI Commands**
    - **Validates: Requirements 19.3**
  
  - [ ]* 8.16 Write property test for execution flag set on start
    - **Property 47: Execution Flag Set on Start**
    - **Validates: Requirements 24.2**
  
  - [ ]* 8.17 Write property test for execution flag cleared on completion
    - **Property 48: Execution Flag Cleared on Completion**
    - **Validates: Requirements 24.3**
  
  - [ ]* 8.18 Write property test for current command set during execution
    - **Property 49: Current Command Set During Execution**
    - **Validates: Requirements 24.4**
  
  - [ ]* 8.19 Write property test for current command null when idle
    - **Property 50: Current Command Null When Idle**
    - **Validates: Requirements 24.5**
  
  - [ ]* 8.20 Write property test for lowercase registry keys
    - **Property 51: Lowercase Registry Keys**
    - **Validates: Requirements 25.2**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Floating Assistant UI component
  - [ ] 10.1 Create FloatingAssistant React component with stable positioning
    - Set up component structure with header, message history, and input controls
    - Implement fixed bottom-right positioning by default
    - Set max width to 300px and max height to 80vh
    - Use solid background (no transparency)
    - Set z-index to 100
    - Hide component on initial render
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 20.1, 20.2_
  
  - [ ] 10.2 Implement draggable functionality
    - Add drag event handlers (onMouseDown, onMouseMove, onMouseUp)
    - Use CSS transforms for GPU-accelerated positioning
    - Constrain drag operations to screen bounds
    - Debounce drag events to 16ms for 60 FPS
    - Maintain position after dragging stops
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 16.1, 16.2, 16.3_
  
  - [ ] 10.3 Implement show/hide toggle functionality
    - Add keyboard shortcut handler for toggle
    - Add toggle button handler
    - Add close button in header
    - Implement visibility state management
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_
  
  - [ ]* 10.4 Write property test for UI width constraint
    - **Property 16: UI Width Constraint**
    - **Validates: Requirements 7.3**
  
  - [ ]* 10.5 Write property test for UI height constraint
    - **Property 17: UI Height Constraint**
    - **Validates: Requirements 7.4**
  
  - [ ]* 10.6 Write property test for drag position updates
    - **Property 18: Drag Position Updates**
    - **Validates: Requirements 8.1**
  
  - [ ]* 10.7 Write property test for drag bounds constraint
    - **Property 19: Drag Bounds Constraint**
    - **Validates: Requirements 8.2**
  
  - [ ]* 10.8 Write property test for position persistence after drag
    - **Property 20: Position Persistence After Drag**
    - **Validates: Requirements 8.5**
  
  - [ ]* 10.9 Write property test for keyboard shortcut toggle
    - **Property 44: Keyboard Shortcut Toggle**
    - **Validates: Requirements 23.2**
  
  - [ ]* 10.10 Write property test for button toggle
    - **Property 45: Button Toggle**
    - **Validates: Requirements 23.3**
  
  - [ ]* 10.11 Write property test for close button hides UI
    - **Property 46: Close Button Hides UI**
    - **Validates: Requirements 23.5**

- [ ] 11. Implement message display and history
  - [ ] 11.1 Create message display components
    - Create Message component with role indicators (user, assistant, system)
    - Add timestamp display for each message
    - Implement scrollable message history container
    - Limit message history to 50 items
    - Auto-scroll to latest message on new message
    - Use React.memo for message components to prevent unnecessary re-renders
    - _Requirements: 16.4, 16.5, 17.2, 21.1, 21.2, 21.3, 21.4, 21.5_
  
  - [ ]* 11.2 Write property test for message history limit
    - **Property 29: Message History Limit**
    - **Validates: Requirements 16.4, 17.2, 21.2**
  
  - [ ]* 11.3 Write property test for auto-scroll on new message
    - **Property 38: Auto-Scroll on New Message**
    - **Validates: Requirements 21.3**
  
  - [ ]* 11.4 Write property test for message role display
    - **Property 39: Message Role Display**
    - **Validates: Requirements 21.4**
  
  - [ ]* 11.5 Write property test for message timestamp display
    - **Property 40: Message Timestamp Display**
    - **Validates: Requirements 21.5**

- [ ] 12. Implement input controls
  - [ ] 12.1 Create input control components
    - Create text input field with Enter key submission
    - Create microphone button for voice input
    - Clear text input after successful submission
    - Add input validation before submission
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_
  
  - [ ]* 12.2 Write property test for Enter key submission
    - **Property 41: Enter Key Submission**
    - **Validates: Requirements 22.3**
  
  - [ ]* 12.3 Write property test for microphone button activation
    - **Property 42: Microphone Button Activation**
    - **Validates: Requirements 22.4**
  
  - [ ]* 12.4 Write property test for input clearing after submission
    - **Property 43: Input Clearing After Submission**
    - **Validates: Requirements 22.5**

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement error boundary
  - [ ] 14.1 Create ErrorBoundary React component
    - Implement componentDidCatch lifecycle method
    - Display fallback UI with "Something went wrong" message
    - Add "Reload" button to fallback UI
    - Log errors with stack traces
    - Prevent full application crash
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 26.5_
  
  - [ ]* 14.2 Write property test for error boundary catches component errors
    - **Property 26: Error Boundary Catches Component Errors**
    - **Validates: Requirements 13.1, 13.5**

- [ ] 15. Integrate all components in App.jsx
  - [ ] 15.1 Wire InputValidator to CommandPipeline
    - Connect input validation to command processing
    - Pass validated input to pipeline
    - Handle validation errors
    - _Requirements: 1.1, 2.1_
  
  - [ ] 15.2 Wire CommandPipeline to LocalAppMapper and ExecutionEngine
    - Connect command classification to app resolution
    - Connect app resolution to execution
    - Handle null results from mapper
    - _Requirements: 3.1, 4.1, 6.2_
  
  - [ ] 15.3 Wire ExecutionEngine to ResponseTransformer
    - Connect execution results to response transformation
    - Transform success and error results
    - Display natural language output in UI
    - _Requirements: 5.1, 6.5_
  
  - [ ] 15.4 Wire FloatingAssistant to CommandPipeline
    - Connect UI input to command pipeline
    - Display pipeline results in message history
    - Handle UI state updates
    - _Requirements: 21.1, 22.1_
  
  - [ ] 15.5 Add ErrorBoundary wrapper
    - Wrap entire app in ErrorBoundary component
    - Ensure error boundary catches all component errors
    - _Requirements: 13.1_

- [ ] 16. Add performance optimizations
  - [ ] 16.1 Optimize command processing latency
    - Ensure command execution starts within 100ms of validated input
    - Use in-memory maps for O(1) app lookups
    - Make input validation synchronous
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ] 16.2 Optimize memory usage
    - Implement message history clearing beyond 50 items
    - Clear execution queue after processing
    - Use WeakMap for temporary state
    - Ensure frontend process uses less than 100MB
    - _Requirements: 17.1, 17.2, 17.3, 17.5_
  
  - [ ] 16.3 Add logging throughout the system
    - Log all execution attempts in ExecutionEngine
    - Log command classification in CommandPipeline
    - Log rejected commands in InputValidator
    - Log all errors with stack traces
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 18. Write integration tests
  - Test end-to-end command flow from input to execution
  - Test error paths (app not found, execution failure, AI unavailable)
  - Test UI interactions (show/hide, drag, input submission)
  - Test concurrent execution prevention
  - Test queue management

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code will be written in TypeScript as specified in the design document
- The implementation follows a layered architecture: validation → pipeline → mapping → execution → transformation → UI
