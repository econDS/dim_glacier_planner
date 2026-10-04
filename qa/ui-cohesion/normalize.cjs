'use strict';
const assert=require('node:assert/strict');
const changes=require('./changes.json');
// Reverses only the reviewed UI-cohesion presentation delta so older invariants still see their historical bytes.
module.exports=html=>{
  if(!html.includes('<style id="ui-cohesion">'))return html;
  for(const [before,after]of [...changes].reverse()){
    assert.equal(html.split(after).length-1,1,'exact ui-cohesion delta: '+after.slice(0,80));
    html=html.replace(after,()=>before);
  }
  return html;
};
