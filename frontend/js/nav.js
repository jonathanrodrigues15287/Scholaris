// nav.js — section switching and mobile collapsible sidebar

(function () {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const overlay = document.getElementById('sidebar-overlay');

  function switchSection(targetId) {
    navLinks.forEach(l => l.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    document.querySelector(`[data-target="${targetId}"]`)?.classList.add('active');
    document.getElementById(targetId)?.classList.add('active');
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      switchSection(link.getAttribute('data-target'));
      closeSidebar(); // auto-close on mobile after tap
    });
  });

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
  }

  hamburgerBtn?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
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
    if (window.showToast) window.showToast('Data exported successfully!');
  });

  importInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith('scholaris_')) {
            localStorage.setItem(key, value);
          }
        }
        if (window.showToast) window.showToast('Data imported successfully! Reloading...');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        if (window.showToast) window.showToast('Failed to import data: Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  });

  clearBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear ALL your Scholaris data? This cannot be undone.')) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('scholaris_')) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      if (window.showToast) window.showToast('All data cleared. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    }
  });

})();
