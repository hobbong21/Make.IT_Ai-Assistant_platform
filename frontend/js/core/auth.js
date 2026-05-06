// MaKIT auth helpers — session in localStorage.
(function () {
  var CONFIG = window.MAKIT_CONFIG || { storageKeys: { token: 'makit_token', refresh: 'makit_refresh', user: 'makit_user' } };
  var KEYS = CONFIG.storageKeys;

  var auth = {
    isLoggedIn: function () {
      return !!localStorage.getItem(KEYS.token);
    },
    getToken: function () {
      return localStorage.getItem(KEYS.token);
    },
    getUser: function () {
      try {
        return JSON.parse(localStorage.getItem(KEYS.user) || 'null');
      } catch (_) {
        return null;
      }
    },
    saveSession: function (loginResponse) {
      if (!loginResponse || !loginResponse.token) return;
      localStorage.setItem(KEYS.token, loginResponse.token);
      if (loginResponse.refreshToken) {
        localStorage.setItem(KEYS.refresh, loginResponse.refreshToken);
      }
      if (loginResponse.user) {
        localStorage.setItem(KEYS.user, JSON.stringify(loginResponse.user));
      }
    },
    clearSession: function () {
      localStorage.removeItem(KEYS.token);
      localStorage.removeItem(KEYS.refresh);
      localStorage.removeItem(KEYS.user);
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
