'use strict';
// Before/after calculation regression + layout/a11y probes for the UI-cohesion pass.
// BASE_ROOT = immutable checkout of the previous index.html; the candidate is this repository.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const ROOT=path.resolve(__dirname,'..'),BASE=process.env.BASE_ROOT,OUT=path.resolve(process.env.QA_OUTPUT||'qa-artifacts/ui-cohesion');
assert(BASE&&path.resolve(BASE)!==ROOT,'BASE_ROOT (previous revision) required');fs.mkdirSync(OUT,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const serve=root=>new Promise(ok=>{const s=http.createServer((q,r)=>{let p=decodeURIComponent(new URL(q.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}r.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(r)});s.listen(0,'127.0.0.1',()=>ok({s,url:`http://127.0.0.1:${s.address().port}/`}))});
const CASES=[
 {name:'A default 0->7, no refine',fields:{}},
 {name:'B1 2->7, custom prices (+ coupon selects hidden at stage 2)',fields:{sel_cur_stage:2,sel_target_stage:7,p_petal:12345,p_miasmal:400000,m_glacier_extract:2500000,p_coupon:30000000,rate_thb:8,sel_s4_method:'coupon',sel_s3_method:'coupon'}},
 {name:'B2 0->4, custom prices, coupon route for Slot 4 + 3',fields:{sel_cur_stage:0,sel_target_stage:4,p_petal:12345,p_coupon:20000000,rate_thb:8,sel_s4_method:'coupon',sel_s3_method:'coupon'}},
 {name:'C 3->6 with refine qty > 0',fields:{sel_cur_stage:3,sel_target_stage:6,qty_cube:2,qty_device:3,manual_cost:1234567}}
];
async function run(browser,url){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const p=await ctx.newPage();await p.route(/cdn\.sheetjs/,r=>r.abort());
 await p.goto(url);await p.locator('#total_zeny').waitFor();await p.waitForTimeout(300);const res=[];
 const snap=()=>p.evaluate(()=>{const t=id=>document.getElementById(id).textContent.replace(/\s+/g,' ').trim();return Object.fromEntries(['cost_base','cost_enchant','cost_refine','total_zeny','total_thb','shop_summary','shop_list','list_steps','tb_compare'].map(i=>[i,t(i)]))});
 for(const c of CASES){await p.evaluate(()=>{localStorage.clear()});await p.reload();await p.locator('#total_zeny').waitFor();
  for(const [id,v] of Object.entries(c.fields)){await p.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));const el=p.locator('#'+id);if(await el.evaluate(x=>x.tagName)==='SELECT'){if(await el.isVisible())await el.selectOption(String(v));}else{await el.fill(String(v));await el.press('Tab');}}
  await p.waitForTimeout(250);const finished=await snap();await p.locator('[data-view="raw"]').click();const raw=await snap();await p.locator('[data-view="finished"]').click();
  res.push({name:c.name,finished,rawView:{shop_list:raw.shop_list},storage:await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).map(([k,v])=>{try{const o=JSON.parse(v);delete o.exportedAt;if(o.metadata)o.metadata={priceStamped:!!o.metadata.priceLastModified};return[k,o]}catch{return[k,v]}})))});}
 await ctx.close();return res;}
async function probes(browser,url){
 const out=[];
 for(const w of [360,390,1440]){const ctx=await browser.newContext({viewport:{width:w,height:w>800?900:844},reducedMotion:'reduce'});const p=await ctx.newPage();await p.route(/cdn\.sheetjs/,r=>r.abort());await p.goto(url);await p.locator('#total_zeny').waitFor();await p.waitForTimeout(300);
  out.push({width:w,...await p.evaluate(()=>{const vis=e=>e.checkVisibility()&&!e.closest('details:not([open])');const y=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().top):null};
   const small=[...document.querySelectorAll('button:not([disabled]),select,summary,a[href]')].filter(vis).map(e=>{const r=e.getBoundingClientRect();return{t:(e.id||e.className||e.tagName)+':'+(e.textContent||'').trim().slice(0,18),w:Math.round(r.width),h:Math.round(r.height)}}).filter(x=>x.h<32||x.w<32);
   return{overflow:document.documentElement.scrollWidth-innerWidth,curTop:y('#sel_cur_stage'),targetTop:y('#sel_target_stage'),stepperTop:y('#stage_stepper'),totalTop:y('.grand-total'),marketTop:y('#card_market'),toolsTop:y('.toolbar-card'),presetRows:new Set([...document.querySelectorAll('.preset-chip')].map(c=>Math.round(c.getBoundingClientRect().top))).size,small,
    unlabeled:[...document.querySelectorAll('input:not([type=hidden]),select')].filter(e=>!e.labels.length&&!e.getAttribute('aria-label')).map(e=>e.id),stepperNames:[...document.querySelectorAll('#stage_stepper button')].map(b=>b.title&&b.textContent.trim()).every(Boolean)}})});
  // keyboard: Tab reaches the current stage select before presets, stepper and price summary
  await p.evaluate(()=>window.scrollTo(0,0));const order=[];await p.locator('body').press('Tab');for(let i=0;i<14;i++){order.push(await p.evaluate(()=>{const a=document.activeElement;return a.id||a.dataset.stage&&'step'+a.dataset.stage||a.dataset.cur&&'chip'+a.dataset.target||a.tagName}));await p.keyboard.press('Tab');}
  out[out.length-1].tabOrder=order;
  const ring=await p.evaluate(()=>{const e=document.querySelector('.preset-chip');e.focus();return getComputedStyle(e).outlineStyle});out[out.length-1].chipFocusOutline=ring;
  await ctx.close();}
 return out;}
(async()=>{const b=await chromium.launch(),sb=await serve(BASE),sc=await serve(ROOT),report={};
 try{const before=await run(b,sb.url),after=await run(b,sc.url);report.cases=before.map((x,i)=>({name:x.name,identical:JSON.stringify(x)===JSON.stringify(after[i]),total_zeny:x.finished.total_zeny,total_thb:x.finished.total_thb,cost_enchant:x.finished.cost_enchant,cost_refine:x.finished.cost_refine,before:x,after:after[i]}));
  for(const c of report.cases)assert(c.identical,'unchanged output: '+c.name);
  report.probes={before:await probes(b,sb.url),after:await probes(b,sc.url)};report.status='PASS';}
 catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1}
 finally{await b.close();sb.s.close();sc.s.close();fs.writeFileSync(path.join(OUT,'ui-cohesion-report.json'),JSON.stringify(report,null,2));console.log(report.status,report.error||'');}})();
