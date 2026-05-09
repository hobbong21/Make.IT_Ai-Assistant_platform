// MaKIT Settings Menu — 헤더 nav의 ⚙️ 설정 버튼 → 드롭다운(언어 / 테마)
// 의존: window.makitI18n (선택), window.makitTheme (선택, app-shell-extras.js)
// 비로그인 사용자도 사용 가능.
(function () {
  if (window.__makitSettingsMenuMounted) return;
  window.__makitSettingsMenuMounted = true;

  // login 페이지에서는 nav가 단순화되어 있을 수 있음 — 그래도 버튼이 있으면 동작.
  var THEME_KEY = 'makit_theme';
  var LANGUAGES = { ko: '한국어', en: 'English', ja: '日本語' };

  function getTheme() {
    if (window.makitTheme && window.makitTheme.get) return window.makitTheme.get();
    try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (_) { return 'auto'; }
  }
  function setTheme(t) {
    if (window.makitTheme && window.makitTheme.set) { window.makitTheme.set(t); return; }
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  function getLocale() {
    if (window.makitI18n && window.makitI18n.getLocale) return window.makitI18n.getLocale();
    try { return localStorage.getItem('makit_locale') || 'ko'; } catch (_) { return 'ko'; }
  }
  function setLocale(code) {
    if (window.makitI18n && window.makitI18n.setLocale) { window.makitI18n.setLocale(code); return; }
    try { localStorage.setItem('makit_locale', code); } catch (_) {}
    document.documentElement.lang = code;
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.className = 'nav-settings-panel';
    panel.id = 'navSettingsPanel';
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-hidden', 'true');
    panel.hidden = true;
    panel.innerHTML =
      '<div class="nav-settings-section">' +
      '  <div class="nav-settings-label">언어 설정</div>' +
      '  <div class="nav-settings-options" role="radiogroup" aria-label="언어 선택" data-group="lang"></div>' +
      '</div>' +
      '<div class="nav-settings-divider" role="separator"></div>' +
      '<div class="nav-settings-section">' +
      '  <div class="nav-settings-label">다크 모드</div>' +
      '  <div class="nav-settings-options" role="radiogroup" aria-label="테마 선택" data-group="theme"></div>' +
      '</div>';
    return panel;
  }

  function renderOptions(panel) {
    var langGroup = panel.querySelector('[data-group="lang"]');
    var themeGroup = panel.querySelector('[data-group="theme"]');
    var currentLang = getLocale();
    var currentTheme = getTheme();

    langGroup.innerHTML = Object.keys(LANGUAGES).map(function (code) {
      var active = code === currentLang ? ' is-active' : '';
      return '<button type="button" class="nav-settings-opt' + active + '" role="radio" ' +
        'aria-checked="' + (code === currentLang ? 'true' : 'false') + '" ' +
        'data-lang="' + code + '">' + LANGUAGES[code] + '</button>';
    }).join('');

    var themes = [
      { v: 'auto', label: '시스템' },
      { v: 'light', label: '라이트' },
      { v: 'dark', label: '다크' }
    ];
    themeGroup.innerHTML = themes.map(function (t) {
      var active = t.v === currentTheme ? ' is-active' : '';
      return '<button type="button" class="nav-settings-opt' + active + '" role="radio" ' +
        'aria-checked="' + (t.v === currentTheme ? 'true' : 'false') + '" ' +
        'data-theme="' + t.v + '">' + t.label + '</button>';
    }).join('');
  }

  function bind(btn, panel) {
    function open() {
      panel.hidden = false;
      panel.classList.add('nav-settings-panel--open');
      panel.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      renderOptions(panel);
    }
    function close() {
      panel.classList.remove('nav-settings-panel--open');
      panel.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.classList.contains('nav-settings-panel--open')) close(); else open();
    });
    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    panel.addEventListener('click', function (e) {
      var t = e.target.closest('.nav-settings-opt');
      if (!t) return;
      if (t.dataset.lang) {
        setLocale(t.dataset.lang);
        renderOptions(panel);
      } else if (t.dataset.theme) {
        setTheme(t.dataset.theme);
        renderOptions(panel);
      }
    });
  }

  function mount() {
    var btn = document.getElementById('navSettingsBtn');
    if (!btn) return;
    if (btn.__mkSettingsBound) return;
    btn.__mkSettingsBound = true;

    var panel = buildPanel();
    // 패널을 nav 컨테이너에 인접 배치 (절대위치 anchor 위해 wrapper)
    var wrap = document.createElement('div');
    wrap.className = 'nav-settings-wrap';
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
    wrap.appendChild(panel);

    bind(btn, panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
