import requests
import json
import os
from abc import ABC, abstractmethod
from src.credentials import load_credentials
from src.logger import logger

# --- Base Provider Class ---
class AIProvider(ABC):
    def __init__(self, name, tier):
        self.name = name
        self.tier = tier  # 'fast' or 'powerful'
        self.api_key = None

    @abstractmethod
    def generate_intent(self, user_input, context=None):
        pass

    def get_system_prompt(self):
        return (
            "You are a world-class intent detection system. "
            "Your task is to classify user input into a specific intent and extract entities. "
            "Allowed intents: OPEN_CODE, OPEN_YOUTUBE, GOOGLE_SEARCH, TYPE_TEXT, UNKNOWN. "
            "For GOOGLE_SEARCH, extract the search term into 'query'. "
            "For TYPE_TEXT, extract the text to be typed into 'text'. "
            "Respond ONLY with valid JSON. Do not include any explanation or extra text."
        )

# --- Concrete Provider Implementations ---
class OllamaProvider(AIProvider):
    def __init__(self, model="mistral", url="http://localhost:11434/api/generate"):
        super().__init__("Ollama", "fast")
        self.model = model
        self.url = url

    def generate_intent(self, user_input, context=None):
        payload = {
            "model": self.model,
            "prompt": f"{self.get_system_prompt()}\n\nUser Input: {user_input}",
            "stream": False,
            "format": "json"
        }
        try:
            response = requests.post(self.url, json=payload, timeout=10)
            response.raise_for_status()
            raw_response = response.json().get("response", "").strip()
            return json.loads(raw_response)
        except (requests.RequestException, json.JSONDecodeError) as e:
            logger.log_error(f"Ollama provider failed: {e}")
            return None

class OpenAIProvider(AIProvider):
    def __init__(self, model="gpt-3.5-turbo"):
        super().__init__("OpenAI", "powerful")
        self.model = model
        self.api_key = load_credentials("OpenAI")
        self.url = "https://api.openai.com/v1/chat/completions"

    def generate_intent(self, user_input, context=None):
        if not self.api_key:
            return None
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.get_system_prompt()},
                {"role": "user", "content": user_input}
            ],
            "response_format": {"type": "json_object"}
        }
        try:
            response = requests.post(self.url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            content = response.json()['choices'][0]['message']['content']
            return json.loads(content)
        except (requests.RequestException, json.JSONDecodeError, KeyError) as e:
            logger.log_error(f"OpenAI provider failed: {e}")
            return None

class GroqProvider(AIProvider):
    def __init__(self, model="llama3-8b-8192"):
        super().__init__("Groq", "fast")
        self.model = model
        self.api_key = load_credentials("Groq")
        self.url = "https://api.groq.com/openai/v1/chat/completions"

    def generate_intent(self, user_input, context=None):
        if not self.api_key:
            return None
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.get_system_prompt()},
                {"role": "user", "content": user_input}
            ],
            "response_format": {"type": "json_object"}
        }
        try:
            response = requests.post(self.url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            content = response.json()['choices'][0]['message']['content']
            return json.loads(content)
        except (requests.RequestException, json.JSONDecodeError, KeyError) as e:
            logger.log_error(f"Groq provider failed: {e}")
            return None

# --- Provider Manager ---
class ProviderManager:
    def __init__(self):
        self.providers = {
            "Ollama": OllamaProvider(),
            "OpenAI": OpenAIProvider(),
            "Groq": GroqProvider(),
        }
        self.active_provider_name = self._get_active_provider_from_config() or "Ollama"
        self._categorize_providers()

    def _categorize_providers(self):
        self.tiered_providers = {'fast': [], 'powerful': []}
        for name, provider in self.providers.items():
            # Provider is available if it's Ollama or has a key
            if name == "Ollama" or provider.api_key:
                self.tiered_providers[provider.tier].append(provider)

    def _get_active_provider_from_config(self):
        config = load_all_credentials()
        return config.get("active_provider")

    def set_active_provider(self, provider_name):
        if provider_name in self.providers:
            self.active_provider_name = provider_name
            config = load_all_credentials()
            config["active_provider"] = provider_name
            with open('config.json', 'w') as f:
                json.dump(config, f)
            # Reload providers and re-categorize
            self.providers["OpenAI"] = OpenAIProvider()
            self.providers["Groq"] = GroqProvider()
            self._categorize_providers()
            return True
        return False

    def get_active_provider(self):
        return self.providers.get(self.active_provider_name)

    def get_providers_by_tier(self, tier):
        """Returns a list of available providers for a given tier."""
        return self.tiered_providers.get(tier, [])

# --- Helper Functions ---
def load_all_credentials():
    if os.path.exists('config.json'):
        with open('config.json', 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

# Global instance
provider_manager = ProviderManager()
