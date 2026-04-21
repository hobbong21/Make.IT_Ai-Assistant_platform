// MaKIT runtime config
// Determines the API base URL depending on how the frontend is served.
//   - Served via Nginx (production/dev compose): same-origin /api (Nginx proxies to backend:8083)
//   - Opened directly (file://) or by a static file server on a random port: http://localhost:8083/api
(function () {
  var isFileProtocol = (location.protocol === 'file:');
  var isDirectStatic = (!location.port || location.port === '');
  var apiBase = '/api';
  if (isFileProtocol || isDirectStatic) {
    apiBase = 'http://localhost:8083/api';
  }
  window.MAKIT_CONFIG = {
    apiBase: apiBase,
    storageKeys: {
      token: 'makit_token',
      refresh: 'makit_refresh',
      user: 'makit_user'
    }
  };
})();
