// MaKIT - 자연어 분석 (nlp-analyze) 페이지 스크립트
// 기능 (사용자 요청에 따른 6개 통합):
//  1) 입력 방식: 텍스트 / 파일(.txt/.csv) / URL
//  2) 결과 시각화: SVG 도넛(감정 분포) + 키워드 빈도 막대
//  3) 다중 텍스트 비교: 행별 감정/Top 키워드 표
//  4) 이력 & 내보내기: localStorage 최근 10건 + JSON/CSV/Markdown 다운로드
//  5) 고급 설정: 언어 / 요약 길이 / 키워드 수
//  6) 프롬프트 템플릿: 자주 쓰는 시나리오 원클릭 채움

(function () {
  'use strict';

  // ---------- 상수/유틸 ----------
  var STORAGE_KEY = 'makit_nlp_history_v1';
  var HISTORY_MAX = 10;
  var HISTORY_TEXT_CAP = 500;     // 항목당 입력 텍스트 저장 상한 (문자 수)
  var HISTORY_SUMMARY_CAP = 400;  // 항목당 요약 저장 상한 (문자 수)

  var TEMPLATES = [
    { label: '고객 피드백 분석', text: '아래는 고객들로부터 받은 피드백입니다. 주요 불만 사항과 만족 포인트, 그리고 개선 제안을 추출해주세요.\n\n[여기에 고객 피드백 텍스트를 붙여넣기]' },
    { label: '경쟁사 광고 카피', text: '다음은 경쟁사의 최근 광고 카피입니다. 핵심 메시지, 타깃 어조, 차별화 포인트를 분석해주세요.\n\n[광고 카피 텍스트]' },
    { label: '상품 리뷰 정리', text: '아래 상품 리뷰들의 전반적인 감정과 자주 언급되는 키워드, 개선 요구 사항을 정리해주세요.\n\n[리뷰들]' },
    { label: 'SNS 댓글 모니터링', text: '브랜드 관련 SNS 댓글입니다. 긍정/부정 비율, 주요 화제 키워드, 대응이 시급한 댓글을 식별해주세요.\n\n[댓글들]' },
    { label: '설문 자유응답 분석', text: '설문 자유응답 결과입니다. 핵심 주제별로 응답을 그룹핑하고 인사이트를 도출해주세요.\n\n[자유응답들]' },
    { label: '회의록 키워드 추출', text: '회의록에서 핵심 의제와 결정 사항, 핵심 키워드를 추출해주세요.\n\n[회의록 텍스트]' },
  ];

  var state = {
    inputMode: 'text', // 'text' | 'file' | 'url'
    multi: false,
    fileText: '',
    fileName: '',
    lastResult: null,    // 단일 또는 비교 결과 패키지
    history: loadHistory(),
  };

  // ---------- DOM helpers ----------
  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg, type) {
    if (window.ui && ui.toast) { ui.toast(msg, type || 'info'); return; }
    console.log('[nlp-analyze] ' + msg);
  }

  // ---------- 이력 (localStorage) ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      // 손상된 저장본은 제거 + 콘솔로 명시 (silent fallback 금지)
      console.warn('[nlp-analyze] history load failed, resetting:', err);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* noop */ }
      return [];
    }
  }
  // QuotaExceeded 시 가장 오래된 항목부터 떨어뜨려 재시도. 끝까지 실패하면 사용자에게 안내.
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
        snapshot.pop(); // 가장 오래된 항목 제거 후 재시도
      }
    }
    toast('이력 저장에 실패했습니다(브라우저 저장 공간 부족).', 'error');
    return false;
  }
  // 저장 직전 데이터 다이어트 — 긴 입력 텍스트/요약을 잘라서 quota 부담 완화
  function trimEntryForStorage(entry) {
    if (!entry || !entry.package || !Array.isArray(entry.package.items)) return entry;
    entry.package.items.forEach(function (item) {
      if (typeof item.text === 'string' && item.text.length > HISTORY_TEXT_CAP) {
        item.text = item.text.slice(0, HISTORY_TEXT_CAP) + '… [원문 일부, 저장 시 자동 축약]';
      }
      if (typeof item.summary === 'string' && item.summary.length > HISTORY_SUMMARY_CAP) {
        item.summary = item.summary.slice(0, HISTORY_SUMMARY_CAP) + '…';
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

  // ---------- CSV 파서 (간단 RFC4180) ----------
  function parseCsv(text) {
    var rows = [], row = [], cur = '', inQuotes = false, i = 0;
    while (i < text.length) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        cur += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(cur); cur = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
      cur += c; i++;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  // CSV에서 분석 대상 텍스트 컬럼을 골라낸다.
  // - 'text' 컬럼이 있으면 그것, 없으면 첫 컬럼
  function extractCsvTexts(rows) {
    if (!rows.length) return [];
    var header = rows[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    var idx = header.indexOf('text');
    var startRow = idx >= 0 ? 1 : 0; // 'text' 헤더가 있으면 그 다음 행부터
    if (idx < 0) idx = 0;
    var out = [];
    for (var i = startRow; i < rows.length; i++) {
      var v = (rows[i][idx] || '').trim();
      if (v) out.push(v);
    }
    return out;
  }

  // ---------- 입력 수집 ----------
  function getOptions() {
    var keywordsEl = $('nlpOptKeywords');
    var langEl = $('nlpOptLanguage');
    var summaryLenEl = $('nlpOptSummaryLength');
    return {
      language: (langEl && langEl.value) || 'ko',
      maxKeywords: parseInt((keywordsEl && keywordsEl.value) || '8', 10) || 8,
      summaryLength: (summaryLenEl && summaryLenEl.value) || 'medium',
    };
  }

  function splitMultiTexts(text) {
    // '---' 구분자 우선, 없으면 빈 줄로 split
    var parts;
    if (/^---\s*$/m.test(text)) {
      parts = text.split(/^---\s*$/m);
    } else {
      parts = text.split(/\n\s*\n/);
    }
    return parts.map(function (s) { return s.trim(); }).filter(Boolean);
  }

  async function collectInputs() {
    if (state.inputMode === 'text') {
      var t = ($('nlpText').value || '').trim();
      if (!t) throw new Error('텍스트를 입력해주세요.');
      return state.multi ? splitMultiTexts(t) : [t];
    }
    if (state.inputMode === 'file') {
      if (!state.fileText) throw new Error('파일을 먼저 업로드해주세요.');
      // 파일은 항상 다중 모드: txt는 빈 줄 split, csv는 행별
      if (/\.csv$/i.test(state.fileName)) {
        var rows = parseCsv(state.fileText);
        var texts = extractCsvTexts(rows);
        if (!texts.length) throw new Error('CSV에서 분석할 텍스트를 찾지 못했습니다. 첫 컬럼 또는 \"text\" 컬럼에 내용이 있어야 합니다.');
        return texts;
      }
      return splitMultiTexts(state.fileText);
    }
    if (state.inputMode === 'url') {
      var url = ($('nlpUrl').value || '').trim();
      if (!url) throw new Error('URL을 입력해주세요.');
      // URL → urlAnalyze 호출 → 본문/요약을 분석 대상으로 사용
      var u = await api.data.urlAnalyze(url);
      var body = (u && (u.bodyText || u.summary || u.title)) || '';
      if (!body) throw new Error('URL에서 본문을 가져오지 못했습니다.');
      // 입력 미리보기 갱신
      $('nlpText').value = body;
      return state.multi ? splitMultiTexts(body) : [body];
    }
    throw new Error('알 수 없는 입력 모드');
  }

  // ---------- 분석 실행 ----------
  async function runAnalyze() {
    var btn = $('nlpRunBtn');
    btn.disabled = true; btn.innerHTML = '<span class="nlp-loading"></span>분석 중...';
    try {
      var texts = await collectInputs();
      var opts = getOptions();
      var isMulti = texts.length > 1;
      var results = await Promise.all(texts.map(function (t) {
        return api.data.nlpAnalyze(t, opts).catch(function (err) {
          return { __error: true, message: (err && err.message) || '실패', text: t };
        });
      }));
      // 결과 패키지화
      var pkg = {
        id: 'r-' + Date.now(),
        timestamp: Date.now(),
        mode: isMulti ? 'compare' : 'single',
        inputMode: state.inputMode,
        opts: opts,
        items: results.map(function (r, i) {
          if (r && r.__error) return { error: r.message, text: texts[i] };
          return {
            text: texts[i],
            sentiment: (r && r.sentiment) || { label: '—', score: null },
            keywords: Array.isArray(r && r.keywords) ? r.keywords : [],
            summary: (r && r.summary) || '',
            language: (r && r.language) || opts.language,
          };
        }),
      };
      state.lastResult = pkg;
      renderResult();
      // 이력 저장은 패키지 deep copy를 축약해서 사용 (현재 결과 표시는 원본 유지)
      addHistory({
        id: pkg.id,
        timestamp: pkg.timestamp,
        title: makeHistoryTitle(pkg),
        package: JSON.parse(JSON.stringify(pkg)),
      });
      toast('분석을 완료했습니다.', 'success');
    } catch (err) {
      console.error('[nlp-analyze] runAnalyze', err);
      toast((err && err.message) || '분석 실패', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '분석 실행';
    }
  }

  function makeHistoryTitle(pkg) {
    var first = pkg.items[0] && (pkg.items[0].text || '');
    var n = pkg.items.length;
    var snip = (first || '').replace(/\s+/g, ' ').slice(0, 60);
    return (pkg.mode === 'compare' ? '[비교 ' + n + '건] ' : '') + snip + (snip.length === 60 ? '…' : '');
  }

  // ---------- 결과 렌더 ----------
  function renderResult() {
    var box = $('nlpResult');
    if (!state.lastResult) {
      box.innerHTML = '<p class="nlp-result-empty">왼쪽에서 텍스트/파일/URL 중 하나를 입력하고 \"분석 실행\"을 누르면 여기에 결과가 표시됩니다.</p>';
      $('nlpExportBar').style.display = 'none';
      return;
    }
    var pkg = state.lastResult;
    if (pkg.mode === 'single') renderSingle(box, pkg.items[0]);
    else renderCompare(box, pkg.items);
    $('nlpExportBar').style.display = 'flex';
  }

  function renderSingle(box, item) {
    if (item.error) {
      box.innerHTML = '<div class="nlp-warn">분석 실패: ' + escapeHtml(item.error) + '</div>';
      return;
    }
    var s = item.sentiment || {};
    var dist = s.distribution || null; // {positive, negative, neutral} 0..1
    if (!dist) {
      // 단일 라벨만 있으면 100% 분포로 가정
      dist = { positive: 0, negative: 0, neutral: 0 };
      var k = (s.label || 'neutral').toString().toLowerCase();
      if (dist[k] != null) dist[k] = 1; else dist.neutral = 1;
    }
    var html = '';
    if (item.summary) {
      html += '<div class="nlp-summary-block">' + escapeHtml(item.summary) + '</div>';
    }
    html += '<div class="nlp-charts">';
    html += '<div class="nlp-donut-wrap">' + renderDonut(dist) +
      '<div class="nlp-donut-label">감정 분포<strong>' + escapeHtml(s.label || '—') +
      (s.score != null ? ' (' + Number(s.score).toFixed(2) + ')' : '') + '</strong></div>' +
      '<div class="nlp-legend">' +
      '<span><i style="background:#22c55e"></i>긍정 ' + pct(dist.positive) + '</span>' +
      '<span><i style="background:#ef4444"></i>부정 ' + pct(dist.negative) + '</span>' +
      '<span><i style="background:#9ca3af"></i>중립 ' + pct(dist.neutral) + '</span>' +
      '</div></div>';
    html += '<div class="nlp-keywords"><h4>키워드 빈도</h4>' + renderKeywordBars(item.keywords) + '</div>';
    html += '</div>';
    if (item.language) {
      html += '<p class="nlp-hint" style="margin:0.5rem 0 0;">감지 언어: <strong>' + escapeHtml(item.language) + '</strong> · 키워드 ' + item.keywords.length + '개</p>';
    }
    box.innerHTML = html;
  }

  function renderCompare(box, items) {
    var rows = items.map(function (item, idx) {
      if (item.error) {
        return '<tr><td>' + (idx + 1) + '</td><td class="nlp-text-snippet">' + escapeHtml(item.text || '') + '</td>' +
          '<td colspan="3"><span class="nlp-sentiment-pill negative">실패</span> ' + escapeHtml(item.error) + '</td></tr>';
      }
      var s = item.sentiment || {};
      var label = (s.label || 'neutral').toString().toLowerCase();
      var pillClass = ['positive', 'negative', 'neutral'].indexOf(label) >= 0 ? label : 'neutral';
      var topKw = (item.keywords || []).slice(0, 3).map(function (k) {
        return typeof k === 'string' ? k : (k && (k.term || k.keyword || k.text)) || '';
      }).filter(Boolean).join(', ');
      return '<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td class="nlp-text-snippet" title="' + escapeHtml(item.text) + '">' + escapeHtml(item.text.slice(0, 80)) + '</td>' +
        '<td><span class="nlp-sentiment-pill ' + pillClass + '">' + escapeHtml(s.label || '—') + '</span></td>' +
        '<td>' + (s.score != null ? Number(s.score).toFixed(2) : '—') + '</td>' +
        '<td>' + escapeHtml(topKw || '—') + '</td>' +
        '</tr>';
    }).join('');
    box.innerHTML =
      '<p class="nlp-hint">총 ' + items.length + '건 비교 분석. 각 행은 입력한 텍스트 한 단위입니다.</p>' +
      '<table class="nlp-compare-table">' +
      '<thead><tr><th>#</th><th>텍스트</th><th>감정</th><th>점수</th><th>Top 키워드</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  function renderDonut(dist) {
    // SVG 도넛 — circumference 기반 stroke-dasharray
    var R = 32, C = 2 * Math.PI * R; // 약 201
    var pos = Math.max(0, Math.min(1, +dist.positive || 0));
    var neg = Math.max(0, Math.min(1, +dist.negative || 0));
    var neu = Math.max(0, Math.min(1, +dist.neutral || 0));
    var total = pos + neg + neu;
    if (total <= 0) { neu = 1; total = 1; }
    pos /= total; neg /= total; neu /= total;
    var posLen = pos * C, negLen = neg * C, neuLen = neu * C;
    function ring(color, len, offset) {
      return '<circle r="' + R + '" cx="50" cy="50" fill="transparent" ' +
        'stroke="' + color + '" stroke-width="14" ' +
        'stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-offset).toFixed(2) + '" ' +
        'transform="rotate(-90 50 50)"></circle>';
    }
    var s = '';
    var off = 0;
    s += ring('#22c55e', posLen, off); off += posLen;
    s += ring('#ef4444', negLen, off); off += negLen;
    s += ring('#9ca3af', neuLen, off);
    return '<svg class="nlp-donut" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle r="' + R + '" cx="50" cy="50" fill="transparent" stroke="#f0eee6" stroke-width="14"></circle>' +
      s + '</svg>';
  }

  function renderKeywordBars(keywords) {
    if (!keywords || !keywords.length) return '<p class="nlp-hint" style="margin:0;">추출된 키워드가 없습니다.</p>';
    // 키워드 정규화: 문자열 또는 {term/keyword/text, count/score/weight}
    var arr = keywords.map(function (k) {
      if (typeof k === 'string') return { label: k, value: 1 };
      var label = k.term || k.keyword || k.text || '';
      var value = k.count || k.score || k.weight || 1;
      return { label: label, value: +value };
    }).filter(function (k) { return k.label; });
    if (!arr.length) return '<p class="nlp-hint" style="margin:0;">추출된 키워드가 없습니다.</p>';
    var max = Math.max.apply(null, arr.map(function (k) { return k.value; }));
    return arr.map(function (k) {
      var w = max > 0 ? Math.max(4, (k.value / max) * 100) : 0;
      return '<div class="nlp-bar-row">' +
        '<span class="nlp-bar-label" title="' + escapeHtml(k.label) + '">' + escapeHtml(k.label) + '</span>' +
        '<span class="nlp-bar-track"><span class="nlp-bar-fill" style="width:' + w.toFixed(1) + '%"></span></span>' +
        '<span class="nlp-bar-val">' + (Number.isInteger(k.value) ? k.value : k.value.toFixed(2)) + '</span>' +
        '</div>';
    }).join('');
  }

  function pct(v) {
    if (v == null) return '—';
    return Math.round(Number(v) * 100) + '%';
  }

  // ---------- 이력 렌더 ----------
  function renderHistory() {
    var box = $('nlpHistory');
    if (!box) return;
    if (!state.history.length) {
      box.innerHTML = '<p class="nlp-history-empty">아직 분석 이력이 없습니다.</p>';
      return;
    }
    box.innerHTML = '<ul class="nlp-history-list">' + state.history.map(function (h) {
      var d = new Date(h.timestamp);
      var dateStr = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return '<li class="nlp-history-item" data-id="' + escapeHtml(h.id) + '">' +
        '<span class="nlp-h-text" title="' + escapeHtml(h.title) + '">' + escapeHtml(h.title || '(제목 없음)') + '</span>' +
        '<span class="nlp-h-meta">' + dateStr + '</span>' +
        '<button class="nlp-h-del" data-del="' + escapeHtml(h.id) + '" title="삭제" aria-label="삭제">×</button>' +
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
  function exportJson() {
    if (!state.lastResult) return;
    var blob = new Blob([JSON.stringify(state.lastResult, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerDownload(blob, 'nlp-analysis_' + state.lastResult.id + '.json');
  }
  function exportCsv() {
    if (!state.lastResult) return;
    var rows = [['#', 'text', 'sentiment_label', 'sentiment_score', 'top_keywords', 'summary', 'language']];
    state.lastResult.items.forEach(function (item, i) {
      var s = item.sentiment || {};
      var kw = (item.keywords || []).slice(0, 5).map(function (k) {
        return typeof k === 'string' ? k : (k.term || k.keyword || k.text || '');
      }).join('|');
      rows.push([
        String(i + 1),
        item.text || '',
        s.label || '',
        s.score != null ? String(s.score) : '',
        kw,
        item.summary || '',
        item.language || '',
      ]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = String(v == null ? '' : v);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(',');
    }).join('\n');
    // BOM for Excel 한글 호환
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, 'nlp-analysis_' + state.lastResult.id + '.csv');
  }
  function exportMarkdown() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var lines = ['# 자연어 분석 결과', '', '- 모드: ' + (pkg.mode === 'compare' ? '비교' : '단일'),
      '- 항목 수: ' + pkg.items.length, '- 일시: ' + new Date(pkg.timestamp).toLocaleString(),
      '- 옵션: 언어=' + pkg.opts.language + ', 요약=' + pkg.opts.summaryLength + ', 키워드 수=' + pkg.opts.maxKeywords, ''];
    pkg.items.forEach(function (item, i) {
      lines.push('## ' + (i + 1) + '.');
      if (item.error) { lines.push('> ❌ 분석 실패: ' + item.error); lines.push(''); return; }
      var s = item.sentiment || {};
      lines.push('- **감정:** ' + (s.label || '—') + (s.score != null ? ' (' + Number(s.score).toFixed(2) + ')' : ''));
      var kw = (item.keywords || []).map(function (k) {
        return typeof k === 'string' ? k : (k.term || k.keyword || k.text || '');
      }).filter(Boolean);
      if (kw.length) lines.push('- **키워드:** ' + kw.join(', '));
      if (item.summary) { lines.push(''); lines.push('**요약:** ' + item.summary); }
      lines.push(''); lines.push('```'); lines.push(item.text || ''); lines.push('```'); lines.push('');
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    triggerDownload(blob, 'nlp-analysis_' + pkg.id + '.md');
  }
  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename.replace(/[\\/:*?"<>|]/g, '_');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- UI 와이어링 ----------
  function selectTab(mode) {
    state.inputMode = mode;
    document.querySelectorAll('.nlp-tab').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.mode === mode);
    });
    document.querySelectorAll('.nlp-tabpanel').forEach(function (p) {
      p.classList.toggle('is-active', p.dataset.mode === mode);
    });
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsText(file, 'utf-8');
    });
  }

  async function handleFile(file) {
    if (!file) return;
    var name = file.name || '';
    if (!/\.(txt|csv)$/i.test(name)) {
      toast('지원하지 않는 파일 형식입니다 (.txt 또는 .csv).', 'error'); return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast('파일이 너무 큽니다 (최대 2MB).', 'error'); return;
    }
    try {
      state.fileText = await readFileAsText(file);
      state.fileName = name;
      $('nlpFileInfo').textContent = '선택된 파일: ' + name + ' (' + Math.round(file.size / 1024) + ' KB)';
    } catch (err) {
      toast('파일 읽기 실패: ' + (err && err.message), 'error');
    }
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

    // 템플릿 칩
    var tplBox = $('nlpTemplates');
    tplBox.innerHTML = TEMPLATES.map(function (t, i) {
      return '<button type="button" class="nlp-chip" data-tpl="' + i + '">' + escapeHtml(t.label) + '</button>';
    }).join('');
    tplBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.nlp-chip'); if (!btn) return;
      var t = TEMPLATES[+btn.dataset.tpl];
      if (!t) return;
      selectTab('text');
      $('nlpText').value = t.text;
      $('nlpText').focus();
    });

    // 탭
    document.querySelectorAll('.nlp-tab').forEach(function (b) {
      b.addEventListener('click', function () { selectTab(b.dataset.mode); });
    });

    // 다중 모드 토글
    $('nlpMultiToggle').addEventListener('change', function (e) {
      state.multi = !!e.target.checked;
    });

    // 파일 입력
    $('nlpFileInput').addEventListener('change', function (e) { handleFile(e.target.files && e.target.files[0]); });
    var drop = $('nlpDropZone');
    ;['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-dragover'); });
    });
    ;['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-dragover'); });
    });
    drop.addEventListener('drop', function (e) { handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    drop.addEventListener('click', function () { $('nlpFileInput').click(); });

    // URL 분석 버튼은 runAnalyze에서 처리 (탭이 url일 때 호출)
    $('nlpRunBtn').addEventListener('click', runAnalyze);

    // 내보내기
    $('nlpExportJsonBtn').addEventListener('click', exportJson);
    $('nlpExportCsvBtn').addEventListener('click', exportCsv);
    $('nlpExportMdBtn').addEventListener('click', exportMarkdown);

    // 이력 클릭/삭제
    $('nlpHistory').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); removeHistory(del.getAttribute('data-del')); return; }
      var item = e.target.closest('.nlp-history-item');
      if (item) loadFromHistory(item.getAttribute('data-id'));
    });
    $('nlpHistoryClearBtn').addEventListener('click', clearHistory);

    renderHistory();
    renderResult();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
