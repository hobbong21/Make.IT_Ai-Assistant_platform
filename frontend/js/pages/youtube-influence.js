// MaKIT - 유튜브 영향력 분석 (youtube-influence)
// 채널 URL/핸들 입력 → 구독자/조회수/참여율 기반 영향력 점수와 등급 산출
// 단일 / 다중 채널 비교, 분석 기간 프리셋, 이력 + JSON/CSV/MD 내보내기.

(function () {
  'use strict';

  var STORAGE_KEY = 'makit_yi_history_v1';
  var HISTORY_MAX = 10;

  var WINDOWS = [
    { id: '7', label: '최근 7일', days: 7 },
    { id: '30', label: '최근 30일', days: 30 },
    { id: '90', label: '최근 90일', days: 90 },
    { id: '365', label: '최근 1년', days: 365 },
  ];

  var state = {
    multi: false,
    windowId: '30',
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
    console.log('[yi] ' + msg);
  }
  function fmtNum(n) {
    if (n == null || isNaN(n)) return '—';
    n = Number(n);
    if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '만';
    return n.toLocaleString();
  }
  function fmtPct(v) {
    if (v == null || isNaN(v)) return '—';
    return (Number(v) * 100).toFixed(2) + '%';
  }

  // ---------- 이력 ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn('[yi] history load failed, resetting:', err);
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
        console.warn('[yi] history quota exceeded, dropping oldest; remaining=' + (snapshot.length - 1), err);
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
    if (!confirm('최근 분석 이력을 모두 삭제할까요?')) return;
    state.history = [];
    saveHistory();
    renderHistory();
  }

  // ---------- 입력 ----------
  function collectChannels() {
    var raw = ($('yiChannels').value || '').trim();
    if (!raw) throw new Error('채널 URL 또는 핸들을 입력해주세요.');
    var lines = raw.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error('채널 URL 또는 핸들을 입력해주세요.');
    if (!state.multi) lines = [lines[0]];
    return lines;
  }
  function getWindowDays() {
    var custom = $('yiWindowCustom');
    var v = custom && custom.value ? parseInt(custom.value, 10) : NaN;
    if (!isNaN(v) && v > 0) return v;
    var w = WINDOWS.find(function (w) { return w.id === state.windowId; });
    return w ? w.days : 30;
  }

  // ---------- 분석 ----------
  async function runAnalyze() {
    var btn = $('yiRunBtn');
    btn.disabled = true; btn.innerHTML = '<span class="an-loading"></span>분석 중...';
    try {
      var channels = collectChannels();
      var windowDays = getWindowDays();
      var results = await Promise.all(channels.map(function (c) {
        return api.data.youtubeInfluence(c, windowDays)
          .catch(function (err) { return { __error: true, message: (err && err.message) || '실패', channelId: c }; });
      }));
      var pkg = {
        id: 'r-' + Date.now(),
        timestamp: Date.now(),
        mode: channels.length > 1 ? 'compare' : 'single',
        opts: { windowDays: windowDays },
        items: results.map(function (r, i) {
          if (r && r.__error) return { channelId: channels[i], error: r.message };
          var m = (r && r.metrics) || {};
          return {
            channelId: channels[i],
            channelTitle: (r && (r.channelTitle || r.title)) || '',
            channelThumbnail: (r && (r.thumbnail || r.channelThumbnail)) || '',
            influenceScore: (r && r.influenceScore != null) ? Number(r.influenceScore) : null,
            tier: (r && r.tier) || '',
            metrics: {
              subscribers: m.subscribers || 0,
              avgViews: m.avgViews || 0,
              avgLikes: m.avgLikes || 0,
              avgComments: m.avgComments || 0,
              avgEngagementRate: m.avgEngagementRate != null ? Number(m.avgEngagementRate) : null,
              videoCount: m.videoCount || 0,
            },
          };
        }),
      };
      state.lastResult = pkg;
      renderResult();
      addHistory({
        id: pkg.id, timestamp: pkg.timestamp,
        title: makeHistoryTitle(pkg),
        package: JSON.parse(JSON.stringify(pkg)),
      });
      toast('분석을 완료했습니다.', 'success');
    } catch (err) {
      console.error('[yi] runAnalyze', err);
      toast((err && err.message) || '분석 실패', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '분석 실행';
    }
  }
  function makeHistoryTitle(pkg) {
    var first = pkg.items[0] || {};
    var label = first.channelTitle || first.channelId || '(채널 없음)';
    return (pkg.mode === 'compare' ? '[비교 ' + pkg.items.length + '건] ' : '') + label + ' (' + pkg.opts.windowDays + '일)';
  }

  // ---------- 결과 렌더 ----------
  function renderResult() {
    var box = $('yiResult');
    if (!state.lastResult) {
      box.innerHTML = '<p class="an-result-empty">왼쪽에 채널 URL/핸들을 입력하고 \"분석 실행\"을 누르면 여기에 결과가 표시됩니다.</p>';
      $('yiExportBar').style.display = 'none';
      return;
    }
    var pkg = state.lastResult;
    if (pkg.mode === 'single') renderSingle(box, pkg.items[0], pkg.opts);
    else renderCompare(box, pkg.items, pkg.opts);
    $('yiExportBar').style.display = 'flex';
  }

  function tierClass(t) {
    var k = String(t || '').toUpperCase().charAt(0);
    return ['S', 'A', 'B', 'C'].indexOf(k) >= 0 ? 'an-tier-' + k : 'an-tier-C';
  }

  function renderSingle(box, item, opts) {
    if (item.error) {
      box.innerHTML = '<div class="an-warn">분석 실패: ' + escapeHtml(item.error) +
        '<br><span class="an-hint">채널: ' + escapeHtml(item.channelId) + '</span></div>';
      return;
    }
    var m = item.metrics || {};
    var scoreNum = item.influenceScore;
    var scoreText = scoreNum != null ? scoreNum.toFixed(1) : '—';
    var scoreClamped = scoreNum != null ? Math.max(0, Math.min(100, scoreNum)) : 0;
    var html = '';
    html += '<div style="display:grid;grid-template-columns:auto 1fr;gap:1rem;align-items:center;margin-bottom:1rem;">';
    html += '<div class="an-gauge-wrap">' + renderGauge(scoreClamped) +
      '<div class="an-gauge-score">' + scoreText + '</div>' +
      (item.tier ? '<span class="an-tier-pill ' + tierClass(item.tier) + '">' + escapeHtml(item.tier) + ' 등급</span>' : '') +
      '</div>';
    html += '<div>';
    html += '<h3 style="margin:0 0 0.25rem;font-size:1.0625rem;">' + escapeHtml(item.channelTitle || item.channelId) + '</h3>';
    html += '<p class="an-hint" style="margin:0 0 0.5rem;word-break:break-all;">' + escapeHtml(item.channelId) +
      ' · 분석 기간: 최근 ' + opts.windowDays + '일</p>';
    html += '</div></div>';

    html += '<div class="an-stats">' +
      '<div class="an-stat"><strong>' + fmtNum(m.subscribers) + '</strong><span>구독자</span></div>' +
      '<div class="an-stat"><strong>' + fmtNum(m.avgViews) + '</strong><span>평균 조회수</span></div>' +
      '<div class="an-stat"><strong>' + fmtPct(m.avgEngagementRate) + '</strong><span>평균 참여율</span></div>' +
      '<div class="an-stat"><strong>' + fmtNum(m.videoCount) + '</strong><span>분석 영상</span></div>' +
      '</div>';

    html += '<h4 style="font-size:0.875rem;font-weight:700;margin:1rem 0 0.5rem;">세부 지표</h4>';
    html += '<div class="an-stats">' +
      '<div class="an-stat"><strong>' + fmtNum(m.avgLikes) + '</strong><span>평균 좋아요</span></div>' +
      '<div class="an-stat"><strong>' + fmtNum(m.avgComments) + '</strong><span>평균 댓글</span></div>' +
      '</div>';

    box.innerHTML = html;
  }

  function renderCompare(box, items, opts) {
    var cards = items.map(function (item, idx) {
      if (item.error) {
        return '<div class="an-compare-card"><h5>#' + (idx + 1) + ' 실패</h5>' +
          '<p class="an-hint" style="margin:0;">' + escapeHtml(item.error) + '</p>' +
          '<p class="an-hint" style="word-break:break-all;">' + escapeHtml(item.channelId) + '</p></div>';
      }
      var m = item.metrics || {};
      var s = item.influenceScore != null ? item.influenceScore.toFixed(1) : '—';
      var title = item.channelTitle || item.channelId;
      return '<div class="an-compare-card">' +
        '<h5 title="' + escapeHtml(title) + '">#' + (idx + 1) + ' ' + escapeHtml(title) + '</h5>' +
        '<p style="margin:0 0 0.4rem;display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="font-size:1.5rem;font-weight:800;">' + s + '</span>' +
        (item.tier ? '<span class="an-tier-pill ' + tierClass(item.tier) + '">' + escapeHtml(item.tier) + '</span>' : '') +
        '</p>' +
        '<p class="an-hint" style="margin:0;">구독자 ' + fmtNum(m.subscribers) +
        ' · 평균 조회수 ' + fmtNum(m.avgViews) +
        ' · 참여율 ' + fmtPct(m.avgEngagementRate) + '</p>' +
        '</div>';
    }).join('');
    box.innerHTML = '<p class="an-hint">총 ' + items.length + '개 채널 비교 (최근 ' + opts.windowDays + '일).</p>' +
      '<div class="an-compare-grid">' + cards + '</div>';
  }

  // 반원 게이지 (0~100). score<=0 또는 null → 진행 path 미렌더(배경만).
  function renderGauge(score) {
    var bg = '<path d="M10,60 A50,50 0 0 1 110,60" fill="none" stroke="#f0eee6" stroke-width="12" stroke-linecap="round"></path>';
    var s = Number(score);
    if (!isFinite(s) || s <= 0) {
      return '<svg class="an-gauge" viewBox="0 0 120 70" aria-hidden="true">' + bg + '</svg>';
    }
    s = Math.min(100, s);
    var R = 50, CX = 60, CY = 60;
    var angleStart = Math.PI;
    var angleEnd = angleStart - (s / 100) * Math.PI;
    var x = CX + R * Math.cos(angleEnd);
    var y = CY + R * Math.sin(angleEnd);
    var largeArc = s > 50 ? 1 : 0;
    var path = 'M' + (CX - R) + ',' + CY + ' A' + R + ',' + R + ' 0 ' + largeArc + ' 1 ' + x.toFixed(2) + ',' + y.toFixed(2);
    var color = s >= 80 ? '#f59e0b' : s >= 60 ? '#22c55e' : s >= 40 ? '#3b82f6' : '#9ca3af';
    return '<svg class="an-gauge" viewBox="0 0 120 70" aria-hidden="true">' + bg +
      '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="12" stroke-linecap="round"></path>' +
      '</svg>';
  }

  // ---------- 이력 ----------
  function renderHistory() {
    var box = $('yiHistory');
    if (!box) return;
    if (!state.history.length) {
      box.innerHTML = '<p class="an-history-empty">아직 분석 이력이 없습니다.</p>';
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
    renderResult();
    toast('이전 분석 결과를 불러왔습니다.', 'info');
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
    triggerDownload(blob, 'youtube-influence_' + state.lastResult.id + '.json');
  }
  function exportCsv() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var rows = [
      ['# meta', 'mode=' + pkg.mode, 'windowDays=' + pkg.opts.windowDays, '', '', '', '', '', ''],
      ['#', 'channel_id', 'channel_title', 'influence_score', 'tier', 'subscribers', 'avg_views', 'avg_engagement_rate', 'video_count']
    ];
    pkg.items.forEach(function (item, i) {
      if (item.error) {
        rows.push([String(i + 1), item.channelId || '', 'ERROR: ' + item.error, '', '', '', '', '', '']);
        return;
      }
      var m = item.metrics || {};
      rows.push([
        String(i + 1), item.channelId || '', item.channelTitle || '',
        item.influenceScore != null ? String(item.influenceScore) : '',
        item.tier || '',
        String(m.subscribers || 0), String(m.avgViews || 0),
        m.avgEngagementRate != null ? String(m.avgEngagementRate) : '',
        String(m.videoCount || 0),
      ]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = String(v == null ? '' : v);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(',');
    }).join('\n');
    triggerDownload(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'youtube-influence_' + pkg.id + '.csv');
  }
  function exportMarkdown() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var lines = ['# 유튜브 영향력 분석 결과', '',
      '- 모드: ' + (pkg.mode === 'compare' ? '비교' : '단일'),
      '- 채널 수: ' + pkg.items.length,
      '- 분석 기간: 최근 ' + pkg.opts.windowDays + '일',
      '- 일시: ' + new Date(pkg.timestamp).toLocaleString(), ''];
    pkg.items.forEach(function (item, i) {
      lines.push('## #' + (i + 1) + ' ' + (item.channelTitle || item.channelId));
      if (item.error) { lines.push('> ❌ 분석 실패: ' + item.error); lines.push(''); return; }
      var m = item.metrics || {};
      lines.push('- **채널:** ' + item.channelId);
      lines.push('- **영향력 점수:** ' + (item.influenceScore != null ? item.influenceScore.toFixed(1) : '—') + (item.tier ? ' (' + item.tier + ' 등급)' : ''));
      lines.push('- **구독자:** ' + fmtNum(m.subscribers));
      lines.push('- **평균 조회수:** ' + fmtNum(m.avgViews));
      lines.push('- **평균 참여율:** ' + fmtPct(m.avgEngagementRate));
      lines.push('- **평균 좋아요/댓글:** ' + fmtNum(m.avgLikes) + ' / ' + fmtNum(m.avgComments));
      lines.push('- **분석 영상 수:** ' + fmtNum(m.videoCount));
      lines.push('');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), 'youtube-influence_' + pkg.id + '.md');
  }

  // ---------- 와이어링 ----------
  function selectWindow(id) {
    state.windowId = id;
    document.querySelectorAll('.an-chip[data-window]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.window === id);
    });
    var w = WINDOWS.find(function (w) { return w.id === id; });
    if (w) $('yiWindowCustom').value = String(w.days);
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

    var winBox = $('yiWindowPresets');
    winBox.innerHTML = WINDOWS.map(function (w) {
      return '<button type="button" class="an-chip" data-window="' + w.id + '">' + escapeHtml(w.label) + '</button>';
    }).join('');
    winBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.an-chip[data-window]'); if (!btn) return;
      selectWindow(btn.dataset.window);
    });
    selectWindow(state.windowId);

    $('yiMultiToggle').addEventListener('change', function (e) {
      state.multi = !!e.target.checked;
      var ta = $('yiChannels');
      ta.placeholder = state.multi
        ? '@channelhandle1\n@channelhandle2\nhttps://youtube.com/c/...\n(한 줄당 1개)'
        : '@channelhandle 또는 https://youtube.com/c/...';
    });

    $('yiRunBtn').addEventListener('click', runAnalyze);
    $('yiExportJsonBtn').addEventListener('click', exportJson);
    $('yiExportCsvBtn').addEventListener('click', exportCsv);
    $('yiExportMdBtn').addEventListener('click', exportMarkdown);

    $('yiHistory').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); removeHistory(del.getAttribute('data-del')); return; }
      var item = e.target.closest('.an-history-item');
      if (item) loadFromHistory(item.getAttribute('data-id'));
    });
    $('yiHistoryClearBtn').addEventListener('click', clearHistory);

    renderHistory();
    renderResult();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
