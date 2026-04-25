// MaKIT User Menu — 우상단 프로필 드롭다운 (avatar + 이름 + 로그아웃)
//
// 자동 inject:
//   - DOMContentLoaded 시 #makit-user-menu가 없으면 body에 fixed-position으로 inject
//   - login 페이지는 비활성화
//   - 미로그인 상태에서는 마운트하지 않음
//
// 동작:
//   - avatar 클릭 → 드롭다운 토글
//   - "로그아웃" 클릭 → POST /api/auth/logout → clearSession → /login.html

(function () {
  if (window.__makitUserMenuMounted) return;
  window.__makitUserMenuMounted = true;

  if (/login\.html$/i.test(location.pathname)) return;
  if (!window.auth || !window.auth.isLoggedIn || !window.auth.isLoggedIn()) return;

  function escapeHtml(s) {
    if (window.ui && ui.escapeHtml) return ui.escapeHtml(s);
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function initials(name) {
    if (!name) return '?';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function build(user) {
    var name = (user && user.name) || (user && user.email) || '사용자';
    var email = (user && user.email) || '';
    var role = (user && user.role) || '';
    var avatarLabel = initials(name);

    var wrap = document.createElement('div');
    wrap.id = 'makit-user-menu';
    wrap.className = 'mk-user-menu';
    wrap.innerHTML =
      '<button type="button" class="mk-user-trigger" id="mkUserTrigger" aria-label="사용자 메뉴 열기" aria-haspopup="true" aria-expanded="false">' +
      '  <span class="mk-user-avatar" aria-hidden="true">' + escapeHtml(avatarLabel) + '</span>' +
      '  <span class="mk-user-name">' + escapeHtml(name) + '</span>' +
      '  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '    <path d="m6 9 6 6 6-6"></path>' +
      '  </svg>' +
      '</button>' +

      '<div class="mk-user-dropdown" role="menu" aria-hidden="true">' +
      '  <div class="mk-user-info">' +
      '    <span class="mk-user-avatar mk-user-avatar-lg" aria-hidden="true">' + escapeHtml(avatarLabel) + '</span>' +
      '    <div class="mk-user-info-text">' +
      '      <strong>' + escapeHtml(name) + '</strong>' +
      (email ? '<small>' + escapeHtml(email) + '</small>' : '') +
      (role ? '<span class="mk-user-role">' + escapeHtml(role) + '</span>' : '') +
      '    </div>' +
      '  </div>' +
      '  <hr class="mk-user-divider">' +
      '  <a href="history.html" class="mk-user-item" role="menuitem">' +
      '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' +
      '    활동 이력' +
      '  </a>' +
      '  <a href="settings.html" class="mk-user-item" id="mkUserSettings" role="menuitem">' +
      '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' +
      '    설정' +
      '  </a>' +
      '  <button type="button" class="mk-user-item mk-user-item-danger" id="mkUserLogout" role="menuitem">' +
      '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>' +
      '    로그아웃' +
      '  </button>' +
      '</div>';
    return wrap;
  }

  function bind(root) {
    var trigger = root.querySelector('#mkUserTrigger');
    var dropdown = root.querySelector('.mk-user-dropdown');
    var logout = root.querySelector('#mkUserLogout');
    var settings = root.querySelector('#mkUserSettings');

    function open() {
      dropdown.classList.add('mk-user-dropdown--open');
      dropdown.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
    }
    function close() {
      dropdown.classList.remove('mk-user-dropdown--open');
      dropdown.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dropdown.classList.contains('mk-user-dropdown--open')) close(); else open();
    });

    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    settings.addEventListener('click', function () { close(); /* native nav */ });

    logout.addEventListener('click', async function () {
      logout.disabled = true;
      try {
        if (window.api && api.auth && api.auth.logout) {
          await api.auth.logout().catch(function () {/* silent — JWT만 client에서 제거하면 충분 */});
        }
      } finally {
        if (window.auth && auth.clearSession) auth.clearSession();
        // 챗봇 widget 이력은 다음 사용자가 보지 않도록 함께 삭제
        try { localStorage.removeItem('makit_chat_history'); } catch (_) {}
        location.href = 'login.html';
      }
    });
  }

  function mount() {
    var user = (window.auth && auth.getUser && auth.getUser()) || null;
    var root = build(user);
    document.body.appendChild(root);
    bind(root);

    // 백그라운드로 /me 호출하여 최신 사용자 정보로 갱신
    if (window.api && api.auth && api.auth.me) {
      api.auth.me().then(function (latest) {
        if (latest) {
          try { localStorage.setItem('makit_user', JSON.stringify(latest)); } catch (_) {}
          // 라벨/이름 갱신
          var nameEl = root.querySelector('.mk-user-name');
          var infoStrong = root.querySelector('.mk-user-info strong');
          if (nameEl) nameEl.textContent = latest.name || latest.email || '사용자';
          if (infoStrong) infoStrong.textContent = latest.name || latest.email || '사용자';
        }
      }).catch(function () {/* 무시: 토큰 만료면 다음 보호 페이지에서 redirect */});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
