# Requirements Document: Groq API Integration

## Introduction

This document specifies the requirements for integrating Groq API as the primary AI provider for the Cognitive OS desktop assistant application. The system implements a multi-provider fallback architecture where Groq serves as the primary provider with Gemini as a secondary fallback, maintaining compatibility with the existing provider architecture while optimizing for Groq's fast response times and efficient token usage.

## Glossary

- **Groq_Provider**: The primary AI provider implementation that interfaces with Groq API using the llama3-70b-8192 model
- **Gemini_Provider**: The secondary fallback AI provider implementation that interfaces with Google Gemini API
- **gemini_Service**: The central AI service that manages provider selection, request routing, and response handling
- **intent_Service**: The service that generates execution plans from user input by interfacing with gemini_Service
- **Credential_Manager**: The component responsible for storing and retrieving API keys from localStorage
- **Settings_Panel**: The UI component that allows users to configure API keys and provider preferences
- **Provider_Chain**: The ordered sequence of AI providers attempted for each request (Groq → Gemini)
- **Response_Parser**: The component that converts raw AI responses into structured command or chat objects
- **Local_Cache**: The in-memory cache that stores recent responses to avoid redundant API calls

## Requirements

### Requirement 1: Groq Provider Implementation

**User Story:** As a developer, I want a Groq provider implementation, so that the system can communicate with Groq API for AI operations.

#### Acceptance Criteria

1. THE Groq_Provider SHALL implement the same interface as existing providers (OpenAI, Gemini, Claude)
2. WHEN the Groq_Provider sends a message, THE Groq_Provider SHALL use the llama3-70b-8192 model
3. WHEN the Groq_Provider makes an API request, THE Groq_Provider SHALL use the endpoint https://api.groq.com/openai/v1/chat/completions
4. WHEN the Groq_Provider receives a successful response, THE Groq_Provider SHALL return an object with text, status SUCCESS, and provider name
5. WHEN the Groq_Provider encounters an error, THE Groq_Provider SHALL return an object with error message, status ERROR, and provider name
6. WHEN the Groq_Provider request is aborted, THE Groq_Provider SHALL throw an AbortError

### Requirement 2: Provider Selection and Fallback

**User Story:** As a user, I want the system to automatically fallback to Gemini when Groq fails, so that I receive responses even when the primary provider is unavailable.

#### Acceptance Criteria

1. WHEN gemini_Service receives a request, THE gemini_Service SHALL attempt Groq_Provider first
2. WHEN Groq_Provider returns an error, THE gemini_Service SHALL attempt Gemini_Provider as fallback
3. WHEN both Groq_Provider and Gemini_Provider fail, THE gemini_Service SHALL return an error message to the user
4. WHEN Groq_Provider succeeds, THE gemini_Service SHALL NOT attempt Gemini_Provider
5. WHEN a provider succeeds, THE gemini_Service SHALL parse the response and return the result

### Requirement 3: API Key Management

**User Story:** As a user, I want to securely store my Groq API key, so that I can authenticate with the Groq service without re-entering credentials.

#### Acceptance Criteria

1. THE Credential_Manager SHALL store Groq API keys in localStorage using base64 encoding
2. WHEN a user saves API keys, THE Credential_Manager SHALL encode the keys object and persist it to localStorage
3. WHEN the system loads API keys, THE Credential_Manager SHALL decode the stored value from localStorage
4. WHEN decoding fails, THE Credential_Manager SHALL return an empty object and log the error
5. THE Credential_Manager SHALL support storing multiple provider keys (Groq, Gemini, OpenAI, Claude)

### Requirement 4: Settings Panel Integration

**User Story:** As a user, I want to configure my Groq API key through the settings panel, so that I can enable Groq as my AI provider.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display an input field for Groq API key
2. WHEN a user enters a Groq API key, THE Settings_Panel SHALL validate the key format
3. WHEN a user saves settings, THE Settings_Panel SHALL call Credential_Manager to persist the Groq API key
4. THE Settings_Panel SHALL display the current provider selection (Groq, Gemini, OpenAI, Claude)
5. WHEN a user selects Groq as the provider, THE Settings_Panel SHALL update the provider preference in localStorage

