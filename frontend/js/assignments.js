// assignments.js — add, render, complete, delete, and persist assignments

(function () {
  const STORAGE_KEY = 'scholaris_assignments';
  const list = document.getElementById('assignments-list');
  const submittedSection = document.getElementById('submitted-assignments-section');
  const submittedList = document.getElementById('submitted-assignments-list');
  const titleInput = document.getElementById('assignment-title');
  const dateInput = document.getElementById('assignment-date');
  const priorityInput = document.getElementById('assignment-priority');
  const addBtn = document.getElementById('add-assignment-btn');

  // Priority Mode Control
  const priorityControl = document.getElementById('priority-control');
  const modeBtns = document.querySelectorAll('.priority-mode-btn');
  const autoBadge = document.getElementById('priority-auto-badge');
  let currentPriorityMode = 'manual';

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPriorityMode = btn.dataset.mode;
      if (priorityControl) priorityControl.dataset.mode = currentPriorityMode;
      
      if (currentPriorityMode === 'auto') {
        priorityInput.disabled = true;
        updateAutoPriorityPreview();
      } else {
        priorityInput.disabled = false;
        if (autoBadge) autoBadge.hidden = true;
      }
    });
  });

  function calculateAutoPriority(isoDate, pendingCount) {
    if (!isoDate) {
      return pendingCount >= 5 ? 'medium' : 'low';
    }
    const diff = getDaysDiff(isoDate);
    if (diff < 0) return 'high';       // overdue
    if (diff === 0) return 'high';     // due today
    if (diff <= 3) return 'high';
    if (diff <= 7) return pendingCount >= 5 ? 'high' : 'medium';
    if (diff <= 14) return 'medium';
    return 'low';
  }

  function updateAutoPriorityPreview() {
    if (currentPriorityMode !== 'auto' || !autoBadge) return;
    const tasks = load();
    const pendingCount = tasks.filter(t => !t.done).length;
    const rawDate = dateInput ? dateInput.value.trim() : '';
    const isoDate = dateToIso(rawDate);
    
    const autoPrio = calculateAutoPriority(isoDate, pendingCount);
    
    autoBadge.innerHTML = `<i class="ph-fill ph-flag" style="color: ${getPriorityColor(autoPrio)}"></i> Auto: ${autoPrio.charAt(0).toUpperCase() + autoPrio.slice(1)}`;
    autoBadge.hidden = false;
  }

  // Filters
  const filterStatus = document.getElementById('assignment-filter-status');
  const filterPriority = document.getElementById('assignment-filter-priority');
  const sortSelect = document.getElementById('assignment-sort');

  let datePicker = null;
  if (typeof flatpickr !== 'undefined' && dateInput) {
    datePicker = flatpickr(dateInput, {
      dateFormat: "d-m-Y",
      allowInput: true,
      placeholder: "Due date (optional)"
    });
  }

  function load() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function save(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    updateDashboard(tasks);
  }

  function dateToIso(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    let y, m, d;
    if (parts[0].length === 4) {
      y = parts[0]; m = parts[1]; d = parts[2];
    } else {
      d = parts[0]; m = parts[1]; y = parts[2];
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  function getDaysDiff(isoDate) {
    if (!isoDate) return 0;
    const due = new Date(`${isoDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  function getBadgeClass(dueDate) {
    if (!dueDate) return 'badge-blue';
    const diff = getDaysDiff(dueDate);
    if (diff < 0) return 'badge-red';
    if (diff === 0) return 'badge-red';
    if (diff <= 2) return 'badge-yellow';
    return 'badge-green';
  }

  function getBadgeLabel(dueDate) {
    if (!dueDate) return 'No date';
    const diff = getDaysDiff(dueDate);
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Due Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff} days`;
  }

  function getPriorityColor(priority) {
    if (priority === 'high') return '#ef4444';
    if (priority === 'medium') return '#f59e0b';
    if (priority === 'low') return '#10b981';
    return 'var(--text-secondary)';
  }

  function render() {
    try {
      let tasks = load();

      // Dynamically recalculate auto priorities based on current dates/workload
      let tasksChanged = false;
      const pendingCount = tasks.filter(t => !t.done).length;
      tasks.forEach(t => {
        if (t.priorityMode === 'auto') {
          const newP = calculateAutoPriority(t.due, pendingCount);
          if (t.priority !== newP) {
            t.priority = newP;
            tasksChanged = true;
          }
        }
      });
      // Silent save if priorities updated naturally
      if (tasksChanged) localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

      // Attach original index for 'recent' sorting and reliable UI mapping
      tasks = tasks.map((t, i) => ({ ...t, _origIndex: i }));

      if (tasks.length === 0) {
        list.innerHTML = window.States.empty(
          'ph ph-list-checks',
          'No assignments yet',
          'Add your first assignment to get started.',
          `<button class="btn" onclick="document.getElementById('assignment-title').focus()">
             <i class="ph ph-plus" aria-hidden="true"></i> Add Assignment
           </button>`
        );
        if (submittedSection) submittedSection.style.display = 'none';
        return;
      }

      // Apply Filters
      if (filterStatus && filterStatus.value !== 'all') {
        if (filterStatus.value === 'overdue') {
          tasks = tasks.filter(t => !t.done && getDaysDiff(t.due) < 0);
        } else {
          const isDone = filterStatus.value === 'completed';
          tasks = tasks.filter(t => t.done === isDone);
        }
      }

      if (filterPriority && filterPriority.value !== 'all') {
        tasks = tasks.filter(t => t.priority === filterPriority.value);
      }

      if (tasks.length === 0) {
        list.innerHTML = window.States.empty(
          'ph ph-funnel-x',
          'No assignments match filters',
          'Try changing the status or priority filter.'
        );
        return;
      }

      // Apply Sorting
      const sortBy = sortSelect ? sortSelect.value : 'date';

      tasks.sort((a, b) => {
        if (sortBy === 'date') {
          const aDue = a.due || '9999-12-31';
          const bDue = b.due || '9999-12-31';
          return aDue.localeCompare(bDue);
        } else if (sortBy === 'priority') {
          const pMap = { high: 1, medium: 2, low: 3, undefined: 4 };
          return (pMap[a.priority] || 4) - (pMap[b.priority] || 4);
        } else if (sortBy === 'title') {
          return (a.title || '').localeCompare(b.title || '');
        } else if (sortBy === 'completion') {
          return (a.done === b.done) ? 0 : a.done ? 1 : -1;
        } else if (sortBy === 'recent') {
          return b._origIndex - a._origIndex;
        }
      });

      const activeTasks = tasks.filter(t => !t.submitted);
      const submittedTasks = tasks.filter(t => t.submitted);

      const renderList = (taskArray, container, emptyMessage) => {
        if (taskArray.length === 0 && container === list) {
          container.innerHTML = window.States.empty(
            'ph ph-check-circle',
            emptyMessage,
            ''
          );
          return;
        }
        
        container.innerHTML = taskArray.map((t) => {
          const origIdx = t._origIndex;
          return `
          <li class="mock-list-item ${t.done ? 'task-done' : ''}">
            <div class="task-left">
              <button class="check-btn" data-action="toggle" data-index="${origIdx}" title="Mark complete">
                <i class="ph${t.done ? '-fill ph-check-circle' : ' ph-circle'}"></i>
              </button>
              <span class="task-title">${escapeHtml(t.title)}</span>
              ${t.priority ? `<i class="ph-fill ph-flag" style="color: ${getPriorityColor(t.priority)}; font-size: 0.8rem; margin-left: 4px;" title="Priority: ${t.priority}"></i>` : ''}
            </div>
            <div class="task-right">
              <span class="badge ${getBadgeClass(t.due)}">${getBadgeLabel(t.due)}</span>
              <button class="icon-btn submit-btn" data-action="submit" data-index="${origIdx}" title="${t.submitted ? 'Unmark Submitted' : 'Mark Submitted'}">
                <i class="ph${t.submitted ? '-fill' : ''} ph-paper-plane-right" ${t.submitted ? 'style="color: #3b82f6;"' : ''}></i>
              </button>
              <button class="icon-btn delete-btn" data-action="delete" data-index="${origIdx}" title="Delete">
                <i class="ph ph-trash"></i>
              </button>
            </div>
          </li>`;
        }).join('');
      };

      renderList(activeTasks, list, 'No active assignments');

      if (submittedTasks.length > 0 && submittedSection && submittedList) {
        submittedSection.style.display = 'block';
        renderList(submittedTasks, submittedList, '');
      } else if (submittedSection) {
        submittedSection.style.display = 'none';
      }

    } catch (e) {
      console.error('Assignments render error:', e);
      list.innerHTML = window.States.error(
        "Couldn't load assignments.",
        'window._assignmentsRender()'
      );
    }
  }

  // Expose render globally for the error-state retry button
  window._assignmentsRender = render;

  function updateDashboard(tasks) {
    const deadlineList = document.getElementById('dashboard-deadlines');
    if (!deadlineList) return;
    const pending = tasks.filter(t => !t.done && !t.submitted).sort((a, b) => {
      const aDue = a.due || '9999-12-31';
      const bDue = b.due || '9999-12-31';
      return aDue.localeCompare(bDue);
    }).slice(0, 3);
    
    if (pending.length === 0) {
      deadlineList.innerHTML = window.States.empty(
        'ph ph-check-circle',
        'All caught up!',
        'No pending deadlines.'
      );
    } else {
      deadlineList.innerHTML = pending.map(t => `
        <li class="mock-list-item">
          <span style="display: flex; align-items: center; gap: 6px;">
            ${escapeHtml(t.title)}
            ${t.priority ? `<i class="ph-fill ph-flag" style="color: ${getPriorityColor(t.priority)}; font-size: 0.8rem;" title="Priority: ${t.priority}"></i>` : ''}
          </span>
          <span class="badge ${getBadgeClass(t.due)}">${getBadgeLabel(t.due)}</span>
        </li>
      `).join('');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  const handleTaskAction = e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const i = parseInt(btn.dataset.index, 10);
    const tasks = load();
    if (btn.dataset.action === 'toggle') {
      tasks[i].done = !tasks[i].done;
      save(tasks);
      render();
      if (tasks[i].done && window.showToast) {
        window.showToast('Task marked as completed!');
      }
    } else if (btn.dataset.action === 'delete') {
      tasks.splice(i, 1);
      save(tasks);
      render();
      if (window.showToast) window.showToast('Task deleted');
    } else if (btn.dataset.action === 'submit') {
      tasks[i].submitted = !tasks[i].submitted;
      save(tasks);
      render();
      if (window.showToast) window.showToast(tasks[i].submitted ? 'Assignment marked as submitted!' : 'Assignment unmarked as submitted!');
    }
  };

  // Event delegation — one listener for the whole list
  list.addEventListener('click', handleTaskAction);
  if (submittedList) submittedList.addEventListener('click', handleTaskAction);

  function addTask() {
    // Clear previous errors
    Validate.clearError(titleInput);
    Validate.clearError(dateInput);

    let valid = true;

    // 1. Title must not be empty
    const title = titleInput.value.trim();
    if (!title) {
      Validate.setError(titleInput, 'Assignment title is required.');
      titleInput.focus();
      valid = false;
    }

    // 2. Date must be valid if provided
    const rawDate = dateInput.value.trim();
    if (rawDate) {
      const dateCheck = Validate.isValidDate(rawDate);
      if (!dateCheck.valid) {
        Validate.setError(dateInput, dateCheck.error);
        if (valid) dateInput.focus();
        valid = false;
      } else {
        // Warn if date is more than 10 years old
        const futureCheck = Validate.isValidFutureDate(rawDate);
        if (!futureCheck.valid) {
          Validate.setError(dateInput, futureCheck.error);
          if (valid) dateInput.focus();
          valid = false;
        }
      }
    }

    if (!valid) return;

    // 3. Duplicate check — same title + same due date
    const tasks = load();
    const isoDate = dateToIso(rawDate);
    const duplicate = tasks.find(t => t.title.toLowerCase() === title.toLowerCase() && t.due === isoDate);
    if (duplicate) {
      Validate.setError(titleInput, 'A task with this title and due date already exists.');
      titleInput.focus();
      return;
    }

    let priority = priorityInput ? priorityInput.value : 'medium';
    if (currentPriorityMode === 'auto') {
      const pendingCount = tasks.filter(t => !t.done).length;
      priority = calculateAutoPriority(isoDate, pendingCount);
    }

    tasks.push({ title, due: isoDate, priority, priorityMode: currentPriorityMode, done: false });
    save(tasks);

    titleInput.value = '';
    if (datePicker) {
      datePicker.clear();
    } else {
      dateInput.value = '';
    }
    if (priorityInput) priorityInput.value = 'medium';

    render();
    if (window.showToast) window.showToast('Assignment added successfully!');
    titleInput.focus();
  }

  // Clear error on user input
  titleInput?.addEventListener('input', () => Validate.clearError(titleInput));
  dateInput?.addEventListener('input', () => {
    Validate.clearError(dateInput);
    updateAutoPriorityPreview();
  });

  addBtn?.addEventListener('click', addTask);
  titleInput?.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  
  if (filterStatus) filterStatus.addEventListener('change', render);
  if (filterPriority) filterPriority.addEventListener('change', render);
  if (sortSelect) sortSelect.addEventListener('change', render);

  // Init
  render();
  updateDashboard(load());
})();
