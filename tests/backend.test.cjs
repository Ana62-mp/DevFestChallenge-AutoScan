const test=require('node:test'),assert=require('node:assert/strict');
const {secretHash,matches,extractPlates,pattern}=require('../functions/core.cjs');
test('salted secrets never store plaintext and accept normalized answers',()=>{const secret=secretHash('Luna');assert.ok(!secret.hash.includes('Luna'));assert.ok(matches(' luna ',secret));assert.ok(!matches('sol',secret));assert.notEqual(secret.hash,secretHash('Luna').hash);});
test('OCR extracts and deduplicates valid plate formats',()=>{assert.deepEqual(extractPlates('ECUADOR\nGBA 4821\nGBA-4821\nABC-12'),['GBA-4821']);});
test('production counter uses rolling seven-day window',()=>{const now=1700000000000;assert.equal(pattern({times:[now-8*86400000]},now).count,1);assert.ok(pattern({times:[now-100,now-50]},now).alert);assert.ok(!pattern({times:[now-100,now-50],lastAlert:now-10},now).alert);});
