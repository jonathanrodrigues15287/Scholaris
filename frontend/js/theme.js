// theme.js - manages light, dark, and system theme preferences.

(function () {
  const body = document.body;
  const themeBtn = document.getElementById('theme-btn');
  const storageKey = 'scholaris_theme';
  const systemPreference = window.matchMedia('(prefers-color-scheme: dark)');

  if (!body || !themeBtn) return;

  const icon = themeBtn.querySelector('i');
  const themes = ['light', 'dark', 'system'];

  function readPreference() {
    try {
      return localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  }

  function savePreference(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {
      // Private browsing or blocked storage should not disable theme switching.
    }
  }

  function getInitialPreference() {
    const saved = readPreference();
    return themes.includes(saved) ? saved : 'system';
  }

  function resolveTheme(preference) {
    return preference === 'system'
      ? (systemPreference.matches ? 'dark' : 'light')
      : preference;
  }

  function updateButton(preference, theme) {
    const labels = {
      light: 'Switch to dark theme',
      dark: 'Switch to system theme',
      system: 'Switch to light theme'
    };

    if (icon) {
      icon.className = preference === 'dark'
        ? 'ph ph-sun'
        : preference === 'system'
          ? 'ph ph-desktop'
          : 'ph-fill ph-moon';
    }
    themeBtn.title = `${labels[preference]} (currently ${theme})`;
    themeBtn.setAttribute('aria-label', themeBtn.title);
    themeBtn.dataset.themePreference = preference;
  }

  function applyTheme(preference, persist = true) {
    const theme = resolveTheme(preference);
    body.setAttribute('data-theme', theme);
    body.dataset.themePreference = preference;
    updateButton(preference, theme);
    if (persist) savePreference(preference);
    window.ScholarisEvents?.emit('theme-changed', { preference, theme });
  }

  let preference = getInitialPreference();
  applyTheme(preference, false);

  themeBtn.addEventListener('click', () => {
    preference = themes[(themes.indexOf(preference) + 1) % themes.length];
    applyTheme(preference);
  });

  const handleSystemThemeChange = () => {
    if (preference === 'system') applyTheme(preference, false);
  };

  if (systemPreference.addEventListener) {
    systemPreference.addEventListener('change', handleSystemThemeChange);
  } else {
    systemPreference.addListener(handleSystemThemeChange);
  }
})();
