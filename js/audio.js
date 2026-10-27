// Web Audio API sound generator for tactile feedback and Voice Synthesis (Alice & System)
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('shopping_sound_enabled') !== 'false';
    // By default, voice is MUTED so it does not disturb people in the supermarket!
    this.voiceEnabled = localStorage.getItem('shopping_voice_enabled') === 'true';
    this.voiceEngine = localStorage.getItem('shopping_voice_engine') || 'device'; // 'device' or 'alice'
    this.yandexApiKey = localStorage.getItem('shopping_yandex_api_key') || '';
    this.yandexFolderId = localStorage.getItem('shopping_yandex_folder_id') || '';
    this.yandexEmotion = localStorage.getItem('shopping_yandex_emotion') || 'good';
    
    this.selectedVoice = null;
    this.aliceCache = new Map();
    this.currentAudio = null;

    this.initVoices();
  }

  initVoices() {
    if (!('speechSynthesis' in window)) return;
    const findBestVoice = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const ruVoices = allVoices.filter(v => v.lang && (v.lang.startsWith('ru') || v.lang.includes('RU')));
      const savedURI = localStorage.getItem('shopping_voice_uri');
      if (savedURI && ruVoices.length > 0) {
        const saved = ruVoices.find(v => v.voiceURI === savedURI || v.name === savedURI);
        if (saved) {
          this.selectedVoice = saved;
          return;
        }
      }
      if (ruVoices.length > 0) {
        // Look for pleasant modern natural voices (Google, Milena, Svetlana, etc.)
        this.selectedVoice = ruVoices.find(v => /google|natural|online|svetlana|milena|yuri|yandex/i.test(v.name))
          || ruVoices.find(v => !/pavel/i.test(v.name))
          || ruVoices[0];
      }
    };

    findBestVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = findBestVoice;
    }
  }

  getAvailableVoices() {
    if (!('speechSynthesis' in window)) return [];
    const all = window.speechSynthesis.getVoices();
    return all.filter(v => v.lang && (v.lang.startsWith('ru') || v.lang.includes('RU')));
  }

  setVoice(voiceURI) {
    if (!('speechSynthesis' in window)) return;
    const all = window.speechSynthesis.getVoices();
    const found = all.find(v => v.voiceURI === voiceURI || v.name === voiceURI);
    if (found) {
      this.selectedVoice = found;
      localStorage.setItem('shopping_voice_uri', found.voiceURI || found.name);
    } else {
      this.selectedVoice = null;
      localStorage.removeItem('shopping_voice_uri');
    }
  }

  setEngine(engine) {
    this.voiceEngine = engine;
    localStorage.setItem('shopping_voice_engine', engine);
  }

  setYandexConfig(apiKey, folderId, emotion) {
    this.yandexApiKey = (apiKey || '').trim();
    this.yandexFolderId = (folderId || '').trim();
    this.yandexEmotion = emotion || 'good';
    localStorage.setItem('shopping_yandex_api_key', this.yandexApiKey);
    localStorage.setItem('shopping_yandex_folder_id', this.yandexFolderId);
    localStorage.setItem('shopping_yandex_emotion', this.yandexEmotion);
  }

  toggleVoice() {
    this.voiceEnabled = !this.voiceEnabled;
    localStorage.setItem('shopping_voice_enabled', this.voiceEnabled);
    if (!this.voiceEnabled) {
      this.stopSpeaking();
    }
    return this.voiceEnabled;
  }

  stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Chime when mic starts listening
  playMicStart() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Positive chime when speech is captured & items added
  playItemAdded() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => { // C5, E5, G5 chord
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  // Satisfying pop/click when item is checked
  playItemChecked() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Subtle tap when unchecking
  playItemUnchecked() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.06);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Whoosh when deleting
  playDelete() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Triumphant fanfare when all items in the list are completed
  playAllDoneFanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    const notes = [
      { f: 523.25, d: 0.12, offset: 0 },
      { f: 659.25, d: 0.12, offset: 0.12 },
      { f: 783.99, d: 0.14, offset: 0.24 },
      { f: 1046.50, d: 0.45, offset: 0.38 }
    ];

    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + n.offset;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + n.d + 0.05);
    });
  }

  playAudioUrl(url, delayMs = 0) {
    this.stopSpeaking();
    setTimeout(() => {
      try {
        const audio = new Audio(url);
        this.currentAudio = audio;
        audio.play().catch(e => console.warn('Audio play failed:', e));
      } catch (err) {
        console.warn('Audio instantiation failed:', err);
      }
    }, delayMs);
  }

  async speakAlice(text, delayMs = 0) {
    if (!text) return;
    
    // Check local cache
    const cacheKey = `${text}_${this.yandexEmotion}`;
    if (this.aliceCache.has(cacheKey)) {
      this.playAudioUrl(this.aliceCache.get(cacheKey), delayMs);
      return;
    }

    try {
      // 1. First attempt: call local server proxy /api/tts/yandex
      let response = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        response = await fetch('/api/tts/yandex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            apiKey: this.yandexApiKey,
            folderId: this.yandexFolderId,
            emotion: this.yandexEmotion,
            voice: 'alena'
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (proxyErr) {
        response = null;
      }

      // 2. Second attempt: direct fetch to Yandex Cloud (if proxy not available)
      if (!response || !response.ok) {
        const params = new URLSearchParams({
          text,
          lang: 'ru-RU',
          voice: 'alena',
          emotion: this.yandexEmotion || 'good',
          format: 'mp3'
        });
        if (this.yandexFolderId) {
          params.append('folderId', this.yandexFolderId);
        }

        const authHeader = (this.yandexApiKey.startsWith('AQVN') || !this.yandexApiKey.includes('.'))
          ? `Api-Key ${this.yandexApiKey}`
          : `Bearer ${this.yandexApiKey}`;

        response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });
      }

      if (response && response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        this.aliceCache.set(cacheKey, blobUrl);
        this.playAudioUrl(blobUrl, delayMs);
      } else {
        console.warn('Alice TTS request failed with status:', response ? response.status : 'no response');
        this.speakSystem(text, delayMs);
      }
    } catch (e) {
      console.warn('Alice speech error, falling back to system:', e);
      this.speakSystem(text, delayMs);
    }
  }

  // Voice confirmation via SpeechSynthesis with optional delay
  speakSystem(text, delayMs = 0) {
    if (!('speechSynthesis' in window)) return;
    this.stopSpeaking();
    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        if (this.selectedVoice) {
          utterance.voice = this.selectedVoice;
        }
        // Soft, calm human tempo:
        utterance.rate = 0.96;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error', e);
      }
    }, delayMs);
  }

  // Unified speak method
  speak(text, delayMs = 0) {
    if (!this.enabled || !this.voiceEnabled) return;
    if (this.voiceEngine === 'alice' && this.yandexApiKey) {
      this.speakAlice(text, delayMs);
    } else {
      this.speakSystem(text, delayMs);
    }
  }
}

window.soundEffects = new SoundEffects();
