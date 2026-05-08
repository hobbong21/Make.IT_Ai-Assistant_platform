// MaKIT Marketing Hub — 통합 마케팅 대시보드
// Depends on: config.js, api.js, auth.js, chatbot.js (renderMarkdown)
(function () {
  var DEFAULT_CAMPAIGN_COLUMNS = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED'];
  var SERVICE_KEY_TO_EMOJI = {
    'feed-generate': '📷',
    'remove-bg': '🖼️',
    'modelshot': '👤',
    'nlp-analyze': '📝',
    'youtube-comments': '💬',
    'youtube-influence': '⭐',
    'youtube-keyword-search': '🔍',
    'url-analyze': '🔗',
    'chatbot': '🤖',
    'review-analysis': '⭐'
  };

  var CHANNEL_NAMES = {
    'instagram': 'Instagram',
    'youtube': 'YouTube',
    'seo': 'SEO',
    'ads': '광고'
  };

  var CHANNEL_COLORS = {
    'instagram': '#E4405F',
    'youtube': '#FF0000',
    'seo': '#4285F4',
    'ads': '#EA4335'
  };

  // ========== 요약 카드 렌더 ==========
  function renderSummaryCards(data) {
    var grid = document.getElementById('summaryGrid');
    if (!grid) return;

    var cards = grid.querySelectorAll('.summary-card');
    if (cards.length >= 4) {
      cards[0].querySelector('.summary-card-value').textContent = data.activeCampaigns || 0;
      cards[1].querySelector('.summary-card-value').textContent = data.totalContents || 0;
      cards[2].querySelector('.summary-card-value').textContent = data.scheduledThisWeek || 0;
      cards[3].querySelector('.summary-card-value').textContent = (data.avgPerformance || 0) + '%';
    }
  }

  // ========== 캠페인 보드 렌더 ==========
  function renderCampaignBoard(campaigns) {
    var board = document.getElementById('campaignBoard');
    if (!board) return;
    board.innerHTML = '';

    // 상태별 그룹화
    var grouped = {};
    DEFAULT_CAMPAIGN_COLUMNS.forEach(function (status) {
      grouped[status] = [];
    });

    if (campaigns && Array.isArray(campaigns)) {
      campaigns.forEach(function (c) {
        if (grouped[c.status]) grouped[c.status].push(c);
      });
    }

    // 각 컬럼 렌더
    DEFAULT_CAMPAIGN_COLUMNS.forEach(function (status) {
      var items = grouped[status];
      var col = document.createElement('div');
      col.className = 'campaign-column';

      var title = document.createElement('div');
      title.className = 'campaign-column-title';
      title.innerHTML = getStatusLabel(status) + ' <span class="campaign-column-count">' + items.length + '</span>';
      col.appendChild(title);

      if (items.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'campaign-empty';
        empty.textContent = '캠페인이 없습니다';
        col.appendChild(empty);
      } else {
        items.forEach(function (c) {
          var card = document.createElement('div');
          card.className = 'campaign-card';
          card.innerHTML = '<div class="campaign-card-name">' + escapeHtml(c.name || '제목 없음') + '</div>' +
            '<div class="campaign-card-meta">' +
            '<div><span class="campaign-card-badge">예산: ' + formatCurrency(c.budget) + '</span></div>' +
            (c.channels && c.channels.length > 0 ? '<div>채널: ' + c.channels.join(', ') + '</div>' : '') +
            '<div>생성: ' + formatDate(c.createdAt) + '</div>' +
            '</div>';
          card.style.cursor = 'pointer';
          col.appendChild(card);
        });
      }
      board.appendChild(col);
    });
  }

  // ========== 콘텐츠 라이브러리 렌더 ==========
  function renderContentLibrary(contents) {
    var grid = document.getElementById('contentLibrary');
    if (!grid) return;
    grid.innerHTML = '';

    if (!contents || contents.length === 0) {
      grid.innerHTML = '<div class="content-empty">아직 생성된 콘텐츠가 없습니다</div>';
      return;
    }

    contents.slice(0, 6).forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'content-card';
      card.onclick = function () { window.location.href = 'service-detail.html?service=' + c.serviceKey; };

      var emoji = SERVICE_KEY_TO_EMOJI[c.serviceKey] || '📦';
      var thumbnail = document.createElement('div');
      thumbnail.className = 'content-thumbnail';
      thumbnail.textContent = emoji;

      var info = document.createElement('div');
      info.className = 'content-info';
      info.innerHTML = '<div class="content-type-badge">' + (c.contentType || 'FILE') + '</div>' +
        '<div class="content-title">' + escapeHtml(c.title || '제목 없음') + '</div>' +
        '<div class="content-meta">' +
        '<span>' + getServiceName(c.serviceKey) + '</span>' +
        '<span>' + formatDate(c.createdAt) + '</span>' +
        '</div>';

      card.appendChild(thumbnail);
      card.appendChild(info);
      grid.appendChild(card);
    });
  }

  // ========== 캘린더 히트맵 렌더 ==========
  function renderCalendar(buckets) {
    var calendarWeek = document.getElementById('calendarWeek');
    var calendarSummary = document.getElementById('calendarSummary');
    if (!calendarWeek) return;

    calendarWeek.innerHTML = '';

    // 오늘부터 7일 데이터 생성
    var today = new Date();
    var dayNames = ['월', '화', '수', '목', '금', '토', '일'];
    var totalScheduled = 0;
    var busiest = null;
    var busiestCount = 0;

    for (var i = 0; i < 7; i++) {
      var date = new Date(today);
      date.setDate(date.getDate() + i);
      var dateStr = date.toISOString().split('T')[0];
      var dayCount = buckets && buckets[dateStr] ? buckets[dateStr] : 0;
      totalScheduled += dayCount;

      if (dayCount > busiestCount) {
        busiestCount = dayCount;
        busiest = dateStr;
      }

      var day = document.createElement('div');
      day.className = 'calendar-day' + (dayCount > 2 ? ' calendar-day--busy' : (dayCount > 0 ? '' : ' calendar-day--empty'));

      day.innerHTML = '<div class="calendar-day-name">' + dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1] + '</div>' +
        '<div class="calendar-day-count">' + dayCount + '</div>' +
        '<div class="calendar-day-date">' + (date.getMonth() + 1) + '/' + date.getDate() + '</div>';
      calendarWeek.appendChild(day);
    }

    // 요약
    if (calendarSummary) {
      calendarSummary.innerHTML = '<strong>📊 이번 주 일정:</strong> 총 ' + totalScheduled + '건 예정' +
        (busiest ? '<br><strong>가장 바쁜 날:</strong> ' + busiest + ' (' + busiestCount + '건)' : '');
    }
  }

  // ========== AI 인사이트 렌더 ==========
  function renderInsights(markdown) {
    var card = document.getElementById('insightsCard');
    if (!card) return;

    if (!markdown) {
      card.innerHTML = '<div class="insights-empty">이번 주 인사이트를 불러올 수 없습니다</div>';
      return;
    }

    var content = document.createElement('div');
    content.className = 'mk-md-content';
    if (typeof window.renderMarkdown === 'function') {
      content.innerHTML = window.renderMarkdown(markdown);
    } else {
      // Fallback: 간단한 마크다운 렌더
      content.innerHTML = renderSimpleMarkdown(markdown);
    }

    card.innerHTML = '';
    card.appendChild(content);
  }

  // 간단한 마크다운 렌더 (chatbot.js의 renderMarkdown 없을 경우)
  function renderSimpleMarkdown(md) {
    if (!md) return '';
    return md
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/^\- (.*?)$/gm, '<li>$1</li>')
      .replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, function (m) {
        if (!/<[^>]+>/.test(m)) return '<p>' + m + '</p>';
        return m;
      });
  }

  // ========== 채널 성과 렌더 ==========
  function renderChannelPerformance(channelsData) {
    var channelTabs = document.getElementById('channelTabs');
    var channelContent = document.getElementById('channelContent');
    if (!channelTabs || !channelContent) return;

    var channels = ['instagram', 'youtube', 'seo', 'ads'];
    channelTabs.innerHTML = '';
    channelContent.innerHTML = '';

    channels.forEach(function (ch, idx) {
      // 탭
      var tab = document.createElement('button');
      tab.className = 'channel-tab' + (idx === 0 ? ' active' : '');
      tab.textContent = CHANNEL_NAMES[ch] || ch;
      tab.onclick = function () {
        document.querySelectorAll('.channel-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.channel-content').forEach(function (c) { c.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('ch-' + ch).classList.add('active');
      };
      channelTabs.appendChild(tab);

      // 콘텐츠
      var content = document.createElement('div');
      content.id = 'ch-' + ch;
      content.className = 'channel-content' + (idx === 0 ? ' active' : '');

      var data = channelsData && channelsData[ch];
      if (!data || !data.data) {
        content.innerHTML = '<div class="channel-empty">데이터를 불러올 수 없습니다</div>';
        channelContent.appendChild(content);
        return;
      }

      // 통계
      var statsHtml = '<div class="channel-stats">';
      var summary = data.summary || {};
      statsHtml += '<div class="channel-stat">' +
        '<div class="channel-stat-label">도달</div>' +
        '<div class="channel-stat-value">' + formatNumber(summary.totalImpressions) + '</div>' +
        '<div class="channel-stat-change' + (summary.changePercent >= 0 ? '' : ' negative') + '">' +
        (summary.changePercent >= 0 ? '▲' : '▼') + ' ' + Math.abs(summary.changePercent || 0).toFixed(1) + '%' +
        '</div></div>';
      statsHtml += '<div class="channel-stat">' +
        '<div class="channel-stat-label">클릭</div>' +
        '<div class="channel-stat-value">' + formatNumber(summary.totalClicks) + '</div>' +
        '</div>';
      statsHtml += '<div class="channel-stat">' +
        '<div class="channel-stat-label">전환</div>' +
        '<div class="channel-stat-value">' + formatNumber(summary.totalConversions) + '</div>' +
        '</div>';
      statsHtml += '<div class="channel-stat">' +
        '<div class="channel-stat-label">매출</div>' +
        '<div class="channel-stat-value">' + formatCurrency(summary.totalRevenue) + '</div>' +
        '</div>';
      statsHtml += '</div>';
      content.innerHTML = statsHtml;

      // 차트
      var chartContainer = document.createElement('div');
      chartContainer.className = 'channel-chart-container';
      chartContainer.id = 'chart-' + ch;
      content.appendChild(chartContainer);

      // 데이터 준비 (최대 30개)
      var labels = [];
      var impressions = [];
      var clicks = [];
      (data.data || []).slice(-30).forEach(function (d) {
        labels.push(d.date ? d.date.substring(5) : '');
        impressions.push(d.impressions || 0);
        clicks.push(d.clicks || 0);
      });

      // 차트 그리기 (Chart.js가 있으면)
      setTimeout(function () {
        if (window.Chart && chartContainer.offsetParent !== null) {
          var ctx = chartContainer.querySelector('canvas') || document.createElement('canvas');
          if (!chartContainer.querySelector('canvas')) chartContainer.appendChild(ctx);
          new window.Chart(ctx, {
            type: 'line',
            data: {
              labels: labels,
              datasets: [
                {
                  label: '도달',
                  data: impressions,
                  borderColor: CHANNEL_COLORS[ch] || '#1a1a1a',
                  backgroundColor: CHANNEL_COLORS[ch] + '20',
                  tension: 0.4,
                  fill: true
                },
                {
                  label: '클릭',
                  data: clicks,
                  borderColor: '#737373',
                  backgroundColor: '#73737320',
                  tension: 0.4,
                  fill: true
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: true, position: 'top' } },
              scales: { y: { beginAtZero: true } }
            }
          });
        }
      }, 100);

      channelContent.appendChild(content);
    });
  }

  // ========== 헬퍼 함수 ==========
  function getStatusLabel(status) {
    var labels = {
      'DRAFT': '📝 초안',
      'SCHEDULED': '📅 예약',
      'ACTIVE': '🚀 진행 중',
      'PAUSED': '⏸️ 일시중지',
      'COMPLETED': '✅ 완료'
    };
    return labels[status] || status;
  }

  function getServiceName(serviceKey) {
    var names = {
      'feed-generate': '피드 생성',
      'remove-bg': '배경 제거',
      'modelshot': '모델컷',
      'nlp-analyze': '자연어 분석',
      'youtube-comments': '유튜브 댓글',
      'youtube-influence': '영향력 분석',
      'youtube-keyword-search': '키워드 검색',
      'url-analyze': 'URL 분석',
      'chatbot': '챗봇',
      'review-analysis': '리뷰 분석'
    };
    return names[serviceKey] || serviceKey;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function formatCurrency(num) {
    if (!num) return '₩0';
    return '₩' + (num / 1000).toFixed(0) + 'k';
  }

  function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  }

  // ========== 액션 버튼 이벤트 위임 (인라인 onclick 대체) ==========
  function bindActions() {
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'new-campaign') {
        window.location.href = 'service-detail.html?service=feed-generate';
      } else if (action === 'more-contents') {
        window.location.href = 'all-services.html';
      } else if (action === 'refresh-insights') {
        refreshInsights();
      }
    });
  }

  // ========== 초기화 ==========
  async function init() {
    if (!auth || !auth.isLoggedIn()) {
      window.location.href = 'login.html';
      return;
    }

    bindActions();

    // 모든 섹션에 skeleton 표시
    showAllSkeletons();

    try {
      // 요약 카드
      var hubData = await api.marketing.hub();
      renderSummaryCards(hubData || {
        activeCampaigns: 0,
        totalContents: 0,
        scheduledThisWeek: 0,
        avgPerformance: 0
      });
    } catch (e) {
      console.warn('Hub summary fetch failed:', e);
      renderSummaryCards({});
    }

    try {
      // 캠페인 보드
      var campaigns = await api.marketing.campaigns();
      renderCampaignBoard(campaigns || []);
    } catch (e) {
      console.warn('Campaigns fetch failed:', e);
      renderCampaignBoard([]);
    }

    try {
      // 콘텐츠 라이브러리
      var contents = await api.marketing.contents();
      renderContentLibrary(contents && contents.contents ? contents.contents : []);
    } catch (e) {
      console.warn('Contents fetch failed:', e);
      renderContentLibrary([]);
    }

    try {
      // 캘린더
      var calendarData = await api.marketing.calendar();
      var buckets = {};
      if (calendarData && calendarData.buckets) {
        calendarData.buckets.forEach(function (b) {
          buckets[b.dateString] = b.count;
        });
      }
      renderCalendar(buckets);
    } catch (e) {
      console.warn('Calendar fetch failed:', e);
      renderCalendar({});
    }

    // 인사이트 (자동 로드)
    window.marketingHub.refreshInsights();

    try {
      // 채널 성과
      var channelData = await api.marketing.channelPerformance(30);
      var channelsObj = {};
      if (channelData && channelData.channels) {
        channelData.channels.forEach(function (ch) {
          channelsObj[ch.channel] = ch;
        });
      }
      renderChannelPerformance(channelsObj);
    } catch (e) {
      console.warn('Channel performance fetch failed:', e);
      renderChannelPerformance({});
    }
  }

  // Skeleton loading for marketing hub sections
  function showAllSkeletons() {
    // Campaign board: 5 skeleton cards
    var board = document.getElementById('campaignBoard');
    if (board) {
      board.innerHTML = '';
      for (var i = 0; i < 5; i++) {
        board.appendChild(window.makitSkeleton.card());
      }
    }

    // Content library: 6 skeleton cards
    var contentLib = document.getElementById('contentLibrary');
    if (contentLib) {
      contentLib.innerHTML = '';
      for (var i = 0; i < 6; i++) {
        contentLib.appendChild(window.makitSkeleton.card());
      }
    }

    // Calendar: 7 skeleton rows (simplified)
    var calendar = document.getElementById('calendarWeek');
    if (calendar) {
      calendar.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'mk-skeleton-stack';
      for (var i = 0; i < 7; i++) {
        wrap.appendChild(window.makitSkeleton.row({width: 100}));
      }
      calendar.appendChild(wrap);
    }

    // Insights: stack of text rows
    var insights = document.getElementById('insightContent');
    if (insights) {
      insights.innerHTML = '';
      var stack = document.createElement('div');
      stack.className = 'mk-skeleton-stack';
      for (var i = 0; i < 5; i++) {
        if (i % 3 === 0) {
          stack.appendChild(window.makitSkeleton.row({heading: true, width: 50}));
        } else {
          stack.appendChild(window.makitSkeleton.row({width: 75}));
        }
      }
      insights.appendChild(stack);
    }
  }

  // 인사이트 새로고침
  async function refreshInsights() {
    try {
      var insightsData = await api.marketing.insightsWeekly();
      var markdown = insightsData && insightsData.insightMarkdown ? insightsData.insightMarkdown :
        '# 이번 주 마케팅 성과\n\n## 📊 요약\n- 발행 5회\n- 총 도달 12,300\n- 클릭율 4.2%\n\n## 🎯 최고 성과\n1. 인스타 피드 v3\n2. 유튜브 짧은영상\n3. SEO 최적화 게시물';
      renderInsights(markdown);
    } catch (e) {
      console.warn('Insights fetch failed:', e);
      renderInsights('# 이번 주 마케팅 성과\n\n## 📊 요약\n지난 주 캠페인 분석\n\n## 💡 추천\n다음 주에는 더 많은 콘텐츠를 발행해보세요.');
    }
  }

  // 전역 스코프 노출
  window.marketingHub = {
    init: init,
    refreshInsights: refreshInsights
  };

  // DOMContentLoaded에서 자동 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
