// MaKIT - 웹사이트 URL 분석 (url-analyze)
// 웹페이지 URL → 본문 추출 + 요약 + 단어수 + 언어
// 단일/다중 비교, 추출 모드(READER/FULL/MAIN), 이력 + JSON/CSV/MD 내보내기.

(function () {
  'use strict';

  var STORAGE_KEY = 'makit_ua_history_v1';
  var HISTORY_MAX = 10;
  var HISTORY_TEXT_CAP = 3000;  // 요약 본문 cap (이력 저장 시)

  var MODES = [
    { id: 'READER', label: '리더 모드 (본문)' },
    { id: 'FULL', label: '전체 페이지' },
    { id: 'MAIN', label: '메인 콘텐츠' },
  ];

  var state = {
    multi: false,
    extractMode: 'READER',
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
    console.log('[ua] ' + msg);
  }

  // ---------- 이력 ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn('[ua] history load failed, resetting:', err);
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
        console.warn('[ua] history quota exceeded, dropping oldest; remaining=' + (snapshot.length - 1), err);
        snapshot.pop();
      }
    }
    toast('이력 저장 실패(브라우저 저장 공간 부족).', 'error');
    return false;
  }
  function trimEntryForStorage(entry) {
    if (!entry || !entry.package || !Array.isArray(entry.package.items)) return entry;
    entry.package.items.forEach(function (item) {
      if (!item || item.error) return;
      var s = String(item.summary || '');
      if (s.length > HISTORY_TEXT_CAP) item.summary = s.slice(0, HISTORY_TEXT_CAP) + '…';
      // 본문 자체는 저장하지 않음
      delete item.content;
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

  // ---------- 입력 ----------
  function collectUrls() {
    var raw = ($('uaUrls').value || '').trim();
    if (!raw) throw new Error('URL을 입력해주세요.');
    var lines = raw.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error('URL을 입력해주세요.');
    if (!state.multi) lines = [lines[0]];
    var bad = lines.find(function (u) { return !/^https?:\/\//i.test(u); });
    if (bad) throw new Error('URL 형식이 올바르지 않습니다 (http(s)://): ' + bad);
    return lines;
  }

  // ---------- 분석 ----------
  async function runAnalyze() {
    var btn = $('uaRunBtn');
    btn.disabled = true; btn.innerHTML = '<span class="an-loading"></span>분석 중...';
    try {
      var urls = collectUrls();
      var mode = state.extractMode;
      var results = await Promise.all(urls.map(function (u) {
        return api.data.urlAnalyze(u, mode)
          .catch(function (err) { return { __error: true, message: (err && err.message) || '실패', url: u }; });
      }));
      var pkg = {
        id: 'r-' + Date.now(),
        timestamp: Date.now(),
        mode: urls.length > 1 ? 'compare' : 'single',
        opts: { extractMode: mode },
        items: results.map(function (r, i) {
          if (r && r.__error) return { url: urls[i], error: r.message };
          return {
            url: urls[i],
            title: (r && r.title) || '',
            summary: (r && r.summary) || '',
            wordCount: (r && r.wordCount) || 0,
            language: (r && r.language) || '',
            keywords: Array.isArray(r && r.keywords) ? r.keywords : [],
            publishedAt: (r && r.publishedAt) || '',
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
      console.error('[ua] runAnalyze', err);
      toast((err && err.message) || '분석 실패', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '분석 실행';
    }
  }
  function makeHistoryTitle(pkg) {
    var first = pkg.items[0] || {};
    var label = first.title || first.url || '(URL 없음)';
    return (pkg.mode === 'compare' ? '[비교 ' + pkg.items.length + '건] ' : '') + label;
  }

  // ---------- 결과 렌더 ----------
  function renderResult() {
    var box = $('uaResult');
    if (!state.lastResult) {
      box.innerHTML = '<p class="an-result-empty">왼쪽에 웹페이지 URL을 입력하고 \"분석 실행\"을 누르면 여기에 결과가 표시됩니다.</p>';
      $('uaExportBar').style.display = 'none';
      return;
    }
    var pkg = state.lastResult;
    if (pkg.mode === 'single') renderSingle(box, pkg.items[0]);
    else renderCompare(box, pkg.items);
    $('uaExportBar').style.display = 'flex';
  }

  function renderSingle(box, item) {
    if (item.error) {
      box.innerHTML = '<div class="an-warn">분석 실패: ' + escapeHtml(item.error) +
        '<br><span class="an-hint">URL: ' + escapeHtml(item.url) + '</span></div>';
      return;
    }
    var html = '';
    html += '<h3 style="margin:0 0 0.25rem;font-size:1.0625rem;">' + escapeHtml(item.title || item.url) + '</h3>';
    html += '<p class="an-hint" style="margin:0 0 0.5rem;word-break:break-all;"><a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.url) + ' ↗</a></p>';
    var pills = [];
    if (item.language) pills.push('<span class="an-meta-pill">언어: ' + escapeHtml(item.language) + '</span>');
    pills.push('<span class="an-meta-pill">' + (item.wordCount || 0).toLocaleString() + ' 단어</span>');
    if (item.publishedAt) pills.push('<span class="an-meta-pill">' + escapeHtml(item.publishedAt) + '</span>');
    html += '<div class="an-meta-row">' + pills.join('') + '</div>';

    html += '<h4 style="font-size:0.875rem;font-weight:700;margin:0.5rem 0 0.25rem;">요약</h4>';
    html += '<div class="an-summary">' + (item.summary ? escapeHtml(item.summary) : '<span class="an-hint">요약 없음</span>') + '</div>';

    if (item.keywords && item.keywords.length) {
      html += '<h4 style="font-size:0.875rem;font-weight:700;margin:0.75rem 0 0.25rem;">키워드</h4>';
      html += '<div class="an-meta-row">' +
        item.keywords.slice(0, 20).map(function (k) {
          var label = (k && (k.keyword || k.text || k.term)) || (typeof k === 'string' ? k : '');
          var score = (k && (k.score || k.weight || k.count));
          if (!label) return '';
          return '<span class="an-meta-pill">' + escapeHtml(label) + (score != null ? ' · ' + (typeof score === 'number' ? score.toFixed(2) : score) : '') + '</span>';
        }).join('') + '</div>';
    }
    box.innerHTML = html;
  }

  function renderCompare(box, items) {
    var cards = items.map(function (item, idx) {
      if (item.error) {
        return '<div class="an-compare-card"><h5>#' + (idx + 1) + ' 실패</h5>' +
          '<p class="an-hint" style="margin:0;">' + escapeHtml(item.error) + '</p>' +
          '<p class="an-hint" style="word-break:break-all;">' + escapeHtml(item.url) + '</p></div>';
      }
      var sum = String(item.summary || '');
      var snippet = sum.length > 160 ? sum.slice(0, 160) + '…' : sum;
      return '<div class="an-compare-card">' +
        '<h5 title="' + escapeHtml(item.title || item.url) + '">#' + (idx + 1) + ' ' + escapeHtml(item.title || item.url) + '</h5>' +
        '<p class="an-hint" style="margin:0 0 0.4rem;">' +
          (item.language ? '언어 ' + escapeHtml(item.language) + ' · ' : '') +
          (item.wordCount || 0).toLocaleString() + ' 단어</p>' +
        '<p style="margin:0;color:var(--mk-color-text,#1f1f1f);">' + escapeHtml(snippet) + '</p>' +
        '</div>';
    }).join('');
    box.innerHTML = '<p class="an-hint">총 ' + items.length + '개 페이지 비교 분석.</p>' +
      '<div class="an-compare-grid">' + cards + '</div>';
  }

  // ---------- 이력 ----------
  function renderHistory() {
    var box = $('uaHistory');
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
    triggerDownload(blob, 'url-analyze_' + state.lastResult.id + '.json');
  }
  function exportCsv() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var rows = [
      ['# meta', 'mode=' + pkg.mode, 'extractMode=' + pkg.opts.extractMode, '', '', ''],
      ['#', 'url', 'title', 'language', 'word_count', 'summary']
    ];
    pkg.items.forEach(function (item, i) {
      if (item.error) {
        rows.push([String(i + 1), item.url || '', 'ERROR: ' + item.error, '', '', '']);
        return;
      }
      rows.push([
        String(i + 1), item.url || '', item.title || '',
        item.language || '', String(item.wordCount || 0),
        item.summary || ''
      ]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = String(v == null ? '' : v);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(',');
    }).join('\n');
    triggerDownload(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'url-analyze_' + pkg.id + '.csv');
  }
  function exportMarkdown() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var lines = ['# 웹사이트 URL 분석 결과', '',
      '- 모드: ' + (pkg.mode === 'compare' ? '비교' : '단일'),
      '- URL 수: ' + pkg.items.length,
      '- 추출 모드: ' + pkg.opts.extractMode,
      '- 일시: ' + new Date(pkg.timestamp).toLocaleString(), ''];
    pkg.items.forEach(function (item, i) {
      lines.push('## #' + (i + 1) + ' ' + (item.title || item.url));
      if (item.error) { lines.push('> ❌ 분석 실패: ' + item.error); lines.push(''); return; }
      lines.push('- **URL:** ' + item.url);
      if (item.language) lines.push('- **언어:** ' + item.language);
      lines.push('- **단어 수:** ' + (item.wordCount || 0).toLocaleString());
      if (item.publishedAt) lines.push('- **발행일:** ' + item.publishedAt);
      if (item.keywords && item.keywords.length) {
        var kws = item.keywords.slice(0, 15).map(function (k) {
          return (k && (k.keyword || k.text || k.term)) || (typeof k === 'string' ? k : '');
        }).filter(Boolean);
        if (kws.length) lines.push('- **키워드:** ' + kws.join(', '));
      }
      if (item.summary) { lines.push(''); lines.push('### 요약'); lines.push(''); lines.push(item.summary); }
      lines.push('');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), 'url-analyze_' + pkg.id + '.md');
  }

  // ---------- 와이어링 ----------
  function selectMode(id) {
    state.extractMode = id;
    document.querySelectorAll('.an-chip[data-mode]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.mode === id);
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

    var modeBox = $('uaModePresets');
    modeBox.innerHTML = MODES.map(function (m) {
      return '<button type="button" class="an-chip" data-mode="' + m.id + '">' + escapeHtml(m.label) + '</button>';
    }).join('');
    modeBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.an-chip[data-mode]'); if (!btn) return;
      selectMode(btn.dataset.mode);
    });
    selectMode(state.extractMode);

    $('uaMultiToggle').addEventListener('change', function (e) {
      state.multi = !!e.target.checked;
      var ta = $('uaUrls');
      ta.placeholder = state.multi
        ? 'https://example.com/article1\nhttps://example.com/article2\n(한 줄당 1개)'
        : 'https://example.com/article';
    });

    $('uaRunBtn').addEventListener('click', runAnalyze);
    $('uaExportJsonBtn').addEventListener('click', exportJson);
    $('uaExportCsvBtn').addEventListener('click', exportCsv);
    $('uaExportMdBtn').addEventListener('click', exportMarkdown);

    $('uaHistory').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); removeHistory(del.getAttribute('data-del')); return; }
      var item = e.target.closest('.an-history-item');
      if (item) loadFromHistory(item.getAttribute('data-id'));
    });
    $('uaHistoryClearBtn').addEventListener('click', clearHistory);

    renderHistory();
    renderResult();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
