// api.js - optional FastAPI connection with localStorage fallback
(function () {
  const API_BASE = localStorage.getItem('scholaris_api_base') || 'http://localhost:8000';
  const TOKEN_KEY = 'scholaris_api_token';
  const USER_KEY = 'scholaris_api_user';

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function isAuthenticated() {
    return Boolean(token());
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (token()) headers.Authorization = `Bearer ${token()}`;

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const payload = await response.json();
        detail = payload.detail || detail;
      } catch (_) {
        // Keep the HTTP status when the server did not return JSON.
      }
      const error = new Error(detail);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function saveSession(data) {
    localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    window.dispatchEvent(new CustomEvent('scholaris:auth-changed'));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new CustomEvent('scholaris:auth-changed'));
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

  async function register(name, email, password) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    await login(email, password);
    return data;
  }

  async function getAssignments() {
    return request('/assignments');
  }

  async function getOrCreateDefaultCourse() {
    const courses = await request('/courses');
    if (courses.length) return courses[0];
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

  window.ScholarisApi = {
    API_BASE,
    clearSession,
    createAssignment,
    deleteAssignment,
    getAssignments,
    isAuthenticated,
    login,
    register,
    token,
    updateAssignment
  };

  function setAuthStatus(message, authenticated) {
    const status = document.getElementById('api-auth-status');
    const email = document.getElementById('api-auth-email');
    const password = document.getElementById('api-auth-password');
    const loginButton = document.getElementById('api-login-btn');
    const registerButton = document.getElementById('api-register-btn');
    const logoutButton = document.getElementById('api-logout-btn');
    if (!status) return;
    status.textContent = message;
    email.hidden = authenticated;
    password.hidden = authenticated;
    loginButton.hidden = authenticated;
    registerButton.hidden = authenticated;
    logoutButton.hidden = !authenticated;
  }

  async function handleAuth(action) {
    const email = document.getElementById('api-auth-email').value.trim();
    const password = document.getElementById('api-auth-password').value;
    const name = email.split('@')[0] || 'Student';
    if (!email || password.length < 8) {
      window.showToast?.('Enter an email and a password of at least 8 characters.', 'error');
      return;
    }
    setAuthStatus('Connecting...', false);
    try {
      if (action === 'register') await register(name, email, password);
      else await login(email, password);
      setAuthStatus(`Connected as ${email}`, true);
      window.showToast?.('Backend account connected.');
    } catch (error) {
      setAuthStatus('Offline mode', false);
      window.showToast?.(error.message, 'error');
    }
  }

  document.getElementById('api-login-btn')?.addEventListener('click', () => handleAuth('login'));
  document.getElementById('api-register-btn')?.addEventListener('click', () => handleAuth('register'));
  document.getElementById('api-logout-btn')?.addEventListener('click', () => {
    clearSession();
    setAuthStatus('Offline mode', false);
    window.showToast?.('Disconnected from backend.');
  });

  window.addEventListener('scholaris:auth-changed', () => {
    setAuthStatus(isAuthenticated() ? 'Backend connected' : 'Offline mode', isAuthenticated());
    window.dispatchEvent(new CustomEvent('scholaris:sync-requested'));
  });

  setAuthStatus(isAuthenticated() ? 'Backend connected' : 'Offline mode', isAuthenticated());
})();
