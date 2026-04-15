# Implementation Plan: Groq API Integration

## Overview

This implementation plan integrates Groq API as the primary AI provider for the Cognitive OS desktop assistant. The tasks follow a phased approach: first implementing the core Groq provider, then updating the service layer for routing and fallback, adding UI configuration, and finally implementing caching and history management. Each task builds incrementally with validation checkpoints.

## Tasks

- [x] 1. Implement Groq Provider Class
  - [x] 1.1 Create GroqProvider class in aiProviders.js
    - Implement constructor with apiKey parameter
    - Set baseUrl to 'https://api.groq.com/openai/v1/chat/completions'
    - Set name property to 'Groq'
    - _Requirements: 1.1, 1.3_
  
  - [x] 1.2 Implement sendMessage method in GroqProvider
    - Accept messages array and options object with signal
    - Build fetch request with Authorization header and llama3-70b-8192 model
    - Return success object with text, status SUCCESS, and provider name
    - Handle AbortError by re-throwing
    - Return error object with error message, status ERROR, and provider name for other errors
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ]* 1.3 Write property test for GroqProvider response format
    - **Property 1: Provider Response Format Consistency**
    - **Validates: Requirements 1.4, 1.5**
    - Test that all responses (success or error) contain text, status, and provider fields
    - Test that status is either "SUCCESS" or "ERROR"
  
  - [ ]* 1.4 Write unit tests for GroqProvider error handling
    - Test HTTP status codes: 401, 403, 429, 503, 5xx
    - Test AbortError propagation
    - Test response parsing for various formats
    - _Requirements: 1.5, 1.6_

- [x] 2. Register Groq Provider in Provider Registry
  - [x] 2.1 Add GroqProvider to providers object in aiProviders.js
    - Export GroqProvider class
    - Add 'Groq: GroqProvider' entry to providers object
    - _Requirements: 1.1_

- [x] 3. Implement Groq Routing in geminiService
  - [x] 3.1 Add callGroq method to geminiService.js
    - Accept prompt and apiKey parameters
    - Instantiate GroqProvider with apiKey
    - Build messages array with system and user messages
    - Call sendMessage with AbortController signal
    - Return provider response
    - _Requirements: 2.1, 5.3_
  
  - [x] 3.2 Update getProviderConfig to include groqKey
    - Load groqKey from Credential_Manager
    - Add groqKey to returned config object
    - _Requirements: 5.1, 5.2_
  
  - [x] 3.3 Modify ask method to route to Groq when provider is "groq"
    - Check if provider is "groq"
    - Call callGroq with prompt and groqKey
    - Validate groqKey exists, throw "Invalid API key" error if missing
    - _Requirements: 5.3, 5.4_
  
  - [ ]* 3.4 Write unit tests for provider routing logic
    - Test routing to Groq when provider is "groq"
    - Test error when groqKey is missing
    - Test backward compatibility with existing providers
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 4. Implement Provider Fallback Chain
  - [x] 4.1 Implement Groq → Gemini fallback in ask method
    - Wrap callGroq in try-catch
    - On Groq error, check if response status is ERROR
    - Call callGemini as fallback when Groq fails
    - Return Gemini response if successful
    - Return error message if both providers fail
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 4.2 Ensure no fallback occurs on Groq success
    - Return parsed response immediately when Groq succeeds
    - Do not invoke Gemini when Groq returns SUCCESS status
    - _Requirements: 2.4, 2.5_
  
  - [ ]* 4.3 Write property test for fallback chain activation
    - **Property 2: Fallback Chain Activation**
    - **Validates: Requirements 2.2, 7.5**
    - Test that Groq error triggers Gemini fallback
  
  - [ ]* 4.4 Write property test for no fallback on success
    - **Property 3: No Fallback on Success**
    - **Validates: Requirements 2.4, 2.5**
    - Test that Groq success prevents Gemini invocation

