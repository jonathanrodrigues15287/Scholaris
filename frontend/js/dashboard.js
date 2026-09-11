// dashboard.js - renders the authenticated dashboard from one backend snapshot.
(function () {
  const state = window.ScholarisState || {};

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(value ?? '')));
    return div.innerHTML;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function renderList(id, items, emptyMessage, renderItem, emptyIcon = 'ph-info') {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = items.length ? items.map(renderItem).join('') : `<li class="mock-list-item empty-state"><i class="ph ${emptyIcon}" aria-hidden="true"></i>${escapeHtml(emptyMessage)}</li>`;
  }

  function formatMinutes(minutes) {
    const value = number(minutes);
    if (value < 60) return `${value} min`;
    const hours = Math.floor(value / 60);
    const remainder = value % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  function formatTime(value) {
    if (!value) return 'Time pending';
    const [hours, minutes] = String(value).split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return escapeHtml(value);
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  }

  function timeToMinutes(value) {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
  }

  function scheduleForToday() {
    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const events = [];
    (Array.isArray(state.timetable) ? state.timetable : []).forEach(item => {
      if (item?.slots) {
        const subject = item.slots[today];
        if (subject) {
          const [startTime, endTime] = String(item.time || '').split('-').map(value => value.trim());
          events.push({ subject, startTime, endTime });
        }
      } else if (item?.day === today && item.subject) {
        events.push(item);
      }
    });
    return events.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }

  function upcomingClasses() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = new Date().getDay();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const events = [];
    (Array.isArray(state.timetable) ? state.timetable : []).forEach(item => {
      if (item?.slots) {
        Object.entries(item.slots).forEach(([day, subject]) => {
          if (!subject || !days.includes(day)) return;
          const [startTime, endTime] = String(item.time || '').split('-').map(value => value.trim());
          events.push({ subject, day, startTime, endTime });
        });
      } else if (item?.subject && days.includes(item.day)) {
        events.push(item);
      }
    });
    const upcoming = events.map(item => ({
      ...item,
      dayOffset: (days.indexOf(item.day) - todayIndex + 7) % 7
    })).filter(item => item.dayOffset !== 0 || timeToMinutes(item.startTime) >= currentMinutes);
    return upcoming.sort((a, b) => a.dayOffset - b.dayOffset || timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }

  function renderClasses() {
    const classes = scheduleForToday();
    renderList('dashboard-todays-classes', classes, 'No classes scheduled today.', item => `
      <li class="mock-list-item dashboard-class-item"><span class="dashboard-class-time">${formatTime(item.startTime)}</span><span><strong>${escapeHtml(item.subject)}</strong><span class="dashboard-class-meta">${item.endTime ? `Until ${formatTime(item.endTime)}` : 'Time not specified'}${item.room ? ` · ${escapeHtml(item.room)}` : ''}</span></span></li>`, 'ph-calendar-slash');
    const next = upcomingClasses()[0];
    const target = document.getElementById('dashboard-next-class');
    if (!target) return;
    target.innerHTML = next ? `<div class="dashboard-next-content"><strong>${escapeHtml(next.subject)}</strong><span class="dashboard-next-meta">${next.dayOffset === 0 ? 'Today' : next.day} · ${formatTime(next.startTime)}${next.room ? ` · ${escapeHtml(next.room)}` : ''}</span></div>` : '<i class="ph ph-calendar-slash" aria-hidden="true"></i><span>No upcoming classes</span>';
  }

  function renderProgress(data, goal) {
    const consistency = data.study_consistency || {};
    const goalMinutes = number(goal?.weekly_study_goal_minutes, 300);
    const weekMinutes = number(consistency.minutes_last_7);
    const goalPercent = Math.min(Math.round((weekMinutes / Math.max(goalMinutes, 1)) * 100), 100);
    const values = {
      'dashboard-study-minutes': formatMinutes(data.study_minutes),
      'dashboard-attendance': `${number(data.attendance_percentage).toFixed(1)}%`,
      'dashboard-due-soon': number(data.upcoming_assignments || data.due_soon?.length),
      'dashboard-low-attendance': number(data.low_attendance_courses),
      'dashboard-productivity-score': `${number(data.productivity_score)}/100`,
      'dashboard-consistency-stat': `${number(consistency.current_streak_days)} days`,
      'dashboard-goal-stat': `${goalPercent}%`,
      'dashboard-streak-days': `${number(consistency.current_streak_days)} days`
    };
    Object.entries(values).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
    const progress = document.getElementById('dashboard-goal-progress');
    if (progress) progress.style.width = `${goalPercent}%`;
    const detail = document.getElementById('dashboard-goal-detail');
    if (detail) detail.textContent = `${formatMinutes(weekMinutes)} of ${formatMinutes(goalMinutes)} this week · ${number(consistency.active_days_last_7)} active days`;
  }

  function renderDeadlines(data) {
    const dueSoon = Array.isArray(data.due_soon) ? data.due_soon : [];
    const overdue = Array.isArray(data.overdue) ? data.overdue : [];
    const deadlineItems = [...overdue.map(item => ({ ...item, label: 'Overdue', badge: 'badge-red' })), ...dueSoon.map(item => ({ ...item, label: number(item.days_until_due) === 0 ? 'Due today' : `${number(item.days_until_due)} days`, badge: 'badge-yellow' }))];
    const renderDeadline = item => `<li class="mock-list-item"><span><strong>${escapeHtml(item.title)}</strong>${item.due_date ? `<span class="dashboard-class-meta">Due ${escapeHtml(item.due_date)}</span>` : ''}</span><span class="badge ${item.badge}">${escapeHtml(item.label)}</span></li>`;
    renderList('dashboard-deadlines', deadlineItems, 'No upcoming deadlines.', renderDeadline, 'ph-check-circle');
    renderList('dashboard-overdue', overdue, 'No overdue assignments.', item => renderDeadline({ ...item, label: 'Overdue', badge: 'badge-red' }), 'ph-check-circle');
  }

  function renderAttendance(data) {
    const risks = (data.attendance_risks || []).filter(item => item.level !== 'safe');
    renderList('dashboard-attendance-risks', risks, 'No attendance risks detected.', item => `<li class="mock-list-item"><span><strong>${escapeHtml(item.course_name)}</strong><span class="dashboard-class-meta">${item.attended}/${item.total} attended</span></span><span class="badge ${item.level === 'critical' ? 'badge-red' : 'badge-yellow'}">${number(item.percentage).toFixed(1)}%</span></li>`, 'ph-shield-check');
  }

  function renderWorkload(data) {
    const workload = data.workload || [];
    const max = Math.max(...workload.map(item => number(item.count)), 1);
    renderList('dashboard-workload', workload, 'No pending workload.', item => {
      const label = String(item.category || 'Other');
      const width = Math.round((number(item.count) / max) * 100);
      return `<li class="mock-list-item dashboard-workload-row"><span class="dashboard-workload-label"><span>${escapeHtml(label.charAt(0).toUpperCase() + label.slice(1))}</span><strong>${number(item.count)}</strong></span><span class="dashboard-bar"><span style="width: ${width}%"></span></span></li>`;
    }, 'ph-chart-bar');
  }

  function renderAcademicTrend(data) {
    renderList('dashboard-academic-trend', data.academic_trend || [], 'Add graded semesters to see your trend.', item => {
      const sgpa = number(item.sgpa);
      return `<li class="mock-list-item dashboard-trend-row"><span class="dashboard-trend-label"><span>${escapeHtml(item.semester)}</span><strong>${sgpa.toFixed(2)}</strong></span><span class="dashboard-bar dashboard-trend-bar"><span style="width: ${Math.min((sgpa / 10) * 100, 100)}%"></span></span></li>`;
    }, 'ph-chart-line-up');
  }

  function renderRecommendations(data) {
    const targets = { deadline: 'assignments', attendance: 'attendance', consistency: 'study' };
    renderList('dashboard-recommendations', data.recommendations || [], 'No urgent recommendations.', item => `<li class="mock-list-item"><span><strong>${escapeHtml(item.title)}</strong><span class="dashboard-class-meta">${escapeHtml(item.reason)}</span></span><button type="button" class="btn btn-secondary dashboard-action" data-target="${targets[item.type] || 'dashboard'}">${escapeHtml(item.action)}</button></li>`, 'ph-sparkle');
    document.querySelectorAll('.dashboard-action').forEach(button => button.addEventListener('click', () => document.querySelector(`[data-target="${button.dataset.target}"]`)?.click()));
  }

  async function loadDashboard() {
    if (!window.ScholarisApi?.isAuthenticated()) return;
    try {
      const [data, goal] = await Promise.all([window.ScholarisApi.getDashboard(), window.ScholarisApi.getStudyGoal().catch(() => state.studyGoal)]);
      if (goal) window.ScholarisStateApi?.set('studyGoal', goal, { silent: true });
      renderClasses();
      renderProgress(data, goal);
      renderDeadlines(data);
      renderAttendance(data);
      renderWorkload(data);
      renderAcademicTrend(data);
      renderRecommendations(data);
    } catch (error) {
      console.warn('Could not load dashboard summary:', error.message);
    }
  }

  window.ScholarisEvents?.on('dashboard:refresh', loadDashboard);
  window.ScholarisEvents?.on('auth-changed', loadDashboard);
  window.ScholarisEvents?.on('sync-requested', loadDashboard);
  window.ScholarisEvents?.on('study-updated', loadDashboard);
  loadDashboard();
})();
