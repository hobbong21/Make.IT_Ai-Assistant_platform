// Settings page — 프로필/비밀번호/테마
(function () {
  function byId(id) { return document.getElementById(id); }
  function showMsg(id, text, ok) {
    var el = byId(id); if (!el) return;
    el.innerHTML = text ? '<span class="' + (ok ? 'msg-success' : 'msg-error') + '">' + text + '</span>' : '';
  }

  function init() {
    if (!auth.requireLogin()) return;

    // 프로필 로드
    var u = auth.getUser() || {};
    if (byId('profName')) byId('profName').value = u.name || '';
    if (byId('profEmail')) byId('profEmail').value = u.email || '';

    api.auth.me().then(function (latest) {
      if (latest) {
        if (byId('profName')) byId('profName').value = latest.name || '';
        if (byId('profEmail')) byId('profEmail').value = latest.email || '';
        try { localStorage.setItem('makit_user', JSON.stringify(latest)); } catch (_) {}
      }
    }).catch(function () {});

    // 프로필 폼
    var profForm = byId('profileForm');
    if (profForm) {
      profForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = byId('profSaveBtn'); if (btn) btn.disabled = true;
        showMsg('profMessage', '', true);
        try {
          var updated = await api.auth.updateProfile({
            name: byId('profName').value.trim(),
            email: byId('profEmail').value.trim()
          });
          if (updated) {
            try { localStorage.setItem('makit_user', JSON.stringify(updated)); } catch (_) {}
            showMsg('profMessage', '프로필이 저장되었습니다.', true);
          }
        } catch (err) {
          var msg = err && err.message || '저장 실패';
          if (err && err.status === 409) msg = '이미 사용 중인 이메일입니다.';
          showMsg('profMessage', msg, false);
        } finally { if (btn) btn.disabled = false; }
      });
    }

    // 비밀번호 폼
    var pwForm = byId('pwForm');
    if (pwForm) {
      pwForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var oldP = byId('pwOld').value;
        var newP = byId('pwNew').value;
        var confirm = byId('pwNewConfirm').value;
        if (!oldP || !newP || newP.length < 6) {
          showMsg('pwMessage', '비밀번호는 6자 이상이어야 합니다.', false); return;
        }
        if (newP !== confirm) {
          showMsg('pwMessage', '새 비밀번호가 일치하지 않습니다.', false); return;
        }
        var btn = byId('pwSaveBtn'); if (btn) btn.disabled = true;
        showMsg('pwMessage', '', true);
        try {
          await api.auth.changePassword({ oldPassword: oldP, newPassword: newP });
          showMsg('pwMessage', '비밀번호가 변경되었습니다.', true);
          pwForm.reset();
        } catch (err) {
          var msg = err && err.message || '변경 실패';
          if (err && (err.code === 'CURRENT_PASSWORD_MISMATCH' || err.status === 400)) {
            msg = '현재 비밀번호가 올바르지 않습니다.';
          }
          showMsg('pwMessage', msg, false);
        } finally { if (btn) btn.disabled = false; }
      });
    }

    // 테마 토글
    var current = (window.makitTheme && makitTheme.get()) || 'auto';
    document.querySelectorAll('.theme-opt').forEach(function (b) {
      if (b.dataset.theme === current) b.classList.add('active');
      b.setAttribute('aria-checked', b.dataset.theme === current ? 'true' : 'false');
      b.addEventListener('click', function () {
        var t = b.dataset.theme;
        if (window.makitTheme) makitTheme.set(t);
        document.querySelectorAll('.theme-opt').forEach(function (x) {
          x.classList.toggle('active', x === b);
          x.setAttribute('aria-checked', x === b ? 'true' : 'false');
        });
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
