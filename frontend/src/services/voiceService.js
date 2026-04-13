/**
 * voiceService.js
 * 
 * Handles Speech-to-Text (STT) via Web Speech API and 
 * Text-to-Speech (TTS) via SpeechSynthesis.
 */

class VoiceService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.isActive = false; // Persistent active state
    this.silenceTimer = null;
    this.onTranscript = null;
    this.onCommand = null;
    this.onStateChange = null;
    this.persistent = true; // Default to continuous listening
    
    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.notifyStateChange();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.notifyStateChange();
      // Auto-restart if we want persistent "Hey Jarvis"
      if (this.persistent) this.start();
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const transcript = (finalTranscript || interimTranscript).toLowerCase().trim();
      
      if (this.onTranscript) this.onTranscript(transcript);

      // Wake word check: "arise"
      if (transcript.includes('arise')) {
        const parts = transcript.split('arise');
        const command = parts.length > 1 ? parts.pop().trim() : '';
        
        if (!this.isActive) {
          this.isActive = true;
          this.speak("Hello sir, how can I help you?");
          if (this.onStateChange) this.onStateChange({ isListening: true, isSpeaking: true, isWoken: true, isActive: true });
        }

        if (command && finalTranscript && this.onCommand) {
          this.onCommand(command);
        }
      }

      // Smart Auto Send: If final result, or silence > 1.5s
      if (finalTranscript && this.isActive) {
        this.resetSilenceTimer(finalTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      this.notifyStateChange();
    };
  }

  resetSilenceTimer(text) {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (text && text.length > 2 && this.onCommand) {
        this.onCommand(text);
      }
    }, 1500); // 1.5s silence auto-submit
  }

  start(persistent = true) {
    if (!this.recognition || this.isListening) return;
    this.persistent = persistent;
    // Explicitly set isActive to true if persistent is false (manual trigger)
    if (persistent === false) this.isActive = true;
    try {
      this.recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  }

  stop() {
    if (!this.recognition || !this.isListening) return;
    this.persistent = false;
    this.recognition.stop();
  }

  speak(text, onEnd = null) {
    if (!window.speechSynthesis || !text) return;

    // Interrupt current speech
    this.cancel();
    
    // Explicitly set isActive to true when speaking to show speaking state in UI
    this.isActive = true;
    this.notifyStateChange();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select a female voice if available
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => 
      v.name.toLowerCase().includes("female") || 
      v.name.includes("Google UK English Female") || 
      v.name.includes("Microsoft Zira") ||
      v.name.includes("Samantha")
    );

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.rate = 1.0; // Natural rate
    utterance.pitch = 1.1; // Slightly higher for FRIDAY style
    utterance.volume = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.notifyStateChange();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.notifyStateChange();
      if (onEnd) onEnd();
    };

    speechSynthesis.speak(utterance);
  }

  cancel() {
    if (window.speechSynthesis) {
      speechSynthesis.cancel();
      this.isSpeaking = false;
      this.notifyStateChange();
    }
  }

  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        isListening: this.isListening,
        isSpeaking: this.isSpeaking,
        isActive: this.isActive
      });
    }
  }
}

export const voiceService = new VoiceService();
