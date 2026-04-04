/**
 * predictor.js
 * 
 * Analyzes the contextStore history and current system state to generate
 * dynamic, proactive command suggestions.
 */
import { contextStore } from './contextStore';
import { commandService } from './api';

export const predictor = {
  getPredictions: async () => {
    const history = contextStore.getHistory();
    const idleMs = contextStore.getIdleTimeMs();
    const freqMap = contextStore.getFrequencyMap();
    const activeApp = contextStore.getActiveApp();
    
    let predictions = [];
    
    // 1. AI-Assisted Prediction (Step 5 - Optional)
    if (idleMs > 15000 && !commandService.isOffline()) {
      try {
        const aiResponse = await commandService.getAIPredictions(history);
        if (aiResponse && aiResponse.predictions) {
          predictions = aiResponse.predictions.map(p => ({ ...p, isProactive: true }));
        }
      } catch (_) {
        // Fallback to local prediction
      }
    }

    // 2. Idle logic (High level suggestion)
    if (predictions.length === 0 && idleMs > 30000) { // 30s idle
      predictions.push({
        text: "Need a hand with something?",
        action: "suggest tasks",
        intent: "SYNC",
        icon: "Sparkles",
        isProactive: true
      });
    }

    // 3. Pattern analysis if we have history
    if (history.length > 0) {
      const recent = history[0];
      const recentRawPattern = recent.raw.toLowerCase();
      
      // Frequent VS Code usage logic
      const vsCodeCount = freqMap['code'] || freqMap['vs code'] || freqMap['open vscode'] || 0;
      if (vsCodeCount >= 2 || activeApp.toLowerCase().includes('vscode')) {
        predictions.push({
          text: "Continue coding?",
          action: "open vscode",
          intent: "OPEN_CODE",
          icon: "Code",
          isProactive: true
        });
      }

      // Search pattern
      const searchCount = Object.keys(freqMap).filter(k => k.includes('search')).length;
      if (searchCount >= 2) {
        predictions.push({
          text: "Quick search?",
          action: "search google for ",
          intent: "GOOGLE_SEARCH",
          icon: "Search",
          isProactive: false
        });
      }

      // Contextual Follow-up logic
      if (recentRawPattern.includes('search')) {
        // If they just searched, maybe open chrome to explore deeper
        if (idleMs > 5000) {
          predictions.push({
             text: `Continue researching?`,
             action: `open chrome`,
             intent: "OPEN_CODE",
             icon: "Globe",
             isProactive: false
          });
        }
      } else if (recentRawPattern.includes('youtube')) {
         if (idleMs > 6000) {
            predictions.push({
               text: `Find more videos?`,
               action: `search google for videos`,
               intent: "GOOGLE_SEARCH",
               icon: "Globe",
               isProactive: false
            });
         }
      }

      // Add recent resume option if idle
      if (predictions.length < 2 && idleMs > 3000) {
        predictions.push({
           text: `Resume: ${recent.raw.length > 15 ? recent.raw.substring(0, 15) + '...' : recent.raw}`,
           action: `Resume execution: ${recent.raw}`, // Label logic, we can just execute the raw
           executeRaw: recent.raw,
           intent: "DEFAULT",
           icon: "Sparkles",
           isProactive: false
        });
      }
    }

    // AI-Assisted Prediction (Optional/External)
    // In a real scenario, this would call an AI service
    // if (idleMs > 15000 && predictions.length < 2) {
    //   const aiSuggestions = await this.getAISuggestions(history);
    //   predictions = [...predictions, ...aiSuggestions];
    // }

    // Default Fallbacks
    const defaults = [
      { text: "Check System", executeRaw: "system info", intent: "STATUS", icon: "Cpu", isProactive: false },
      { text: "Open Files", executeRaw: "open files", intent: "OPEN_CODE", icon: "Settings", isProactive: false },
      { text: "Google Search", executeRaw: "search google for ", intent: "GOOGLE_SEARCH", icon: "Globe", isProactive: false },
      { text: "Launch Browser", executeRaw: "open chrome", intent: "OPEN_CODE", icon: "Globe", isProactive: false }
    ];

    defaults.forEach(def => {
      if (predictions.length < 3 && !predictions.some(p => p.executeRaw === def.executeRaw || p.action === def.executeRaw || p.text === def.text)) {
        predictions.push(def);
      }
    });

    return predictions.slice(0, 3);
  }
};
