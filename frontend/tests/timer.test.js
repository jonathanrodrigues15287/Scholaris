const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBusiness } = require('./test-utils');

test('formats timer seconds as MM:SS', () => {
  const { formatTimerSeconds } = loadBusiness();
  assert.equal(formatTimerSeconds(0), '00:00');
  assert.equal(formatTimerSeconds(65), '01:05');
  assert.equal(formatTimerSeconds(25 * 60), '25:00');
});
