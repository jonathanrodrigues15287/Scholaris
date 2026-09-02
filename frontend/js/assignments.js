// assignments.js — add, render, complete, delete, and persist assignments

(function () {
  const STORAGE_KEY = 'scholaris_assignments';
  const list = document.getElementById('assignments-list');
  const titleInput = document.getElementById('assignment-title');
  const dateInput = document.getElementById('assignment-date');
  const priorityInput = document.getElementById('assignment-priority');
  const addBtn = document.getElementById('add-assignment-btn');

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
    let tasks = load();
    if (tasks.length === 0) {
      list.innerHTML = `<li class="mock-list-item empty-state"><i class="ph ph-list-checks"></i> <span>No assignments yet</span></li>`;
      return;
    }

    // Apply Filters
    if (filterStatus && filterStatus.value !== 'all') {
      const isDone = filterStatus.value === 'completed';
      tasks = tasks.filter(t => t.done === isDone);
    }
    
    if (filterPriority && filterPriority.value !== 'all') {
      tasks = tasks.filter(t => t.priority === filterPriority.value);
    }

    if (tasks.length === 0) {
      list.innerHTML = `<li class="mock-list-item empty-state"><i class="ph ph-funnel-x"></i> <span>No assignments match filters</span></li>`;
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
      }
    });

    list.innerHTML = tasks.map((t) => {
      const allTasks = load();
      const origIdx = allTasks.findIndex(orig => orig.title === t.title && orig.due === t.due && orig.done === t.done && orig.priority === t.priority);
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
          <button class="icon-btn delete-btn" data-action="delete" data-index="${origIdx}" title="Delete">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </li>
    `;
    }).join('');
  }

  function updateDashboard(tasks) {
    const deadlineList = document.getElementById('dashboard-deadlines');
    if (!deadlineList) return;
    const pending = tasks.filter(t => !t.done).sort((a, b) => {
      const aDue = a.due || '9999-12-31';
      const bDue = b.due || '9999-12-31';
      return aDue.localeCompare(bDue);
    }).slice(0, 3);
    
    if (pending.length === 0) {
      deadlineList.innerHTML = `<li class="mock-list-item empty-state"><i class="ph ph-check-circle"></i> <span>No pending deadlines</span></li>`;
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

  // Event delegation — one listener for the whole list
  list.addEventListener('click', e => {
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
    }
  });

  function addTask() {
    const title = titleInput.value.trim();
    if (!title) {
      if (window.showToast) window.showToast('Assignment title is required.', 'error');
      titleInput.focus(); 
      return; 
    }
    const tasks = load();
    const isoDate = dateToIso(dateInput.value);
    const priority = priorityInput ? priorityInput.value : 'medium';
    
    tasks.push({ title, due: isoDate, priority, done: false });
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

  addBtn?.addEventListener('click', addTask);
  titleInput?.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  
  if (filterStatus) filterStatus.addEventListener('change', render);
  if (filterPriority) filterPriority.addEventListener('change', render);
  if (sortSelect) sortSelect.addEventListener('change', render);

  // Init
  render();
  updateDashboard(load());
})();
