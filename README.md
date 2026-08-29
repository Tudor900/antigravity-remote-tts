# Antigravity Voice — Text-to-Speech Chrome Extension

A Manifest V3 Chrome Extension that automatically reads out AI responses from the **Google Antigravity Remote** chat interface (`https://antigravity.google.com/r/*`) in real-time.

---

## Features

- ⚡ **Sentence-by-Sentence Streaming**: Synthesizes and speaks sentences as soon as punctuation is detected while the AI is still generating, providing near-instant audio feedback.
- 📁 **Smart Code & File Handling**: Detects code snippets and announces the filename (e.g., *"Code for server.py"* or *"Code snippet in Python"*), while completely skipping the raw code body so your ears aren't blasted with syntax.
- 🗣 **Chrome Built-In Speech Synthesis**: Uses the browser's native Web Speech API (`window.speechSynthesis`) for zero latency, zero API costs, and full offline privacy.
- 🎛 **Floating Control Pill**: An unobtrusive on-page badge in the Antigravity tab showing live status (Speaking / Idle / Muted) with animated audio waves, an immediate **Stop (Esc)** button, a **Mute/Unmute** toggle, and a **Speed Multiplier** button.
- ⚙ **Extension Popup Settings**: Easily choose your favorite Chrome voice (e.g. *Google US English*), tweak speed (0.5x – 2.0x) and pitch, or test voices with a click.
- 🛑 **Conversational Interruption**: Automatically halts speech immediately whenever you submit a new prompt in the chat or press the `Escape` key.
- ⏱ **Keep-Alive Watchdog**: Circumvents Chromium's known 15-second speech freeze bug to ensure long responses never cut off unexpectedly.

---

## Directory Structure

```
antigravity-extension/
├── manifest.json            # Manifest V3 specification
├── icons/
│   ├── icon-16.png          # 16x16 extension icon
│   ├── icon-48.png          # 48x48 extension icon
│   └── icon-128.png         # 128x128 extension icon
├── content/
│   ├── cleaner.js           # Markdown cleaner, code block processor & sentence streamer
│   ├── tts.js               # SpeechSynthesis queue manager with watchdog keep-alive
│   ├── ui.js                # On-page draggable floating control pill
│   ├── observer.js          # Chat DOM MutationObserver and interrupt detector
│   ├── main.js              # Content script orchestrator and settings sync
│   └── styles.css           # Modern dark-themed styles for floating pill
├── popup/
│   ├── popup.html           # Settings popup HTML
│   ├── popup.css            # Antigravity-themed popup stylesheet
│   └── popup.js             # Voice selection, rate sliders, and persistence
├── tests/
│   └── test_cleaner.js      # Automated unit tests for text cleaning and segmentation
└── README.md
```

---

## Installation Guide (Google Chrome)

1. Open Google Chrome on your computer.
2. Navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the directory:
   ```text
   /home/tudor/antigravity-extension
   ```
   *(If accessing from Windows via WSL, navigate to `\\wsl$\Ubuntu\home\tudor\antigravity-extension` or your WSL folder).*
6. The extension **"Antigravity Voice - Text to Speech"** will now appear in your extensions list. Pin it to your toolbar for quick access.

---

## How to Use

1. Open your Antigravity Remote session in Chrome:
   ```text
   https://antigravity.google.com/r/<your-session-uuid>
   ```
2. You will see a small floating pill at the bottom-right corner of the window displaying **"Idle"**.
3. Send a prompt to the AI agent.
4. As the AI streams its answer:
   - The status pill animates with blue soundwaves (**"Speaking"**).
   - Each sentence is spoken as soon as it completes.
   - Code blocks are announced naturally (e.g., *"Code for index.ts"*), skipping the syntax.
5. If you want to stop speech at any moment:
   - Click the red **Stop** button on the floating pill, OR
   - Press the **Esc** key on your keyboard, OR
   - Simply type and send your next message (speech halts automatically).

---

## Running Tests

To run the automated unit test suite for text cleaning and sentence segmenting:
```bash
node /home/tudor/antigravity-extension/tests/test_cleaner.js
```