- [x] 5. Checkpoint - Ensure core provider and routing work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Retry Logic for Transient Errors
  - [x] 6.1 Add retry logic for 503 status in callGroq
    - Detect 503 status from Groq response
    - Retry up to 2 times with 1 second delay between attempts
    - _Requirements: 7.1_
  
  - [x] 6.2 Add retry logic for 429 status in callGroq
    - Detect 429 status from Groq response
    - Pause requests for 2 seconds
    - Retry up to 2 times
    - _Requirements: 7.2_
  
  - [x] 6.3 Implement no-retry logic for auth errors
    - Detect 401 or 403 status
    - Return "Invalid API key" error immediately without retry
    - _Requirements: 7.3_
  
  - [x] 6.4 Implement no-retry logic for server errors
    - Detect 5xx status (excluding 503)
    - Return "Server error" immediately without retry
    - _Requirements: 7.4_
  
  - [x] 6.5 Trigger fallback after retry exhaustion
    - After all retry attempts fail, invoke Gemini fallback
    - _Requirements: 7.5_
  
  - [ ]* 6.6 Write unit tests for retry logic
    - Test 503 retry with 1 second delay
    - Test 429 retry with 2 second pause
    - Test no-retry for 401, 403, 5xx
    - Test fallback after retry exhaustion
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7. Update Credential Manager for Groq Keys
  - [x] 7.1 Add groqKey field to credential storage schema
    - Update saveKeys method to accept groqKey parameter
    - Include groqKey in keys object before encoding
    - _Requirements: 3.1, 3.2_
  
  - [x] 7.2 Update loadKeys method to return groqKey
    - Decode keys object from localStorage
    - Extract groqKey from decoded object
    - Return groqKey in returned object
    - _Requirements: 3.3_
  
  - [x] 7.3 Handle decoding errors gracefully
    - Wrap decode logic in try-catch
    - Return empty object on decode failure
    - Log error to console
    - _Requirements: 3.4_
  
  - [ ]* 7.4 Write property test for credential round-trip
    - **Property 4: Credential Storage Round-Trip**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Test that saving then loading keys produces equivalent object
    - Verify base64 encoding in localStorage
  
  - [ ]* 7.5 Write property test for multi-provider key persistence
    - **Property 5: Multi-Provider Key Persistence**
    - **Validates: Requirements 3.5**
    - Test that all provider keys (Groq, Gemini, OpenAI, Claude) are preserved

- [x] 8. Update Settings Panel UI
  - [x] 8.1 Add Groq API key input field to SettingsPanel.jsx
    - Add state variable for groqKey
    - Create password input field with placeholder "Groq API Key"
    - Bind input value to groqKey state
    - Update groqKey state on input change
    - _Requirements: 4.1_
  
  - [x] 8.2 Add Groq to provider selection dropdown
    - Add option element with value "groq" and label "Groq"
    - Ensure dropdown value is bound to provider state
    - Update provider state on selection change
    - _Requirements: 4.4, 4.5_
  
  - [x] 8.3 Implement Groq API key validation
    - Validate key format when user enters Groq API key
    - Display validation error if format is invalid
    - _Requirements: 4.2_
  
  - [x] 8.4 Wire save button to persist Groq key
    - Call Credential_Manager.saveKeys with groqKey on save
    - Update provider preference in localStorage
    - _Requirements: 4.3, 4.5_
  
  - [ ]* 8.5 Write property test for API key format validation
    - **Property 6: API Key Format Validation**
    - **Validates: Requirements 4.2**
    - Test that validation correctly identifies valid Groq API key formats
  
  - [ ]* 8.6 Write unit tests for Settings Panel interactions
    - Test input field updates state
    - Test save button persists keys
    - Test provider dropdown updates preference
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

- [x] 9. Checkpoint - Ensure settings and credentials work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Response Parsing
  - [x] 10.1 Create Response_Parser module
    - Implement parseResponse function
    - Accept raw text from provider
    - Return structured object with kind field
    - _Requirements: 6.1_
  
  - [x] 10.2 Implement JSON command detection
    - Strip markdown code fences (```json, ```) from response
    - Attempt to parse JSON from response text
    - Check if parsed object has action and target fields
    - Return command object with kind "command" if valid
    - _Requirements: 6.2, 6.4_
  
  - [x] 10.3 Implement chat fallback for non-JSON responses
    - Return chat object with kind "chat" when JSON parsing fails
    - Return chat object when parsed JSON lacks action/target fields
    - _Requirements: 6.3, 6.5_
  
  - [ ]* 10.4 Write property test for JSON command detection
    - **Property 7: JSON Command Detection**
    - **Validates: Requirements 6.1, 6.2**
    - Test that valid JSON with action/target returns command object
  
  - [ ]* 10.5 Write property test for non-JSON chat fallback
    - **Property 8: Non-JSON Chat Fallback**
    - **Validates: Requirements 6.3**
    - Test that non-JSON text returns chat object
  
  - [ ]* 10.6 Write property test for code fence stripping
    - **Property 9: Code Fence Stripping**
    - **Validates: Requirements 6.4**
    - Test that JSON wrapped in code fences is correctly parsed

