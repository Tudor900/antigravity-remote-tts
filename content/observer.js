/**
 * Antigravity Voice - ChatObserver
 * Observes the Antigravity Remote chat DOM for:
 * 1. Incoming AI responses via [aria-label="Agent response"].
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

      this.observer = null;
      this.activeResponseNode = null;
      this.lastProcessedText = '';
      this.turnCompletionTimer = null;
      this.debounceDelay = 1200;

      // Antigravity exact DOM selectors
      this.selectors = {
        agentArticle: '[aria-label="Agent response"]',
        markdownContent: '.leading-relaxed.select-text',
        userArticle: '[aria-label="User message"], [aria-label="User prompt"]',
        ignoreElements: [
          'style',
          'script',
          '[data-testid="worked-for-collapsible"]',
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
        const lastArticle = articles[articles.length - 1];
        const content = lastArticle.querySelector(this.selectors.markdownContent) || lastArticle;
        this.activeResponseNode = content;
        this.lastProcessedText = this.extractCleanText(content);
        console.log('[Antigravity Voice] Initialized on last agent response.');
      }
    }

    setupDOMObserver() {
      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          // Check newly added nodes
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.checkNewElement(node);
              }
            }
          }

          // Check streaming text updates inside active response
          if (mutation.type === 'characterData' || mutation.type === 'childList') {
            const targetEl = mutation.target.nodeType === Node.ELEMENT_NODE 
              ? mutation.target 
              : mutation.target.parentElement;

            if (targetEl) {
              if (this.activeResponseNode && (this.activeResponseNode === targetEl || this.activeResponseNode.contains(targetEl))) {
                this.handleTextDelta();
              } else {
                // Check if target is inside an agent article
                const article = targetEl.closest ? targetEl.closest(this.selectors.agentArticle) : null;
                if (article) {
                  const content = article.querySelector(this.selectors.markdownContent) || article;
                  if (this.activeResponseNode !== content) {
                    this.startNewTurn(content);
                  } else {
                    this.handleTextDelta();
                  }
                }
              }
            }
          }
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    checkNewElement(element) {
      // Check if element is or contains [aria-label="Agent response"]
      let article = null;
      if (element.matches && element.matches(this.selectors.agentArticle)) {
        article = element;
      } else if (element.querySelector) {
        article = element.querySelector(this.selectors.agentArticle);
      }

      if (article) {
        const content = article.querySelector(this.selectors.markdownContent) || article;
        this.startNewTurn(content);
      }
    }

    startNewTurn(node) {
      if (this.activeResponseNode === node) return;

      this.finishCurrentTurn();

      console.log('[Antigravity Voice] Detected new AI response stream!');
      this.activeResponseNode = node;
      this.lastProcessedText = '';
      this.streamer.reset();

      this.handleTextDelta();
    }

    handleTextDelta() {
      if (!this.activeResponseNode) return;

      const currentText = this.extractCleanText(this.activeResponseNode);

      if (currentText.length > this.lastProcessedText.length) {
        const delta = currentText.slice(this.lastProcessedText.length);
        this.lastProcessedText = currentText;

        const newSentences = this.streamer.feed(delta);
        for (const sentence of newSentences) {
          console.log('[Antigravity Voice] Speaking:', sentence);
          this.engine.enqueue(sentence);
        }

        this.resetCompletionTimer();
      }
    }

    extractCleanText(rootNode) {
      const clone = rootNode.cloneNode(true);

      // Strip unwanted style, script, tool outputs, and collapsible headers
      for (const sel of this.selectors.ignoreElements) {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      }

      // Detect and replace code blocks with clean file name announcements
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
          console.log('[Antigravity Voice] Speaking final sentence:', sentence);
          this.engine.enqueue(sentence);
        }
        this.activeResponseNode = null;
        this.lastProcessedText = '';
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
