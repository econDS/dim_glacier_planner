'use strict';
const assert = require('node:assert/strict');
module.exports = html => {
  html = require('../repair/import-normalize.cjs')(html);
  const current = './assets/ro-suite/2.0.0/nav.js';
  if (!html.includes(current)) return html;
  assert.equal(html.split(current).length - 1, 1, 'exact reviewed v2 script delta');
  return html.replace(current, './assets/ro-suite/1.5.1/nav.js');
};
