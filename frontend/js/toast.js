// toast.js — global toast notification system

(function() {
  const Scholaris = window.Scholaris = window.Scholaris || { utils: {} };
  const { escapeHtml } = window.ScholarisUtils;
  // Create toast container if it doesn't exist
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    container.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(container);
  }

  // Map to prevent duplicate toasts
  const activeToasts = new Map();

  Scholaris.utils.toast = function(message, type = 'success', action = null) {
    if (!message) return;
    const key = `${type}:${message}`;

    // If an identical toast is already displayed, refresh its timer and return
    if (activeToasts.has(key)) {
      const existing = activeToasts.get(key);
      if (existing.dataset.timeoutId) {
        clearTimeout(parseInt(existing.dataset.timeoutId, 10));
      }
      const newTimeoutId = setTimeout(() => dismissToast(existing, key), type === 'error' ? 7000 : 5000);
      existing.dataset.timeoutId = newTimeoutId;
      existing.classList.remove('show');
      setTimeout(() => existing.classList.add('show'), 20);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const iconClass = {
      success: 'ph-check-circle',
      info: 'ph-info',
      warning: 'ph-warning',
      error: 'ph-warning-circle'
    }[type] || 'ph-info';
    
    toast.innerHTML = `
      <i class="ph-fill ${iconClass} toast-icon"></i>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    if (action) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'btn btn-secondary toast-action-btn';
      actionBtn.textContent = action.text;
      actionBtn.addEventListener('click', () => {
        action.onClick();
        dismissToast(toast, key);
      });
      toast.appendChild(actionBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close icon-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.innerHTML = '<i class="ph ph-x" aria-hidden="true"></i>';
    closeBtn.addEventListener('click', () => dismissToast(toast, key));
    toast.appendChild(closeBtn);
    
    container.appendChild(toast);
    activeToasts.set(key, toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after timeout
    const timeoutId = setTimeout(() => dismissToast(toast, key), type === 'error' ? 7000 : 5000);
    toast.dataset.timeoutId = timeoutId;
  };

  function dismissToast(toast, key) {
    if (key) activeToasts.delete(key);
    if (toast.dataset.timeoutId) clearTimeout(parseInt(toast.dataset.timeoutId, 10));
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300); // Wait for transition
  }

})();
