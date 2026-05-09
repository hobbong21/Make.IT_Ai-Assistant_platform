// Login / Register page wiring (실제 backend AuthController 연동) v3
//
// 새 login.html v2 ID 패턴에 동기화:
//   loginEmail / loginPassword / loginMessage / loginBtn / loginSpinner / rememberMe
//   regName / regEmail / regPassword / regPasswordConfirm / regMessage / regBtn / regSpinner / agreeTerms
//
// inline onclick="doLogin()" / "doRegister()"용 글로벌 함수 노출.
// Form submit 이벤트도 동시에 바인딩 (Enter 키 지원).

(function () {
  function qs(sel) { return document.querySelector(sel); }
  function byId(id) { return document.getElementById(id); }

  function showMessage(id, html, type) {
    var el = byId(id);
    if (!el) return;
    el.innerHTML = html
      ? '<span class="' + (type === 'success' ? 'msg-success' : 'msg-error') + '">' + html + '</span>'
      : '';
  }

  function setLoading(spinnerId, btnId, loading) {
    var spinner = byId(spinnerId);
    var btn = byId(btnId);
    if (spinner) spinner.style.display = loading ? 'block' : 'none';
    if (btn) btn.disabled = loading;
  }

  function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
  }

  // ?redirect=... 쿼리 파라미터를 안전하게 파싱하여 동일 출처 상대경로만 허용.
  function getRedirectDest(fallback) {
    try {
      var raw = new URLSearchParams(location.search).get('redirect');
      if (!raw) return fallback;
      // 외부 URL/프로토콜 인젝션 방어: 상대 경로(.html)만 허용
      if (/^https?:\/\//i.test(raw) || raw.indexOf('//') === 0 || raw.charAt(0) === '/') return fallback;
      if (!/\.html(\?|#|$)/.test(raw)) return fallback;
      return raw;
    } catch (_) { return fallback; }
  }

  // ---- Login ----
  async function doLogin() {
    var email = byId('loginEmail') ? byId('loginEmail').value.trim() : '';
    var password = byId('loginPassword') ? byId('loginPassword').value : '';
    var rememberEl = byId('rememberMe');
    var remember = rememberEl ? !!rememberEl.checked : true;

    if (!isValidEmail(email)) {
      showMessage('loginMessage', '올바른 이메일 형식이 아닙니다.', 'error');
      return;
    }
    if (!password || password.length < 6) {
      showMessage('loginMessage', '비밀번호는 6자 이상이어야 합니다.', 'error');
      return;
    }

    setLoading('loginSpinner', 'loginBtn', true);
    showMessage('loginMessage', '', '');
    try {
      var data = await api.auth.login(email, password);
      if (!data || !data.token) {
        showMessage('loginMessage', '로그인에 실패했습니다.', 'error');
        return;
      }
      auth.saveSession(data, remember);
      var dest = getRedirectDest('index.html');
      showMessage('loginMessage', '로그인 성공! 이동합니다…', 'success');
      setTimeout(function () { location.href = dest; }, 800);
    } catch (err) {
      var msg = (err && err.message) || '로그인에 실패했습니다.';
      if (err && err.code === 'NETWORK_ERROR') {
        msg = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
      } else if (err && (err.status === 401 || err.code === 'INVALID_CREDENTIALS')) {
        msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
      } else if (err && err.status === 429) {
        msg = '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.';
      }
      showMessage('loginMessage', msg, 'error');
      console.error('[login]', err);
    } finally {
      setLoading('loginSpinner', 'loginBtn', false);
    }
  }

  // ---- Register (성공 시 자동 로그인) ----
  async function doRegister() {
    var name = byId('regName') ? byId('regName').value.trim() : '';
    var email = byId('regEmail') ? byId('regEmail').value.trim() : '';
    var password = byId('regPassword') ? byId('regPassword').value : '';
    var passwordConfirm = byId('regPasswordConfirm') ? byId('regPasswordConfirm').value : '';

    if (!name || name.length < 1) {
      showMessage('regMessage', '이름을 입력해주세요.', 'error');
      return;
    }
    if (!isValidEmail(email)) {
      showMessage('regMessage', '올바른 이메일 형식이 아닙니다.', 'error');
      return;
    }
    if (password.length < 6) {
      showMessage('regMessage', '비밀번호는 6자 이상이어야 합니다.', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      showMessage('regMessage', '비밀번호가 일치하지 않습니다.', 'error');
      return;
    }
    var agree = byId('agreeTerms');
    if (agree && !agree.checked) {
      showMessage('regMessage', '이용약관에 동의해주세요.', 'error');
      return;
    }

    setLoading('regSpinner', 'regBtn', true);
    showMessage('regMessage', '', '');
    try {
      // 회원가입 한 번에 — 백엔드 /api/auth/register가 이미 {token, refreshToken, user}를 반환.
      var data = await api.auth.register({ name: name, email: email, password: password });

      if (data && data.token) {
        auth.saveSession(data, true); // 신규 가입자는 remember=true 기본
        var dest2 = getRedirectDest('index.html');
        showMessage('regMessage', '환영합니다! 이동합니다…', 'success');
        setTimeout(function () { location.href = dest2; }, 800);
        return;
      }

      // (이론상 도달 안 함) 토큰을 못 받으면 로그인 탭으로 안내
      showMessage('regMessage', '가입은 완료되었습니다. 로그인 탭에서 로그인해주세요.', 'success');
      setTimeout(function () {
        if (typeof window.switchTab === 'function') window.switchTab(null, 'login');
        var emailEl = byId('loginEmail');
        if (emailEl) emailEl.value = email;
      }, 1200);
    } catch (err) {
      var msg = (err && err.message) || '회원가입에 실패했습니다.';
      if (err && err.code === 'NETWORK_ERROR') {
        msg = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
      } else if (err && (err.status === 409 || err.code === 'EMAIL_ALREADY_EXISTS')) {
        msg = '이미 가입된 이메일입니다. 로그인 탭에서 로그인해주세요.';
      } else if (err && err.status === 400) {
        msg = msg || '입력 정보를 확인해주세요.';
      }
      showMessage('regMessage', msg, 'error');
      console.error('[register]', err);
    } finally {
      setLoading('regSpinner', 'regBtn', false);
    }
  }

  // ---- Init ----
  function init() {
    // form submit 이벤트 (Enter 키 지원)
    var loginForm = byId('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) { e.preventDefault(); doLogin(); });
    }
    var registerForm = byId('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', function (e) { e.preventDefault(); doRegister(); });
    }

    // 비밀번호 찾기 — 현재는 안내 메시지만 노출 (백엔드 미구현)
    var forgot = byId('forgotPasswordLink');
    if (forgot) {
      forgot.addEventListener('click', function (e) {
        e.preventDefault();
        var email = byId('loginEmail') ? byId('loginEmail').value.trim() : '';
        if (email && isValidEmail(email)) {
          showMessage('loginMessage', email + ' 으로 재설정 안내를 보낼 예정입니다. (현재 준비중)', 'success');
        } else {
          showMessage('loginMessage', '비밀번호 재설정 기능은 준비중입니다. 관리자에게 문의해주세요.', 'error');
        }
      });
    }

    // 로그인 필수 페이지에서 리다이렉트되어 온 경우 안내 메시지 표시
    try {
      var qp = new URLSearchParams(location.search);
      if (qp.get('reason') === 'required') {
        showMessage('loginMessage', '로그인이 필요한 서비스입니다. 계속하시려면 로그인해주세요.', 'error');
      }
    } catch (_) {}

    // 이미 로그인된 사용자는 세션 검증 후 원래 가려던 곳(또는 index)으로
    if (auth.isLoggedIn()) {
      api.auth.me().then(function () {
        location.href = getRedirectDest('index.html');
      }).catch(function () {
        auth.clearSession();
      });
    }
  }

  // inline onclick="doLogin()"/"doRegister()" 호환을 위해 window 노출
  window.doLogin = doLogin;
  window.doRegister = doRegister;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
