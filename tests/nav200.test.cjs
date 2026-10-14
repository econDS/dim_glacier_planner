'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=require('../qa/nav200/baseline.json');
const html=fs.readFileSync('index.html','utf8');
test('raw candidate installs one local v2 component with stable identity and script-failure Portal fallback',()=>{
 assert.equal((html.match(/<ro-suite-nav\b/g)||[]).length,1);
 assert.match(html, /<ro-suite-nav tool-id="dim-glacier" theme="light" portal-url="https:\/\/econds.github.io\/ro_tools_portal\/">/);
 assert.equal((html.match(/src="\.\/assets\/ro-suite\/2\.0\.0\/nav\.js"/g)||[]).length,1);
 assert(!html.includes('catalog-url='));
 assert.match(html, /<a href="https:\/\/econds.github.io\/ro_tools_portal\/">กลับ RO Tools Portal<\/a>/);
});
test('only production HTML change is approved script version; all historical assets remain byte-identical',()=>{
 assert.equal(hash(require('../qa/nav200/normalize.cjs')(html)),baseline.indexSha256);
 for(const [file,digest] of Object.entries(baseline.assets))assert.equal(hash(fs.readFileSync(file)),digest,file);
});
test('immutable v2 artifact integrity and exact central endpoint',()=>{
 const dir='assets/ro-suite/2.0.0/',lock=JSON.parse(fs.readFileSync(dir+'nav.lock.json'));
 assert.equal(lock.bundleVersion,'2.0.0');
 for(const [file,entry] of Object.entries(lock.files)) assert.equal(hash(fs.readFileSync(dir+file)),entry.sha256,file);
 assert(fs.readFileSync(dir+'nav.js','utf8').includes('https://econds.github.io/ro_tools_portal/catalog/v1/tools.json'));
});
