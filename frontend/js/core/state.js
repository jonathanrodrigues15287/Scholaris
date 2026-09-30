// Shared in-memory application state.
(function () {
  const Scholaris = window.Scholaris = window.Scholaris || { utils: {} };
  const state = {
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
    if (!(key in state)) {
      console.warn(`[ScholarisState] Unknown state key: "${key}"`);
      return value;
    }
    state[key] = value;
    if (options.persist && Scholaris.utils.storage) {
      Scholaris.utils.storage.set(key, value);
    }
    if (options.silent) return value;
    Scholaris.events?.emit('state:changed', { key, value });
    Scholaris.events?.emit(`state:${key}:changed`, value);
    const domainKey = key === 'timetableActiveDays' ? 'timetable' : key;
    const domainEvents = new Set(['assignments', 'attendance', 'timetable', 'courses', 'studySessions', 'academicRecords', 'studyGoal']);
    if (domainEvents.has(domainKey)) {
      Scholaris.events?.emit('data-updated', { type: domainKey, key, value });
      Scholaris.events?.emit(`${domainKey}:changed`, value);
      Scholaris.events?.emit('dashboard:refresh', { source: domainKey, value });
    }
    return value;
  }

  function update(key, updater, options = {}) {
    return set(key, updater(state[key]), options);
  }

  function get(key) {
    return state[key];
  }

  state.set = set;
  state.update = update;
  state.get = get;
  Scholaris.state = state;
  window.ScholarisState = state;
  window.ScholarisStateApi = { get, set, update };
})();
