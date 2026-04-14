/**
 * voiceService.js
 * 
 * Single Instance Voice Controller for FRIDAY.
 */

import { allowExecution } from './executor';

let recognition = null;
let isListening = false;

class VoiceService {
  constructor() {
    this.onResult = null;
    this.initVoice();
  }

  initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!recognition && SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        isListening = true;
        this.notifyStateChange();
      };

      recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        
        // Wake word check
        if (text.includes("arise")) {
          allowExecution(); // 🔥 Unlock execution for the next command
          this.speak("Hello sir, how can I help you?");
          return;
        }

        if (this.onResult) {
          this.onResult(text);
        }
      };

      recognition.onend = () => {
        isListening = false;
        this.notifyStateChange();
      };

      recognition.onerror = (event) => {
        console.log("Mic error ignored:", event.error);
        isListening = false;
        this.notifyStateChange();
      };
    }
  }

  startListening() {
    if (!recognition) return;
    if (isListening) {
      console.log("Already listening, ignoring start request");
      return;
    }
    try {
      recognition.start();
      // Note: isListening is updated in onstart
    } catch (e) {
      console.log('Failed to start recognition (ignored):', e.message);
    }
  }

  stopListening() {
    if (!recognition || !isListening) return;
    recognition.stop();
    // Note: isListening is updated in onend
  }

  speak(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    // Prefer a female voice for FRIDAY persona
    const femaleVoice = voices.find(v => 
      v.name.toLowerCase().includes("female") || 
      v.name.includes("Google UK English Female") || 
      v.name.includes("Microsoft Zira") ||
      v.name.includes("Samantha") ||
      v.name.includes("Victoria")
    );

    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.1;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.notifyStateChange();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.notifyStateChange();
    };

    window.speechSynthesis.speak(utterance);
  }

  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        isListening,
        isSpeaking: this.isSpeaking
      });
    }
  }

  // Compatibility methods for existing code
  start() { this.startListening(); }
  stop() { this.stopListening(); }
  cancel() { window.speechSynthesis.cancel(); this.stopListening(); }
}

export const voiceService = new VoiceService();
