'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const normalize=require('../qa/ui-cohesion/normalize.cjs'),base=require('../qa/ui-cohesion/baseline.json'),changes=require('../qa/ui-cohesion/changes.json');
const scripts=h=>[...h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
test('only the reviewed presentation delta: reversing it reproduces the previous index byte for byte',()=>{
  assert.equal(crypto.createHash('sha256').update(normalize(html)).digest('hex'),base.indexSha256);
  for(const [before,after]of changes){assert.notEqual(before,after);assert.equal(html.split(after).length-1,1);}
});
test('inline scripts (formulas, prices, storage, import/export) are untouched',()=>{
  assert.deepEqual(scripts(html),scripts(normalize(html)));
});
test('existing styles are untouched; new rules live only in the ui-cohesion block and add no new palette',()=>{
  const prev=normalize(html),styles=h=>[...h.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)].map(m=>m[1]);
  const before=styles(prev),after=styles(html);
  assert.equal(after.length,before.length+1);
  for(const s of before)assert(after.includes(s));
  const added=fs.readFileSync(path.join(root,'qa/ui-cohesion/ui-cohesion.css'),'utf8');
  const oldColors=new Set((prev.match(/#[0-9a-fA-F]{3,6}\b/g)||[]).map(c=>c.toLowerCase()));
  const fresh=[...new Set((added.match(/#[0-9a-fA-F]{3,6}\b/g)||[]).map(c=>c.toLowerCase()))].filter(c=>!oldColors.has(c));
  assert.deepEqual(fresh.sort(),['#4d5b5e','#5f6b73','#c5d0d8','#cfe0ec','#f5f9fc','#f6f8f9'],'only neutral text/surface tints may be new');
  assert(!/@keyframes|animation:/.test(added),'no decorative animation');
});
test('protected ids, native labels, stage order and shared nav remain',()=>{
  for(const id of base.protectedIds)assert.equal(html.split(`id="${id}"`).length-1,1,id);
  for(const id of [...html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map(m=>m[1]))assert(html.includes(`id="${id}"`),id);
  const pos=s=>html.indexOf(s);
  assert(pos('id="sel_cur_stage"')<pos('id="sel_target_stage"'));
  assert(pos('id="sel_target_stage"')<pos('class="preset-row"'),'current/target controls precede presets');
  assert(pos('class="preset-row"')<pos('id="stage_stepper"'));
  assert(pos('id="total_zeny"')<pos('id="card_shop"'));
  assert(pos('id="card_shop"')<pos('id="card_refine"'));
  assert(pos('id="card_market"')<pos('id="tb_compare"'));
  assert(pos('id="tb_compare"')<pos('id="btn_import"'),'data tools are the last (utility) block');
  assert.equal([...html.matchAll(/class="preset-chip"/g)].length,4);
  assert.match(html,/<script type="module" src="\.\/assets\/ro-suite\/1\.5\.1\/nav\.js">/);
  assert.match(html,/id="market-price-details"/);assert(html.includes('class="market-warning"'));
});
