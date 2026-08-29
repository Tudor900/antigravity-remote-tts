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
