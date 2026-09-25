// Shared browser-safe utilities used by feature modules.
(function () {
  const Scholaris = window.Scholaris = window.Scholaris || { utils: {} };

  function parseJson(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(value ?? '')));
    return div.innerHTML;
  }

  function createId(prefix = 'item') {
    const uniquePart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${uniquePart}`;
  }

  function formatDate(value, options = {}) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], options);
  }

  function debounce(callback, delay = 0) {
    let timeoutId;
    return function debounced(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback.apply(this, args), delay);
    };
  }

  const utilities = { escapeHtml, createId, parseJson, formatDate, debounce };
  window.ScholarisUtils = { ...window.ScholarisUtils, ...utilities };
  Scholaris.utils = { ...Scholaris.utils, ...utilities };
})();
