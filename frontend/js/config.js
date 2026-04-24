// MaKIT runtime config
// Determines the API base URL depending on how the frontend is served.
//   - Served via Nginx or any HTTP/HTTPS server: same-origin /api
//   - Opened directly (file://) : http://localhost:8083/api
(function () {
  var isFileProtocol = (location.protocol === 'file:');
  var apiBase = isFileProtocol ? 'http://localhost:8083/api' : '/api';
  window.MAKIT_CONFIG = {
    apiBase: apiBase,
    storageKeys: {
      token: 'makit_token',
      refresh: 'makit_refresh',
      user: 'makit_user'
    }
  };
})();
