(function () {
  const Scholaris = window.Scholaris;
  const api = window.ScholarisApi;
  const { escapeHtml } = window.ScholarisUtils;
  const list = document.getElementById('sync-review-list');
  const summary = document.getElementById('sync-review-summary');
  const refreshButton = document.getElementById('sync-review-refresh');
  const retryAllButton = document.getElementById('sync-review-retry-all');
  const discardButton = document.getElementById('sync-review-discard-failed');
  const retentionWarning = document.getElementById('sync-retention-warning');
  const retentionWarningText = document.getElementById('sync-retention-warning-text');

  function stateLabel(state) {
    return {
      pending: 'Waiting',
      retryable: 'Retry scheduled',
      syncing: 'Syncing',
      conflict: 'Conflict',
      permanent: 'Failed'
    }[state] || state;
  }

  function formatOperation(operation) {
    const method = escapeHtml(operation.method || 'POST');
    const path = escapeHtml(operation.path || '');
    const detail = escapeHtml(operation.error || 'No error details');
    const updated = operation.updatedAt
      ? new Date(operation.updatedAt).toLocaleString()
      : 'Unknown';
    const retention = api.getQueueRetentionInfo();
    const expiration = retention.expiring.find(item => item.id === operation.id);
    const expirationText = expiration
      ? ` · Locally saved work expires in ${expiration.daysRemaining} day${expiration.daysRemaining === 1 ? '' : 's'}`
      : '';
    return `<li class="sync-review-item sync-review-${escapeHtml(operation.state)}">
      <div>
        <strong>${method} ${path}</strong>
        <span class="sync-review-operation">${escapeHtml(operation.operation || 'Offline change')}</span>
        <span class="text-secondary">${detail}</span>
        <small class="text-secondary">Updated ${escapeHtml(updated)} · Attempt ${Number(operation.attempts || 0)}${escapeHtml(expirationText)}</small>
      </div>
      <div class="sync-review-item-actions">
        <span class="sync-review-state">${escapeHtml(stateLabel(operation.state))}</span>
        ${['retryable', 'permanent'].includes(operation.state)
          ? `<button type="button" class="btn btn-secondary" data-sync-retry="${escapeHtml(operation.id)}">Retry</button>`
          : ''}
        ${['conflict', 'permanent'].includes(operation.state)
          ? `<button type="button" class="btn btn-danger" data-sync-discard="${escapeHtml(operation.id)}">Discard</button>`
          : ''}
      </div>
    </li>`;
  }

  function render() {
    if (!list || !api) return;
    api.cleanupSyncQueue();
    const operations = api.getSyncReviewOperations();
    const failed = operations.filter(operation => ['conflict', 'permanent'].includes(operation.state)).length;
    const pending = operations.filter(operation => ['pending', 'retryable', 'syncing'].includes(operation.state)).length;
    const retention = api.getQueueRetentionInfo();
    if (retention.atLimit) {
      retentionWarningText.textContent =
        `Queue limit reached: ${retention.count}/${retention.max} operations. Retry or discard work before saving another local change.`;
    } else if (retention.expiring.length) {
      const soonest = retention.expiring.reduce((a, b) =>
        a.daysRemaining < b.daysRemaining ? a : b
      );
      retentionWarningText.textContent =
        `Failed or conflicted changes are kept for ${retention.retentionDays} days. At least one change expires in ${soonest.daysRemaining} day${soonest.daysRemaining === 1 ? '' : 's'}; review or discard it before it is removed. Queue capacity: ${retention.count}/${retention.max}.`;
    } else {
      retentionWarningText.textContent =
        `Failed or conflicted changes are kept for ${retention.retentionDays} days. The queue holds up to ${retention.max} operations; it will not silently discard locally saved work when full. Queue capacity: ${retention.count}/${retention.max}.`;
    }
    summary.textContent = operations.length
      ? `${pending} pending · ${failed} needs review`
      : 'No pending changes';
    retryAllButton.disabled = !api.isAuthenticated() || pending === 0;
    discardButton.disabled = failed === 0;
    list.innerHTML = operations.length
      ? operations.slice().reverse().map(formatOperation).join('')
      : `<li class="sync-review-empty"><i class="ph ph-cloud-check"></i><span>All changes are synced.</span></li>`;
  }

  refreshButton?.addEventListener('click', () => {
    api?.flushSyncQueue();
    render();
  });

  retryAllButton?.addEventListener('click', () => {
    for (const operation of api.getSyncReviewOperations()) {
      if (['retryable', 'permanent', 'pending'].includes(operation.state)) {
        api.retrySyncOperation(operation.id);
      }
    }
    render();
  });

  discardButton?.addEventListener('click', async () => {
    if (!await Scholaris.utils.confirm(
      'Discard locally queued failed changes? This cannot be undone.',
      { title: 'Discard failed changes', confirmLabel: 'Discard', danger: true }
    )) return;
    api.discardSyncOperations(['conflict', 'permanent']);
    Scholaris.utils.toast?.('Failed changes discarded.');
    render();
  });

  list?.addEventListener('click', async event => {
    const retryButton = event.target.closest('[data-sync-retry]');
    const discardButton = event.target.closest('[data-sync-discard]');
    if (retryButton) {
      api.retrySyncOperation(retryButton.dataset.syncRetry);
      render();
    }
    if (discardButton) {
      if (!await Scholaris.utils.confirm('Discard this locally queued change?', {
        title: 'Discard change',
        confirmLabel: 'Discard',
        danger: true
      })) return;
      api.discardSyncOperation(discardButton.dataset.syncDiscard);
      render();
    }
  });

  window.Scholaris.events?.on('sync-state-changed', render);
  window.Scholaris.events?.on('auth-changed', render);
  window.Scholaris.events?.on('sync-queue-cleaned', event => {
    const detail = event?.detail || event;
    if (detail?.removed) {
      Scholaris.utils.toast?.(
        `${detail.removed} locally saved change${detail.removed === 1 ? '' : 's'} expired and were removed after 30 days.`,
        'warning'
      );
    }
    render();
  });
  render();
})();
