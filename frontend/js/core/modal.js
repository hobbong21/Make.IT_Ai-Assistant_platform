// MaKIT Global Modal — 재사용 가능한 모달 컴포넌트
// 사용:
//   makitModal.open({ title: '...', body: htmlString | DOMNode, actions: [{label, type, onClick}] })
//   makitModal.close()
//   makitModal.confirm({ title, message, confirmLabel, cancelLabel }) → Promise<boolean>
//   makitModal.prompt({ title, message, defaultValue, placeholder }) → Promise<string|null>
(function () {
  if (window.makitModal) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function ensureRoot() {
    var root = document.getElementById('mk-modal-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'mk-modal-root';
    root.className = 'mk-modal-root';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="mk-modal-backdrop"></div>' +
      '<div class="mk-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="mkModalTitle">' +
      '  <header class="mk-modal-head">' +
      '    <h2 id="mkModalTitle" class="mk-modal-title"></h2>' +
      '    <button type="button" class="mk-modal-close" aria-label="닫기">' +
      '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>' +
      '    </button>' +
      '  </header>' +
      '  <div class="mk-modal-body" id="mkModalBody"></div>' +
      '  <footer class="mk-modal-actions" id="mkModalActions"></footer>' +
      '</div>';
    document.body.appendChild(root);
    root.querySelector('.mk-modal-backdrop').addEventListener('click', close);
    root.querySelector('.mk-modal-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('mk-modal-root--open')) close();
    });
    return root;
  }

  var openOpts = null;

  function open(opts) {
    opts = opts || {};
    var root = ensureRoot();
    openOpts = opts;
    root.querySelector('.mk-modal-title').textContent = opts.title || '';

    var body = root.querySelector('#mkModalBody');
    body.innerHTML = '';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body instanceof Node) body.appendChild(opts.body);

    var actions = root.querySelector('#mkModalActions');
    actions.innerHTML = '';
    (opts.actions || []).forEach(function (a) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mk-modal-btn mk-modal-btn--' + (a.type || 'secondary');
      btn.textContent = a.label || '확인';
      if (a.disabled) btn.disabled = true;
      btn.addEventListener('click', function () {
        if (typeof a.onClick === 'function') {
          var r = a.onClick({ body: body, close: close });
          if (r === false) return; // 명시적으로 false면 닫지 않음
        }
        if (a.closeOnClick !== false) close();
      });
      actions.appendChild(btn);
    });

    root.classList.add('mk-modal-root--open');
    root.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      var first = body.querySelector('input, textarea, select, button');
      if (first && first.focus) first.focus();
    }, 50);
  }

  function close() {
    var root = document.getElementById('mk-modal-root');
    if (!root) return;
    root.classList.remove('mk-modal-root--open');
    root.setAttribute('aria-hidden', 'true');
    if (openOpts && typeof openOpts.onClose === 'function') openOpts.onClose();
    openOpts = null;
  }

  function confirm(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      open({
        title: opts.title || '확인',
        body: '<p>' + escapeHtml(opts.message || '') + '</p>',
        actions: [
          { label: opts.cancelLabel || '취소', type: 'secondary', onClick: function () { resolve(false); } },
          { label: opts.confirmLabel || '확인', type: opts.danger ? 'danger' : 'primary', onClick: function () { resolve(true); } }
        ],
        onClose: function () { resolve(false); }
      });
    });
  }

  function prompt(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var inputId = 'mkPromptInput_' + Date.now();
      open({
        title: opts.title || '입력',
        body:
          (opts.message ? '<p>' + escapeHtml(opts.message) + '</p>' : '') +
          '<input type="text" id="' + inputId + '" class="mk-modal-input" value="' + escapeHtml(opts.defaultValue || '') + '" placeholder="' + escapeHtml(opts.placeholder || '') + '">',
        actions: [
          { label: '취소', type: 'secondary', onClick: function () { resolve(null); } },
          { label: '확인', type: 'primary', onClick: function () {
            var v = document.getElementById(inputId);
            resolve(v ? v.value : null);
          }}
        ],
        onClose: function () { resolve(null); }
      });
    });
  }

  window.makitModal = { open: open, close: close, confirm: confirm, prompt: prompt };
})();
