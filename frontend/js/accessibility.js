// accessibility.js � focus trap for modals, ARIA live region helpers

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

  let lastFocusedElement = null;
  document.addEventListener('focusin', (event) => {
    if (!event.target.closest('dialog')) lastFocusedElement = event.target;
  });

  function watchModal(overlay, modal, closeFn) {
    let cleanup = null;
    let opener = null;
    new MutationObserver(() => {
      const isOpen = !overlay.classList.contains('hidden');
      overlay.setAttribute('aria-hidden', String(!isOpen));
      modal.setAttribute('aria-modal', String(isOpen));
      if (isOpen) {
        opener = lastFocusedElement || document.activeElement;
        cleanup?.();
        cleanup = trapFocus(modal);
      } else {
        cleanup?.();
        cleanup = null;
        if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
        opener = null;
      }
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    addEscapeClose(overlay, closeFn);
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
    watchModal(ttOverlay, ttModal, () => ttCancel.click());
  }

  // Session completion modal
  const sessOverlay = document.getElementById('session-modal-overlay');
  const sessModal   = document.getElementById('session-modal');
  const sessSkip    = document.getElementById('session-skip-btn');
  if (sessOverlay && sessModal && sessSkip) {
    watchModal(sessOverlay, sessModal, () => sessSkip.click());
  }
})();
