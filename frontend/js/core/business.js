// Pure business rules shared by feature modules and tests.
(function () {
  const Scholaris = window.Scholaris = window.Scholaris || { utils: {} };

  function calculateGpa(entries) {
    const totalCredits = entries.reduce((total, entry) => total + Number(entry.credits || 0), 0);
    const weightedPoints = entries.reduce((total, entry) => total + Number(entry.grade || 0) * Number(entry.credits || 0), 0);
    return { gpa: totalCredits ? Number((weightedPoints / totalCredits).toFixed(2)) : 0, totalCredits };
  }

  function calculateCgpa(semesters) {
    const perSemester = semesters.map(semester => ({
      semester: semester.name || semester.semester || '',
      ...calculateGpa(semester.subjects || semester.entries || [])
    }));
    const allEntries = semesters.flatMap(semester => semester.subjects || semester.entries || []);
    return { ...calculateGpa(allEntries), perSemester };
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
    calculateCgpa,
    calculateGpa,
    dateToIso,
    daysUntil,
    formatTimerSeconds,
    predictAttendance
  };
})();
