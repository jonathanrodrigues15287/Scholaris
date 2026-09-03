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
   * @param {string} [onRetry]   — JS expression string to call on retry click (e.g. 'render()')
   */
  function error(message = "Something went wrong.", onRetry = '') {
    const retryBtn = onRetry
      ? `<button class="btn btn-secondary state-retry-btn" onclick="${onRetry}">
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
