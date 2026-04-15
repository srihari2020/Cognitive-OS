/**
 * voiceService.js
 *
 * Single instance voice controller.
 */

let recognition = null;
let isListening = false;

class VoiceService {
  constructor() {
    this.onResult = null;
    this.onStateChange = null;
    this.isSpeaking = false;
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
        if (this.onResult) {
          this.onResult(text);
        }
      };

      recognition.onend = () => {
        isListening = false;
        this.notifyStateChange();
      };

      recognition.onerror = (event) => {
        console.log('Mic error ignored:', event.error);
        isListening = false;
        this.notifyStateChange();
      };
    }
  }

  startListening() {
    if (!recognition) return;
    if (isListening) return;

    try {
      recognition.start();
    } catch (error) {
      console.log('Failed to start recognition (ignored):', error.message);
    }
  }

  stopListening() {
    if (!recognition || !isListening) return;
    recognition.stop();
  }

  speak(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) =>
      voice.name.toLowerCase().includes('female') ||
      voice.name.includes('Google UK English Female') ||
      voice.name.includes('Microsoft Zira') ||
      voice.name.includes('Samantha') ||
      voice.name.includes('Victoria')
    );

    if (preferredVoice) utterance.voice = preferredVoice;
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
        isSpeaking: this.isSpeaking,
      });
    }
  }

  start() { this.startListening(); }
  stop() { this.stopListening(); }
  cancel() {
    window.speechSynthesis.cancel();
    this.stopListening();
  }
}

export const voiceService = new VoiceService();
