// cgpa.js — API-backed academic records with a local offline cache

(function () {
  const Scholaris = window.Scholaris;
  const { createId, escapeHtml } = window.ScholarisUtils;
  const { calculateCGPA, validateCredits, validateGrade, validateSubjectName } = Scholaris.utils.business;
  const ScholarisStateApi = window.ScholarisStateApi;
  const ScholarisApi = window.ScholarisApi;
  const semestersContainer = document.getElementById('semesters-container');
  const addSemesterBtn = document.getElementById('add-semester-btn');
  const saveCgpaBtn = document.getElementById('save-cgpa-btn');
  const overallCgpaResult = document.getElementById('overall-cgpa-result');
  let backendSyncTimer = null;

  if (!semestersContainer) return;

  function load() {
    if (Array.isArray(ScholarisStateApi.get('academicRecords'))) return ScholarisStateApi.get('academicRecords');
    return [{ id: createId('semester'), subjects: [{ id: createId('subject'), name: '', credits: '', grade: '' }] }];
  }

  function save(data) {
    ScholarisStateApi.set('academicRecords', data, { persist: true });
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
    if (ScholarisApi?.isAuthenticated()) {
      clearTimeout(backendSyncTimer);
      backendSyncTimer = setTimeout(syncToBackend, 500);
    }
  }

  function calculateAndDisplay(semesters) {
    const calculation = calculateCGPA(semesters);
    calculation.perSemester.forEach((result, index) => {
      const sem = semesters[index];
      const semSgpaResult = document.getElementById(`sgpa-result-${sem.id}`);
      if (semSgpaResult) {
        if (!result.valid) {
          const hasEmptyFields = sem.subjects.some(subject => subject.credits === '' || subject.grade === '');
          semSgpaResult.textContent = hasEmptyFields ? 'Incomplete' : '⚠ Error';
        } else {
          semSgpaResult.textContent = `SGPA: ${result.sgpa.toFixed(2)} / 10`;
        }
      }
    });

    if (overallCgpaResult) {
      if (semesters.length === 0) {
          overallCgpaResult.textContent = '—';
      } else if (!calculation.valid) {
          overallCgpaResult.textContent = 'Fill all fields to calculate CGPA';
      } else {
          overallCgpaResult.textContent = `CGPA: ${calculation.cgpa.toFixed(2)} / 10`;
      }
    }
  }

  function renderSemester(semester, index) {
    const card = document.createElement('div');
    card.className = 'card semester-card';
    card.dataset.id = semester.id;
    if (semester.serverId) card.dataset.serverId = semester.serverId;
    card.dataset.semesterNumber = semester.semesterNumber || index + 1;
    
    card.innerHTML = `
      <div class="semester-header">
        <div>
          <input class="form-control semester-name" aria-label="Semester name" value="${escapeHtml(semester.name || `Semester ${index + 1}`)}">
          <input class="form-control semester-year" aria-label="Academic year" value="${escapeHtml(semester.academicYear || new Date().getFullYear().toString())}">
        </div>
        <button class="icon-btn remove-sem-btn danger-action" title="Remove semester">
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
      <div class="cgpa-result-box">
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
      rowsContainer.appendChild(renderSubjectRow({ id: createId('subject'), name: '', credits: '', grade: '' }));
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
    const nameInput = div.querySelector('.subj-name');

    function validateRow() {
      let rowValid = true;

      if (!validateSubjectName(nameInput.value)) {
        Validate.setError(nameInput, 'Subject name is required.');
        rowValid = false;
      } else {
        Validate.clearError(nameInput);
      }

      // Validate credits
      if (creditsInput.value !== '' && !validateCredits(creditsInput.value)) {
        Validate.setError(creditsInput, 'Credits must be greater than 0 and no more than 30.');
        rowValid = false;
      } else {
        Validate.clearError(creditsInput);
      }

      // Validate grade points
      if (gradeInput.value !== '' && !validateGrade(gradeInput.value)) {
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
    semestersContainer.replaceChildren();
    try {
      const semesters = load();

      if (semesters.length === 0) {
        const ul = document.createElement('ul');
        ul.className = 'mock-list';
        ul.innerHTML = Scholaris.utils.states.empty(
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
        if (overallCgpaResult) overallCgpaResult.textContent = '—';
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
            ${Scholaris.utils.states.error(
              "Couldn't load your CGPA data.",
              'cgpa-retry-btn'
            )}
          </ul>
        </div>`;
      document.getElementById('cgpa-retry-btn')?.addEventListener('click', renderAll);
    }
  }

  // Expose for retry button
  Scholaris.utils.render = Scholaris.utils.render || {};
  Scholaris.utils.render.cgpa = renderAll;

  async function hydrateFromBackend() {
    if (!ScholarisApi?.isAuthenticated()) return;
    try {
      const records = await ScholarisApi.getAcademicRecords();
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
      ScholarisStateApi.set('academicRecords', semesters, { persist: true });
      renderAll();
    } catch (error) {
      console.warn('Could not load academic records:', error);
    }
  }

  async function syncToBackend() {
    if (!ScholarisApi?.isAuthenticated()) {
      Scholaris.utils.toast?.('Connect your account before saving academic records.', 'error');
      return;
    }
    saveCgpaBtn.disabled = true;
    try {
      for (const semester of getState()) {
        let semesterId = semester.serverId;
        if (!semesterId) {
          const created = await ScholarisApi.createAcademicSemester({
            name: semester.name,
            semester_number: semester.semesterNumber,
            academic_year: semester.academicYear
          });
          semesterId = created.id;
        }
        for (const subject of semester.subjects) {
          if (!subject.name || !subject.credits || subject.grade === '') continue;
          const payload = { name: subject.name, code: subject.code || subject.name.slice(0, 20).toUpperCase(), credits: Number(subject.credits), grade: Number(subject.grade) };
          if (subject.serverId) await ScholarisApi.updateAcademicCourse(subject.serverId, payload);
          else await ScholarisApi.createAcademicCourse(semesterId, payload);
        }
      }
      await hydrateFromBackend();
      Scholaris.utils.toast?.('Academic records saved to your account.');
    } catch (error) {
      Scholaris.utils.toast?.(error.message, 'error');
    } finally {
      saveCgpaBtn.disabled = false;
    }
  }

  saveCgpaBtn?.addEventListener('click', syncToBackend);
  Scholaris.events?.on('auth-changed', hydrateFromBackend);
  document.getElementById('target-cgpa-btn')?.addEventListener('click', async () => {
    const result = document.getElementById('target-cgpa-result');
    if (!ScholarisApi?.isAuthenticated()) {
      if (result) result.textContent = 'Connect your account to use the target CGPA planner.';
      Scholaris.utils.toast?.('Please connect your account to calculate target SGPA.', 'info');
      return;
    }
    const targetInput = document.getElementById('target-cgpa-input');
    const creditsInput = document.getElementById('target-credits-input');
    const targetCgpa = Number(targetInput?.value);
    const credits = Number(creditsInput?.value);

    if (!targetCgpa || targetCgpa <= 0 || targetCgpa > 10) {
      if (result) result.textContent = 'Please enter a target CGPA between 0.01 and 10.00.';
      targetInput?.focus();
      return;
    }
    if (!credits || credits <= 0) {
      if (result) result.textContent = 'Please enter valid next-semester credits (> 0).';
      creditsInput?.focus();
      return;
    }

    try {
      const data = await ScholarisApi.calculateTargetCgpa({
        target_cgpa: targetCgpa,
        next_semester_credits: credits
      });
      result.textContent = data.possible
        ? `You need approximately ${data.required_sgpa.toFixed(2)} SGPA next semester.`
        : `A ${data.required_sgpa.toFixed(2)} SGPA is outside the 0-10 scale.`;
    } catch (error) {
      result.textContent = error.message;
    }
  });

  addSemesterBtn?.addEventListener('click', () => {
    const records = getState();
    records.push({ id: createId('semester'), name: `Semester ${records.length + 1}`, academicYear: new Date().getFullYear().toString(), semesterNumber: records.length + 1, subjects: [{ id: createId('subject'), name: '', credits: '', grade: '' }] });
    save(records);
    renderAll();
  });

  renderAll();
})();
