// Login page wiring — replaces the inline <script> previously in login.html.
(function () {
  function qs(sel) { return document.querySelector(sel); }

  function showMessage(html, type) {
    var messageDiv = qs('#message');
    if (!messageDiv) return;
    var cls = type === 'success' ? 'success-message' : 'error-message';
    messageDiv.innerHTML = '<div class="' + cls + '">' + html + '</div>';
  }

  async function doLogin(email, password) {
    var loginBtn = qs('#loginBtn');
    var loading = qs('#loading');
    if (loginBtn) loginBtn.disabled = true;
    if (loading) loading.style.display = 'block';
    showMessage('', 'info');

    try {
      var data = await api.auth.login(email, password);
      if (!data || !data.token) {
        showMessage('로그인에 실패했습니다.');
        return;
      }
      auth.saveSession(data);
      showMessage('로그인 성공! 플랫폼으로 이동합니다...', 'success');
      setTimeout(function () { location.href = 'index.html'; }, 1200);
    } catch (err) {
      var msg = (err && err.message) || '로그인에 실패했습니다.';
      if (err && err.code === 'NETWORK_ERROR') {
        msg = '서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해주세요.';
      }
      showMessage(msg, 'error');
      console.error('[login]', err);
    } finally {
      if (loginBtn) loginBtn.disabled = false;
      if (loading) loading.style.display = 'none';
    }
  }

  // Global helper used by demo-account buttons (onclick="fillDemoAccount(...)")
  window.fillDemoAccount = function (email, password) {
    var e = qs('#email'); var p = qs('#password');
    if (e) e.value = email;
    if (p) p.value = password;
  };

  function init() {
    var form = qs('#loginForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = qs('#email') ? qs('#email').value : '';
        var password = qs('#password') ? qs('#password').value : '';
        doLogin(email, password);
      });
    }

    // If already logged in, validate token and skip straight to index.
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
