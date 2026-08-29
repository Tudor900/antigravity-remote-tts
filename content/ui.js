/**
 * Antigravity Voice - Floating UI Widget
 * Provides a floating pill for real-time status and playback controls:
 * - Stop / Silence button
 * - Mute / Unmute auto-TTS
 * - Speed multiplier cycling
 * - Drag-to-reposition
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
      if (document.getElementById('agy-voice-pill')) return;

      const pill = document.createElement('div');
      pill.id = 'agy-voice-pill';
      pill.innerHTML = `
        <div class="agy-voice-indicator">
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

      this.engine.on('stateChange', (state) => this.renderState(state));
    }

    bindEvents() {
      // Audio unlock on user interaction
      this.element.addEventListener('click', () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.resume();
        }
      });

      // Stop button
      this.stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engine.stop();
      });

      // Mute toggle
      this.muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engine.setEnabled(!this.engine.enabled);
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ enabled: this.engine.enabled });
        }
      });

      // Speed cycle
      this.rateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.speedIndex = (this.speedIndex + 1) % this.speeds.length;
        const newSpeed = this.speeds[this.speedIndex];
        this.engine.setRate(newSpeed);
        this.rateBtn.textContent = `${newSpeed}x`;
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ rate: newSpeed });
        }
      });

      // Keyboard shortcut: Escape immediately stops speech
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.engine.isSpeaking) {
          this.engine.stop();
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
        this.statusTextEl.textContent = state.queueLength > 0 ? `Speaking (${state.queueLength + 1})` : 'Speaking';
        this.muteBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
      } else {
        this.element.classList.remove('agy-muted', 'agy-speaking');
        this.statusTextEl.textContent = 'Idle';
        this.muteBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
      }

      this.rateBtn.textContent = `${state.rate}x`;
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
