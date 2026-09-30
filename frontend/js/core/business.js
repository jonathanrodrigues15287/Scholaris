// Pure business rules shared by feature modules and tests.
(function () {
  const Scholaris = window.Scholaris = window.Scholaris || { utils: {} };

  function validateGrade(grade) {
    const value = Number(grade);
    return grade !== '' && Number.isFinite(value) && value >= 0 && value <= 10;
  }

  function validateCredits(credits) {
    const value = Number(credits);
    return credits !== '' && Number.isFinite(value) && value > 0 && value <= 30;
  }

  function validateSubjectName(name) {
    return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 120;
  }

  function validateSemesterNumber(number) {
    const value = Number(number);
    return Number.isInteger(value) && value >= 1 && value <= 20;
  }

  function validateAcademicRecords(semesters) {
    const errors = [];
    const semesterNumbers = new Set();
    const subjectCodes = new Set();

    semesters.forEach((semester, semesterIndex) => {
      if (!validateSemesterNumber(semester.semesterNumber)) {
        errors.push({ field: `semesters[${semesterIndex}].semesterNumber`, message: 'Semester number must be an integer from 1 to 20.' });
      } else if (semesterNumbers.has(Number(semester.semesterNumber))) {
        errors.push({ field: `semesters[${semesterIndex}].semesterNumber`, message: 'Semester numbers must be unique.' });
      } else {
        semesterNumbers.add(Number(semester.semesterNumber));
      }

      (semester.subjects || []).forEach((subject, subjectIndex) => {
        const prefix = `semesters[${semesterIndex}].subjects[${subjectIndex}]`;
        if (!validateSubjectName(subject.name)) errors.push({ field: `${prefix}.name`, message: 'Subject name is required.' });
        if (subject.code !== undefined && subject.code !== null) {
          const code = String(subject.code).trim().toUpperCase();
          if (!code) errors.push({ field: `${prefix}.code`, message: 'Subject code cannot be empty.' });
          else if (subjectCodes.has(code)) errors.push({ field: `${prefix}.code`, message: 'Subject codes must be unique.' });
          else subjectCodes.add(code);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  }

  function calculateSemester(subjects) {
    let weighted = 0;
    let credits = 0;

    for (const subject of subjects) {
      if (!validateCredits(subject.credits) || !validateGrade(subject.grade)) {
        return { valid: false, sgpa: 0, credits: 0 };
      }
      const credit = Number(subject.credits);
      const grade = Number(subject.grade);
      weighted += credit * grade;
      credits += credit;
    }

    return {
      valid: credits > 0,
      sgpa: credits > 0 ? weighted / credits : 0,
      credits
    };
  }

  function calculateCGPA(semesters) {
    let weighted = 0;
    let credits = 0;
    const recordValidation = validateAcademicRecords(semesters);
    let valid = semesters.length > 0 && recordValidation.valid;
    const perSemester = semesters.map(semester => {
      const result = calculateSemester(semester.subjects || semester.entries || []);
      if (!result.valid) valid = false;
      weighted += result.sgpa * result.credits;
      credits += result.credits;
      return {
        semester: semester.name || semester.semester || '',
        ...result,
        gpa: Number(result.sgpa.toFixed(2)),
        totalCredits: result.credits
      };
    });
    const cgpa = valid && credits > 0 ? weighted / credits : 0;
    return {
      valid: valid && credits > 0,
      cgpa,
      gpa: Number(cgpa.toFixed(2)),
      credits,
      totalCredits: credits,
      perSemester,
      errors: recordValidation.errors
    };
  }

  function calculateCgpa(semesters) {
    return calculateCGPA(semesters);
  }

  function calculateGpa(entries) {
    const weightedPoints = entries.reduce((total, entry) => total + Number(entry.grade || 0) * Number(entry.credits || 0), 0);
    const totalCredits = entries.reduce((total, entry) => total + Number(entry.credits || 0), 0);
    return { gpa: totalCredits ? Number((weightedPoints / totalCredits).toFixed(2)) : 0, totalCredits };
  }

  function attendancePercentage(present, total) {
    return total ? Number(((present / total) * 100).toFixed(2)) : 0;
  }

  function predictAttendance(present, absent, threshold = 75) {
    const total = present + absent;
    const percentage = attendancePercentage(present, total);
    const margin = percentage - threshold;
    const warning = percentage < threshold || (threshold > 0 && margin <= 5);
    const warningLevel = percentage < threshold ? 'below' : warning ? 'approaching' : 'safe';
    if (percentage < threshold) {
      const attendNext = threshold >= 100
        ? null
        : Math.max(1, Math.ceil((threshold * total - present * 100) / (100 - threshold)));
      return { percentage, warning, warningLevel, attendNext, safeAbsences: null };
    }
    const maximumMisses = threshold > 0 ? Math.floor((present * 100 / threshold - total) + 1e-9) : null;
    return { percentage, warning, warningLevel, attendNext: null, safeAbsences: maximumMisses == null ? null : Math.max(0, maximumMisses) };
  }

  function dateToIso(dateString) {
    if (!dateString) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    const match = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!match) return '';
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  function daysUntil(isoDate, today = new Date()) {
    const due = new Date(`${isoDate}T00:00:00`);
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    return Math.round((due - start) / 86400000);
  }

  function assignmentPriority(isoDate, pendingCount, today = new Date()) {
    if (!isoDate) return pendingCount >= 5 ? 'medium' : 'low';
    const days = daysUntil(isoDate, today);
    if (days <= 3) return 'high';
    if (days <= 7) return pendingCount >= 5 ? 'high' : 'medium';
    if (days <= 14) return 'medium';
    return 'low';
  }

  function formatTimerSeconds(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  }

  function apiError(response, payload = null) {
    const detail = payload?.error?.message || payload?.detail || `Request failed (${response.status})`;
    const error = new Error(detail);
    error.status = response.status;
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.details = payload?.error?.details || [];
    return error;
  }

  Scholaris.utils.business = {
    apiError,
    assignmentPriority,
    attendancePercentage,
    calculateCGPA,
    calculateSemester,
    calculateCgpa,
    calculateGpa,
    validateAcademicRecords,
    validateCredits,
    validateGrade,
    validateSemesterNumber,
    validateSubjectName,
    dateToIso,
    daysUntil,
    formatTimerSeconds,
    predictAttendance
  };
})();
