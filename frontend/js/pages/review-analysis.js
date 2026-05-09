// MaKIT - 상품 리뷰 분석 (review-analysis)
// productId 입력 → 전체 감정/주제/개선 포인트 분석.
// 단일/다중 productId 비교, 이력, JSON/CSV/MD export.

(function () {
  'use strict';

  var STORAGE_KEY = 'makit_ra_history_v1';
  var HISTORY_MAX = 10;

  var state = {
    multi: false,
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
    console.log('[ra] ' + msg);
  }
  function fmtNum(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString();
  }

  // ---------- 이력 ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn('[ra] history load failed, resetting:', err);
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
        console.warn('[ra] history quota exceeded, dropping oldest; remaining=' + (snapshot.length - 1), err);
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
  function collectIds() {
    var raw = ($('raIds').value || '').trim();
    if (!raw) throw new Error('상품 ID를 입력해주세요.');
    var lines = raw.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error('상품 ID를 입력해주세요.');
    if (!state.multi) lines = [lines[0]];
    return lines;
  }

  function normalizeOverall(o) {
    if (!o || typeof o !== 'object') return { label: '', score: null };
    var score = (o.score != null) ? Number(o.score)
              : (o.positiveRatio != null) ? Number(o.positiveRatio)
              : null;
    return {
      label: o.label || o.sentiment || '',
      score: (score != null && isFinite(score)) ? score : null,
      positive: o.positive != null ? Number(o.positive) : null,
      negative: o.negative != null ? Number(o.negative) : null,
      neutral: o.neutral != null ? Number(o.neutral) : null,
    };
  }
  function normalizeTheme(t) {
    if (!t || typeof t !== 'object') return null;
    return {
      theme: t.theme || t.topic || t.name || '',
      frequency: Number(t.frequency || t.count || 0),
      sentiment: t.sentiment || '',
    };
  }

  // ---------- 분석 ----------
  async function runAnalyze() {
    var btn = $('raRunBtn');
    btn.disabled = true; btn.innerHTML = '<span class="an-loading"></span>분석 중...';
    try {
      var ids = collectIds();
      var results = await Promise.all(ids.map(function (id) {
        return api.commerce.analyzeReviews(id)
          .catch(function (err) { return { __error: true, message: (err && err.message) || '실패', productId: id }; });
      }));
      var pkg = {
        id: 'r-' + Date.now(),
        timestamp: Date.now(),
        mode: ids.length > 1 ? 'compare' : 'single',
        items: results.map(function (r, i) {
          if (r && r.__error) return { productId: ids[i], error: r.message };
          return {
            productId: ids[i],
            reviewCount: Number(r && r.reviewCount || 0),
            overallSentiment: normalizeOverall(r && r.overallSentiment),
            themes: (Array.isArray(r && r.themes) ? r.themes : []).map(normalizeTheme).filter(Boolean),
            improvementPoints: Array.isArray(r && r.improvementPoints)
              ? r.improvementPoints.map(function (p) { return String(p); })
              : [],
            strengths: Array.isArray(r && r.strengths)
              ? r.strengths.map(function (p) { return String(p); })
              : [],
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
      console.error('[ra] runAnalyze', err);
      toast((err && err.message) || '분석 실패', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '분석 실행';
    }
  }
  function makeHistoryTitle(pkg) {
    var first = pkg.items[0] || {};
    var label = first.productId || '(없음)';
    return (pkg.mode === 'compare' ? '[비교 ' + pkg.items.length + '건] ' : '') + label;
  }

  // ---------- 결과 렌더 ----------
  function sentimentClass(label) {
    var k = String(label || '').toLowerCase();
    if (/긍정|positive|good/.test(k)) return 'an-tier-A';
    if (/부정|negative|bad/.test(k)) return 'an-tier-S';   // 강조용 색상 재활용
    if (/중립|neutral|mixed/.test(k)) return 'an-tier-B';
    return 'an-tier-C';
  }

  function renderResult() {
    var box = $('raResult');
    if (!state.lastResult) {
      box.innerHTML = '<p class="an-result-empty">왼쪽에 상품 ID를 입력하고 \"분석 실행\"을 누르면 여기에 결과가 표시됩니다.</p>';
      $('raExportBar').style.display = 'none';
      return;
    }
    var pkg = state.lastResult;
    if (pkg.mode === 'single') renderSingle(box, pkg.items[0]);
    else renderCompare(box, pkg.items);
    $('raExportBar').style.display = 'flex';
  }

  function renderSingle(box, item) {
    if (item.error) {
      box.innerHTML = '<div class="an-warn">분석 실패: ' + escapeHtml(item.error) +
        '<br><span class="an-hint">상품 ID: ' + escapeHtml(item.productId) + '</span></div>';
      return;
    }
    var overall = item.overallSentiment || {};
    var html = '';
    html += '<h3 style="margin:0 0 0.25rem;font-size:1.0625rem;">상품 ' + escapeHtml(item.productId) + '</h3>';
    html += '<p class="an-hint" style="margin:0 0 0.75rem;">총 리뷰 ' + fmtNum(item.reviewCount) + '건 분석</p>';

    html += '<div class="an-stats">';
    html += '<div class="an-stat"><strong>' + (overall.label
      ? '<span class="an-tier-pill ' + sentimentClass(overall.label) + '">' + escapeHtml(overall.label) + '</span>'
      : '—') + '</strong><span>전반적 감정</span></div>';
    if (overall.score != null) {
      html += '<div class="an-stat"><strong>' + (overall.score * 100).toFixed(1) + '%</strong><span>긍정 점수</span></div>';
    }
    if (overall.positive != null) html += '<div class="an-stat"><strong>' + fmtNum(overall.positive) + '</strong><span>긍정</span></div>';
    if (overall.negative != null) html += '<div class="an-stat"><strong>' + fmtNum(overall.negative) + '</strong><span>부정</span></div>';
    if (overall.neutral != null) html += '<div class="an-stat"><strong>' + fmtNum(overall.neutral) + '</strong><span>중립</span></div>';
    html += '</div>';

    // 주요 주제 (빈도 막대)
    if (item.themes.length) {
      var maxFreq = item.themes.reduce(function (m, t) { return Math.max(m, t.frequency || 0); }, 1);
      html += '<h4 style="font-size:0.875rem;font-weight:700;margin:0.75rem 0 0.5rem;">주요 주제</h4>';
      html += '<div style="display:flex;flex-direction:column;gap:0.4rem;">';
      html += item.themes.slice(0, 10).map(function (t) {
        var pct = Math.max(4, Math.round((t.frequency / maxFreq) * 100));
        var color = /긍정|positive/.test(String(t.sentiment).toLowerCase()) ? '#22c55e'
                  : /부정|negative/.test(String(t.sentiment).toLowerCase()) ? '#ef4444'
                  : '#3b82f6';
        return '<div>' +
          '<div style="display:flex;justify-content:space-between;font-size:0.8125rem;margin-bottom:0.2rem;">' +
            '<span>' + escapeHtml(t.theme) + (t.sentiment ? ' <span class="an-hint">(' + escapeHtml(t.sentiment) + ')</span>' : '') + '</span>' +
            '<span style="font-variant-numeric:tabular-nums;color:var(--mk-color-text-muted,#6e6e6e);">' + fmtNum(t.frequency) + '</span>' +
          '</div>' +
          '<div style="background:#f0eee6;border-radius:4px;height:8px;overflow:hidden;">' +
            '<div style="width:' + pct + '%;height:100%;background:' + color + ';"></div>' +
          '</div></div>';
      }).join('');
      html += '</div>';
    }

    if (item.strengths.length) {
      html += '<h4 style="font-size:0.875rem;font-weight:700;margin:1rem 0 0.4rem;">장점</h4>';
      html += '<ul style="margin:0;padding-left:1.2rem;font-size:0.875rem;">' +
        item.strengths.map(function (p) { return '<li>' + escapeHtml(p) + '</li>'; }).join('') + '</ul>';
    }
    if (item.improvementPoints.length) {
      html += '<h4 style="font-size:0.875rem;font-weight:700;margin:1rem 0 0.4rem;">개선 포인트</h4>';
      html += '<ul style="margin:0;padding-left:1.2rem;font-size:0.875rem;">' +
        item.improvementPoints.map(function (p) { return '<li>' + escapeHtml(p) + '</li>'; }).join('') + '</ul>';
    }

    box.innerHTML = html;
  }

  function renderCompare(box, items) {
    var cards = items.map(function (item, idx) {
      if (item.error) {
        return '<div class="an-compare-card"><h5>#' + (idx + 1) + ' 실패</h5>' +
          '<p class="an-hint" style="margin:0;">' + escapeHtml(item.error) + '</p>' +
          '<p class="an-hint">' + escapeHtml(item.productId) + '</p></div>';
      }
      var o = item.overallSentiment || {};
      var topThemes = item.themes.slice(0, 3).map(function (t) {
        return escapeHtml(t.theme) + '(' + fmtNum(t.frequency) + ')';
      }).join(', ');
      return '<div class="an-compare-card">' +
        '<h5 title="' + escapeHtml(item.productId) + '">#' + (idx + 1) + ' ' + escapeHtml(item.productId) + '</h5>' +
        '<p style="margin:0 0 0.4rem;">' +
          (o.label ? '<span class="an-tier-pill ' + sentimentClass(o.label) + '">' + escapeHtml(o.label) + '</span> ' : '') +
          '<strong>' + fmtNum(item.reviewCount) + '</strong> 리뷰</p>' +
        (topThemes ? '<p class="an-hint" style="margin:0;">주요 주제: ' + topThemes + '</p>' : '') +
        (item.improvementPoints.length ? '<p class="an-hint" style="margin:0.3rem 0 0;">개선: ' + escapeHtml(item.improvementPoints.slice(0, 2).join(' / ')) + '</p>' : '') +
        '</div>';
    }).join('');
    box.innerHTML = '<p class="an-hint">총 ' + items.length + '개 상품 비교 분석.</p>' +
      '<div class="an-compare-grid">' + cards + '</div>';
  }

  // ---------- 이력 ----------
  function renderHistory() {
    var box = $('raHistory');
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
    triggerDownload(blob, 'review-analysis_' + state.lastResult.id + '.json');
  }
  function exportCsv() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var rows = [
      ['# meta', 'mode=' + pkg.mode, 'items=' + pkg.items.length, '', '', '', ''],
      ['#', 'product_id', 'review_count', 'overall_label', 'overall_score', 'top_themes', 'improvement_points']
    ];
    pkg.items.forEach(function (item, i) {
      if (item.error) {
        rows.push([String(i + 1), item.productId || '', 'ERROR: ' + item.error, '', '', '', '']);
        return;
      }
      var o = item.overallSentiment || {};
      var themes = item.themes.slice(0, 5).map(function (t) { return t.theme + '(' + t.frequency + ')'; }).join('; ');
      var imps = item.improvementPoints.join('; ');
      rows.push([
        String(i + 1), item.productId, String(item.reviewCount),
        o.label || '', o.score != null ? String(o.score) : '',
        themes, imps,
      ]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = String(v == null ? '' : v);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(',');
    }).join('\n');
    triggerDownload(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'review-analysis_' + pkg.id + '.csv');
  }
  function exportMarkdown() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var lines = ['# 상품 리뷰 분석 결과', '',
      '- 모드: ' + (pkg.mode === 'compare' ? '비교' : '단일'),
      '- 상품 수: ' + pkg.items.length,
      '- 일시: ' + new Date(pkg.timestamp).toLocaleString(), ''];
    pkg.items.forEach(function (item, i) {
      lines.push('## #' + (i + 1) + ' 상품 ' + item.productId);
      if (item.error) { lines.push('> ❌ 분석 실패: ' + item.error); lines.push(''); return; }
      var o = item.overallSentiment || {};
      lines.push('- **리뷰 수:** ' + fmtNum(item.reviewCount));
      lines.push('- **전반적 감정:** ' + (o.label || '—') + (o.score != null ? ' (' + (o.score * 100).toFixed(1) + '%)' : ''));
      if (item.themes.length) {
        lines.push(''); lines.push('### 주요 주제'); lines.push('');
        item.themes.slice(0, 10).forEach(function (t) {
          lines.push('- ' + t.theme + ': ' + fmtNum(t.frequency) + (t.sentiment ? ' (' + t.sentiment + ')' : ''));
        });
      }
      if (item.strengths.length) {
        lines.push(''); lines.push('### 장점'); lines.push('');
        item.strengths.forEach(function (p) { lines.push('- ' + p); });
      }
      if (item.improvementPoints.length) {
        lines.push(''); lines.push('### 개선 포인트'); lines.push('');
        item.improvementPoints.forEach(function (p) { lines.push('- ' + p); });
      }
      lines.push('');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), 'review-analysis_' + pkg.id + '.md');
  }

  // ---------- 와이어링 ----------
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

    $('raMultiToggle').addEventListener('change', function (e) {
      state.multi = !!e.target.checked;
      var ta = $('raIds');
      ta.placeholder = state.multi
        ? 'PROD-001\nPROD-002\n(한 줄당 1개 또는 쉼표 구분)'
        : 'PROD-001';
    });

    $('raRunBtn').addEventListener('click', runAnalyze);
    $('raExportJsonBtn').addEventListener('click', exportJson);
    $('raExportCsvBtn').addEventListener('click', exportCsv);
    $('raExportMdBtn').addEventListener('click', exportMarkdown);

    $('raHistory').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); removeHistory(del.getAttribute('data-del')); return; }
      var item = e.target.closest('.an-history-item');
      if (item) loadFromHistory(item.getAttribute('data-id'));
    });
    $('raHistoryClearBtn').addEventListener('click', clearHistory);

    renderHistory();
    renderResult();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
