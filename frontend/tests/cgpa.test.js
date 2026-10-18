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
    { name: 'Semester 1', semesterNumber: 1, subjects: [{ name: 'Maths', credits: 4, grade: 8 }, { name: 'Physics', credits: 2, grade: 7 }] },
    { name: 'Semester 2', semesterNumber: 2, subjects: [{ name: 'Chemistry', credits: 3, grade: 9 }] }
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

test('calculates a semester independently of the DOM', () => {
  const result = loadBusiness().calculateSemester([
    { credits: '3', grade: '8' },
    { credits: '2', grade: '6' }
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.sgpa, 7.2);
  assert.equal(result.credits, 5);
});

test('rejects incomplete or invalid semester subjects', () => {
  const { calculateSemester } = loadBusiness();
  assert.equal(calculateSemester([{ credits: '', grade: '8' }]).valid, false);
  assert.equal(calculateSemester([{ credits: '3', grade: '' }]).valid, false);
  assert.equal(calculateSemester([{ credits: '0', grade: '8' }]).valid, false);
  assert.equal(calculateSemester([{ credits: '3', grade: '11' }]).valid, false);
});

test('calculates weighted CGPA and reports semester results', () => {
  const result = loadBusiness().calculateCGPA([
    { name: 'Semester 1', semesterNumber: 1, subjects: [{ name: 'Maths', credits: '4', grade: '8' }, { name: 'Physics', credits: '2', grade: '7' }] },
    { name: 'Semester 2', semesterNumber: 2, subjects: [{ name: 'Chemistry', credits: '3', grade: '9' }] }
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.cgpa, 8.11111111111111);
  assert.equal(result.credits, 9);
  assert.deepEqual(result.perSemester.map(item => item.sgpa), [7.666666666666667, 9]);
});

test('marks cumulative CGPA invalid when any semester is incomplete', () => {
  const result = loadBusiness().calculateCGPA([
    { name: 'Semester 1', semesterNumber: 1, subjects: [{ name: 'Maths', credits: '4', grade: '8' }] },
    { name: 'Semester 2', semesterNumber: 2, subjects: [{ name: 'Physics', credits: '', grade: '' }] }
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.cgpa, 0);
});

test('validates grade and credit boundaries', () => {
  const { validateCredits, validateGrade } = loadBusiness();
  assert.equal(validateGrade(0), true);
  assert.equal(validateGrade(10), true);
  assert.equal(validateGrade(-1), false);
  assert.equal(validateGrade(10.1), false);
  assert.equal(validateCredits(0.5), true);
  assert.equal(validateCredits(30), true);
  assert.equal(validateCredits(0), false);
  assert.equal(validateCredits(30.1), false);
});

test('detects invalid academic names, semester numbers, and duplicates', () => {
  const result = loadBusiness().validateAcademicRecords([
    { semesterNumber: 1, subjects: [{ name: 'Maths', code: 'MTH' }] },
    { semesterNumber: 1, subjects: [{ name: '', code: 'mth' }] }
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.errors.some(error => error.message === 'Semester numbers must be unique.'), true);
  assert.equal(result.errors.some(error => error.message === 'Subject name is required.'), true);
  assert.equal(result.errors.some(error => error.message === 'Subject codes must be unique.'), true);
});