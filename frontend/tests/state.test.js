const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadState() {
  const context = { window: { Scholaris: { utils: {} } }, console };
  vm.runInNewContext(
    fs.readFileSync('frontend/js/core/state.js', 'utf8'),
    context,
    { filename: 'frontend/js/core/state.js' }
  );
  return context.window;
}

test('publishes explicit state and state API facades', () => {
  const window = loadState();
  assert.equal(window.ScholarisState, window.Scholaris.state);
  assert.equal(typeof window.ScholarisStateApi.get, 'function');
  assert.equal(typeof window.ScholarisStateApi.set, 'function');
  assert.equal(typeof window.ScholarisStateApi.update, 'function');
});

test('state API owns in-memory updates', () => {
  const window = loadState();
  window.ScholarisStateApi.set('assignments', [{ title: 'Read chapter 1' }]);
  window.ScholarisStateApi.update('assignments', assignments => [...assignments, { title: 'Review notes' }]);
  assert.deepEqual(window.ScholarisStateApi.get('assignments').map(item => item.title), ['Read chapter 1', 'Review notes']);
});
