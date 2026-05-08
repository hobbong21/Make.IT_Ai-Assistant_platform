// Index (overview) page wiring.
// - PUBLIC page (login NOT required); user-specific data only loaded when logged in
// - Fetches /auth/me and renders user name in sidebar if a slot exists
// - Handles sidebar dropdown toggles
(function () {
  function init() {
    // Wire dropdown toggles (present in some sidebars)
    document.querySelectorAll('.nav-dropdown-header').forEach(function (h) {
      h.addEventListener('click', function () {
        var d = h.parentElement;
        if (d) d.classList.toggle('expanded');
      });
    });

    // 비로그인 사용자도 페이지를 볼 수 있음. 사용자/대시보드 API는 로그인 시에만 호출.
    if (!auth.isLoggedIn()) return;

    var cachedUser = auth.getUser();
    renderUser(cachedUser);

    api.auth.me().then(renderUser).catch(function (err) {
      console.warn('[index] /auth/me failed', err);
      if (err && err.code === 'NETWORK_ERROR') {
        ui.toast('서버와 연결할 수 없습니다.', 'error');
      }
    });

    // 대시보드 통계 동적 로드 (skeleton 표시)
    if (api.dashboard && api.dashboard.stats) {
      showStatsSkeleton();
      api.dashboard.stats().then(renderStats).catch(function (err) {
        console.warn('[index] /dashboard/stats failed (hardcoded fallback 유지)', err);
        clearStatsSkeleton();
      });
    }

    // 7일 활동 차트 (skeleton 표시)
    if (api.dashboard && api.dashboard.activity) {
      showActivitySkeleton();
      api.dashboard.activity(7).then(renderActivityChart).catch(function (err) {
        console.warn('[index] /dashboard/activity failed', err);
        clearActivitySkeleton();
      });
    }
  }

  function renderActivityChart(buckets) {
    if (!buckets || !buckets.length) return;
    var canvas = document.getElementById('activityChart');
    if (!canvas || typeof Chart === 'undefined') return;

    var labels = buckets.map(function (b) {
      try {
        var d = new Date(b.date);
        return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
      } catch (_) { return b.date; }
    });
    var counts = buckets.map(function (b) { return Number(b.count) || 0; });

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '활동 수',
          data: counts,
          backgroundColor: '#2563eb',
          borderRadius: 6,
          maxBarThickness: 36
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1a',
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: function (ctx) { return ctx.parsed.y + '회'; }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#737373' },
            grid: { color: '#e6e6e6', drawBorder: false }
          },
          x: {
            ticks: { color: '#737373' },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderStats(stats) {
    if (!stats) return;
    var cards = document.querySelectorAll('.stats-grid .stat-card');
    if (!cards || cards.length < 4) return;
    var fmt = function (n) { return n != null ? Number(n).toLocaleString() : '0'; };

    var dataMap = [
      { number: fmt(stats.userCount), suffix: '명', label: '전체 사용자' },
      { number: fmt(stats.myRequestCount), suffix: '회', label: '내 요청' },
      { number: fmt(stats.myJobsInProgress), suffix: '건', label: '진행중 작업' },
      { number: stats.lastLoginAt ? formatDate(stats.lastLoginAt) : '신규',
        suffix: '', label: '마지막 로그인' }
    ];
    dataMap.forEach(function (d, i) {
      var card = cards[i];
      if (!card) return;
      var numEl = card.querySelector('.stat-number');
      var labelEl = card.querySelector('.stat-label');
      if (numEl) numEl.innerHTML = ui.escapeHtml(d.number) +
        (d.suffix ? '<span>' + ui.escapeHtml(d.suffix) + '</span>' : '');
      if (labelEl) labelEl.textContent = d.label;
    });
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      var now = new Date();
      var diffH = (now - d) / (1000 * 60 * 60);
      if (diffH < 1) return '방금';
      if (diffH < 24) return Math.floor(diffH) + '시간 전';
      var diffD = Math.floor(diffH / 24);
      if (diffD < 7) return diffD + '일 전';
      return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    } catch (_) { return '—'; }
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

  // Skeleton loading for dashboard stats cards
  function showStatsSkeleton() {
    var cards = document.querySelectorAll('.stats-grid .stat-card');
    cards.forEach(function (card) {
      var numEl = card.querySelector('.stat-number');
      var labelEl = card.querySelector('.stat-label');
      if (numEl) {
        numEl.innerHTML = '';
        numEl.appendChild(window.makitSkeleton.row({heading: true, width: 50}));
      }
      if (labelEl) {
        labelEl.innerHTML = '';
        labelEl.appendChild(window.makitSkeleton.row({width: 60}));
      }
    });
  }

  function clearStatsSkeleton() {
    // renderStats will replace skeleton when data arrives
  }

  // Skeleton loading for activity chart
  function showActivitySkeleton() {
    var chartWrap = document.getElementById('activityChart');
    if (chartWrap) {
      chartWrap.innerHTML = '';
      var skeleton = document.createElement('div');
      skeleton.className = 'mk-skeleton mk-skeleton--card';
      skeleton.style.height = '250px';
      skeleton.style.marginTop = 'var(--mk-space-3)';
      chartWrap.parentNode.insertBefore(skeleton, chartWrap);
      chartWrap.style.display = 'none';
    }
  }

  function clearActivitySkeleton() {
    var skeleton = document.querySelector('.mk-skeleton.mk-skeleton--card');
    if (skeleton) skeleton.remove();
    var chartWrap = document.getElementById('activityChart');
    if (chartWrap) chartWrap.style.display = '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
