// timer.js — Focus timer: 25 min focus / 5 min break with SVG ring

(function () {
  const CIRCUMFERENCE = 2 * Math.PI * 54; // matches r="54" in SVG

  const focusInput = document.getElementById('focus-input');
  const breakInput = document.getElementById('break-input');

  function getFocusMins() { return parseInt(focusInput?.value, 10) || 25; }
  function getBreakMins() { return parseInt(breakInput?.value, 10) || 5; }

  const display = document.getElementById('timer-display');
  const modeLabel = document.getElementById('timer-mode');
  const startBtn = document.getElementById('timer-start');
  const resetBtn = document.getElementById('timer-reset');
  const ring = document.getElementById('timer-ring');

  if (!display) return;

  let totalSeconds = getFocusMins() * 60;
  let remaining = totalSeconds;
  let interval = null;
  let running = false;
  let isFocus = true;

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateDisplay() {
    display.textContent = formatTime(remaining);
    const progress = remaining / totalSeconds;
    ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
    ring.style.stroke = isFocus ? 'var(--accent-color)' : '#10b981';
    // Update page title for background tabs
    document.title = `${formatTime(remaining)} — ${isFocus ? 'Focus' : 'Break'} | Scholaris`;
  }

  function setPhase(focus) {
    isFocus = focus;
    totalSeconds = (isFocus ? getFocusMins() : getBreakMins()) * 60;
    remaining = totalSeconds;
    modeLabel.textContent = isFocus ? '🎯 Focus Session' : '☕ Break Time';
    startBtn.innerHTML = '<i class="ph ph-play"></i> Start';
    updateDisplay();
  }

  function startTimer() {
    if (running) return;
    running = true;
    startBtn.innerHTML = '<i class="ph ph-pause"></i> Pause';
    interval = setInterval(() => {
      remaining--;
      updateDisplay();
      if (remaining <= 0) {
        clearInterval(interval);
        running = false;
        setPhase(!isFocus); // auto-switch phase
      }
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(interval);
    running = false;
    startBtn.innerHTML = '<i class="ph ph-play"></i> Resume';
  }

  /* ── Session History ── */
  const STORAGE_KEY = 'scholaris_study_sessions';
  const historyList = document.getElementById('session-history-list');
  const modalOverlay = document.getElementById('session-modal-overlay');
  const taskInput = document.getElementById('session-task-input');
  const saveBtn = document.getElementById('session-save-btn');
  const skipBtn = document.getElementById('session-skip-btn');
  let lastSessionDuration = 0;

  function loadHistory() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    try {
      const history = loadHistory();
      if (history.length === 0) {
        historyList.innerHTML = window.States.empty(
          'ph ph-clock-countdown',
          'No sessions recorded yet',
          'Complete your first focus session to see it here.'
        );
        return;
      }
      historyList.innerHTML = history.slice().reverse().map(h => {
        const date = new Date(h.date);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        return `
          <li class="mock-list-item" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600;">${h.task ? escapeHtml(h.task) : 'Focus Session'}</span>
              <span class="badge badge-blue">${h.duration} min</span>
            </div>
            <span style="font-size: 0.8rem; color: var(--text-secondary);"><i class="ph ph-calendar"></i> ${dateStr}, ${timeStr}</span>
          </li>
        `;
      }).join('');
    } catch (e) {
      console.error('Session history render error:', e);
      historyList.innerHTML = window.States.error(
        "Couldn't load session history.",
        'window._timerHistoryRender()'
      );
    }
  }

  // Expose for retry button
  window._timerHistoryRender = renderHistory;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showModal() {
    modalOverlay.classList.remove('hidden');
    taskInput.value = '';
    taskInput.focus();
  }

  function hideModal() {
    modalOverlay.classList.add('hidden');
    setPhase(!isFocus); // switch phase to break
  }

  function saveSession(taskName) {
    const history = loadHistory();
    history.push({
      duration: lastSessionDuration,
      task: taskName,
      date: new Date().toISOString()
    });
    saveHistory(history);
  }

  saveBtn?.addEventListener('click', () => {
    saveSession(taskInput.value.trim());
    hideModal();
  });

  skipBtn?.addEventListener('click', () => {
    saveSession('');
    hideModal();
  });

  taskInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      saveSession(taskInput.value.trim());
      hideModal();
    }
  });

  /* ── Overriding startTimer for Modal Trigger ── */
  startBtn?.addEventListener('click', () => {
    if (running) pauseTimer(); else {
      if (running) return;
      running = true;
      startBtn.innerHTML = '<i class="ph ph-pause"></i> Pause';
      interval = setInterval(() => {
        remaining--;
        updateDisplay();
        if (remaining <= 0) {
          clearInterval(interval);
          running = false;
          if (isFocus) {
            lastSessionDuration = getFocusMins();
            showModal();
          } else {
            setPhase(!isFocus); // auto-switch phase back to focus
          }
        }
      }, 1000);
    }
  });

  resetBtn?.addEventListener('click', () => {
    clearInterval(interval);
    running = false;
    setPhase(true);
    startBtn.innerHTML = '<i class="ph ph-play"></i> Start Focus';
    document.title = 'Scholaris — College Personal Assistant';
  });

  focusInput?.addEventListener('change', () => {
    if (!running && isFocus) setPhase(true);
  });
  breakInput?.addEventListener('change', () => {
    if (!running && !isFocus) setPhase(false);
  });

  // Initial render
  updateDisplay();
  renderHistory();
})();
