// History page — GET /api/audit-logs/me 페이지네이션 + 필터
(function () {
  var state = { page: 0, size: 20, filter: 'ALL', total: 0 };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function actionLabel(action) {
    var map = {
      LOGIN: '로그인',
      LOGOUT: '로그아웃',
      REGISTER: '회원가입',
      SERVICE_CALL: '서비스 호출',
      API_CALL: 'API 호출',
      ERROR: '오류'
    };
    return map[action] || action;
  }

  function actionInitial(action) {
    var map = { LOGIN: 'IN', LOGOUT: 'OUT', REGISTER: 'NEW', SERVICE_CALL: 'API', API_CALL: 'API', ERROR: '!' };
    return map[action] || (action || '?').slice(0, 2).toUpperCase();
  }

  function formatTime(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      var now = new Date();
      var diffH = (now - d) / (1000 * 60 * 60);
      if (diffH < 1) {
        var min = Math.max(1, Math.floor((now - d) / (1000 * 60)));
        return min + '분 전';
      }
      if (diffH < 24) return Math.floor(diffH) + '시간 전';
      var diffD = Math.floor(diffH / 24);
      if (diffD < 7) return diffD + '일 전';
      return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) { return iso; }
  }

  function renderList(items) {
    var box = document.getElementById('historyList');
    if (!box) return;
    if (!items || !items.length) {
      box.innerHTML = '<div class="history-empty"><p>표시할 이력이 없습니다.</p></div>';
      return;
    }
    var html = items.map(function (it) {
      var action = it.action || '';
      var resource = it.resource || '';
      var initial = actionInitial(action);
      return '<div class="history-item">' +
        '<span class="hi-icon hi-icon-' + escapeHtml(action) + '">' + escapeHtml(initial) + '</span>' +
        '<div class="hi-body">' +
        '  <p class="hi-action">' + escapeHtml(actionLabel(action)) + '</p>' +
        (resource ? '  <p class="hi-resource">' + escapeHtml(resource) + '</p>' : '') +
        '</div>' +
        '<span class="hi-time" title="' + escapeHtml(it.createdAt || '') + '">' + escapeHtml(formatTime(it.createdAt)) + '</span>' +
        '</div>';
    }).join('');
    box.innerHTML = html;
  }

  function renderPagination(page) {
    var pgInfo = document.getElementById('pgInfo');
    var prev = document.getElementById('pgPrev');
    var next = document.getElementById('pgNext');
    var box = document.getElementById('historyPagination');
    if (!pgInfo || !prev || !next || !box) return;

    var totalPages = page.totalPages || 1;
    var current = (page.number || 0) + 1;
    pgInfo.textContent = current + ' / ' + totalPages + ' (총 ' + (page.totalElements || 0) + '건)';
    prev.disabled = page.first === true;
    next.disabled = page.last === true;
    box.hidden = totalPages <= 1;
  }

  async function load() {
    var box = document.getElementById('historyList');
    // 로딩 skeleton 표시
    if (box && window.makitSkeleton) {
      box.innerHTML = '';
      for (var i = 0; i < 8; i++) {
        box.appendChild(window.makitSkeleton.listRow());
      }
    }
    try {
      var pageData = await api.audit.mine({ page: state.page, size: state.size });
      var items = pageData.content || [];
      // 클라이언트 사이드 필터 (간단)
      if (state.filter !== 'ALL') {
        items = items.filter(function (it) { return it.action === state.filter; });
      }
      renderList(items);
      renderPagination(pageData);
      state.total = pageData.totalElements || 0;
    } catch (err) {
      console.error('[history]', err);
      if (box) {
        var msg = (err && err.message) || '이력을 불러올 수 없습니다.';
        box.innerHTML = '<div class="history-empty"><p>' + escapeHtml(msg) + '</p></div>';
      }
      if (err && err.status === 401) {
        auth.clearSession();
        location.href = 'login.html';
      }
    }
  }

  function bindFilters() {
    document.querySelectorAll('.filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        state.filter = chip.dataset.filter || 'ALL';
        state.page = 0;
        load();
      });
    });

    var prev = document.getElementById('pgPrev');
    var next = document.getElementById('pgNext');
    if (prev) prev.addEventListener('click', function () {
      if (state.page > 0) { state.page--; load(); }
    });
    if (next) next.addEventListener('click', function () { state.page++; load(); });
  }

  function init() {
    if (!auth.requireLogin()) return;
    bindFilters();
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
