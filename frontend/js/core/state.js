// Shared in-memory application state.
(function () {
  const ScholarisState = {
    assignments: [],
    attendance: [],
    timetable: [],
    courses: [],
    studySessions: [],
    academicRecords: null,
    authenticated: false,
    timetableActiveDays: [],
    studyGoal: null,
    syncState: null
  };

  function set(key, value, options = {}) {
    if (!(key in ScholarisState)) return value;
    ScholarisState[key] = value;
    if (options.persist && window.ScholarisStorage) {
      window.ScholarisStorage.set(key, value);
    }
    if (options.silent) return value;
    window.ScholarisEvents?.emit('state:changed', { key, value });
    window.ScholarisEvents?.emit(`state:${key}:changed`, value);
    const domainKey = key === 'timetableActiveDays' ? 'timetable' : key;
    const domainEvents = new Set(['assignments', 'attendance', 'timetable', 'courses', 'studySessions', 'academicRecords', 'studyGoal']);
    if (domainEvents.has(domainKey)) {
      window.ScholarisEvents?.emit(`${domainKey}:changed`, value);
      window.ScholarisEvents?.emit('dashboard:refresh', { source: domainKey, value });
    }
    return value;
  }

  function update(key, updater, options = {}) {
    return set(key, updater(ScholarisState[key]), options);
  }

  window.ScholarisState = ScholarisState;
  window.ScholarisStateApi = { set, update };
})();
