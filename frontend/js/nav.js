// nav.js — section switching and mobile collapsible sidebar

(function () {
  const Scholaris = window.Scholaris;
  const navLinks = document.querySelectorAll('.sidebar .nav-link');
  const sections = document.querySelectorAll('.section');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const overlay = document.getElementById('sidebar-overlay');

  function switchSection(targetId, updateHash = true) {
    if (!targetId) return;
    const targetSection = document.getElementById(targetId);
    if (!targetSection) return;

    navLinks.forEach(l => l.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    const activeLink = document.querySelector(`[data-target="${targetId}"]`);
    activeLink?.classList.add('active');
    navLinks.forEach(link => link.setAttribute('aria-current', link === activeLink ? 'page' : 'false'));
    targetSection.classList.add('active');

    if (updateHash && location.hash !== `#${targetId}`) {
      history.pushState(null, '', `#${targetId}`);
    }
  }

  function handleHashChange() {
    const hash = location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
      switchSection(hash, false);
    }
  }

  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('popstate', handleHashChange);

  // Restore active section on initial load if deep linked
  const initialHash = location.hash.replace('#', '');
  if (initialHash && document.getElementById(initialHash)) {
    switchSection(initialHash, false);
  }

  navLinks.forEach((link, index) => {
    link.addEventListener('click', () => {
      switchSection(link.getAttribute('data-target'));
      closeSidebar(); // auto-close on mobile after tap
    });
    link.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        link.click();
        return;
      }
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
      const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? navLinks.length - 1 : (index + direction + navLinks.length) % navLinks.length;
      navLinks[nextIndex].focus();
    });
  });

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    hamburgerBtn?.setAttribute('aria-expanded', 'false');
    overlay?.setAttribute('aria-hidden', 'true');
  }

  hamburgerBtn?.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('sidebar-open');
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
    overlay?.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) navLinks[0]?.focus();
  });

  overlay?.addEventListener('click', closeSidebar);

  document.getElementById('search-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
  });

  // --- Data Management ---
  const exportBtn = document.getElementById('export-data-btn');
  const importInput = document.getElementById('import-data-file');
  const clearBtn = document.getElementById('clear-data-btn');

  exportBtn?.addEventListener('click', () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('scholaris_')) {
        data[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scholaris_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (Scholaris.utils.toast) Scholaris.utils.toast('Data exported successfully!');
  });

  importInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || typeof data !== 'object') {
          throw new Error('Backup content must be a JSON object.');
        }
        let importedCount = 0;
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith('scholaris_')) {
            localStorage.setItem(key, value);
            importedCount++;
          }
        }
        if (importedCount === 0) {
          throw new Error('No Scholaris data found in the imported file.');
        }
        if (Scholaris.utils.toast) Scholaris.utils.toast('Data imported successfully! Reloading...');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        if (Scholaris.utils.toast) Scholaris.utils.toast(`Failed to import data: ${err.message}`, 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      if (Scholaris.utils.toast) Scholaris.utils.toast('Failed to read file.', 'error');
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  clearBtn?.addEventListener('click', async () => {
    if (await Scholaris.utils.confirm('Clear all locally cached Scholaris data? This cannot be undone.', { title: 'Clear local data', confirmLabel: 'Clear data', danger: true })) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('scholaris_')) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      if (Scholaris.utils.toast) Scholaris.utils.toast('All data cleared. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    }
  });

})();

