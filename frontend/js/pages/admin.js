// Admin Dashboard page controller
(function () {
  let currentPage = 0;
  const pageSize = 20;
  let usageChart = null;
  let notifTypeChart = null;
  let lastOverview = null;
  let lastUsersPage = null;
  let usageDays = 30;
  let notifDays = 7;
  let aiqDays = 7;
  let aiqDailyChart = null;
  let aiqActionChart = null;
  let lastAiQuality = null;

  async function init() {
    // Check if user is admin
    try {
      const user = await window.api.auth.me();
      const adminNav = document.getElementById('admin-nav-item');
      if (adminNav) adminNav.style.display = user.role === 'ADMIN' ? 'flex' : 'none';

      if (user.role !== 'ADMIN') {
        window.ui.toast('관리자 권한이 필요합니다', 'error');
        window.location.href = 'index.html';
        return;
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      window.location.href = 'login.html';
      return;
    }

    // Load admin data
    loadOverview();
    loadUsage(usageDays);
    loadNotificationBreakdown(notifDays);
    loadAiQuality(aiqDays);
    loadAiThresholds();
    loadAiThresholdHistory();
    loadUsers(0);
    loadFeatures();

    const thrForm = document.getElementById('aiq-thr-form');
    if (thrForm) thrForm.addEventListener('submit', onSaveThresholds);
    const thrReset = document.getElementById('aiq-thr-reset');
    if (thrReset) thrReset.addEventListener('click', () => loadAiThresholds());

    // Event listeners
    document.getElementById('prev-page').addEventListener('click', () => {
      if (currentPage > 0) loadUsers(currentPage - 1);
    });

    document.getElementById('next-page').addEventListener('click', () => {
      loadUsers(currentPage + 1);
    });

    wirePeriodChips('usage-period-chips', (days) => {
      usageDays = days;
      const t = document.getElementById('usage-title');
      if (t) t.textContent = `사용량 추이 (최근 ${days}일)`;
      loadUsage(days);
    });
    wirePeriodChips('notif-period-chips', (days) => {
      notifDays = days;
      const t = document.getElementById('notif-title');
      if (t) t.textContent = `알림 분석 (최근 ${days}일)`;
      loadNotificationBreakdown(days);
    });
    wirePeriodChips('aiq-period-chips', (days) => {
      aiqDays = days;
      const t = document.getElementById('aiq-title');
      if (t) t.textContent = `AI 답변 품질 (최근 ${days}일)`;
      loadAiQuality(days);
    });

    const exportJsonBtn = document.getElementById('overview-export-json');
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportOverviewJson);
    const exportCsvBtn = document.getElementById('users-export-csv');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportAllUsersCsv);
    const aiqCsvBtn = document.getElementById('aiq-export-csv');
    if (aiqCsvBtn) aiqCsvBtn.addEventListener('click', exportAiQualityCsv);
    const aiqJsonBtn = document.getElementById('aiq-export-json');
    if (aiqJsonBtn) aiqJsonBtn.addEventListener('click', exportAiQualityJson);

    // 해시 라우트(#aiq-context/<id>)로 직접 진입 시 contextId 상세 모달을 자동으로 연다.
    // 슬랙/지라 등에서 링크 한 줄로 공유 가능하게 하기 위함.
    window.addEventListener('hashchange', handleContextHashRoute);
    handleContextHashRoute();
  }

  function parseContextHash() {
    const h = (window.location.hash || '').replace(/^#/, '');
    const m = /^aiq-context\/(.+)$/.exec(h);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (_) { return m[1]; }
  }

  function handleContextHashRoute() {
    const ctxId = parseContextHash();
    if (!ctxId) return;
    openContextDetailModal(ctxId);
  }

  function buildContextShareUrl(ctxId) {
    const loc = window.location;
    return `${loc.origin}${loc.pathname}#aiq-context/${encodeURIComponent(ctxId)}`;
  }

  async function copyContextShareLink(ctxId) {
    const url = buildContextShareUrl(ctxId);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // 구형 브라우저 fallback — 임시 textarea로 execCommand('copy')
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      window.ui.toast('공유용 링크가 복사되었습니다', 'success');
    } catch (err) {
      console.error('Failed to copy share link:', err);
      window.ui.toast('링크 복사에 실패했습니다. 주소창에서 직접 복사해 주세요: ' + url, 'error');
    }
  }

  // 단일 contextId 상세를 모달로 띄운다 (해시 라우트/공유 링크 진입용).
  // 부모 호출 메타(태그/위치)는 알 수 없으므로 상세만 노출한다.
  async function openContextDetailModal(ctxId) {
    const title = `contextId ${ctxId}`;
    const placeholder = '<div class="aiq-slow-empty">상세를 불러오는 중...</div>';
    window.makitModal.open({
      title: title,
      body: placeholder,
      actions: [{
        label: '닫기',
        type: 'secondary',
        onClick: () => {
          window.makitModal.close();
          // 모달을 닫으면 같은 링크 재진입이 가능하도록 해시를 비운다.
          if (parseContextHash()) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      }]
    });
    const bodyEl = document.getElementById('mkModalBody');
    try {
      const detail = await window.api.admin.aiSlowDetail(ctxId);
      if (!bodyEl) return;
      bodyEl.innerHTML = renderSlowDetail(detail, ctxId);
      bindSlowDetailHandler(bodyEl);
    } catch (err) {
      console.error('Failed to load slow detail:', err);
      if (!bodyEl) return;
      const status = err && err.status;
      const msg = status === 404
        ? '이 contextId의 응답 본문은 더 이상 보관돼 있지 않습니다 (서버 재시작 또는 보관 한도 초과로 밀려남).'
        : '응답 본문을 불러오지 못했습니다.';
      bodyEl.innerHTML = `<div class="aiq-slow-empty">${escapeHtml(msg)}</div>`;
    }
  }

  function wirePeriodChips(containerId, onPick) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener('click', (ev) => {
      const chip = ev.target.closest('.an-chip[data-days]');
      if (!chip) return;
      const days = parseInt(chip.getAttribute('data-days'), 10);
      if (!Number.isFinite(days)) return;
      container.querySelectorAll('.an-chip').forEach((c) => {
        const active = c === chip;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      try { onPick(days); } catch (e) { console.error('[admin] period chip handler failed', e); }
    });
  }

  function exportOverviewJson() {
    if (!lastOverview) {
      window.ui.toast('통계가 아직 로드되지 않았습니다.', 'error');
      return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      overview: lastOverview,
      windowDays: { usage: usageDays, notifications: notifDays }
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
      `makit-admin-overview-${todayStamp()}.json`
    );
  }

  async function exportAllUsersCsv() {
    const btn = document.getElementById('users-export-csv');
    if (btn) { btn.disabled = true; btn.textContent = '내보내는 중...'; }
    const rows = [];
    const header = ['email', 'name', 'role', 'createdAt', 'lastLoginAt', 'requestCount'];
    rows.push(header.map(csvCell).join(','));
    try {
      const PAGE = 100;
      let page = 0;
      let total = Infinity;
      while (page * PAGE < total) {
        const data = await window.api.admin.users(page, PAGE);
        const items = (data && data.content) || [];
        items.forEach((u) => {
          rows.push([
            u.email || '',
            u.name || '',
            u.role || '',
            u.createdAt || '',
            u.lastLoginAt || '',
            String(u.requestCount == null ? 0 : u.requestCount)
          ].map(csvCell).join(','));
        });
        if (data && typeof data.totalElements === 'number') total = data.totalElements;
        else if (items.length < PAGE) break;
        page++;
        if (page > 200) break; // hard safety: max 20,000 rows
      }
      // BOM for Excel UTF-8 detection
      const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `makit-users-${todayStamp()}.csv`);
      window.ui.toast(`사용자 ${rows.length - 1}명 내보내기 완료`, 'success');
    } catch (err) {
      console.error('[admin] export users CSV failed', err);
      window.ui.toast('CSV 내보내기 실패: ' + (err && err.message || ''), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '사용자 전체 CSV 내보내기'; }
    }
  }

  function exportAiQualityJson() {
    if (!lastAiQuality) {
      window.ui.toast('AI 품질 데이터가 아직 로드되지 않았습니다.', 'error');
      return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      windowDays: lastAiQuality.days,
      aiQuality: lastAiQuality.data
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
      `makit-ai-quality-${dateStamp()}.json`
    );
    window.ui.toast('AI 품질 JSON 내보내기 완료', 'success');
  }

  function dateStamp() {
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  function exportAiQualityCsv() {
    if (!lastAiQuality) {
      window.ui.toast('AI 품질 데이터가 아직 로드되지 않았습니다.', 'error');
      return;
    }
    const { days, data } = lastAiQuality;
    const lines = [];
    const fmtRate = (r) => (r == null ? '' : (r * 100).toFixed(2) + '%');

    // Section 1: Summary
    lines.push(['# Section', 'AI Quality Summary'].map(csvCell).join(','));
    lines.push(['exportedAt', new Date().toISOString()].map(csvCell).join(','));
    lines.push(['windowDays', String(days)].map(csvCell).join(','));
    lines.push(['totalFeedback', String(data.totalFeedback == null ? 0 : data.totalFeedback)].map(csvCell).join(','));
    lines.push(['helpfulRate', fmtRate(data.helpfulRate)].map(csvCell).join(','));
    if (data.latency) {
      lines.push(['askCount', String(data.latency.askCount == null ? 0 : data.latency.askCount)].map(csvCell).join(','));
      lines.push(['askMeanMs', String(data.latency.askMeanMs == null ? '' : Math.round(data.latency.askMeanMs))].map(csvCell).join(','));
      lines.push(['actionCount', String(data.latency.actionCount == null ? 0 : data.latency.actionCount)].map(csvCell).join(','));
      lines.push(['actionMeanMs', String(data.latency.actionMeanMs == null ? '' : Math.round(data.latency.actionMeanMs))].map(csvCell).join(','));
    }
    if (Array.isArray(data.alerts) && data.alerts.length > 0) {
      data.alerts.forEach((msg, i) => {
        lines.push([`alert_${i + 1}`, msg].map(csvCell).join(','));
      });
    }
    lines.push('');

    // Section 2: Daily helpful / not helpful
    lines.push(['# Section', 'Daily Feedback'].map(csvCell).join(','));
    lines.push(['date', 'helpful', 'notHelpful', 'total', 'helpfulRate'].map(csvCell).join(','));
    (data.daily || []).forEach((d) => {
      const h = d.helpful || 0;
      const n = d.notHelpful || 0;
      const t = h + n;
      const rate = t === 0 ? '' : ((h / t) * 100).toFixed(2) + '%';
      lines.push([d.date || '', String(h), String(n), String(t), rate].map(csvCell).join(','));
    });
    lines.push('');

    // Section 3: By action
    lines.push(['# Section', 'Helpful Rate by Action'].map(csvCell).join(','));
    lines.push(['action', 'helpful', 'notHelpful', 'total', 'helpfulRate'].map(csvCell).join(','));
    (data.byAction || []).forEach((a) => {
      const h = a.helpful || 0;
      const n = a.notHelpful || 0;
      lines.push([
        a.action || '',
        String(h),
        String(n),
        String(h + n),
        fmtRate(a.helpfulRate)
      ].map(csvCell).join(','));
    });
    lines.push('');

    // Section 4a: Tag-level latency (ask by collection)
    if (data.latency) {
      const fmtMsNum = (n) => (n == null ? '' : Math.round(n));
      lines.push(['# Section', 'Ask Latency by Collection'].map(csvCell).join(','));
      lines.push(['collection', 'meanMs', 'p50Ms', 'p95Ms', 'count'].map(csvCell).join(','));
      (data.latency.askByCollection || []).forEach((r) => {
        lines.push([
          r.tag || '',
          String(fmtMsNum(r.meanMs)),
          String(fmtMsNum(r.p50Ms)),
          String(fmtMsNum(r.p95Ms)),
          String(r.count == null ? 0 : r.count)
        ].map(csvCell).join(','));
      });
      lines.push('');

      lines.push(['# Section', 'Action Latency by Action'].map(csvCell).join(','));
      lines.push(['action', 'meanMs', 'p50Ms', 'p95Ms', 'count'].map(csvCell).join(','));
      (data.latency.actionByAction || []).forEach((r) => {
        lines.push([
          r.tag || '',
          String(fmtMsNum(r.meanMs)),
          String(fmtMsNum(r.p50Ms)),
          String(fmtMsNum(r.p95Ms)),
          String(r.count == null ? 0 : r.count)
        ].map(csvCell).join(','));
      });
      lines.push('');
    }

    // Section 4: Top documents
    lines.push(['# Section', 'Top Feedback Documents'].map(csvCell).join(','));
    lines.push(['rank', 'documentId', 'feedbackCount'].map(csvCell).join(','));
    (data.topDocuments || []).forEach((d, i) => {
      lines.push([String(i + 1), d.documentId || '', String(d.count == null ? 0 : d.count)].map(csvCell).join(','));
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `makit-ai-quality-${dateStamp()}.csv`);
    window.ui.toast('AI 품질 CSV 내보내기 완료', 'success');
  }

  function csvCell(v) {
    let s = String(v == null ? '' : v);
    // Formula Injection 방어 (Excel/Sheets/LibreOffice): 시작 문자가 = + - @ 탭 캐리지리턴이면 ' prefix
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function todayStamp() {
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      '-' + pad(d.getHours()) + pad(d.getMinutes());
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function loadOverview() {
    try {
      window.makitSkeleton.fillContainer(
        document.getElementById('stat-total-users'),
        'text'
      );
      window.makitSkeleton.fillContainer(
        document.getElementById('stat-active-users'),
        'text'
      );
      window.makitSkeleton.fillContainer(
        document.getElementById('stat-requests'),
        'text'
      );
      window.makitSkeleton.fillContainer(
        document.getElementById('stat-notifications'),
        'text'
      );

      const data = await window.api.admin.overview();
      lastOverview = data;
      document.getElementById('stat-total-users').textContent = data.totalUsers.toLocaleString();
      document.getElementById('stat-active-users').textContent = data.activeUsersLast7Days.toLocaleString();
      document.getElementById('stat-requests').textContent = data.totalRequestsLast7Days.toLocaleString();
      document.getElementById('stat-notifications').textContent = data.totalNotificationsLast7Days.toLocaleString();

      window.makitSkeleton.clear();
    } catch (err) {
      console.error('Failed to load overview:', err);
      window.ui.toast('통계 로드 실패', 'error');
    }
  }

  async function loadUsage(days) {
    try {
      const data = await window.api.admin.usage(days);

      // Prepare chart data
      const dates = data.map(d => d.date);
      const requests = data.map(d => d.requests);
      const jobs = data.map(d => d.jobs);
      const errors = data.map(d => d.errors);

      // Destroy old chart if exists
      if (usageChart) usageChart.destroy();

      const ctx = document.getElementById('usageChart').getContext('2d');
      usageChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [
            {
              label: '요청',
              data: requests,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.05)',
              tension: 0.3,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: '#2563eb'
            },
            {
              label: '작업',
              data: jobs,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              tension: 0.3,
              fill: false,
              pointRadius: 4,
              pointBackgroundColor: '#10b981'
            },
            {
              label: '에러',
              data: errors,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              tension: 0.3,
              fill: false,
              pointRadius: 4,
              pointBackgroundColor: '#ef4444'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'top' }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: v => v.toLocaleString() }
            }
          }
        }
      });
    } catch (err) {
      console.error('Failed to load usage:', err);
      window.ui.toast('사용량 데이터 로드 실패', 'error');
    }
  }

  async function loadNotificationBreakdown(days) {
    try {
      const data = await window.api.admin.notifBreakdown(days);

      // Update stats
      document.getElementById('notif-clicked').textContent = data.clicked.toLocaleString();
      document.getElementById('notif-unread').textContent = data.unread.toLocaleString();
      document.getElementById('notif-ctr').textContent = (data.clickThroughRate * 100).toFixed(1) + '%';

      // Prepare chart data
      const types = Object.keys(data.byType);
      const counts = Object.values(data.byType);
      const colors = [
        '#2563eb', // INFO
        '#10b981', // SUCCESS
        '#f59e0b', // WARN
        '#ef4444'  // ERROR
      ];

      // Destroy old chart if exists
      if (notifTypeChart) notifTypeChart.destroy();

      const ctx = document.getElementById('notifTypeChart').getContext('2d');
      notifTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: types,
          datasets: [
            {
              data: counts,
              backgroundColor: colors.slice(0, types.length)
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    } catch (err) {
      console.error('Failed to load notification breakdown:', err);
      window.ui.toast('알림 분석 로드 실패', 'error');
    }
  }

  async function loadUsers(page) {
    try {
      currentPage = page;
      const data = await window.api.admin.users(page, pageSize);
      lastUsersPage = data;

      const tbody = document.getElementById('users-tbody');
      tbody.innerHTML = '';

      if (data.content.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">사용자가 없습니다</td></tr>';
      } else {
        data.content.forEach(user => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.name)}</td>
            <td><span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td>${user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}</td>
            <td>${user.requestCount.toLocaleString()}</td>
          `;
          tbody.appendChild(row);
        });
      }

      // Update pagination
      const pagination = document.getElementById('user-pagination');
      const pageInfo = document.getElementById('page-info');
      if (data.totalPages > 1) {
        pagination.style.display = 'flex';
        pageInfo.textContent = `${page + 1} / ${data.totalPages}`;
        document.getElementById('prev-page').disabled = page === 0;
        document.getElementById('next-page').disabled = page >= data.totalPages - 1;
      } else {
        pagination.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      window.ui.toast('사용자 목록 로드 실패', 'error');
    }
  }

  function renderTagLatencyRows(tbody, rows, defaultP95Threshold, fmtMs, kind) {
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px;">기간 내 측정값이 없습니다.</td></tr>';
      return;
    }
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      // 행마다 자기 임계치(태그 오버라이드 또는 전역 기본값)를 사용한다.
      const rowThreshold = (typeof r.p95ThresholdMs === 'number') ? r.p95ThresholdMs : defaultP95Threshold;
      const over = typeof r.p95Ms === 'number' && r.p95Ms > rowThreshold;
      const flagTitle = `p95 임계 ${fmtMs(rowThreshold)} ms 초과`;
      if (over) {
        tr.classList.add('aiq-tag-row--over');
        // 클릭으로 최근 호출 샘플 모달을 열 수 있다는 점을 안내한다.
        tr.setAttribute('role', 'button');
        tr.setAttribute('tabindex', '0');
        tr.setAttribute('aria-label', `${kind === 'action' ? '액션' : '컬렉션'} ${r.tag} 의 최근 느린 호출 샘플 보기`);
        tr.title = '클릭하면 최근 느린 호출 샘플을 봅니다';
        const open = () => openSlowSamplesModal(kind, r.tag, r);
        tr.addEventListener('click', open);
        tr.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
        });
      }
      tr.innerHTML = `
        <td><code>${escapeHtml(r.tag || '')}</code></td>
        <td class="num">${fmtMs(r.meanMs || 0)}</td>
        <td class="num">${fmtMs(r.p50Ms || 0)}</td>
        <td class="num">${fmtMs(r.p95Ms || 0)} <span class="aiq-tag-threshold" title="이 태그에 적용된 p95 임계치">/ ${fmtMs(rowThreshold)}</span>${over ? ` <span class="aiq-tag-flag" title="${flagTitle}">⚠</span>` : ''}</td>
        <td class="num">${(r.count || 0).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ---- 느린 호출 샘플 모달 -----------------------------------------------
  // p95 임계 초과로 강조된 행을 클릭하면 백엔드 ring buffer에서 최근 호출 메타를
  // 가져와 latency 내림차순으로 노출. 진단(어떤 질문/문서가 느렸는지)을 한 화면에서
  // 끝낼 수 있게 contextId·모델·질문 발췌까지 함께 보여준다.
  async function openSlowSamplesModal(kind, tag, rowStat) {
    const kindLabel = kind === 'action' ? '액션' : '컬렉션';
    const title = `${kindLabel} "${tag}" 최근 느린 호출`;
    const placeholder = '<div class="aiq-slow-empty">최근 호출 샘플을 불러오는 중...</div>';

    // "비우기" 액션은 모달의 footer 버튼으로 노출. 잘못 눌리지 않도록 다시 한 번 확인을
    // 받고 (danger 스타일), 성공 시 모달 본문을 빈 상태로 갱신한다. 감사 로그 기록은
    // 백엔드가 담당한다 (SLOW_SAMPLES_CLEAR).
    const clearAction = {
      label: '비우기',
      type: 'danger',
      onClick: async () => {
        const ok = await window.makitModal.confirm({
          title: '느린 호출 샘플 비우기',
          message: `${kindLabel} "${tag}" 의 최근 호출 표본과 contextId 상세를 모두 비웁니다. 이 동작은 되돌릴 수 없습니다.`,
          confirmLabel: '비우기',
          danger: true
        });
        if (!ok) {
          // confirm 모달을 닫으면 부모 슬로우 모달도 닫혔다 — 다시 열어준다.
          openSlowSamplesModal(kind, tag, rowStat);
          return;
        }
        try {
          const res = await window.api.admin.aiSlowClear(tag, kind);
          const removed = (res && typeof res.removed === 'number') ? res.removed : 0;
          window.ui.toast(`표본 ${removed.toLocaleString()}건을 비웠습니다.`, 'success');
        } catch (err) {
          console.error('Failed to clear slow samples:', err);
          window.ui.toast('표본 비우기에 실패했습니다.', 'error');
        }
        // 비운 직후 결과를 다시 그려 새 상태(빈 목록)를 즉시 보여준다.
        openSlowSamplesModal(kind, tag, rowStat);
      }
    };

    window.makitModal.open({
      title: title,
      body: placeholder,
      actions: [
        clearAction,
        { label: '닫기', type: 'secondary', onClick: () => window.makitModal.close() }
      ]
    });
    const bodyEl = document.getElementById('mkModalBody');
    try {
      const samples = await window.api.admin.aiSlow(tag, kind, 10);
      if (!bodyEl) return;
      // 샘플 메타와 별개로, 각 contextId에 달린 helpful/notHelpful 카운트를
      // 배치 조회해 목록 행에 👎 뱃지를 미리 보여준다. 실패해도 목록은
      // 그대로 보여주고 뱃지만 숨긴다 (조회 실패가 진단 흐름을 끊지 않게).
      const ids = (samples || []).map(function (s) { return s && s.contextId; }).filter(Boolean);
      let feedbackById = {};
      try {
        feedbackById = await window.api.admin.aiSlowFeedbackBatch(ids);
      } catch (e) {
        console.warn('Failed to load slow feedback batch:', e);
        feedbackById = {};
      }
      bodyEl.innerHTML = renderSlowSamples(samples, rowStat, kind, feedbackById);
      bindSlowDetailHandler(bodyEl);
      bindSlowFilterHandler(bodyEl);
    } catch (err) {
      console.error('Failed to load slow samples:', err);
      if (bodyEl) {
        bodyEl.innerHTML = '<div class="aiq-slow-empty">최근 호출 샘플을 불러오지 못했습니다.</div>';
      }
    }
  }

  function renderSlowSamples(samples, rowStat, kind, feedbackById) {
    const fmtMsLocal = (n) => Math.round(n || 0).toLocaleString();
    const fb = feedbackById || {};
    const headerBits = [];
    if (rowStat) {
      headerBits.push(`평균 ${fmtMsLocal(rowStat.meanMs)}ms`);
      headerBits.push(`p50 ${fmtMsLocal(rowStat.p50Ms)}ms`);
      headerBits.push(`p95 ${fmtMsLocal(rowStat.p95Ms)}ms`);
      headerBits.push(`호출 ${(rowStat.count || 0).toLocaleString()}건`);
    }
    const header = headerBits.length
      ? `<p class="aiq-slow-header">${headerBits.map(escapeHtml).join(' · ')}</p>`
      : '';
    if (!samples || samples.length === 0) {
      return header + '<div class="aiq-slow-empty">아직 기록된 호출 샘플이 없습니다. (서버 재시작 후 첫 호출이 들어오면 채워집니다)</div>';
    }
    // "도움 안 됨" 행만 보기 토글. 상태는 체크박스 자체가 들고 있고, 필터 적용은
    // bindSlowFilterHandler가 li[data-not-helpful="0"]에 hidden 속성을 토글해 처리.
    const negativeCount = samples.reduce(function (acc, s) {
      const c = s && s.contextId && fb[s.contextId];
      return acc + (c && Number(c.notHelpful) > 0 ? 1 : 0);
    }, 0);
    const filterBar = `
      <div class="aiq-slow-filter">
        <label class="aiq-slow-filter-toggle">
          <input type="checkbox" class="aiq-slow-filter-input" />
          <span>👎 도움 안 됨 피드백이 달린 호출만 보기</span>
        </label>
        <span class="aiq-slow-filter-count">(${negativeCount}건)</span>
      </div>`;
    const items = samples.map((s) => {
      const when = s.ts ? new Date(s.ts).toLocaleString('ko-KR') : '-';
      const qLabel = kind === 'action' ? '대상 문서' : '질문';
      const q = s.question && s.question.length ? escapeHtml(s.question) : '<em class="aiq-slow-muted">(빈 문자열)</em>';
      // contextId는 LRU에 보관된 답변/인용/토큰을 펼치는 토글 버튼으로 노출한다.
      // 본문은 lazy load: 펼칠 때 한 번만 fetch.
      const ctx = s.contextId || '';
      const ctxBtn = ctx
        ? `<button type="button" class="aiq-ctx-btn" data-ctx="${escapeHtml(ctx)}" data-loaded="0" aria-expanded="false" title="이 호출의 답변·인용·토큰 보기">
             <code>${escapeHtml(ctx)}</code>
             <span class="aiq-ctx-caret" aria-hidden="true">▸</span>
           </button>`
        : '<code>-</code>';
      // 피드백 뱃지: notHelpful이 1건 이상이면 빨간 👎 뱃지를 latency 옆에 띄워
      // 펼치기 전에도 "느리고 도움 안 됨"을 식별할 수 있게 한다.
      const counts = ctx ? fb[ctx] : null;
      const helpful    = counts ? Number(counts.helpful || 0) : 0;
      const notHelpful = counts ? Number(counts.notHelpful || 0) : 0;
      const badges = [];
      if (notHelpful > 0) {
        badges.push(`<span class="aiq-slow-badge aiq-slow-badge--down" title="이 호출에 달린 도움 안 됨 피드백 ${notHelpful}건">👎 ${notHelpful}</span>`);
      }
      if (helpful > 0) {
        badges.push(`<span class="aiq-slow-badge aiq-slow-badge--up" title="이 호출에 달린 도움됨 피드백 ${helpful}건">👍 ${helpful}</span>`);
      }
      const badgesHtml = badges.length ? `<span class="aiq-slow-badges">${badges.join('')}</span>` : '';
      return `
        <li class="aiq-slow-item" data-not-helpful="${notHelpful > 0 ? '1' : '0'}">
          <div class="aiq-slow-row1">
            <span class="aiq-slow-latency">${fmtMsLocal(s.latencyMs)} ms</span>
            ${badgesHtml}
            <span class="aiq-slow-when">${escapeHtml(when)}</span>
          </div>
          <div class="aiq-slow-q"><strong>${qLabel}:</strong> ${q}</div>
          <div class="aiq-slow-meta">
            <span>contextId ${ctxBtn}</span>
            <span>모델 <code>${escapeHtml(s.modelId || '-')}</code></span>
          </div>
          <div class="aiq-slow-detail" hidden></div>
        </li>`;
    }).join('');
    return header + filterBar + `<ol class="aiq-slow-list">${items}</ol>`;
  }

  // "도움 안 됨 피드백이 달린 호출만 보기" 체크박스 핸들러.
  // 모달 안에서만 동작하면 되므로 bodyEl 스코프로 위임 등록한다.
  function bindSlowFilterHandler(bodyEl) {
    if (!bodyEl || bodyEl.__aiqFilterBound) return;
    bodyEl.__aiqFilterBound = true;
    bodyEl.addEventListener('change', (ev) => {
      const input = ev.target.closest('.aiq-slow-filter-input');
      if (!input || !bodyEl.contains(input)) return;
      const onlyNegative = !!input.checked;
      const list = bodyEl.querySelector('.aiq-slow-list');
      if (!list) return;
      list.querySelectorAll('.aiq-slow-item').forEach((li) => {
        const has = li.getAttribute('data-not-helpful') === '1';
        li.hidden = onlyNegative && !has;
      });
    });
  }

  // contextId 토글: 클릭 시 백엔드 LRU에서 답변/인용/토큰을 받아와 펼친다.
  // 모달 안의 위임 핸들러로 한 번만 등록한다 (모달이 다시 열려도 새 bodyEl을 참조).
  function bindSlowDetailHandler(bodyEl) {
    if (!bodyEl || bodyEl.__aiqDetailBound) return;
    bodyEl.__aiqDetailBound = true;
    bodyEl.addEventListener('click', async (ev) => {
      // 공유용 영구 링크 복사 — 상세 패널 안 어디서든 위임 처리.
      const shareEl = ev.target.closest('.aiq-share-btn');
      if (shareEl && bodyEl.contains(shareEl)) {
        ev.preventDefault();
        const ctx = shareEl.getAttribute('data-share-ctx');
        if (ctx) await copyContextShareLink(ctx);
        return;
      }
      const btn = ev.target.closest('.aiq-ctx-btn');
      if (!btn || !bodyEl.contains(btn)) return;
      ev.preventDefault();
      const item = btn.closest('.aiq-slow-item');
      const detailEl = item ? item.querySelector('.aiq-slow-detail') : null;
      if (!detailEl) return;
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      // toggle close
      if (expanded) {
        btn.setAttribute('aria-expanded', 'false');
        const caret = btn.querySelector('.aiq-ctx-caret');
        if (caret) caret.textContent = '▸';
        detailEl.hidden = true;
        return;
      }
      btn.setAttribute('aria-expanded', 'true');
      const caret = btn.querySelector('.aiq-ctx-caret');
      if (caret) caret.textContent = '▾';
      detailEl.hidden = false;
      if (btn.getAttribute('data-loaded') === '1') return; // 이미 로드됨
      const ctxId = btn.getAttribute('data-ctx');
      detailEl.innerHTML = '<div class="aiq-slow-empty">상세를 불러오는 중...</div>';
      // 응답 본문(LRU에서 만료될 수 있음)과 사용자 피드백(DB 영구 저장)을 병렬로 조회.
      // 본문 로드가 실패해도 피드백은 보여줄 수 있도록 settled로 분리해 처리한다.
      const [detailRes, feedbackRes] = await Promise.allSettled([
        window.api.admin.aiSlowDetail(ctxId),
        window.api.admin.aiSlowDetailFeedback(ctxId)
      ]);

      let html = '';
      if (detailRes.status === 'fulfilled') {
        // ctxId를 함께 넘겨야 상세 패널 안 "공유용 링크 복사" 버튼이 렌더된다.
        html += renderSlowDetail(detailRes.value, ctxId);
      } else {
        const err = detailRes.reason;
        console.error('Failed to load slow detail:', err);
        const status = err && err.status;
        const msg = status === 404
          ? '이 contextId의 응답 본문은 더 이상 보관돼 있지 않습니다 (서버 재시작 또는 보관 한도 초과로 밀려남).'
          : '응답 본문을 불러오지 못했습니다.';
        html += `<div class="aiq-slow-empty">${escapeHtml(msg)}</div>`;
      }
      if (feedbackRes.status === 'fulfilled') {
        html += renderSlowFeedback(feedbackRes.value);
      } else {
        console.error('Failed to load slow feedback:', feedbackRes.reason);
        html += '<div class="aiq-slow-feedback"><h4>사용자 피드백</h4>'
              + '<div class="aiq-slow-empty">피드백을 불러오지 못했습니다.</div></div>';
      }
      detailEl.innerHTML = html;
      // 둘 다 실패한 경우엔 다시 펼쳤을 때 재시도할 수 있도록 loaded 마킹을 보류한다.
      // (한쪽이라도 성공하면 캐시 이득이 있으므로 loaded 처리.)
      if (detailRes.status === 'fulfilled' || feedbackRes.status === 'fulfilled') {
        btn.setAttribute('data-loaded', '1');
      }
    });
  }

  // 같은 contextId에 달린 helpful/notHelpful 카운트 + 최근 코멘트 1~3건.
  // 피드백이 한 건도 없으면 "피드백 없음" 안내만 노출한다.
  function renderSlowFeedback(f) {
    if (!f) return '';
    const helpful = Number(f.helpful || 0);
    const notHelpful = Number(f.notHelpful || 0);
    const total = helpful + notHelpful;
    const comments = Array.isArray(f.recentComments) ? f.recentComments : [];
    if (total === 0 && comments.length === 0) {
      return `
        <div class="aiq-slow-feedback aiq-detail-section">
          <h4>사용자 피드백</h4>
          <div class="aiq-slow-muted">피드백 없음</div>
        </div>`;
    }
    const counts = `
      <div class="aiq-feedback-counts">
        <span class="aiq-feedback-pill aiq-feedback-pill--up">👍 도움됨 ${helpful}</span>
        <span class="aiq-feedback-pill aiq-feedback-pill--down">👎 도움 안 됨 ${notHelpful}</span>
      </div>`;
    const commentsHtml = comments.length === 0
      ? ''
      : '<ul class="aiq-feedback-comments">' + comments.map((c) => {
          const icon = c.helpful ? '👍' : '👎';
          const action = c.action ? `<span class="aiq-slow-muted"> · ${escapeHtml(c.action)}</span>` : '';
          const when = c.createdAt ? `<span class="aiq-slow-muted"> · ${escapeHtml(formatDate(c.createdAt))}</span>` : '';
          const body = c.comment && c.comment.length
            ? `<div class="aiq-feedback-comment-body">${escapeHtml(c.comment)}</div>`
            : '<div class="aiq-slow-muted">(코멘트 없음)</div>';
          return `<li>
              <div class="aiq-feedback-comment-meta">${icon}${action}${when}</div>
              ${body}
            </li>`;
        }).join('') + '</ul>';
    return `
      <div class="aiq-slow-feedback aiq-detail-section">
        <h4>사용자 피드백</h4>
        ${counts}
        ${commentsHtml}
      </div>`;
  }

  function renderSlowDetail(d, ctxId) {
    if (!d) return '<div class="aiq-slow-empty">응답 본문이 비어 있습니다.</div>';
    const tokens = `<span>입력 ${(d.tokensIn || 0).toLocaleString()} · 출력 ${(d.tokensOut || 0).toLocaleString()} 토큰</span>`;
    // 공유용 영구 링크 버튼 — 클릭 시 클립보드로 #aiq-context/<id> 링크를 복사한다.
    const shareBtn = ctxId
      ? `<button type="button" class="aiq-share-btn" data-share-ctx="${escapeHtml(ctxId)}" title="이 contextId 상세를 여는 영구 링크를 복사합니다">공유용 링크 복사</button>`
      : '';
    const answer = d.answer && d.answer.length
      ? `<pre class="aiq-detail-answer">${escapeHtml(d.answer)}</pre>`
      : '<div class="aiq-slow-muted">(빈 답변)</div>';
    const cits = Array.isArray(d.citations) ? d.citations : [];
    const citsHtml = cits.length === 0
      ? '<div class="aiq-slow-muted">인용된 문서가 없습니다.</div>'
      : '<ol class="aiq-detail-citations">' + cits.map((c) => {
          const title = c.title && c.title.length ? c.title : '(제목 없음)';
          const score = typeof c.score === 'number' ? c.score.toFixed(3) : '-';
          const snippet = c.snippet && c.snippet.length ? escapeHtml(c.snippet) : '';
          // documentId는 #doc/<id> 라우트로 바로 이동 가능.
          const docLink = c.documentId
            ? `<a href="#doc/${encodeURIComponent(c.documentId)}" target="_blank" rel="noopener"><code>${escapeHtml(c.documentId)}</code></a>`
            : '<code>-</code>';
          return `<li>
              <div class="aiq-detail-cit-title"><strong>${escapeHtml(title)}</strong> <span class="aiq-slow-muted">#${c.chunkIndex} · score ${escapeHtml(score)}</span></div>
              <div class="aiq-detail-cit-doc">doc ${docLink}</div>
              ${snippet ? `<div class="aiq-detail-cit-snippet">${snippet}</div>` : ''}
            </li>`;
        }).join('') + '</ol>';
    return `
      <div class="aiq-slow-detail-inner">
        <div class="aiq-detail-meta">${tokens}${shareBtn ? ` <span class="aiq-detail-share">${shareBtn}</span>` : ''}</div>
        <div class="aiq-detail-section"><h4>답변</h4>${answer}</div>
        <div class="aiq-detail-section"><h4>인용 문서 (${cits.length})</h4>${citsHtml}</div>
      </div>`;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  async function loadFeatures() {
    try {
      const features = await window.api.admin.features();

      // Count by status
      const statusCounts = { experimental: 0, beta: 0, stable: 0, deprecated: 0 };
      features.forEach(f => {
        const status = f.status || 'experimental';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });

      // Update status counters
      document.getElementById('status-experimental').textContent = statusCounts.experimental;
      document.getElementById('status-beta').textContent = statusCounts.beta;
      document.getElementById('status-stable').textContent = statusCounts.stable;
      document.getElementById('status-deprecated').textContent = statusCounts.deprecated;

      // Render features table
      const tbody = document.getElementById('featuresTableBody');
      tbody.innerHTML = '';

      if (features.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">기능이 없습니다</td></tr>';
      } else {
        features.forEach(feature => {
          const row = document.createElement('tr');
          const fileTotal = (feature.fileCount.backend || 0) + (feature.fileCount.frontend || 0) + (feature.fileCount.tests || 0);
          const currentStatus = feature.status || 'experimental';
          row.innerHTML = `
            <td><strong>${escapeHtml(feature.displayName)}</strong></td>
            <td>${escapeHtml(feature.category || '-')}</td>
            <td>
              <select class="feature-status-select" data-feature="${escapeHtml(feature.name)}" style="padding: 4px 8px; border: 1px solid var(--mk-color-border); border-radius: 4px; background: var(--mk-color-bg); color: var(--mk-color-text); cursor: pointer;">
                <option value="experimental" ${currentStatus === 'experimental' ? 'selected' : ''}>experimental</option>
                <option value="beta" ${currentStatus === 'beta' ? 'selected' : ''}>beta</option>
                <option value="stable" ${currentStatus === 'stable' ? 'selected' : ''}>stable</option>
                <option value="deprecated" ${currentStatus === 'deprecated' ? 'selected' : ''}>deprecated</option>
              </select>
            </td>
            <td>${feature.endpointCount || 0}</td>
            <td>${fileTotal}</td>
            <td>${escapeHtml(feature.lastTouchedRound || 'N/A')}</td>
          `;
          row.style.cursor = 'default';

          // Attach change handler to status dropdown
          const select = row.querySelector('.feature-status-select');
          select.addEventListener('change', (e) => handleStatusChange(feature.name, e.target.value, feature.status || 'experimental'));

          // Still allow detail view on other cells
          const firstCell = row.querySelector('td:first-child');
          firstCell.style.cursor = 'pointer';
          firstCell.addEventListener('click', () => showFeatureDetail(feature.name));

          tbody.appendChild(row);
        });
      }
    } catch (err) {
      console.error('Failed to load features:', err);
      window.ui.toast('기능 목록 로드 실패', 'error');
    }
  }

  async function handleStatusChange(featureName, newStatus, oldStatus) {
    // Confirm status change, especially for deprecated
    const isDangerous = newStatus === 'deprecated' || oldStatus === 'deprecated';
    const message = isDangerous
      ? `'${featureName}' 상태를 '${oldStatus}'에서 '${newStatus}'로 변경하시겠습니까?`
      : `'${featureName}' 상태를 '${newStatus}'로 변경하시겠습니까?`;

    window.makitModal.confirm({
      title: '기능 상태 변경',
      message: message,
      onConfirm: async () => {
        try {
          await window.api.admin.updateFeatureStatus(featureName, newStatus);
          window.ui.toast(`${featureName} 상태가 업데이트되었습니다`, 'success');
          // Reload features list to reflect change
          loadFeatures();
        } catch (err) {
          console.error('Failed to update feature status:', err);
          window.ui.toast(`상태 변경 실패: ${err.message || '오류가 발생했습니다'}`, 'error');
          // Revert dropdown on error
          loadFeatures();
        }
      },
      onCancel: () => {
        // Revert dropdown on cancel
        loadFeatures();
      }
    });
  }

  async function showFeatureDetail(featureName) {
    try {
      const detail = await window.api.admin.featureDetail(featureName);
      const manifest = detail.manifest || {};
      const readmePreview = (detail.readme || '').substring(0, 200) + '...';
      window.makitModal.open({
        title: manifest.displayName || featureName,
        body: `
          <div style="font-size: 0.9rem; line-height: 1.6;">
            <div><strong>상태:</strong> ${manifest.status || 'N/A'}</div>
            <div><strong>카테고리:</strong> ${manifest.category || 'N/A'}</div>
            <div><strong>설명:</strong> ${manifest.description || 'N/A'}</div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--mk-color-border);">
              <strong>README 미리보기:</strong><br/>
              <pre style="background: var(--mk-color-bg-subtle); padding: 0.5rem; border-radius: 4px; overflow-x: auto; font-size: 0.85rem;">${escapeHtml(readmePreview)}</pre>
            </div>
          </div>
        `,
        actions: [
          { text: '닫기', type: 'secondary', onClick: () => window.makitModal.close() }
        ]
      });
    } catch (err) {
      console.error('Failed to load feature detail:', err);
      window.ui.toast('기능 상세 정보 로드 실패', 'error');
    }
  }

  async function loadAiQuality(days) {
    const alertsEl = document.getElementById('aiq-alerts');
    try {
      const data = await window.api.admin.aiQuality(days, 10);
      lastAiQuality = { days, data };

      // Summary cards
      const fmtPct = (r) => (r * 100).toFixed(1) + '%';
      const fmtMs  = (n) => Math.round(n).toLocaleString();
      document.getElementById('aiq-helpful-rate').textContent =
        data.totalFeedback === 0 ? '데이터 없음' : fmtPct(data.helpfulRate);
      document.getElementById('aiq-total-feedback').textContent = data.totalFeedback.toLocaleString();
      const askP95El = document.getElementById('aiq-ask-p95');
      const actionP95El = document.getElementById('aiq-action-p95');
      const askMeanEl = document.getElementById('aiq-ask-mean');
      const actionMeanEl = document.getElementById('aiq-action-mean');
      if (data.latency.askCount === 0) {
        askMeanEl.textContent = '--';
        if (askP95El) askP95El.textContent = 'p95 --';
      } else {
        askMeanEl.textContent = `평균 ${fmtMs(data.latency.askMeanMs)}`;
        if (askP95El) askP95El.textContent = `p50 ${fmtMs(data.latency.askP50Ms)} · p95 ${fmtMs(data.latency.askP95Ms)}`;
      }
      if (data.latency.actionCount === 0) {
        actionMeanEl.textContent = '--';
        if (actionP95El) actionP95El.textContent = 'p95 --';
      } else {
        actionMeanEl.textContent = `평균 ${fmtMs(data.latency.actionMeanMs)}`;
        if (actionP95El) actionP95El.textContent = `p50 ${fmtMs(data.latency.actionP50Ms)} · p95 ${fmtMs(data.latency.actionP95Ms)}`;
      }

      // Thresholds caption + breach highlights
      const th = data.thresholds || null;
      const thresholdsEl = document.getElementById('aiq-thresholds');
      const helpfulCard = document.getElementById('aiq-card-helpful-rate');
      const askCard = document.getElementById('aiq-card-ask');
      const actionCard = document.getElementById('aiq-card-action');
      [helpfulCard, askCard, actionCard].forEach(c => c && c.classList.remove('is-breach'));
      if (askP95El) askP95El.classList.remove('is-breach');
      if (actionP95El) actionP95El.classList.remove('is-breach');
      if (askMeanEl) askMeanEl.classList.remove('is-breach');
      if (actionMeanEl) actionMeanEl.classList.remove('is-breach');

      if (th && thresholdsEl) {
        thresholdsEl.textContent =
          `현재 임계치 — 도움됨 < ${fmtPct(th.helpfulRateThreshold)} ` +
          `(최소 표본 ${th.minSamplesForRateAlert.toLocaleString()}건), ` +
          `평균 응답 > ${fmtMs(th.latencyMeanAlertMs)}ms, ` +
          `p95 응답 > ${fmtMs(th.latencyP95AlertMs)}ms`;

        const helpfulBreach =
          data.totalFeedback >= th.minSamplesForRateAlert &&
          data.helpfulRate < th.helpfulRateThreshold;
        if (helpfulBreach && helpfulCard) helpfulCard.classList.add('is-breach');

        if (data.latency.askCount > 0) {
          const askMeanBreach = data.latency.askMeanMs > th.latencyMeanAlertMs;
          const askP95Breach = data.latency.askP95Ms > th.latencyP95AlertMs;
          if ((askMeanBreach || askP95Breach) && askCard) askCard.classList.add('is-breach');
          if (askP95Breach && askP95El) askP95El.classList.add('is-breach');
        }
        if (data.latency.actionCount > 0) {
          const actionMeanBreach = data.latency.actionMeanMs > th.latencyMeanAlertMs;
          const actionP95Breach = data.latency.actionP95Ms > th.latencyP95AlertMs;
          if ((actionMeanBreach || actionP95Breach) && actionCard) actionCard.classList.add('is-breach');
          if (actionP95Breach && actionP95El) actionP95El.classList.add('is-breach');
        }
      } else if (thresholdsEl) {
        thresholdsEl.textContent = '임계치 정보 없음';
      }

      // 응답 본문 LRU 적중률 카드. SlowCallSampler.DETAIL_CAPACITY 한도가 부족해
      // contextId 조회가 미스되는 비율이 임계 미만이면 노란 경고 배지를 띄운다.
      const dl = data.detailLookup || null;
      const dlCard = document.getElementById('aiq-card-detail-lookup');
      const dlValueEl = document.getElementById('aiq-detail-hit-rate');
      const dlSubEl = document.getElementById('aiq-detail-hit-sub');
      if (dlCard) dlCard.classList.remove('is-warn');
      if (dl && dlValueEl && dlSubEl) {
        const total = (dl.hits || 0) + (dl.misses || 0);
        if (total === 0) {
          dlValueEl.textContent = '데이터 없음';
          dlSubEl.textContent = '조회 0건';
        } else {
          dlValueEl.textContent = fmtPct(dl.hitRate);
          dlSubEl.textContent =
            `적중 ${dl.hits.toLocaleString()} / 만료 ${dl.misses.toLocaleString()} ` +
            `(임계 ${fmtPct(dl.hitRateThreshold)})`;
          if (dl.hitRate < dl.hitRateThreshold && dlCard) {
            dlCard.classList.add('is-warn');
          }
        }
      }

      // Alerts banner
      if (alertsEl) {
        alertsEl.innerHTML = '';
        if (data.alerts && data.alerts.length > 0) {
          data.alerts.forEach((msg) => {
            const div = document.createElement('div');
            div.className = 'aiq-alert';
            div.textContent = msg;
            alertsEl.appendChild(div);
          });
          alertsEl.hidden = false;
        } else {
          alertsEl.hidden = true;
        }
      }

      // Daily stacked bar chart
      const dates = data.daily.map(d => d.date);
      const helpful = data.daily.map(d => d.helpful);
      const notHelpful = data.daily.map(d => d.notHelpful);
      if (aiqDailyChart) aiqDailyChart.destroy();
      const dailyCtx = document.getElementById('aiqDailyChart').getContext('2d');
      aiqDailyChart = new Chart(dailyCtx, {
        type: 'bar',
        data: {
          labels: dates,
          datasets: [
            { label: '👍 도움됨',   data: helpful,    backgroundColor: '#10b981' },
            { label: '👎 도움 안됨', data: notHelpful, backgroundColor: '#ef4444' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });

      // Action breakdown horizontal bar (helpful rate %)
      const actions = data.byAction.map(a => a.action);
      const rates = data.byAction.map(a => +(a.helpfulRate * 100).toFixed(1));
      const totals = data.byAction.map(a => a.helpful + a.notHelpful);
      if (aiqActionChart) aiqActionChart.destroy();
      const actionCtx = document.getElementById('aiqActionChart').getContext('2d');
      aiqActionChart = new Chart(actionCtx, {
        type: 'bar',
        data: {
          labels: actions,
          datasets: [{
            label: '도움됨 비율 (%)',
            data: rates,
            backgroundColor: rates.map(r => r < 70 ? '#ef4444' : r < 85 ? '#f59e0b' : '#10b981')
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const i = ctx.dataIndex;
                  return `${ctx.parsed.x}% (n=${totals[i]})`;
                }
              }
            }
          },
          scales: {
            x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
          }
        }
      });

      // Tag-level latency tables (collection for ask, action for action).
      // 임계치는 컬렉션·액션마다 다를 수 있으므로 행별 p95ThresholdMs를 적용한다.
      const p95Threshold = (data.latency && typeof data.latency.p95ThresholdMs === 'number')
        ? data.latency.p95ThresholdMs : 10000;
      const askOverrides = (data.thresholds && data.thresholds.askP95AlertMsByCollection) || {};
      const actionOverrides = (data.thresholds && data.thresholds.actionP95AlertMsByAction) || {};
      const overrideCount = (m) => Object.keys(m || {}).length;
      const askHint = document.getElementById('aiq-ask-tag-hint');
      const actionHint = document.getElementById('aiq-action-tag-hint');
      const labelFor = (overrides) => {
        const n = overrideCount(overrides);
        const base = `p95 기본 ${fmtMs(p95Threshold)} ms 초과 시 강조`;
        return n > 0 ? `${base} · 오버라이드 ${n}건` : base;
      };
      if (askHint) askHint.textContent = labelFor(askOverrides);
      if (actionHint) actionHint.textContent = labelFor(actionOverrides);
      renderTagLatencyRows(
        document.getElementById('aiq-ask-tag-tbody'),
        (data.latency && data.latency.askByCollection) || [],
        p95Threshold,
        fmtMs,
        'ask'
      );
      renderTagLatencyRows(
        document.getElementById('aiq-action-tag-tbody'),
        (data.latency && data.latency.actionByAction) || [],
        p95Threshold,
        fmtMs,
        'action'
      );

      // Top docs table
      const tbody = document.getElementById('aiq-top-docs');
      const topTitle = document.getElementById('aiq-top-docs-title');
      if (topTitle) topTitle.textContent = `피드백 상위 문서 (Top ${(data.topDocuments || []).length || 10})`;
      tbody.innerHTML = '';
      if (!data.topDocuments || data.topDocuments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:16px;">기간 내 피드백이 없습니다.</td></tr>';
      } else {
        data.topDocuments.forEach((d, i) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${i + 1}</td>
            <td><code>${escapeHtml(d.documentId)}</code></td>
            <td>${d.count.toLocaleString()}</td>
          `;
          tbody.appendChild(row);
        });
      }
    } catch (err) {
      console.error('Failed to load AI quality:', err);
      window.ui.toast('AI 품질 데이터 로드 실패', 'error');
      if (alertsEl) {
        alertsEl.hidden = false;
        alertsEl.innerHTML = '<div class="aiq-alert">AI 품질 데이터를 불러오지 못했습니다.</div>';
      }
    }
  }

  // ----------------------- AI quality alert thresholds (operator-tunable) ---

  function setThrStatus(text, type) {
    const el = document.getElementById('aiq-thr-status');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = type === 'error' ? 'var(--mk-color-danger, #ef4444)'
      : type === 'success' ? 'var(--mk-color-success, #10b981)'
      : 'var(--mk-color-text-muted)';
  }

  function fillThresholdsForm(t) {
    if (!t) return;
    document.getElementById('aiq-thr-helpful').value = (t.helpfulRateThreshold * 100).toFixed(0);
    document.getElementById('aiq-thr-mean').value    = Math.round(t.latencyMeanAlertMs);
    document.getElementById('aiq-thr-p95').value     = Math.round(t.latencyP95AlertMs);
    document.getElementById('aiq-thr-min').value     = t.minSamplesForRateAlert;
    document.getElementById('aiq-thr-note').value    = '';
    const badge = document.getElementById('aiq-thr-source');
    if (badge) {
      const isDb = t.source === 'DB';
      badge.textContent = isDb
        ? `DB 저장값${t.changedByEmail ? ' · ' + t.changedByEmail : ''}${t.changedAt ? ' · ' + formatDate(t.changedAt) : ''}`
        : '환경변수/기본값 적용 중';
      badge.className = 'role-badge ' + (isDb ? 'role-admin' : 'role-user');
    }
  }

  async function loadAiThresholds() {
    try {
      const t = await window.api.admin.aiThresholds();
      fillThresholdsForm(t);
      setThrStatus('');
    } catch (err) {
      console.error('Failed to load AI thresholds:', err);
      setThrStatus('현재 임계치를 불러오지 못했습니다.', 'error');
    }
  }

  async function loadAiThresholdHistory() {
    const tbody = document.getElementById('aiq-thr-history');
    if (!tbody) return;
    try {
      const rows = await window.api.admin.aiThresholdsHistory(20);
      tbody.innerHTML = '';
      if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem; color:var(--mk-color-text-muted);">아직 변경 이력이 없습니다 (환경변수/기본값 사용 중).</td></tr>';
        return;
      }
      rows.forEach((r) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDateTime(r.changedAt)}</td>
          <td>${escapeHtml(r.changedByEmail || '-')}</td>
          <td>${(r.helpfulRateThreshold * 100).toFixed(0)}%</td>
          <td>${Math.round(r.latencyMeanAlertMs).toLocaleString()}</td>
          <td>${Math.round(r.latencyP95AlertMs).toLocaleString()}</td>
          <td>${r.minSamplesForRateAlert}</td>
          <td>${escapeHtml(r.note || '')}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to load AI threshold history:', err);
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem; color:var(--mk-color-danger,#ef4444);">변경 이력 로드 실패</td></tr>';
    }
  }

  async function onSaveThresholds(ev) {
    ev.preventDefault();
    const helpfulPct = parseFloat(document.getElementById('aiq-thr-helpful').value);
    const meanMs = parseFloat(document.getElementById('aiq-thr-mean').value);
    const p95Ms  = parseFloat(document.getElementById('aiq-thr-p95').value);
    const minN   = parseInt(document.getElementById('aiq-thr-min').value, 10);
    const note   = document.getElementById('aiq-thr-note').value.trim();

    if (!Number.isFinite(helpfulPct) || helpfulPct < 0 || helpfulPct > 100) {
      setThrStatus('도움됨 비율은 0~100 사이여야 합니다.', 'error'); return;
    }
    if (!Number.isFinite(meanMs) || meanMs < 0) {
      setThrStatus('ask 평균은 0 이상의 숫자여야 합니다.', 'error'); return;
    }
    if (!Number.isFinite(p95Ms) || p95Ms < 0) {
      setThrStatus('ask p95는 0 이상의 숫자여야 합니다.', 'error'); return;
    }
    if (!Number.isFinite(minN) || minN < 0) {
      setThrStatus('최소 표본은 0 이상의 정수여야 합니다.', 'error'); return;
    }

    const payload = {
      helpfulRateThreshold: helpfulPct / 100,
      latencyMeanAlertMs: meanMs,
      latencyP95AlertMs: p95Ms,
      minSamplesForRateAlert: minN,
      note: note || null
    };

    const btn = document.getElementById('aiq-thr-save');
    if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
    setThrStatus('저장 중...', 'info');
    try {
      const updated = await window.api.admin.updateAiThresholds(payload);
      fillThresholdsForm(updated);
      setThrStatus('저장 완료. 대시보드 경고에 즉시 반영됩니다.', 'success');
      window.ui.toast('경고 임계치가 갱신되었습니다.', 'success');
      // Refresh dashboard alert banner with new thresholds
      loadAiQuality(aiqDays);
      loadAiThresholdHistory();
    } catch (err) {
      console.error('Failed to update AI thresholds:', err);
      setThrStatus('저장 실패: ' + (err && err.message || ''), 'error');
      window.ui.toast('임계치 저장 실패', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '저장하고 즉시 적용'; }
    }
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