### Requirement 5: Request Routing and Provider Configuration

**User Story:** As a developer, I want the system to route requests to the configured provider, so that user preferences are respected.

#### Acceptance Criteria

1. WHEN gemini_Service initializes, THE gemini_Service SHALL read the provider configuration from localStorage
2. THE provider configuration SHALL include provider name and API keys for all supported providers
3. WHEN the provider is set to "groq", THE gemini_Service SHALL use Groq_Provider as the primary provider
4. WHEN the Groq API key is missing, THE gemini_Service SHALL throw an "Invalid API key" error
5. THE gemini_Service SHALL maintain backward compatibility with existing provider selection logic

### Requirement 6: Response Parsing

**User Story:** As a developer, I want consistent response parsing across all providers, so that downstream services receive uniform data structures.

#### Acceptance Criteria

1. WHEN Response_Parser receives raw text from any provider, THE Response_Parser SHALL detect JSON command objects
2. WHEN the response contains a JSON object with action and target fields, THE Response_Parser SHALL return a command object with kind "command"
3. WHEN the response does not contain valid JSON, THE Response_Parser SHALL return a chat object with kind "chat"
4. THE Response_Parser SHALL strip markdown code fences (```json, ```) from responses before parsing
5. WHEN parsing fails, THE Response_Parser SHALL treat the response as a chat message

### Requirement 7: Error Handling and Retry Logic

**User Story:** As a user, I want the system to handle temporary failures gracefully, so that transient errors don't disrupt my workflow.

#### Acceptance Criteria

1. WHEN Groq_Provider receives a 503 status, THE gemini_Service SHALL retry up to 2 times with 1 second delay
2. WHEN Groq_Provider receives a 429 status, THE gemini_Service SHALL pause requests for 2 seconds and retry up to 2 times
3. WHEN Groq_Provider receives a 401 or 403 status, THE gemini_Service SHALL return "Invalid API key" error without retry
4. WHEN Groq_Provider receives a 5xx status (other than 503), THE gemini_Service SHALL return "Server error" without retry
5. WHEN all retry attempts are exhausted, THE gemini_Service SHALL fallback to Gemini_Provider

### Requirement 8: Request Throttling and Caching

**User Story:** As a developer, I want to prevent excessive API calls, so that the system respects rate limits and reduces costs.

#### Acceptance Criteria

1. THE gemini_Service SHALL enforce a minimum 2 second delay between consecutive requests
2. WHEN a request is made within 2 seconds of the previous request, THE gemini_Service SHALL queue it
3. THE gemini_Service SHALL maintain a Local_Cache of the most recent response
4. WHEN the same input is requested twice consecutively, THE gemini_Service SHALL return the cached response
5. THE gemini_Service SHALL prevent duplicate in-flight requests for the same input

### Requirement 9: Intent Service Integration

**User Story:** As a user, I want my commands to be processed through the Groq provider, so that I benefit from faster response times.

#### Acceptance Criteria

1. WHEN intent_Service generates a plan, THE intent_Service SHALL call gemini_Service with user input and context
2. WHEN gemini_Service returns a command object, THE intent_Service SHALL build an execution plan from the command
3. WHEN gemini_Service returns a chat object, THE intent_Service SHALL return an intent of "chat" with no plan
4. THE intent_Service SHALL pass the provider response to buildPlanFromCommand for action execution
5. THE intent_Service SHALL maintain compatibility with existing command normalization logic

### Requirement 10: Conversation History Management

**User Story:** As a user, I want the system to maintain conversation context, so that follow-up questions are understood correctly.

#### Acceptance Criteria

1. THE gemini_Service SHALL maintain a conversation history with a maximum of 10 entries
2. WHEN a response is parsed successfully, THE gemini_Service SHALL add the user input and assistant response to history
3. WHEN the history exceeds 10 entries, THE gemini_Service SHALL remove the oldest entry
4. THE gemini_Service SHALL provide a method to clear conversation history
5. THE conversation history SHALL be stored in memory and not persisted to localStorage
