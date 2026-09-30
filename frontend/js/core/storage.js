// Compatibility storage adapter and initial state hydration.
(function () {
  const Scholaris = window.Scholaris = window.Scholaris || { utils: {} };
  const keys = {
    assignments: 'scholaris_assignments',
    attendance: 'scholaris_attendance',
    timetable: 'scholaris_timetable_v1',
    courses: 'scholaris_courses',
    studySessions: 'scholaris_study_sessions',
    academicRecords: 'scholaris_cgpa_semesters',
    studyGoal: 'scholaris_study_goal'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(keys[key] || key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function set(key, value) {
    const storageKey = keys[key] || key;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      Scholaris.events?.emit('storage:error', { key, error });
    }
  }

  function remove(key) {
    try { localStorage.removeItem(keys[key] || key); } catch (error) {}
  }

  Scholaris.utils = Scholaris.utils || {};
  Scholaris.utils.storage = { keys, read, set, remove };

  const state = Scholaris.state;
  const stateApi = Scholaris.state;
  if (!state || !stateApi) return;
  stateApi.set('assignments', read('assignments', []));
  stateApi.set('attendance', read('attendance', []));
  const timetable = read('timetable', { schedule: [], activeDays: [] });
  stateApi.set('timetable', Array.isArray(timetable) ? timetable : timetable.schedule || []);
  stateApi.set('timetableActiveDays', Array.isArray(timetable) ? [] : timetable.activeDays || []);
  stateApi.set('courses', read('courses', []));
  stateApi.set('studySessions', read('studySessions', []));
  stateApi.set('academicRecords', read('academicRecords', null));
  stateApi.set('studyGoal', read('studyGoal', null));
})();
