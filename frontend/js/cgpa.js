// cgpa.js — API-backed academic records with a local offline cache

(function () {
  const state = window.ScholarisState;
  const stateApi = window.ScholarisStateApi;
  const semestersContainer = document.getElementById('semesters-container');
  const addSemesterBtn = document.getElementById('add-semester-btn');
  const saveCgpaBtn = document.getElementById('save-cgpa-btn');
  const overallCgpaResult = document.getElementById('overall-cgpa-result');
  let backendSyncTimer = null;

  if (!semestersContainer) return;

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  function load() {
    if (Array.isArray(state.academicRecords)) return state.academicRecords;
    return [{ id: generateId(), subjects: [{ id: generateId(), name: '', credits: '', grade: '' }] }];
  }

  function save(data) {
    stateApi.set('academicRecords', data, { persist: true });
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
          serverId: row.dataset.serverId || undefined,
          code: row.dataset.code || undefined,
          name: row.querySelector('.subj-name').value,
          credits: row.querySelector('.subj-credits').value,
          grade: row.querySelector('.subj-grade').value,
        });
      });
      semesters.push({
        id,
        serverId: semCard.dataset.serverId || undefined,
        name: semCard.querySelector('.semester-name')?.value || `Semester ${semesters.length + 1}`,
        academicYear: semCard.querySelector('.semester-year')?.value || new Date().getFullYear().toString(),
        semesterNumber: Number(semCard.dataset.semesterNumber) || semesters.length + 1,
        subjects
      });
    });
    return semesters;
  }

  function updateStateAndRender() {
    const state = getState();
    save(state);
    calculateAndDisplay(state);
    if (window.ScholarisApi?.isAuthenticated()) {
      clearTimeout(backendSyncTimer);
      backendSyncTimer = setTimeout(syncToBackend, 500);
    }
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
        if (sub.credits === '' || sub.grade === '') {
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
    if (semester.serverId) card.dataset.serverId = semester.serverId;
    card.dataset.semesterNumber = semester.semesterNumber || index + 1;
    card.style.marginBottom = '1.5rem';
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <input class="form-control semester-name" aria-label="Semester name" value="${escapeHtml(semester.name || `Semester ${index + 1}`)}">
          <input class="form-control semester-year" aria-label="Academic year" value="${escapeHtml(semester.academicYear || new Date().getFullYear().toString())}">
        </div>
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

    card.querySelectorAll('.semester-name, .semester-year').forEach(input => {
      input.addEventListener('input', updateStateAndRender);
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function renderSubjectRow(subject) {
    const div = document.createElement('div');
    div.className = 'cgpa-row';
    div.dataset.id = subject.id;
    if (subject.serverId) div.dataset.serverId = subject.serverId;
    if (subject.code) div.dataset.code = subject.code;
    div.innerHTML = `
      <input type="text" class="form-control subj-name" placeholder="e.g. Maths" value="${escapeHtml(subject.name)}">
      <input type="number" class="form-control subj-credits" placeholder="Credits" min="0.5" max="10" step="0.5" value="${subject.credits}">
      <input type="number" class="form-control subj-grade" placeholder="Grade pts" min="0" max="10" step="0.1" value="${subject.grade}">
      <button class="icon-btn delete-btn remove-row-btn" title="Remove subject">
        <i class="ph ph-trash"></i>
      </button>
    `;

    const creditsInput = div.querySelector('.subj-credits');
    const gradeInput = div.querySelector('.subj-grade');

    function validateRow() {
      let rowValid = true;

      // Validate credits
      const c = parseFloat(creditsInput.value);
      if (creditsInput.value !== '' && (isNaN(c) || c <= 0)) {
        Validate.setError(creditsInput, 'Credits must be > 0.');
        rowValid = false;
      } else {
        Validate.clearError(creditsInput);
      }

      // Validate grade points
      const g = parseFloat(gradeInput.value);
      if (gradeInput.value !== '' && (isNaN(g) || g < 0 || g > 10)) {
        Validate.setError(gradeInput, 'Grade must be 0 – 10.');
        rowValid = false;
      } else {
        Validate.clearError(gradeInput);
      }

      return rowValid;
    }

    div.querySelector('.remove-row-btn').addEventListener('click', () => {
      div.remove();
      updateStateAndRender();
    });

    div.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        validateRow();
        updateStateAndRender();
      });
    });

    return div;
  }

  function renderAll() {
    semestersContainer.innerHTML = '';
    try {
      const semesters = load();

      if (semesters.length === 0) {
        const ul = document.createElement('ul');
        ul.className = 'mock-list';
        ul.innerHTML = window.States.empty(
          'ph ph-calculator',
          'No semesters added yet',
          'Add your first semester to start calculating your SGPA and CGPA.',
          `<button class="btn" id="cgpa-empty-add-btn">
             <i class="ph ph-plus" aria-hidden="true"></i> Add Semester
           </button>`
        );
        semestersContainer.appendChild(ul);
        // Wire up the empty-state add button
        document.getElementById('cgpa-empty-add-btn')?.addEventListener('click', () => addSemesterBtn?.click());
        if (overallCgpaResult) overallCgpaResult.innerHTML = '—';
        return;
      }

      semesters.forEach((sem, index) => {
        semestersContainer.appendChild(renderSemester(sem, index));
      });
      calculateAndDisplay(semesters);

    } catch (e) {
      console.error('CGPA renderAll error:', e);
      semestersContainer.innerHTML = `
        <div class="cgpa-empty-state">
          <ul class="mock-list">
            ${window.States.error(
              "Couldn't load your CGPA data.",
              'cgpa-retry-btn'
            )}
          </ul>
        </div>`;
      document.getElementById('cgpa-retry-btn')?.addEventListener('click', renderAll);
    }
  }

  // Expose for retry button
  window._cgpaRenderAll = renderAll;

  async function hydrateFromBackend() {
    if (!window.ScholarisApi?.isAuthenticated()) return;
    try {
      const records = await window.ScholarisApi.getAcademicRecords();
      const semesters = records.semesters.map(semester => ({
        id: `server-${semester.id}`,
        serverId: semester.id,
        name: semester.name,
        academicYear: semester.academic_year,
        semesterNumber: semester.semester_number,
        subjects: semester.courses.map(course => ({
          id: `server-${course.id}`,
          serverId: course.id,
          name: course.name,
          code: course.code,
          credits: course.credits,
          grade: course.grade ?? ''
        }))
      }));
      stateApi.set('academicRecords', semesters, { persist: true });
      renderAll();
    } catch (error) {
      console.warn('Could not load academic records:', error);
    }
  }

  async function syncToBackend() {
    if (!window.ScholarisApi?.isAuthenticated()) {
      window.showToast?.('Connect your account before saving academic records.', 'error');
      return;
    }
    saveCgpaBtn.disabled = true;
    try {
      for (const semester of getState()) {
        let semesterId = semester.serverId;
        if (!semesterId) {
          const created = await window.ScholarisApi.createAcademicSemester({
            name: semester.name,
            semester_number: semester.semesterNumber,
            academic_year: semester.academicYear
          });
          semesterId = created.id;
        }
        for (const subject of semester.subjects) {
          if (!subject.name || !subject.credits || subject.grade === '') continue;
          const payload = { name: subject.name, code: subject.code || subject.name.slice(0, 20).toUpperCase(), credits: Number(subject.credits), grade: Number(subject.grade) };
          if (subject.serverId) await window.ScholarisApi.updateAcademicCourse(subject.serverId, payload);
          else await window.ScholarisApi.createAcademicCourse(semesterId, payload);
        }
      }
      await hydrateFromBackend();
      window.showToast?.('Academic records saved to your account.');
    } catch (error) {
      window.showToast?.(error.message, 'error');
    } finally {
      saveCgpaBtn.disabled = false;
    }
  }

  saveCgpaBtn?.addEventListener('click', syncToBackend);
  window.addEventListener('scholaris:auth-changed', hydrateFromBackend);
  document.getElementById('target-cgpa-btn')?.addEventListener('click', async () => {
    const result = document.getElementById('target-cgpa-result');
    try {
      const data = await window.ScholarisApi.calculateTargetCgpa({
        target_cgpa: Number(document.getElementById('target-cgpa-input').value),
        next_semester_credits: Number(document.getElementById('target-credits-input').value)
      });
      result.textContent = data.possible
        ? `You need approximately ${data.required_sgpa.toFixed(2)} SGPA next semester.`
        : `A ${data.required_sgpa.toFixed(2)} SGPA is outside the 0-10 scale.`;
    } catch (error) {
      result.textContent = error.message;
    }
  });

  addSemesterBtn?.addEventListener('click', () => {
    const state = getState();
    state.push({ id: generateId(), name: `Semester ${state.length + 1}`, academicYear: new Date().getFullYear().toString(), semesterNumber: state.length + 1, subjects: [{ id: generateId(), name: '', credits: '', grade: '' }] });
    save(state);
    renderAll();
  });

  renderAll();
})();
