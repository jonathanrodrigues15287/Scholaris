const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { loadBusiness } = require('./test-utils');

function loadApiClient(fetchImpl) {
  const values = new Map();
  let id = 0;
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const window = {
    Scholaris: { utils: {} },
    ScholarisUtils: { createId: prefix => `${prefix}-${++id}` },
    addEventListener() {}
  };
  const context = {
    window,
    localStorage,
    document: { cookie: 'csrf_token=test-csrf', getElementById: () => null },
    navigator: { onLine: true },
    URLSearchParams,
    fetch: fetchImpl,
    setInterval: () => 0,
    clearInterval() {},
    console
  };
  for (const file of ['frontend/js/core/business.js', 'frontend/js/api.js']) {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return { api: window.Scholaris.api, localStorage };
}

function jsonResponse(status, payload) {
  return { ok: status < 400, status, json: async () => payload };
}

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

test('builds explicit mutation envelopes for queued synchronization', () => {
  const { createMutationEnvelope } = loadBusiness();
  const operation = createMutationEnvelope({
    operationId: 'op-123',
    path: '/assignments',
    method: 'POST',
    payload: { title: 'Lab report', course_id: 42 },
    createdAt: '2026-10-02T08:00:00.000Z'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(operation)), {
    operation_id: 'op-123',
    entity: 'assignment',
    entity_id: null,
    operation: 'create',
    payload: { title: 'Lab report', course_id: 42 },
    created_at: '2026-10-02T08:00:00.000Z',
    retry_count: 0
  });
});

test('builds entity identifiers and operation names for updates', () => {
  const operation = loadBusiness().createMutationEnvelope({
    operationId: 'op-456',
    path: '/assignments/42',
    method: 'PATCH',
    payload: { status: 'completed' },
    createdAt: '2026-10-02T08:00:00.000Z'
  });

  assert.equal(operation.entity, 'assignment');
  assert.equal(operation.entity_id, 42);
  assert.equal(operation.operation, 'update');
  assert.deepEqual(JSON.parse(JSON.stringify(operation.payload)), { status: 'completed' });
});

test('reuses the first request idempotency key when a queued create is retried', async () => {
  const requests = [];
  let failAssignmentResponse = true;
  const { api, localStorage } = loadApiClient(async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/auth/me')) return jsonResponse(401, { detail: 'No session' });
    if (url.endsWith('/auth/login')) return jsonResponse(200, { user: { id: 17 } });
    if (url.endsWith('/courses?page_size=100')) {
      return jsonResponse(200, { items: [{ id: 42, name: 'Biology' }] });
    }
    if (url.endsWith('/assignments') && failAssignmentResponse) {
      failAssignmentResponse = false;
      throw new TypeError('connection dropped after request');
    }
    if (url.endsWith('/assignments')) return jsonResponse(201, { id: 81, title: 'Lab report' });
    throw new Error(`Unexpected request ${url}`);
  });

  await new Promise(resolve => setTimeout(resolve, 0));
  await api.login('student@example.com', 'not-used-in-this-test');
  await assert.rejects(api.createAssignment({ title: 'Lab report' }), /queued for synchronization/);

  const queue = JSON.parse(localStorage.getItem('scholaris_sync_queue'));
  assert.equal(queue.length, 1);
  const [queued] = queue;
  assert.equal(queued.entity, 'assignment');
  assert.equal(queued.entity_id, null);
  assert.equal(queued.operation, 'create');
  assert.equal(queued.payload.title, 'Lab report');
  assert.equal(queued.retry_count, 0);
  assert.equal(queued.headers['X-Idempotency-Key'], queued.operation_id);

  await api.flushSyncQueue();

  const assignmentRequests = requests.filter(request => request.url.endsWith('/assignments'));
  assert.equal(assignmentRequests.length, 2);
  assert.equal(
    assignmentRequests[0].options.headers['X-Idempotency-Key'],
    assignmentRequests[1].options.headers['X-Idempotency-Key']
  );
});

test('sends assignment versions as If-Match headers and keeps them queued', async () => {
  const requests = [];
  const { api } = loadApiClient(async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/auth/me')) return jsonResponse(401, { detail: 'No session' });
    if (url.endsWith('/auth/login')) return jsonResponse(200, { user: { id: 17 } });
    if (url.endsWith('/assignments/42')) return jsonResponse(200, {
      id: 42, title: 'Updated', version: 2, updated_at: '2026-10-06T00:00:00Z'
    });
    throw new Error(`Unexpected request ${url}`);
  });

  await new Promise(resolve => setTimeout(resolve, 0));
  await api.login('student@example.com', 'not-used-in-this-test');
  await api.updateAssignment(42, { title: 'Updated', version: 1 });

  const assignmentRequest = requests.find(request => request.url.endsWith('/assignments/42'));
  assert.equal(assignmentRequest.options.headers['If-Match'], '1');
  assert.deepEqual(JSON.parse(assignmentRequest.options.body), { title: 'Updated' });
});
