'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scope = {};
vm.createContext(scope);
vm.runInContext(html.slice(html.indexOf('    function parseCsvLine('), html.indexOf('    function readWorkbookValues(')), scope);
vm.runInContext(`function getFieldLabel(field){return field.id;}` + html.slice(html.indexOf('    function normalizeForValidation('), html.indexOf('    function migrateLegacyValues(')), scope);
test('raw importer rejects absent or structured numbers but accepts real zero and formatted values', () => {
  for (const type of ['number','integer','decimal']) {
    for (const value of [null,undefined,'','  ',[],[12],{},true,false,NaN,Infinity,-1,'NaN']) {
      assert.equal(scope.validateFieldValue({id:'price',type},value).valid,false,`${type}: ${JSON.stringify(value)}`);
    }
    for (const value of [0,'0',123,'1,234']) assert.equal(scope.validateFieldValue({id:'price',type},value).valid,true);
  }
  assert.equal(scope.validateFieldValue({id:'qty',type:'integer'},1.5).valid,false);
  assert.equal(scope.validateFieldValue({id:'rate',type:'decimal'},'4.5').valid,true);
});
test('raw CSV parser retains BOM, CRLF, escaped quotes and commas and rejects malformed rows', () => {
  const actual = scope.parseCsv('\uFEFFid,label,type,value\r\nrate_thb,"Rate, ""THB""",decimal,"4.5"\r\n');
  assert.equal(JSON.stringify(actual), JSON.stringify([{id:'rate_thb',label:'Rate, "THB"',type:'decimal',value:'4.5'}]));
  for(const csv of ['id,id\na,b','id,\na,b','id,value\nx','id,value\nx,1,2','id,value\nx,"12','id,value\nx,1"2','id,value\nx,"12"tail']) assert.throws(()=>scope.parseCsv(csv),csv);
});
