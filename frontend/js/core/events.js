// Small event bus for communication between feature modules.
(function () {
  const listeners = new Map();

  function on(name, handler) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(handler);
    return () => listeners.get(name)?.delete(handler);
  }

  function emit(name, detail) {
    listeners.get(name)?.forEach(handler => {
      try {
        handler(detail);
      } catch (error) {
        console.error(`Scholaris event handler failed: ${name}`, error);
      }
    });
    window.dispatchEvent(new CustomEvent(`scholaris:${name}`, { detail }));
  }

  window.ScholarisEvents = { on, emit };
})();
