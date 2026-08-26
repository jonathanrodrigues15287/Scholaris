// theme.js — detects system preference, persists to localStorage, fixes icon direction

(function () {
  const body = document.body;
  const themeBtn = document.getElementById('theme-btn');
  const icon = themeBtn.querySelector('i');

  function getInitialTheme() {
    const saved = localStorage.getItem('uniassist_theme');
    if (saved) return saved;
    // Fall back to OS preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    body.setAttribute('data-theme', theme);
    // In dark mode → show sun (to switch to light)
    // In light mode → show moon (to switch to dark)
    icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph-fill ph-moon';
    localStorage.setItem('uniassist_theme', theme);
  }

  applyTheme(getInitialTheme());

  themeBtn.addEventListener('click', () => {
    const current = body.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
})();
