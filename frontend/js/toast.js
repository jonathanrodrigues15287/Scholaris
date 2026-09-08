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
    
    const iconClass = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
    
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
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 5 seconds
    const timeoutId = setTimeout(() => dismissToast(toast), 5000);
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
