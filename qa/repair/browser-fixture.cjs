'use strict';
// Serve the real app with only reviewed market default inputs reset for
// like-for-like historical calculation comparisons. Never rewrite executable code.
// Keep the actual visible date: metadata tests exercise current approved metadata.
const fs = require('node:fs');
require('node:assert/strict').equal(require('playwright/package.json').version,'1.55.1','Pinned real-browser QA runtime');
const crypto = require('node:crypto');
const normalize = require('./market-normalize.cjs');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
exports.html = file => {
  const original=fs.readFileSync(file, 'utf8');
  const date=original.match(/<strong id="default_price_date">[^<]*<\/strong>/)?.[0];
  const html=normalize(original);
  const result=date ? html.replace(/<strong id="default_price_date">[^<]*<\/strong>/,()=>date) : html;
  const scripts=text=>[...text.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m=>m[0]);
  require('node:assert/strict').deepEqual(scripts(result),scripts(original),'Fixture must preserve every executable script byte');
  return result;
};
exports.provenance = file => ({originalSha256: sha(fs.readFileSync(file)), servedFixtureSha256: sha(exports.html(file)), policy: 'Only exact reviewed market inputs; current date retained; production bytes untouched'});
exports.network = async context => {
  const root = require('node:path').resolve(__dirname, '../..');
  await context.route('https://econds.github.io/ro_tools_portal/catalog/v1/tools.json', route => route.fulfill({contentType: 'application/json', body: fs.readFileSync(root + '/assets/ro-suite/2.0.0/catalog.snapshot.json', 'utf8')}));
  if (process.env.QA_XLSX_SCRIPT) await context.route('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', route => route.fulfill({contentType: 'text/javascript', body: fs.readFileSync(process.env.QA_XLSX_SCRIPT)}));
};
