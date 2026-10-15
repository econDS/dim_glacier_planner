'use strict';
const assert = require('node:assert/strict');
const changes = require('./import-changes.json');
// Only the reviewed validation/parser repair is reversible for historical guards.
module.exports = html => {
  if (!html.includes(changes[0][1])) return html;
  for (const [before, after] of [...changes].reverse()) {
    assert.equal(html.split(after).length - 1, 1, 'exact import validation repair');
    html = html.replace(after, () => before);
  }
  return html;
};
