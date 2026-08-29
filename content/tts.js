/**
 * Antigravity Voice - SpeechEngine
 * Robust wrapper for Chrome's SpeechSynthesis API with:
 * - FIFO queue for sentence-by-sentence streaming
 * - Chrome 15s freeze workaround (keep-alive watchdog)
 * - State callbacks for UI synchronization
 * - User interruption support
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AntigravityTTS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class SpeechEngine {
    constructor() {
      this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
      this.queue = [];
      this.currentUtterance = null;
      this.isSpeaking = false;
      this.isPaused = false;
      this.enabled = true;

      // Settings
      this.voice = null;
      this.voiceName = '';
      this.rate = 1.0;
      this.pitch = 1.0;
      this.volume = 1.0;

      // Event listeners
      this.listeners = {
        stateChange: [],
        sentenceStart: [],
        sentenceEnd: [],
        idle: []
      };

      // Chrome keep-alive timer to prevent the 15-second speech stall bug
      this.keepAliveTimer = null;

      this.initVoices();
    }

    initVoices() {
      if (!this.synth) return;

      const loadVoices = () => {
        const voices = this.synth.getVoices();
        if (voices && voices.length > 0) {
          this.applyVoice();
        }
      };

      loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = loadVoices;
      }
    }

    applyVoice() {
      if (!this.synth) return;
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;

      if (this.voiceName) {
        const found = voices.find(v => v.name === this.voiceName);
        if (found) {
          this.voice = found;
          return;
        }
      }

      // Default preference: Google US English, or any high-quality English voice, or default
      const preferred = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
                        voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural')) ||
                        voices.find(v => v.lang === 'en-US') ||
                        voices.find(v => v.lang.startsWith('en')) ||
                        voices[0];

      this.voice = preferred || null;
    }

    setVoiceByName(name) {
      this.voiceName = name;
      this.applyVoice();
    }

    setRate(rate) {
      this.rate = Math.max(0.5, Math.min(2.5, parseFloat(rate) || 1.0));
    }

    setPitch(pitch) {
      this.pitch = Math.max(0.5, Math.min(1.5, parseFloat(pitch) || 1.0));
    }

    setVolume(volume) {
      this.volume = Math.max(0.0, Math.min(1.0, parseFloat(volume) || 1.0));
    }

    setEnabled(enabled) {
      this.enabled = !!enabled;
      if (!this.enabled) {
        this.stop();
      }
      this.emitState();
    }

    /**
     * Enqueues a clean sentence for speech synthesis
     */
    enqueue(sentence) {
      if (!this.enabled || !this.synth) return;
      if (!sentence || typeof sentence !== 'string') return;

      const trimmed = sentence.trim();
      if (!trimmed) return;

      this.queue.push(trimmed);

      if (!this.isSpeaking && !this.isPaused) {
        this.processQueue();
      }
    }

    processQueue() {
      if (!this.synth || this.queue.length === 0) {
        this.isSpeaking = false;
        this.stopKeepAlive();
        this.emit('idle');
        this.emitState();
        return;
      }

      const text = this.queue.shift();
      const utterance = new SpeechSynthesisUtterance(text);

      if (this.voice) {
        utterance.voice = this.voice;
      }
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.currentUtterance = utterance;
        this.startKeepAlive();
        this.emit('sentenceStart', text);
        this.emitState();
      };

      utterance.onend = () => {
        this.emit('sentenceEnd', text);
        this.currentUtterance = null;
        // Proceed to next sentence in queue
        this.processQueue();
      };

      utterance.onerror = (e) => {
        // Canceled errors are expected when user stops or interrupts
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('[Antigravity TTS] Utterance error:', e.error);
        }
        this.currentUtterance = null;
        this.processQueue();
      };

      this.synth.speak(utterance);
    }

    /**
     * Immediately stops playback and clears the queue
     */
    stop() {
      this.queue = [];
      this.stopKeepAlive();
      if (this.synth) {
        this.synth.cancel();
      }
      this.currentUtterance = null;
      this.isSpeaking = false;
      this.isPaused = false;
      this.emit('idle');
      this.emitState();
    }

    pause() {
      if (this.synth && this.isSpeaking && !this.isPaused) {
        this.synth.pause();
        this.isPaused = true;
        this.stopKeepAlive();
        this.emitState();
      }
    }

    resume() {
      if (this.synth && this.isPaused) {
        this.synth.resume();
        this.isPaused = false;
        this.startKeepAlive();
        this.emitState();
      } else if (!this.isSpeaking && this.queue.length > 0) {
        this.processQueue();
      }
    }

    /**
     * Chrome 15-second speech freeze workaround
     */
    startKeepAlive() {
      this.stopKeepAlive();
      this.keepAliveTimer = setInterval(() => {
        if (this.synth && this.isSpeaking && !this.isPaused) {
          this.synth.pause();
          this.synth.resume();
        }
      }, 10000);
    }

    stopKeepAlive() {
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
    }

    on(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event].push(callback);
      }
    }

    emit(event, data) {
      if (this.listeners[event]) {
        for (const cb of this.listeners[event]) {
          try {
            cb(data);
          } catch (err) {
            console.error('[Antigravity TTS] Callback error:', err);
          }
        }
      }
    }

    emitState() {
      this.emit('stateChange', {
        enabled: this.enabled,
        isSpeaking: this.isSpeaking,
        isPaused: this.isPaused,
        queueLength: this.queue.length,
        rate: this.rate
      });
    }

    getAvailableVoices() {
      return this.synth ? this.synth.getVoices() : [];
    }
  }

  return { SpeechEngine };
});
