from src.cache_manager import cache_manager
from src.complexity_analyzer import complexity_analyzer
from src.provider_manager import provider_manager
from src.context_builder import context_builder
from src.logger import logger

class SmartRouter:
    def __init__(self):
        self.cache = cache_manager
        self.complexity_analyzer = complexity_analyzer
        self.provider_manager = provider_manager
        self.context_builder = context_builder

    def get_intent(self, user_input):
        # 1. Check cache first
        cached_intent = self.cache.get(user_input)
        if cached_intent:
            logger.log_event("CACHE_HIT", f"Input: {user_input}")
            return cached_intent
        
        logger.log_event("CACHE_MISS", f"Input: {user_input}")

        # Build context for the current interaction
        context = self.context_builder.build_context()
        logger.log_event("CONTEXT_BUILD", f"Context: {context}")

        # 2. Analyze complexity
        complexity = self.complexity_analyzer.analyze_complexity(user_input)
        logger.log_event("COMPLEXITY_ANALYSIS", f"Complexity: {complexity}")

        # 3. Select provider based on complexity
        if complexity == "LOW":
            return None # Signal to fallback to rule-based

        elif complexity == "MEDIUM":
            providers = self.provider_manager.get_providers_by_tier('fast')
        else: # HIGH complexity
            providers = self.provider_manager.get_providers_by_tier('powerful')

        # 4. Attempt to get intent from selected providers
        for provider in providers:
            logger.log_event("PROVIDER_ATTEMPT", f"Trying provider: {provider.name}")
            intent_data = provider.generate_intent(user_input, context)
            if intent_data:
                self.cache.set(user_input, intent_data)
                return intent_data
            else:
                logger.log_event("PROVIDER_FAIL", f"Provider {provider.name} failed.")

        # 5. Fallback if all tiered providers fail
        logger.log_event("TIER_FAIL", "All providers in the tier failed. Trying other tiers.")
        all_providers = self.provider_manager.get_providers_by_tier('fast') + self.provider_manager.get_providers_by_tier('powerful')
        for provider in all_providers:
            if provider not in providers:
                intent_data = provider.generate_intent(user_input, context)
                if intent_data:
                    self.cache.set(user_input, intent_data)
                    return intent_data

        return None # Signal failure

# Global instance
smart_router = SmartRouter()