- [x] 11. Integrate Response Parser into geminiService
  - [x] 11.1 Import Response_Parser in geminiService.js
    - Add import statement for parseResponse function
    - _Requirements: 6.1_
  
  - [x] 11.2 Call parseResponse in ask method
    - Pass provider response text to parseResponse
    - Return parsed result to caller
    - _Requirements: 2.5, 6.1_
  
  - [ ]* 11.3 Write integration tests for response parsing flow
    - Test end-to-end parsing of command responses
    - Test end-to-end parsing of chat responses
    - Test parsing with both Groq and Gemini providers
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 12. Implement Request Throttling
  - [x] 12.1 Add throttling state to geminiService
    - Track timestamp of last request
    - Track in-flight request promise
    - _Requirements: 8.1_
  
  - [x] 12.2 Enforce 2 second minimum delay between requests
    - Check time since last request in ask method
    - Queue request if within 2 second window
    - Wait for delay before proceeding
    - _Requirements: 8.1, 8.2_
  
  - [x] 12.3 Prevent duplicate in-flight requests
    - Check if request for same input is already in-flight
    - Return existing promise if duplicate detected
    - _Requirements: 8.5_
  
  - [ ]* 12.4 Write unit tests for throttling logic
    - Test 2 second delay enforcement
    - Test request queuing
    - Test duplicate request prevention
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 13. Implement Local Response Caching
  - [x] 13.1 Add cache state to geminiService
    - Track most recent input and response
    - Initialize cache as empty object
    - _Requirements: 8.3_
  
  - [x] 13.2 Check cache before making API call
    - Compare current input to cached input
    - Return cached response if input matches
    - _Requirements: 8.4_
  
  - [x] 13.3 Update cache after successful response
    - Store input and response in cache after parsing
    - _Requirements: 8.3_
  
  - [ ]* 13.4 Write property test for cache hit behavior
    - **Property 10: Cache Hit Behavior**
    - **Validates: Requirements 8.4**
    - Test that consecutive identical requests return cached response
    - Verify no API call is made on cache hit

- [x] 14. Checkpoint - Ensure throttling and caching work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement Conversation History Management
  - [x] 15.1 Add conversation history state to geminiService
    - Initialize history as empty array
    - Set maximum history size to 10 entries
    - _Requirements: 10.1_
  
  - [x] 15.2 Add entries to history after successful response
    - Push user input and assistant response to history
    - _Requirements: 10.2_
  
  - [x] 15.3 Implement history size limit with eviction
    - Check history length after adding entry
    - Remove oldest entry when history exceeds 10 entries
    - _Requirements: 10.1, 10.3_
  
  - [x] 15.4 Implement clearHistory method
    - Reset history array to empty
    - _Requirements: 10.4_
  
  - [x] 15.5 Ensure history is not persisted to localStorage
    - Keep history in memory only
    - Do not save history to localStorage
    - _Requirements: 10.5_
  
  - [ ]* 15.6 Write property test for history size limit with eviction
    - **Property 12: History Size Limit with Eviction**
    - **Validates: Requirements 10.1, 10.3**
    - Test that history never exceeds 10 entries
    - Test that 11th entry triggers removal of oldest entry
  
  - [ ]* 15.7 Write property test for history recording
    - **Property 13: History Recording**
    - **Validates: Requirements 10.2**
    - Test that successful interactions are added to history

- [x] 16. Update Intent Service Integration
  - [x] 16.1 Verify intent_Service calls geminiService.ask
    - Ensure generatePlan method calls geminiService.ask with user input and context
    - _Requirements: 9.1_
  
  - [x] 16.2 Implement plan building from command objects
    - Check if geminiService returns command object (kind "command")
    - Call buildPlanFromCommand with command object
    - Return execution plan
    - _Requirements: 9.2_
  
  - [x] 16.3 Implement chat intent for chat objects
    - Check if geminiService returns chat object (kind "chat")
    - Return intent of "chat" with no plan
    - _Requirements: 9.3_
  
  - [x] 16.4 Maintain compatibility with command normalization
    - Ensure buildPlanFromCommand works with provider responses
    - _Requirements: 9.4, 9.5_
  
  - [ ]* 16.5 Write property test for command to plan conversion
    - **Property 11: Command to Plan Conversion**
    - **Validates: Requirements 9.2**
    - Test that valid command objects generate non-empty execution plans
  
  - [ ]* 16.6 Write integration tests for intent service flow
    - Test end-to-end flow from user input to execution plan
    - Test chat intent handling
    - Test command normalization compatibility
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 17. Final checkpoint - Ensure all components integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end flows across components
- All code examples use JavaScript (ES6+) as specified in the design document
