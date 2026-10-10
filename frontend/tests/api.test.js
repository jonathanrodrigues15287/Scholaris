const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { loadBusiness } = require('./test-utils');

function loadApi(fetch) {
  const values = new Map();
  let id = 0;
  const window = {
    Scholaris: { utils: { business: loadBusiness() } },
    ScholarisUtils: { createId: prefix => `${prefix}-${++id}` },
    addEventListener() {}
  };
  const context = {
    window,
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key)
    },
    document: { cookie: '', getElementById: () => null },
    navigator: { onLine: true },
    fetch,
    URL,
    URLSearchParams,
    setInterval() {},
    console
  };
  vm.runInNewContext(
    fs.readFileSync('frontend/js/api.js', 'utf8'),
    context,
    { filename: 'frontend/js/api.js' }
  );
  return window.ScholarisApi;
}

function jsonResponse(status, body) {
  return { ok: status < 400, status, json: async () => body };
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


test('assignment conflict resolution supports merge, keep-mine, and use-server', async () => {
  const requests = [];
  let current = {
    id: 42, title: 'Server title', due_date: '2026-11-02', priority: 'high',
    priority_mode: 'manual', status: 'pending', version: 5,
    is_completed: false, is_submitted: false
  };
  let firstUpdate = true;
  const api = loadApi(async (url, options) => {
    const path = new URL(url).pathname.replace('/api/v1', '');
    requests.push({ path, options });
    if (path === '/auth/me') return jsonResponse(401, {});
    if (path === '/auth/login') return jsonResponse(200, { user: { id: 7 } });
    if (path === '/assignments/42' && options.method === 'PATCH') {
      if (firstUpdate) {
        firstUpdate = false;
        return jsonResponse(409, {
          error: { code: 'VERSION_CONFLICT', message: 'Assignment changed elsewhere', details: [] }
        });
      }
      const body = JSON.parse(options.body);
      current = { ...current, ...body, version: current.version + 1 };
      return jsonResponse(200, current);
    }
    if (path === '/assignments/42') return jsonResponse(200, current);
    return jsonResponse(404, {});
  });
  await new Promise(resolve => setImmediate(resolve));
  await api.login('student@example.com', 'password');
  const error = await api.updateAssignment(42, { status: 'completed', version: 4 }).catch(value => value);
  assert.equal(error.code, 'VERSION_CONFLICT');
  const conflict = api.getSyncConflicts()[0];
  assert.ok(conflict);

  const latest = await api.resolveAssignmentConflict(conflict.id, 'merge', null, 5);
  assert.equal(latest.version, 6);
  assert.equal(api.getSyncConflicts().length, 0);
  let patchBodies = requests
    .filter(request => request.path === '/assignments/42' && request.options.method === 'PATCH')
    .map(request => request.options.body && JSON.parse(request.options.body));
  assert.equal(patchBodies[1].version, 5);
  assert.equal(patchBodies[1].status, 'completed');
  assert.equal(patchBodies[1].title, undefined);

  firstUpdate = true;
  await api.updateAssignment(42, { status: 'pending', version: 5 }).catch(() => {});
  const keepMineConflict = api.getSyncConflicts()[0];
  const kept = await api.resolveAssignmentConflict(keepMineConflict.id, 'client-wins', {
    title: 'Local title', due: '2026-11-08', priority: 'low',
    priorityMode: 'auto', done: false, submitted: false, status: 'completed'
  }, 6);
  assert.equal(kept.version, 7);
  patchBodies = requests
    .filter(request => request.path === '/assignments/42' && request.options.method === 'PATCH')
    .map(request => request.options.body && JSON.parse(request.options.body));
  assert.equal(patchBodies[3].version, 6);
  assert.equal(patchBodies[3].title, 'Local title');
  assert.equal(patchBodies[3].status, 'pending');
  assert.equal(patchBodies[3].due_date, '2026-11-08');

  firstUpdate = true;
  await api.updateAssignment(42, { status: 'completed', version: 6 }).catch(() => {});
  const useServerConflict = api.getSyncConflicts()[0];
  const serverVersion = await api.resolveAssignmentConflict(useServerConflict.id, 'server-wins', null, 7);
  assert.equal(serverVersion.version, 7);
  assert.equal(api.getSyncConflicts().length, 0);
  assert.equal(requests.filter(request => request.path === '/assignments/42' && request.options.method === 'PATCH').length, 5);
});
