// accessibility.js — focus trap for modals, ARIA live region helpers

(function () {
  const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  function trapFocus(element) {
    const focusable = () => Array.from(element.querySelectorAll(FOCUSABLE));
    const first = focusable()[0];
    if (first) first.focus();

    function handler(e) {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { e.preventDefault(); return; }
      const firstEl = items[0];
      const lastEl  = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      } else {
        if (document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }

  function addEscapeClose(overlay, closeFn) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeFn();
    });
  }

  // Timetable edit modal
  const ttOverlay = document.getElementById('tt-modal-overlay');
  const ttModal   = document.getElementById('tt-modal');
  const ttCancel  = document.getElementById('tt-modal-cancel');
  if (ttOverlay && ttModal && ttCancel) {
    let cleanup = null;
    new MutationObserver(() => {
      const isOpen = !ttOverlay.classList.contains('hidden');
      ttOverlay.setAttribute('aria-hidden', String(!isOpen));
      ttModal.setAttribute('aria-modal', String(isOpen));
      if (isOpen) { cleanup = trapFocus(ttModal); }
      else if (cleanup) { cleanup(); cleanup = null; }
    }).observe(ttOverlay, { attributes: true, attributeFilter: ['class'] });
    addEscapeClose(ttOverlay, () => ttCancel.click());
  }

  // Session completion modal
  const sessOverlay = document.getElementById('session-modal-overlay');
  const sessModal   = document.getElementById('session-modal');
  const sessSkip    = document.getElementById('session-skip-btn');
  if (sessOverlay && sessModal && sessSkip) {
    let cleanup = null;
    new MutationObserver(() => {
      const isOpen = !sessOverlay.classList.contains('hidden');
      sessOverlay.setAttribute('aria-hidden', String(!isOpen));
      sessModal.setAttribute('aria-modal', String(isOpen));
      if (isOpen) { cleanup = trapFocus(sessModal); }
      else if (cleanup) { cleanup(); cleanup = null; }
    }).observe(sessOverlay, { attributes: true, attributeFilter: ['class'] });
    addEscapeClose(sessOverlay, () => sessSkip.click());
  }
})();
