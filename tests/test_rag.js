const assert = require('assert');
const fs = require('fs');
const path = require('path');
const RAGEngine = require('../lib/rag/rag_engine.js');

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/rag/corpus.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/rag/index.json'), 'utf8'));

console.log('--- Testing RAGEngine ---');
const rag = new RAGEngine(corpus, index);

// Test 1: Corpus loaded
assert.strictEqual(corpus.length, 36, 'Corpus should contain 36 chunks');
console.log('✓ Corpus loaded successfully with 36 chunks');

// Test 2: Search for Client Escalation
const results1 = rag.search('angry client threatening breach of contract and lawsuit', { topK: 3 });
assert(results1.length > 0, 'Should return results');
assert.strictEqual(results1[0].section_number, '4.1', 'Top result should be §4.1 Client Escalation');
assert(results1[0].citation.includes('§4.1: Client Escalation'), 'Citation should match §4.1');
console.log('✓ Query 1 (Client Escalation) retrieved:', results1[0].citation, 'Score:', results1[0].score);

// Test 3: Search for Team Task Conflict
const results2 = rag.search('engineers disagree on database architecture and methods', { topK: 3 });
assert(results2.length > 0);
assert.strictEqual(results2[0].section_number, '4.2', 'Top result should be §4.2 Team Task Conflict');
console.log('✓ Query 2 (Task Conflict) retrieved:', results2[0].citation, 'Score:', results2[0].score);

// Test 4: Search for Burnout
const results3 = rag.search('team exhaustion chronic overtime and burnout', { topK: 3 });
assert(results3.length > 0);
assert.strictEqual(results3[0].section_number, '4.5', 'Top result should be §4.5 Team Burnout and Chronic Overload');
console.log('✓ Query 3 (Burnout) retrieved:', results3[0].citation, 'Score:', results3[0].score);

// Test 5: Search for Harassment
const results4 = rag.search('sexual harassment and discrimination complaint by employee', { topK: 3 });
assert(results4.length > 0);
assert.strictEqual(results4[0].section_number, '4.11', 'Top result should be §4.11 Harassment or Discrimination Report');
console.log('✓ Query 4 (Harassment) retrieved:', results4[0].citation, 'Score:', results4[0].score);

// Test 6: Citation formatting
const md = rag.formatCitationMarkdown(results1);
assert(md.includes('[Managerial EQ Handbook §4.1: Client Escalation]'), 'Markdown contains citation');
console.log('✓ Markdown citation formatting verified');

console.log('\nAll RAGEngine tests passed successfully!\n');
