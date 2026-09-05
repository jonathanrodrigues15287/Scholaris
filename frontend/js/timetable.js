/**
 * timetable.js
 * Upload a PDF or image of the timetable -> OCR via Tesseract.js -> editable weekly grid.
 * PDF rendering uses PDF.js loaded from CDN (lazy-loaded on first PDF upload).
 */

(() => {
  /* Constants */
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_ABBREV = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
  };
  const STORAGE_KEY = 'scholaris_timetable_v1';

  /* DOM refs */
  const uploadZone   = document.getElementById('tt-upload-zone');
  const fileInput    = document.getElementById('tt-file-input');
  const progressWrap = document.getElementById('tt-progress-wrap');
  const progressBar  = document.getElementById('tt-progress-bar');
  const progressLbl  = document.getElementById('tt-progress-label');
  const output       = document.getElementById('tt-output');
  const gridHead     = document.getElementById('tt-grid-head');
  const gridBody     = document.getElementById('tt-grid-body');
  const saveBtn      = document.getElementById('tt-save-btn');
  const reuploadBtn  = document.getElementById('tt-reupload-btn');
  const addSlotBtn   = document.getElementById('tt-add-slot-btn');

  // Modal elements
  const modalOverlay = document.getElementById('tt-modal-overlay');
  const modalForm = document.getElementById('tt-modal-form');
  const modalTitle = document.getElementById('tt-modal-title');
  const modalId = document.getElementById('tt-modal-id');
  const modalSubject = document.getElementById('tt-modal-subject');
  const modalDay = document.getElementById('tt-modal-day');
  const modalStart = document.getElementById('tt-modal-start');
  const modalEnd = document.getElementById('tt-modal-end');
  const modalRoom = document.getElementById('tt-modal-room');
  const modalFaculty = document.getElementById('tt-modal-faculty');
  const modalColorVal = document.getElementById('tt-modal-color-value');
  const modalColors = document.querySelectorAll('.color-btn');
  const modalSaveBtn = document.getElementById('tt-modal-save');
  const modalCancelBtn = document.getElementById('tt-modal-cancel');
  const modalDeleteBtn = document.getElementById('tt-modal-delete');
  const modalDuplicateBtn = document.getElementById('tt-modal-duplicate');
  const modalWarning = document.getElementById('tt-modal-conflict-warning');
  const modalWarningText = document.getElementById('tt-modal-conflict-text');

  /* State: schedule = Array<{ id, subject, day, startTime, endTime, room, faculty, color }> */
  let schedule   = [];
  let activeDays = [...DAYS];

  /* ===== 1. UPLOAD ZONE ===== */
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) processFile(fileInput.files[0]); });
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  });
  reuploadBtn.addEventListener('click', () => { output.hidden = true; uploadZone.hidden = false; fileInput.value = ''; });
  saveBtn.addEventListener('click', saveSchedule);
  addSlotBtn.addEventListener('click', addTimeSlot);

  /* ===== 2. FILE PROCESSING PIPELINE ===== */
  async function processFile(file) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImg = file.type.startsWith('image/');
    if (!isPdf && !isImg) { showError('Unsupported file type. Please upload a PDF or image.'); return; }

    uploadZone.hidden   = true;
    progressWrap.hidden = false;
    output.hidden       = true;
    // Show loading state in dashboard Up Next while OCR is running
    const upNextList = document.getElementById('dashboard-up-next');
    if (upNextList) upNextList.innerHTML = window.States.loading('Scanning timetable...');
    setProgress(0, 'Reading file...');

    try {
      const canvas = isPdf ? await renderPdfToCanvas(file) : await renderImageToCanvas(file);
      setProgress(30, 'Starting OCR engine...');
      const rawText = await runOcr(canvas);
      setProgress(85, 'Parsing schedule...');
      const parsed  = parseSchedule(rawText);
      schedule      = parsed.schedule;
      activeDays    = parsed.days.length ? parsed.days : [...DAYS];
      setProgress(100, 'Done!');
      await sleep(400);
      progressWrap.hidden = true;
      renderGrid();
      output.hidden = false;
    } catch (err) {
      console.error('[timetable.js]', err);
      showError('Processing failed: ' + err.message);
      progressWrap.hidden = true;
      uploadZone.hidden   = false;
    }
  }

  /* ===== 3. PDF -> CANVAS ===== */
  async function renderPdfToCanvas(file) {
    setProgress(10, 'Loading PDF renderer...');
    await loadPdfJs();
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    setProgress(20, 'Rendering PDF page...');
    const pdf      = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const page     = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas   = document.createElement('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }
  function loadPdfJs() {
    if (window['pdfjs-dist/build/pdf']) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = res; s.onerror = () => rej(new Error('Failed to load PDF.js'));
      document.head.appendChild(s);
    });
  }

  /* ===== 4. IMAGE -> CANVAS ===== */
  function renderImageToCanvas(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const scale  = Math.max(1, Math.min(3, 2000 / Math.max(img.width, img.height)));
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        res(canvas);
      };
      img.onerror = () => rej(new Error('Could not load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /* ===== 5. TESSERACT OCR ===== */
  async function runOcr(canvas) {
    await loadTesseract();
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          setProgress(30 + Math.round(m.progress * 55), 'OCR in progress... ' + Math.round(m.progress * 100) + '%');
        }
      }
    });
    const { data: { text } } = await worker.recognize(canvas);
    await worker.terminate();
    return text;
  }
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = res; s.onerror = () => rej(new Error('Failed to load Tesseract.js'));
      document.head.appendChild(s);
    });
  }

  /* ===== 6. TEXT PARSER ===== */
  function parseSchedule(text) {
    const lines        = text.split('\n').map(l => l.trim()).filter(Boolean);
    const detectedDays = detectDays(lines);
    const slots        = [];
    const timeRe       = /\b(\d{1,2}[:.]\d{2}\s*(?:AM|PM|am|pm)?(?:\s*[-]\s*\d{1,2}[:.]\d{2}\s*(?:AM|PM|am|pm)?)?)/i;
    let currentTime = null, currentDay = null, dayBuffer = {};

    const flushBuffer = () => {
      if (currentTime && Object.keys(dayBuffer).length) {
        const ex = slots.find(s => s.time === currentTime);
        if (ex) Object.assign(ex.slots, dayBuffer);
        else slots.push({ time: currentTime, slots: { ...dayBuffer } });
      }
      dayBuffer = {};
    };

    for (const line of lines) {
      const dayKey = isDayLine(line);
      if (dayKey) { flushBuffer(); currentDay = dayKey; currentTime = null; continue; }
      const tm = line.match(timeRe);
      if (tm) {
        flushBuffer();
        currentTime = normaliseTime(tm[0]);
        const rest  = line.replace(tm[0], '').replace(/[|:]/g, '').trim();
        if (rest) {
          if (currentDay) dayBuffer[currentDay] = rest;
          else { const p = splitByDayColumns(rest, detectedDays); if (Object.keys(p).length) Object.assign(dayBuffer, p); }
        }
        continue;
      }
      if (currentTime) {
        if (currentDay) { dayBuffer[currentDay] = ((dayBuffer[currentDay] || '') + ' ' + line).trim(); }
        else { const p = splitByDayColumns(line, detectedDays); for (const [d,v] of Object.entries(p)) dayBuffer[d] = ((dayBuffer[d]||'')+' '+v).trim(); }
      }
    }
    flushBuffer();

    for (const row of slots) {
      for (const d of Object.keys(row.slots)) {
        row.slots[d] = row.slots[d].replace(/\s+/g, ' ').trim();
        if (row.slots[d].length < 2) delete row.slots[d];
      }
    }
    const clean = slots.filter(s => Object.values(s.slots).some(v => v));
    const finalSlots = clean.length ? clean : buildEmptyScaffold(detectedDays).schedule;
    
    // Convert to flat events
    const flatEvents = [];
    finalSlots.forEach(row => {
      const parts = row.time.split('-');
      const start = parseTimeTo24H(parts[0] || '09:00');
      const end = parts.length > 1 ? parseTimeTo24H(parts[1]) : addHourTo24H(start);
      for (const [day, subject] of Object.entries(row.slots)) {
        if (subject) {
          flatEvents.push({
            id: 'tt_' + Math.random().toString(36).substr(2, 9),
            subject, day, startTime: start, endTime: end, room: '', faculty: '', color: 'blue'
          });
        }
      }
    });
    return { schedule: flatEvents, days: detectedDays };
  }

  function parseTimeTo24H(t) {
    if (!t) return '09:00';
    const match = t.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM|am|pm)?/i);
    if (!match) return '09:00';
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }

  function addHourTo24H(time24) {
    let [h, m] = time24.split(':').map(Number);
    h = (h + 1) % 24;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  function detectDays(lines) {
    const found = [];
    for (const line of lines)
      for (const w of line.split(/\s+/)) {
        const key = w.toLowerCase().replace(/[^a-z]/g,'');
        const day = DAY_ABBREV[key];
        if (day && !found.includes(day)) found.push(day);
      }
    return found.length ? found : [...DAYS];
  }
  function isDayLine(line) { return DAY_ABBREV[line.toLowerCase().replace(/[^a-z]/g,'')] || null; }
  function splitByDayColumns(text, days) {
    const result = {};
    const pat = days.map(d => '(?:' + d + '|' + d.slice(0,3) + ')').join('|');
    if (!pat) return result;
    const matches = [...text.matchAll(new RegExp('('+pat+')','gi'))];
    matches.forEach((m,i) => {
      const dayName = DAY_ABBREV[m[1].toLowerCase()] || m[1];
      const val = text.slice(m.index + m[0].length, matches[i+1] ? matches[i+1].index : text.length).replace(/[|:]/g,'').trim();
      if (val) result[dayName] = val;
    });
    return result;
  }
  function normaliseTime(t) { return t.replace(/\s+/g,' ').trim().toUpperCase(); }
  function buildEmptyScaffold(days) {
    const times = ['8:00 AM - 9:00 AM','9:00 AM - 10:00 AM','10:00 AM - 11:00 AM',
                   '11:00 AM - 12:00 PM','12:00 PM - 1:00 PM','1:00 PM - 2:00 PM',
                   '2:00 PM - 3:00 PM','3:00 PM - 4:00 PM'];
    return { schedule: times.map(time => ({ time, slots: {} })), days: days.length ? days : [...DAYS] };
  }

  /* ===== 7. GRID RENDERER ===== */
  function renderGrid() {
    gridHead.innerHTML = '';
    const trH = document.createElement('tr');
    const th0 = document.createElement('th'); th0.textContent = 'Time'; th0.className = 'tt-th-time'; trH.appendChild(th0);
    for (const day of activeDays) { const th = document.createElement('th'); th.textContent = day; trH.appendChild(th); }
    gridHead.appendChild(trH);

    gridBody.innerHTML = '';

    // 1. Find all unique time blocks
    const timeBlocks = new Set();
    schedule.forEach(e => timeBlocks.add(`${e.startTime}-${e.endTime}`));
    // Sort time blocks chronologically
    const sortedBlocks = Array.from(timeBlocks).sort((a, b) => a.localeCompare(b));

    if (sortedBlocks.length === 0) {
      gridBody.innerHTML = `<tr><td colspan="${activeDays.length + 1}" style="text-align: center; padding: 2rem;">No classes scheduled. Click 'Add Time Slot' below.</td></tr>`;
      return;
    }

    sortedBlocks.forEach(block => {
      const [start, end] = block.split('-');
      const tr = document.createElement('tr');
      
      const tdT = document.createElement('td'); 
      tdT.className = 'tt-td-time';
      tdT.innerHTML = `<div style="font-weight: 500;">${format12H(start)}</div><div style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.8;">${format12H(end)}</div>`;
      tr.appendChild(tdT);

      for (const day of activeDays) {
        const td = document.createElement('td'); 
        td.className = 'tt-td-slot';
        
        // Find events for this day and time block
        const events = schedule.filter(e => e.day === day && e.startTime === start && e.endTime === end);
        
        if (events.length > 0) {
          events.forEach(e => td.appendChild(buildEventChip(e)));
        } else {
          td.appendChild(buildEmptyChip(day, start, end));
        }
        tr.appendChild(td);
      }
      gridBody.appendChild(tr);
    });
  }

  function format12H(time24) {
    if (!time24) return '';
    let [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div'); div.appendChild(document.createTextNode(str)); return div.innerHTML;
  }

  function buildEventChip(event) {
    const wrap = document.createElement('div');
    wrap.className = `tt-chip tt-chip-${event.color || 'blue'}`;
    wrap.innerHTML = `
      <div style="font-weight: 600; font-size: 0.85rem;">${escapeHtml(event.subject)}</div>
      ${event.room ? `<div style="font-size: 0.7rem; opacity: 0.85; margin-top: 2px;"><i class="ph ph-map-pin"></i> ${escapeHtml(event.room)}</div>` : ''}
    `;
    wrap.addEventListener('click', () => openModal(event.id));
    return wrap;
  }

  function buildEmptyChip(day, start, end) {
    const wrap = document.createElement('div');
    wrap.className = 'tt-chip tt-chip-empty';
    wrap.innerHTML = `<span>+ Add</span>`;
    wrap.addEventListener('click', () => openModal(null, day, start, end));
    return wrap;
  }

  /* ===== MODAL LOGIC ===== */
  function openModal(id = null, day = 'Monday', start = '09:00', end = '10:00') {
    Validate.clearAll(modalForm);
    if (modalWarning) modalWarning.hidden = true;
    
    if (id) {
      const e = schedule.find(x => x.id === id);
      if (!e) return;
      modalTitle.innerHTML = `<i class="ph-fill ph-pencil-simple" aria-hidden="true"></i> Edit Class Event`;
      modalId.value = e.id;
      modalSubject.value = e.subject;
      modalDay.value = e.day;
      modalStart.value = e.startTime;
      modalEnd.value = e.endTime;
      modalRoom.value = e.room || '';
      modalFaculty.value = e.faculty || '';
      setColor(e.color || 'blue');
      if (modalDeleteBtn) modalDeleteBtn.hidden = false;
      if (modalDuplicateBtn) modalDuplicateBtn.hidden = false;
    } else {
      modalTitle.innerHTML = `<i class="ph-fill ph-calendar-plus" aria-hidden="true"></i> Add Class Event`;
      modalId.value = '';
      modalSubject.value = '';
      modalDay.value = day;
      modalStart.value = start;
      modalEnd.value = end;
      modalRoom.value = '';
      modalFaculty.value = '';
      setColor('blue');
      if (modalDeleteBtn) modalDeleteBtn.hidden = true;
      if (modalDuplicateBtn) modalDuplicateBtn.hidden = true;
    }
    
    modalOverlay.classList.remove('hidden');
    modalSubject.focus();
  }

  function setColor(color) {
    modalColorVal.value = color;
    modalColors.forEach(b => {
      b.classList.toggle('active', b.dataset.color === color);
      b.style.borderColor = b.dataset.color === color ? 'var(--text-primary)' : 'transparent';
    });
  }

  modalColors.forEach(btn => btn.addEventListener('click', () => setColor(btn.dataset.color)));

  function closeModal() {
    modalOverlay.classList.add('hidden');
  }

  modalCancelBtn?.addEventListener('click', closeModal);
  modalOverlay?.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

  // Conflict Detection
  function checkConflicts() {
    const id = modalId.value;
    const day = modalDay.value;
    const start = modalStart.value;
    const end = modalEnd.value;
    
    if (!start || !end || !modalWarning) return;

    const overlap = schedule.find(e => {
      if (e.id === id) return false;
      if (e.day !== day) return false;
      // Overlap logic: start1 < end2 AND end1 > start2
      return (start < e.endTime) && (end > e.startTime);
    });

    if (overlap) {
      modalWarningText.innerHTML = `<strong>Conflict:</strong> Overlaps with ${escapeHtml(overlap.subject)} (${format12H(overlap.startTime)} - ${format12H(overlap.endTime)}).`;
      modalWarning.hidden = false;
    } else {
      modalWarning.hidden = true;
    }
  }

  [modalDay, modalStart, modalEnd].forEach(el => el?.addEventListener('change', checkConflicts));
  modalSubject.addEventListener('input', () => Validate.clearError(modalSubject));

  modalForm?.addEventListener('submit', () => {
    const id = modalId.value;
    const subject = modalSubject.value.trim();
    const day = modalDay.value;
    const startTime = modalStart.value;
    const endTime = modalEnd.value;
    
    if (startTime >= endTime) {
      Validate.setError(modalEnd, 'End time must be after start time.');
      return;
    }

    const eventData = {
      subject, day, startTime, endTime,
      room: modalRoom.value.trim(),
      faculty: modalFaculty.value.trim(),
      color: modalColorVal.value
    };

    if (id) {
      const idx = schedule.findIndex(e => e.id === id);
      if (idx > -1) schedule[idx] = { ...schedule[idx], ...eventData };
    } else {
      eventData.id = 'tt_' + Math.random().toString(36).substr(2, 9);
      schedule.push(eventData);
    }

    closeModal();
    renderGrid();
  });

  modalDeleteBtn?.addEventListener('click', () => {
    schedule = schedule.filter(e => e.id !== modalId.value);
    closeModal();
    renderGrid();
  });

  modalDuplicateBtn?.addEventListener('click', () => {
    const e = schedule.find(x => x.id === modalId.value);
    if (!e) return;
    const copy = { ...e, id: 'tt_' + Math.random().toString(36).substr(2, 9) };
    schedule.push(copy);
    closeModal();
    renderGrid();
    if (window.showToast) window.showToast('Class duplicated! You can now click it to edit the day or time.');
  });

  /* ===== 8. ADD / SAVE / LOAD ===== */
  function addTimeSlot() {
    openModal(null, 'Monday', '09:00', '10:00');
  }

  function saveSchedule() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schedule, activeDays }));
    const orig = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="ph ph-check"></i> Saved!';
    saveBtn.classList.add('btn-saved');
    setTimeout(() => { saveBtn.innerHTML = orig; saveBtn.classList.remove('btn-saved'); }, 2000);
    updateDashboard();
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const { schedule: s, activeDays: d } = parsed;
        if (Array.isArray(s) && s.length) {
          // Migration from old array-of-rows format to flat events format
          if (s[0].slots) {
            console.log('Migrating old schedule format...');
            const flatEvents = [];
            s.forEach(row => {
              const parts = row.time.split('-');
              const start = parseTimeTo24H(parts[0] || '09:00');
              const end = parts.length > 1 ? parseTimeTo24H(parts[1]) : addHourTo24H(start);
              for (const [day, subject] of Object.entries(row.slots)) {
                if (subject) {
                  flatEvents.push({
                    id: 'tt_' + Math.random().toString(36).substr(2, 9),
                    subject, day, startTime: start, endTime: end, room: '', faculty: '', color: 'blue'
                  });
                }
              }
            });
            schedule = flatEvents;
          } else {
            schedule = s;
          }
          activeDays = d || [...DAYS];
          uploadZone.hidden = true; renderGrid(); output.hidden = false;
        }
      }
    } catch (_) {}
    updateDashboard();
  }

  function updateDashboard() {
    const list = document.getElementById('dashboard-up-next');
    if (!list) return;

    if (!schedule || schedule.length === 0) {
      list.innerHTML = window.States.empty(
        'ph ph-calendar-blank',
        'No timetable yet',
        'Upload your timetable to see upcoming classes here.',
        `<button class="btn btn-secondary" onclick="document.querySelector('[data-target=timetable]').click()">
           <i class="ph ph-arrow-right" aria-hidden="true"></i> Go to Timetable
         </button>`
      );
      return;
    }

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let upcoming = [];
    let lookaheadDays = 0;
    
    while (lookaheadDays < 7) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() + lookaheadDays);
      const targetDayStr = targetDate.toLocaleDateString('en-US', { weekday: 'long' });

      const dayEvents = schedule.filter(e => e.day === targetDayStr);
      
      dayEvents.forEach(e => {
        const [h, m] = e.startTime.split(':').map(Number);
        const startMins = h * 60 + m;
        const [eh, em] = e.endTime.split(':').map(Number);
        const endMins = eh * 60 + em;

        if (lookaheadDays === 0) {
          if (endMins > currentMins) {
            upcoming.push({ ...e, startMins, dayLabel: "Today" });
          }
        } else {
          upcoming.push({ ...e, startMins, dayLabel: lookaheadDays === 1 ? "Tomorrow" : targetDayStr });
        }
      });

      if (upcoming.length > 0) break;
      lookaheadDays++;
    }

    upcoming.sort((a, b) => a.startMins - b.startMins);

    if (upcoming.length === 0) {
      list.innerHTML = window.States.empty(
        'ph ph-sun-horizon',
        'No classes today',
        'Enjoy your free time! Check back tomorrow.'
      );
    } else {
      list.innerHTML = upcoming.slice(0, 3).map(u => `
        <li class="mock-list-item">
          <div>
            <strong>${escapeHtml(u.subject)}</strong>
            <span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 6px;">(${u.dayLabel})</span>
            ${u.room ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;"><i class="ph ph-map-pin"></i> ${escapeHtml(u.room)}</div>` : ''}
          </div>
          <span class="badge badge-${u.color || 'blue'}">${format12H(u.startTime)} - ${format12H(u.endTime)}</span>
        </li>
      `).join('');
    }
  }

  /* ===== 9. UTILITIES ===== */
  function setProgress(pct, label) { progressBar.style.width = pct + '%'; progressLbl.textContent = label; }
  function showError(msg) {
    progressWrap.hidden = true; uploadZone.hidden = false;
    uploadZone.querySelector('.tt-error-msg')?.remove();
    const p = document.createElement('p'); p.className = 'tt-error-msg'; p.textContent = msg;
    uploadZone.appendChild(p);
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* Init */
  loadSaved();
})();
