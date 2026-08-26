// assignments.js — add, render, complete, delete, and persist assignments

(function () {
  const STORAGE_KEY = 'scholaris_assignments';
  const list = document.getElementById('assignments-list');
  const titleInput = document.getElementById('assignment-title');
  const dateInput = document.getElementById('assignment-date');
  const addBtn = document.getElementById('add-assignment-btn');

  function load() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function save(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    updateDashboard(tasks);
  }

  function getBadgeClass(dueDate) {
    if (!dueDate) return 'badge-blue';
    const diff = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
    if (diff < 0) return 'badge-red';
    if (diff === 0) return 'badge-red';
    if (diff <= 2) return 'badge-yellow';
    return 'badge-green';
  }

  function getBadgeLabel(dueDate) {
    if (!dueDate) return 'No date';
    const diff = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Due Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff} days`;
  }

  function render() {
    const tasks = load();
    if (tasks.length === 0) {
      list.innerHTML = `<li class="mock-list-item empty-state"><i class="ph ph-list-checks"></i> No assignments yet</li>`;
      return;
    }
    list.innerHTML = tasks.map((t, i) => `
      <li class="mock-list-item ${t.done ? 'task-done' : ''}">
        <div class="task-left">
          <button class="check-btn" data-action="toggle" data-index="${i}" title="Mark complete">
            <i class="ph${t.done ? '-fill ph-check-circle' : ' ph-circle'}"></i>
          </button>
          <span class="task-title">${escapeHtml(t.title)}</span>
        </div>
        <div class="task-right">
          <span class="badge ${getBadgeClass(t.due)}">${getBadgeLabel(t.due)}</span>
          <button class="icon-btn delete-btn" data-action="delete" data-index="${i}" title="Delete">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </li>
    `).join('');
  }

  function updateDashboard(tasks) {
    const deadlineList = document.getElementById('dashboard-deadlines');
    if (!deadlineList) return;
    const pending = tasks.filter(t => !t.done).slice(0, 3);
    if (pending.length === 0) {
      deadlineList.innerHTML = `<li class="mock-list-item empty-state"><i class="ph ph-check-circle"></i> No pending deadlines</li>`;
    } else {
      deadlineList.innerHTML = pending.map(t => `
        <li class="mock-list-item">
          <span>${escapeHtml(t.title)}</span>
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
    } else if (btn.dataset.action === 'delete') {
      tasks.splice(i, 1);
      save(tasks);
      render();
    }
  });

  function addTask() {
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    const tasks = load();
    tasks.push({ title, due: dateInput.value, done: false });
    save(tasks);
    titleInput.value = '';
    dateInput.value = '';
    render();
    titleInput.focus();
  }

  addBtn?.addEventListener('click', addTask);
  titleInput?.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

  // Init
  render();
  updateDashboard(load());
})();
