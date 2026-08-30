// attendance.js — track daily lecture attendance with holiday/exam day markers

(function () {
  const STORAGE_KEY = 'scholaris_attendance';
  const list = document.getElementById('attendance-list');
  const dateInput = document.getElementById('att-date');
  const statusSelect = document.getElementById('att-status');
  const courseInput = document.getElementById('att-course');
  const addBtn = document.getElementById('add-attendance-btn');
  const presentCount = document.getElementById('att-present-count');
  const absentCount = document.getElementById('att-absent-count');
  const holidayCount = document.getElementById('att-holiday-count');
  const examCount = document.getElementById('att-exam-count');

  let datePicker = null;
  if (typeof flatpickr !== 'undefined' && dateInput) {
    datePicker = flatpickr(dateInput, {
      dateFormat: 'Y-m-d',
      allowInput: true,
      placeholder: 'Select date...'
    });
  }

  function load() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function save(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    render();
    updateStats();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'present':
        return 'badge-green';
      case 'absent':
        return 'badge-red';
      case 'holiday':
        return 'badge-yellow';
      case 'exam':
        return 'badge-purple';
      default:
        return 'badge-blue';
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'present':
        return '✓ Present';
      case 'absent':
        return '✗ Absent';
      case 'holiday':
        return '🏖 Holiday';
      case 'exam':
        return '📝 Exam Day';
      default:
        return status;
    }
  }

  function render() {
    const records = load();
    if (records.length === 0) {
      list.innerHTML = `<li class="mock-list-item empty-state"><i class="ph ph-calendar-slash"></i> No attendance records yet</li>`;
      return;
    }

    const sortedRecords = [...records].sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    list.innerHTML = sortedRecords.map((r, i) => {
      const date = new Date(r.date);
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const dayStr = date.toLocaleDateString([], { weekday: 'short' });

      return `
        <li class="mock-list-item">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 1rem;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem;">
                <strong>${escapeHtml(r.course || 'No Course')}</strong>
                <span class="badge ${getStatusBadgeClass(r.status)}">${getStatusLabel(r.status)}</span>
              </div>
              <span style="font-size: 0.85rem; color: var(--text-secondary);">
                <i class="ph ph-calendar"></i> ${dayStr}, ${dateStr}
              </span>
            </div>
            <button class="icon-btn" data-action="delete" data-index="${i}" title="Delete record" style="color: var(--text-secondary);">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        </li>
      `;
    }).join('');
  }

  function updateStats() {
    const records = load();
    const stats = {
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      holiday: records.filter(r => r.status === 'holiday').length,
      exam: records.filter(r => r.status === 'exam').length
    };

    presentCount.textContent = stats.present;
    absentCount.textContent = stats.absent;
    holidayCount.textContent = stats.holiday;
    examCount.textContent = stats.exam;
  }

  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const i = parseInt(btn.dataset.index, 10);
    const records = load();
    if (btn.dataset.action === 'delete') {
      records.splice(i, 1);
      save(records);
    }
  });

  function addAttendance() {
    const date = dateInput.value.trim();
    const status = statusSelect.value;
    const course = courseInput.value.trim();

    if (!date) {
      alert('Please select a date');
      dateInput.focus();
      return;
    }

    if (!course) {
      alert('Please enter a course/subject name');
      courseInput.focus();
      return;
    }

    const records = load();
    const existingIndex = records.findIndex(r => r.date === date && r.course === course);

    if (existingIndex >= 0) {
      records[existingIndex].status = status;
    } else {
      records.push({ date, status, course });
    }

    save(records);
    dateInput.value = '';
    courseInput.value = '';
    statusSelect.value = 'present';
    if (datePicker) {
      datePicker.clear();
    }
    dateInput.focus();
  }

  addBtn?.addEventListener('click', addAttendance);
  dateInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      courseInput.focus();
    }
  });
  courseInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      addAttendance();
    }
  });

  render();
  updateStats();
})();
