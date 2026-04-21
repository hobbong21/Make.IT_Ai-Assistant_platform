// MaKIT UI helpers — toast, loading, error states.
(function () {
  function toast(message, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () {
      el.classList.add('toast-leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, 3500);
    return el;
  }

  function showLoading(target) {
    if (!target) return;
    target.classList.add('is-loading');
    target.setAttribute('aria-busy', 'true');
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') {
      target.disabled = true;
    }
  }

  function hideLoading(target) {
    if (!target) return;
    target.classList.remove('is-loading');
    target.removeAttribute('aria-busy');
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') {
      target.disabled = false;
    }
  }

  function renderError(container, err) {
    if (!container) return;
    var msg = (err && err.message) || '알 수 없는 오류';
    var reqId = err && err.details && err.details.requestId ? err.details.requestId : '';
    container.innerHTML =
      '<div class="error-state">' +
      '<p>' + escapeHtml(msg) + '</p>' +
      (reqId ? '<small>요청 ID: ' + escapeHtml(reqId) + '</small>' : '') +
      '</div>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return String(iso); }
  }

  window.ui = {
    toast: toast,
    showLoading: showLoading,
    hideLoading: hideLoading,
    renderError: renderError,
    escapeHtml: escapeHtml,
    formatDate: formatDate
  };
})();
