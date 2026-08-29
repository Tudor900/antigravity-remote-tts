const assert = require('assert');
const Cleaner = require('../content/cleaner.js');

console.log('--- Running Antigravity Voice Cleaner & Segmenter Tests ---');

// Test 1: Code block with filename tag
const md1 = `I have updated the file.
\`\`\`python:main.py
def hello():
    print("Hello world")
\`\`\`
Let me know what you think!`;

const cleaned1 = Cleaner.cleanMarkdown(md1);
assert(cleaned1.includes('Code for main.py.'), 'Should announce filename from code block tag: ' + cleaned1);
assert(!cleaned1.includes('print("Hello world")'), 'Should NOT contain raw code');
console.log('✔ Test 1 passed: Code block with tag');

// Test 2: Code block with comment filename
const md2 = `Here is the configuration:
\`\`\`yaml
# file: config.prod.yaml
port: 8080
ssl: true
\`\`\`
Please review.`;

const cleaned2 = Cleaner.cleanMarkdown(md2);
assert(cleaned2.includes('Code for config.prod.yaml.'), 'Should announce filename from code comment: ' + cleaned2);
assert(!cleaned2.includes('port: 8080'), 'Should NOT contain raw code');
console.log('✔ Test 2 passed: Code block with comment filename');

// Test 3: Code block with language only
const md3 = `Run this command:
\`\`\`bash
npm run build
\`\`\`
It should compile.`;

const cleaned3 = Cleaner.cleanMarkdown(md3);
assert(cleaned3.includes('Code snippet in Bash.'), 'Should announce language: ' + cleaned3);
console.log('✔ Test 3 passed: Code block with language only');

// Test 4: Markdown formatting stripping
const md4 = `### Overview\nThis is **bold**, this is *italic*, and here is [Antigravity](https://antigravity.google.com/docs).`;
const cleaned4 = Cleaner.cleanMarkdown(md4);
assert.strictEqual(cleaned4, 'Overview. This is bold, this is italic, and here is Antigravity.');
console.log('✔ Test 4 passed: Markdown stripping');

// Test 5: Abbreviations & decimals
assert.strictEqual(Cleaner.isFalseBoundary('This is e.g.', 11), true);
assert.strictEqual(Cleaner.isFalseBoundary('Version 3.14 is out', 10), true);
assert.strictEqual(Cleaner.isFalseBoundary('This is done.', 12), false);
console.log('✔ Test 5 passed: Abbreviation and decimal protection');

// Test 6: Sentence streaming across chunks
const streamer = new Cleaner.SentenceStreamer();
let sentences = [];

sentences.push(...streamer.feed("I have found the "));
sentences.push(...streamer.feed("issue in the codebase. "));
sentences.push(...streamer.feed("It was caused by "));
sentences.push(...streamer.feed("a null pointer in `user.service.ts`! "));
sentences.push(...streamer.feed("We should fix "));
sentences.push(...streamer.feed("it now? "));
sentences.push(...streamer.feed("Here is the final note"));
sentences.push(...streamer.flush());

assert.strictEqual(sentences.length, 4);
assert.strictEqual(sentences[0], 'I have found the issue in the codebase.');
assert.strictEqual(sentences[1], 'It was caused by a null pointer in user.service.ts!');
assert.strictEqual(sentences[2], 'We should fix it now?');
assert.strictEqual(sentences[3], 'Here is the final note');
console.log('✔ Test 6 passed: Streaming sentence segmentation');

// Test 7: announceFiles: false option
const md7 = `Here is code:\n\`\`\`js\nconst a = 1;\n\`\`\`\nDone.`;
const cleaned7 = Cleaner.cleanMarkdown(md7, { announceFiles: false });
assert(!cleaned7.includes('Code'), 'Should not announce code when announceFiles is false');
assert(cleaned7.includes('Here is code:'), 'Should preserve surrounding text');
console.log('✔ Test 7 passed: announceFiles: false toggle');

console.log('\nAll 7 test suites passed successfully!');
