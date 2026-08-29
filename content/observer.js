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
