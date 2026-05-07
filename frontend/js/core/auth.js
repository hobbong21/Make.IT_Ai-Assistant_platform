// MaKIT auth helpers — session in localStorage (영구) 또는 sessionStorage (탭 만료).
// remember=true (기본): localStorage. remember=false: sessionStorage (탭 닫으면 만료).
(function () {
  var CONFIG = window.MAKIT_CONFIG || { storageKeys: { token: 'makit_token', refresh: 'makit_refresh', user: 'makit_user' } };
  var KEYS = CONFIG.storageKeys;

  function readBoth(key) {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  }
  function clearBoth(key) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }

  var auth = {
    isLoggedIn: function () {
      return !!readBoth(KEYS.token);
    },
    getToken: function () {
      return readBoth(KEYS.token);
    },
    getUser: function () {
      try {
        return JSON.parse(readBoth(KEYS.user) || 'null');
      } catch (_) {
        return null;
      }
    },
    /**
     * 세션 저장.
     * @param {object} loginResponse - { token, refreshToken, user }
     * @param {boolean} [remember=true] - true: localStorage(영구). false: sessionStorage(탭 만료).
     */
    saveSession: function (loginResponse, remember) {
      if (!loginResponse || !loginResponse.token) return;
      if (remember === undefined) remember = true;
      var store = remember ? localStorage : sessionStorage;
      var other = remember ? sessionStorage : localStorage;
      // 다른 store의 잔존 데이터 제거 (스토리지 혼선 방지)
      other.removeItem(KEYS.token);
      other.removeItem(KEYS.refresh);
      other.removeItem(KEYS.user);
      store.setItem(KEYS.token, loginResponse.token);
      if (loginResponse.refreshToken) {
        store.setItem(KEYS.refresh, loginResponse.refreshToken);
      }
      if (loginResponse.user) {
        store.setItem(KEYS.user, JSON.stringify(loginResponse.user));
      }
    },
    /**
     * 사용자 정보만 갱신. 현재 토큰이 있는 스토어(session 우선)에 기록 — remember 정책 일관성 보장.
     */
    updateUser: function (user) {
      if (!user) return;
      var store = sessionStorage.getItem(KEYS.token) ? sessionStorage : localStorage;
      try { store.setItem(KEYS.user, JSON.stringify(user)); } catch (_) {}
    },
    clearSession: function () {
      clearBoth(KEYS.token);
      clearBoth(KEYS.refresh);
      clearBoth(KEYS.user);
    },
    requireLogin: function () {
      if (!auth.isLoggedIn() && !/login\.html$/.test(location.pathname)) {
        location.href = 'login.html';
        return false;
      }
      return true;
    }
  };

  window.auth = auth;
})();
