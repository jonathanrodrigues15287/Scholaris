// toast.js — global toast notification system

(function() {
  // Create toast container if it doesn't exist
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  window.showToast = function(message, type = 'success', action = null) {
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
      actionBtn.style.padding = '4px 10px';
      actionBtn.style.fontSize = '0.8rem';
      actionBtn.style.marginLeft = 'auto';
      actionBtn.textContent = action.text;
      actionBtn.addEventListener('click', () => {
        action.onClick();
        dismissToast(toast);
      });
      toast.appendChild(actionBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close icon-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.innerHTML = '<i class="ph ph-x" aria-hidden="true"></i>';
    closeBtn.addEventListener('click', () => dismissToast(toast));
    toast.appendChild(closeBtn);
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 5 seconds
    const timeoutId = setTimeout(() => dismissToast(toast), type === 'error' ? 7000 : 5000);
    toast.dataset.timeoutId = timeoutId;
  };

  function dismissToast(toast) {
    if (toast.dataset.timeoutId) clearTimeout(parseInt(toast.dataset.timeoutId, 10));
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300); // Wait for transition
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();
