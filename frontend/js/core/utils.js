// Shared browser-safe utility functions.
(function () {
  function parseJson(value, fallback) {
    try { return JSON.parse(value); } catch (error) { return fallback; }
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(value ?? '')));
    return div.innerHTML;
  }

  function createId(prefix = 'item') {
    return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  window.ScholarisUtils = { parseJson, escapeHtml, createId };
})();
