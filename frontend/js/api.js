// api.js - API client with offline cache and operation-queue synchronization
(function () {
  const Scholaris = window.Scholaris = window.Scholaris || { utils: {} };
  const { createId } = window.ScholarisUtils;
  const ScholarisStateApi = window.ScholarisStateApi;
  const API_BASE = localStorage.getItem('scholaris_api_base') || 'http://localhost:8000/api/v1';
  const USER_KEY = 'scholaris_api_user';
  const QUEUE_KEY = 'scholaris_sync_queue';
  const SYNC_STATE_KEY = 'scholaris_sync_state';
  const MAX_RETRIES = 5;
  let authenticated = false;
  let currentUserId = null;
  let syncing = false;

  function token() {
    return '';
  }

  function isAuthenticated() {
    return authenticated;
  }

  function cookie(name) {
    const value = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
    return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (_) { return []; }
  }

  function writeQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    Scholaris.events?.emit('sync-state-changed', getSyncState());
  }

  function getSyncState() {
    const queue = readQueue().filter(operation => !currentUserId || operation.userId === currentUserId);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}'); } catch (_) {}
    return {
      pending: queue.filter(operation => operation.state === 'pending').length,
      failed: queue.filter(operation => operation.state === 'conflict').length,
      lastSyncAt: saved.lastSyncAt || null,
      status: syncing ? 'syncing' : queue.some(operation => operation.state === 'conflict') ? 'conflict' : queue.length ? 'pending' : 'synced'
    };
  }

  function setLastSync() {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({ lastSyncAt: new Date().toISOString() }));
  }

  function isMutating(options) {
    return options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase());
  }

  function isNetworkFailure(error) {
    return error instanceof TypeError || error.status === undefined;
  }

  function enqueueOperation(path, options) {
    const queue = readQueue();
    const operation = {
      id: createId('op'),
      userId: currentUserId,
      path,
      method: (options.method || 'GET').toUpperCase(),
      body: typeof options.body === 'string' ? options.body : null,
      headers: { ...(options.headers || {}) },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 0,
      state: 'pending'
    };
    queue.push(operation);
    writeQueue(queue);
    return operation;
  }

  async function request(path, options = {}) {
    const { skipQueue, ...fetchOptions } = options;
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
      const csrf = cookie('csrf_token');
      if (csrf) headers['X-CSRF-Token'] = csrf;
      else delete headers['X-CSRF-Token'];
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers, credentials: 'include' });
    } catch (error) {
      if (authenticated && isMutating(options) && !skipQueue && isNetworkFailure(error)) {
        const operation = enqueueOperation(path, { ...options, headers });
        const queuedError = new Error(`Saved offline and queued for synchronization (${operation.id}).`);
        queuedError.queued = true;
        throw queuedError;
      }
      throw error;
    }
    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        // Keep the HTTP status when the server did not return JSON.
      }
      throw Scholaris.utils.business.apiError(response, payload);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function flushSyncQueue() {
    if (!authenticated || syncing || !navigator.onLine) return;
    const queue = readQueue().filter(operation => operation.state === 'pending' && operation.userId === currentUserId);
    if (!queue.length) return;
    syncing = true;
    Scholaris.events?.emit('sync-started', { pending: queue.length });
    Scholaris.events?.emit('sync-state-changed', getSyncState());
    let syncError = null;
    try {
      for (const operation of queue) {
        const current = readQueue().find(item => item.id === operation.id && item.userId === currentUserId);
        if (!current || current.state !== 'pending') continue;
        current.attempts += 1;
        current.updatedAt = new Date().toISOString();
        writeQueue(readQueue().map(item => item.id === current.id ? current : item));
        try {
          const opHeaders = { ...current.headers };
          delete opHeaders['X-CSRF-Token'];
          await request(current.path, {
            method: current.method,
            headers: opHeaders,
            body: current.body,
            skipQueue: true
          });
          writeQueue(readQueue().filter(item => item.id !== current.id));
        } catch (error) {
          if (isNetworkFailure(error) && current.attempts < MAX_RETRIES) continue;
          const latest = readQueue().map(item => item.id === current.id
            ? { ...item, state: 'conflict', updatedAt: new Date().toISOString(), error: error.message }
            : item);
          writeQueue(latest);
          syncError = error;
        }
      }
      setLastSync();
      if (syncError) {
        Scholaris.events?.emit('sync-failed', { error: syncError, state: getSyncState() });
      } else {
        Scholaris.events?.emit('sync-completed', { state: getSyncState() });
      }
    } finally {
      syncing = false;
      Scholaris.events?.emit('sync-state-changed', getSyncState());
    }
  }

  function resolveSyncConflict(operationId, strategy = 'server-wins') {
    const queue = readQueue();
    const operation = queue.find(item => item.id === operationId && item.userId === currentUserId);
    if (!operation) return false;
    if (strategy === 'client-wins') {
      operation.state = 'pending';
      operation.attempts = 0;
      operation.updatedAt = new Date().toISOString();
      try {
        const body = JSON.parse(operation.body || '{}');
        delete body.expected_updated_at;
        operation.body = JSON.stringify(body);
      } catch (_) {}
    } else {
      queue.splice(queue.indexOf(operation), 1);
    }
    writeQueue(queue);
    if (strategy === 'client-wins') flushSyncQueue();
    return true;
  }

  function saveSession(data) {
    authenticated = true;
    currentUserId = data.user?.id || null;
    ScholarisStateApi?.set('authenticated', true);
    if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    Scholaris.events?.emit('auth-changed');
  }

  function clearSession() {
    authenticated = false;
    currentUserId = null;
    ScholarisStateApi?.set('authenticated', false);
    localStorage.removeItem('scholaris_api_token');
    localStorage.removeItem(USER_KEY);
    Scholaris.events?.emit('auth-changed');
  }

  async function login(email, password) {
    const body = new URLSearchParams({ username: email, password });
    const data = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    saveSession(data);
    return data;
  }

  async function register(username, password) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, name: username, password })
    });
    await login(username, password);
    return data;
  }

  async function checkSession() {
    try {
      const user = await request('/auth/me');
      saveSession({ user });
    } catch (_) {
      clearSession();
    }
  }

  async function getAssignments() {
    const page = await request('/assignments');
    return page.items;
  }

  async function getCourses() {
    const page = await request('/courses?page_size=100');
    ScholarisStateApi?.set('courses', page.items);
    return page.items;
  }

  async function getAcademicRecords() {
    return request('/cgpa/records');
  }

  async function getStudySessions() {
    const page = await request('/study/sessions?page_size=100');
    return page.items;
  }

  async function createStudySession(session) {
    return request('/study/sessions', { method: 'POST', body: JSON.stringify(session) });
  }

  async function getStudyStats() {
    return request('/study/stats');
  }

  async function getStudySuggestions() {
    return request('/study/suggestions');
  }

  async function getAttendance() {
    const page = await request('/attendance?page_size=100');
    return page.items;
  }

  async function getAttendancePredictions(courseId = null) {
    const query = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
    return request(`/attendance/stats/predictions${query}`);
  }

  async function getAttendanceSubjectStats() {
    const page = await request('/attendance/stats/subjects?page_size=100');
    return page.items;
  }

  async function createAttendance(record) {
    return request('/attendance', { method: 'POST', body: JSON.stringify(record) });
  }

  async function updateAttendance(id, changes) {
    return request(`/attendance/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  }

  async function deleteAttendance(id) {
    return request(`/attendance/${id}`, { method: 'DELETE' });
  }

  async function getDashboard() {
    return request('/dashboard');
  }

  async function getStudyGoal() {
    return request('/study/goal');
  }

  async function updateStudyGoal(minutes) {
    return request('/study/goal', { method: 'PATCH', body: JSON.stringify({ weekly_study_goal_minutes: minutes }) });
  }

  async function createAcademicSemester(semester) {
    return request('/cgpa/semesters', { method: 'POST', body: JSON.stringify(semester) });
  }

  async function createAcademicCourse(semesterId, course) {
    return request(`/cgpa/semesters/${semesterId}/courses`, { method: 'POST', body: JSON.stringify(course) });
  }

  async function updateAcademicCourse(courseId, changes) {
    return request(`/cgpa/courses/${courseId}`, { method: 'PATCH', body: JSON.stringify(changes) });
  }

  async function calculateTargetCgpa(data) {
    return request('/cgpa/target', { method: 'POST', body: JSON.stringify(data) });
  }

  async function getTimetable() {
    const page = await request('/timetable?page_size=100');
    return page.items;
  }

  async function getOrCreateCourse(name) {
    const courses = await getCourses();
    const existing = courses.find(course => course.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing;
    const code = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) || 'CLASS';
    return request('/courses', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), code, credits: 0 })
    });
  }

  async function createTimetableEntry(entry) {
    return request('/timetable', { method: 'POST', body: JSON.stringify(entry) });
  }

  async function updateTimetableEntry(id, changes) {
    return request(`/timetable/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  }

  async function deleteTimetableEntry(id) {
    return request(`/timetable/${id}`, { method: 'DELETE' });
  }

  async function getTimetableGaps(params = '') {
    return request(`/timetable/gaps${params}`);
  }

  async function duplicateTimetableWeek(targetSemesterId = null) {
    return request('/timetable/duplicate-week', {
      method: 'POST',
      body: JSON.stringify({ target_semester_id: targetSemesterId })
    });
  }

  async function getOrCreateDefaultCourse() {
    const courses = await getCourses();
    if (courses && courses.length) return courses[0];
    return request('/courses', {
      method: 'POST',
      body: JSON.stringify({ name: 'General', code: 'GEN', credits: 0 })
    });
  }

  async function createAssignment(task) {
    const course = await getOrCreateDefaultCourse();
    return request('/assignments', {
      method: 'POST',
      body: JSON.stringify({
        title: task.title,
        due_date: task.due || null,
        priority: task.priority || 'medium',
        priority_mode: task.priorityMode || 'manual',
        course_id: course.id
      })
    });
  }

  async function updateAssignment(id, changes) {
    return request(`/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes)
    });
  }

  async function deleteAssignment(id) {
    return request(`/assignments/${id}`, { method: 'DELETE' });
  }

  Scholaris.api = {
    API_BASE,
    checkSession,
    clearSession,
    createAssignment,
    createAcademicCourse,
    createAcademicSemester,
    createStudySession,
    calculateTargetCgpa,
    createTimetableEntry,
    deleteAssignment,
    deleteTimetableEntry,
    duplicateTimetableWeek,
    getCourses,
    getAssignments,
    getAcademicRecords,
    getAttendance,
    getAttendancePredictions,
    getAttendanceSubjectStats,
    getDashboard,
    getStudyGoal,
    getStudySessions,
    getStudyStats,
    getStudySuggestions,
    getOrCreateCourse,
    getTimetable,
    getTimetableGaps,
    isAuthenticated,
    getSyncState,
    flushSyncQueue,
    resolveSyncConflict,
    login,
    register,
    token,
    updateAssignment,
    updateAcademicCourse,
    updateAttendance,
    updateStudyGoal,
    deleteAttendance,
    updateTimetableEntry
  };
  window.ScholarisApi = Scholaris.api;

  function setAuthStatus(message, authenticated) {
    const status = document.getElementById('api-auth-status');
    const username = document.getElementById('api-auth-username');
    const password = document.getElementById('api-auth-password');
    const loginButton = document.getElementById('api-login-btn');
    const registerButton = document.getElementById('api-register-btn');
    const logoutButton = document.getElementById('api-logout-btn');
    if (!status) return;
    const sync = getSyncState();
    const syncLabel = sync.status === 'syncing' ? ' · Syncing…' : sync.pending ? ` · ${sync.pending} pending` : sync.failed ? ' · Conflict needs review' : '';
    status.textContent = `${message}${syncLabel}`;
    username.hidden = authenticated;
    password.hidden = authenticated;
    loginButton.hidden = authenticated;
    registerButton.hidden = authenticated;
    logoutButton.hidden = !authenticated;
  }

  function setSyncStatus() {
    const status = document.getElementById('sync-status');
    if (!status) return;
    const sync = getSyncState();
    let state = 'synced';
    let message = 'Synced';
    if (!isAuthenticated() && sync.status === 'synced') {
      state = 'local';
      message = 'Saved locally';
    } else if (!navigator.onLine) {
      state = 'offline';
      message = sync.pending ? 'Offline - Changes saved locally' : 'Offline mode';
    } else if (sync.status === 'syncing') {
      state = 'syncing';
      message = 'Syncing...';
    } else if (sync.status === 'conflict') {
      state = 'conflict';
      message = 'Sync conflict - Needs attention';
    } else if (sync.pending) {
      state = 'local';
      message = 'Saved locally - Waiting for connection';
    }
    status.className = `sync-status sync-status-${state}`;
    status.textContent = message;
  }

  async function handleAuth(action) {
    const username = document.getElementById('api-auth-username').value.trim();
    const password = document.getElementById('api-auth-password').value;
    if (!username || password.length < 12) {
      Scholaris.utils.toast?.('Enter a username and a password of at least 12 characters with upper/lowercase, a number, and a symbol.', 'error');
      return;
    }
    setAuthStatus('Connecting...', false);
    try {
      if (action === 'register') await register(username, password);
      else await login(username, password);
      setAuthStatus(`Connected as ${username}`, true);
      Scholaris.utils.toast?.('Backend account connected.');
    } catch (error) {
      setAuthStatus('Offline mode', false);
      Scholaris.utils.toast?.(error.message, 'error');
    }
  }

  document.getElementById('api-login-btn')?.addEventListener('click', () => handleAuth('login'));
  document.getElementById('api-register-btn')?.addEventListener('click', () => handleAuth('register'));
  document.getElementById('api-logout-btn')?.addEventListener('click', () => {
    request('/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => {
      clearSession();
      setAuthStatus('Offline mode', false);
      Scholaris.utils.toast?.('Disconnected from backend.');
    });
  });

  Scholaris.events?.on('auth-changed', () => {
    setAuthStatus(isAuthenticated() ? 'Backend connected' : 'Offline mode', isAuthenticated());
    Scholaris.events?.emit('sync-requested');
    flushSyncQueue();
  });

  window.addEventListener('online', flushSyncQueue);
  window.addEventListener('online', setSyncStatus);
  window.addEventListener('offline', setSyncStatus);
  Scholaris.events?.on('sync-state-changed', () => {
    setAuthStatus(isAuthenticated() ? 'Backend connected' : 'Offline mode', isAuthenticated());
    setSyncStatus();
  });
  setInterval(flushSyncQueue, 30000);

  setAuthStatus('Checking session...', false);
  setSyncStatus();
  checkSession();
})();
