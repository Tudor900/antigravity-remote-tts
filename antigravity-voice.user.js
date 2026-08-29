// ==UserScript==
// @name         Antigravity Voice - AI Chat Text-to-Speech
// @namespace    https://antigravity.google.com/
// @version      1.0.5
// @description  Streaming sentence-by-sentence text-to-speech for Antigravity Remote AI chat responses.
// @author       Antigravity Pair Programmer
// @match        https://antigravity.google.com/r/*
// @match        https://antigravity.google.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/**
 * Antigravity Voice - Standalone Injectable Script
 * Run this directly in Chrome DevTools Console or as a Bookmarklet/Userscript
 * on https://antigravity.google.com/r/*
 */
(function() {
  'use strict';
  
  if (window.__ANTIGRAVITY_VOICE_LOADED__) {
    console.log('[Antigravity Voice] Already running!');
    return;
  }
  window.__ANTIGRAVITY_VOICE_LOADED__ = true;

  const styleEl = document.createElement('style');
  styleEl.id = 'antigravity-voice-styles';
  styleEl.textContent = "/* Antigravity Voice Floating Control Pill */\n#agy-voice-pill {\n  position: fixed;\n  bottom: 24px;\n  right: 24px;\n  z-index: 999999;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  background: rgba(28, 30, 36, 0.88);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  border-radius: 28px;\n  padding: 6px 14px;\n  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\n  font-size: 13px;\n  color: #f1f3f4;\n  user-select: none;\n  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);\n}\n\n#agy-voice-pill:hover {\n  background: rgba(35, 38, 46, 0.96);\n  border-color: rgba(255, 255, 255, 0.22);\n  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);\n}\n\n#agy-voice-pill.agy-muted {\n  opacity: 0.75;\n  border-color: rgba(255, 255, 255, 0.08);\n}\n\n/* Status Indicator & Sound Wave */\n.agy-voice-indicator {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding-right: 4px;\n}\n\n.agy-voice-waves {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  height: 16px;\n}\n\n.agy-voice-wave {\n  width: 3px;\n  height: 6px;\n  background: #1a73e8;\n  border-radius: 2px;\n  transition: height 0.15s ease;\n}\n\n#agy-voice-pill.agy-speaking .agy-voice-wave:nth-child(1) {\n  animation: agy-wave-anim 0.8s ease-in-out infinite 0.1s;\n}\n#agy-voice-pill.agy-speaking .agy-voice-wave:nth-child(2) {\n  animation: agy-wave-anim 0.8s ease-in-out infinite 0.3s;\n}\n#agy-voice-pill.agy-speaking .agy-voice-wave:nth-child(3) {\n  animation: agy-wave-anim 0.8s ease-in-out infinite 0.2s;\n}\n\n@keyframes agy-wave-anim {\n  0%, 100% { height: 4px; background: #8ab4f8; }\n  50% { height: 16px; background: #4285f4; }\n}\n\n.agy-voice-status-text {\n  font-weight: 500;\n  color: #e8eaed;\n  min-width: 58px;\n}\n\n/* Action Buttons */\n.agy-voice-btn {\n  background: rgba(255, 255, 255, 0.08);\n  border: none;\n  border-radius: 14px;\n  color: #e8eaed;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  padding: 4px 8px;\n  font-size: 12px;\n  font-weight: 500;\n  transition: background 0.15s ease, transform 0.1s ease;\n}\n\n.agy-voice-btn:hover {\n  background: rgba(255, 255, 255, 0.16);\n  transform: translateY(-1px);\n}\n\n.agy-voice-btn:active {\n  transform: translateY(0);\n}\n\n.agy-voice-btn.agy-stop-btn {\n  background: rgba(234, 67, 53, 0.2);\n  color: #f28b82;\n}\n\n.agy-voice-btn.agy-stop-btn:hover {\n  background: rgba(234, 67, 53, 0.35);\n  color: #fce8e6;\n}\n\n.agy-voice-btn.agy-rate-btn {\n  min-width: 42px;\n}\n\n.agy-voice-btn svg {\n  width: 14px;\n  height: 14px;\n  fill: currentColor;\n}\n";
  document.head.appendChild(styleEl);

  /**
 * Antigravity Voice - TextCleaner & SentenceStreamer
 * Prepares AI chat responses for speech synthesis by:
 * 1. Filtering code blocks and announcing file names.
 * 2. Stripping markdown formatting and technical noise.
 * 3. Segmenting streaming text into clean, natural sentences.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AntigravityCleaner = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Common abbreviations to protect from false sentence splits
  const ABBREVIATIONS = new Set([
    'e.g', 'i.e', 'etc', 'vs', 'fig', 'dr', 'mr', 'mrs', 'ms', 'prof',
    'inc', 'ltd', 'co', 'dept', 'approx', 'est', 'min', 'sec', 'vol', 'al'
  ]);

  // Common programming languages for announcement fallback
  const LANGUAGE_NAMES = {
    'js': 'JavaScript',
    'javascript': 'JavaScript',
    'ts': 'TypeScript',
    'typescript': 'TypeScript',
    'py': 'Python',
    'python': 'Python',
    'html': 'HTML',
    'css': 'CSS',
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'sh': 'Bash',
    'bash': 'Bash',
    'zsh': 'Z-shell',
    'shell': 'Shell script',
    'sql': 'SQL',
    'go': 'Go',
    'golang': 'Go',
    'rs': 'Rust',
    'rust': 'Rust',
    'cpp': 'C++',
    'c': 'C',
    'java': 'Java',
    'kt': 'Kotlin',
    'kotlin': 'Kotlin',
    'swift': 'Swift',
    'dart': 'Dart',
    'dockerfile': 'Dockerfile',
    'md': 'Markdown',
    'xml': 'XML'
  };

  /**
   * Cleans code blocks and replaces them with clean announcements
   * Format: "Code for filename.ext" or "Code snippet in Language"
   */
  function processCodeBlocks(markdown, options = { announceFiles: true }) {
    if (!markdown) return '';

    // Match fenced code blocks: ```[lang][:filename] [code] ```
    // Also captures code blocks that may still be streaming (unclosed at the end)
    const codeBlockRegex = /```([a-zA-Z0-9_+#.-]*)(?::([^\n]+))?\n([\s\S]*?)(?:```|$)/g;

    return markdown.replace(codeBlockRegex, (match, lang, fileTag, codeBody) => {
      if (options && options.announceFiles === false) {
        return ' ';
      }

      let filename = '';
      let language = (lang || '').trim().toLowerCase();

      if (fileTag) {
        filename = fileTag.trim();
      }

      // Check if first line of code contains a filename hint
      // e.g. // filename: index.js or # test.py or // file: main.go
      if (!filename && codeBody) {
        const firstLineMatch = codeBody.trim().match(/^(?:(?:\/\/|#|\/\*|<!--)\s*(?:file(?:name)?|path)?[:\s]+([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9_]+))/i);
        if (firstLineMatch) {
          filename = firstLineMatch[1].trim();
        }
      }

      // If filename has a path, take the basename
      if (filename) {
        filename = filename.split('/').pop().split('\\').pop();
      }

      // Format announcement
      if (filename) {
        return ` [Code for ${filename}.] `;
      } else if (language && LANGUAGE_NAMES[language]) {
        return ` [Code snippet in ${LANGUAGE_NAMES[language]}.] `;
      } else if (language) {
        return ` [Code snippet in ${language}.] `;
      } else {
        return ` [Code snippet.] `;
      }
    });
  }

  /**
   * Cleans markdown and web formatting for TTS readability
   */
  function cleanMarkdown(text, options = { announceFiles: true }) {
    if (!text) return '';

    let cleaned = text;

    // 1. Process code blocks and strip non-user content
    cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    cleaned = cleaned.replace(/<(thought|thinking)[\s\S]*?<\/(thought|thinking)>/gi, ' ');
    cleaned = cleaned.replace(/^(?:thought|thinking\s*process):?[\s\S]*?(?:\n\n+|$)/im, ' ');
    cleaned = processCodeBlocks(cleaned, options);

    // 2. Normalize markdown headers (# Header -> Header.)
    cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '$1.');

    // 3. Remove horizontal rules
    cleaned = cleaned.replace(/^[\s*-=_]{3,}$/gm, ' ');

    // 4. Convert markdown links: [text](url) -> text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 5. Convert standalone file:/// links: file:///path/to/file.ext -> file.ext
    cleaned = cleaned.replace(/file:\/\/\/[^\s)]+\/([a-zA-Z0-9_\-.]+)/g, '$1');

    // 6. Clean raw URLs so TTS doesn't spell them out
    cleaned = cleaned.replace(/https?:\/\/([a-zA-Z0-9\-.]+\.[a-zA-Z]{2,})(\/[^\s]*)?/g, (match, domain) => {
      return `link to ${domain.replace(/^www\./, '')}`;
    });

    // 7. Strip bold and italics: **text** -> text, *text* -> text
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
    cleaned = cleaned.replace(/(^|[^\w])\*([^*]+)\*([^\w]|$)/g, '$1$2$3');
    cleaned = cleaned.replace(/(^|[^\w])_([^_]+)_([^\w]|$)/g, '$1$2$3');

    // 8. Handle inline code: `code` -> clean pause / readable text
    cleaned = cleaned.replace(/`([^`]+)`/g, (match, code) => {
      return code.trim();
    });

    // 9. Convert bullet points and numbered lists to pauses
    cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, ' ');
    cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, ' ');

    // 10. Clean blockquotes (> quote -> quote)
    cleaned = cleaned.replace(/^>\s*/gm, '');

    // 11. Clean LaTeX math delimiters
    cleaned = cleaned.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
    cleaned = cleaned.replace(/\\\[([\s\S]*?)\\\]/g, '$1');
    cleaned = cleaned.replace(/\\\(([\s\S]*?)\\\)/g, '$1');
    cleaned = cleaned.replace(/\\\$|\$/g, ' dollar ');

    // 12. Collapse excessive whitespace and normalize line breaks
    cleaned = cleaned.replace(/\r\n|\r/g, '\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n\s*\n+/g, '. ');
    cleaned = cleaned.replace(/\n+/g, ' ');

    // 13. Clean any multiple periods or orphan brackets
    cleaned = cleaned.replace(/\.{2,}/g, '.');
    cleaned = cleaned.replace(/\[\s*|\s*\]/g, ' ');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');

    return cleaned.trim();
  }

  /**
   * Helper to check if a period at index is part of an abbreviation or decimal number
   */
  function isFalseBoundary(text, dotIndex) {
    if (dotIndex > 0 && dotIndex < text.length - 1) {
      const prevChar = text[dotIndex - 1];
      const nextChar = text[dotIndex + 1];
      if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
        return true;
      }
    }

    const before = text.slice(Math.max(0, dotIndex - 10), dotIndex).trim().toLowerCase();
    const abbrevMatch = before.match(/([a-z]+(?:\.[a-z]+)?)$/);
    if (abbrevMatch && (ABBREVIATIONS.has(abbrevMatch[1]) || abbrevMatch[1].length === 1)) {
      return true;
    }

    if (/v\d+$/i.test(before)) {
      return true;
    }

    if (text[dotIndex + 1] === '.' || (dotIndex > 0 && text[dotIndex - 1] === '.')) {
      return true;
    }

    return false;
  }

  /**
   * SentenceStreamer: Handles streaming chunks of text, extracting complete sentences
   * while keeping trailing incomplete fragments in buffer until more chunks arrive.
   */
  class SentenceStreamer {
    constructor(options = { announceFiles: true }) {
      this.options = options;
      this.buffer = '';
      this.processedSentences = [];
    }

    setOptions(options) {
      this.options = Object.assign(this.options || {}, options);
    }

    reset() {
      this.buffer = '';
      this.processedSentences = [];
    }

    feed(newChunk) {
      if (!newChunk) return [];

      this.buffer += newChunk;

      const readySentences = [];
      let searchIdx = 0;

      while (searchIdx < this.buffer.length) {
        const match = this.buffer.slice(searchIdx).match(/[.!?]\s+|(\n\n+)/);
        if (!match) break;

        const matchOffset = searchIdx + match.index;
        const punctChar = this.buffer[matchOffset];
        const matchLen = match[0].length;

        if (punctChar === '.' && isFalseBoundary(this.buffer, matchOffset)) {
          searchIdx = matchOffset + 1;
          continue;
        }

        const rawSentence = this.buffer.slice(0, matchOffset + (punctChar ? 1 : 0));
        this.buffer = this.buffer.slice(matchOffset + matchLen);
        searchIdx = 0;

        const cleanSentence = cleanMarkdown(rawSentence, this.options);
        if (cleanSentence && cleanSentence.length > 1) {
          readySentences.push(cleanSentence);
          this.processedSentences.push(cleanSentence);
        }
      }

      return readySentences;
    }

    flush() {
      const remaining = this.buffer.trim();
      this.buffer = '';

      if (!remaining) return [];

      const cleanSentence = cleanMarkdown(remaining, this.options);
      if (cleanSentence && cleanSentence.length > 1) {
        this.processedSentences.push(cleanSentence);
        return [cleanSentence];
      }
      return [];
    }
  }

  return {
    processCodeBlocks,
    cleanMarkdown,
    isFalseBoundary,
    SentenceStreamer
  };
});

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

  /**
 * Antigravity Voice - Floating UI Widget
 * Provides a floating pill for real-time status and playback controls:
 * - Cross-frame postMessage synchronization
 * - Animated soundwaves when speaking
 * - Stop / Silence button (Esc)
 * - Mute / Unmute auto-TTS
 * - Speed multiplier cycling
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AntigravityUI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class FloatingUI {
    constructor(speechEngine) {
      this.engine = speechEngine;
      this.element = null;
      this.statusTextEl = null;
      this.muteBtn = null;
      this.stopBtn = null;
      this.rateBtn = null;

      this.speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.8];
      this.speedIndex = 0;

      this.init();
    }

    init() {
      // If we are in an iframe, do not create a second duplicate pill — sync with parent via postMessage
      if (window !== window.top) {
        this.setupIframeSync();
        return;
      }

      if (document.getElementById('agy-voice-pill')) return;

      const pill = document.createElement('div');
      pill.id = 'agy-voice-pill';
      pill.innerHTML = `
        <div class="agy-voice-indicator" style="cursor: pointer;" title="Click to test voice">
          <div class="agy-voice-waves">
            <span class="agy-voice-wave"></span>
            <span class="agy-voice-wave"></span>
            <span class="agy-voice-wave"></span>
          </div>
          <span class="agy-voice-status-text">Idle</span>
        </div>
        <button class="agy-voice-btn agy-stop-btn" title="Stop speech (Esc)">
          <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
        </button>
        <button class="agy-voice-btn agy-mute-btn" title="Toggle Auto-TTS">
          <svg class="agy-icon-unmuted" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        </button>
        <button class="agy-voice-btn agy-rate-btn" title="Playback speed">1.0x</button>
      `;

      document.body.appendChild(pill);
      this.element = pill;
      this.statusTextEl = pill.querySelector('.agy-voice-status-text');
      this.stopBtn = pill.querySelector('.agy-stop-btn');
      this.muteBtn = pill.querySelector('.agy-mute-btn');
      this.rateBtn = pill.querySelector('.agy-rate-btn');

      this.bindEvents();
      this.enableDrag(pill);

      // Listen for local engine changes
      this.engine.on('stateChange', (state) => this.renderState(state));

      // Listen for cross-frame messages from child iframe
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'AGY_VOICE_STATE') {
          this.renderState(e.data.state);
        }
      });
    }

    setupIframeSync() {
      // In child iframe: forward all state changes to parent window
      this.engine.on('stateChange', (state) => {
        try {
          window.parent.postMessage({ type: 'AGY_VOICE_STATE', state }, '*');
        } catch (e) {}
      });

      // Listen for commands from parent pill
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'AGY_VOICE_CMD') {
          if (e.data.action === 'stop') this.engine.stop();
          if (e.data.action === 'setRate') this.engine.setRate(e.data.rate);
          if (e.data.action === 'setEnabled') this.engine.setEnabled(e.data.enabled);
        }
      });
    }

    broadcastCommand(action, data = {}) {
      const payload = Object.assign({ type: 'AGY_VOICE_CMD', action }, data);
      window.postMessage(payload, '*');
      document.querySelectorAll('iframe').forEach(f => {
        try {
          f.contentWindow?.postMessage(payload, '*');
        } catch (e) {}
      });
    }

    bindEvents() {
      // Audio test on pill indicator click
      const indicator = this.element.querySelector('.agy-voice-indicator');
      if (indicator) {
        indicator.addEventListener('click', () => {
          if (window.speechSynthesis) {
            window.speechSynthesis.resume();
          }
          this.engine.enqueue('Antigravity voice connected.');
          this.broadcastCommand('testVoice');
        });
      }

      // Stop button
      this.stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engine.stop();
        this.broadcastCommand('stop');
      });

      // Mute toggle
      this.muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextEnabled = !this.engine.enabled;
        this.engine.setEnabled(nextEnabled);
        this.broadcastCommand('setEnabled', { enabled: nextEnabled });
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ enabled: nextEnabled });
        }
      });

      // Speed cycle
      this.rateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.speedIndex = (this.speedIndex + 1) % this.speeds.length;
        const newSpeed = this.speeds[this.speedIndex];
        this.engine.setRate(newSpeed);
        this.rateBtn.textContent = `${newSpeed}x`;
        this.broadcastCommand('setRate', { rate: newSpeed });
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ rate: newSpeed });
        }
      });

      // Keyboard shortcut: Escape immediately stops speech
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.engine.stop();
          this.broadcastCommand('stop');
        }
      });
    }

    renderState(state) {
      if (!this.element) return;

      if (!state.enabled) {
        this.element.classList.add('agy-muted');
        this.element.classList.remove('agy-speaking');
        this.statusTextEl.textContent = 'Muted';
        this.muteBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
      } else if (state.isSpeaking) {
        this.element.classList.remove('agy-muted');
        this.element.classList.add('agy-speaking');
        this.statusTextEl.textContent = (state.queueLength > 0) ? `Speaking (${state.queueLength + 1})` : 'Speaking';
        this.muteBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
      } else {
        this.element.classList.remove('agy-muted', 'agy-speaking');
        this.statusTextEl.textContent = 'Idle';
        this.muteBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
      }

      if (state.rate) {
        this.rateBtn.textContent = `${state.rate}x`;
      }
    }

    enableDrag(el) {
      let isDragging = false;
      let startX, startY, origLeft, origTop;

      el.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = el.getBoundingClientRect();
        origLeft = rect.left;
        origTop = rect.top;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.left = `${origLeft}px`;
        el.style.top = `${origTop}px`;
        el.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = `${origLeft + dx}px`;
        el.style.top = `${origTop + dy}px`;
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          el.style.cursor = 'default';
        }
      });
    }
  }

  return { FloatingUI };
});

  /**
 * Antigravity Voice - ChatObserver
 * Observes the Antigravity Remote chat DOM for:
 * 1. Incoming AI responses via [aria-label="Agent response"].
 * 2. Real-time token streaming using monotonic length tracking (strictly prevents sentence repeats).
 * 3. Completely ignores and strips thinking/reasoning blocks.
 * 4. Code blocks and file announcements.
 * 5. User submission events for instant speech interruption.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AntigravityObserver = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class ChatObserver {
    constructor(speechEngine, cleanerModule, options = { announceFiles: true }) {
      this.engine = speechEngine;
      this.cleaner = cleanerModule;
      this.options = options;
      this.streamer = new cleanerModule.SentenceStreamer(this.options);

      this.observer = null;
      this.currentArticle = null;
      this.lastProcessedLength = 0;
      this.turnCompletionTimer = null;
      this.debounceDelay = 1000;

      // Antigravity exact DOM selectors
      this.selectors = {
        agentArticle: '[aria-label="Agent response"]',
        ignoreElements: [
          'style',
          'script',
          '[data-testid="thinking-collapsible-trigger"]',
          '[data-testid="worked-for-collapsible"]',
          '.cursor-edit',
          '.terminal-output',
          '.tool-execution',
          '.task-log',
          '[data-step-type="tool"]'
        ]
      };

      this.init();
    }

    setOptions(options) {
      this.options = Object.assign(this.options || {}, options);
      if (this.streamer && this.streamer.setOptions) {
        this.streamer.setOptions(this.options);
      }
    }

    init() {
      this.setupDOMObserver();
      this.setupUserInterruption();
      this.scanExistingDOM();
    }

    scanExistingDOM() {
      const articles = document.querySelectorAll(this.selectors.agentArticle);
      if (articles.length > 0) {
        this.currentArticle = articles[articles.length - 1];
        const text = this.extractCleanText(this.currentArticle);
        this.lastProcessedLength = text.length;
        console.log('[Antigravity Voice] Initialized on existing response (length:', this.lastProcessedLength, ')');
      }
    }

    setupDOMObserver() {
      this.observer = new MutationObserver((mutations) => {
        let shouldProcess = false;

        for (const mutation of mutations) {
          // 1. Check for newly added nodes
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                let article = null;
                if (node.matches && node.matches(this.selectors.agentArticle)) {
                  article = node;
                } else if (node.querySelector) {
                  article = node.querySelector(this.selectors.agentArticle);
                }

                if (article && article !== this.currentArticle) {
                  this.switchToNewArticle(article);
                  return;
                }
              }
            }
          }

          // 2. Check if mutation occurred inside current article
          if (this.currentArticle) {
            const target = mutation.target.nodeType === Node.ELEMENT_NODE
              ? mutation.target
              : mutation.target.parentElement;

            if (target && (target === this.currentArticle || this.currentArticle.contains(target))) {
              shouldProcess = true;
            }
          } else {
            // If no current article, see if any article exists
            const target = mutation.target.nodeType === Node.ELEMENT_NODE
              ? mutation.target
              : mutation.target.parentElement;
            const article = target?.closest ? target.closest(this.selectors.agentArticle) : null;
            if (article) {
              this.switchToNewArticle(article);
              return;
            }
          }
        }

        if (shouldProcess && this.currentArticle) {
          this.processArticleDelta();
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    switchToNewArticle(article) {
      if (!article || article === this.currentArticle) return;

      this.finishCurrentTurn();

      console.log('[Antigravity Voice] Switched to new AI response article.');
      this.currentArticle = article;
      this.lastProcessedLength = 0;
      this.streamer.reset();

      this.processArticleDelta();
    }

    processArticleDelta() {
      if (!this.currentArticle) return;

      const fullCleanText = this.extractCleanText(this.currentArticle);

      if (fullCleanText.length > this.lastProcessedLength) {
        const delta = fullCleanText.slice(this.lastProcessedLength);
        this.lastProcessedLength = fullCleanText.length;

        const newSentences = this.streamer.feed(delta);
        for (const sentence of newSentences) {
          console.log('[Antigravity Voice] Speaking:', sentence);
          this.engine.enqueue(sentence);
        }

        this.resetCompletionTimer();
      }
    }

    extractCleanText(rootNode) {
      if (!rootNode) return '';
      const clone = rootNode.cloneNode(true);

      // Remove thinking collapsible containers completely
      clone.querySelectorAll('[data-testid="thinking-collapsible-trigger"], [data-testid="worked-for-collapsible"]').forEach(btn => {
        const container = btn.closest('.relative') || btn.parentElement;
        if (container) container.remove();
        else btn.remove();
      });

      // Remove remaining ignore elements
      for (const sel of this.selectors.ignoreElements) {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      }

      // Process code blocks for clean file name announcements
      const preElements = clone.querySelectorAll('pre, .code-block, [data-code-block]');
      preElements.forEach((pre) => {
        if (this.options && this.options.announceFiles === false) {
          pre.replaceWith(document.createTextNode(' '));
          return;
        }

        let filename = '';
        let language = '';

        const header = pre.querySelector('.file-name, .filename, .header, [data-filename], .code-header');
        if (header) {
          filename = header.textContent.trim();
        } else if (pre.getAttribute('data-filename')) {
          filename = pre.getAttribute('data-filename');
        }

        const codeEl = pre.querySelector('code') || pre;
        const className = codeEl.className || '';
        const langMatch = className.match(/language-([a-zA-Z0-9_+]+)/i);
        if (langMatch) {
          language = langMatch[1].toLowerCase();
        }

        if (!filename && codeEl.textContent) {
          const firstLine = codeEl.textContent.trim().split('\n')[0];
          const hintMatch = firstLine.match(/^(?:(?:\/\/|#|\/\*|<!--)\s*(?:file(?:name)?|path)?[:\s]+([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9_]+))/i);
          if (hintMatch) {
            filename = hintMatch[1].trim();
          }
        }

        if (filename) {
          filename = filename.split('/').pop().split('\\').pop();
        }

        let announcement = '';
        if (filename) {
          announcement = ` [Code for ${filename}.] `;
        } else if (language) {
          announcement = ` [Code snippet in ${language}.] `;
        } else {
          announcement = ` [Code snippet.] `;
        }

        pre.replaceWith(document.createTextNode(announcement));
      });

      return clone.textContent || '';
    }

    resetCompletionTimer() {
      if (this.turnCompletionTimer) {
        clearTimeout(this.turnCompletionTimer);
      }

      this.turnCompletionTimer = setTimeout(() => {
        this.finishCurrentTurn();
      }, this.debounceDelay);
    }

    finishCurrentTurn() {
      if (this.turnCompletionTimer) {
        clearTimeout(this.turnCompletionTimer);
        this.turnCompletionTimer = null;
      }

      const finalSentences = this.streamer.flush();
      for (const sentence of finalSentences) {
        console.log('[Antigravity Voice] Speaking final sentence:', sentence);
        this.engine.enqueue(sentence);
      }
    }

    setupUserInterruption() {
      // Enter key in input halts speech immediately
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          const activeEl = document.activeElement;
          if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || activeEl.isContentEditable)) {
            if (this.engine.isSpeaking) {
              console.log('[Antigravity Voice] User typing next message, stopped speech.');
              this.engine.stop();
            }
          }
        }
      }, true);

      // Send button clicks halt speech
      document.addEventListener('click', (e) => {
        const sendBtn = e.target.closest('button[type="submit"], button[aria-label*="send" i], button[title*="send" i]');
        if (sendBtn && this.engine.isSpeaking) {
          this.engine.stop();
        }
      }, true);
    }
  }

  return { ChatObserver };
});


  const Cleaner = window.AntigravityCleaner;
  const TTS = window.AntigravityTTS;
  const UI = window.AntigravityUI;
  const Observer = window.AntigravityObserver;

  const speechEngine = new TTS.SpeechEngine();
  const floatingUI = new UI.FloatingUI(speechEngine);
  const chatObserver = new Observer.ChatObserver(speechEngine, Cleaner, { announceFiles: true });

  try {
    const savedRate = localStorage.getItem('agy_voice_rate');
    const savedVoice = localStorage.getItem('agy_voice_name');
    const savedEnabled = localStorage.getItem('agy_voice_enabled');

    if (savedRate) speechEngine.setRate(parseFloat(savedRate));
    if (savedVoice) speechEngine.setVoiceByName(savedVoice);
    if (savedEnabled !== null) speechEngine.setEnabled(savedEnabled === 'true');
  } catch (e) {}

  console.log('%c[Antigravity Voice] Activated successfully! Floating pill added to screen.', 'color: #4285f4; font-weight: bold; font-size: 14px;');
})();
