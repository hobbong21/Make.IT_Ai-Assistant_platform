// Marketing Playbooks — list page.
// Fetches VERSIONS.md from GitHub raw, renders 41 skills with category filter,
// search, favorites (localStorage), session cache, and version-bump notice.

(function () {
  var GH_RAW = 'https://raw.githubusercontent.com/coreyhaines31/marketingskills/main';
  var CACHE_KEY = 'mp_versions_cache_v1';
  var CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  var FAV_KEY = 'mp_favorites_v1';
  var SEEN_VER_KEY = 'mp_seen_versions_v1';

  // Static category map (derived from README diagram). 41 skills total.
  var CATEGORIES = [
    { id: 'all', label: '전체', skills: null },
    { id: 'seo',     label: 'SEO & 콘텐츠', skills: ['seo-audit','ai-seo','site-architecture','programmatic-seo','schema-markup','content-strategy','aso-audit'] },
    { id: 'cro',     label: 'CRO',         skills: ['page-cro','signup-flow-cro','onboarding-cro','form-cro','popup-cro','paywall-upgrade-cro'] },
    { id: 'copy',    label: '카피 & 콘텐츠', skills: ['copywriting','copy-editing','cold-email','email-sequence','social-content','video','image'] },
    { id: 'paid',    label: '광고 & 측정',   skills: ['paid-ads','ad-creative','ab-test-setup','analytics-tracking'] },
    { id: 'growth',  label: '그로스 & 리텐션', skills: ['referral-program','free-tool-strategy','churn-prevention','community-marketing','lead-magnets','co-marketing'] },
    { id: 'sales',   label: '세일즈 & GTM',  skills: ['revops','sales-enablement','launch-strategy','pricing-strategy','competitor-alternatives','competitor-profiling','directory-submissions'] },
    { id: 'strategy',label: '전략',          skills: ['marketing-ideas','marketing-psychology','customer-research','product-marketing-context'] }
  ];

  var state = {
    skills: [],          // [{name, version, lastUpdated, category}]
    filter: 'all',
    search: '',
    favOnly: false,
    favorites: loadFavorites()
  };

  function loadFavorites() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveFavorites() {
    localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites));
  }
  function toggleFavorite(name) {
    var i = state.favorites.indexOf(name);
    if (i >= 0) state.favorites.splice(i, 1);
    else state.favorites.push(name);
    saveFavorites();
  }

  function categoryOf(name) {
    for (var i = 1; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].skills && CATEGORIES[i].skills.indexOf(name) >= 0) return CATEGORIES[i].id;
    }
    return null;
  }

  // Parse VERSIONS.md table rows: | name | version | date |
  function parseVersions(md) {
    var out = [];
    var lines = md.split(/\r?\n/);
    var inTable = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (/^\|\s*Skill\s*\|/.test(line)) { inTable = true; continue; }
      if (inTable) {
        if (!/^\|/.test(line)) { inTable = false; continue; }
        if (/^\|\s*-+/.test(line)) continue;
        var parts = line.split('|').map(function (s) { return s.trim(); }).filter(Boolean);
        if (parts.length >= 3) {
          var name = parts[0];
          if (/^[a-z0-9-]+$/.test(name)) {
            out.push({ name: name, version: parts[1], lastUpdated: parts[2], category: categoryOf(name) });
          }
        }
      }
    }
    return out;
  }

  async function fetchVersions() {
    // Session cache
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && (Date.now() - cached.t) < CACHE_TTL_MS) return cached.skills;
    } catch (e) {}

    var resp = await fetch(GH_RAW + '/VERSIONS.md', { cache: 'no-cache' });
    if (!resp.ok) throw new Error('VERSIONS.md fetch failed: ' + resp.status);
    var md = await resp.text();
    var skills = parseVersions(md);
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), skills: skills })); } catch (e) {}
    return skills;
  }

  function checkVersionUpdates(skills) {
    var seen = {};
    try { seen = JSON.parse(localStorage.getItem(SEEN_VER_KEY) || '{}'); } catch (e) {}
    var updated = [], majorBump = false;
    skills.forEach(function (s) {
      var prev = seen[s.name];
      if (!prev) { seen[s.name] = s.version; return; }
      if (prev !== s.version) {
        updated.push(s.name);
        var pm = parseInt(prev.split('.')[0], 10), cm = parseInt(s.version.split('.')[0], 10);
        if (cm > pm) majorBump = true;
      }
    });
    if (updated.length >= 2 || majorBump) {
      var banner = document.getElementById('updateBanner');
      var text = document.getElementById('updateBannerText');
      text.textContent = '플레이북 업데이트 알림: ' + updated.length + '개 스킬이 업데이트되었습니다' + (majorBump ? ' (메이저 버전 포함).' : '.');
      banner.style.display = 'flex';
      document.getElementById('updateBannerDismiss').onclick = function () {
        skills.forEach(function (s) { seen[s.name] = s.version; });
        localStorage.setItem(SEEN_VER_KEY, JSON.stringify(seen));
        banner.style.display = 'none';
      };
    } else {
      // Mark all current as seen on first ever visit
      skills.forEach(function (s) { if (!seen[s.name]) seen[s.name] = s.version; });
      localStorage.setItem(SEEN_VER_KEY, JSON.stringify(seen));
    }
  }

  function renderTabs() {
    var counts = {};
    state.skills.forEach(function (s) { counts[s.category] = (counts[s.category] || 0) + 1; });
    var html = CATEGORIES.map(function (c) {
      var n = c.id === 'all' ? state.skills.length : (counts[c.id] || 0);
      return '<button class="mp-cat-tab' + (state.filter === c.id ? ' active' : '') + '" data-cat="' + c.id + '">' +
             c.label + '<span class="mp-count">(' + n + ')</span></button>';
    }).join('');
    var tabs = document.getElementById('mpCatTabs');
    tabs.innerHTML = html;
    tabs.querySelectorAll('.mp-cat-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filter = btn.getAttribute('data-cat');
        renderTabs();
        renderList();
      });
    });
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  }); }

  function renderList() {
    var q = state.search.trim().toLowerCase();
    var list = state.skills.filter(function (s) {
      if (state.filter !== 'all' && s.category !== state.filter) return false;
      if (state.favOnly && state.favorites.indexOf(s.name) < 0) return false;
      if (q && s.name.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    var container = document.getElementById('mpList');
    if (!list.length) {
      container.innerHTML = '<div class="mp-empty">조건에 맞는 플레이북이 없습니다.</div>';
      return;
    }

    var grid = document.createElement('div');
    grid.className = 'mp-grid';
    grid.innerHTML = list.map(function (s) {
      var fav = state.favorites.indexOf(s.name) >= 0;
      var catLabel = (CATEGORIES.find(function (c) { return c.id === s.category; }) || {}).label || '기타';
      return '' +
        '<div class="mp-card" data-name="' + escapeHtml(s.name) + '">' +
          '<div class="mp-card-head">' +
            '<h3 class="mp-card-title">' + escapeHtml(s.name) + '</h3>' +
            '<button class="mp-fav' + (fav ? ' active' : '') + '" data-fav="' + escapeHtml(s.name) + '" aria-label="즐겨찾기">★</button>' +
          '</div>' +
          '<div class="mp-card-meta">' +
            '<span class="mp-badge">' + escapeHtml(catLabel) + '</span>' +
            '<span>v' + escapeHtml(s.version) + '</span>' +
            '<span>' + escapeHtml(s.lastUpdated) + '</span>' +
          '</div>' +
        '</div>';
    }).join('');

    container.innerHTML = '';
    container.appendChild(grid);

    grid.querySelectorAll('.mp-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.classList.contains('mp-fav')) return;
        var name = card.getAttribute('data-name');
        location.href = 'marketing-playbook.html?name=' + encodeURIComponent(name);
      });
    });
    grid.querySelectorAll('.mp-fav').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleFavorite(btn.getAttribute('data-fav'));
        btn.classList.toggle('active');
        if (state.favOnly) renderList();
      });
    });
  }

  async function init() {
    try {
      state.skills = await fetchVersions();
      checkVersionUpdates(state.skills);
      renderTabs();
      renderList();
    } catch (err) {
      document.getElementById('mpList').innerHTML =
        '<div class="mp-error">플레이북 목록을 불러올 수 없습니다: ' + escapeHtml(err.message) + '</div>';
    }
  }

  document.getElementById('mpSearch').addEventListener('input', function (e) {
    state.search = e.target.value; renderList();
  });
  document.getElementById('mpFavOnly').addEventListener('change', function (e) {
    state.favOnly = e.target.checked; renderList();
  });

  init();
})();
