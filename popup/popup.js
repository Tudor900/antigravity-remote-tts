/**
 * Antigravity Voice - Popup Settings Logic
 * Manages configuration UI, voice selection, and persists to chrome.storage.
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggleEnabled = document.getElementById('toggle-enabled');
  const voiceSelect = document.getElementById('voice-select');
  const rateSlider = document.getElementById('rate-slider');
  const rateVal = document.getElementById('rate-val');
  const pitchSlider = document.getElementById('pitch-slider');
  const pitchVal = document.getElementById('pitch-val');
  const announceFilesCheck = document.getElementById('announce-files');
  const btnTest = document.getElementById('btn-test');
  const btnStop = document.getElementById('btn-stop');

  let availableVoices = [];

  // 1. Populate Voice Selector
  function populateVoices(selectedVoiceName) {
    availableVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    if (!availableVoices || availableVoices.length === 0) return;

    voiceSelect.innerHTML = '';

    // Sort voices: English first, then by name
    const sorted = [...availableVoices].sort((a, b) => {
      const aIsEn = a.lang.startsWith('en');
      const bIsEn = b.lang.startsWith('en');
      if (aIsEn && !bIsEn) return -1;
      if (!aIsEn && bIsEn) return 1;
      return a.name.localeCompare(b.name);
    });

    let foundSelected = false;

    sorted.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — Default' : ''}`;
      if (voice.name === selectedVoiceName) {
        option.selected = true;
        foundSelected = true;
      }
      voiceSelect.appendChild(option);
    });

    // Auto-select preferred voice if none selected
    if (!foundSelected && sorted.length > 0) {
      const preferred = sorted.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
                        sorted.find(v => v.lang.startsWith('en')) ||
                        sorted[0];
      if (preferred) {
        voiceSelect.value = preferred.name;
        chrome.storage.local.set({ voiceName: preferred.name });
      }
    }
  }

  // 2. Load Saved Preferences
  chrome.storage.local.get(['enabled', 'voiceName', 'rate', 'pitch', 'announceFiles'], (items) => {
    if (items.enabled !== undefined) toggleEnabled.checked = items.enabled;
    if (items.rate !== undefined) {
      rateSlider.value = items.rate;
      rateVal.textContent = `${items.rate}x`;
    }
    if (items.pitch !== undefined) {
      pitchSlider.value = items.pitch;
      pitchVal.textContent = `${items.pitch}`;
    }
    if (items.announceFiles !== undefined) {
      announceFilesCheck.checked = items.announceFiles;
    }

    populateVoices(items.voiceName);
  });

  if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      chrome.storage.local.get(['voiceName'], (items) => {
        populateVoices(items.voiceName);
      });
    };
  }

  // 3. Save Changes
  toggleEnabled.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: toggleEnabled.checked });
  });

  voiceSelect.addEventListener('change', () => {
    chrome.storage.local.set({ voiceName: voiceSelect.value });
  });

  rateSlider.addEventListener('input', () => {
    const val = parseFloat(rateSlider.value).toFixed(2);
    rateVal.textContent = `${val}x`;
    chrome.storage.local.set({ rate: parseFloat(val) });
  });

  pitchSlider.addEventListener('input', () => {
    const val = parseFloat(pitchSlider.value).toFixed(2);
    pitchVal.textContent = `${val}`;
    chrome.storage.local.set({ pitch: parseFloat(val) });
  });

  announceFilesCheck.addEventListener('change', () => {
    chrome.storage.local.set({ announceFiles: announceFilesCheck.checked });
  });

  // 4. Test Voice Button
  btnTest.addEventListener('click', () => {
    window.speechSynthesis.cancel();

    const selectedVoiceName = voiceSelect.value;
    const voice = availableVoices.find(v => v.name === selectedVoiceName);

    const testText = "Hello! Antigravity text to speech is ready. Here is the code for server.py.";
    const utterance = new SpeechSynthesisUtterance(testText);

    if (voice) utterance.voice = voice;
    utterance.rate = parseFloat(rateSlider.value) || 1.0;
    utterance.pitch = parseFloat(pitchSlider.value) || 1.0;

    window.speechSynthesis.speak(utterance);
  });

  // 5. Stop Button
  btnStop.addEventListener('click', () => {
    window.speechSynthesis.cancel();

    // Also notify active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'stop' }).catch(() => {});
      }
    });
  });
});
