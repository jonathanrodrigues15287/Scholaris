// cgpa.js — dynamic multi-subject SGPA calculator with localStorage persistence

(function () {
  const STORAGE_KEY = 'scholaris_cgpa_rows';
  const rowsContainer = document.getElementById('cgpa-rows');
  const addRowBtn = document.getElementById('add-subject-btn');
  const calcBtn = document.getElementById('calc-cgpa-btn');
  const resultEl = document.getElementById('cgpa-result');

  if (!rowsContainer) return;

  function load() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function getRowData() {
    return [...rowsContainer.querySelectorAll('.cgpa-row')].map(row => ({
      name: row.querySelector('.subj-name').value,
      credits: row.querySelector('.subj-credits').value,
      grade: row.querySelector('.subj-grade').value,
    }));
  }

  function saveRows() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getRowData()));
  }

  function createRow(data = {}) {
    const div = document.createElement('div');
    div.className = 'cgpa-row';
    div.innerHTML = `
      <input type="text" class="form-control subj-name" placeholder="e.g. Maths" value="${data.name || ''}">
      <input type="number" class="form-control subj-credits" placeholder="Credits" min="1" max="10" value="${data.credits || ''}">
      <input type="number" class="form-control subj-grade" placeholder="Grade pts" min="0" max="10" step="0.1" value="${data.grade || ''}">
      <button class="icon-btn delete-btn remove-row-btn" title="Remove subject">
        <i class="ph ph-trash"></i>
      </button>
    `;
    div.querySelector('.remove-row-btn').addEventListener('click', () => {
      div.remove();
      saveRows();
    });
    // Save on input change
    div.querySelectorAll('input').forEach(inp => inp.addEventListener('input', saveRows));
    return div;
  }

  function renderRows() {
    rowsContainer.innerHTML = '';
    const saved = load();
    const rows = saved.length > 0 ? saved : [{}]; // start with one empty row
    rows.forEach(r => rowsContainer.appendChild(createRow(r)));
  }

  addRowBtn?.addEventListener('click', () => {
    rowsContainer.appendChild(createRow());
  });

  calcBtn?.addEventListener('click', () => {
    saveRows();
    const rows = getRowData();
    let totalWeighted = 0;
    let totalCredits = 0;
    let hasError = false;

    for (const r of rows) {
      const c = parseFloat(r.credits);
      const g = parseFloat(r.grade);
      if (isNaN(c) || isNaN(g) || c <= 0) { hasError = true; break; }
      totalWeighted += c * g;
      totalCredits += c;
    }

    if (hasError || totalCredits === 0) {
      resultEl.innerHTML = '<span style="color: var(--badge-red-text, #991b1b)">⚠ Please fill all fields correctly.</span>';
      return;
    }

    const sgpa = (totalWeighted / totalCredits).toFixed(2);
    resultEl.innerHTML = `SGPA: <strong class="cgpa-score">${sgpa}</strong> <span class="cgpa-max">/ 10</span>`;
  });

  renderRows();
})();
