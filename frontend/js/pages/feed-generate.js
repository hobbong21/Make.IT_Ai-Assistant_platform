// MaKIT - 인스타그램 피드 생성 (feed-generate)
// brief → 캡션 + 해시태그 (+ 옵션 이미지). marketing.generateFeed(payload)
// 단일 폼, 옵션(톤/길이/해시태그 수/이미지 포함), 이력 + JSON/MD export.

(function () {
  'use strict';

  var STORAGE_KEY = 'makit_fg_history_v1';
  var HISTORY_MAX = 10;
  var HISTORY_BRIEF_CAP = 1500;
  var HISTORY_CAPTION_CAP = 3000;

  var TONES = [
    { id: '',      label: '기본' },
    { id: 'friendly',   label: '친근' },
    { id: 'professional', label: '전문' },
    { id: 'playful',    label: '유머' },
    { id: 'inspirational', label: '감성' },
  ];
  var LENGTHS = [
    { id: '',       label: '기본' },
    { id: 'short',  label: '짧게' },
    { id: 'medium', label: '보통' },
    { id: 'long',   label: '길게' },
  ];

  var state = {
    tone: '',
    length: '',
    lastResult: null,
    history: loadHistory(),
  };

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // href/src 전용 안전 sanitizer — http(s)/blob/data:image 만 허용. 그 외(javascript: 등)는 빈 문자열.
  function safeUrl(u) {
    var s = String(u == null ? '' : u).trim();
    if (!s) return '';
    if (/^(https?:|blob:)/i.test(s)) return s;
    if (/^data:image\//i.test(s)) return s;
    if (s.charAt(0) === '/') return s;  // 상대 경로
    return '';
  }
  function toast(msg, type) {
    if (window.ui && ui.toast) { ui.toast(msg, type || 'info'); return; }
    console.log('[fg] ' + msg);
  }

  // ---------- 이력 ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn('[fg] history load failed, resetting:', err);
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
        console.warn('[fg] history quota exceeded, dropping oldest; remaining=' + (snapshot.length - 1), err);
        snapshot.pop();
      }
    }
    toast('이력 저장 실패(브라우저 저장 공간 부족).', 'error');
    return false;
  }
  function trimEntryForStorage(entry) {
    if (!entry || !entry.package) return entry;
    var p = entry.package;
    if (p.payload && typeof p.payload.brief === 'string' && p.payload.brief.length > HISTORY_BRIEF_CAP) {
      p.payload.brief = p.payload.brief.slice(0, HISTORY_BRIEF_CAP) + '…';
    }
    if (typeof p.caption === 'string' && p.caption.length > HISTORY_CAPTION_CAP) {
      p.caption = p.caption.slice(0, HISTORY_CAPTION_CAP) + '…';
    }
    // imageUrl 보존(http인 경우만 의미 있음). data:URL은 떨굼.
    if (p.imageUrl && /^data:/i.test(p.imageUrl)) delete p.imageUrl;
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
    if (!confirm('최근 생성 이력을 모두 삭제할까요?')) return;
    state.history = [];
    saveHistory();
    renderHistory();
  }

  // ---------- 생성 ----------
  function buildPayload() {
    var brief = ($('fgBrief').value || '').trim();
    if (!brief) throw new Error('브리프(설명)를 입력해주세요.');
    var includeImage = !!$('fgIncludeImage').checked;
    var hashtagCountRaw = parseInt($('fgHashtagCount').value, 10);
    var payload = { brief: brief, includeImage: includeImage };
    if (state.tone) payload.tone = state.tone;
    if (state.length) payload.length = state.length;
    if (!isNaN(hashtagCountRaw) && hashtagCountRaw >= 1 && hashtagCountRaw <= 30) {
      payload.hashtagCount = hashtagCountRaw;
    }
    return payload;
  }

  async function runGenerate() {
    var btn = $('fgRunBtn');
    btn.disabled = true; btn.innerHTML = '<span class="an-loading"></span>생성 중...';
    try {
      var payload = buildPayload();
      var res = await api.marketing.generateFeed(payload);
      var pkg = {
        id: 'r-' + Date.now(),
        timestamp: Date.now(),
        payload: payload,
        caption: (res && res.caption) || '',
        hashtags: Array.isArray(res && res.hashtags) ? res.hashtags.map(function (h) { return String(h); }) : [],
        imageUrl: (res && (res.imageUrl || res.image_url || res.url)) || '',
      };
      state.lastResult = pkg;
      renderResult();
      addHistory({
        id: pkg.id, timestamp: pkg.timestamp,
        title: payload.brief.slice(0, 60),
        package: JSON.parse(JSON.stringify(pkg)),
      });
      toast('피드를 생성했습니다.', 'success');
    } catch (err) {
      console.error('[fg] runGenerate', err);
      toast((err && err.message) || '생성 실패', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '피드 생성';
    }
  }

  // ---------- 렌더 ----------
  function normalizeHashtag(h) {
    var s = String(h || '').trim();
    if (!s) return '';
    return s.charAt(0) === '#' ? s : '#' + s;
  }
  function renderResult() {
    var box = $('fgResult');
    if (!state.lastResult) {
      box.innerHTML = '<p class="an-result-empty">왼쪽에 브리프를 입력하고 \"피드 생성\"을 누르면 여기에 결과가 표시됩니다.</p>';
      $('fgExportBar').style.display = 'none';
      return;
    }
    var pkg = state.lastResult;
    var html = '';
    html += '<h3 style="font-size:0.875rem;font-weight:700;margin:0 0 0.25rem;">캡션</h3>';
    html += '<div class="an-codebox" id="fgCaptionBox">' +
      '<button type="button" class="an-codebox-copy" data-copy-target="caption">복사</button>' +
      escapeHtml(pkg.caption || '(생성된 캡션 없음)') + '</div>';

    if (pkg.hashtags.length) {
      var tagsText = pkg.hashtags.map(normalizeHashtag).filter(Boolean).join(' ');
      html += '<h3 style="font-size:0.875rem;font-weight:700;margin:0.75rem 0 0.25rem;display:flex;align-items:center;justify-content:space-between;">' +
        '<span>해시태그 (' + pkg.hashtags.length + ')</span>' +
        '<button type="button" class="an-btn" style="padding:0.2rem 0.55rem;font-size:0.7rem;" data-copy-target="hashtags" data-copy-value="' + escapeHtml(tagsText) + '">전체 복사</button>' +
        '</h3>';
      html += '<div class="an-tag-row">' +
        pkg.hashtags.map(function (h) { return '<span class="an-tag">' + escapeHtml(normalizeHashtag(h)) + '</span>'; }).join('') +
        '</div>';
    }

    if (pkg.imageUrl) {
      var safeImg = safeUrl(pkg.imageUrl);
      if (safeImg) {
        html += '<h3 style="font-size:0.875rem;font-weight:700;margin:0.75rem 0 0.25rem;">이미지</h3>';
        html += '<div class="an-img-preview"><img src="' + escapeHtml(safeImg) + '" alt="피드 이미지" loading="lazy"></div>';
        html += '<div class="an-action-row" style="margin-top:0.5rem;">' +
          '<a class="an-btn" href="' + escapeHtml(safeImg) + '" download="feed-' + pkg.id + '.png" target="_blank" rel="noopener noreferrer">이미지 다운로드</a>' +
          '</div>';
      } else {
        html += '<p class="an-warn" style="margin-top:0.5rem;">이미지 URL 형식이 안전하지 않아 표시하지 않았습니다: <code>' + escapeHtml(pkg.imageUrl) + '</code></p>';
      }
    }
    box.innerHTML = html;
    $('fgExportBar').style.display = 'flex';
  }

  function copyToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('복사했습니다.', 'success');
      }).catch(function (err) {
        console.warn('[fg] clipboard failed', err);
        toast('복사 실패: 브라우저 권한을 확인해주세요.', 'error');
      });
    } else {
      toast('이 브라우저는 자동 복사를 지원하지 않습니다.', 'error');
    }
  }

  // ---------- 이력 ----------
  function renderHistory() {
    var box = $('fgHistory');
    if (!box) return;
    if (!state.history.length) {
      box.innerHTML = '<p class="an-history-empty">아직 생성 이력이 없습니다.</p>';
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
    if (h.package.payload) {
      $('fgBrief').value = h.package.payload.brief || '';
      $('fgIncludeImage').checked = !!h.package.payload.includeImage;
      if (h.package.payload.hashtagCount) $('fgHashtagCount').value = h.package.payload.hashtagCount;
      if (h.package.payload.tone != null) selectTone(h.package.payload.tone);
      if (h.package.payload.length != null) selectLength(h.package.payload.length);
    }
    toast('이전 결과를 불러왔습니다.', 'info');
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
    triggerDownload(blob, 'feed-generate_' + state.lastResult.id + '.json');
  }
  function exportMarkdown() {
    if (!state.lastResult) return;
    var pkg = state.lastResult;
    var lines = ['# 인스타그램 피드 생성 결과', '',
      '- 톤: ' + (pkg.payload.tone || '기본'),
      '- 길이: ' + (pkg.payload.length || '기본'),
      '- 이미지 포함: ' + (pkg.payload.includeImage ? '예' : '아니오'),
      '- 일시: ' + new Date(pkg.timestamp).toLocaleString(), '',
      '## 브리프', '', pkg.payload.brief || '', '',
      '## 캡션', '', pkg.caption || '(없음)', ''];
    if (pkg.hashtags.length) {
      lines.push('## 해시태그', '');
      lines.push(pkg.hashtags.map(normalizeHashtag).filter(Boolean).join(' '));
      lines.push('');
    }
    if (pkg.imageUrl) {
      lines.push('## 이미지', '');
      lines.push('![생성 이미지](' + pkg.imageUrl + ')');
    }
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), 'feed-generate_' + pkg.id + '.md');
  }

  // ---------- 와이어링 ----------
  function selectTone(id) {
    state.tone = id || '';
    document.querySelectorAll('.an-chip[data-tone]').forEach(function (b) {
      b.classList.toggle('is-active', (b.dataset.tone || '') === state.tone);
    });
  }
  function selectLength(id) {
    state.length = id || '';
    document.querySelectorAll('.an-chip[data-length]').forEach(function (b) {
      b.classList.toggle('is-active', (b.dataset.length || '') === state.length);
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

    var toneBox = $('fgTonePresets');
    toneBox.innerHTML = TONES.map(function (t) {
      return '<button type="button" class="an-chip" data-tone="' + escapeHtml(t.id) + '">' + escapeHtml(t.label) + '</button>';
    }).join('');
    toneBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.an-chip[data-tone]'); if (!btn) return;
      selectTone(btn.getAttribute('data-tone'));
    });
    selectTone(state.tone);

    var lenBox = $('fgLengthPresets');
    lenBox.innerHTML = LENGTHS.map(function (l) {
      return '<button type="button" class="an-chip" data-length="' + escapeHtml(l.id) + '">' + escapeHtml(l.label) + '</button>';
    }).join('');
    lenBox.addEventListener('click', function (e) {
      var btn = e.target.closest('.an-chip[data-length]'); if (!btn) return;
      selectLength(btn.getAttribute('data-length'));
    });
    selectLength(state.length);

    $('fgRunBtn').addEventListener('click', runGenerate);
    $('fgExportJsonBtn').addEventListener('click', exportJson);
    $('fgExportMdBtn').addEventListener('click', exportMarkdown);

    $('fgResult').addEventListener('click', function (e) {
      var trg = e.target.closest('[data-copy-target]'); if (!trg) return;
      var key = trg.getAttribute('data-copy-target');
      var val = trg.getAttribute('data-copy-value');
      if (val == null && state.lastResult) {
        if (key === 'caption') val = state.lastResult.caption || '';
        else if (key === 'hashtags') val = state.lastResult.hashtags.map(normalizeHashtag).filter(Boolean).join(' ');
      }
      copyToClipboard(val || '');
    });

    $('fgHistory').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); removeHistory(del.getAttribute('data-del')); return; }
      var item = e.target.closest('.an-history-item');
      if (item) loadFromHistory(item.getAttribute('data-id'));
    });
    $('fgHistoryClearBtn').addEventListener('click', clearHistory);

    renderHistory();
    renderResult();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
