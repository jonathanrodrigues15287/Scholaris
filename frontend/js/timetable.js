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
  const modalSubtitle = document.getElementById('tt-modal-subtitle');
  const modalSubject = document.getElementById('tt-modal-subject');
  const modalRi = document.getElementById('tt-modal-ri');
  const modalDay = document.getElementById('tt-modal-day');
  const modalSaveBtn = document.getElementById('tt-modal-save');
  const modalCancelBtn = document.getElementById('tt-modal-cancel');
  const modalDeleteBtn = document.getElementById('tt-modal-delete');

  /* State: schedule = Array<{ time: string, slots: { [day]: string } }> */
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
    if (!clean.length) return buildEmptyScaffold(detectedDays);
    return { schedule: clean, days: detectedDays };
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
    const tr = document.createElement('tr');
    const th0 = document.createElement('th'); th0.textContent = 'Time'; th0.className = 'tt-th-time'; tr.appendChild(th0);
    for (const day of activeDays) { const th = document.createElement('th'); th.textContent = day; tr.appendChild(th); }
    gridHead.appendChild(tr);
    gridBody.innerHTML = '';
    for (let i = 0; i < schedule.length; i++) gridBody.appendChild(buildRow(i));
  }

  function buildRow(ri) {
    const row = schedule[ri];
    const tr  = document.createElement('tr');
    const tdT = document.createElement('td'); tdT.className = 'tt-td-time';
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = row.time;
    inp.className = 'tt-time-input'; inp.setAttribute('aria-label','Time slot');
    inp.addEventListener('change', () => { schedule[ri].time = inp.value.trim(); });
    const del = document.createElement('button'); del.className = 'tt-del-row-btn icon-btn'; del.title = 'Remove row';
    del.setAttribute('aria-label','Remove time slot'); del.innerHTML = '<i class="ph ph-trash"></i>';
    del.addEventListener('click', () => { schedule.splice(ri,1); renderGrid(); });
    tdT.appendChild(inp); tdT.appendChild(del); tr.appendChild(tdT);
    for (const day of activeDays) {
      const td = document.createElement('td'); td.className = 'tt-td-slot';
      td.appendChild(buildChip(row.slots[day] || '', ri, day)); tr.appendChild(td);
    }
    return tr;
  }

  function buildChip(text, ri, day) {
    const wrap = document.createElement('div');
    wrap.className = text ? 'tt-chip' : 'tt-chip tt-chip-empty';
    const span = document.createElement('span'); 
    span.textContent = text || '+ Add'; 
    wrap.appendChild(span);
    
    wrap.addEventListener('click', () => {
      openModal(ri, day);
    });
    return wrap;
  }

  function openModal(ri, day) {
    modalRi.value = ri;
    modalDay.value = day;
    modalSubtitle.textContent = `${day} - ${schedule[ri].time}`;
    modalSubject.value = schedule[ri].slots[day] || '';
    modalOverlay.classList.remove('hidden');
    modalSubject.focus();
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
  }

  modalCancelBtn?.addEventListener('click', closeModal);
  
  modalSaveBtn?.addEventListener('click', () => {
    const ri = parseInt(modalRi.value, 10);
    const day = modalDay.value;
    schedule[ri].slots[day] = modalSubject.value.trim();
    closeModal();
    renderGrid();
  });

  modalDeleteBtn?.addEventListener('click', () => {
    const ri = parseInt(modalRi.value, 10);
    const day = modalDay.value;
    delete schedule[ri].slots[day];
    closeModal();
    renderGrid();
  });
  
  modalOverlay?.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });

  /* ===== 8. ADD / SAVE / LOAD ===== */
  function addTimeSlot() {
    schedule.push({ time: 'HH:MM - HH:MM', slots: {} }); renderGrid();
    gridBody.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        const { schedule: s, activeDays: d } = JSON.parse(raw);
        if (Array.isArray(s) && s.length) {
          schedule = s; activeDays = d || [...DAYS];
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
      list.innerHTML = `<li class="mock-list-item empty-state"><i class="ph ph-calendar-slash"></i> No timetable saved</li>`;
      return;
    }

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    function parseTime(t) {
      const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return 0;
      let h = parseInt(match[1], 10);
      let m = parseInt(match[2], 10);
      if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }

    let upcoming = [];
    let lookaheadDays = 0;
    
    // Scan up to 7 days ahead
    while (lookaheadDays < 7) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() + lookaheadDays);
      const targetDayStr = targetDate.toLocaleDateString('en-US', { weekday: 'long' });

      for (const row of schedule) {
        if (!row.slots[targetDayStr]) continue;
        const parts = row.time.split('-');
        if (parts.length > 0) {
          const startMins = parseTime(parts[0].trim());
          let endMins = currentMins + 1;
          if (parts.length > 1) {
            endMins = parseTime(parts[1].trim());
          } else {
            endMins = startMins + 60;
          }

          if (lookaheadDays === 0) {
            if (endMins > currentMins) {
              upcoming.push({ time: row.time, subject: row.slots[targetDayStr], startMins, dayLabel: "Today" });
            }
          } else {
            upcoming.push({ time: row.time, subject: row.slots[targetDayStr], startMins, dayLabel: lookaheadDays === 1 ? "Tomorrow" : targetDayStr });
          }
        }
      }

      if (upcoming.length > 0) {
        break; // Stop looking ahead once we found classes for a day
      }
      lookaheadDays++;
    }

    upcoming.sort((a, b) => a.startMins - b.startMins);

    if (upcoming.length === 0) {
      list.innerHTML = `<li class="mock-list-item empty-state"><i class="ph ph-check-circle"></i> No upcoming classes</li>`;
    } else {
      list.innerHTML = upcoming.slice(0, 3).map(u => `
        <li class="mock-list-item">
          <div>
            <strong>${u.subject}</strong> 
            <span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 6px;">(${u.dayLabel})</span>
          </div>
          <span class="badge badge-blue">${u.time}</span>
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
