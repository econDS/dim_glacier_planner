#!/usr/bin/env node
'use strict';
/* Real-browser, QA-only runner. No production dependencies or substituted calculator behavior.
 * npm install --prefix "$RUNNER_TEMP/dim-qa" --no-save --package-lock=false --ignore-scripts playwright@1.55.1
 * NODE_PATH="$RUNNER_TEMP/dim-qa/node_modules" BASELINE_ONLY=1 QA_OUTPUT=qa-baseline node tests/dim-nav.browser.cjs
 * NODE_PATH="$RUNNER_TEMP/dim-qa/node_modules" BASE_ROOT=/tmp/dim-original BASE_SHA=<sha> QA_OUTPUT=qa-final node tests/dim-nav.browser.cjs
 * Archive the untouched base source using git archive before the integration. Baseline-only must run first.
 * The final run replays that archive and the final head through the exact GitHub Pages subpath.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const BASE_ROOT = process.env.BASE_ROOT ? path.resolve(process.env.BASE_ROOT) : null;
const PRICE_METADATA_QA = process.env.PRICE_METADATA_QA === '1';
const BASELINE_ONLY = process.env.BASELINE_ONLY === '1';
const OUTPUT = path.resolve(process.env.QA_OUTPUT || path.join(ROOT, 'qa-artifacts'));
const PREFIX = '/dim_glacier_planner/';
const SUFFIX = '?qa=preserve%20me&repeat=a&repeat=b#qa-sentinel';
const WIDTHS = [320, 360, 390, 430, 768, 1440];
const THEMES = ['light']; // Actual source has one fixed light theme and no theme toggle.
const PIN = '1.55.1';
const STORAGE_KEY = 'dim-glacier-planner-state-v1';
const SENTINEL = { key: 'dim-nav-qa-unrelated', value: 'unchanged:ไทย:❄:2026' };
const PORTAL = 'https://econds.github.io/ro_tools_portal/';
const SELF = 'https://econds.github.io/dim_glacier_planner/';
const DESTINATIONS = [PORTAL, 'https://econds.github.io/ro-leveling-map/', 'https://econds.github.io/ro-reform-preparation/', SELF, 'https://econds.github.io/sessrumnir-ocean-week-guide/', 'https://econds.github.io/ro-best-status/'];
const NAV_PATH = 'assets/ro-suite/1.4.0/nav.js';
const FIELD_IDS = ['rate_thb','p_petal','p_amethyst','p_enc_ore','p_neu_ore','p_miasmal','p_sf_stone','p_shining_stone','p_brilliant','m_sf_extract','m_shining_extract','m_glacier_extract','m_enc_crystal','m_neu_crystal','m_device','m_weapon','p_coupon','m_cube9','sel_cur_stage','sel_target_stage','sel_s4_method','sel_s3_method','qty_cube','qty_device','manual_cost'];
const RAW_IDS = ['p_petal','p_amethyst','p_enc_ore','p_neu_ore','p_miasmal','p_sf_stone','p_shining_stone'];
const MARKET_IDS = ['m_sf_extract','m_shining_extract','m_glacier_extract','m_enc_crystal','m_neu_crystal','m_device'];
const servers = [], origins = new Set();
let browser;
fs.mkdirSync(OUTPUT, { recursive: true });
const report = {
  schemaVersion: 1, mode: BASELINE_ONLY ? 'baseline-only' : 'baseline-versus-final', startedAt: new Date().toISOString(),
  subpath: PREFIX, widths: WIDTHS, themes: THEMES, sources: {}, checks: [], failures: [], screenshots: [], scenarios: {}, releaseAssetHttp: [],
  featureInventory: { craft: 'Automatic Craft vs Market selection for six items; material prices are editable', enchant: 'Current and target stages 0–7, four presets, clickable stepper, normal/coupon methods', inventory: 'Owned weapon and completed Enchant stages; no per-item quantity inventory exists', refine: 'Cube quantity, device quantity including consume costs, manual budget', exchange: 'THB per 1,000,000 Zeny; displayed THB is rounded to an integer', shopping: 'Finished/raw views and native clipboard; view selection is not persisted', formats: { json: ['export','import'], csv: ['export','import'], xlsx: ['export','import'], xls: ['import'] }, themes: 'Fixed light only; operating-system dark preference is tested separately without inventing a theme toggle', absentFeatures: ['No theme toggle', 'No event/discount mode', 'No separate quantity-inventory interface', 'No share-URL interface'] },
  limitations: [
    'All calculations, input events, file downloads/imports, dialogs and clipboard operations use the real application in Chromium; no formula, export or browser API is replaced.',
    'Only top-level navigation to the five exact suite destinations is intercepted with a local destination page. Link activation and destinations are verified; remote destination availability is not claimed.',
    'SheetJS 0.20.3 loads from the original live CDN. Excel tests fail if it is unavailable. An import-only XLS fixture is serialized using that real SheetJS library because the app does not export XLS.',
    'Network errors are retained verbatim and compared with explicit baseline signatures; only failures tied to the intentionally aborted exact nav.js request are excluded.',
    'The original page may overflow on small screens. Geometry permits only measured original overflow, never new overflow; content geometry is relative to the original heading to allow the new normal-flow header.'
  ]
};
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function git(args, cwd = ROOT) { try { return execFileSync('git', ['-C',cwd,...args], { encoding:'utf8', stdio:['ignore','pipe','ignore'] }).trim(); } catch { return null; } }
function source(root, supplied) {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const presentationBase = require('../qa/first-run/normalize.cjs')(html);
  const invariantHtml = PRICE_METADATA_QA ? require('./price-metadata-normalize.cjs')(presentationBase) : presentationBase;
  const files = [{ file:'index.html', sha256:sha(html), bytes:Buffer.byteLength(html) }];
  function walk(dir) { if (!fs.existsSync(dir)) return; for (const e of fs.readdirSync(dir,{withFileTypes:true})) { const f=path.join(dir,e.name); if(e.isDirectory()) walk(f); else files.push({ file:path.relative(root,f).split(path.sep).join('/'), sha256:sha(fs.readFileSync(f)), bytes:fs.statSync(f).size }); } }
  walk(path.join(root,'assets'));
  return { directory:root, commit:supplied || git(['rev-parse','HEAD'],root), indexSha256:sha(html), files,
    inlineScripts:[...invariantHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).map(s=>({sha256:sha(s),source:s})),
    inlineStyles:[...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)].map(m=>({sha256:sha(m[1]),source:m[1]})), worktree:git(['status','--short'],root) };
}
function normalize(value) { let result=String(value); for(const origin of origins) result=result.split(origin).join('http://local.test'); return result; }
function save() { report.status=report.failures.length?'failed':'passed'; report.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(OUTPUT,'report.json'),JSON.stringify(report,null,2)+'\n'); if(BASELINE_ONLY) fs.writeFileSync(path.join(OUTPUT,'baseline.json'),JSON.stringify(report,null,2)+'\n'); }
function failure(name,error) { report.failures.push({name,message:error.message||String(error),stack:error.stack||null}); report.checks.push({name,status:'failed'}); console.error('FAIL',name,error.message||error); }
async function check(name,task,page) { try { const value=await task(); report.checks.push({name,status:'passed'}); console.log('PASS',name); return value; } catch(error) { failure(name,error); if(page&&!page.isClosed()) await capture(page,'failure-'+name,false).catch(()=>{}); return undefined; } finally { save(); } }
async function top(page) {
  await page.evaluate(()=>{ for(const e of document.querySelectorAll('.container, .container *')) if(e.scrollLeft||e.scrollTop) e.scrollTo({left:0,top:0,behavior:'instant'}); window.scrollTo({left:0,top:0,behavior:'instant'}); });
  await page.waitForFunction(()=>scrollX===0&&scrollY===0);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function capture(page,name,settle=true) { if(settle) await top(page); const file=name.replace(/[^a-zA-Z0-9._-]/g,'-')+'.png'; await page.screenshot({path:path.join(OUTPUT,file),fullPage:false,animations:'disabled'}); report.screenshots.push({name,file,viewport:page.viewportSize(),...await page.evaluate(()=>({scrollX,scrollY})),url:normalize(page.url()),sha256:sha(fs.readFileSync(path.join(OUTPUT,file)))}); }
async function serve(root,label) {
  const server=http.createServer((request,response)=>{
    let url; try{url=new URL(request.url,'http://localhost');}catch{response.writeHead(400).end();return;}
    if(!url.pathname.startsWith(PREFIX)){response.writeHead(404).end('Exact GitHub Pages subpath only');return;}
    let relative;try{relative=decodeURIComponent(url.pathname.slice(PREFIX.length))||'index.html';}catch{response.writeHead(400).end();return;}
    const target=path.resolve(root,relative);if(!target.startsWith(root+path.sep)){response.writeHead(403).end();return;}
    if(!fs.existsSync(target)||!fs.statSync(target).isFile()){response.writeHead(404).end('Not found');return;}
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg'};
    response.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(response);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});servers.push(server);
  const origin=`http://127.0.0.1:${server.address().port}`;origins.add(origin);return{root,label,origin,url:origin+PREFIX+SUFFIX};
}
function monitor(page,s) {
  const n=s.network;
  page.on('request',r=>n.requests.push({url:r.url(),type:r.resourceType(),method:r.method(),navigation:r.isNavigationRequest()}));
  page.on('requestfailed',r=>n.failedRequests.push({url:r.url(),error:r.failure()?.errorText||''}));
  page.on('response',r=>{const item={url:r.url(),status:r.status(),type:r.request().resourceType()};n.responses.push(item);if(r.status()>=400)n.badResponses.push(item);});
  page.on('console',m=>{if(['error','warning'].includes(m.type()))n.console.push({type:m.type(),text:m.text(),location:m.location()});});
  page.on('pageerror',e=>n.pageErrors.push({message:e.message,stack:e.stack}));
}
async function revealMarket(page) { const summary=page.locator('#market-price-details:not([open]) > summary'); if(await summary.count()) await summary.evaluate(el=>{el.parentElement.open=true;}); }
async function settled(page) { await revealMarket(page); await page.locator('#total_zeny').waitFor(); await page.waitForFunction(()=>document.querySelector('#total_zeny').textContent.includes('Zeny')); await page.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]);}); await top(page); }
async function geometry(page) {
  await top(page);
  return page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const header=document.querySelector('body > h1'), anchor=header.getBoundingClientRect().top;
    const nodes=[...document.querySelectorAll('body > h1,.container,.container > *, .card,.interactive-card,.stage-selects,.stepper,.preset-row,.shop-foot, .toolbar-actions')].filter(e=>e.getClientRects().length);
    const items=nodes.map((e,index)=>{const r=rect(e);return{index,tag:e.tagName,id:e.id,class:e.className,x:r.x,relativeY:r.y-anchor,width:r.width,height:r.height};});
    const pairs=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=nodes[i],b=nodes[j];if(a.contains(b)||b.contains(a))continue;const x=rect(a),y=rect(b);const overlapX=Math.min(x.right,y.right)-Math.max(x.x,y.x),overlapY=Math.min(x.bottom,y.bottom)-Math.max(x.y,y.y);if(overlapX>1&&overlapY>1)pairs.push([i,j]);}
    const host=document.querySelector('ro-suite-nav');return{viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,excess:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,header:rect(header),host:host?rect(host):null,items,collisions:pairs};
  });
}
function compareGeometry(actual,base,label) {
  assert(actual.excess<=base.excess+1,`${label}: overflow ${actual.excess}px exceeds original ${base.excess}px`);
  // First-run intentionally reorders columns and total; functional snapshots above compare every original value/output.
  assert(actual.collisions.length <= base.collisions.length, `${label}: no additional content collisions`);
  if(actual.host){assert(actual.host.x>=-1&&actual.host.right<=actual.viewport+1,`${label}: navigation fits viewport`);assert(actual.host.bottom<=actual.header.y+1,`${label}: navigation does not overlap heading`);}
}
async function values(page) { return page.evaluate(ids=>Object.fromEntries(ids.map(id=>{const e=document.getElementById(id);return[id,e.type==='checkbox'?e.checked:e.value];})),FIELD_IDS); }
async function snapshot(page) {
  return page.evaluate(ids=>{
    const text=id=>document.getElementById(id).textContent.replace(/\s+/g,' ').trim();
    const rows=id=>[...document.querySelectorAll('#'+id+' tr')].map(e=>({text:e.textContent.replace(/\s+/g,' ').trim(),cells:[...e.cells].map(c=>c.textContent.replace(/\s+/g,' ').trim()),item:e.dataset.bestItem||null,craft:e.dataset.bestCraft||null,market:e.dataset.bestMarket||null,chosen:e.dataset.bestChosen||null}));
    return{inputs:Object.fromEntries(ids.map(id=>{const e=document.getElementById(id);return[id,e.value];})),costs:Object.fromEntries(['cost_base','cost_enchant','cost_refine','total_zeny','total_thb'].map(id=>[id,text(id)])),best:rows('tb_compare'),shopping:rows('shop_list'),steps:rows('list_steps'),summary:text('shop_summary'),note:text('shop_note'),gimmick:{title:text('gimmick_title'),message:text('gimmick_msg')},owned:document.getElementById('card_base').classList.contains('owned'),shoppingView:document.querySelector('.view-btn.active').dataset.view,copyDisabled:document.getElementById('btn_copy_shop').disabled,stageButtons:[...document.querySelectorAll('[data-stage]')].map(e=>({stage:e.dataset.stage,disabled:e.disabled,class:e.className})),targetOptions:[...document.getElementById('sel_target_stage').options].map(e=>({value:e.value,disabled:e.disabled}))};
  },FIELD_IDS);
}
async function sentinel(page,s) {
  const storage=await page.evaluate(({sentinel,key})=>({local:localStorage.getItem(sentinel.key),session:sessionStorage.getItem(sentinel.key),keys:Object.keys(localStorage),state:JSON.parse(localStorage.getItem(key)||'null')}),{sentinel:SENTINEL,key:STORAGE_KEY});
  assert.equal(storage.local,SENTINEL.value);assert.equal(storage.session,SENTINEL.value);assert(storage.keys.every(k=>[SENTINEL.key,STORAGE_KEY].includes(k)),'No unexpected persistent keys');assert.equal(page.url(),s.url,'Query/hash preserved byte-for-byte');return storage;
}
async function fill(page,fields) { for(const[id,value]of Object.entries(fields)){const e=page.locator('#'+id);if(id.startsWith('sel_'))await e.selectOption(String(value));else{await e.fill(String(value));await e.press('Tab');}} }
async function reset(page,s) {
  const dialogPromise=page.waitForEvent('dialog');const click=page.locator('#btn_reset').click();const dialog=await dialogPromise;s.dialogs.push({type:dialog.type(),message:dialog.message(),action:'accept app reset in isolated QA context'});assert.equal(dialog.type(),'confirm');await dialog.accept();await click;
  await page.locator('[data-view="finished"]').click();
}
function numeric(text) { return Number(text.replace(/[^\d.-]/g,'')); }
async function testCase(page,s,base,name,setup,verify) {
  await check(s.id+'-'+name,async()=>{await reset(page,s);await setup();const result=await snapshot(page);s.cases[name]=result;if(verify)await verify(result);if(base)assert.deepEqual(result,base.cases[name],`${name}: all input and output values match real baseline`);await sentinel(page,s);},page);
}
async function functional(page,s,base) {
  await testCase(page,s,base,'craft-default',async()=>{},r=>{assert.equal(r.best.length,6);assert.deepEqual(r.best.map(x=>Number(x.chosen)),[415750,150000,2126000,1200000,365750,15997500]);});
  await testCase(page,s,base,'craft-cheap-raw',()=>fill(page,{...Object.fromEntries(RAW_IDS.map(k=>[k,1])),...Object.fromEntries(MARKET_IDS.map(k=>[k,1000000]))}),r=>{assert(r.best.every(x=>x.cells[2]==='Craft'));assert.deepEqual(r.best.map(x=>Number(x.chosen)),[50,75,240,195,35,2301]);});
  await testCase(page,s,base,'craft-cheap-market',()=>fill(page,{...Object.fromEntries(RAW_IDS.map(k=>[k,1000000])),...Object.fromEntries(MARKET_IDS.map(k=>[k,100]))}),r=>{assert(r.best.every(x=>x.cells[2]==='Market'));assert(r.best.every(x=>Number(x.chosen)===100));});
  await testCase(page,s,base,'craft-tie-market',()=>fill(page,{p_petal:1,p_amethyst:1,p_sf_stone:1,m_sf_extract:50}),r=>{assert.equal(r.best[0].cells[2],'Market');assert.equal(r.best[0].chosen,'50');});
  await testCase(page,s,base,'enchant-normal-s4-s3',async()=>{await page.locator('[data-cur="0"][data-target="2"]').click();},r=>{assert.equal(r.steps.length,2);assert.equal(r.inputs.sel_cur_stage,'0');assert.equal(r.inputs.sel_target_stage,'2');assert(r.shopping.some(x=>x.text.includes('Brilliant')));assert(!r.shopping.some(x=>x.text.includes('Coupon')));assert(r.costs.cost_enchant!=='0');});
  await testCase(page,s,base,'enchant-coupon-s4-s3',async()=>{await page.locator('[data-cur="0"][data-target="2"]').click();await fill(page,{sel_s4_method:'coupon',sel_s3_method:'coupon',p_coupon:1234567});},r=>{assert(r.shopping.some(x=>x.text.includes('Coupon')&&x.cells[1]==='x 3'));assert(!r.shopping.some(x=>x.text.includes('Brilliant')));assert.equal(r.steps.length,2);});
  await testCase(page,s,base,'enchant-owned-lv3-to-lv5',()=>fill(page,{sel_cur_stage:'5',sel_target_stage:'7'}),r=>{assert.equal(r.steps.length,2);assert(r.owned);assert.equal(r.costs.cost_base,'มีแล้ว');assert.equal(r.stageButtons.filter(x=>x.disabled).length,5);assert(!r.shopping.some(x=>x.text.includes('Coupon')));});
  await testCase(page,s,base,'enchant-completed-inventory',()=>fill(page,{sel_cur_stage:'7',sel_target_stage:'7'}),r=>{assert(r.owned);assert.equal(r.costs.cost_enchant,'0');assert(r.copyDisabled);assert.equal(r.costs.total_zeny,'0 Zeny');});
  await testCase(page,s,base,'enchant-stepper-preset',async()=>{await page.locator('[data-cur="2"][data-target="4"]').click();await page.locator('[data-stage="6"]').click();},r=>{assert.equal(r.inputs.sel_cur_stage,'2');assert.equal(r.inputs.sel_target_stage,'6');assert.equal(r.steps.length,4);});
  await testCase(page,s,base,'refine-cube',()=>fill(page,{qty_cube:1,qty_device:0,manual_cost:0}),r=>assert.equal(r.costs.cost_refine,'50,000,000'));
  await testCase(page,s,base,'refine-device-with-consume',()=>fill(page,{qty_cube:0,qty_device:2,manual_cost:0}),r=>assert.equal(r.costs.cost_refine,'64,142,000'));
  await testCase(page,s,base,'refine-mixed-manual-budget',()=>fill(page,{qty_cube:2,qty_device:3,manual_cost:1234567}),r=>assert.equal(r.costs.cost_refine,'197,447,567'));
  await testCase(page,s,base,'refine-custom-market-price',()=>fill(page,{m_cube9:1230000,qty_cube:3,qty_device:0,manual_cost:7654321}),r=>assert.equal(r.costs.cost_refine,'11,344,321'));
  await testCase(page,s,base,'exchange-one-million-unit',()=>fill(page,{sel_target_stage:'0',m_weapon:1000000,rate_thb:35.5}),r=>{assert.equal(r.costs.total_zeny,'1,000,000 Zeny');assert.equal(r.costs.total_thb,'36 THB');});
  await testCase(page,s,base,'exchange-zero-rate',()=>fill(page,{sel_target_stage:'0',m_weapon:1000000,rate_thb:0}),r=>{assert.equal(r.costs.total_zeny,'1,000,000 Zeny');assert.equal(r.costs.total_thb,'0 THB');});
  await testCase(page,s,base,'input-formatting',async()=>{await fill(page,{p_petal:'12x345',rate_thb:'7.456'});},r=>{assert.equal(r.inputs.p_petal,'12,345');assert.equal(r.inputs.rate_thb,'7.46');});
  await check(s.id+'-shopping-views-native-copy-details',async()=>{
    await reset(page,s);await page.locator('[data-cur="2"][data-target="4"]').click();s.shopping={};
    for(const view of ['finished','raw']){await page.locator(`[data-view="${view}"]`).click();const result=await snapshot(page);const expectedCopy='Dim Glacier: Slot 4 + 3 -> Slot 2 Lv 2\n'+result.shopping.filter(x=>x.cells.length===3).map(row=>row.cells[0]+' x'+row.cells[1].replace(/^x\s*/, '')).join('\n');await page.locator('#btn_copy_shop').click();await page.waitForFunction(async expected=>(await navigator.clipboard.readText())===expected,expectedCopy);const copied=await page.evaluate(()=>navigator.clipboard.readText());assert(copied.startsWith('Dim Glacier: Slot 4 + 3 -> Slot 2 Lv 2\n'));for(const row of result.shopping.filter(x=>x.cells.length===3))assert(copied.includes(row.cells[0]+' x'+row.cells[1].replace(/^x\s*/,'')));s.shopping[view]={result,copied};if(base)assert.deepEqual(s.shopping[view],base.shopping[view]);}
    assert.notDeepEqual(s.shopping.raw.result.shopping,s.shopping.finished.result.shopping);assert.equal(s.shopping.raw.result.costs.cost_enchant,s.shopping.finished.result.costs.cost_enchant);
    await page.locator('.step-details summary').click();assert(await page.locator('.step-details').getAttribute('open')!==null);assert(await page.locator('#list_steps').isVisible());await page.locator('.step-details summary').click();
    const item=page.locator('#card_market [data-copy]').first();const expected=await item.getAttribute('data-copy');await item.click();await page.waitForFunction(async expected=>(await navigator.clipboard.readText())===expected,expected);assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);s.shopping.itemCopy=expected;
  },page);
}
function parseCsv(bytes) { const input=bytes.toString('utf8').replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}return rows; }
function rowsToValues(rows) { return Object.fromEntries(rows.map(r=>[r.id,String(r.value).replace(/,/g,'')])); }
function normalizedValues(v) { return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,String(x).replace(/,/g,'')])); }
async function importUpload(page,s,file) {
  const expectedStatus=`นำเข้าข้อมูลจาก ${path.basename(file)} เรียบร้อย`;
  // Observe real status mutations rather than polling a transient status: the existing
  // 150ms input autosave can legitimately replace success before a polling frame.
  // This passive observer neither changes status nor substitutes any import behavior.
  await page.evaluate(()=>{const node=document.getElementById('storage_status');const statuses=[];const observer=new MutationObserver(()=>statuses.push(node.textContent));observer.observe(node,{childList:true,characterData:true,subtree:true});window.__dimImportObservation={statuses,observer};});
  try{const chooser=page.waitForEvent('filechooser');await page.locator('#btn_import').click();await(await chooser).setFiles(file);await page.waitForFunction(expected=>window.__dimImportObservation.statuses.includes(expected),expectedStatus);}
  finally{const observed=await page.evaluate(()=>{const x=window.__dimImportObservation;const statuses=x?.statuses||[];x?.observer.disconnect();delete window.__dimImportObservation;return statuses;});(s.importObservations||=[]).push({file:path.basename(file),expectedStatus,observed});}
}

