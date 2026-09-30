// Shared DOM helpers.
(function () {
  const Scholaris = window.Scholaris = window.Scholaris || { utils: {} };
  function $(selector, root = document) { return root.querySelector(selector); }
  function $$(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function setText(target, value) {
    const element = typeof target === 'string' ? $(target) : target;
    if (element) element.textContent = value ?? '';
    return element;
  }

  Scholaris.utils = Scholaris.utils || {};
  Scholaris.utils.dom = { $, $$, setText };
})();
