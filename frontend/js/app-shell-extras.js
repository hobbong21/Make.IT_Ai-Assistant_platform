// MaKIT App Shell Extras — 알림 종 + Cmd+K 검색 palette + 다크모드 토글
// 자동 마운트 (login 페이지 제외).
(function () {
  if (window.__makitShellExtrasMounted) return;
  window.__makitShellExtrasMounted = true;
  if (/login\.html$/i.test(location.pathname)) return;
  if (!window.auth || !auth.isLoggedIn()) return;

  // ============ 다크모드 토글 ============
  function getTheme() {
    return localStorage.getItem('makit_theme') || 'auto';
  }
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  function setTheme(t) {
    localStorage.setItem('makit_theme', t);
    applyTheme(t);
  }
  // 초기 적용
  applyTheme(getTheme());
  window.makitTheme = { get: getTheme, set: setTheme };

  // ============ 알림 종 ============
  function buildBell() {
    var wrap = document.createElement('div');
    wrap.id = 'mk-notif-bell';
    wrap.className = 'mk-notif-bell';
    wrap.innerHTML =
      '<button type="button" class="mk-notif-trigger" id="mkNotifTrigger" aria-label="알림 열기">' +
      '  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>' +
      '    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>' +
      '  </svg>' +
      '  <span class="mk-notif-badge" id="mkNotifBadge" hidden>0</span>' +
      '</button>' +
      '<div class="mk-notif-panel" role="dialog" aria-label="알림" aria-hidden="true">' +
      '  <header class="mk-notif-header">' +
      '    <strong>알림</strong>' +
      '    <button type="button" class="mk-link-btn" id="mkNotifReadAll">모두 읽음</button>' +
      '  </header>' +
      '  <div class="mk-notif-list" id="mkNotifList">' +
      '    <p class="mk-notif-empty">불러오는 중...</p>' +
      '  </div>' +
      '</div>';
    return wrap;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function relTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var diff = (Date.now() - d) / 1000;
      if (diff < 60) return '방금';
      if (diff < 3600) return Math.floor(diff / 60) + '분 전';
      if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
      return Math.floor(diff / 86400) + '일 전';
    } catch (_) { return ''; }
  }

  function renderNotifList(items) {
    var list = document.getElementById('mkNotifList');
    if (!list) return;
    if (!items || !items.length) {
      list.innerHTML = '<p class="mk-notif-empty">새 알림이 없습니다.</p>';
      return;
    }
    list.innerHTML = items.map(function (n) {
      return '<a href="' + escapeHtml(n.linkUrl || '#') + '" class="mk-notif-item ' +
        (n.readAt ? '' : 'mk-notif-item--unread') + '" data-id="' + n.id + '">' +
        '<span class="mk-notif-type mk-notif-type-' + escapeHtml(n.type || 'INFO') + '"></span>' +
        '<div class="mk-notif-body">' +
        '  <strong>' + escapeHtml(n.title || '') + '</strong>' +
        (n.message ? '<small>' + escapeHtml(n.message) + '</small>' : '') +
        '  <time>' + escapeHtml(relTime(n.createdAt)) + '</time>' +
        '</div>' +
        '</a>';
    }).join('');
  }

  function loadNotifications() {
    if (!api.notifications) return;
    api.notifications.unreadCount().then(function (r) {
      var badge = document.getElementById('mkNotifBadge');
      if (!badge) return;
      var n = (r && r.count) || 0;
      badge.textContent = n > 99 ? '99+' : n;
      badge.hidden = n === 0;
    }).catch(function () {});
    api.notifications.list({ page: 0, size: 10 }).then(function (page) {
      renderNotifList(page.content || []);
    }).catch(function () {
      var list = document.getElementById('mkNotifList');
      if (list) list.innerHTML = '<p class="mk-notif-empty">불러오기 실패</p>';
    });
  }

  function bindBell(root) {
    var trigger = root.querySelector('#mkNotifTrigger');
    var panel = root.querySelector('.mk-notif-panel');
    var readAll = root.querySelector('#mkNotifReadAll');
    function open() {
      panel.classList.add('mk-notif-panel--open');
      panel.setAttribute('aria-hidden', 'false');
      loadNotifications();
    }
    function close() {
      panel.classList.remove('mk-notif-panel--open');
      panel.setAttribute('aria-hidden', 'true');
    }
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.contains('mk-notif-panel--open') ? close() : open();
    });
    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) close();
    });
    readAll.addEventListener('click', function () {
      api.notifications.readAll().then(function () { loadNotifications(); }).catch(function () {});
    });
  }

  // ============ Cmd+K 검색 palette ============
  var SERVICES = [
    { key: 'nlp-analyze', name: '자연어 분석', cat: 'AX Data' },
    { key: 'youtube-comments', name: '유튜브 댓글 분석', cat: 'AX Data' },
    { key: 'youtube-influence', name: '유튜브 영향력 분석', cat: 'AX Data' },
    { key: 'url-analyze', name: 'URL 분석', cat: 'AX Data' },
    { key: 'youtube-keyword-search', name: '유튜브 키워드 채널검색', cat: 'AX Data' },
    { key: 'feed-generate', name: '인스타그램 피드 생성', cat: 'AX Marketing' },
    { key: 'remove-bg', name: '배경 제거', cat: 'AX Marketing' },
    { key: 'modelshot', name: '모델컷 생성', cat: 'AX Marketing' },
    { key: 'chatbot', name: '고객 응대 AI 챗봇', cat: 'AX Commerce' },
    { key: 'review-analysis', name: '상품 리뷰 분석', cat: 'AX Commerce' }
  ];
  var PAGES = [
    { url: 'index.html', name: '대시보드', icon: '🏠' },
    { url: 'marketing-hub.html', name: '마케팅 허브', icon: '🎯' },
    { url: 'all-services.html', name: '모든 서비스', icon: '📦' },
    { url: 'history.html', name: '활동 이력', icon: '🕐' },
    { url: 'settings.html', name: '설정', icon: '⚙️' },
    { url: 'intro.html', name: '제품 소개', icon: '📘' }
  ];

  function buildPalette() {
    var wrap = document.createElement('div');
    wrap.id = 'mk-cmdk';
    wrap.className = 'mk-cmdk';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="mk-cmdk-backdrop"></div>' +
      '<div class="mk-cmdk-modal" role="dialog" aria-label="빠른 검색">' +
      '  <input class="mk-cmdk-input" id="mkCmdkInput" type="text" placeholder="서비스 또는 페이지 검색…" autocomplete="off" spellcheck="false">' +
      '  <ul class="mk-cmdk-list" id="mkCmdkList" role="listbox"></ul>' +
      '  <footer class="mk-cmdk-footer">' +
      '    <kbd>↑↓</kbd> 이동 · <kbd>Enter</kbd> 선택 · <kbd>Esc</kbd> 닫기' +
      '  </footer>' +
      '</div>';
    return wrap;
  }

  function paletteRender(query) {
    var q = (query || '').toLowerCase().trim();
    var items = [];
    SERVICES.forEach(function (s) {
      if (!q || s.name.toLowerCase().indexOf(q) !== -1 || s.key.indexOf(q) !== -1 || s.cat.toLowerCase().indexOf(q) !== -1) {
        items.push({ kind: 'service', label: s.name, hint: s.cat, url: 'service-detail.html?service=' + s.key });
      }
    });
    PAGES.forEach(function (p) {
      if (!q || p.name.toLowerCase().indexOf(q) !== -1) {
        items.push({ kind: 'page', label: (p.icon ? p.icon + ' ' : '') + p.name, hint: p.url, url: p.url });
      }
    });
    var list = document.getElementById('mkCmdkList');
    if (!list) return [];
    list.innerHTML = items.length ? items.map(function (it, i) {
      return '<li class="mk-cmdk-item' + (i === 0 ? ' mk-cmdk-item--active' : '') + '" data-url="' + escapeHtml(it.url) + '" role="option">' +
        '<span class="mk-cmdk-label">' + escapeHtml(it.label) + '</span>' +
        '<span class="mk-cmdk-hint">' + escapeHtml(it.hint || '') + '</span>' +
        '</li>';
    }).join('') : '<li class="mk-cmdk-empty">결과가 없습니다.</li>';
    return items;
  }

  function bindPalette(root) {
    var modal = root;
    var input = root.querySelector('#mkCmdkInput');
    var list = root.querySelector('#mkCmdkList');
    var activeIdx = 0;
    var current = [];

    function open() {
      modal.classList.add('mk-cmdk--open');
      modal.setAttribute('aria-hidden', 'false');
      input.value = '';
      current = paletteRender('');
      activeIdx = 0;
      setTimeout(function () { input.focus(); }, 50);
    }
    function close() {
      modal.classList.remove('mk-cmdk--open');
      modal.setAttribute('aria-hidden', 'true');
    }
    function jump() {
      var items = list.querySelectorAll('.mk-cmdk-item');
      var sel = items[activeIdx];
      if (sel && sel.dataset.url) location.href = sel.dataset.url;
    }
    function updateActive() {
      var items = list.querySelectorAll('.mk-cmdk-item');
      items.forEach(function (el, i) { el.classList.toggle('mk-cmdk-item--active', i === activeIdx); });
      var active = items[activeIdx];
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('input', function () {
      current = paletteRender(input.value);
      activeIdx = 0;
    });
    input.addEventListener('keydown', function (e) {
      var items = list.querySelectorAll('.mk-cmdk-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(items.length - 1, activeIdx + 1); updateActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); updateActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); jump(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('.mk-cmdk-item');
      if (li && li.dataset.url) location.href = li.dataset.url;
    });
    root.querySelector('.mk-cmdk-backdrop').addEventListener('click', close);

    // 글로벌 단축키 — Cmd+K / Ctrl+K / "/"
    document.addEventListener('keydown', function (e) {
      var isMod = e.metaKey || e.ctrlKey;
      if ((isMod && e.key.toLowerCase() === 'k') || (e.key === '/' && !/INPUT|TEXTAREA/i.test((e.target.tagName || '')))) {
        e.preventDefault();
        open();
      }
    });
    window.makitCmdk = { open: open, close: close };
  }

  // ============ 언어 선택기 (i18n) ============
  function buildLanguagePicker() {
    // i18n API가 준비될 때까지 대기
    if (!window.makitI18n) {
      console.warn('makitI18n not available yet, retrying...');
      return null;
    }

    var wrap = document.createElement('div');
    wrap.id = 'mk-lang-picker';
    wrap.className = 'mk-lang-picker';
    var currentLang = window.makitI18n.getLocale();
    var langNames = window.makitI18n.languages;

    var html = '<button type="button" class="mk-lang-toggle" aria-label="언어 선택">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10"></circle>' +
      '<path d="M2 12h20"></path>' +
      '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>' +
      '</svg>' +
      '<span class="mk-lang-label">' + (langNames[currentLang] || 'Language') + '</span>' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="m6 9 6 6 6-6"></path>' +
      '</svg>' +
      '</button>' +
      '<div class="mk-lang-dropdown" role="listbox" aria-hidden="true">';

    Object.keys(langNames).forEach(function (code) {
      var isActive = code === currentLang ? ' aria-selected="true" data-active' : '';
      html += '<button type="button" class="mk-lang-option" data-code="' + code + '"' + isActive + ' role="option">' +
        langNames[code] +
        '</button>';
    });

    html += '</div>';
    wrap.innerHTML = html;
    return wrap;
  }

  function bindLanguagePicker(element) {
    if (!window.makitI18n) return;

    var toggle = element.querySelector('.mk-lang-toggle');
    var dropdown = element.querySelector('.mk-lang-dropdown');
    var options = element.querySelectorAll('.mk-lang-option');

    function openDropdown() {
      dropdown.classList.add('mk-lang-dropdown--open');
      dropdown.setAttribute('aria-hidden', 'false');
    }

    function closeDropdown() {
      dropdown.classList.remove('mk-lang-dropdown--open');
      dropdown.setAttribute('aria-hidden', 'true');
    }

    toggle.addEventListener('click', function () {
      if (dropdown.classList.contains('mk-lang-dropdown--open')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    options.forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.preventDefault();
        var code = opt.getAttribute('data-code');
        if (code) {
          window.makitI18n.setLocale(code);
          // UI 업데이트
          options.forEach(function (o) {
            o.removeAttribute('data-active');
            o.removeAttribute('aria-selected');
          });
          opt.setAttribute('data-active', '');
          opt.setAttribute('aria-selected', 'true');
          toggle.querySelector('.mk-lang-label').textContent = window.makitI18n.languages[code];
          closeDropdown();
        }
      });
    });

    // ESC 닫기
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDropdown();
    });

    // 외부 클릭 닫기
    document.addEventListener('click', function (e) {
      if (!element.contains(e.target)) closeDropdown();
    });
  }

  // ============ 마운트 ============
  function mount() {
    var bell = buildBell();
    document.body.appendChild(bell);
    bindBell(bell);
    var palette = buildPalette();
    document.body.appendChild(palette);
    bindPalette(palette);

    // 언어 선택기 (i18n 준비 후 마운트)
    setTimeout(function () {
      var langPicker = buildLanguagePicker();
      if (langPicker) {
        document.body.appendChild(langPicker);
        bindLanguagePicker(langPicker);
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
