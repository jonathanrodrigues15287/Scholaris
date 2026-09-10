// dashboard.js - authenticated dashboard summary
(function () {
  function escapeHtml(value) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(value ?? '')));
    return div.innerHTML;
  }

  function renderList(id, items, emptyMessage, renderItem) {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = items.length ? items.map(renderItem).join('') : `<li class="mock-list-item empty-state">${escapeHtml(emptyMessage)}</li>`;
  }

  async function loadDashboard() {
    if (!window.ScholarisApi?.isAuthenticated()) return;
    try {
      const data = await window.ScholarisApi.getDashboard();
      document.getElementById('dashboard-study-minutes').textContent = `${data.study_minutes} min`;
      document.getElementById('dashboard-attendance').textContent = `${data.attendance_percentage.toFixed(1)}%`;
      document.getElementById('dashboard-due-soon').textContent = data.due_soon.length;
      document.getElementById('dashboard-low-attendance').textContent = data.low_attendance_courses;
      document.getElementById('dashboard-study-minutes').title = `${data.study_consistency.active_days_last_7} active study days this week`;

      renderList('dashboard-recommendations', data.recommendations, 'No urgent recommendations.', item => `
        <li class="mock-list-item"><div><strong>${escapeHtml(item.title)}</strong><br><span class="text-secondary">${escapeHtml(item.reason)}</span></div><span class="badge badge-blue">${escapeHtml(item.action)}</span></li>`);
      renderList('dashboard-attendance-risks', data.attendance_risks.filter(item => item.level !== 'safe'), 'No attendance risks detected.', item => `
        <li class="mock-list-item"><div><strong>${escapeHtml(item.course_name)}</strong><br><span class="text-secondary">${item.attended}/${item.total} attended</span></div><span class="badge ${item.level === 'critical' ? 'badge-red' : 'badge-yellow'}">${item.percentage.toFixed(1)}%</span></li>`);
      renderList('dashboard-workload', data.workload, 'No pending workload.', item => `
        <li class="mock-list-item"><span>${escapeHtml(item.category[0].toUpperCase() + item.category.slice(1))}</span><strong>${item.count}</strong></li>`);
      renderList('dashboard-academic-trend', data.academic_trend, 'Add graded semesters to see your trend.', item => `
        <li class="mock-list-item"><span>${escapeHtml(item.semester)}</span><strong>${item.sgpa.toFixed(2)} SGPA</strong></li>`);
      const score = document.getElementById('dashboard-productivity-score');
      if (score) score.textContent = `${data.productivity_score}/100`;
      const consistency = document.getElementById('dashboard-consistency-stat');
      if (consistency) consistency.textContent = `${data.study_consistency.active_days_last_7}/7 days`;
      const deadlineItems = [
        ...data.overdue.map(item => ({ ...item, label: 'Overdue', badge: 'badge-red' })),
        ...data.due_soon.map(item => ({ ...item, label: item.days_until_due === 0 ? 'Due today' : `${item.days_until_due} days`, badge: 'badge-yellow' }))
      ];
      renderList('dashboard-deadlines', deadlineItems, 'No pending deadlines.', item => `
        <li class="mock-list-item"><span>${escapeHtml(item.title)}</span><span class="badge ${item.badge}">${escapeHtml(item.label)}</span></li>`);
    } catch (error) {
      console.warn('Could not load dashboard summary:', error.message);
    }
  }

  window.addEventListener('scholaris:auth-changed', loadDashboard);
  window.addEventListener('scholaris:sync-requested', loadDashboard);
  window.addEventListener('scholaris:study-updated', loadDashboard);
  loadDashboard();
})();
