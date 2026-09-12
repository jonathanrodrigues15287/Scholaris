// Shared DOM helpers.
(function () {
  function $(selector, root = document) { return root.querySelector(selector); }
  function $$(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function setText(target, value) {
    const element = typeof target === 'string' ? $(target) : target;
    if (element) element.textContent = value ?? '';
    return element;
  }

  window.ScholarisDom = { $, $$, setText };
})();
