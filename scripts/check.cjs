const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
global.window = global;
global.document = { getElementById: () => ({ textContent: '' }) };
for (const name of ['war-data.js', 'war-engine.js', 'war-tests.js'])
  vm.runInThisContext(fs.readFileSync(name, 'utf8'), { filename: name });
assert.equal(global.testError, undefined);
assert.equal(global.testResults.length, 74);
for (const name of fs.readdirSync('.').filter((x) => x.endsWith('.js')))
  new vm.Script(fs.readFileSync(name, 'utf8'), { filename: name });
console.log('74 battle regressions passed; all application JavaScript parses.');
