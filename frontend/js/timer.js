// timer.js — Pomodoro timer: 25 min focus / 5 min break with SVG ring

(function () {
  const FOCUS_MINS = 25;
  const BREAK_MINS = 5;
  const CIRCUMFERENCE = 2 * Math.PI * 54; // matches r="54" in SVG

  const display = document.getElementById('timer-display');
  const modeLabel = document.getElementById('timer-mode');
  const startBtn = document.getElementById('timer-start');
  const resetBtn = document.getElementById('timer-reset');
  const ring = document.getElementById('timer-ring');

  if (!display) return;

  let totalSeconds = FOCUS_MINS * 60;
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
    document.title = `${formatTime(remaining)} — ${isFocus ? 'Focus' : 'Break'} | UniAssist`;
  }

  function setPhase(focus) {
    isFocus = focus;
    totalSeconds = (isFocus ? FOCUS_MINS : BREAK_MINS) * 60;
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

  startBtn?.addEventListener('click', () => {
    if (running) pauseTimer(); else startTimer();
  });

  resetBtn?.addEventListener('click', () => {
    clearInterval(interval);
    running = false;
    setPhase(true);
    startBtn.innerHTML = '<i class="ph ph-play"></i> Start Focus';
    document.title = 'UniAssist — College Personal Assistant';
  });

  // Initial render
  updateDisplay();
})();