async function formatRoundTrips(page,s,base) {
  await reset(page,s);await fill(page,{rate_thb:19.25,p_petal:12345,p_amethyst:6789,m_weapon:999999,sel_cur_stage:'2',sel_target_stage:'6',qty_cube:2,qty_device:1,manual_cost:4321098});
  s.formats={};const original=await snapshot(page);s.roundTripOriginal=original;
  for(const [format,button]of [['json','btn_export_json'],['csv','btn_export_csv'],['xlsx','btn_export_excel']]){
    await check(s.id+'-'+format+'-real-export-import-roundtrip',async()=>{
      if(format==='xlsx')assert(await page.evaluate(()=>!!window.XLSX),'Original SheetJS CDN must load for real XLSX export/import');
      const pending=page.waitForEvent('download');await page.locator('#'+button).click();const download=await pending;const file=s.id+'-sample.'+format;const dest=path.join(OUTPUT,file);await download.saveAs(dest);assert.equal(await download.failure(),null);assert(download.suggestedFilename().endsWith('.'+format));const bytes=fs.readFileSync(dest);assert(bytes.length>100);
      let payload,rows;
      if(format==='json'){payload=JSON.parse(bytes.toString('utf8'));assert.equal(payload.app,'Dim Glacier Ultimate Planner');assert.equal(payload.version,1);assert.equal(payload.fields.length,25);assert(!('metadata' in payload),'Portable JSON export omits local-only metadata');rows=payload.fields;assert.deepEqual(normalizedValues(payload.values),normalizedValues(original.inputs));}
      else if(format==='csv'){const table=parseCsv(bytes);assert.deepEqual(table[0],['id','label','type','value']);rows=table.slice(1).map(row=>Object.fromEntries(table[0].map((key,i)=>[key,row[i]])));}
      else{assert.equal(bytes.subarray(0,2).toString(),'PK','XLSX is a real ZIP workbook');const workbook=await page.evaluate(data=>{const wb=XLSX.read(new Uint8Array(data),{type:'array'});return{names:wb.SheetNames,rows:XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})};},[...bytes]);assert.deepEqual(workbook.names,['PlannerData']);rows=workbook.rows;}
      assert.equal(rows.length,25);assert.deepEqual(rowsToValues(rows),normalizedValues(original.inputs));
      await fill(page,{p_petal:1,sel_cur_stage:'0',qty_cube:0,manual_cost:0});assert.notDeepEqual((await snapshot(page)).inputs,original.inputs);await importUpload(page,s,dest);const imported=await snapshot(page);assert.deepEqual(imported,original,'Import restores real inputs, results, shopping and ownership');
      s.formats[format]={file,bytes:bytes.length,sha256:sha(bytes),suggestedFilename:download.suggestedFilename(),rows,imported};if(base)assert.deepEqual(imported,base.formats[format].imported);await sentinel(page,s);
    },page);
  }
  if(base){s.backwardCompatibility={};for(const format of ['json','csv','xlsx'])await check(s.id+'-'+format+'-imports-real-baseline-download',async()=>{const baselineFile=base.formats[format];assert(baselineFile,'Baseline export must have succeeded');await fill(page,{p_petal:2,qty_cube:0});await importUpload(page,s,path.join(OUTPUT,baselineFile.file));const result=await snapshot(page);assert.deepEqual(result,baselineFile.imported,'Final application imports actual baseline download without behavioral differences');s.backwardCompatibility[format]={baselineFile:baselineFile.file,baselineSha256:baselineFile.sha256,result};await sentinel(page,s);},page);}
  await check(s.id+'-xls-import-only',async()=>{
    assert(await page.evaluate(()=>!!window.XLSX),'Original SheetJS required for real XLS import fixture');
    const rows=s.formats.xlsx?.rows||s.formats.json?.rows;assert(rows);const bytes=await page.evaluate(rows=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'PlannerData');return [...new Uint8Array(XLSX.write(wb,{bookType:'biff8',type:'array'}))];},rows);
    const file=s.id+'-import-only.xls';const dest=path.join(OUTPUT,file);fs.writeFileSync(dest,Buffer.from(bytes));assert.equal(Buffer.from(bytes).subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');await fill(page,{p_petal:1});await importUpload(page,s,dest);const result=await snapshot(page);assert.deepEqual(result,original);s.formats.xls={file,bytes:bytes.length,sha256:sha(Buffer.from(bytes)),imported:result,provenance:'Real SheetJS biff8 fixture, import-only direction'};
  },page);
  await check(s.id+'-storage-reload-query-hash',async()=>{await page.waitForFunction(key=>{const x=JSON.parse(localStorage.getItem(key)||'null');return x&&x.values.p_petal==='12,345';},STORAGE_KEY);const before=await snapshot(page);s.storageBefore=await sentinel(page,s);await page.reload({waitUntil:'networkidle'});await settled(page);assert.deepEqual(await snapshot(page),before);s.storageAfter=await sentinel(page,s);if(base)assert.deepEqual(s.storageAfter.state.values,base.storageAfter.state.values);},page);
  await check(s.id+'-reset-cancel-retains-state',async()=>{const before=await snapshot(page);const pending=page.waitForEvent('dialog');const click=page.locator('#btn_reset').click();const dialog=await pending;assert.equal(dialog.type(),'confirm');s.dialogs.push({type:dialog.type(),message:dialog.message(),action:'cancel reset'});await dialog.dismiss();await click;assert.deepEqual(await snapshot(page),before);await sentinel(page,s);},page);
  await check(s.id+'-invalid-import-no-state-loss',async()=>{
    const before=await snapshot(page);const file=path.join(OUTPUT,s.id+'-invalid-import.json');fs.writeFileSync(file,JSON.stringify({version:1,app:'Dim Glacier Ultimate Planner',values:{p_petal:-1}}));
    const dialogEvent=page.waitForEvent('dialog');const importAction=page.locator('#file_import').setInputFiles(file);const dialog=await dialogEvent;s.dialogs.push({type:dialog.type(),message:dialog.message(),action:'dismiss invalid import alert'});assert.equal(dialog.type(),'alert');await dialog.dismiss();await importAction;assert.deepEqual(await snapshot(page),before);await sentinel(page,s);
  },page);
}
async function customStateNavigation(page,s,base) {
  await check(s.id+'-custom-state-navigation-and-reload',async()=>{
    assert(s.formats.json,'Real custom JSON export is required');await importUpload(page,s,path.join(OUTPUT,s.formats.json.file));
    const before=await snapshot(page);assert(before.owned);assert.equal(before.inputs.sel_cur_stage,'2');assert.equal(before.inputs.sel_target_stage,'6');assert.equal(before.inputs.qty_cube,'2');assert.equal(before.inputs.qty_device,'1');assert.equal(before.inputs.manual_cost,'4,321,098');
    s.customStateNavigation={before,actions:[]};
    const unchanged=async(label,expected)=>{const result=await snapshot(page);assert.deepEqual(result,expected,label);await sentinel(page,s);s.customStateNavigation.actions.push(label);};
    if(s.kind==='normal'){
      const button=page.locator('ro-suite-nav .bar button');
      await button.focus();await page.keyboard.press('Enter');assert.equal(await button.getAttribute('aria-expanded'),'true');await unchanged('custom state while Enter menu open',before);await page.keyboard.press('Escape');assert.equal(await button.getAttribute('aria-expanded'),'false');await unchanged('custom state after Escape',before);
      await page.keyboard.press('Space');assert.equal(await button.getAttribute('aria-expanded'),'true');await page.keyboard.press('Space');assert.equal(await button.getAttribute('aria-expanded'),'false');await unchanged('custom state after Space toggle pair',before);
      await button.click();await button.click();assert.equal(await button.getAttribute('aria-expanded'),'false');await unchanged('custom state after repeated click pair',before);
    }
    await page.locator('[data-view="raw"]').click();const raw=await snapshot(page);s.customStateNavigation.raw=raw;
    if(s.kind==='normal'){const button=page.locator('ro-suite-nav .bar button');await button.click();await unchanged('raw shopping while menu open',raw);await button.click();await unchanged('raw shopping after menu closes',raw);}
    // The genuine app does not persist its raw/finished view. Restore finished before
    // reload so all persisted planner state can be compared without inventing a feature.
    await page.locator('[data-view="finished"]').click();await unchanged('finished view restored without changing custom plan',before);
    if(s.kind==='fallback'){const link=page.locator('ro-suite-nav a');await link.focus();await Promise.all([page.waitForURL(PORTAL),page.keyboard.press('Enter')]);assert.equal(await page.title(),'Dim QA destination');await page.goBack({waitUntil:'networkidle'});await settled(page);await unchanged('custom state after blocked-script Portal and Back',before);assert.equal(await page.locator('ro-suite-nav').evaluate(e=>!!e.shadowRoot),false);}
    await page.reload({waitUntil:'networkidle'});await settled(page);await unchanged('custom state after reload',before);s.customStateNavigation.afterReload=await snapshot(page);if(base){assert.deepEqual(before,base.customStateNavigation.before);assert.deepEqual(raw,base.customStateNavigation.raw);assert.deepEqual(s.customStateNavigation.afterReload,base.customStateNavigation.afterReload);}
  },page);
}
async function legacyMigration(page,s,base) {
  s.legacy={};const originalFile=s.formats.json;assert(originalFile,'Legacy migration requires a successful real JSON export');
  for(const [name,legacy,target]of [['no-slot4',{chk_s4:false,chk_s3:true,sel_s2_lv:5},'0'],['slot4-only',{chk_s4:true,chk_s3:false,sel_s2_lv:5},'1'],['slot2-level3',{chk_s4:true,chk_s3:true,sel_s2_lv:3},'5']]){
    await check(s.id+'-legacy-json-'+name,async()=>{
      await importUpload(page,s,path.join(OUTPUT,originalFile.file));await fill(page,{sel_cur_stage:'0',sel_target_stage:target});const expected=await snapshot(page);
      const inputs={...s.roundTripOriginal.inputs};delete inputs.sel_cur_stage;delete inputs.sel_target_stage;const payload={version:1,app:'Dim Glacier Ultimate Planner',values:{...inputs,...legacy}};
      const file=s.id+'-legacy-'+name+'.json';fs.writeFileSync(path.join(OUTPUT,file),JSON.stringify(payload,null,2));await fill(page,{p_petal:3,sel_cur_stage:'2',sel_target_stage:'7'});await importUpload(page,s,path.join(OUTPUT,file));const result=await snapshot(page);assert.deepEqual(result,expected,'Actual legacy JSON migration agrees with equivalent current UI plan');assert.equal(result.inputs.sel_cur_stage,'0');assert.equal(result.inputs.sel_target_stage,target);s.legacy[name]={file,payload,result};if(base)assert.deepEqual(result,base.legacy[name].result);await sentinel(page,s);
    },page);
  }
  await check(s.id+'-legacy-storage-reload',async()=>{
    const source=s.legacy['slot2-level3'];assert(source);await page.waitForFunction(key=>{const state=JSON.parse(localStorage.getItem(key)||'null');return state?.values?.sel_target_stage==='5';},STORAGE_KEY);
    // Seed only this app's own key with a documented old-format fixture in an isolated QA context.
    // This exercises real startup migration without replacing Storage or clearing unrelated state.
    await page.evaluate(({key,payload})=>localStorage.setItem(key,JSON.stringify(payload)),{key:STORAGE_KEY,payload:source.payload});await page.reload({waitUntil:'networkidle'});await settled(page);const result=await snapshot(page);assert.deepEqual(result,source.result);s.legacy.storageReload={input:source.payload,result,storage:await sentinel(page,s)};if(base)assert.deepEqual(result,base.legacy.storageReload.result);
  },page);
}
async function navigation(page,s,base) {
  const host=page.locator('ro-suite-nav'),button=host.locator('.bar button');await button.waitFor();assert.equal(await host.count(),1);assert.equal(await host.getAttribute('tool-id'),'dim-glacier');assert.equal(await host.getAttribute('theme'),'light');assert.equal(await host.getAttribute('portal-url'),PORTAL);assert.equal(await host.getAttribute('catalog-url'),null);
  const identity=await host.evaluate(e=>{const n=e.shadowRoot.querySelector('nav');return{accent:getComputedStyle(e.shadowRoot.querySelector('.current .chip')).backgroundColor,cssAccent:n.style.getPropertyValue('--tool-accent'),title:e.shadowRoot.querySelector('.current').textContent,paths:[...e.shadowRoot.querySelectorAll('.current .chip path')].map(p=>p.getAttribute('d')),colorScheme:getComputedStyle(e).colorScheme};});
  assert.equal(identity.accent,'rgb(43, 111, 163)');assert.equal(identity.cssAccent,'#2b6fa3');assert.equal(identity.title,'Dim Glacier Planner');assert.equal(identity.colorScheme,'light');assert.deepEqual(identity.paths,['M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9','m9.5 5 2.5 2 2.5-2M9.5 19l2.5-2 2.5 2']);
  s.navigation={identity,keyboard:[]};await top(page);await page.keyboard.press('Tab');assert(await host.locator('.bar > a').evaluate(e=>e.getRootNode().activeElement===e));await page.keyboard.press('Tab');assert(await button.evaluate(e=>e.getRootNode().activeElement===e));await page.keyboard.press('Enter');assert.equal(await button.getAttribute('aria-expanded'),'true');assert(await host.locator('#tools').isVisible());
  const links=host.locator('#tools a');const data=await links.evaluateAll(es=>es.map(e=>({href:e.href,text:e.textContent,current:e.getAttribute('aria-current')})));assert.deepEqual(data.map(x=>x.href),DESTINATIONS.slice(1));assert.deepEqual(data.filter(x=>x.current==='page').map(x=>x.href),[SELF]);s.navigation.links=data;
  const planned=host.locator('#tools li').filter({hasText:'Grade & Refine Workshop'});assert.equal(await planned.count(),1);assert((await planned.innerText()).includes('อยู่ในแผน'));assert.equal(await planned.locator('a,button,[tabindex]').count(),0);
  const targets=await host.locator('a,button').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,width:r.width,height:r.height};}));targets.forEach(t=>assert(t.width>=44&&t.height>=44,`44×44 target: ${t.text}`));s.navigation.targets=targets;s.navigation.openGeometry=await geometry(page);compareGeometry(s.navigation.openGeometry,base.geometry,'expanded nav');await capture(page,s.id+'-menu-open');
  for(let i=0;i<await links.count();i++){await page.keyboard.press('Tab');assert(await links.nth(i).evaluate(e=>e.getRootNode().activeElement===e));}await page.keyboard.press('Escape');assert.equal(await button.getAttribute('aria-expanded'),'false');assert(await button.evaluate(e=>e.getRootNode().activeElement===e),'Escape returns focus');await page.keyboard.press('Space');assert.equal(await button.getAttribute('aria-expanded'),'true');await page.keyboard.press('Space');assert.equal(await button.getAttribute('aria-expanded'),'false');await page.keyboard.press('Enter');for(let i=0;i<=await links.count();i++)await page.keyboard.press('Tab');assert.equal(await button.getAttribute('aria-expanded'),'false');assert(await host.evaluate(e=>document.activeElement!==e));await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');await button.click();assert.equal(await button.getAttribute('aria-expanded'),'false');s.navigation.keyboard=['Tab Portal','Tab toggle','Enter opens','Tab all listed tools','Escape closes and restores focus','Space opens/closes','Tab out closes','Repeated click opens/closes'];
}
async function fallback(page,s,base) {
  const host=page.locator('ro-suite-nav'),link=host.locator('a');assert.equal(await host.count(),1);assert.equal(await host.evaluate(e=>!!e.shadowRoot),false);assert(s.blockedRequests.length>0,'Actual nav.js request blocked');assert(s.blockedRequests.every(x=>x===s.navScriptUrl));assert.equal(await link.count(),1);assert(await link.isVisible());assert.equal(await link.getAttribute('href'),PORTAL);await top(page);const box=await link.boundingBox();assert(box.width>=44&&box.height>=44);assert(box.x>=0&&box.x+box.width<=s.width+1);assert(box.y>=0&&box.y+box.height<=900);const g=await geometry(page);compareGeometry(g,base.geometry,'script-blocked fallback');s.fallback={box,geometry:g,blockedRequests:s.blockedRequests};await capture(page,s.id+'-fallback-visible');await page.keyboard.press('Tab');assert(await link.evaluate(e=>document.activeElement===e));await Promise.all([page.waitForURL(PORTAL),page.keyboard.press('Enter')]);assert.equal(await page.title(),'Dim QA destination');await page.goBack({waitUntil:'networkidle'});await settled(page);assert.equal(await host.evaluate(e=>!!e.shadowRoot),false);s.fallback.keyboard=['Tab fallback','Enter exact Portal','Back preserves blocked script and calculator'];
}
async function destinations(page,s) {
  s.navigation.destinationInteractions=[];await importUpload(page,s,path.join(OUTPUT,s.formats.json.file));
  for(const destination of DESTINATIONS){await check(s.id+'-destination-'+DESTINATIONS.indexOf(destination),async()=>{const before=await snapshot(page);const host=page.locator('ro-suite-nav');await host.locator('.bar button').waitFor();if(destination!==PORTAL)await host.locator('.bar button').click();const link=destination===PORTAL?host.locator('.bar > a'):host.locator(`#tools a[href="${destination}"]`);await link.focus();await Promise.all([page.waitForURL(destination),page.keyboard.press('Enter')]);assert.equal(await page.title(),'Dim QA destination');await page.goBack({waitUntil:'networkidle'});await settled(page);await sentinel(page,s);const after=await snapshot(page);assert.deepEqual(after,before,'Every real suite destination and Back retains custom inputs, prices, inventory, Enchant, shopping and Refine results');s.navigation.destinationInteractions.push({destination,activation:'Enter',interceptedLocally:true,before,after});},page);}
}
async function runScenario(server,width,kind,base) {
  const id=`${kind}-${width}-light`;const s=report.scenarios[id]={id,kind,width,theme:'light',url:server.url,cases:{},dialogs:[],blockedRequests:[],network:{requests:[],responses:[],failedRequests:[],badResponses:[],console:[],pageErrors:[]}};
  const context=await browser.newContext({...(PRICE_METADATA_QA ? {timezoneId:width===390?'Asia/Bangkok':'America/Los_Angeles'} : {}),viewport:{width,height:900},colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block',permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
  await context.addInitScript(({sentinel,prefix})=>{if(location.pathname.startsWith(prefix)){if(localStorage.getItem(sentinel.key)===null)localStorage.setItem(sentinel.key,sentinel.value);if(sessionStorage.getItem(sentinel.key)===null)sessionStorage.setItem(sentinel.key,sentinel.value);}},{sentinel:SENTINEL,prefix:PREFIX});
  if(kind!=='baseline'){const html=fs.readFileSync(path.join(server.root,'index.html'),'utf8');const matches=[...html.matchAll(/<script\b[^>]*src=["']([^"']*nav\.js)["'][^>]*>/g)];assert.equal(matches.length,1,'Exactly one actual installed nav.js');s.navScriptUrl=new URL(matches[0][1],server.url).href;assert.equal(new URL(s.navScriptUrl).pathname,PREFIX+NAV_PATH);}
  if(kind==='fallback')await context.route(s.navScriptUrl,async route=>{s.blockedRequests.push(route.request().url());await route.abort('blockedbyclient');});
  await context.route('https://econds.github.io/**',async route=>{const r=route.request();if(r.isNavigationRequest()&&r.resourceType()==='document'&&DESTINATIONS.includes(r.url()))await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Dim QA destination</title><p>Exact suite destination reached</p>'});else await route.continue();});
  const page=await context.newPage();page.setDefaultTimeout(12000);monitor(page,s);
  // Existing regression cases exercise full price settings. Dedicated first-run QA tests the default closed state.
  const reload=page.reload.bind(page);page.reload=async(...args)=>{const response=await reload(...args);await revealMarket(page);return response;};
  try{
    await page.goto(server.url,{waitUntil:'networkidle',timeout:45000});await settled(page);
    await check(id+'-initial-inventory-geometry',async()=>{s.initial=await snapshot(page);assert.equal(Object.keys(s.initial.inputs).length,25);s.geometry=await geometry(page);s.title=await page.title();s.theme=await page.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,card:getComputedStyle(document.querySelector('.card')).backgroundColor,toggles:[...document.querySelectorAll('button,input,select')].filter(e=>!e.closest('ro-suite-nav')&&/theme|dark|light/i.test([e.id,e.getAttribute('aria-label')].join(' '))).map(e=>e.id)}));assert.equal(s.theme.body,'rgb(244, 247, 246)');assert.equal(s.theme.card,'rgb(255, 255, 255)');assert.deepEqual(s.theme.toggles,[]);if(base){assert.deepEqual(s.initial,base.initial);assert.deepEqual(s.theme,base.theme);compareGeometry(s.geometry,base.geometry,'collapsed nav');}await capture(page,id+'-initial');},page);
    if(kind==='normal')await check(id+'-navigation',()=>navigation(page,s,base),page);
    if(kind==='fallback')await check(id+'-fallback',()=>fallback(page,s,base),page);
    await functional(page,s,base);await formatRoundTrips(page,s,base);await customStateNavigation(page,s,base);await legacyMigration(page,s,base);
    if(kind==='normal'&&(width===390||width===1440))await destinations(page,s);
    await check(id+'-os-dark-preference-keeps-actual-light-theme',async()=>{await page.emulateMedia({colorScheme:'dark'});const styles=await page.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,card:getComputedStyle(document.querySelector('.card')).backgroundColor,nav:document.querySelector('ro-suite-nav')?.getAttribute('theme')||null}));assert.equal(styles.body,'rgb(244, 247, 246)');assert.equal(styles.card,'rgb(255, 255, 255)');if(kind!=='baseline')assert.equal(styles.nav,'light');s.osDarkPreference=styles;await page.emulateMedia({colorScheme:'light'});},page);
    if(PRICE_METADATA_QA && kind==='normal' && [390,1440].includes(width)) await require('./price-metadata.browser.cjs')({page,s,check,reset,fill,snapshot,capture,OUTPUT});
    await check(id+'-final-sentinel-query-hash',async()=>{s.storageFinal=await sentinel(page,s);},page);
  }catch(error){failure(id+'-scenario',error);await capture(page,'failure-'+id,false).catch(()=>{});}finally{await context.close();save();}
  return s;
}
function signatures(s){const n=s.network;const excluded=i=>s.kind==='fallback'&&(i.url===s.navScriptUrl||i.location?.url===s.navScriptUrl);const unique=xs=>[...new Set(xs.map(normalize))].sort();return{pageErrors:unique(n.pageErrors.map(x=>x.message)),consoleErrors:unique(n.console.filter(x=>x.type==='error'&&!excluded(x)).map(x=>`${x.text} @ ${x.location?.url||''}`)),consoleWarnings:unique(n.console.filter(x=>x.type==='warning'&&!excluded(x)).map(x=>`${x.text} @ ${x.location?.url||''}`)),failedRequests:unique(n.failedRequests.filter(x=>!excluded(x)&&!(x.error==='net::ERR_ABORTED'&&origins.has(new URL(x.url).origin)&&n.responses.some(r=>r.url===x.url&&r.status===200&&r.type==='image'))).map(x=>`${x.error} ${x.url}`)),badResponses:unique(n.badResponses.filter(x=>!excluded(x)).map(x=>`${x.status} ${x.url}`))};}
function compareNetwork(){const all=Object.values(report.scenarios),bases=all.filter(s=>s.kind==='baseline'),categories=['pageErrors','consoleErrors','consoleWarnings','failedRequests','badResponses'];const baselineUnion=Object.fromEntries(categories.map(k=>[k,[...new Set(bases.flatMap(s=>signatures(s)[k]))].sort()]));report.networkComparison={baselineUnion,scenarios:{},policy:'Exact measured baseline signature allowance. Only deliberately blocked nav.js and transient local image cancellations with an observed successful200 image response are excluded. Raw failures remain recorded; no CDN or console suppression.'};const external=new Set(bases.flatMap(s=>s.network.requests.filter(r=>!origins.has(new URL(r.url).origin)).map(r=>r.url)));for(const s of all){s.network.signatures=signatures(s);if(s.kind==='baseline')continue;const comparison=report.networkComparison.scenarios[s.id]={novel:{},expectedBlockedNavErrors:s.kind==='fallback'?s.network.failedRequests.filter(x=>x.url===s.navScriptUrl):[]};for(const k of categories){comparison.novel[k]=s.network.signatures[k].filter(x=>!baselineUnion[k].includes(x));assert.deepEqual(comparison.novel[k],[],`${s.id}: no new ${k}`);}comparison.newExternalRequests=[...new Set(s.network.requests.filter(r=>!origins.has(new URL(r.url).origin)).map(r=>r.url))].filter(x=>!external.has(x)&&!DESTINATIONS.includes(x));assert.deepEqual(comparison.newExternalRequests,[],`${s.id}: no new external request`);}}
async function releaseAssets(server){const context=await browser.newContext();try{for(const file of ['nav.js','catalog.snapshot.json','nav.lock.json']){const relative='assets/ro-suite/1.4.0/'+file;const expected=fs.readFileSync(path.join(ROOT,relative));const url=server.origin+PREFIX+relative;const response=await context.request.get(url);const bytes=await response.body();const item={file:relative,url:normalize(url),status:response.status(),bytes:bytes.length,sha256:sha(bytes),expectedSha256:sha(expected)};report.releaseAssetHttp.push(item);assert.equal(response.status(),200);assert.equal(response.url(),url);assert.deepEqual(bytes,expected);}}finally{await context.close();}}
(async()=>{try{
  report.sources.current=source(ROOT,process.env.SOURCE_SHA||process.env.GITHUB_SHA);
  if(BASELINE_ONLY){assert(!/<ro-suite-nav\b/i.test(fs.readFileSync(path.join(ROOT,'index.html'),'utf8')),'Baseline-only must run before any production nav edit');report.sources.base={...report.sources.current,commit:process.env.BASE_SHA||report.sources.current.commit};}
  else{assert(BASE_ROOT,'BASE_ROOT required for archived baseline');assert.notEqual(BASE_ROOT,ROOT);report.sources.base=source(BASE_ROOT,process.env.BASE_SHA);assert.deepEqual(report.sources.current.inlineScripts,report.sources.base.inlineScripts,'Original calculation/storage/export scripts byte-for-byte unchanged');for(const style of report.sources.base.inlineStyles)assert(report.sources.current.inlineStyles.some(x=>x.sha256===style.sha256),'Every original style block is byte-for-byte preserved');for(const old of report.sources.base.files){if(old.file==='index.html')continue;const current=report.sources.current.files.find(x=>x.file===old.file);assert(current,`Original asset exists: ${old.file}`);assert.equal(current.sha256,old.sha256,`Original asset unchanged: ${old.file}`);}}
  const {chromium}=require('playwright');report.playwrightVersion=require('playwright/package.json').version;assert.equal(report.playwrightVersion,PIN,'Pinned Playwright 1.55.1');browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM?{executablePath:process.env.QA_CHROMIUM}:{})});report.browserVersion=browser.version();
  const baseServer=await serve(BASELINE_ONLY?ROOT:BASE_ROOT,'base'),currentServer=BASELINE_ONLY?null:await serve(ROOT,'current');report.servers={base:baseServer,current:currentServer};
  for(const width of WIDTHS)await runScenario(baseServer,width,'baseline');
  if(!BASELINE_ONLY){for(const width of WIDTHS){const base=report.scenarios[`baseline-${width}-light`];await runScenario(currentServer,width,'normal',base);await runScenario(currentServer,width,'fallback',base);}await check('served-release-assets',()=>releaseAssets(currentServer));}
  await check('console-page-network-baseline-comparison',async()=>compareNetwork());
}catch(error){failure('runner',error);}finally{if(browser)await browser.close().catch(()=>{});await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));save();console.log(JSON.stringify({status:report.status,mode:report.mode,passed:report.checks.filter(x=>x.status==='passed').length,failures:report.failures,report:path.join(OUTPUT,'report.json'),screenshots:report.screenshots.length},null,2));process.exitCode=report.failures.length?1:0;}})();
