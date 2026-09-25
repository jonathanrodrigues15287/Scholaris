// assignments.js — add, render, complete, delete, and persist assignments

(function () {
  const Scholaris = window.Scholaris;
  const { escapeHtml } = window.ScholarisUtils;
  const ScholarisStateApi = window.ScholarisStateApi;
  const ScholarisApi = window.ScholarisApi;
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
    return Scholaris.utils.business.assignmentPriority(isoDate, pendingCount);
  }

  function updateAutoPriorityPreview() {
    if (currentPriorityMode !== 'auto' || !autoBadge) return;
    const tasks = load();
    const pendingCount = tasks.filter(t => !t.done).length;
    const rawDate = dateInput ? dateInput.value.trim() : '';
    const isoDate = dateToIso(rawDate);
    
    const autoPrio = calculateAutoPriority(isoDate, pendingCount);
    
    autoBadge.innerHTML = `<i class="ph-fill ph-flag priority-${autoPrio}"></i> Auto: ${autoPrio.charAt(0).toUpperCase() + autoPrio.slice(1)}`;
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
    return ScholarisStateApi.get('assignments');
  }

  function save(tasks) {
    ScholarisStateApi.set('assignments', tasks, { persist: true });
    updateDashboard(tasks);
  }

  function fromApiAssignment(task) {
    return {
      id: task.id,
      title: task.title,
      due: task.due_date || '',
      priority: task.priority || 'medium',
      priorityMode: task.priority_mode || 'manual',
      done: Boolean(task.is_completed),
      submitted: Boolean(task.is_submitted),
      status: task.status || 'pending',
      updatedAt: task.updated_at || null,
      syncState: 'synced'
    };
  }

  async function syncFromBackend() {
    if (!ScholarisApi?.isAuthenticated()) return;
    try {
      const remoteTasks = await ScholarisApi.getAssignments();
      save(remoteTasks.map(fromApiAssignment));
      render();
    } catch (error) {
      console.warn('Scholaris backend sync unavailable:', error.message);
    }
  }

  async function syncTaskCreate(task) {
    if (!ScholarisApi?.isAuthenticated()) return;
    try {
      const remoteTask = await ScholarisApi.createAssignment(task);
      task.id = remoteTask.id;
      save(load());
      render();
    } catch (error) {
      Scholaris.utils.toast?.(`Saved locally. Backend sync failed: ${error.message}`, 'error');
    }
  }

  function dateToIso(dateStr) {
    return Scholaris.utils.business.dateToIso(dateStr);
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
      if (tasksChanged) ScholarisStateApi.set('assignments', tasks, { persist: true });

      // Attach original index for 'recent' sorting and reliable UI mapping
      tasks = tasks.map((t, i) => ({ ...t, _origIndex: i }));

      if (tasks.length === 0) {
        list.innerHTML = Scholaris.utils.states.empty(
          'ph ph-list-checks',
          'No assignments yet',
          'Add your first assignment to get started.',
          `<button class="btn" id="assignments-empty-cta">
             <i class="ph ph-plus" aria-hidden="true"></i> Add Assignment
           </button>`
        );
        // Wire up CTA
        document.getElementById('assignments-empty-cta')?.addEventListener('click', () => {
          document.getElementById('assignment-title')?.focus();
        });
        if (submittedSection) submittedSection.hidden = true;
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
        list.innerHTML = Scholaris.utils.states.empty(
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
          container.innerHTML = Scholaris.utils.states.empty(
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
              ${t.priority ? `<i class="ph-fill ph-flag priority-${t.priority}" title="Priority: ${t.priority}"></i>` : ''}
            </div>
            <div class="task-right">
              ${t.syncState === 'pending' ? '<span class="badge badge-yellow" title="Waiting for server confirmation">Syncing</span>' : ''}
              ${t.syncState === 'conflict' ? '<span class="badge badge-red" title="This change conflicts with another device">Conflict</span>' : ''}
              <span class="badge ${getBadgeClass(t.due)}">${getBadgeLabel(t.due)}</span>
              <button class="icon-btn submit-btn" data-action="submit" data-index="${origIdx}" title="${t.submitted ? 'Unmark Submitted' : 'Mark Submitted'}">
                <i class="ph${t.submitted ? '-fill' : ''} ph-paper-plane-right ${t.submitted ? 'submission-marked' : ''}"></i>
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
        submittedSection.hidden = false;
        renderList(submittedTasks, submittedList, '');
      } else if (submittedSection) {
        submittedSection.hidden = true;
      }

    } catch (e) {
      console.error('Assignments render error:', e);
      list.innerHTML = Scholaris.utils.states.error(
        "Couldn't load assignments.",
        'Scholaris.utils.render.assignments()'
      );
    }
  }

  // Expose render globally for the error-state retry button
  Scholaris.utils.render = Scholaris.utils.render || {};
  Scholaris.utils.render.assignments = render;
  Scholaris.events?.on('sync-state-changed', render);

  function updateDashboard(tasks) {
    const deadlineList = document.getElementById('dashboard-deadlines');
    if (!deadlineList) return;
    const pending = tasks.filter(t => !t.done && !t.submitted).sort((a, b) => {
      const aDue = a.due || '9999-12-31';
      const bDue = b.due || '9999-12-31';
      return aDue.localeCompare(bDue);
    }).slice(0, 3);
    
    if (pending.length === 0) {
      deadlineList.innerHTML = Scholaris.utils.states.empty(
        'ph ph-check-circle',
        'All caught up!',
        'No pending deadlines.'
      );
    } else {
      deadlineList.innerHTML = pending.map(t => `
        <li class="mock-list-item">
          <span class="deadline-title">
            ${escapeHtml(t.title)}
            ${t.priority ? `<i class="ph-fill ph-flag priority-${t.priority}" title="Priority: ${t.priority}"></i>` : ''}
          </span>
          <span class="badge ${getBadgeClass(t.due)}">${getBadgeLabel(t.due)}</span>
        </li>
      `).join('');
    }
  }

  const handleTaskAction = async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const i = parseInt(btn.dataset.index, 10);
    const tasks = load();
    if (btn.dataset.action === 'toggle') {
      tasks[i].done = !tasks[i].done;
      if (tasks[i].id && ScholarisApi?.isAuthenticated()) {
        try {
          const updated = await ScholarisApi.updateAssignment(tasks[i].id, {
            status: tasks[i].done ? 'completed' : 'pending',
            expected_updated_at: tasks[i].updatedAt
          });
          tasks[i].updatedAt = updated?.updated_at || tasks[i].updatedAt;
          tasks[i].syncState = 'synced';
        } catch (error) {
          tasks[i].syncState = error.queued ? 'pending' : 'conflict';
          Scholaris.utils.toast?.(error.queued ? 'Marked complete offline; waiting to sync.' : `Backend update failed: ${error.message}`, error.queued ? 'info' : 'error');
        }
      }
      save(tasks);
      render();
      if (tasks[i].done && Scholaris.utils.toast) {
        Scholaris.utils.toast('Task marked as completed!');
      }
    } else if (btn.dataset.action === 'delete') {
      const deletedTask = tasks.splice(i, 1)[0];
      if (deletedTask.id && ScholarisApi?.isAuthenticated()) {
        try {
          await ScholarisApi.deleteAssignment(deletedTask.id);
        } catch (error) {
          Scholaris.utils.toast?.(error.queued ? 'Deletion queued until you reconnect.' : `Backend delete failed: ${error.message}`, error.queued ? 'info' : 'error');
        }
      }
      save(tasks);
      render();
      if (Scholaris.utils.toast) {
        Scholaris.utils.toast('Task deleted', 'success', {
          text: 'Undo',
          onClick: () => {
            const currentTasks = load();
            currentTasks.splice(i, 0, deletedTask);
            save(currentTasks);
            render();
            if (deletedTask.id && ScholarisApi?.isAuthenticated()) {
              syncTaskCreate(deletedTask);
            }
            Scholaris.utils.toast('Task restored');
          }
        });
      }
    } else if (btn.dataset.action === 'submit') {
      tasks[i].submitted = !tasks[i].submitted;
      if (tasks[i].id && ScholarisApi?.isAuthenticated()) {
        try {
          await ScholarisApi.updateAssignment(tasks[i].id, {
            status: tasks[i].submitted ? 'submitted' : (tasks[i].done ? 'completed' : 'pending'),
            expected_updated_at: tasks[i].updatedAt
          });
        } catch (error) {
          tasks[i].syncState = error.queued ? 'pending' : 'conflict';
          Scholaris.utils.toast?.(error.queued ? 'Submission queued until you reconnect.' : `Backend update failed: ${error.message}`, error.queued ? 'info' : 'error');
        }
      }
      save(tasks);
      render();
      if (Scholaris.utils.toast) Scholaris.utils.toast(tasks[i].submitted ? 'Assignment marked as submitted!' : 'Assignment unmarked as submitted!');
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

    const task = { title, due: isoDate, priority, priorityMode: currentPriorityMode, done: false, submitted: false };
    tasks.push(task);
    save(tasks);
    syncTaskCreate(task);

    titleInput.value = '';
    if (datePicker) {
      datePicker.clear();
    } else {
      dateInput.value = '';
    }
    if (priorityInput) priorityInput.value = 'medium';

    render();
    if (Scholaris.utils.toast) Scholaris.utils.toast('Assignment added successfully!');
    titleInput.focus();
  }

  // Clear error on user input
  titleInput?.addEventListener('input', () => Validate.clearError(titleInput));
  dateInput?.addEventListener('input', () => {
    Validate.clearError(dateInput);
    updateAutoPriorityPreview();
  });

  document.getElementById('assignment-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    addTask();
  });
  
  if (filterStatus) filterStatus.addEventListener('change', render);
  if (filterPriority) filterPriority.addEventListener('change', render);
  if (sortSelect) sortSelect.addEventListener('change', render);

  Scholaris.events?.on('sync-requested', syncFromBackend);

  // Init
  render();
  updateDashboard(load());
  syncFromBackend();
})();
