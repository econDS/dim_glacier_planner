'use strict';
// Zero-dependency source invariants. Run unchanged before and after integration.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const baseline = JSON.parse(read('qa/ro-suite-nav/source-baseline.json'));
const html = require('./price-metadata-normalize.cjs')(require('../qa/first-run/normalize.cjs')(require('../qa/nav140/normalize.cjs')(read('index.html').toString())));
const hosts = [...html.matchAll(/<ro-suite-nav\b([^>]*)>([\s\S]*?)<\/ro-suite-nav>/g)];
const navScripts = [...html.matchAll(/<script\b[^>]*src="\.\/assets\/ro-suite\/1\.3\.0\/nav\.js"[^>]*>[\s\S]*?<\/script>/g)];
const navStyles = [...html.matchAll(/<style\b[^>]*id="ro-suite-nav-fallback"[^>]*>[\s\S]*?<\/style>/g)];
const integrated = hosts.length > 0;
test('committed visual evidence matches the verified production source and original PNG bytes', () => {
  const file = path.join(root, 'qa/ro-suite-nav/evidence-summary.json');
  if (!fs.existsSync(file) || !integrated) return;
  const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(evidence.status, 'passed');
  assert.deepEqual(evidence.failures, []);
  assert.equal(evidence.sourceIndexSha256, sha256(html.replace('assets/ro-suite/1.3.0/nav.js','assets/ro-suite/1.2.0/nav.js')));
  assert.equal(evidence.subpath, '/dim_glacier_planner/');
  assert.equal(evidence.screenshots.length, 3);
  for (const shot of evidence.screenshots) {
    const bytes = read(`qa/ro-suite-nav/screenshots/${shot.file}`);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(sha256(bytes), shot.sha256, shot.file);
    assert.equal(shot.scrollX, 0);
    assert.equal(shot.scrollY, 0);
  }
});
const normalizeSeparators = value => value.split('\n').filter(line => line.trim() !== '').join('\n');
function withoutNavigation() {
  let original = html;
  for (const match of [...hosts, ...navScripts, ...navStyles]) original = original.replace(match[0], '');
  return original;
}
function attributes(source) {
  const out = {};
  let remaining = source;
  for (const match of source.matchAll(/([\w-]+)="([^"]*)"/g)) {
    assert(!(match[1] in out), `duplicate attribute: ${match[1]}`);
    out[match[1]] = match[2];
    remaining = remaining.replace(match[0], '');
  }
  assert.equal(remaining.trim(), '', 'attributes use the reviewed literal values');
  return out;
}
function scriptInventory(source) {
  return [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .map(([, attrs, code]) => ({attributes: attrs, sha256: sha256(code)}));
}
function styleInventory(source) {
  return [...source.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g)]
    .map(([, attrs, code]) => ({attributes: attrs, sha256: sha256(code)}));
}

test('baseline provenance is frozen to the latest Thai-UI source and its parent', () => {
  assert.equal(baseline.baseCommit, '7794dc7a1381c9a8aac2fc728d305b779a099ebc');
  assert.equal(baseline.parentCommit, '911afcf30986e310e5cca233a678aebd3212ca1e');
  assert.equal(baseline.files['index.html'], '7761ae4e57c901e630a42577a59ef9ea46fbb15359e28acb7bc7310f1f9d23df');
  assert.equal(baseline.index.sha256, baseline.files['index.html']);
  assert.equal(baseline.storage.fields.length, 25);
});

test('all original application DOM and Thai UI are unchanged except nav separator blank lines', () => {
  const original = withoutNavigation();
  if (!integrated) assert.equal(sha256(html), baseline.index.sha256, 'QA-only stage must retain every original index byte');
  assert.equal(sha256(normalizeSeparators(original)), baseline.index.separatorNormalizedSha256,
    'only the named fallback style, navigation host, local module, and blank separator lines may be added');
  assert.match(original, /<html lang="th">/);
  assert.match(original, /<body>\s*<h1>Dim Glacier Ultimate Planner<\/h1>/);
});

test('original inline calculation/import/export/storage JavaScript and original CSS retain exact bytes', () => {
  const original = withoutNavigation();
  assert.deepEqual(scriptInventory(original), baseline.index.scripts,
    'all original JS, formulas, handlers, Thai text, and the SheetJS CDN dependency are immutable');
  assert.deepEqual(styleInventory(original), baseline.index.inlineStyles,
    'original app CSS must not be edited to style navigation');
  assert.equal(baseline.index.scripts.length, 2);
  assert.equal(baseline.index.inlineStyles.length, 1);
});

test('all original image assets retain exact bytes', () => {
  for (const [file, hash] of Object.entries(baseline.files)) {
    if (file !== 'index.html') assert.equal(sha256(read(file)), hash, file);
  }
});

