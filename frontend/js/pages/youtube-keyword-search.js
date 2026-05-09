// MaKIT - 유튜브 키워드 채널 검색 (youtube-keyword-search)
// 키워드 리스트로 관련 유튜브 채널을 검색.
// 단일/다중 키워드, 지역(regionCode), 최대 결과 수, 정렬, 이력, JSON/CSV/MD export.

(function () {
  'use strict';

  var STORAGE_KEY = 'makit_yks_history_v1';
  var HISTORY_MAX = 10;

  var REGIONS = [
    { id: 'KR', label: '한국 (KR)' },
    { id: 'US', label: '미국 (US)' },
    { id: 'JP', label: '일본 (JP)' },
    { id: 'GB', label: '영국 (GB)' },
    { id: 'DE', label: '독일 (DE)' },
    { id: '',   label: '전체' },
  ];

  var SORT_OPTIONS = [
    { id: 'subscribers', label: '구독자순' },
    { id: 'views',       label: '조회수순' },
    { id: 'relevance',   label: '관련도순(원본)' },
  ];

  var state = {
    regionCode: 'KR',
    maxResults: 10,
    sort: 'subscribers',
    lastResult: null,
    history: loadHistory(),
  };

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg, type) {
    if (window.ui && ui.toast) { ui.toast(msg, type || 'info'); return; }
    console.log('[yks] ' + msg);
  }
  function fmtNum(n) {
    if (n == null || isNaN(n)) return '—';
    n = Number(n);
    if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '만';
    return n.toLocaleString();
  }

  // ---------- 이력 ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn('[yks] history load failed, resetting:', err);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* noop */ }
      return [];
    }
  }
  function saveHistory() {
    var snapshot = state.history.slice(0, HISTORY_MAX);
    while (snapshot.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        if (snapshot.length < state.history.length) {
          state.history = snapshot;
          toast('저장 공간이 부족하여 오래된 이력을 일부 정리했습니다.', 'info');
        }
        return true;
      } catch (err) {
        console.warn('[yks] history quota exceeded, dropping oldest; remaining=' + (snapshot.length - 1), err);
        snapshot.pop();
      }
    }
    toast('이력 저장 실패(브라우저 저장 공간 부족).', 'error');
    return false;
  }
  function addHistory(entry) {
    state.history.unshift(entry);
    state.history = state.history.slice(0, HISTORY_MAX);
    saveHistory();
    renderHistory();
  }
  function removeHistory(id) {
    state.history = state.history.filter(function (e) { return e.id !== id; });
    saveHistory();
    renderHistory();
  }
  function clearHistory() {
    if (!state.history.length) return;
    if (!confirm('최근 검색 이력을 모두 삭제할까요?')) return;
    state.history = [];
    saveHistory();
    renderHistory();
  }

  // ---------- 입력 ----------
  function collectKeywords() {
    var raw = ($('yksKeywords').value || '').trim();
    if (!raw) throw new Error('검색 키워드를 입력해주세요.');
    var parts = raw.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) throw new Error('검색 키워드를 입력해주세요.');
    return parts;
  }

  function normalizeChannel(c) {
    if (!c || typeof c !== 'object') return null;
    return {
      channelId: c.channelId || c.id || '',
      title: c.title || c.channelTitle || '(이름 없음)',
      description: c.description || '',
      subscriberCount: Number(c.subscriberCount || c.subscribers || 0),
      viewCount: Number(c.viewCount || c.totalViews || 0),
      videoCount: Number(c.videoCount || 0),
      thumbnail: c.thumbnail || c.thumbnailUrl || '',
      country: c.country || '',
      url: c.url || (c.channelId ? 'https://www.youtube.com/channel/' + c.channelId : ''),
    };
  }

  function sortChannels(arr) {
    var copy = arr.slice();
    if (state.sort === 'subscribers') copy.sort(function (a, b) { return b.subscriberCount - a.subscriberCount; });
    else if (state.sort === 'views') copy.sort(function (a, b) { return b.viewCount - a.viewCount; });
    return copy;
  }

  // ---------- 검색 ----------
  async function runSearch() {
    var btn = $('yksRunBtn');
    btn.disabled = true; btn.innerHTML = '<span class="an-loading"></span>검색 중...';
    try {
      var keywords = collectKeywords();
      var maxResults = Math.max(1, Math.min(50, parseInt($('yksMaxResults').value, 10) || 10));
      state.maxResults = maxResults;
      var opts = { maxResults: maxResults };
      if (state.regionCode) opts.regionCode = state.regionCode;
      var res = await api.data.youtubeKeywordSearch(keywords, opts);
      var channels = Array.isArray(res && res.channels) ? res.channels : [];
      var pkg = {
        id: 'r-' + Date.now(),
        timestamp: Date.now(),
        opts: { keywords: keywords, regionCode: state.regionCode, maxResults: maxResults, sort: state.sort },
        channels: channels.map(normalizeChannel).filter(Boolean),
      };
      state.lastResult = pkg;
      renderResult();
      addHistory({
        id: pkg.id, timestamp: pkg.timestamp,
        title: makeHistoryTitle(pkg),
        package: JSON.parse(JSON.stringify(pkg)),
      });
      toast('총 ' + pkg.channels.length + '개 채널을 찾았습니다.', 'success');
    } catch (err) {
      console.error('[yks] runSearch', err);
      toast((err && err.message) || '검색 실패', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '검색 실행';
    }
  }
  function makeHistoryTitle(pkg) {
    var kws = pkg.opts.keywords.slice(0, 3).join(', ');
    if (pkg.opts.keywords.length > 3) kws += ' 외 ' + (pkg.opts.keywords.length - 3);
    return kws + ' (' + pkg.channels.length + '건' + (pkg.opts.regionCode ? ' · ' + pkg.opts.regionCode : '') + ')';
  }

  // ---------- 결과 렌더 ----------
  function renderResult() {
    var box = $('yksResult');
    if (!state.lastResult) {
      box.innerHTML = '<p class="an-result-empty">왼쪽에 키워드를 입력하고 \"검색 실행\"을 누르면 여기에 결과가 표시됩니다.</p>';
      $('yksExportBar').style.display = 'none';
      return;
    }
    var pkg = state.lastResult;
    if (!pkg.channels.length) {
      box.innerHTML = '<div class="an-warn">검색 결과가 없습니다. 다른 키워드 또는 지역으로 시도해보세요.</div>';
      $('yksExportBar').style.display = 'flex';
      return;
    }
    var sorted = sortChannels(pkg.channels);
    var html = '';
    html += '<p class="an-hint">키워드 <strong>' + escapeHtml(pkg.opts.keywords.join(', ')) + '</strong> · ';
    html += '총 ' + pkg.channels.length + '개 채널' + (pkg.opts.regionCode ? ' · 지역 ' + escapeHtml(pkg.opts.regionCode) : '') + '</p>';
    html += '<div class="an-compare-grid">';
    html += sorted.map(function (c, idx) {
      var thumb = c.thumbnail
        ? '<img src="' + escapeHtml(c.thumbnail) + '" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:48px;height:48px;border-radius:50%;object-fit:cover;float:left;margin-right:0.6rem;">'
        : '<div style="width:48px;height:48px;border-radius:50%;background:#f0eee6;float:left;margin-right:0.6rem;"></div>';
      var link = c.url ? '<a href="' + escapeHtml(c.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(c.title) + ' ↗</a>' : escapeHtml(c.title);
      var desc = c.description ? '<p style="margin:0.4rem 0 0;font-size:0.75rem;color:var(--mk-color-text-muted,#6e6e6e);clear:both;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escapeHtml(c.description) + '</p>' : '';
      return '<div class="an-compare-card">' +
        thumb +
        '<h5 title="' + escapeHtml(c.title) + '" style="margin:0 0 0.25rem;">#' + (idx + 1) + ' ' + link + '</h5>' +
        '<p class="an-hint" style="margin:0;clear:both;">구독자 ' + fmtNum(c.subscriberCount) +
          ' · 조회수 ' + fmtNum(c.viewCount) +
          ' · 영상 ' + fmtNum(c.videoCount) + '</p>' +
        (c.country ? '<p class="an-hint" style="margin:0.2rem 0 0;">국가: ' + escapeHtml(c.country) + '</p>' : '') +
        desc +
        '</div>';
    }).join('');
    html += '</div>';
    box.innerHTML = html;
    $('yksExportBar').style.display = 'flex';
  }

  // ---------- 이력 ----------
  function renderHistory() {
    var box = $('yksHistory');
    if (!box) return;
    if (!state.history.length) {
      box.innerHTML = '<p class="an-history-empty">아직 검색 이력이 없습니다.</p>';
      return;
    }
    box.innerHTML = '<ul class="an-history-list">' + state.history.map(function (h) {
      var d = new Date(h.timestamp);
      var dateStr = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return '<li class="an-history-item" data-id="' + escapeHtml(h.id) + '">' +
        '<span class="an-h-text" title="' + escapeHtml(h.title) + '">' + escapeHtml(h.title) + '</span>' +
        '<span class="an-h-meta">' + dateStr + '</span>' +
        '<button class="an-h-del" data-del="' + escapeHtml(h.id) + '" title="삭제" aria-label="삭제">×</button>' +
        '</li>';
    }).join('') + '</ul>';
  }
  function loadFromHistory(id) {
    var h = state.history.find(function (e) { return e.id === id; });
    if (!h || !h.package) return;
    state.lastResult = h.package;
    if (h.package.opts && h.package.opts.sort) state.sort = h.package.opts.sort;
    syncSortSelect();
    renderResult();
    toast('이전 검색 결과를 불러왔습니다.', 'info');
  }

  // ---------- 내보내기 ----------
  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename.replace(/[\\/:*?"<>|]/g, '_');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportJson() {
    if (!state.lastResult) return;
    var blob = new Blob([JSON.stringify(state.lastResult, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerDownload(blob, 'youtube-keyword-search_' + state.lastResult.id + '.json');
  }
  function exportCsv() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var sorted = sortChannels(pkg.channels);
    var rows = [
      ['# meta', 'keywords=' + pkg.opts.keywords.join('|'), 'regionCode=' + (pkg.opts.regionCode || ''), 'maxResults=' + pkg.opts.maxResults, 'sort=' + pkg.opts.sort, '', '', ''],
      ['#', 'channel_id', 'title', 'subscribers', 'views', 'video_count', 'country', 'url']
    ];
    sorted.forEach(function (c, i) {
      rows.push([String(i + 1), c.channelId, c.title, String(c.subscriberCount), String(c.viewCount), String(c.videoCount), c.country, c.url]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = String(v == null ? '' : v);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(',');
    }).join('\n');
    triggerDownload(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'youtube-keyword-search_' + pkg.id + '.csv');
  }
  function exportMarkdown() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var sorted = sortChannels(pkg.channels);
    var lines = ['# 유튜브 키워드 채널 검색 결과', '',
      '- 키워드: ' + pkg.opts.keywords.join(', '),
      '- 지역: ' + (pkg.opts.regionCode || '전체'),
      '- 결과 수: ' + pkg.channels.length + ' / 요청 ' + pkg.opts.maxResults,
      '- 정렬: ' + pkg.opts.sort,
      '- 일시: ' + new Date(pkg.timestamp).toLocaleString(), ''];
    sorted.forEach(function (c, i) {
      lines.push('## #' + (i + 1) + ' ' + c.title);
      if (c.url) lines.push('- **URL:** ' + c.url);
      lines.push('- **채널 ID:** ' + c.channelId);
      lines.push('- **구독자:** ' + fmtNum(c.subscriberCount) + ' · **조회수:** ' + fmtNum(c.viewCount) + ' · **영상 수:** ' + fmtNum(c.videoCount));
      if (c.country) lines.push('- **국가:** ' + c.country);
      if (c.description) { lines.push(''); lines.push('> ' + c.description.replace(/\n+/g, ' ')); }
      lines.push('');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), 'youtube-keyword-search_' + pkg.id + '.md');
  }

  // ---------- 와이어링 ----------
  function selectRegion(id) {
    state.regionCode = id;
    document.querySelectorAll('.an-chip[data-region]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.region === id);
    });
  }
  function syncSortSelect() {
    var sel = $('yksSort');
    if (sel && sel.value !== state.sort) sel.value = state.sort;
  }
  function wireSidebarDropdowns() {
    document.querySelectorAll('.nav-dropdown-header').forEach(function (h) {
      h.addEventListener('click', function () {
        var d = h.parentElement; if (d) d.classList.toggle('expanded');
      });
    });
  }

  function init() {
    if (window.auth && !auth.requireLogin()) return;
    wireSidebarDropdowns();

    var regionBox = $('yksRegionPresets');
    regionBox.innerHTML = REGIONS.map(function (r) {
      return '<button type="button" class="an-chip" data-region="' + escapeHtml(r.id) + '">' + escapeHtml(r.label) + '</button>';
    }).join('');
    regionBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.an-chip[data-region]'); if (!btn) return;
      selectRegion(btn.getAttribute('data-region'));
    });
    selectRegion(state.regionCode);

    var sortSel = $('yksSort');
    sortSel.innerHTML = SORT_OPTIONS.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === state.sort ? ' selected' : '') + '>' + escapeHtml(s.label) + '</option>';
    }).join('');
    sortSel.addEventListener('change', function () {
      state.sort = sortSel.value;
      if (state.lastResult) {
        state.lastResult.opts.sort = state.sort;
        renderResult();
      }
    });

    $('yksRunBtn').addEventListener('click', runSearch);
    $('yksExportJsonBtn').addEventListener('click', exportJson);
    $('yksExportCsvBtn').addEventListener('click', exportCsv);
    $('yksExportMdBtn').addEventListener('click', exportMarkdown);

    $('yksHistory').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); removeHistory(del.getAttribute('data-del')); return; }
      var item = e.target.closest('.an-history-item');
      if (item) loadFromHistory(item.getAttribute('data-id'));
    });
    $('yksHistoryClearBtn').addEventListener('click', clearHistory);

    renderHistory();
    renderResult();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
