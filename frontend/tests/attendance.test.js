const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBusiness } = require('./test-utils');

test('calculates attendance percentage with a zero-total guard', () => {
  const { attendancePercentage } = loadBusiness();
  assert.equal(attendancePercentage(15, 20), 75);
  assert.equal(attendancePercentage(0, 0), 0);
});

test('predicts lectures needed when attendance is below threshold', () => {
  const result = loadBusiness().predictAttendance(6, 4, 75);
  assert.equal(result.percentage, 60);
  assert.equal(result.warningLevel, 'below');
  assert.equal(result.attendNext, 6);
  assert.equal(result.safeAbsences, null);
});

test('predicts safe absences when attendance is above threshold', () => {
  const result = loadBusiness().predictAttendance(18, 2, 75);
  assert.equal(result.percentage, 90);
  assert.equal(result.warningLevel, 'safe');
  assert.equal(result.safeAbsences, 4);
});

test('requires consecutive attended lectures to reach the threshold', () => {
  const result = loadBusiness().predictAttendance(18, 7, 75);
  assert.equal(result.percentage, 72);
  assert.equal(result.attendNext, 3);
  assert.equal(result.safeAbsences, null);
});

test('counts absences that can be taken while remaining at the threshold', () => {
  const result = loadBusiness().predictAttendance(21, 4, 75);
  assert.equal(result.percentage, 84);
  assert.equal(result.safeAbsences, 3);
  assert.equal(result.attendNext, null);
});
