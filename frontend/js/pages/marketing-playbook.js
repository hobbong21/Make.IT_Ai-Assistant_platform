// Marketing Playbook — detail page.
// Fetches a single SKILL.md from GitHub raw, renders Markdown via marked.
// Strips YAML frontmatter and surfaces description/license metadata.

(function () {
  var GH_RAW = 'https://raw.githubusercontent.com/coreyhaines31/marketingskills/main';
  var GH_REPO = 'https://github.com/coreyhaines31/marketingskills/blob/main';
  var CACHE_PREFIX = 'mp_skill_v1_';
  var CACHE_TTL_MS = 30 * 60 * 1000;

  var FAV_KEY = 'mp_favorites_v1';

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  }); }

  function getName() {
    var p = new URLSearchParams(location.search);
    var n = (p.get('name') || '').trim();
    if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(n)) return null;
    return n;
  }

  function parseFrontmatter(md) {
    var meta = {}, body = md;
    var m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (m) {
      var fm = m[1];
      body = m[2];
      fm.split(/\r?\n/).forEach(function (line) {
        var kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
        if (kv) {
          var v = kv[2].trim();
          if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
          meta[kv[1]] = v;
        }
      });
    }
    return { meta: meta, body: body };
  }

  async function fetchSkill(name) {
    var key = CACHE_PREFIX + name;
    try {
      var cached = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (cached && (Date.now() - cached.t) < CACHE_TTL_MS) return cached.md;
    } catch (e) {}
    var resp = await fetch(GH_RAW + '/skills/' + encodeURIComponent(name) + '/SKILL.md', { cache: 'no-cache' });
    if (!resp.ok) throw new Error('SKILL.md not found (HTTP ' + resp.status + ')');
    var md = await resp.text();
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), md: md })); } catch (e) {}
    return md;
  }

  function isFavorite(name) {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]').indexOf(name) >= 0; }
    catch (e) { return false; }
  }
  function toggleFavorite(name) {
    var favs = [];
    try { favs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) {}
    var i = favs.indexOf(name);
    if (i >= 0) favs.splice(i, 1); else favs.push(name);
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    return i < 0;
  }

  function render(name, md) {
    var parsed = parseFrontmatter(md);
    var meta = parsed.meta;
    var body = parsed.body;
    var rawHtml = (window.marked && window.marked.parse) ? window.marked.parse(body) : '<pre>' + escapeHtml(body) + '</pre>';
    var html = (window.DOMPurify && window.DOMPurify.sanitize)
      ? window.DOMPurify.sanitize(rawHtml, { ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/)/i })
      : escapeHtml(body);

    document.title = 'MaKIT - ' + name + ' | 마케팅 플레이북';

    var fav = isFavorite(name);
    var container = document.getElementById('mpDetail');
    container.innerHTML = '' +
      '<div class="mp-detail-header">' +
        '<h1 class="mp-detail-title">' + escapeHtml(meta.name || name) + '</h1>' +
        (meta.description ? '<p class="mp-detail-desc">' + escapeHtml(meta.description) + '</p>' : '') +
        '<div class="mp-detail-actions">' +
          '<button id="mpFavBtn" class="mp-btn">' + (fav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기') + '</button>' +
          '<button id="mpCopyBtn" class="mp-btn">📋 본문 복사</button>' +
          '<a class="mp-btn" target="_blank" rel="noopener" href="' + GH_REPO + '/skills/' + encodeURIComponent(name) + '/SKILL.md">GitHub 원문</a>' +
        '</div>' +
      '</div>' +
      '<article class="mp-content">' + html + '</article>';

    document.getElementById('mpFavBtn').addEventListener('click', function () {
      var nowFav = toggleFavorite(name);
      this.textContent = nowFav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기';
    });
    document.getElementById('mpCopyBtn').addEventListener('click', function () {
      navigator.clipboard.writeText(body).then(function () {
        var btn = document.getElementById('mpCopyBtn');
        var orig = btn.textContent;
        btn.textContent = '✓ 복사됨';
        setTimeout(function () { btn.textContent = orig; }, 1500);
      });
    });
  }

  async function init() {
    var name = getName();
    if (!name) {
      document.getElementById('mpDetail').innerHTML =
        '<div class="mp-error">잘못된 플레이북 이름입니다. <a href="marketing-playbooks.html">목록으로 돌아가기</a></div>';
      return;
    }
    try {
      var md = await fetchSkill(name);
      render(name, md);
    } catch (err) {
      document.getElementById('mpDetail').innerHTML =
        '<div class="mp-error">불러오기 실패: ' + escapeHtml(err.message) + ' <br><a href="marketing-playbooks.html">목록으로 돌아가기</a></div>';
    }
  }

  init();
})();
