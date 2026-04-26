// Admin Dashboard page controller
(function () {
  let currentPage = 0;
  const pageSize = 20;
  let usageChart = null;
  let notifTypeChart = null;

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
    loadUsage(30);
    loadNotificationBreakdown(7);
    loadUsers(0);
    loadFeatures();

    // Event listeners
    document.getElementById('prev-page').addEventListener('click', () => {
      if (currentPage > 0) loadUsers(currentPage - 1);
    });

    document.getElementById('next-page').addEventListener('click', () => {
      loadUsers(currentPage + 1);
    });
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
