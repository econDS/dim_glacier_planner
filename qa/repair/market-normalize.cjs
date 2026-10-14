'use strict';
// Reverse the exact market refresh from merged commits 26711cb and f9942d9.
// Historical hashes stay frozen; live defaults and the contrast fix stay intact.
const assert = require('node:assert/strict');
const changes = require('./market-changes.json');
module.exports = html => {
  if (!html.includes(changes.at(-1)[1])) return html;
  for (const [before, after] of [...changes].reverse()) {
    assert.equal(html.split(after).length - 1, 1, 'exact approved market refresh: ' + after);
    html = html.replace(after, () => before);
  }
  return html;
};
