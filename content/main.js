/**
 * Antigravity Voice - Content Script Entrypoint
 * Bootstraps the text-to-speech engine, chat observer, and floating UI.
 * Syncs user settings from chrome.storage in real-time.
 */

(function () {
  'use strict';

  console.log('[Antigravity Voice] Initializing extension content script...');

  const Cleaner = window.AntigravityCleaner;
  const TTS = window.AntigravityTTS;
  const UI = window.AntigravityUI;
  const Observer = window.AntigravityObserver;

  if (!Cleaner || !TTS || !UI || !Observer) {
    console.error('[Antigravity Voice] Failed to load required modules.');
    return;
  }

  // 1. Instantiate Core Engine
  const speechEngine = new TTS.SpeechEngine();
  const floatingUI = new UI.FloatingUI(speechEngine);
  const chatObserver = new Observer.ChatObserver(speechEngine, Cleaner, { announceFiles: true });

  // 2. Load Saved Preferences from chrome.storage
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['enabled', 'voiceName', 'rate', 'pitch', 'volume', 'announceFiles'], (items) => {
      if (items.enabled !== undefined) speechEngine.setEnabled(items.enabled);
      if (items.voiceName) speechEngine.setVoiceByName(items.voiceName);
      if (items.rate !== undefined) speechEngine.setRate(items.rate);
      if (items.pitch !== undefined) speechEngine.setPitch(items.pitch);
      if (items.volume !== undefined) speechEngine.setVolume(items.volume);
      if (items.announceFiles !== undefined) chatObserver.setOptions({ announceFiles: items.announceFiles });
    });

    // 3. Listen for real-time setting updates from popup
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      if (changes.enabled) speechEngine.setEnabled(changes.enabled.newValue);
      if (changes.voiceName) speechEngine.setVoiceByName(changes.voiceName.newValue);
      if (changes.rate) speechEngine.setRate(changes.rate.newValue);
      if (changes.pitch) speechEngine.setPitch(changes.pitch.newValue);
      if (changes.volume) speechEngine.setVolume(changes.volume.newValue);
      if (changes.announceFiles) chatObserver.setOptions({ announceFiles: changes.announceFiles.newValue });
    });
  }

  // 4. Message Listener for commands from Popup
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'stop') {
        speechEngine.stop();
        sendResponse({ success: true });
      } else if (request.action === 'testVoice') {
        speechEngine.stop();
        speechEngine.enqueue('Hello! Antigravity voice extension is active and ready.');
        sendResponse({ success: true });
      } else if (request.action === 'getStatus') {
        sendResponse({
          enabled: speechEngine.enabled,
          isSpeaking: speechEngine.isSpeaking,
          rate: speechEngine.rate,
          pitch: speechEngine.pitch
        });
      }
      return true; // Keep message channel open for async response
    });
  }

  console.log('[Antigravity Voice] Ready! Listening to AI chat responses.');
})();
