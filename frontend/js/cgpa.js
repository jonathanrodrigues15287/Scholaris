// cgpa.js — dynamic multi-semester SGPA and CGPA calculator with localStorage persistence

(function () {
  const STORAGE_KEY = 'scholaris_cgpa_semesters';
  const semestersContainer = document.getElementById('semesters-container');
  const addSemesterBtn = document.getElementById('add-semester-btn');
  const overallCgpaResult = document.getElementById('overall-cgpa-result');

  if (!semestersContainer) return;

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  function load() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return [];
      }
    }
    return [{ id: generateId(), subjects: [{ id: generateId(), name: '', credits: '', grade: '' }] }];
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // Get current state from DOM
  function getState() {
    const semesters = [];
    document.querySelectorAll('.semester-card').forEach((semCard) => {
      const id = semCard.dataset.id;
      const subjects = [];
      semCard.querySelectorAll('.cgpa-row').forEach((row) => {
        subjects.push({
          id: row.dataset.id,
          name: row.querySelector('.subj-name').value,
          credits: row.querySelector('.subj-credits').value,
          grade: row.querySelector('.subj-grade').value,
        });
      });
      semesters.push({ id, subjects });
    });
    return semesters;
  }

  function updateStateAndRender() {
    const state = getState();
    save(state);
    calculateAndDisplay(state);
  }

  function calculateAndDisplay(semesters) {
    let totalCgpaWeighted = 0;
    let totalCgpaCredits = 0;
    let anyCgpaError = false;

    semesters.forEach(sem => {
      let semWeighted = 0;
      let semCredits = 0;
      let hasError = false;
      let hasEmptyFields = false;
      
      if (sem.subjects.length === 0) {
          hasError = true;
      }

      sem.subjects.forEach(sub => {
        if (!sub.credits || !sub.grade) {
            hasEmptyFields = true;
            hasError = true;
            return;
        }
        const c = parseFloat(sub.credits);
        const g = parseFloat(sub.grade);
        
        if (isNaN(c) || isNaN(g) || c <= 0) {
          hasError = true;
        } else {
          semWeighted += c * g;
          semCredits += c;
        }
      });

      const semSgpaResult = document.getElementById(`sgpa-result-${sem.id}`);
      if (semSgpaResult) {
        if (hasError || semCredits === 0) {
          semSgpaResult.innerHTML = hasEmptyFields ? '<span style="color: var(--text-secondary); font-size: 0.9em;">Incomplete</span>' : '<span style="color: var(--badge-red-text, #991b1b)">⚠ Error</span>';
          anyCgpaError = true;
        } else {
          const sgpa = semWeighted / semCredits;
          semSgpaResult.innerHTML = `SGPA: <strong class="cgpa-score">${sgpa.toFixed(2)}</strong> <span class="cgpa-max">/ 10</span>`;
          
          // Add to CGPA calculation
          totalCgpaWeighted += semCredits * sgpa;
          totalCgpaCredits += semCredits;
        }
      } else {
          anyCgpaError = true;
      }
    });

    if (overallCgpaResult) {
      if (semesters.length === 0) {
          overallCgpaResult.innerHTML = '—';
      } else if (anyCgpaError || totalCgpaCredits === 0) {
          overallCgpaResult.innerHTML = '<span style="color: var(--text-secondary);">Fill all fields to calculate CGPA</span>';
      } else {
          const cgpa = totalCgpaWeighted / totalCgpaCredits;
          overallCgpaResult.innerHTML = `CGPA: <strong class="cgpa-score" style="font-size: 2rem;">${cgpa.toFixed(2)}</strong> <span class="cgpa-max">/ 10</span>`;
      }
    }
  }

  function renderSemester(semester, index) {
    const card = document.createElement('div');
    card.className = 'card semester-card';
    card.dataset.id = semester.id;
    card.style.marginBottom = '1.5rem';
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 class="card-title" style="margin-bottom: 0;">Semester ${index + 1}</h2>
        <button class="icon-btn remove-sem-btn" title="Remove semester" style="color: var(--badge-red-text, #991b1b);">
          <i class="ph ph-trash"></i>
        </button>
      </div>
      <div class="cgpa-header-row">
        <span class="cgpa-col-label">Subject</span>
        <span class="cgpa-col-label">Credits</span>
        <span class="cgpa-col-label">Grade Pts</span>
        <span></span>
      </div>
      <div class="cgpa-rows"></div>
      <div class="cgpa-actions">
        <button class="btn btn-secondary add-subject-btn">
          <i class="ph ph-plus"></i> Add Subject
        </button>
      </div>
      <div class="cgpa-result-box" style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
        <span id="sgpa-result-${semester.id}">—</span>
      </div>
    `;

    const rowsContainer = card.querySelector('.cgpa-rows');
    
    semester.subjects.forEach(sub => {
      rowsContainer.appendChild(renderSubjectRow(sub));
    });

    // Add subject
    card.querySelector('.add-subject-btn').addEventListener('click', () => {
      rowsContainer.appendChild(renderSubjectRow({ id: generateId(), name: '', credits: '', grade: '' }));
      updateStateAndRender();
    });

    // Remove semester
    card.querySelector('.remove-sem-btn').addEventListener('click', () => {
      card.remove();
      // Re-render all to update semester numbers
      const state = getState();
      save(state);
      renderAll();
    });

    return card;
  }

  function renderSubjectRow(subject) {
    const div = document.createElement('div');
    div.className = 'cgpa-row';
    div.dataset.id = subject.id;
    div.innerHTML = `
      <input type="text" class="form-control subj-name" placeholder="e.g. Maths" value="${subject.name}">
      <input type="number" class="form-control subj-credits" placeholder="Credits" min="1" max="10" value="${subject.credits}">
      <input type="number" class="form-control subj-grade" placeholder="Grade pts" min="0" max="10" step="0.1" value="${subject.grade}">
      <button class="icon-btn delete-btn remove-row-btn" title="Remove subject">
        <i class="ph ph-trash"></i>
      </button>
    `;

    div.querySelector('.remove-row-btn').addEventListener('click', () => {
      div.remove();
      updateStateAndRender();
    });

    div.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', updateStateAndRender);
    });

    return div;
  }

  function renderAll() {
    semestersContainer.innerHTML = '';
    const semesters = load();
    semesters.forEach((sem, index) => {
      semestersContainer.appendChild(renderSemester(sem, index));
    });
    calculateAndDisplay(semesters);
  }

  addSemesterBtn?.addEventListener('click', () => {
    const state = getState();
    state.push({ id: generateId(), subjects: [{ id: generateId(), name: '', credits: '', grade: '' }] });
    save(state);
    renderAll();
  });

  renderAll();
})();
