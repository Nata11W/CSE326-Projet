/**
 * Run the same unit tests from a terminal:  node tests/run-node.js
 */
global.Slots = require('../js/slots.js');
global.Validate = require('../js/validate.js');
const TEST_CASES = require('./test-cases.js');

let passed = 0;
TEST_CASES.forEach(([name, fn]) => {
  try {
    fn();
    passed++;
    console.log('  ✔ ' + name);
  } catch (err) {
    console.log('  ✘ ' + name + ' — ' + err.message);
  }
});
console.log('\n' + passed + ' / ' + TEST_CASES.length + ' tests passed');
process.exit(passed === TEST_CASES.length ? 0 : 1);
