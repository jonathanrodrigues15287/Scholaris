const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBusiness } = require('./test-utils');

test('calculates SGPA as a credit-weighted grade average', () => {
  const { calculateGpa } = loadBusiness();
  const result = calculateGpa([
    { credits: 3, grade: 8 },
    { credits: 2, grade: 6 }
  ]);
  assert.equal(result.gpa, 7.2);
  assert.equal(result.totalCredits, 5);
});

test('calculates cumulative CGPA across semesters by total credits', () => {
  const { calculateCgpa } = loadBusiness();
  const result = calculateCgpa([
    { name: 'Semester 1', subjects: [{ credits: 4, grade: 8 }, { credits: 2, grade: 7 }] },
    { name: 'Semester 2', subjects: [{ credits: 3, grade: 9 }] }
  ]);
  assert.equal(result.gpa, 8.11);
  assert.equal(result.totalCredits, 9);
  assert.deepEqual(result.perSemester.map(item => item.gpa), [7.67, 9]);
});

test('returns zero GPA for no credits', () => {
  const result = loadBusiness().calculateGpa([]);
  assert.equal(result.gpa, 0);
  assert.equal(result.totalCredits, 0);
});
