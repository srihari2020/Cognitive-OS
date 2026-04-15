import { intentService } from './intentService';
import { runWorkflow } from './executor';
import { voiceService } from './voiceService';

/**
 * commandRouter.js
 * 
 * Unified command router for Cognitive OS.
 * Architecture: UI → commandRouter →
 *   Gemini/Grok (intentService) → handleIntent (execution)
 */

export const commandRouter = {
  route: async (input) => {
    try {
      // 1. Get structured intent from AI (Gemini/Grok)
      const aiResponse = await intentService.generatePlan(input);

      if (!aiResponse || !aiResponse.intent) {
        return { handled: true, message: aiResponse.response || "I’m not sure how to interpret that." };
      }

      // 2. Execute based on validated intent
      if (aiResponse.plan && aiResponse.plan.length > 0) {
        const executionResult = await runWorkflow(aiResponse.plan);
        if (!executionResult.success) {
          voiceService.speak(`I hit an issue during execution: ${executionResult.error}`);
          return { handled: false, message: `Execution failed: ${executionResult.error}` };
        }
      }

      // 3. Return AI's natural response
      if (aiResponse.intent === "chat") {
        return { handled: true, message: aiResponse.response };
      }
      return { handled: true, message: aiResponse.response || "Action completed." };
    } catch (error) {
      return { handled: false, message: error.message || "Network error" };
    }
  }
};

// Remove the handleIntent function as its logic is now in executor.js
// async function handleIntent(aiData) {
//   ...
// }
