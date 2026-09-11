/**
 * timetable.js
 * Upload a PDF or image of the timetable -> OCR via Tesseract.js -> editable weekly grid.
 * PDF rendering uses PDF.js loaded from CDN (lazy-loaded on first PDF upload).
 */

(() => {
  /* Constants */
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_ABBREV = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
  };
  const state = window.ScholarisState;
  const stateApi = window.ScholarisStateApi;

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
  const searchInput = document.getElementById('tt-search');
  const courseFilter = document.getElementById('tt-course-filter');
  const roomFilter = document.getElementById('tt-room-filter');
  const facultyFilter = document.getElementById('tt-faculty-filter');
  const freeSummary = document.getElementById('tt-free-summary');

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
  let viewMode = 'week';
  let selectedViewDay = 'Monday';
  const filters = { search: '', course: '', room: '', faculty: '' };
  let resizeState = null;

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
  document.getElementById('tt-duplicate-week')?.addEventListener('click', duplicateWeek);
  document.getElementById('tt-view-mode')?.addEventListener('change', event => {
    viewMode = event.target.value;
    renderGrid();
  });
  document.getElementById('tt-view-day')?.addEventListener('change', event => {
    selectedViewDay = event.target.value;
    renderGrid();
  });
  [searchInput, courseFilter, roomFilter, facultyFilter].forEach(control => control?.addEventListener('input', () => {
    filters.search = searchInput?.value.trim().toLowerCase() || '';
    filters.course = courseFilter?.value || '';
    filters.room = roomFilter?.value || '';
    filters.faculty = facultyFilter?.value || '';
    renderGrid();
  }));
  window.addEventListener('scholaris:sync-requested', () => {
    if (window.ScholarisApi?.isAuthenticated()) loadRemoteSchedule();
  });

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
      const ocrData = await runOcr(canvas);
      setProgress(85, 'Parsing schedule...');
      const parsed  = parseSchedule(ocrData.text, ocrData);
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
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: '6'
    });
    const { data } = await worker.recognize(canvas);
    await worker.terminate();
    return data;
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
  function parseSchedule(text, ocrData = null) {
    const lines        = text.split('\n').map(l => l.trim()).filter(Boolean);
    const detectedDays = detectDays(lines);
    const spatialSchedule = parseSpatialTable(ocrData);
    if (spatialSchedule.length) {
      return { schedule: spatialSchedule, days: detectedDays };
    }
    const tableSchedule = parseDayRowTable(text);
    if (tableSchedule.length) {
      return { schedule: tableSchedule, days: detectedDays };
    }
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

  function parseSpatialTable(ocrData) {
    const words = (ocrData?.words || []).filter(word => word.text?.trim());
    if (words.length < 10) return [];

    const dayWords = words.filter(word => isDayPrefix(word.text.trim()));
    if (dayWords.length < 2) return [];
    const firstDayTop = Math.min(...dayWords.map(word => word.top));
    const timeWords = words
      .filter(word => word.top < firstDayTop && /\d{1,2}\s*[:.]\s*\d{2}/.test(word.text))
      .map(word => ({ ...word, time: parseTimeTo24H(word.text), center: word.left + word.width / 2 }));
    const columns = [];
    timeWords.sort((a, b) => a.center - b.center).forEach(word => {
      if (!columns.some(column => Math.abs(column.center - word.center) < 45)) columns.push(word);
    });
    if (columns.length < 2) return [];
    columns.sort((a, b) => a.center - b.center);

    const rows = [...dayWords]
      .sort((a, b) => a.top - b.top)
      .filter((word, index, list) => index === 0 || Math.abs(word.top - list[index - 1].top) > 12);
    const events = [];
    rows.forEach((dayWord, rowIndex) => {
      const nextRow = rows[rowIndex + 1];
      const lowerBound = nextRow ? (dayWord.top + nextRow.top) / 2 : Infinity;
      const rowWords = words.filter(word => {
        const centerY = word.top + word.height / 2;
        return centerY >= dayWord.top - 12 && centerY < lowerBound && word !== dayWord;
      });
      columns.forEach((column, columnIndex) => {
        const cellWords = rowWords
          .filter(word => {
            const wordCenter = word.left + word.width / 2;
            const nearestColumn = columns.reduce((nearest, candidate, candidateIndex) =>
              Math.abs(candidate.center - wordCenter) < Math.abs(columns[nearest].center - wordCenter)
                ? candidateIndex : nearest, 0);
            return nearestColumn === columnIndex;
          })
          .sort((a, b) => a.left - b.left || a.top - b.top);
        const subject = cleanOcrCell(cellWords.map(word => word.text).join(' '));
        if (subject.length < 2 || /^(day|time|room|class)$/i.test(subject)) return;
        events.push({
          id: 'tt_' + Math.random().toString(36).slice(2, 11),
          subject,
          day: DAY_ABBREV[dayWord.text.toLowerCase().replace(/[^a-z]/g, '')],
          startTime: column.time,
          endTime: columns[columnIndex + 1]?.time || addHourTo24H(column.time),
          room: '',
          faculty: '',
          color: 'blue'
        });
      });
    });
    return events;
  }

  // College timetables commonly use weekdays as rows and lecture times as columns.
  function parseDayRowTable(text) {
    const rawLines = text.split('\n').map(line => line.replace(/\r/g, '').trimEnd()).filter(Boolean);
    const timePattern = /(\d{1,2}\s*[:.]\s*\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?)/gi;
    const headerTimes = [];
    let firstDayIndex = -1;

    for (let index = 0; index < rawLines.length; index += 1) {
      const matches = [...rawLines[index].matchAll(timePattern)];
      if (matches.length >= 2) matches.forEach(match => headerTimes.push(parseTimeTo24H(match[1])));
      if (isDayPrefix(rawLines[index])) {
        firstDayIndex = index;
        break;
      }
    }

    const uniqueTimes = [...new Set(headerTimes)];
    if (uniqueTimes.length < 2 || firstDayIndex < 0) return [];

    const result = [];
    for (const line of rawLines.slice(firstDayIndex)) {
      const dayMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b\s*/i);
      if (!dayMatch) continue;
      const day = DAY_ABBREV[dayMatch[1].toLowerCase()];
      const cells = line.slice(dayMatch[0].length)
        .split(/\s{2,}|\|/)
        .map(cell => cleanOcrCell(cell))
        .filter(Boolean);

      cells.forEach((subject, index) => {
        if (index >= uniqueTimes.length || subject.length < 2) return;
        const startTime = uniqueTimes[index];
        result.push({
          id: 'tt_' + Math.random().toString(36).slice(2, 11),
          subject,
          day,
          startTime,
          endTime: uniqueTimes[index + 1] || addHourTo24H(startTime),
          room: '',
          faculty: '',
          color: 'blue'
        });
      });
    }
    return result;
  }

  function isDayPrefix(line) {
    return /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(line);
  }

  function cleanOcrCell(value) {
    return value.replace(/\s+/g, ' ').trim();
  }

  function parseTimeTo24H(t) {
    if (!t) return '09:00';
    const match = t.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(A\.?M\.?|P\.?M\.?)?/i);
    if (!match) return '09:00';
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = (match[3] || '').replace(/\./g, '').toUpperCase();
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
    refreshFilterOptions();
    gridHead.innerHTML = '';
    const trH = document.createElement('tr');
    const th0 = document.createElement('th'); th0.textContent = 'Time'; th0.className = 'tt-th-time'; trH.appendChild(th0);
    const visibleDays = viewMode === 'day' ? [selectedViewDay] : activeDays;
    for (const day of visibleDays) { const th = document.createElement('th'); th.textContent = day; trH.appendChild(th); }
    gridHead.appendChild(trH);

    gridBody.innerHTML = '';

    // 1. Find all unique time blocks
    const timeBlocks = new Set();
    schedule.forEach(e => timeBlocks.add(`${e.startTime}-${e.endTime}`));
    // Sort time blocks chronologically
    const sortedBlocks = Array.from(timeBlocks).sort((a, b) => a.localeCompare(b));

    if (sortedBlocks.length === 0) {
      gridBody.innerHTML = `<tr><td colspan="${visibleDays.length + 1}" style="text-align: center; padding: 2rem;">No classes scheduled. Click 'Add Time Slot' below.</td></tr>`;
      return;
    }

    sortedBlocks.forEach(block => {
      const [start, end] = block.split('-');
      const tr = document.createElement('tr');
      
      const tdT = document.createElement('td'); 
      tdT.className = 'tt-td-time';
      tdT.innerHTML = `<div style="font-weight: 500;">${format12H(start)}</div><div style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.8;">${format12H(end)}</div>`;
      tr.appendChild(tdT);

      for (const day of visibleDays) {
        const td = document.createElement('td');
        td.className = 'tt-td-slot';
        td.dataset.day = day;
        td.dataset.start = start;
        td.dataset.end = end;
        addDropTargetHandlers(td);
        
        // Find events for this day and time block
        const events = schedule.filter(e => e.day === day && e.startTime === start && e.endTime === end && matchesFilters(e));
        
        if (events.length > 0) {
          events.forEach(e => td.appendChild(buildEventChip(e)));
        } else {
          td.appendChild(buildEmptyChip(day, start, end));
        }
        tr.appendChild(td);
      }
      gridBody.appendChild(tr);
    });
    refreshGapSummary();
    refreshFreeSummary();
  }

  function matchesFilters(event) {
    const haystack = `${event.subject || ''} ${event.room || ''} ${event.faculty || ''}`.toLowerCase();
    return (!filters.search || haystack.includes(filters.search))
      && (!filters.course || event.subject === filters.course)
      && (!filters.room || event.room === filters.room)
      && (!filters.faculty || event.faculty === filters.faculty);
  }

  function refreshFilterOptions() {
    const options = [
      [courseFilter, [...new Set(schedule.map(event => event.subject).filter(Boolean))].sort()],
      [roomFilter, [...new Set(schedule.map(event => event.room).filter(Boolean))].sort()],
      [facultyFilter, [...new Set(schedule.map(event => event.faculty).filter(Boolean))].sort()]
    ];
    options.forEach(([select, values]) => {
      if (!select) return;
      const selected = select.value;
      select.innerHTML = `<option value="">All ${select === courseFilter ? 'courses' : select === roomFilter ? 'rooms' : 'faculty'}</option>`;
      values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
      select.value = values.includes(selected) ? selected : '';
    });
  }

  function addDropTargetHandlers(cell) {
    cell.addEventListener('dragover', event => {
      event.preventDefault();
      cell.classList.add('tt-drop-target');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('tt-drop-target'));
    cell.addEventListener('drop', async event => {
      event.preventDefault();
      cell.classList.remove('tt-drop-target');
      const id = event.dataTransfer.getData('text/plain');
      const item = schedule.find(entry => String(entry.id) === id);
      if (!item || (item.day === cell.dataset.day && item.startTime === cell.dataset.start)) return;
      const target = { day: cell.dataset.day, startTime: cell.dataset.start, endTime: addDuration(cell.dataset.start, duration(item)) };
      if (hasConflict({ ...item, ...target }, item.id)) {
        window.showToast?.('That move conflicts with another class.', 'error');
        return;
      }
      if (!await window.confirmAction(`Move ${item.subject} to ${target.day} at ${format12H(target.startTime)}?`, { title: 'Move class', confirmLabel: 'Move class' })) return;
      Object.assign(item, target);
      persistScheduleState();
      renderGrid();
      window.showToast?.('Class moved. Save the schedule to sync it.', 'success');
    });
  }

  function duration(event) {
    return Math.max(30, timeToMinutes(event.endTime) - timeToMinutes(event.startTime));
  }

  function timeToMinutes(value) {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
  }

  function minutesToTime(total) {
    const safe = Math.max(0, Math.min(total, 23 * 60 + 59));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }

  function addDuration(start, minutes) {
    return minutesToTime(timeToMinutes(start) + minutes);
  }

  function hasConflict(candidate, ignoredId) {
    return schedule.some(event => String(event.id) !== String(ignoredId) && event.day === candidate.day && candidate.startTime < event.endTime && candidate.endTime > event.startTime);
  }

  function persistScheduleState() {
    stateApi.set('timetable', schedule, { persist: true });
    stateApi.set('timetableActiveDays', activeDays, { persist: true, silent: true });
  }

  function refreshFreeSummary() {
    if (!freeSummary) return;
    const day = viewMode === 'day' ? selectedViewDay : new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const events = schedule.filter(event => event.day === day).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const gaps = [];
    for (let index = 1; index < events.length; index += 1) {
      const start = timeToMinutes(events[index - 1].endTime);
      const end = timeToMinutes(events[index].startTime);
      if (end - start >= 30) gaps.push(`${format12H(events[index - 1].endTime)} - ${format12H(events[index].startTime)}`);
    }
    freeSummary.textContent = gaps.length ? `${day} free periods: ${gaps.join(', ')}` : `${day}: no free period of 30 minutes between classes.`;
  }

  async function refreshGapSummary() {
    const summary = document.getElementById('tt-gap-summary');
    if (!summary) return;
    if (window.ScholarisApi?.isAuthenticated()) {
      try {
        const gaps = await window.ScholarisApi.getTimetableGaps();
        summary.textContent = gaps.length
          ? `${gaps.length} gap${gaps.length === 1 ? '' : 's'} between lectures this week.`
          : 'No gaps between lectures this week.';
        return;
      } catch (_) {}
    }
    const gaps = [];
    const byDay = {};
    schedule.forEach(event => (byDay[event.day] ||= []).push(event));
    Object.values(byDay).forEach(events => {
      events.sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let index = 1; index < events.length; index += 1) {
        if (events[index - 1].endTime < events[index].startTime) gaps.push(true);
      }
    });
    summary.textContent = gaps.length
      ? `${gaps.length} gap${gaps.length === 1 ? '' : 's'} between lectures this week.`
      : 'No gaps between lectures this week.';
  }

  async function duplicateWeek() {
    if (!window.ScholarisApi?.isAuthenticated()) {
      window.showToast?.('Connect your account before duplicating a week.', 'error');
      return;
    }
    const rawSemester = window.prompt('Optional target semester ID (leave blank for the current semester):');
    if (rawSemester === null) return;
    const semesterId = rawSemester.trim() ? Number(rawSemester.trim()) : null;
    if (rawSemester.trim() && (!Number.isInteger(semesterId) || semesterId < 1)) {
      window.showToast?.('Enter a valid semester ID.', 'error');
      return;
    }
    try {
      await window.ScholarisApi.duplicateTimetableWeek(semesterId);
      await loadRemoteSchedule();
      window.showToast?.('Week duplicated.', 'success');
    } catch (error) {
      window.showToast?.(error.message, 'error');
    }
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
    wrap.draggable = true;
    wrap.dataset.eventId = event.id;
    wrap.innerHTML = `
      <div style="font-weight: 600; font-size: 0.85rem;">${escapeHtml(event.subject)}</div>
      ${event.room ? `<div style="font-size: 0.7rem; opacity: 0.85; margin-top: 2px;"><i class="ph ph-map-pin"></i> ${escapeHtml(event.room)}</div>` : ''}
      <span class="tt-resize-handle" title="Drag to resize class"></span>
    `;
    wrap.addEventListener('dragstart', dragEvent => {
      if (resizeState) { dragEvent.preventDefault(); return; }
      dragEvent.dataTransfer.effectAllowed = 'move';
      dragEvent.dataTransfer.setData('text/plain', String(event.id));
      wrap.classList.add('is-dragging');
    });
    wrap.addEventListener('dragend', () => wrap.classList.remove('is-dragging'));
    wrap.querySelector('.tt-resize-handle').addEventListener('mousedown', resizeStart(event));
    wrap.addEventListener('click', clickEvent => {
      if (!clickEvent.target.closest('.tt-resize-handle')) openModal(event.id);
    });
    return wrap;
  }

  function resizeStart(event) {
    return pointerEvent => {
      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
      resizeState = { event, startY: pointerEvent.clientY, originalEnd: timeToMinutes(event.endTime) };
      document.addEventListener('mousemove', resizeMove);
      document.addEventListener('mouseup', resizeEnd, { once: true });
    };
  }

  function resizeMove(pointerEvent) {
    if (!resizeState) return;
    const delta = Math.round((pointerEvent.clientY - resizeState.startY) / 10) * 30;
    const nextEnd = minutesToTime(resizeState.originalEnd + delta);
    if (timeToMinutes(nextEnd) <= timeToMinutes(resizeState.event.startTime)) return;
    resizeState.event.endTime = nextEnd;
    renderGrid();
  }

  async function resizeEnd() {
    document.removeEventListener('mousemove', resizeMove);
    if (!resizeState) return;
    const event = resizeState.event;
    resizeState = null;
    if (hasConflict(event, event.id)) {
      window.showToast?.('That duration conflicts with another class.', 'error');
      await loadSaved();
      return;
    }
    if (await window.confirmAction(`Resize ${event.subject} to end at ${format12H(event.endTime)}?`, { title: 'Resize class', confirmLabel: 'Resize class' })) {
      persistScheduleState();
      window.showToast?.('Class duration updated. Save the schedule to sync it.', 'success');
    } else {
      await loadSaved();
    }
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
      const e = schedule.find(x => String(x.id) === String(id));
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

  modalForm?.addEventListener('submit', (e) => {
    e.preventDefault();
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
      const idx = schedule.findIndex(e => String(e.id) === String(id));
      if (idx > -1) schedule[idx] = { ...schedule[idx], ...eventData };
    } else {
      eventData.id = 'tt_' + Math.random().toString(36).substr(2, 9);
      schedule.push(eventData);
    }

    closeModal();
    renderGrid();
  });

  modalDeleteBtn?.addEventListener('click', () => {
    const classId = modalId.value;
    const deletedClass = schedule.find(e => String(e.id) === String(classId));
    schedule = schedule.filter(e => String(e.id) !== String(classId));
    closeModal();
    renderGrid();
    if (window.showToast && deletedClass) {
      window.showToast('Class deleted', 'success', {
        text: 'Undo',
        onClick: () => {
          schedule.push(deletedClass);
          renderGrid();
          window.showToast('Class restored');
        }
      });
    }
  });

  modalDuplicateBtn?.addEventListener('click', () => {
    const e = schedule.find(x => String(x.id) === String(modalId.value));
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

  async function saveSchedule() {
    const invalid = schedule.find(event => !event.subject?.trim() || !event.day || !event.startTime || !event.endTime || event.startTime >= event.endTime);
    if (invalid) {
      window.showToast?.('Review the timetable: every class needs a subject and valid times.', 'error');
      return;
    }
    const conflicts = schedule.some((entry, index) => schedule.slice(index + 1).some(other =>
      entry.day === other.day && entry.startTime < other.endTime && entry.endTime > other.startTime
    ));
    if (conflicts) {
      window.showToast?.('Resolve overlapping classes before saving.', 'error');
      return;
    }
    if (!await window.confirmAction('Save this reviewed timetable to your Scholaris account?', { title: 'Save timetable', confirmLabel: 'Save schedule' })) return;
    if (window.ScholarisApi?.isAuthenticated()) {
      try {
        await saveRemoteSchedule();
        window.showToast?.('Timetable synced to your account.', 'success');
      } catch (error) {
        window.showToast?.(error.message, 'error');
        return;
      }
    }
    stateApi.set('timetable', schedule, { persist: true });
    stateApi.set('timetableActiveDays', activeDays, { persist: true });
    const orig = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="ph ph-check"></i> Saved!';
    saveBtn.classList.add('btn-saved');
    setTimeout(() => { saveBtn.innerHTML = orig; saveBtn.classList.remove('btn-saved'); }, 2000);
    updateDashboard();
  }

  async function saveRemoteSchedule() {
    const existing = await window.ScholarisApi.getTimetable();
    const keptIds = new Set();
    for (const event of schedule) {
      const course = await window.ScholarisApi.getOrCreateCourse(event.subject);
      const payload = {
        day: event.day,
        start_time: event.startTime,
        end_time: event.endTime,
        room: event.room || null,
        faculty: event.faculty || null,
        course_id: course.id
      };
      if (Number.isInteger(event.id)) {
        await window.ScholarisApi.updateTimetableEntry(event.id, payload);
        keptIds.add(event.id);
      } else {
        const saved = await window.ScholarisApi.createTimetableEntry(payload);
        event.id = saved.id;
        keptIds.add(saved.id);
      }
    }
    await Promise.all(existing.filter(entry => !keptIds.has(entry.id)).map(entry =>
      window.ScholarisApi.deleteTimetableEntry(entry.id)
    ));
  }

  async function loadSaved() {
    if (window.ScholarisApi?.isAuthenticated()) {
      await loadRemoteSchedule();
      updateDashboard();
      return;
    }
    try {
        const s = state.timetable;
        const d = state.timetableActiveDays;
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
    } catch (_) {}
    updateDashboard();
    if (window.ScholarisApi?.isAuthenticated()) await loadRemoteSchedule();
  }

  async function loadRemoteSchedule() {
    try {
      const [entries, courses] = await Promise.all([
        window.ScholarisApi.getTimetable(),
        window.ScholarisApi.getCourses()
      ]);
      if (!entries.length) return;
      const courseNames = new Map(courses.map(course => [course.id, course.name]));
      schedule = entries.map(entry => ({
        id: entry.id,
        subject: courseNames.get(entry.course_id) || 'Untitled class',
        day: entry.day,
        startTime: String(entry.start_time).slice(0, 5),
        endTime: String(entry.end_time).slice(0, 5),
        room: entry.room || '',
        faculty: entry.faculty || '',
        color: 'blue'
      }));
      activeDays = [...new Set(schedule.map(entry => entry.day))];
      stateApi.set('timetable', schedule, { persist: true });
      stateApi.set('timetableActiveDays', activeDays, { persist: true });
      uploadZone.hidden = true;
      output.hidden = false;
      renderGrid();
      updateDashboard();
    } catch (_) {
      // Keep the local cache visible when the backend is unavailable.
    }
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
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  /* Init */
  loadSaved();
})();
