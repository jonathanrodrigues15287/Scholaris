/**
 * states.js — Shared empty/loading/error state HTML generators
 * Used by all section modules to render consistent UI feedback.
 */

window.States = (function () {

  /**
   * Renders an empty-state block.
   * @param {string} icon     — Phosphor icon class (e.g. 'ph ph-list-checks')
   * @param {string} title    — Primary message
   * @param {string} [body]   — Optional sub-message
   * @param {string} [action] — Optional HTML for a CTA button
   */
  function empty(icon, title, body = '', action = '') {
    return `
      <li class="state-block empty-block">
        <i class="${icon}" aria-hidden="true"></i>
        <p class="state-title">${title}</p>
        ${body   ? `<p class="state-body">${body}</p>` : ''}
        ${action ? `<div class="state-action">${action}</div>` : ''}
      </li>`;
  }

  /**
   * Renders a loading-state block.
   * @param {string} label — Message shown below the spinner
   */
  function loading(label = 'Loading...') {
    return `
      <li class="state-block loading-block" aria-live="polite">
        <span class="state-spinner" aria-hidden="true"></span>
        <p class="state-title">${label}</p>
      </li>`;
  }

  function skeleton(rows = 3) {
    return Array.from({ length: rows }, () => `
      <li class="state-skeleton" aria-hidden="true">
        <span></span><span></span><span></span>
      </li>`).join('');
  }

  /**
   * Renders an error-state block.
   * @param {string} message     — Error message to display
   * @param {string} [retryId]   — Optional ID for the retry button to wire up via addEventListener
   */
  function error(message = "Something went wrong.", retryId = '') {
    const retryBtn = retryId
      ? `<button class="btn btn-secondary state-retry-btn" id="${retryId}">
           <i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i> Try Again
         </button>`
      : '';
    return `
      <li class="state-block error-block">
        <i class="ph ph-warning-circle" aria-hidden="true"></i>
        <p class="state-title">${message}</p>
        ${retryBtn ? `<div class="state-action">${retryBtn}</div>` : ''}
      </li>`;
  }

  return { empty, loading, skeleton, error };
})();

window.confirmAction = function (message, { title = 'Please confirm', confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    const escapeHtml = value => {
      const node = document.createElement('div');
      node.textContent = value;
      return node.innerHTML;
    };
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-overlay';
    overlay.innerHTML = `
      <dialog class="modal-content card confirm-dialog" open aria-modal="true">
        <header><h2 class="card-title">${escapeHtml(title)}</h2></header>
        <p class="text-secondary">${escapeHtml(message)}</p>
        <footer class="flex-end mt-1-5">
          <button type="button" class="btn btn-secondary" data-confirm-cancel>Cancel</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : ''}" data-confirm-ok>${confirmLabel}</button>
        </footer>
      </dialog>`;
    document.body.appendChild(overlay);
    const close = result => { document.removeEventListener('keydown', onKeydown); overlay.remove(); resolve(result); };
    overlay.querySelector('[data-confirm-cancel]').addEventListener('click', () => close(false));
    overlay.querySelector('[data-confirm-ok]').addEventListener('click', () => close(true));
    overlay.addEventListener('click', event => { if (event.target === overlay) close(false); });
    const onKeydown = event => {
      if (event.key === 'Escape') { close(false); return; }
      if (event.key !== 'Tab') return;
      const focusable = overlay.querySelectorAll('button:not([disabled])');
      if (focusable.length < 2) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeydown);
    overlay.querySelector('[data-confirm-cancel]').focus();
  });
};

// Unsaved changes protection
window.addEventListener('beforeunload', (e) => {
  const assignTitle = document.getElementById('assignment-title');
  const ttSubject = document.getElementById('tt-modal-subject');
  const ttModalOverlay = document.getElementById('tt-modal-overlay');
  
  let hasUnsaved = false;

  // Assignment form has unsaved text
  if (assignTitle && assignTitle.value.trim() !== '') {
    hasUnsaved = true;
  }
  
  // Timetable modal is open and has text
  if (ttModalOverlay && !ttModalOverlay.classList.contains('hidden') && ttSubject && ttSubject.value.trim() !== '') {
    hasUnsaved = true;
  }

  if (hasUnsaved) {
    e.preventDefault();
    e.returnValue = ''; // Trigger standard browser confirmation dialog
  }
});
