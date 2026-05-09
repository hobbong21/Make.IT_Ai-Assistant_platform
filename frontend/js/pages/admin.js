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
    loadUsers(0);
    loadFeatures();

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

  function renderTagLatencyRows(tbody, rows, p95Threshold, fmtMs) {
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px;">기간 내 측정값이 없습니다.</td></tr>';
      return;
    }
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      const over = typeof r.p95Ms === 'number' && r.p95Ms > p95Threshold;
      if (over) tr.classList.add('aiq-tag-row--over');
      tr.innerHTML = `
        <td><code>${escapeHtml(r.tag || '')}</code></td>
        <td class="num">${fmtMs(r.meanMs || 0)}</td>
        <td class="num">${fmtMs(r.p50Ms || 0)}</td>
        <td class="num">${fmtMs(r.p95Ms || 0)}${over ? ' <span class="aiq-tag-flag" title="p95 임계 초과">⚠</span>' : ''}</td>
        <td class="num">${(r.count || 0).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
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

      // Tag-level latency tables (collection for ask, action for action)
      const p95Threshold = (data.latency && typeof data.latency.p95ThresholdMs === 'number')
        ? data.latency.p95ThresholdMs : 10000;
      const askHint = document.getElementById('aiq-ask-tag-hint');
      const actionHint = document.getElementById('aiq-action-tag-hint');
      const thresholdLabel = `p95 ${fmtMs(p95Threshold)} ms 초과 시 강조`;
      if (askHint) askHint.textContent = thresholdLabel;
      if (actionHint) actionHint.textContent = thresholdLabel;
      renderTagLatencyRows(
        document.getElementById('aiq-ask-tag-tbody'),
        (data.latency && data.latency.askByCollection) || [],
        p95Threshold,
        fmtMs
      );
      renderTagLatencyRows(
        document.getElementById('aiq-action-tag-tbody'),
        (data.latency && data.latency.actionByAction) || [],
        p95Threshold,
        fmtMs
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
