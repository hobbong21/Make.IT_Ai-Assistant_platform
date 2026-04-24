// Login / Register page wiring
(function () {
  function qs(sel) { return document.querySelector(sel); }

  function showMessage(id, html, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = html
      ? '<span class="' + (type === 'success' ? 'msg-success' : 'msg-error') + '">' + html + '</span>'
      : '';
  }

  function setLoading(spinnerId, btnId, loading) {
    var spinner = document.getElementById(spinnerId);
    var btn = document.getElementById(btnId);
    if (spinner) spinner.style.display = loading ? 'block' : 'none';
    if (btn) btn.disabled = loading;
  }

  // ── Login ──────────────────────────────────────────────
  async function doLogin(email, password) {
    setLoading('loginSpinner', 'loginBtn', true);
    showMessage('loginMessage', '', '');
    try {
      var data = await api.auth.login(email, password);
      if (!data || !data.token) {
        showMessage('loginMessage', '로그인에 실패했습니다.', 'error');
        return;
      }
      auth.saveSession(data);
      showMessage('loginMessage', '로그인 성공! 플랫폼으로 이동합니다...', 'success');
      setTimeout(function () { location.href = 'index.html'; }, 1000);
    } catch (err) {
      var msg = (err && err.message) || '로그인에 실패했습니다.';
      if (err && err.code === 'NETWORK_ERROR') {
        msg = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
      }
      showMessage('loginMessage', msg, 'error');
      console.error('[login]', err);
    } finally {
      setLoading('loginSpinner', 'loginBtn', false);
    }
  }

  // ── Register ───────────────────────────────────────────
  async function doRegister(name, email, password, passwordConfirm) {
    if (password !== passwordConfirm) {
      showMessage('registerMessage', '비밀번호가 일치하지 않습니다.', 'error');
      return;
    }
    if (password.length < 6) {
      showMessage('registerMessage', '비밀번호는 6자 이상이어야 합니다.', 'error');
      return;
    }
    setLoading('registerSpinner', 'registerBtn', true);
    showMessage('registerMessage', '', '');
    try {
      var data = await api.auth.register({ name: name, email: email, password: password });
      if (!data || !data.token) {
        showMessage('registerMessage', '회원가입에 실패했습니다.', 'error');
        return;
      }
      auth.saveSession(data);
      showMessage('registerMessage', '가입 완료! 플랫폼으로 이동합니다...', 'success');
      setTimeout(function () { location.href = 'index.html'; }, 1000);
    } catch (err) {
      var msg = (err && err.message) || '회원가입에 실패했습니다.';
      if (err && err.code === 'NETWORK_ERROR') {
        msg = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
      }
      showMessage('registerMessage', msg, 'error');
      console.error('[register]', err);
    } finally {
      setLoading('registerSpinner', 'registerBtn', false);
    }
  }

  function init() {
    var loginForm = qs('#loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = qs('#email') ? qs('#email').value.trim() : '';
        var password = qs('#password') ? qs('#password').value : '';
        doLogin(email, password);
      });
    }

    var registerForm = qs('#registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = qs('#regName') ? qs('#regName').value.trim() : '';
        var email = qs('#regEmail') ? qs('#regEmail').value.trim() : '';
        var password = qs('#regPassword') ? qs('#regPassword').value : '';
        var confirm = qs('#regPasswordConfirm') ? qs('#regPasswordConfirm').value : '';
        doRegister(name, email, password, confirm);
      });
    }

    // If already logged in, go straight to dashboard.
    if (auth.isLoggedIn()) {
      api.auth.me().then(function () {
        location.href = 'index.html';
      }).catch(function () {
        auth.clearSession();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
