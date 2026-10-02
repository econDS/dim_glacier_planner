// Reconstruct the pre-task source by undoing only individually reviewed edits.
// This keeps the existing nav-era whole-source invariants meaningful after this feature.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
module.exports = source => {
  if (!source.includes('function bindPriceMetadata()')) return source;
  const edits = JSON.parse(fs.readFileSync(path.join(__dirname,'../qa/price-metadata/permitted-changes.json'),'utf8'));
  for (const edit of [...edits].reverse()) {
    assert.equal(source.split(edit.after).length-1,1,'Expected exactly one reviewed change: '+edit.after.slice(0,90));
    source = source.replace(edit.after,edit.before);
  }
  return source;
};
