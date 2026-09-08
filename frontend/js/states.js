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

  return { empty, loading, error };
})();

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
