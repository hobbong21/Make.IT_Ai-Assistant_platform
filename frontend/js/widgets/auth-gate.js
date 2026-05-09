// MaKIT auth-gate widget
// 비로그인 사용자가 로그인 필수 페이지로 이동하려 할 때, 페이지 이동 대신
// "로그인이 필요한 서비스입니다" 안내 + 인라인 로그인 폼 모달을 띄운다.
// 로그인 성공 시 원래 클릭한 URL로 이동한다.
//
// 게이팅 대상: service-detail / marketing-playbook(s) / history / settings / admin
// 주의: index.html은 비로그인 자유 접근이므로 게이팅하지 않음 (replit.md 정책).
// 의존: window.makitModal, window.auth, window.api
(function () {
  if (window.makitAuthGate) return;

  var GATED_PATTERN = /^(service-detail|marketing-playbook|marketing-playbooks|history|settings|admin)\.html(\?|$|#)/;

  function isGatedHref(href) {
    if (!href) return false;
    var bare = String(href).replace(/^https?:\/\/[^/]+\//, '').replace(/^\.?\//, '');
    return GATED_PATTERN.test(bare);
  }

  function buildBody() {
    var wrap = document.createElement('div');
    wrap.className = 'mk-auth-gate';
    wrap.innerHTML =
      '<p class="mk-auth-gate-lead">로그인이 필요한 서비스입니다.<br>' +
      '계속하시려면 로그인해주세요.</p>' +
      '<form id="mkAuthGateForm" class="mk-auth-gate-form" novalidate autocomplete="on">' +
      '  <label for="mkAuthGateEmail">이메일</label>' +
      '  <input type="email" id="mkAuthGateEmail" name="email" required autocomplete="email" placeholder="you@example.com">' +
      '  <label for="mkAuthGatePassword">비밀번호</label>' +
      '  <input type="password" id="mkAuthGatePassword" name="password" required autocomplete="current-password" placeholder="비밀번호 (6자 이상)">' +
      '  <label class="mk-auth-gate-remember"><input type="checkbox" id="mkAuthGateRemember" checked> 로그인 상태 유지</label>' +
      '  <div class="mk-auth-gate-msg" id="mkAuthGateMsg" role="alert" aria-live="polite"></div>' +
      '</form>' +
      '<p class="mk-auth-gate-hint">계정이 없으신가요? <a id="mkAuthGateRegisterLink" href="login.html">회원가입 페이지</a></p>';
    return wrap;
  }

  function showMsg(text, type) {
    var el = document.getElementById('mkAuthGateMsg');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('mk-auth-gate-msg--error', type === 'error');
    el.classList.toggle('mk-auth-gate-msg--success', type === 'success');
  }

  async function submit(targetUrl) {
    var emailEl = document.getElementById('mkAuthGateEmail');
    var passEl = document.getElementById('mkAuthGatePassword');
    var rememberEl = document.getElementById('mkAuthGateRemember');
    var email = emailEl ? emailEl.value.trim() : '';
    var password = passEl ? passEl.value : '';
    var remember = rememberEl ? !!rememberEl.checked : true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMsg('올바른 이메일 형식이 아닙니다.', 'error');
      if (emailEl) emailEl.focus();
      return;
    }
    if (!password || password.length < 6) {
      showMsg('비밀번호는 6자 이상이어야 합니다.', 'error');
      if (passEl) passEl.focus();
      return;
    }

    showMsg('로그인 중...', '');
    try {
      var data = await api.auth.login(email, password);
      if (!data || !data.token) {
        showMsg('로그인에 실패했습니다.', 'error');
        return;
      }
      auth.saveSession(data, remember);
      showMsg('로그인 성공! 이동합니다…', 'success');
      setTimeout(function () { location.href = targetUrl; }, 400);
    } catch (err) {
      var msg = '로그인에 실패했습니다.';
      if (err && err.code === 'NETWORK_ERROR') {
        msg = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
      } else if (err && (err.status === 401 || err.code === 'INVALID_CREDENTIALS')) {
        msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
      } else if (err && err.status === 429) {
        msg = '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.';
      }
      showMsg(msg, 'error');
      console.error('[auth-gate]', err);
    }
  }

  function open(targetUrl) {
    if (!window.makitModal) {
      // Modal not loaded — fallback to login page with redirect param
      location.href = 'login.html?redirect=' + encodeURIComponent(targetUrl);
      return;
    }
    var body = buildBody();
    window.makitModal.open({
      title: '로그인이 필요한 서비스입니다',
      body: body,
      actions: [
        { label: '취소', type: 'secondary' },
        {
          label: '로그인',
          type: 'primary',
          closeOnClick: false,
          onClick: function () { submit(targetUrl); return false; }
        }
      ]
    });

    // Enter 키로 제출
    var form = document.getElementById('mkAuthGateForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submit(targetUrl);
      });
    }
    // 회원가입 링크 클릭 시 redirect 파라미터 부착
    var regLink = document.getElementById('mkAuthGateRegisterLink');
    if (regLink) {
      regLink.addEventListener('click', function (e) {
        e.preventDefault();
        location.href = 'login.html?tab=register&redirect=' + encodeURIComponent(targetUrl);
      });
    }
  }

  function onClick(e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
    var a = e.target.closest('a[href]');
    if (!a) return;
    if (a.target && a.target !== '' && a.target !== '_self') return;
    var href = a.getAttribute('href');
    if (!isGatedHref(href)) return;
    if (window.auth && auth.isLoggedIn()) return; // 이미 로그인 — 정상 진행
    e.preventDefault();
    open(a.href || href);
  }

  function init() {
    document.addEventListener('click', onClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.makitAuthGate = { open: open, isGatedHref: isGatedHref };
})();
