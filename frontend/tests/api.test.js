const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBusiness } = require('./test-utils');

test('normalizes structured API errors', () => {
  const error = loadBusiness().apiError(
    { status: 422 },
    { error: { code: 'VALIDATION_ERROR', message: 'Invalid assignment', details: [{ field: 'title' }] } }
  );
  assert.equal(error.message, 'Invalid assignment');
  assert.equal(error.status, 422);
  assert.equal(error.code, 'VALIDATION_ERROR');
  assert.deepEqual(error.details, [{ field: 'title' }]);
});

test('falls back to HTTP status when an API response has no payload', () => {
  const error = loadBusiness().apiError({ status: 503 });
  assert.equal(error.message, 'Request failed (503)');
  assert.equal(error.code, 'HTTP_503');
  assert.equal(error.details.length, 0);
});
