// Index (overview) page wiring.
// - Requires login
// - Fetches /auth/me and renders user name in sidebar if a slot exists
// - Handles sidebar dropdown toggles
(function () {
  function init() {
    if (!auth.requireLogin()) return;

    // Wire dropdown toggles (present in some sidebars)
    document.querySelectorAll('.nav-dropdown-header').forEach(function (h) {
      h.addEventListener('click', function () {
        var d = h.parentElement;
        if (d) d.classList.toggle('expanded');
      });
    });

    var cachedUser = auth.getUser();
    renderUser(cachedUser);

    api.auth.me().then(renderUser).catch(function (err) {
      console.warn('[index] /auth/me failed', err);
      if (err && err.code === 'NETWORK_ERROR') {
        ui.toast('서버와 연결할 수 없습니다.', 'error');
      }
    });
  }

  function renderUser(user) {
    if (!user) return;
    // Update a dedicated slot if the design includes one; otherwise no-op.
    var slot = document.getElementById('user-name')
      || document.querySelector('[data-user-name]');
    if (slot) slot.textContent = user.name || user.email || '';

    var emailSlot = document.querySelector('[data-user-email]');
    if (emailSlot) emailSlot.textContent = user.email || '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
