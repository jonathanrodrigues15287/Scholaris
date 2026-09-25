// attendance.js — track daily lecture attendance with holiday/exam day markers

(function () {
  const Scholaris = window.Scholaris;
  const { escapeHtml } = window.ScholarisUtils;
  const ScholarisStateApi = window.ScholarisStateApi;
  const ScholarisApi = window.ScholarisApi;
  const list = document.getElementById('attendance-list');
  const dateInput = document.getElementById('att-date');
  const statusSelect = document.getElementById('att-status');
  const courseInput = document.getElementById('att-course');
  const customWrap = document.getElementById('att-custom-wrap');
  const customInput = document.getElementById('att-custom-course');
  const addBtn = document.getElementById('add-attendance-btn');
  const presentCount = document.getElementById('att-present-count');
  const absentCount = document.getElementById('att-absent-count');
  const holidayCount = document.getElementById('att-holiday-count');
  const examCount = document.getElementById('att-exam-count');
  const forecastList = document.getElementById('attendance-forecast-list');
  let datePicker = null;
  if (typeof flatpickr !== 'undefined' && dateInput) {
    datePicker = flatpickr(dateInput, {
      dateFormat: 'Y-m-d',
      allowInput: true,
      placeholder: 'Select date...',
      onChange: function(selectedDates, dateStr, instance) {
        updateCourseDropdown(dateStr);
      }
    });
  }

  function load() {
    return ScholarisStateApi.get('attendance');
  }

  function save(records) {
    ScholarisStateApi.set('attendance', records, { persist: true });
    render();
    updateStats();
  }

  function updateCourseDropdown(dateStr) {
    courseInput.replaceChildren();
    const addOption = (value, label) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      courseInput.appendChild(option);
    };
    if (!dateStr) {
      addOption('', 'Select date first...');
      return;
    }

    if (ScholarisApi?.isAuthenticated()) {
      ScholarisApi.getCourses().then(courses => {
        courseInput.replaceChildren();
        addOption('', 'Select course...');
        courses.forEach(course => addOption(course.id, course.name));
      }).catch(() => {});
      return;
    }

    const date = new Date(dateStr);
    const dayStr = date.toLocaleDateString('en-US', { weekday: 'long' });

    const schedule = state.timetable;

    const subjects = [];
    let lastSubject = null;

    for (const row of schedule) {
      if (row.slots && row.slots[dayStr]) {
        const subj = row.slots[dayStr].trim();
        if (subj && subj !== lastSubject) {
          subjects.push(subj);
          lastSubject = subj;
        } else if (subj === lastSubject) {
          // contiguous same subject, ignore
        }
      }
    }

    if (subjects.length === 0) {
      addOption('N/A', `No subjects found for ${dayStr}`);
    } else {
      subjects.forEach(subject => addOption(subject, subject));
    }
    
    // Add a custom option just in case
    addOption('Custom', 'Other (Custom)');
    handleCourseChange();
  }

  function handleCourseChange() {
    Validate.clearError(courseInput);
    if (customInput) Validate.clearError(customInput);
    if (courseInput.value === 'Custom') {
      if (customWrap) customWrap.hidden = false;
      customInput?.focus();
    } else {
      if (customWrap) customWrap.hidden = true;
      if (customInput) customInput.value = '';
    }
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
    try {
      const records = load();
      if (records.length === 0) {
        list.innerHTML = Scholaris.utils.states.empty(
          'ph ph-calendar-slash',
          'No attendance records yet',
          'Log your first lecture by selecting a date and course above.'
        );
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
            <div class="attendance-record-row">
              <div class="attendance-record-main">
                <div class="attendance-record-heading">
                  <strong>${escapeHtml(r.course || 'No Course')}</strong>
                  <span class="badge ${getStatusBadgeClass(r.status)}">${getStatusLabel(r.status)}</span>
                </div>
                <span class="attendance-record-date">
                  <i class="ph ph-calendar"></i> ${dayStr}, ${dateStr}
                </span>
              </div>
              <button class="icon-btn attendance-delete" data-action="delete" data-id="${r.id || ''}" data-date="${escapeHtml(r.date)}" data-course="${escapeHtml(r.course || '')}" title="Delete record">
                <i class="ph ph-trash"></i>
              </button>
            </div>
          </li>
        `;
      }).join('');

    } catch (e) {
      console.error('Attendance render error:', e);
      list.innerHTML = Scholaris.utils.states.error(
        "Couldn't load attendance records.",
        'attendance-retry-btn'
      );
      document.getElementById('attendance-retry-btn')?.addEventListener('click', render);
    }
  }

  // Expose render globally for retry
  Scholaris.utils.render = Scholaris.utils.render || {};
  Scholaris.utils.render.attendance = render;

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

  function percentage(present, total) {
    return Scholaris.utils.business.attendancePercentage(present, total);
  }

  function project(present, total, change) {
    return percentage(present + (change > 0 ? change : 0), total + Math.abs(change));
  }

  function forecastItem(course, prediction, counts) {
    const present = Number(counts?.present || 0);
    const absent = Number(counts?.absent || 0);
    const total = present + absent;
    const current = Number(prediction?.percentage ?? percentage(present, total));
    const target = Number(prediction?.threshold ?? 75);
    const afterPresent = total ? project(present, total, 1) : 100;
    const afterFive = total ? project(present, total, 5) : 100;
    const afterTwoAbsent = total ? project(present, total, -2) : 0;
    const safeAbsences = prediction?.safe_absences;
    const attendNext = prediction?.attend_next;
    const belowTarget = current < target;
    const actionValue = belowTarget ? attendNext : safeAbsences;
    const actionLabel = belowTarget
      ? `consecutive attended lecture${attendNext === 1 ? '' : 's'} to reach ${target.toFixed(0)}%`
      : `safe absence${safeAbsences === 1 ? '' : 's'} before falling below ${target.toFixed(0)}%`;
    return `<li class="mock-list-item attendance-forecast-item">
      <span class="attendance-forecast-course"><strong>${escapeHtml(course)}</strong><small>${present}/${total} attended</small></span>
      <span class="attendance-forecast-metric"><strong>${current.toFixed(1)}%</strong><small>Current</small></span>
      <span class="attendance-forecast-metric"><strong>${afterPresent.toFixed(1)}%</strong><small>After +1</small></span>
      <span class="attendance-forecast-metric"><strong>${afterFive.toFixed(1)}%</strong><small>After +5</small></span>
      <span class="attendance-forecast-metric ${afterTwoAbsent < target ? 'is-warning' : ''}"><strong>${afterTwoAbsent.toFixed(1)}%</strong><small>After -2</small></span>
      <span class="attendance-forecast-action ${belowTarget ? 'is-warning' : 'is-safe'}"><strong>${actionValue ?? 0}</strong><small>${actionLabel}</small></span>
    </li>`;
  }

  function renderForecast(predictions, subjectStats, courses) {
    if (!forecastList) return;
    const names = new Map((courses || []).map(course => [course.id, course.name]));
    const counts = new Map((subjectStats || []).map(item => [item.course_id, item]));
    const items = (predictions || []).map(prediction => forecastItem(
      names.get(prediction.course_id) || counts.get(prediction.course_id)?.course_name || 'Course',
      prediction,
      counts.get(prediction.course_id)
    ));
    forecastList.innerHTML = items.length ? items.join('') : '<li class="mock-list-item empty-state"><i class="ph ph-chart-line-up" aria-hidden="true"></i>No course attendance data yet.</li>';
  }

  async function loadForecast() {
    if (!forecastList || !ScholarisApi?.isAuthenticated()) return;
    try {
      const [predictions, subjectStats, courses] = await Promise.all([
        ScholarisApi.getAttendancePredictions(),
        ScholarisApi.getAttendanceSubjectStats(),
        ScholarisApi.getCourses()
      ]);
      renderForecast(predictions, subjectStats, courses);
    } catch (error) {
      console.warn('Attendance forecast unavailable:', error.message);
    }
  }

  async function syncFromBackend() {
    if (!ScholarisApi?.isAuthenticated()) return;
    try {
      const [records, courses] = await Promise.all([ScholarisApi.getAttendance(), ScholarisApi.getCourses()]);
      const names = new Map(courses.map(course => [course.id, course.name]));
      ScholarisStateApi.set('attendance', records.map(record => ({ ...record, date: record.date, courseId: record.course_id, course: names.get(record.course_id) || 'Course' })), { persist: true });
      render();
      updateStats();
      loadForecast();
    } catch (error) {
      console.warn('Attendance backend sync unavailable:', error.message);
    }
  }

  list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const records = load();
    if (btn.dataset.action === 'delete') {
      const recordId = btn.dataset.id ? Number(btn.dataset.id) : null;
      const date = btn.dataset.date;
      const course = btn.dataset.course;
      const targetIndex = records.findIndex(r => (recordId && r.id === recordId) || (r.date === date && r.course === course));
      if (targetIndex === -1) return;
      const deletedRecord = records.splice(targetIndex, 1)[0];
      if (deletedRecord.id && ScholarisApi?.isAuthenticated()) await ScholarisApi.deleteAttendance(deletedRecord.id);
      save(records);
      if (Scholaris.utils.toast) {
        Scholaris.utils.toast('Attendance record deleted', 'success', {
          text: 'Undo',
          onClick: async () => {
            const currentRecords = load();
            currentRecords.splice(targetIndex, 0, deletedRecord);
            if (deletedRecord.id && ScholarisApi?.isAuthenticated()) {
              const courseId = deletedRecord.courseId || deletedRecord.course_id;
              if (courseId) {
                try {
                  const restored = await ScholarisApi.createAttendance({
                    date: deletedRecord.date,
                    status: deletedRecord.status,
                    course_id: Number(courseId)
                  });
                  if (restored?.id) deletedRecord.id = restored.id;
                } catch (err) {
                  console.warn('Attendance undo re-sync error:', err);
                }
              }
            }
            save(currentRecords);
            Scholaris.utils.toast('Record restored');
          }
        });
      }
    }
  });

  async function addAttendance() {
    // Clear previous errors
    Validate.clearError(dateInput);
    Validate.clearError(courseInput);
    if (customInput) Validate.clearError(customInput);

    let valid = true;
    const date = dateInput.value.trim();

    // 1. Date required
    if (!date) {
      Validate.setError(dateInput, 'Please select a date.');
      dateInput.focus();
      valid = false;
    } else {
      const dateCheck = Validate.isValidDate(date);
      if (!dateCheck.valid) {
        Validate.setError(dateInput, dateCheck.error);
        dateInput.focus();
        valid = false;
      }
    }

    let course = courseInput.value.trim();

    // 2. Handle custom course name inline
    if (course === 'Custom') {
      const custom = customInput ? customInput.value.trim() : '';
      if (!custom) {
        if (customInput) {
          Validate.setError(customInput, 'Please enter a course name.');
          customInput.focus();
        } else {
          Validate.setError(courseInput, 'Please enter a course name.');
          courseInput.focus();
        }
        valid = false;
      } else {
        course = custom;
      }
    }

    // 3. Course must not be empty or placeholder
    if (valid && (!course || course === '' || course === 'N/A')) {
      Validate.setError(courseInput, 'Please select or enter a valid course.');
      courseInput.focus();
      valid = false;
    }

    if (!valid) return;

    const status = statusSelect.value;
    const records = load();

    if (ScholarisApi?.isAuthenticated() && courseInput.value !== 'Custom') {
      const courseId = Number(course);
      try {
        const existing = records.find(record => record.date === date && Number(record.courseId || record.course_id) === courseId);
        if (existing?.id) await ScholarisApi.updateAttendance(existing.id, { status });
        else await ScholarisApi.createAttendance({ date, status, course_id: courseId });
        await syncFromBackend();
        Scholaris.utils.toast?.('Attendance synced to your account!');
      } catch (error) {
        Scholaris.utils.toast?.(error.message, 'error');
      }
      statusSelect.value = 'present';
      updateCourseDropdown(date);
      return;
    }

    // 4. Duplicate check — same date + same course
    const existingIndex = records.findIndex(r => r.date === date && r.course === course);
    if (existingIndex >= 0) {
      // Update existing record instead of blocking — show info
      records[existingIndex].status = status;
      save(records);
      if (Scholaris.utils.toast) Scholaris.utils.toast(`Updated attendance for ${course} on this date.`);
    } else {
      records.push({ date, status, course });
      save(records);
      if (Scholaris.utils.toast) Scholaris.utils.toast('Attendance logged successfully!');
    }

    statusSelect.value = 'present';
    updateCourseDropdown(date);
    courseInput.focus();
    loadForecast();
  }

  // Clear errors on field change
  dateInput?.addEventListener('change', (e) => {
    Validate.clearError(dateInput);
    updateCourseDropdown(e.target.value);
  });
  courseInput?.addEventListener('change', handleCourseChange);
  customInput?.addEventListener('input', () => {
    if (customInput) Validate.clearError(customInput);
  });
  dateInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') courseInput.focus();
  });
  document.getElementById('attendance-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    addAttendance();
  });
  render();
  updateStats();
  Scholaris.events?.on('auth-changed', syncFromBackend);
  syncFromBackend();
  loadForecast();
})();