test('storage schema, import/export directions, original event modes and share URL capabilities are preserved', () => {
  const original = withoutNavigation();
  const fields = [...original.matchAll(/\{ id: '([^']+)', type: '([^']+)', label: '([^']+)' \}/g)]
    .map(([, id, type, label]) => ({id, type, label}));
  assert.deepEqual(fields, baseline.storage.fields);
  assert.match(original, /const STORAGE_KEY = 'dim-glacier-planner-state-v1';/);
  assert.match(original, /const STORAGE_VERSION = 1;/);
  assert.match(original, /saveTimer = setTimeout\(saveState, 150\);/);
  assert.match(original, /const LEGACY_STAGE_KEYS = \['chk_s4', 'chk_s3', 'sel_s2_lv'\];/);
  assert.match(original, /accept="\.json,\.csv,\.xlsx,\.xls"/);
  assert.match(original, /if \(ext === 'json'\)/);
  assert.match(original, /else if \(ext === 'csv'\)/);
  assert.match(original, /else if \(ext === 'xlsx' \|\| ext === 'xls'\)/);
  for (const name of ['exportJson', 'exportCsv', 'exportExcel']) assert(original.includes(`function ${name}()`));
  assert.match(original, /XLSX\.utils\.book_append_sheet\(wb, ws, 'PlannerData'\)/);
  assert.deepEqual(baseline.features.eventOrDiscountModes, []);
  assert.equal(baseline.features.shareUrl, false);
  assert(!/URLSearchParams|(?:window\.)?location\.(?:hash|search)|history\.(?:pushState|replaceState)|navigator\.share\b/.test(original),
    'baseline has no app share-URL reader/writer or history mutation');
  assert(!/localStorage\.clear\s*\(/.test(html), 'never clear unrelated app storage');
});

test('navigation is either completely absent for pre-edit QA or strictly integrated ahead of original h1', () => {
  assert.equal(hosts.length, integrated ? 1 : 0);
  assert.equal(navScripts.length, integrated ? 1 : 0, 'no partial host/script integration');
  assert.equal(navStyles.length, integrated ? 1 : 0, 'fallback CSS is separate and uniquely named');
  if (!integrated) return;
  assert.deepEqual(attributes(hosts[0][1]), {
    'tool-id': 'dim-glacier',
    'portal-url': 'https://econds.github.io/ro_tools_portal/',
    theme: 'light'
  });
  assert.match(hosts[0][2], /^\s*<nav aria-label="เครื่องมือ RO">\s*<a href="https:\/\/econds\.github\.io\/ro_tools_portal\/">กลับ RO Tools Portal<\/a>\s*<\/nav>\s*$/);
  assert.equal(navScripts[0][0], '<script type="module" src="./assets/ro-suite/1.3.0/nav.js"></script>');
  assert.match(html, /<body>\s*<ro-suite-nav\b/);
  assert(hosts[0].index < html.indexOf('<h1>Dim Glacier Ultimate Planner</h1>'));
  assert(hosts[0].index < navScripts[0].index, 'fallback remains usable before the module executes');
  assert(!/<iframe\b/.test(html));
});

test('fallback CSS cannot leak into calculator/global styling', () => {
  if (!integrated) return;
  const style = navStyles[0][0];
  assert.match(style, /^<style id="ro-suite-nav-fallback">/);
  const css = style.replace(/^<style[^>]*>|<\/style>$/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(css.trim().replace(/\s+/g, ' '),
    'ro-suite-nav > nav > a { display: inline-flex; align-items: center; min-width: 44px; min-height: 44px; }',
    'only the reviewed 44px fallback-link rule is allowed');
});

test('vendored navigation artifacts are exact immutable 1.2.0 bytes with matching lock and catalog identity', () => {
  const directory = baseline.navigation.assetDirectory;
  if (!integrated && !fs.existsSync(path.join(root, directory))) return;
  const expected = {
    'nav.js': 'd75be916445feb4febeaada437841a1b3be68db16a00673198c78fd6f6c8dc5f',
    'catalog.snapshot.json': '800bb9c9d2b52a7fbae58e436b05529e69820fee3627d199da545a6f5e28f7dd',
    'nav.lock.json': '3b0350135ba5f455b38799c7940492938a209e8e0a6570a5126cb40c36127358'
  };
  assert.deepEqual(baseline.navigation.files, expected);
  assert.deepEqual(fs.readdirSync(path.join(root, directory)).sort(), Object.keys(expected).sort());
  for (const [file, hash] of Object.entries(expected)) assert.equal(sha256(read(`${directory}/${file}`)), hash, file);
  const lock = JSON.parse(read(`${directory}/nav.lock.json`));
  assert.equal(lock.bundleVersion, '1.2.0');
  assert.equal(lock.sourceCommit, 'a3966bdda412f05b0756b5d139915e44894c0ee0');
  for (const file of ['nav.js', 'catalog.snapshot.json']) assert.equal(lock.files[file].sha256, expected[file]);
  const catalog = JSON.parse(read(`${directory}/catalog.snapshot.json`));
  const current = catalog.tools.find(tool => tool.id === 'dim-glacier');
  assert.equal(current.canonicalUrl, baseline.publishing.url);
  assert.equal(current.listingStatus, 'listed');
  assert.deepEqual(current.identity, {accent: '#2b6fa3', icon: 'snowflake'});
  const planned = catalog.tools.find(tool => tool.id === 'grade-refine');
  assert.equal(planned.listingStatus, 'planned');
  assert.equal(planned.canonicalUrl, null);
});


test('CI remains a same-repository feature-branch PR check with read-only credentials and no publishing', () => {
  const workflow = read('.github/workflows/ro-suite-nav-qa.yml').toString();
  assert.match(workflow, /\non:\n  pull_request:\n    branches: \[main\]\n    types: \[opened, synchronize, reopened\]\npermissions:/);
  assert.match(workflow, /\npermissions:\n  contents: read\nconcurrency:/);
  assert.match(workflow, /if: github\.head_ref == 'chore\/ro-suite-nav-1.3.0' && github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert(!/pull_request_target|workflow_run|workflow_dispatch|\b(?:contents|pages|id-token):\s*write|\bwrite-all\b/.test(workflow));
  assert(!/git\s+push|gh\s+pr\s+merge|deploy-pages|upload-pages-artifact|actions-gh-pages|peaceiris\/|secrets\./.test(workflow),
    'QA must not publish, merge, deploy, push, or gain deployment credentials');
  for (const match of workflow.matchAll(/uses:\s*([^\s#]+)/g)) {
    assert.match(match[1], /^[^@]+@[a-f0-9]{40}$/, 'all CI actions must be SHA-pinned');
  }
});
