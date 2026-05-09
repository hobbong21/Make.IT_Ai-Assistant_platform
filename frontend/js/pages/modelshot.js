// MaKIT - AI 모델컷 생성 (modelshot)
// commerce.generateModelshot(payload) → {jobId, status} (비동기) → api.jobs.poll('commerce', jobId)
// 단일 폼, 옵션, 이력 + JSON export.

(function () {
  'use strict';

  var STORAGE_KEY = 'makit_ms_history_v1';
  var HISTORY_MAX = 10;
  var HISTORY_PROMPT_CAP = 800;

  var STYLES = [
    { id: '',          label: '기본' },
    { id: 'studio',    label: '스튜디오' },
    { id: 'street',    label: '거리' },
    { id: 'editorial', label: '에디토리얼' },
    { id: 'casual',    label: '캐주얼' },
  ];
  var SIZES = [
    { id: '',           label: '기본' },
    { id: '1024x1024',  label: '정사각 (1024)' },
    { id: '768x1152',   label: '세로 (3:4)' },
    { id: '1152x768',   label: '가로 (4:3)' },
  ];

  var state = {
    style: '',
    size: '',
    lastResult: null,
    activePoll: null,  // {jobId, abort: () => void}
    history: loadHistory(),
  };

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(u) {
    var s = String(u == null ? '' : u).trim();
    if (!s) return '';
    if (/^(https?:|blob:)/i.test(s)) return s;
    if (/^data:image\//i.test(s)) return s;
    if (s.charAt(0) === '/') return s;
    return '';
  }
  function toast(msg, type) {
    if (window.ui && ui.toast) { ui.toast(msg, type || 'info'); return; }
    console.log('[ms] ' + msg);
  }

  // ---------- 이력 ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn('[ms] history load failed, resetting:', err);
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
        console.warn('[ms] history quota exceeded, dropping oldest; remaining=' + (snapshot.length - 1), err);
        snapshot.pop();
      }
    }
    toast('이력 저장 실패(브라우저 저장 공간 부족).', 'error');
    return false;
  }
  function trimEntryForStorage(entry) {
    if (!entry || !entry.package) return entry;
    var p = entry.package;
    if (p.payload && typeof p.payload.description === 'string' && p.payload.description.length > HISTORY_PROMPT_CAP) {
      p.payload.description = p.payload.description.slice(0, HISTORY_PROMPT_CAP) + '…';
    }
    return entry;
  }
  function addHistory(entry) {
    state.history.unshift(trimEntryForStorage(entry));
    state.history = state.history.slice(0, HISTORY_MAX);
    saveHistory();
    renderHistory();
  }
  function updateHistoryEntry(id, mutate) {
    var i = state.history.findIndex(function (e) { return e.id === id; });
    if (i < 0) return;
    mutate(state.history[i]);
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
    if (!confirm('최근 생성 이력을 모두 삭제할까요?')) return;
    state.history = [];
    saveHistory();
    renderHistory();
  }

  // ---------- 입력 ----------
  function buildPayload() {
    var description = ($('msPrompt').value || '').trim();
    if (!description) throw new Error('프롬프트를 입력해주세요.');
    var payload = { description: description };
    if (state.style) payload.style = state.style;
    if (state.size) payload.size = state.size;
    return payload;
  }

  // ---------- 생성 ----------
  async function runGenerate() {
    if (state.activePoll) {
      toast('이전 작업이 진행 중입니다.', 'info'); return;
    }
    var btn = $('msRunBtn');
    btn.disabled = true; btn.innerHTML = '<span class="an-loading"></span>요청 중...';
    try {
      var payload = buildPayload();
      var res = await api.commerce.generateModelshot(payload);
      var jobId = (res && (res.jobId || res.id)) || '';
      var initStatus = (res && res.status) || 'PENDING';
      var inlineUrl = (res && (res.imageUrl || res.url)) || '';

      var pkg = {
        id: 'r-' + Date.now(),
        timestamp: Date.now(),
        payload: payload,
        jobId: jobId,
        status: initStatus,
        imageUrl: inlineUrl,
        error: '',
      };
      state.lastResult = pkg;
      renderResult();
      addHistory({
        id: pkg.id, timestamp: pkg.timestamp,
        title: payload.description.slice(0, 60) + (jobId ? ' [' + jobId.slice(0, 8) + ']' : ''),
        package: JSON.parse(JSON.stringify(pkg)),
      });

      // inline 결과 즉시 반환된 경우엔 폴링 생략
      if (inlineUrl || pkg.status === 'SUCCESS') {
        finalizeJob({ status: 'SUCCESS', imageUrl: inlineUrl, resultUrl: inlineUrl });
      } else if (jobId && api.jobs && api.jobs.poll) {
        startPolling(jobId);
      } else if (jobId) {
        // poll 헬퍼 미가동: 사용자에게 명시
        toast('자동 폴링을 사용할 수 없습니다. 작업 ID로 결과를 확인해주세요.', 'info');
      } else {
        throw new Error('서버 응답에 jobId 또는 결과 URL이 없습니다.');
      }
      toast(jobId ? '작업이 시작되었습니다.' : '생성 완료.', 'success');
    } catch (err) {
      console.error('[ms] runGenerate', err);
      toast((err && err.message) || '생성 실패', 'error');
      state.activePoll = null;
    } finally {
      btn.disabled = false; btn.textContent = '모델컷 생성';
    }
  }

  function startPolling(jobId) {
    var aborted = false;
    state.activePoll = { jobId: jobId, abort: function () { aborted = true; } };
    api.jobs.poll('commerce', jobId, {
      intervalMs: 2500,
      timeoutMs: 180000,
      onUpdate: function (s) {
        if (aborted || !state.lastResult || state.lastResult.jobId !== jobId) return;
        state.lastResult.status = s.status || 'RUNNING';
        renderResult();
      }
    }).then(function (final) {
      if (aborted) return;
      // Race guard: 사용자가 폴링 중에 다른 이력을 로드했다면 lastResult.jobId가 바뀌어 있음.
      if (!state.lastResult || state.lastResult.jobId !== jobId) return;
      finalizeJob(final);  // 내부에서 activePoll = null 처리 (현재 jobId 일치 시)
    }).catch(function (err) {
      if (aborted) return;
      console.error('[ms] poll error', err);
      if (state.lastResult && state.lastResult.jobId === jobId) {
        state.lastResult.status = 'FAILED';
        state.lastResult.error = (err && err.message) || '작업 실패';
        renderResult();
        updateHistoryEntry(state.lastResult.id, function (h) {
          h.package.status = 'FAILED';
          h.package.error = state.lastResult.error;
        });
        toast(state.lastResult.error, 'error');
      } else {
        // 사용자가 다른 이력으로 이동한 뒤 실패 — UI 갱신 없이 콘솔에만 남김.
        console.warn('[ms] stale poll failed for job', jobId);
      }
    }).finally(function () {
      // activePoll 잠금 해제는 항상 수행 (success/fail/race 모두). 단, 다른 작업이 이미 시작된 상태는 보호.
      if (!aborted && state.activePoll && state.activePoll.jobId === jobId) {
        state.activePoll = null;
      }
    });
  }

  function finalizeJob(final) {
    if (!state.lastResult) return;
    var url = (final && (final.imageUrl || final.resultUrl || final.url)) || state.lastResult.imageUrl || '';
    state.lastResult.status = (final && final.status) || 'SUCCESS';
    state.lastResult.imageUrl = url;
    renderResult();
    updateHistoryEntry(state.lastResult.id, function (h) {
      h.package.status = state.lastResult.status;
      h.package.imageUrl = url;
    });
    // activePoll 해제는 .finally에서 일괄 처리. 인라인 즉시 완료(폴링 우회 경로)에서도 안전하게 해제.
    if (state.activePoll && state.lastResult && state.activePoll.jobId === state.lastResult.jobId) {
      state.activePoll = null;
    }
    toast('생성을 완료했습니다.', 'success');
  }

  // ---------- 렌더 ----------
  function renderResult() {
    var box = $('msResult');
    if (!state.lastResult) {
      box.innerHTML = '<p class="an-result-empty">왼쪽에 프롬프트를 입력하고 \"모델컷 생성\"을 누르면 여기에 결과가 표시됩니다.</p>';
      $('msExportBar').style.display = 'none';
      return;
    }
    var pkg = state.lastResult;
    var statusKey = String(pkg.status || 'PENDING').toUpperCase();
    var html = '';
    html += '<div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.5rem;">';
    html += '<span class="an-status-pill an-status-' + escapeHtml(statusKey) + '">' + escapeHtml(statusKey) + '</span>';
    if (pkg.jobId) html += '<span class="an-hint">작업 ID: <code>' + escapeHtml(pkg.jobId) + '</code></span>';
    if (statusKey === 'RUNNING' || statusKey === 'PENDING' || statusKey === 'QUEUED') {
      html += '<span class="an-loading" style="color:var(--mk-color-accent,#c96442);"></span>';
    }
    html += '</div>';

    if (pkg.error) {
      html += '<div class="an-warn">실패: ' + escapeHtml(pkg.error) + '</div>';
    }
    if (pkg.imageUrl) {
      var safeImg = safeUrl(pkg.imageUrl);
      if (safeImg) {
        html += '<div class="an-img-preview"><img src="' + escapeHtml(safeImg) + '" alt="모델컷 결과" loading="lazy"></div>';
        html += '<div class="an-action-row" style="margin-top:0.5rem;">' +
          '<a class="an-btn is-primary" href="' + escapeHtml(safeImg) + '" download="modelshot-' + pkg.id + '.png" target="_blank" rel="noopener noreferrer">이미지 다운로드</a>' +
          '</div>';
      } else {
        html += '<p class="an-warn" style="margin-top:0.5rem;">결과 이미지 URL 형식이 안전하지 않아 표시하지 않았습니다: <code>' + escapeHtml(pkg.imageUrl) + '</code></p>';
      }
    } else if (statusKey !== 'FAILED') {
      html += '<p class="an-hint">이미지 결과가 준비되면 여기에 표시됩니다.</p>';
    }

    html += '<details class="an-advanced" style="margin-top:0.75rem;"><summary>요청 페이로드</summary>' +
      '<pre class="an-codebox" style="margin-top:0.4rem;font-size:0.8125rem;">' + escapeHtml(JSON.stringify(pkg.payload, null, 2)) + '</pre></details>';

    box.innerHTML = html;
    $('msExportBar').style.display = 'flex';
  }

  // ---------- 이력 ----------
  function renderHistory() {
    var box = $('msHistory');
    if (!box) return;
    if (!state.history.length) {
      box.innerHTML = '<p class="an-history-empty">아직 생성 이력이 없습니다.</p>';
      return;
    }
    box.innerHTML = '<ul class="an-history-list">' + state.history.map(function (h) {
      var d = new Date(h.timestamp);
      var dateStr = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      var status = (h.package && h.package.status) ? '<span class="an-status-pill an-status-' + escapeHtml(h.package.status) + '" style="font-size:0.65rem;padding:0.1rem 0.45rem;margin-right:0.3rem;">' + escapeHtml(h.package.status) + '</span>' : '';
      return '<li class="an-history-item" data-id="' + escapeHtml(h.id) + '">' +
        '<span class="an-h-text" title="' + escapeHtml(h.title) + '">' + status + escapeHtml(h.title) + '</span>' +
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
    if (h.package.payload) {
      $('msPrompt').value = h.package.payload.description || '';
      if (h.package.payload.style != null) selectStyle(h.package.payload.style);
      if (h.package.payload.size != null) selectSize(h.package.payload.size);
    }
    toast('이전 작업을 불러왔습니다.', 'info');
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
    triggerDownload(new Blob([JSON.stringify(state.lastResult, null, 2)], { type: 'application/json;charset=utf-8' }), 'modelshot_' + state.lastResult.id + '.json');
  }

  // ---------- 와이어링 ----------
  function selectStyle(id) {
    state.style = id || '';
    document.querySelectorAll('.an-chip[data-style]').forEach(function (b) {
      b.classList.toggle('is-active', (b.dataset.style || '') === state.style);
    });
  }
  function selectSize(id) {
    state.size = id || '';
    document.querySelectorAll('.an-chip[data-size]').forEach(function (b) {
      b.classList.toggle('is-active', (b.dataset.size || '') === state.size);
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

    var styleBox = $('msStylePresets');
    styleBox.innerHTML = STYLES.map(function (s) {
      return '<button type="button" class="an-chip" data-style="' + escapeHtml(s.id) + '">' + escapeHtml(s.label) + '</button>';
    }).join('');
    styleBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.an-chip[data-style]'); if (!btn) return;
      selectStyle(btn.getAttribute('data-style'));
    });
    selectStyle(state.style);

    var sizeBox = $('msSizePresets');
    sizeBox.innerHTML = SIZES.map(function (s) {
      return '<button type="button" class="an-chip" data-size="' + escapeHtml(s.id) + '">' + escapeHtml(s.label) + '</button>';
    }).join('');
    sizeBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.an-chip[data-size]'); if (!btn) return;
      selectSize(btn.getAttribute('data-size'));
    });
    selectSize(state.size);

    $('msRunBtn').addEventListener('click', runGenerate);
    $('msExportJsonBtn').addEventListener('click', exportJson);

    $('msHistory').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); removeHistory(del.getAttribute('data-del')); return; }
      var item = e.target.closest('.an-history-item');
      if (item) loadFromHistory(item.getAttribute('data-id'));
    });
    $('msHistoryClearBtn').addEventListener('click', clearHistory);

    renderHistory();
    renderResult();

    window.addEventListener('beforeunload', function () {
      if (state.activePoll) state.activePoll.abort();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
