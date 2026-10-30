// Web Audio API sound generator for tactile feedback and Voice Synthesis (Alice & System)
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('shopping_sound_enabled') !== 'false';
    this.hapticsEnabled = localStorage.getItem('shopping_haptics_enabled') !== 'false';
    // By default, voice is MUTED so it does not disturb people in the supermarket!
    this.voiceEnabled = localStorage.getItem('shopping_voice_enabled') === 'true';
    this.voiceEngine = localStorage.getItem('shopping_voice_engine') || 'device'; // 'device' or 'alice'
    // Alice (Yandex TTS) is available when the server has YANDEX_API_KEY configured
    this.aliceAvailable = false;
    // Secrets must never live in the browser: purge keys saved by older versions
    ['shopping_yandex_api_key', 'shopping_yandex_folder_id', 'shopping_gemini_api_key'].forEach(k => localStorage.removeItem(k));
    this.yandexEmotion = localStorage.getItem('shopping_yandex_emotion') || 'good';
    
    this.selectedVoice = null;
    this.aliceCache = new Map();
    this.currentAudio = null;

    this.initVoices();
    this.checkServerConfig();
  }

  async checkServerConfig() {
    try {
      const resp = await fetch('/api/config', { cache: 'no-store' });
      if (resp.ok) {
        const cfg = await resp.json();
        this.aliceAvailable = !!cfg.tts;
      }
    } catch (e) {
      this.aliceAvailable = false;
    }
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

  setYandexEmotion(emotion) {
    this.yandexEmotion = emotion || 'good';
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

  // Haptic vibration feedback for mobile devices
  vibrate(pattern) {
    if (!this.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Safe fail
      }
    }
  }

  // Chime when mic starts listening
  playMicStart() {
    this.vibrate(30);
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
    this.vibrate([25, 35, 25]);
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
    this.vibrate(35);
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
    this.vibrate(18);
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
    this.vibrate([20, 20, 20]);
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
    this.vibrate([45, 45, 45, 45, 120]);
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

  // Melodic crystal bell chime when incoming items/updates arrive from family
  playFamilyBell() {
    this.vibrate([35, 50, 35]);
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Two clear harmonic bell strikes: E6 (1318.51 Hz) then B6 (1975.53 Hz)
    // with metallic harmonics (sine + low-gain overtone) and natural exponential decay
    const bells = [
      { base: 1318.51, overtone: 2637.02, offset: 0.0, dur: 0.55 },
      { base: 1975.53, overtone: 3951.07, offset: 0.12, dur: 0.75 }
    ];

    bells.forEach(b => {
      const t = now + b.offset;

      // Primary tone
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(b.base, t);
      gain1.gain.setValueAtTime(0.001, t);
      gain1.gain.linearRampToValueAtTime(0.18, t + 0.008);
      gain1.gain.exponentialRampToValueAtTime(0.0001, t + b.dur);

      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(t);
      osc1.stop(t + b.dur + 0.05);

      // Shimmering overtone for real crystal/bell timbre
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(b.overtone, t);
      gain2.gain.setValueAtTime(0.001, t);
      gain2.gain.linearRampToValueAtTime(0.04, t + 0.006);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t + b.dur * 0.4);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(t);
      osc2.stop(t + b.dur * 0.4 + 0.05);
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
      // Server-side proxy: the Yandex API key never leaves the server
      let response = null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      try {
        response = await fetch('/api/tts/yandex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, emotion: this.yandexEmotion, voice: 'alena' }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
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
    if (this.voiceEngine === 'alice' && this.aliceAvailable) {
      this.speakAlice(text, delayMs);
    } else {
      this.speakSystem(text, delayMs);
    }
  }
}

window.soundEffects = new SoundEffects();
