'use strict';
// npm install --prefix /tmp/glacier-qa --no-save playwright@1.55.1 xlsx@0.18.5
// NODE_PATH=/tmp/glacier-qa/node_modules QA_CHROMIUM=/usr/bin/chromium node tests/import-export.browser.cjs
// Real SheetJS compatibility parser, not a stub. Set QA_XLSX_SCRIPT to test the production 0.20.3 script.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const ROOT = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const KEY = 'dim-glacier-planner-state-v1';
const script = fs.readFileSync(process.env.QA_XLSX_SCRIPT || require.resolve('xlsx/dist/xlsx.full.min.js'));
const server = http.createServer((req, res) => {
  const filename = path.resolve(ROOT, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/dim_glacier_planner/, '') .replace(/\/$/, '/index.html'));
  if (!filename.startsWith(ROOT + path.sep) || !fs.existsSync(filename)) return res.writeHead(404).end();
  res.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  fs.createReadStream(filename).pipe(res);
});
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({headless:true, ...(process.env.QA_CHROMIUM ? {executablePath:process.env.QA_CHROMIUM} : {})});
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await context.route('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', route => route.fulfill({contentType:'text/javascript',body:script}));
    await context.route('https://econds.github.io/ro_tools_portal/catalog/v1/tools.json', route => route.fulfill({contentType:'application/json',body:fs.readFileSync(path.join(ROOT,'assets/ro-suite/2.0.0/catalog.snapshot.json'))}));
    const page = await context.newPage();
    const alerts = [], errors = [];
    page.on('dialog', async dialog => {alerts.push(dialog.message()); await dialog.dismiss();});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/dim_glacier_planner/`);
    await page.waitForFunction(() => Boolean(window.XLSX));
    const parserVersion = await page.evaluate(() => XLSX.version);
    assert.equal(parserVersion, process.env.QA_XLSX_SCRIPT ? '0.20.3' : '0.18.5');
    await page.locator('#qty_cube').fill('2');
    await page.locator('#qty_device').fill('3');
    await page.locator('#manual_cost').fill('1234567');
    if (!await page.locator('#market-price-details').evaluate(el => el.open)) await page.locator('#market-price-details > summary').click();
    await page.locator('#rate_thb').fill('12.34');
    await page.locator('#rate_thb').dispatchEvent('input');
    await page.waitForTimeout(250);
    const baseline = await page.evaluate(() => buildExportPayload());
    const total = await page.locator('#total_zeny').innerText();
    const state = () => page.evaluate(() => collectStateValues());
    const upload = async (name, buffer) => {
      const count = alerts.length;
      const chooser = page.waitForEvent('filechooser');
      await page.locator('#btn_import').click();
      await (await chooser).setFiles({name,mimeType:'application/octet-stream',buffer});
      await page.waitForFunction(() => document.querySelector('#file_import').value === '');
      return alerts.slice(count);
    };
    const exports = {};
    for (const [format, button] of [['json','json'],['csv','csv'],['xlsx','excel']]) {
      const pending = page.waitForEvent('download');
      await page.locator(`#btn_export_${button}`).click();
      const download = await pending;
      assert(download.suggestedFilename().endsWith('.' + format));
      exports[format] = fs.readFileSync(await download.path());
    }
    assert.deepEqual(JSON.parse(exports.json).values, baseline.values);
    // Produce genuine legacy BIFF8 XLS from the actual exported workbook.
    exports.xls = XLSX.write(XLSX.read(exports.xlsx,{type:'buffer'}),{type:'buffer',bookType:'biff8'});
    assert.equal(exports.xls.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');
    assert.equal(exports.xlsx.subarray(0,2).toString(),'PK');
    for (const [format, buffer] of Object.entries(exports)) {
      await page.locator('#qty_cube').fill('0');
      assert.deepEqual(await upload(`roundtrip.${format}`,buffer),[],`${format}: no validation alerts`);
      assert.deepEqual(await state(),baseline.values,`${format}: all fields round-trip`);
      assert.equal(await page.locator('#total_zeny').innerText(),total,`${format}: calculated total`);
      await page.reload();
      assert.deepEqual(await state(),baseline.values,`${format}: persisted reload`);
      assert.equal(await page.locator('#total_zeny').innerText(),total);
    }
    const rows = baseline.fields;
    const csv = items => Buffer.from(['id,label,type,value', ...items.map(row => [row.id,row.label,row.type,row.value].map(value => '"'+String(value).replaceAll('"','""')+'"').join(','))].join('\r\n'));
    const workbook = (items, type) => {const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(items),'PlannerData');return XLSX.write(wb,{type:'buffer',bookType:type==='xls'?'biff8':'xlsx'});};
    const rejects = [
      ['null-number.json',Buffer.from(JSON.stringify({values:{...baseline.values,rate_thb:null}}))],
      ['blank-number.json',Buffer.from(JSON.stringify({values:{...baseline.values,rate_thb:''}}))],
      ['object-number.json',Buffer.from(JSON.stringify({values:{...baseline.values,rate_thb:{}}}))],
      ['array-number.json',Buffer.from(JSON.stringify({values:{...baseline.values,rate_thb:[]}}))],
      ['duplicate.csv',csv([...rows,{...rows[0],value:99}])],
      ['duplicate.xlsx',workbook([...rows,{...rows[0],value:99}],'xlsx')],
      ['blank.csv',csv(rows.map((r,i)=>i?r:{...r,value:''}))],
      ['null.xlsx',workbook(rows.map((r,i)=>i?r:{...r,value:null}),'xlsx')],
      ['unclosed-quote.csv',Buffer.from(csv(rows).toString().slice(0,-1))],
      ['broken.json',Buffer.from('{')], ['partial.json',Buffer.from(JSON.stringify({values:{qty_cube:8}}))],
      ['unknown.json',Buffer.from(JSON.stringify({values:{...baseline.values,unexpected:1}}))],
      ['negative.json',Buffer.from(JSON.stringify({values:{...baseline.values,p_petal:-1}}))],
      ['fraction.json',Buffer.from(JSON.stringify({values:{...baseline.values,qty_cube:1.5}}))],
      ['not-number.json',Buffer.from(JSON.stringify({values:{...baseline.values,manual_cost:'NaN'}}))],
      ['invalid-select.json',Buffer.from(JSON.stringify({values:{...baseline.values,sel_cur_stage:'999'}}))],
      ['unsupported.txt',exports.json], ['empty.csv',Buffer.from('')],
      ['partial.csv',csv(rows.slice(1))], ['wrong-type.csv',csv(rows.map((r,i)=>i? r:{...r,type:'unknown'}))],
      ['partial.xlsx',workbook(rows.slice(1),'xlsx')], ['partial.xls',workbook(rows.slice(1),'xls')],
      ['invalid.xlsx',workbook(rows.map((r,i)=>i?r:{...r,value:'not a number'}),'xlsx')],
      ['invalid.xls',workbook(rows.map((r,i)=>i?r:{...r,value:'not a number'}),'xls')],
      ['broken.xlsx',Buffer.from([0,1,2,3])], ['broken.xls',Buffer.from([0,1,2,3])]
    ];
    for (const [name, buffer] of rejects) {
      const stored = await page.evaluate(key => localStorage.getItem(key),KEY);
      assert((await upload(name,buffer)).length > 0,`${name}: user sees rejection`);
      assert.deepEqual(await state(),baseline.values,`${name}: atomic rejection`);
      assert.equal(await page.evaluate(key => localStorage.getItem(key),KEY),stored,`${name}: storage untouched`);
    }
    // Empty file selection and reset cancellation must be non-destructive.
    const chooser = page.waitForEvent('filechooser');await page.locator('#btn_import').click();await(await chooser).setFiles([]);
    await page.locator('#btn_reset').click();
    assert.deepEqual(await state(),baseline.values);
    await page.reload();assert.deepEqual(await state(),baseline.values);
    // Version mismatch is warned but a complete compatible template remains importable.
    assert.equal((await upload('future-version.json',Buffer.from(JSON.stringify({...baseline,version:999})))).length,1);
    assert.deepEqual(await state(),baseline.values);
    // Real script failure preserves JSON/CSV and reports spreadsheet unavailability.
    await context.route('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',route=>route.abort());
    await page.reload();
    assert.equal(await page.evaluate(()=>Boolean(window.XLSX)),false);
    assert((await upload('unavailable.xlsx',exports.xlsx)).length>0);
    assert.deepEqual(await state(),baseline.values);
    assert.deepEqual(await upload('offline.csv',exports.csv),[]);
    await page.locator('#btn_export_excel').click();
    assert((await page.locator('#storage_status').innerText()).includes('ไม่พบไลบรารี'));
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: JSON/CSV/XLSX round-trip, genuine BIFF8 XLS import, all fields/totals/persistence, ${rejects.length} malformed/partial/invalid atomic rejections, cancellation/version warning/script failure; parser ${parserVersion}`);
    await context.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));});
