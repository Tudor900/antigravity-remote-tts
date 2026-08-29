/**
 * Antigravity Voice - ChatObserver
 * Observes the Antigravity Remote chat DOM for:
 * 1. Incoming AI responses and real-time streaming deltas.
 * 2. Code blocks and file badges.
 * 3. User submission events for instant speech interruption.
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

      this.observers = [];
      this.activeResponseNode = null;
      this.lastProcessedText = '';
      this.turnCompletionTimer = null;
      this.debounceDelay = 1200;

      // Selectors - including Antigravity's internal .animate-markdown streaming container
      this.selectors = {
        assistantMessages: [
          '.animate-markdown',
          '[data-role="assistant"]',
          '[data-message-author="model"]',
          '[data-message-author="assistant"]',
          '.assistant-message',
          '.model-response',
          '.agent-response',
          '.cortex-response',
          '.rendered-markdown'
        ],
        userMessages: [
          '[data-role="user"]',
          '[data-message-author="user"]',
          '.user-message',
          '.human-message',
          '.user-turn'
        ],
        toolOutputs: [
          '.terminal-output',
          '.tool-execution',
          '.task-log',
          '.system-message',
          '.diff-view',
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
      this.setupDOMObserver(document);
      this.setupUserInterruption(document);

      // Also observe any iframes if present
      document.querySelectorAll('iframe').forEach(frame => {
        try {
          if (frame.contentDocument) {
            this.setupDOMObserver(frame.contentDocument);
            this.setupUserInterruption(frame.contentDocument);
          }
        } catch (e) {}
      });
    }

    setupDOMObserver(doc) {
      if (!doc || !doc.body) return;

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // If a new iframe was added, observe its document too
                if (node.tagName === 'IFRAME') {
                  try {
                    if (node.contentDocument) {
                      this.setupDOMObserver(node.contentDocument);
                      this.setupUserInterruption(node.contentDocument);
                    }
                  } catch (e) {}
                }
                this.handleNewElement(node);
              }
            }
          }

          if (mutation.type === 'characterData' || mutation.type === 'childList') {
            const targetEl = mutation.target.nodeType === Node.ELEMENT_NODE 
              ? mutation.target 
              : mutation.target.parentElement;

            if (targetEl && this.isWithinActiveResponse(targetEl)) {
              this.handleTextDelta();
            }
          }
        }
      });

      observer.observe(doc.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      this.observers.push(observer);
    }

    setupUserInterruption(doc) {
      if (!doc) return;

      doc.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          const activeEl = doc.activeElement;
          if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || activeEl.isContentEditable)) {
            if (this.engine.isSpeaking) {
              this.engine.stop();
            }
          }
        }
      }, true);

      doc.addEventListener('click', (e) => {
        const sendBtn = e.target.closest('button[type="submit"], button[aria-label*="send" i], button[title*="send" i]');
        if (sendBtn && this.engine.isSpeaking) {
          this.engine.stop();
        }
      }, true);
    }

    handleNewElement(element) {
      if (this.matchesAny(element, this.selectors.userMessages)) {
        return;
      }

      if (this.isAssistantMessage(element)) {
        this.startNewTurn(element);
        return;
      }

      for (const sel of this.selectors.assistantMessages) {
        const match = element.querySelector(sel);
        if (match && !this.isUserMessage(match) && !this.isToolOutput(match)) {
          this.startNewTurn(match);
          return;
        }
      }
    }

    startNewTurn(node) {
      if (this.activeResponseNode === node) return;

      this.finishCurrentTurn();

      this.activeResponseNode = node;
      this.lastProcessedText = '';
      this.streamer.reset();

      this.handleTextDelta();
    }

    handleTextDelta() {
      if (!this.activeResponseNode) return;

      const currentText = this.extractTextWithFileAnnouncements(this.activeResponseNode);

      if (currentText.length > this.lastProcessedText.length) {
        const delta = currentText.slice(this.lastProcessedText.length);
        this.lastProcessedText = currentText;

        const newSentences = this.streamer.feed(delta);
        for (const sentence of newSentences) {
          this.engine.enqueue(sentence);
        }

        this.resetCompletionTimer();
      }
    }

    extractTextWithFileAnnouncements(rootNode) {
      const clone = rootNode.cloneNode(true);

      for (const sel of this.selectors.toolOutputs) {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      }

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

      if (this.activeResponseNode) {
        const finalSentences = this.streamer.flush();
        for (const sentence of finalSentences) {
          this.engine.enqueue(sentence);
        }
        this.activeResponseNode = null;
        this.lastProcessedText = '';
      }
    }

    isWithinActiveResponse(element) {
      return this.activeResponseNode && (this.activeResponseNode === element || this.activeResponseNode.contains(element));
    }

    isAssistantMessage(element) {
      if (this.isUserMessage(element) || this.isToolOutput(element)) return false;
      return this.matchesAny(element, this.selectors.assistantMessages);
    }

    isUserMessage(element) {
      return this.matchesAny(element, this.selectors.userMessages);
    }

    isToolOutput(element) {
      return this.matchesAny(element, this.selectors.toolOutputs);
    }

    matchesAny(element, selectorList) {
      for (const sel of selectorList) {
        if (element.matches && element.matches(sel)) return true;
        if (element.closest && element.closest(sel)) return true;
      }
      return false;
    }
  }

  return { ChatObserver };
});
