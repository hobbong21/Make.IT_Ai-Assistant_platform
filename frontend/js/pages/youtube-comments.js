// MaKIT - 유튜브 댓글 분석 (youtube-comments) 페이지 스크립트
// 기능:
//  1) 입력: 1개 또는 여러 영상 URL (한 줄당 1개)
//  2) 옵션 프리셋 칩(빠른/표준/심층) + 고급 설정(maxComments, async, 정렬, 지역)
//  3) 결과 시각화: 감정 도넛 + Top 주제 막대 + Top 댓글 리스트(필터링)
//  4) 다중 비교: 영상별 카드 그리드 (감정 비율 + top 주제)
//  5) 이력 (localStorage) + JSON/CSV/Markdown 내보내기
//  6) 영상 메타(가능한 경우) — 썸네일/제목/채널 표시

(function () {
  'use strict';

  var STORAGE_KEY = 'makit_yc_history_v1';
  var HISTORY_MAX = 10;
  var HISTORY_COMMENT_CAP = 30;     // 이력 저장 시 댓글 최대 개수
  var HISTORY_TEXT_CAP = 200;       // 이력 저장 시 댓글 본문 최대 길이

  var PRESETS = [
    { id: 'fast', label: '빠른 분석 (50)', maxComments: 50, async: false },
    { id: 'std', label: '표준 (200)', maxComments: 200, async: false },
    { id: 'deep', label: '심층 (500)', maxComments: 500, async: true },
  ];

  var state = {
    multi: false,
    presetId: 'std',
    lastResult: null,           // { id, timestamp, mode, items: [...] }
    history: loadHistory(),
    commentFilter: 'all',       // 'all' | 'positive' | 'negative' | 'neutral'
  };

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg, type) {
    if (window.ui && ui.toast) { ui.toast(msg, type || 'info'); return; }
    console.log('[yc] ' + msg);
  }
  function pct(v) {
    if (v == null) return '—';
    return Math.round(Number(v) * 100) + '%';
  }

  // ---------- 이력 ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn('[yc] history load failed, resetting:', err);
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
        console.warn('[yc] history quota exceeded, dropping oldest entry; remaining=' + (snapshot.length - 1), err);
        snapshot.pop();
      }
    }
    toast('이력 저장 실패(브라우저 저장 공간 부족).', 'error');
    return false;
  }
  function trimEntryForStorage(entry) {
    if (!entry || !entry.package || !Array.isArray(entry.package.items)) return entry;
    entry.package.items.forEach(function (item) {
      if (item.error) return;
      // 댓글은 최근 N개만 보관, 본문도 cap
      if (Array.isArray(item.topComments)) {
        item.topComments = item.topComments.slice(0, HISTORY_COMMENT_CAP).map(function (c) {
          var cap = HISTORY_TEXT_CAP;
          var t = String((c && (c.text || c.comment || '')) || '');
          return {
            text: t.length > cap ? t.slice(0, cap) + '…' : t,
            sentiment: (c && c.sentiment) || null,
            likes: (c && (c.likes || c.likeCount)) || 0,
            author: (c && (c.author || c.authorName)) || '',
          };
        });
      }
    });
    return entry;
  }
  function addHistory(entry) {
    state.history.unshift(trimEntryForStorage(entry));
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

  // ---------- 입력/옵션 ----------
  function getOptions() {
    var preset = PRESETS.find(function (p) { return p.id === state.presetId; }) || PRESETS[1];
    var maxEl = $('ycOptMaxComments');
    var asyncEl = $('ycOptAsync');
    var sortEl = $('ycOptSort');
    var regionEl = $('ycOptRegion');
    return {
      maxComments: parseInt((maxEl && maxEl.value) || preset.maxComments, 10) || preset.maxComments,
      async: asyncEl ? asyncEl.checked : preset.async,
      sort: (sortEl && sortEl.value) || 'relevance',
      regionCode: (regionEl && regionEl.value.trim()) || '',
    };
  }
  function collectUrls() {
    var raw = ($('ycUrls').value || '').trim();
    if (!raw) throw new Error('영상 URL을 입력해주세요.');
    var lines = raw.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error('영상 URL을 입력해주세요.');
    if (!state.multi) lines = [lines[0]];
    // 간단 형식 검증
    var bad = lines.find(function (u) { return !/^https?:\/\//i.test(u); });
    if (bad) throw new Error('URL 형식이 올바르지 않습니다: ' + bad);
    return lines;
  }

  // ---------- 분석 실행 ----------
  async function runAnalyze() {
    var btn = $('ycRunBtn');
    btn.disabled = true; btn.innerHTML = '<span class="yc-loading"></span>분석 중...';
    try {
      var urls = collectUrls();
      var opts = getOptions();
      var isMulti = urls.length > 1;
      // sort/regionCode는 백엔드 미지원 가능 — opts에 포함하되 api 레이어에서 알려진 키만 전달됨
      var results = await Promise.all(urls.map(function (u) {
        return api.data.youtubeComments(u, { maxComments: opts.maxComments, async: opts.async })
          .catch(function (err) { return { __error: true, message: (err && err.message) || '실패', url: u }; });
      }));
      var pkg = {
        id: 'r-' + Date.now(),
        timestamp: Date.now(),
        mode: isMulti ? 'compare' : 'single',
        opts: opts,
        items: results.map(function (r, i) {
          if (r && r.__error) return { url: urls[i], error: r.message };
          return {
            url: urls[i],
            videoMeta: (r && (r.videoMeta || r.video)) || null,
            totalAnalyzed: (r && r.totalAnalyzed) || 0,
            sentimentDistribution: (r && r.sentimentDistribution) || {},
            topThemes: Array.isArray(r && r.topThemes) ? r.topThemes : [],
            topComments: Array.isArray(r && (r.topComments || r.comments)) ? (r.topComments || r.comments) : [],
            summary: (r && r.summary) || '',
          };
        }),
      };
      state.lastResult = pkg;
      state.commentFilter = 'all';
      renderResult();
      addHistory({
        id: pkg.id,
        timestamp: pkg.timestamp,
        title: makeHistoryTitle(pkg),
        package: JSON.parse(JSON.stringify(pkg)),
      });
      toast('분석을 완료했습니다.', 'success');
    } catch (err) {
      console.error('[yc] runAnalyze', err);
      toast((err && err.message) || '분석 실패', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '분석 실행';
    }
  }
  function makeHistoryTitle(pkg) {
    var first = pkg.items[0] || {};
    var label = (first.videoMeta && first.videoMeta.title) || first.url || '(URL 없음)';
    return (pkg.mode === 'compare' ? '[비교 ' + pkg.items.length + '건] ' : '') + label;
  }

  // ---------- 결과 렌더 ----------
  function renderResult() {
    var box = $('ycResult');
    if (!state.lastResult) {
      box.innerHTML = '<p class="yc-result-empty">왼쪽에 영상 URL을 입력하고 \"분석 실행\"을 누르면 여기에 결과가 표시됩니다.</p>';
      $('ycExportBar').style.display = 'none';
      return;
    }
    var pkg = state.lastResult;
    if (pkg.mode === 'single') renderSingle(box, pkg.items[0]);
    else renderCompare(box, pkg.items);
    $('ycExportBar').style.display = 'flex';
  }

  function renderSingle(box, item) {
    if (item.error) {
      box.innerHTML = '<div class="yc-warn">분석 실패: ' + escapeHtml(item.error) +
        '<br><span class="yc-hint">URL: ' + escapeHtml(item.url) + '</span></div>';
      return;
    }
    var html = '';
    // 영상 메타
    if (item.videoMeta) {
      var vm = item.videoMeta;
      html += '<div class="yc-video-meta">' +
        (vm.thumbnail ? '<img src="' + escapeHtml(vm.thumbnail) + '" alt="" loading="lazy">' : '') +
        '<div class="yc-vm-info">' +
        '<p class="yc-vm-title" title="' + escapeHtml(vm.title || '') + '">' + escapeHtml(vm.title || '(제목 없음)') + '</p>' +
        '<p class="yc-vm-channel">' + escapeHtml(vm.channel || vm.channelTitle || '') + '</p>' +
        '<p class="yc-vm-link"><a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">영상 열기 ↗</a></p>' +
        '</div></div>';
    } else {
      html += '<p class="yc-hint">영상: <a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.url) + '</a></p>';
    }
    // 통계
    var dist = item.sentimentDistribution || {};
    var pos = +dist.positive || 0, neg = +dist.negative || 0, neu = +dist.neutral || 0;
    html += '<div class="yc-stats">' +
      '<div class="yc-stat"><strong>' + (item.totalAnalyzed || 0) + '</strong><span>분석 댓글</span></div>' +
      '<div class="yc-stat"><strong>' + pct(pos) + '</strong><span>긍정</span></div>' +
      '<div class="yc-stat"><strong>' + pct(neg) + '</strong><span>부정</span></div>' +
      '<div class="yc-stat"><strong>' + pct(neu) + '</strong><span>중립</span></div>' +
      '</div>';
    // 차트
    html += '<div class="yc-charts">';
    html += '<div class="yc-donut-wrap">' + renderDonut({ positive: pos, negative: neg, neutral: neu }) +
      '<div class="yc-donut-label">감정 분포<strong>전체 ' + (item.totalAnalyzed || 0) + '건</strong></div>' +
      '<div class="yc-legend">' +
      '<span><i style="background:#22c55e"></i>긍정</span>' +
      '<span><i style="background:#ef4444"></i>부정</span>' +
      '<span><i style="background:#9ca3af"></i>중립</span>' +
      '</div></div>';
    html += '<div class="yc-themes"><h4>Top 주제 (언급 수)</h4>' + renderThemeBars(item.topThemes) + '</div>';
    html += '</div>';
    // 댓글 리스트
    html += renderCommentSection(item.topComments || []);
    box.innerHTML = html;
    wireCommentFilters();
  }

  function renderCommentSection(comments) {
    if (!comments.length) {
      return '<div class="yc-comments"><h4><span>대표 댓글</span></h4><p class="yc-hint">표시할 댓글이 없습니다.</p></div>';
    }
    var filters = ['all', 'positive', 'negative', 'neutral'];
    var labels = { all: '전체', positive: '긍정', negative: '부정', neutral: '중립' };
    var filterButtons = filters.map(function (f) {
      var cls = 'yc-comment-filter' + (state.commentFilter === f ? ' is-active' : '');
      return '<button type="button" class="' + cls + '" data-filter="' + f + '">' + labels[f] + '</button>';
    }).join('');
    var filtered = state.commentFilter === 'all'
      ? comments
      : comments.filter(function (c) {
          var s = (c && c.sentiment && (c.sentiment.label || c.sentiment)) || 'neutral';
          return String(s).toLowerCase() === state.commentFilter;
        });
    var listHtml = filtered.map(function (c) {
      var label = (c && c.sentiment && (c.sentiment.label || c.sentiment)) || 'neutral';
      var key = String(label).toLowerCase();
      var pillCls = ['positive', 'negative', 'neutral'].indexOf(key) >= 0 ? key : 'neutral';
      var likes = (c && (c.likes || c.likeCount)) || 0;
      var author = (c && (c.author || c.authorName)) || '';
      return '<li class="yc-comment-item">' +
        '<span class="yc-c-pill ' + pillCls + '">' + escapeHtml(label) + '</span>' +
        '<span class="yc-c-text">' + escapeHtml(c.text || c.comment || '') +
          (author ? '<br><em style="opacity:.7;font-size:.7rem;">— ' + escapeHtml(author) + '</em>' : '') +
        '</span>' +
        '<span class="yc-c-meta">👍 ' + likes + '</span>' +
        '</li>';
    }).join('');
    return '<div class="yc-comments">' +
      '<h4><span>대표 댓글 (' + filtered.length + ' / ' + comments.length + ')</span><span class="yc-comment-filters">' + filterButtons + '</span></h4>' +
      '<ul class="yc-comment-list">' + (listHtml || '<li class="yc-comment-item"><span></span><span class="yc-c-text yc-hint">선택한 감정의 댓글이 없습니다.</span><span></span></li>') + '</ul>' +
      '</div>';
  }

  function wireCommentFilters() {
    document.querySelectorAll('.yc-comment-filter').forEach(function (b) {
      b.addEventListener('click', function () {
        state.commentFilter = b.dataset.filter || 'all';
        // 단일 모드에서만 적용
        if (state.lastResult && state.lastResult.mode === 'single') {
          renderResult();
        }
      });
    });
  }

  function renderCompare(box, items) {
    var cards = items.map(function (item, idx) {
      if (item.error) {
        return '<div class="yc-compare-card"><h5>#' + (idx + 1) + ' 실패</h5>' +
          '<p class="yc-hint" style="margin:0;">' + escapeHtml(item.error) + '</p>' +
          '<p class="yc-hint" style="word-break:break-all;">' + escapeHtml(item.url) + '</p></div>';
      }
      var dist = item.sentimentDistribution || {};
      var topT = (item.topThemes || []).slice(0, 5);
      var maxC = topT.reduce(function (m, t) { return Math.max(m, +t.count || 0); }, 0);
      var bars = topT.map(function (t) {
        var w = maxC > 0 ? Math.max(4, ((+t.count || 0) / maxC) * 100) : 0;
        return '<span class="yc-bar-label" title="' + escapeHtml(t.theme) + '">' + escapeHtml(t.theme) + '</span>' +
          '<span class="yc-bar-track"><span class="yc-bar-fill" style="width:' + w.toFixed(1) + '%"></span></span>' +
          '<span class="yc-bar-val">' + (t.count || 0) + '</span>';
      }).join('');
      var title = (item.videoMeta && item.videoMeta.title) || item.url;
      return '<div class="yc-compare-card">' +
        '<h5 title="' + escapeHtml(title) + '">#' + (idx + 1) + ' ' + escapeHtml(title) + '</h5>' +
        '<p class="yc-hint" style="margin:0 0 0.4rem;">' + (item.totalAnalyzed || 0) + '건 · 긍정 ' + pct(dist.positive) + ' / 부정 ' + pct(dist.negative) + ' / 중립 ' + pct(dist.neutral) + '</p>' +
        (bars ? '<div class="yc-mini-bars">' + bars + '</div>' : '<p class="yc-hint" style="margin:0;">주제 데이터 없음</p>') +
        '</div>';
    }).join('');
    box.innerHTML = '<p class="yc-hint">총 ' + items.length + '개 영상 비교 분석.</p>' +
      '<div class="yc-compare-grid">' + cards + '</div>';
  }

  function renderDonut(dist) {
    var R = 32, C = 2 * Math.PI * R;
    var pos = Math.max(0, +dist.positive || 0);
    var neg = Math.max(0, +dist.negative || 0);
    var neu = Math.max(0, +dist.neutral || 0);
    var total = pos + neg + neu;
    if (total <= 0) { neu = 1; total = 1; }
    pos /= total; neg /= total; neu /= total;
    function ring(color, len, offset) {
      return '<circle r="' + R + '" cx="50" cy="50" fill="transparent" ' +
        'stroke="' + color + '" stroke-width="14" ' +
        'stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-offset).toFixed(2) + '" ' +
        'transform="rotate(-90 50 50)"></circle>';
    }
    var posLen = pos * C, negLen = neg * C, neuLen = neu * C;
    var s = '', off = 0;
    s += ring('#22c55e', posLen, off); off += posLen;
    s += ring('#ef4444', negLen, off); off += negLen;
    s += ring('#9ca3af', neuLen, off);
    return '<svg class="yc-donut" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle r="' + R + '" cx="50" cy="50" fill="transparent" stroke="#f0eee6" stroke-width="14"></circle>' +
      s + '</svg>';
  }

  function renderThemeBars(themes) {
    if (!themes || !themes.length) return '<p class="yc-hint" style="margin:0;">추출된 주제가 없습니다.</p>';
    var arr = themes.map(function (t) {
      return { label: t.theme || t.keyword || t.name || '', value: +(t.count || t.score || t.weight || 1) };
    }).filter(function (k) { return k.label; });
    if (!arr.length) return '<p class="yc-hint" style="margin:0;">추출된 주제가 없습니다.</p>';
    var max = Math.max.apply(null, arr.map(function (k) { return k.value; }));
    return arr.map(function (k) {
      var w = max > 0 ? Math.max(4, (k.value / max) * 100) : 0;
      return '<div class="yc-bar-row">' +
        '<span class="yc-bar-label" title="' + escapeHtml(k.label) + '">' + escapeHtml(k.label) + '</span>' +
        '<span class="yc-bar-track"><span class="yc-bar-fill" style="width:' + w.toFixed(1) + '%"></span></span>' +
        '<span class="yc-bar-val">' + (Number.isInteger(k.value) ? k.value : k.value.toFixed(1)) + '</span>' +
        '</div>';
    }).join('');
  }

  // ---------- 이력 렌더 ----------
  function renderHistory() {
    var box = $('ycHistory');
    if (!box) return;
    if (!state.history.length) {
      box.innerHTML = '<p class="yc-history-empty">아직 분석 이력이 없습니다.</p>';
      return;
    }
    box.innerHTML = '<ul class="yc-history-list">' + state.history.map(function (h) {
      var d = new Date(h.timestamp);
      var dateStr = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return '<li class="yc-history-item" data-id="' + escapeHtml(h.id) + '">' +
        '<span class="yc-h-text" title="' + escapeHtml(h.title) + '">' + escapeHtml(h.title || '(제목 없음)') + '</span>' +
        '<span class="yc-h-meta">' + dateStr + '</span>' +
        '<button class="yc-h-del" data-del="' + escapeHtml(h.id) + '" title="삭제" aria-label="삭제">×</button>' +
        '</li>';
    }).join('') + '</ul>';
  }

  function loadFromHistory(id) {
    var h = state.history.find(function (e) { return e.id === id; });
    if (!h || !h.package) return;
    state.lastResult = h.package;
    state.commentFilter = 'all';
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
    triggerDownload(blob, 'youtube-comments_' + state.lastResult.id + '.json');
  }
  function exportCsv() {
    if (!state.lastResult) return;
    var opts = state.lastResult.opts || {};
    var rows = [
      ['# meta', 'mode=' + state.lastResult.mode, 'maxComments=' + (opts.maxComments || ''),
        'async=' + (opts.async ? 'true' : 'false'), 'sort=' + (opts.sort || ''),
        'regionCode=' + (opts.regionCode || ''), '', ''],
      ['#', 'url', 'video_title', 'total_analyzed', 'positive', 'negative', 'neutral', 'top_themes']
    ];
    state.lastResult.items.forEach(function (item, i) {
      if (item.error) {
        rows.push([String(i + 1), item.url || '', 'ERROR: ' + item.error, '', '', '', '', '']);
        return;
      }
      var d = item.sentimentDistribution || {};
      var themes = (item.topThemes || []).slice(0, 5).map(function (t) {
        return (t.theme || '') + '(' + (t.count || 0) + ')';
      }).join('|');
      rows.push([
        String(i + 1),
        item.url || '',
        (item.videoMeta && item.videoMeta.title) || '',
        String(item.totalAnalyzed || 0),
        d.positive != null ? String(d.positive) : '',
        d.negative != null ? String(d.negative) : '',
        d.neutral != null ? String(d.neutral) : '',
        themes,
      ]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = String(v == null ? '' : v);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(',');
    }).join('\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, 'youtube-comments_' + state.lastResult.id + '.csv');
  }
  function exportMarkdown() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var lines = ['# 유튜브 댓글 분석 결과', '',
      '- 모드: ' + (pkg.mode === 'compare' ? '비교' : '단일'),
      '- 영상 수: ' + pkg.items.length,
      '- 일시: ' + new Date(pkg.timestamp).toLocaleString(),
      '- 옵션: maxComments=' + pkg.opts.maxComments + ', async=' + pkg.opts.async +
        ', sort=' + (pkg.opts.sort || '-') + ', regionCode=' + (pkg.opts.regionCode || '-'), ''];
    pkg.items.forEach(function (item, i) {
      lines.push('## #' + (i + 1) + ' ' + ((item.videoMeta && item.videoMeta.title) || item.url));
      if (item.error) { lines.push('> ❌ 분석 실패: ' + item.error); lines.push(''); return; }
      var d = item.sentimentDistribution || {};
      lines.push('- **URL:** ' + item.url);
      lines.push('- **분석 댓글:** ' + (item.totalAnalyzed || 0));
      lines.push('- **감정 분포:** 긍정 ' + pct(d.positive) + ' / 부정 ' + pct(d.negative) + ' / 중립 ' + pct(d.neutral));
      var themes = (item.topThemes || []).map(function (t) { return (t.theme || '') + '(' + (t.count || 0) + ')'; });
      if (themes.length) lines.push('- **Top 주제:** ' + themes.join(', '));
      if (item.summary) { lines.push(''); lines.push('**요약:** ' + item.summary); }
      var top = (item.topComments || []).slice(0, 5);
      if (top.length) {
        lines.push(''); lines.push('### 대표 댓글');
        top.forEach(function (c) {
          var label = (c.sentiment && (c.sentiment.label || c.sentiment)) || '';
          var likes = c.likes || c.likeCount || 0;
          lines.push('- [' + label + ' / 👍 ' + likes + '] ' + (c.text || c.comment || ''));
        });
      }
      lines.push('');
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    triggerDownload(blob, 'youtube-comments_' + pkg.id + '.md');
  }

  // ---------- UI 와이어링 ----------
  function selectPreset(id) {
    state.presetId = id;
    var preset = PRESETS.find(function (p) { return p.id === id; });
    if (preset) {
      $('ycOptMaxComments').value = String(preset.maxComments);
      $('ycOptAsync').checked = !!preset.async;
    }
    document.querySelectorAll('.yc-chip[data-preset]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.preset === id);
    });
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

    // 프리셋 칩
    var presetBox = $('ycPresets');
    presetBox.innerHTML = PRESETS.map(function (p) {
      return '<button type="button" class="yc-chip" data-preset="' + p.id + '">' + escapeHtml(p.label) + '</button>';
    }).join('');
    presetBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.yc-chip[data-preset]'); if (!btn) return;
      selectPreset(btn.dataset.preset);
    });
    selectPreset(state.presetId);

    // 다중 토글
    $('ycMultiToggle').addEventListener('change', function (e) {
      state.multi = !!e.target.checked;
      var ta = $('ycUrls');
      ta.placeholder = state.multi
        ? 'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=...\n(한 줄당 1개 URL)'
        : 'https://www.youtube.com/watch?v=...';
    });

    $('ycRunBtn').addEventListener('click', runAnalyze);
    $('ycExportJsonBtn').addEventListener('click', exportJson);
    $('ycExportCsvBtn').addEventListener('click', exportCsv);
    $('ycExportMdBtn').addEventListener('click', exportMarkdown);

    $('ycHistory').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); removeHistory(del.getAttribute('data-del')); return; }
      var item = e.target.closest('.yc-history-item');
      if (item) loadFromHistory(item.getAttribute('data-id'));
    });
    $('ycHistoryClearBtn').addEventListener('click', clearHistory);

    renderHistory();
    renderResult();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
