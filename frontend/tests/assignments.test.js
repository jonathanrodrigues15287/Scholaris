const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBusiness } = require('./test-utils');

const today = new Date('2026-09-23T12:00:00');

test('normalizes supported assignment date formats', () => {
  const { dateToIso } = loadBusiness();
  assert.equal(dateToIso('23-09-2026'), '2026-09-23');
  assert.equal(dateToIso('2026-09-23'), '2026-09-23');
  assert.equal(dateToIso(''), '');
});

test('calculates due-date distance deterministically', () => {
  assert.equal(loadBusiness().daysUntil('2026-09-26', today), 3);
  assert.equal(loadBusiness().daysUntil('2026-09-22', today), -1);
});

test('assigns automatic priority from due date and workload', () => {
  const { assignmentPriority } = loadBusiness();
  assert.equal(assignmentPriority('2026-09-22', 0, today), 'high');
  assert.equal(assignmentPriority('2026-09-28', 1, today), 'medium');
  assert.equal(assignmentPriority('2026-09-28', 5, today), 'high');
  assert.equal(assignmentPriority('2026-10-10', 0, today), 'low');
});
