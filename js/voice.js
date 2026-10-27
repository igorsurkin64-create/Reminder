// Voice Recognition Manager using Web Speech API (ru-RU)

class VoiceManager {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSupported = false;

    // Callbacks
    this.onStart = null;
    this.onInterim = null;
    this.onFinal = null;
    this.onEnd = null;
    this.onError = null;

    this.init();
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.isSupported = true;
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'ru-RU';
      this.recognition.continuous = false; // We process per phrase for best mobile reliability
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.lastHeardText = '';
      this.hasProcessedFinal = false;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.lastHeardText = '';
        this.hasProcessedFinal = false;
        if (window.soundEffects) {
          window.soundEffects.playMicStart();
        }
        if (this.onStart) this.onStart();
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const candidate = finalTranscript || interimTranscript;
        if (candidate) {
          this.lastHeardText = candidate;
        }

        if (interimTranscript && this.onInterim) {
          this.onInterim(interimTranscript);
        }

        if (finalTranscript) {
          this.hasProcessedFinal = true;
          if (this.onFinal) {
            this.onFinal(finalTranscript);
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        this.isListening = false;
        if (this.onError) {
          this.onError(event.error);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        // Safeguard: If speech stopped without explicit isFinal, still process what was captured!
        if (!this.hasProcessedFinal && this.lastHeardText && this.lastHeardText.trim()) {
          this.hasProcessedFinal = true;
          if (this.onFinal) {
            this.onFinal(this.lastHeardText.trim());
          }
        }
        if (this.onEnd) {
          this.onEnd();
        }
      };
    } else {
      this.isSupported = false;
      console.warn('Web Speech API is not supported in this browser.');
    }
  }

  start() {
    if (!this.isSupported) {
      if (this.onError) {
        this.onError('not_supported');
      }
      return;
    }

    if (this.isListening) {
      this.stop();
      return;
    }

    try {
      this.recognition.start();
    } catch (err) {
      console.error('Error starting recognition:', err);
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.error('Error stopping recognition:', err);
      }
    }
    this.isListening = false;
  }
}

window.VoiceManager = new VoiceManager();
