// MaKIT - 이미지 배경 제거 (remove-bg)
// 파일 업로드 → marketing.removeBackground(file, format) → URL 반환
// 단일 파일, 드래그앤드롭, 포맷 칩(PNG/JPG/WEBP), 전/후 비교, 이력.

(function () {
  'use strict';

  var STORAGE_KEY = 'makit_rb_history_v1';
  var HISTORY_MAX = 10;
  var MAX_BYTES = 10 * 1024 * 1024;  // 10 MB
  var ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];

  var FORMATS = [
    { id: 'PNG',  label: 'PNG (투명 배경)' },
    { id: 'JPG',  label: 'JPG' },
    { id: 'WEBP', label: 'WEBP' },
  ];

  var state = {
    format: 'PNG',
    file: null,
    beforeUrl: '',  // object URL (revoke on change)
    lastResult: null,
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
    console.log('[rb] ' + msg);
  }
  function fmtBytes(n) {
    if (n == null || isNaN(n)) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ---------- 이력 ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn('[rb] history load failed, resetting:', err);
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
        console.warn('[rb] history quota exceeded, dropping oldest; remaining=' + (snapshot.length - 1), err);
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
    if (!confirm('최근 처리 이력을 모두 삭제할까요?')) return;
    state.history = [];
    saveHistory();
    renderHistory();
  }

  // ---------- 파일 ----------
  function setFile(file) {
    if (state.beforeUrl) {
      try { URL.revokeObjectURL(state.beforeUrl); } catch (_) { /* noop */ }
      state.beforeUrl = '';
    }
    state.file = null;
    state.lastResult = null;
    if (!file) { renderInputs(); renderResult(); return; }
    if (ACCEPT_TYPES.indexOf(file.type) < 0) {
      toast('지원하지 않는 파일 형식입니다 (PNG/JPG/WEBP/BMP).', 'error');
      renderInputs(); renderResult(); return;
    }
    if (file.size > MAX_BYTES) {
      toast('파일이 너무 큽니다 (최대 ' + fmtBytes(MAX_BYTES) + ').', 'error');
      renderInputs(); renderResult(); return;
    }
    state.file = file;
    state.beforeUrl = URL.createObjectURL(file);
    renderInputs();
    renderResult();
  }

  // ---------- 처리 ----------
  async function runRemove() {
    if (!state.file) { toast('파일을 먼저 선택해주세요.', 'error'); return; }
    var btn = $('rbRunBtn');
    btn.disabled = true; btn.innerHTML = '<span class="an-loading"></span>처리 중...';
    try {
      var res = await api.marketing.removeBackground(state.file, state.format);
      var resultUrl = (res && (res.downloadUrl || res.resultUrl || res.url)) || '';
      var jobId = (res && res.jobId) || '';
      if (!resultUrl && !jobId) throw new Error('서버 응답에 결과 URL이 없습니다.');
      var pkg = {
        id: 'r-' + Date.now(),
        timestamp: Date.now(),
        filename: state.file.name,
        size: state.file.size,
        format: state.format,
        beforeUrl: state.beforeUrl,  // 세션 한정 (object URL)
        resultUrl: resultUrl,
        jobId: jobId,
      };
      state.lastResult = pkg;
      renderResult();
      // 이력엔 영구 보존 가능한 정보만 저장 (object URL은 새로고침 시 무효 → 제외)
      addHistory({
        id: pkg.id, timestamp: pkg.timestamp,
        title: pkg.filename + ' → ' + pkg.format,
        package: {
          id: pkg.id, timestamp: pkg.timestamp,
          filename: pkg.filename, size: pkg.size, format: pkg.format,
          resultUrl: pkg.resultUrl, jobId: pkg.jobId,
        },
      });
      toast('배경 제거를 완료했습니다.', 'success');
    } catch (err) {
      console.error('[rb] runRemove', err);
      toast((err && err.message) || '처리 실패', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '배경 제거';
    }
  }

  // ---------- 렌더 ----------
  function renderInputs() {
    var info = $('rbFileInfo');
    if (state.file) {
      info.innerHTML = '<strong>' + escapeHtml(state.file.name) + '</strong> · ' + fmtBytes(state.file.size) +
        ' · <button type="button" class="an-btn" id="rbClearFileBtn" style="padding:0.2rem 0.55rem;font-size:0.7rem;">제거</button>';
      var clearBtn = $('rbClearFileBtn');
      if (clearBtn) clearBtn.addEventListener('click', function () { setFile(null); $('rbFileInput').value = ''; });
    } else {
      info.innerHTML = '<span class="an-hint">파일이 선택되지 않았습니다.</span>';
    }
  }
  function renderResult() {
    var box = $('rbResult');
    if (!state.lastResult && !state.beforeUrl) {
      box.innerHTML = '<p class="an-result-empty">파일을 업로드하고 \"배경 제거\"를 누르면 여기에 결과가 표시됩니다.</p>';
      $('rbExportBar').style.display = 'none';
      return;
    }
    var safeBefore = safeUrl(state.beforeUrl);
    var safeResult = state.lastResult && state.lastResult.resultUrl ? safeUrl(state.lastResult.resultUrl) : '';
    var html = '<div class="an-img-grid">';
    html += '<div class="an-img-col"><h5>원본</h5><div class="an-img-preview">' +
      (safeBefore ? '<img src="' + escapeHtml(safeBefore) + '" alt="원본">' : '<span class="an-hint">없음</span>') +
      '</div></div>';
    html += '<div class="an-img-col"><h5>결과</h5><div class="an-img-preview">' +
      (safeResult
        ? '<img src="' + escapeHtml(safeResult) + '" alt="배경 제거 결과">'
        : '<span class="an-hint">' + (state.lastResult && state.lastResult.jobId
            ? '작업 ID: ' + escapeHtml(state.lastResult.jobId) + ' (처리 중)'
            : (state.lastResult && state.lastResult.resultUrl
                ? '안전하지 않은 결과 URL'
                : '결과 없음')) + '</span>') +
      '</div></div>';
    html += '</div>';
    if (safeResult) {
      var dlName = (state.lastResult.filename || 'result').replace(/\.[^.]+$/, '') + '.' + state.lastResult.format.toLowerCase();
      html += '<div class="an-action-row" style="margin-top:0.25rem;">' +
        '<a class="an-btn is-primary" href="' + escapeHtml(safeResult) + '" download="' + escapeHtml(dlName) + '" target="_blank" rel="noopener noreferrer">결과 다운로드</a>' +
        '</div>';
    } else if (state.lastResult && state.lastResult.resultUrl) {
      html += '<p class="an-warn" style="margin-top:0.5rem;">결과 URL 형식이 안전하지 않아 표시하지 않았습니다: <code>' + escapeHtml(state.lastResult.resultUrl) + '</code></p>';
    }
    box.innerHTML = html;
    $('rbExportBar').style.display = state.lastResult ? 'flex' : 'none';
  }

  // ---------- 이력 ----------
  function renderHistory() {
    var box = $('rbHistory');
    if (!box) return;
    if (!state.history.length) {
      box.innerHTML = '<p class="an-history-empty">아직 처리 이력이 없습니다.</p>';
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
    if (!h || !h.package || !h.package.resultUrl) {
      toast('이 이력에는 다시 표시할 결과 URL이 없습니다.', 'info');
      return;
    }
    if (state.beforeUrl) { try { URL.revokeObjectURL(state.beforeUrl); } catch (_) {} }
    state.beforeUrl = '';
    state.file = null;
    state.lastResult = h.package;
    renderInputs();
    renderResult();
    toast('이전 결과 URL을 불러왔습니다 (원본 미리보기 없음).', 'info');
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
    var copy = JSON.parse(JSON.stringify(state.lastResult));
    delete copy.beforeUrl;  // object URL은 외부에서 무의미
    triggerDownload(new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json;charset=utf-8' }), 'remove-bg_' + copy.id + '.json');
  }

  // ---------- 와이어링 ----------
  function selectFormat(id) {
    state.format = id;
    document.querySelectorAll('.an-chip[data-format]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.format === id);
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

    var fmtBox = $('rbFormatPresets');
    fmtBox.innerHTML = FORMATS.map(function (f) {
      return '<button type="button" class="an-chip" data-format="' + f.id + '">' + escapeHtml(f.label) + '</button>';
    }).join('');
    fmtBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.an-chip[data-format]'); if (!btn) return;
      selectFormat(btn.dataset.format);
    });
    selectFormat(state.format);

    var dz = $('rbDropzone');
    var input = $('rbFileInput');
    dz.addEventListener('click', function () { input.click(); });
    dz.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('is-drag'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('is-drag'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.classList.remove('is-drag');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) setFile(f);
    });
    input.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) setFile(f);
    });

    $('rbRunBtn').addEventListener('click', runRemove);
    $('rbExportJsonBtn').addEventListener('click', exportJson);

    $('rbHistory').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); removeHistory(del.getAttribute('data-del')); return; }
      var item = e.target.closest('.an-history-item');
      if (item) loadFromHistory(item.getAttribute('data-id'));
    });
    $('rbHistoryClearBtn').addEventListener('click', clearHistory);

    renderInputs();
    renderHistory();
    renderResult();

    window.addEventListener('beforeunload', function () {
      if (state.beforeUrl) { try { URL.revokeObjectURL(state.beforeUrl); } catch (_) {} }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
