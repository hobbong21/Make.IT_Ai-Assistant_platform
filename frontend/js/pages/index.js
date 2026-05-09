// Index (마이페이지) wiring.
// - PUBLIC page (login NOT required); user-specific data only loaded when logged in
// - Renders profile hero, my-snapshot stats, recent activity, 7-day chart
(function () {
  var SESSION_KEY = 'mk_session_started_at';

  function init() {
    // Sidebar dropdown toggles
    document.querySelectorAll('.nav-dropdown-header').forEach(function (h) {
      h.addEventListener('click', function () {
        var d = h.parentElement;
        if (d) d.classList.toggle('expanded');
      });
    });

    // 비로그인 사용자도 페이지를 볼 수 있음. 사용자/대시보드 API는 로그인 시에만 호출.
    if (!auth.isLoggedIn()) {
      renderGuestProfile();
      return;
    }

    // 세션 시작 시각 캐시 (접속 표시용)
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    }

    var cachedUser = auth.getUser();
    renderProfileHero(cachedUser);

    api.auth.me().then(renderProfileHero).catch(function (err) {
      console.warn('[index] /auth/me failed', err);
      if (err && err.code === 'NETWORK_ERROR') {
        if (window.ui && ui.toast) ui.toast('서버와 연결할 수 없습니다.', 'error');
      }
    });

    if (api.dashboard && api.dashboard.stats) {
      showStatsSkeleton();
      api.dashboard.stats().then(renderStats).catch(function (err) {
        console.warn('[index] /dashboard/stats failed', err);
        clearStatsSkeleton();
      });
    }

    if (api.dashboard && api.dashboard.activity) {
      showActivitySkeleton();
      api.dashboard.activity(7).then(renderActivityChart).catch(function (err) {
        console.warn('[index] /dashboard/activity failed', err);
        clearActivitySkeleton();
      });
    }

    if (api.audit && api.audit.mine) {
      api.audit.mine({ page: 0, size: 5 }).then(renderRecentActivity).catch(function (err) {
        console.warn('[index] /audit-logs/me failed', err);
      });
    }
  }

  // ── 프로필 히어로 ────────────────────────────────────────────────
  function renderGuestProfile() {
    setText('[data-user-name]', '게스트');
    setText('[data-user-email]', '로그인 후 마이페이지를 이용할 수 있습니다.');
    setText('[data-session-since]', '—');
    var sep = document.querySelector('[data-meta-sep]');
    if (sep) sep.style.display = 'none';
    var badge = document.querySelector('[data-user-role-badge]');
    if (badge) {
      badge.textContent = '방문자';
      badge.removeAttribute('data-role');
    }
    var avatar = document.getElementById('profileAvatar');
    if (avatar) avatar.textContent = '?';
  }

  function renderProfileHero(user) {
    if (!user) return;
    var name = user.name || (user.email ? user.email.split('@')[0] : '사용자');
    setText('[data-user-name]', name);
    setText('[data-user-email]', user.email || '');

    var sep = document.querySelector('[data-meta-sep]');
    if (sep) sep.style.display = '';

    var role = (user.role || 'USER').toUpperCase();
    var roleLabel = roleToLabel(role);
    var badge = document.querySelector('[data-user-role-badge]');
    if (badge) {
      badge.textContent = roleLabel;
      badge.setAttribute('data-role', role);
    }

    var avatar = document.getElementById('profileAvatar');
    if (avatar) {
      var initial = (name || '?').trim().charAt(0).toUpperCase();
      avatar.textContent = initial || '?';
    }

    var since = sessionStorage.getItem(SESSION_KEY);
    setText('[data-session-since]', since ? formatRelative(Number(since)) : '방금');

    // 호환: 기존 사용자 메뉴 위젯이 같은 selector를 쓸 수 있음
    var legacy = document.getElementById('user-name');
    if (legacy) legacy.textContent = name;
  }

  function roleToLabel(role) {
    if (role === 'ADMIN') return '관리자';
    if (role === 'MARKETER') return '마케터';
    return '일반 사용자';
  }

  // ── 내 활동 스냅샷 ────────────────────────────────────────────────
  function renderStats(stats) {
    if (!stats) return;
    var cards = document.querySelectorAll('.stats-grid .stat-card');
    if (!cards || cards.length < 4) return;
    var fmt = function (n) { return n != null ? Number(n).toLocaleString() : '0'; };

    var dataMap = [
      { number: fmt(stats.aiCallsToday), suffix: '회', label: '오늘 AI 호출' },
      { number: fmt(stats.aiCallsMonth), suffix: '회', label: '월간 AI 호출' },
      { number: fmt(stats.activeCampaigns), suffix: '건', label: '활성 캠페인' },
      { number: fmt(stats.myJobsInProgress != null ? stats.myJobsInProgress : (stats.totalCampaigns || 0)),
        suffix: '건', label: '진행중 작업' }
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

  // ── 최근 활동 타임라인 ─────────────────────────────────────────────
  function renderRecentActivity(page) {
    var list = document.getElementById('recentActivityList');
    if (!list) return;
    var items = (page && (page.content || page.items)) || [];
    if (!items.length) {
      list.innerHTML = '<li class="recent-activity-empty">최근 활동이 없습니다. 서비스를 사용해 보세요.</li>';
      return;
    }
    var html = items.slice(0, 5).map(function (it) {
      var icon = actionIcon(it.action);
      var title = ui.escapeHtml(it.detail || it.action || '활동');
      var tag = ui.escapeHtml((it.action || '').replace(/_/g, ' ').toLowerCase());
      var time = it.createdAt ? formatRelative(new Date(it.createdAt).getTime()) : '';
      return '' +
        '<li class="recent-activity-item">' +
          '<span class="recent-activity-icon" aria-hidden="true">' + icon + '</span>' +
          '<span class="recent-activity-body">' +
            '<span class="recent-activity-title">' + title + '</span>' +
            '<span class="recent-activity-tag">' + tag + '</span>' +
          '</span>' +
          '<span class="recent-activity-time">' + ui.escapeHtml(time) + '</span>' +
        '</li>';
    }).join('');
    list.innerHTML = html;
  }

  function actionIcon(action) {
    var a = String(action || '').toUpperCase();
    if (a.indexOf('LOGIN') >= 0) return '🔑';
    if (a.indexOf('CAMPAIGN') >= 0) return '📣';
    if (a.indexOf('AI') >= 0 || a.indexOf('GENERATION') >= 0) return '✨';
    if (a.indexOf('ANALYSIS') >= 0) return '📊';
    if (a.indexOf('DELETE') >= 0) return '🗑️';
    if (a.indexOf('UPDATE') >= 0 || a.indexOf('STATUS') >= 0) return '✏️';
    return '•';
  }

  // ── 7일 활동 차트 ────────────────────────────────────────────────
  function renderActivityChart(payload) {
    // 응답 호환: 배열(List<Bucket>) 또는 {activities,total} / {buckets} 객체
    var buckets = Array.isArray(payload) ? payload
      : (payload && (payload.buckets || payload.activities)) || [];
    clearActivitySkeleton();
    if (!buckets.length) return;
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
          backgroundColor: '#c96442',
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
            callbacks: { label: function (ctx) { return ctx.parsed.y + '회'; } }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#737373' },
            grid: { color: '#e6e6e6', drawBorder: false }
          },
          x: { ticks: { color: '#737373' }, grid: { display: false } }
        }
      }
    });
  }

  // ── 유틸 ──────────────────────────────────────────────────────────
  function setText(selector, text) {
    var el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  function formatRelative(ts) {
    try {
      var now = Date.now();
      var diffM = Math.floor((now - ts) / 60000);
      if (diffM < 1) return '방금';
      if (diffM < 60) return diffM + '분 전';
      var diffH = Math.floor(diffM / 60);
      if (diffH < 24) return diffH + '시간 전';
      var diffD = Math.floor(diffH / 24);
      if (diffD < 7) return diffD + '일 전';
      var d = new Date(ts);
      return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    } catch (_) { return '—'; }
  }

  // ── Skeleton (stats / activity) ───────────────────────────────────
  function showStatsSkeleton() {
    var cards = document.querySelectorAll('.stats-grid .stat-card');
    cards.forEach(function (card) {
      var numEl = card.querySelector('.stat-number');
      var labelEl = card.querySelector('.stat-label');
      if (numEl && window.makitSkeleton) {
        numEl.innerHTML = '';
        numEl.appendChild(window.makitSkeleton.row({ heading: true, width: 50 }));
      }
      if (labelEl && window.makitSkeleton) {
        labelEl.innerHTML = '';
        labelEl.appendChild(window.makitSkeleton.row({ width: 60 }));
      }
    });
  }
  function clearStatsSkeleton() { /* renderStats가 교체 */ }

  function showActivitySkeleton() {
    var chart = document.getElementById('activityChart');
    if (!chart || !window.makitSkeleton) return;
    var skeleton = document.createElement('div');
    skeleton.className = 'mk-skeleton mk-skeleton--card';
    skeleton.style.height = '180px';
    skeleton.style.marginTop = 'var(--mk-space-3)';
    chart.parentNode.insertBefore(skeleton, chart);
    chart.style.display = 'none';
  }
  function clearActivitySkeleton() {
    var skeleton = document.querySelector('.activity-chart-wrap .mk-skeleton.mk-skeleton--card');
    if (skeleton) skeleton.remove();
    var chart = document.getElementById('activityChart');
    if (chart) chart.style.display = '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
