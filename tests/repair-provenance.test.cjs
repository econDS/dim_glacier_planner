'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const changes = require('../qa/repair/market-changes.json');
const reverse = require('../qa/repair/market-normalize.cjs');
const show = ref => execFileSync('git', ['show', ref + ':index.html'], { encoding: 'utf8' });
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
test('market reversal is exactly the two merged price/date changes, not a new baseline', () => {
  const before = show('26711cb5766922bf01567bfa55cba5209463158d^');
  const after = show('f9942d95ebef9e51b237cf679029e6e38bc78952');
  assert.equal(changes.length, 18);
  assert.equal(reverse(after), before);
  assert.equal(reverse(before), before);
  for (const commit of ['26711cb5766922bf01567bfa55cba5209463158d', 'f9942d95ebef9e51b237cf679029e6e38bc78952']) {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD']);
  }
});
test('raw production defaults and date remain current; no calculator or release changes', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const [, after] of changes) assert.equal(html.split(after).length - 1, 1);
  assert.equal(hash(require('../qa/repair/import-normalize.cjs')(html)), '4d1f3e55a133992580ffcbd47ee925aa7cf609317b0228dc9d9040d015529af5');
});
test('historical reversal rejects every changed input and does not hide unrelated edits', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const [, after] of changes.slice(0, -1)) {
    assert.throws(() => reverse(html.replace(after, after.replace('value="', 'value="9'))));
  }
  const unexpected = html.replace('function recalc()', 'function changedCalculation()');
  assert.notEqual(unexpected, html);
  assert.notEqual(hash(reverse(unexpected)), hash(reverse(html)));
  const wrongDate = html.replace('6 ต.ค. 2569', '7 ต.ค. 2569');
  assert.notEqual(hash(reverse(wrongDate)), hash(reverse(html)));
});
