/**
 * AX Office Hub — front-end SPA shell (P0 + P1).
 *
 * Single-page hash router with mock data:
 *   #home                     → 위젯형 홈 (AI 입력바 + 메모/일정/최근/공지)
 *   #collection/<id>          → 컬렉션 내 문서 목록
 *   #doc/<id>                 → 문서 본문 + AI 사이드 패널
 *   #search?q=<term>          → 전체 검색 결과
 *   #trash | #mine | #favorites → 보조 뷰
 *
 * Backend integration is intentionally deferred to Phase 2/3.
 * All data lives in MOCK below; AI actions return deterministic stub text.
 */
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Auth gate (Hub is a logged-in workspace)
  // -------------------------------------------------------------------------
  if (window.auth && typeof window.auth.requireLogin === 'function') {
    if (!window.auth.requireLogin()) return;
  }

  // -------------------------------------------------------------------------
  // Mock data (Phase 1) — replace with /api/knowledge/* in Phase 2
  // -------------------------------------------------------------------------
  var MOCK = {
    collections: [
      { id: 'welcome', emoji: '👋', name: 'Welcome', desc: 'Office Hub 시작 가이드와 사내 안내' },
      { id: 'marketing', emoji: '📣', name: '마케팅 노하우', desc: '캠페인·콘텐츠·퍼포먼스 운영 노하우' },
      { id: 'product', emoji: '📘', name: '제품 매뉴얼', desc: 'MaKIT 서비스 운영·관리 매뉴얼' },
      { id: 'ops', emoji: '🛠️', name: '운영/인프라', desc: '배포·장애·보안 점검 체크리스트' }
    ],
    docs: [
      { id: 'd1', cid: 'welcome', emoji: '🚀', title: 'Office Hub 둘러보기', tags: ['시작하기', '온보딩'], updatedAt: '2026-05-08',
        body: '# Office Hub 둘러보기\n\nOffice Hub는 팀의 흩어진 지식을 한 곳에 모으고 AI로 빠르게 찾고 활용하는 사내 워크스페이스입니다.\n\n## 핵심 개념\n- **컬렉션**: 주제 단위 폴더\n- **문서**: 마크다운 본문, 태그·즐겨찾기 지원\n- **AI 어시스턴트**: 요약·연관문서·태그 추천·초안 작성\n\n## 다음 단계\n1. 좌측에서 컬렉션을 선택하세요\n2. 문서를 열고 우측 AI 패널을 시도해보세요\n3. ⌘K 로 전체 검색을 실행할 수 있습니다' },
      { id: 'd2', cid: 'welcome', emoji: '🔐', title: '권한과 공유 정책', tags: ['보안', '권한'], updatedAt: '2026-05-07',
        body: '# 권한과 공유 정책\n\n사내 컬렉션은 기본적으로 **팀 전체 읽기 가능**, 편집은 컬렉션 소유자가 부여합니다.\n\n> 향후 Phase 2 에서 역할(ADMIN/EDITOR/VIEWER) 기반 권한이 도입됩니다.' },
      { id: 'd3', cid: 'marketing', emoji: '📊', title: 'Q4 캠페인 회고', tags: ['캠페인', '회고'], updatedAt: '2026-05-06',
        body: '# Q4 캠페인 회고\n\n## 성과\n- 노출수: 약 1.2M\n- 전환율: 3.8% (목표 3.0%)\n\n## 배운 점\n- A/B 테스트 사이클을 격주로 단축한 것이 효과적\n- 카피 톤 통일이 CTR 향상에 기여' },
      { id: 'd4', cid: 'marketing', emoji: '✍️', title: 'AI 카피라이팅 가이드', tags: ['AI', '카피'], updatedAt: '2026-05-05',
        body: '# AI 카피라이팅 가이드\n\n프롬프트 패턴 예시:\n\n```\n[브랜드 톤] [타깃] [메시지 1줄] [원하는 길이]\n```\n\n좋은 결과를 위한 팁: 톤·타깃·CTA 한 가지를 명확히 지정.' },
      { id: 'd5', cid: 'product', emoji: '🧩', title: '서비스 카탈로그 운영 가이드', tags: ['운영', '백오피스'], updatedAt: '2026-05-08',
        body: '# 서비스 카탈로그 운영 가이드\n\n백오피스(`all-services.html`) 에 신규 카드를 추가하는 절차는:\n\n1. 카테고리 섹션을 정한다\n2. `service-card` 마크업을 추가한다\n3. 진입 페이지의 라우트와 권한을 설정한다\n\n신규 진입 페이지는 모두 `auth.requireLogin()` 으로 보호되어야 합니다.' },
      { id: 'd6', cid: 'product', emoji: '🤖', title: 'RAG 챗봇 운영 매뉴얼', tags: ['RAG', '챗봇'], updatedAt: '2026-05-04',
        body: '# RAG 챗봇 운영 매뉴얼\n\n## 인덱싱 주기\n- 문서 변경 시 비동기 임베딩 재계산\n\n## 답변 품질 모니터링\n- 인용 정확도, 응답 시간, 사용자 피드백 3축으로 트래킹' },
      { id: 'd7', cid: 'ops', emoji: '🚨', title: '장애 대응 체크리스트', tags: ['장애', '온콜'], updatedAt: '2026-05-03',
        body: '# 장애 대응 체크리스트\n\n1. 알람을 인지한다\n2. 영향 범위를 측정한다 (사용자 수, 결제 등)\n3. 임시 완화 조치 → 근본 원인 분석 → 영구 수정 순' },
      { id: 'd8', cid: 'ops', emoji: '🔧', title: '주간 인프라 점검', tags: ['인프라', '주간'], updatedAt: '2026-05-02',
        body: '# 주간 인프라 점검\n\n- 디스크 사용률\n- DB 슬로우 쿼리\n- 백업 무결성\n- TLS 인증서 만료 여부' }
    ],
    notes: [
      { id: 'n1', text: '금요일까지 Q4 자료 정리 마무리하기' },
      { id: 'n2', text: '아침에 비타민·챙겨먹기' },
      { id: 'n3', text: '신규 카탈로그 운영 정책 v2 검토' }
    ],
    events: [
      { id: 'e1', when: 'PM 2:30', title: '오후 팀 미팅' },
      { id: 'e2', when: 'PM 6:00', title: '헬스장' }
    ],
    notice: { tag: '공지사항', title: 'AX Office Hub 베타 오픈 안내', date: '2026.05.09' }
  };
  // Recently viewed cache (sessionStorage to feel "recent")
  var RECENT_KEY = 'mk:axhub:recent';

  // -------------------------------------------------------------------------
  // DOM helpers
  // -------------------------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'dataset') Object.assign(n.dataset, attrs[k]);
        else n.setAttribute(k, attrs[k]);
      });
    }
    if (html != null) n.innerHTML = html;
    return n;
  }
  // [XSS 정책]
  // 사용자(또는 향후 사용자) 제공 콘텐츠는 두 경로 중 하나로만 DOM에 들어간다.
  //   1) 평문/스니펫/제목/태그/메타  → escapeHtml() 로 HTML escape
  //   2) Markdown 본문(md()) 렌더 결과 → DOMPurify.sanitize() 로 살균
  // 검색 결과의 본문 스니펫은 plain text 발췌이므로 (1) escapeHtml 경로를 사용한다.
  // 새 코드를 추가할 때도 이 두 경로 외의 raw HTML 주입을 금지한다.
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function sanitize(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
      return window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    }
    // DOMPurify 미로드 시 안전 폴백: 원문을 escape하여 평문 처리
    return '<pre>' + escapeHtml(html) + '</pre>';
  }
  function md(text) {
    if (window.marked && typeof window.marked.parse === 'function') {
      try { return sanitize(window.marked.parse(text)); } catch (_) { /* fall through */ }
    }
    return '<pre>' + escapeHtml(text) + '</pre>';
  }
  function getDoc(id) { return MOCK.docs.filter(function (d) { return d.id === id; })[0]; }
  function getCollection(id) { return MOCK.collections.filter(function (c) { return c.id === id; })[0]; }
  function docsIn(cid) { return MOCK.docs.filter(function (d) { return d.cid === cid; }); }

  function pushRecent(docId) {
    var arr = [];
    try { arr = JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]'); } catch (_) { arr = []; }
    arr = [docId].concat(arr.filter(function (x) { return x !== docId; })).slice(0, 5);
    try { sessionStorage.setItem(RECENT_KEY, JSON.stringify(arr)); } catch (_) { /* noop */ }
  }
  function getRecent() {
    try { return JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]'); } catch (_) { return []; }
  }

  // -------------------------------------------------------------------------
  // Sidebar (collection list, active state)
  // -------------------------------------------------------------------------
  function renderSidebarCollections() {
    var host = $('#hubCollectionList');
    if (!host) return;
    host.innerHTML = '';
    MOCK.collections.forEach(function (c) {
      var a = el('a', {
        href: '#collection/' + c.id,
        class: 'hub-side-collection',
        dataset: { collection: c.id }
      });
      a.innerHTML =
        '<span class="col-emoji">' + escapeHtml(c.emoji) + '</span>' +
        '<span class="col-name">' + escapeHtml(c.name) + '</span>' +
        '<span class="col-count">' + docsIn(c.id).length + '</span>';
      host.appendChild(a);
    });
  }

  function setActiveSidebar(route, param) {
    document.querySelectorAll('.hub-side-item').forEach(function (it) {
      it.classList.toggle('active', it.dataset.route === route);
    });
    document.querySelectorAll('.hub-side-collection').forEach(function (it) {
      it.classList.toggle('active', route === 'collection' && it.dataset.collection === param);
    });
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------
  function viewHome() {
    var view = $('#hubView');
    var recentIds = getRecent();
    var recentDocs = recentIds.map(getDoc).filter(Boolean);

    view.innerHTML =
      '<section class="hub-hero">' +
        '<h1>AI로 연결하는 <span class="accent">우리 팀의 모든 지식</span></h1>' +
        '<p>프라이빗 AI로 안전하게, RAG 기술로 정확하게.</p>' +
      '</section>' +
      '<form class="hub-aibar" id="hubAIBar" autocomplete="off">' +
        '<div class="hub-aibar-row">' +
          '<span class="hub-aibar-icon">✨</span>' +
          '<input type="text" id="hubAIInput" placeholder="어떤 작업을 도와드릴까요?  (예: Q4 회고 요약해줘)">' +
          '<button type="submit" class="hub-aibar-send">전송</button>' +
        '</div>' +
      '</form>' +
      '<div class="hub-quickchips">' +
        '<button type="button" class="hub-quickchip" data-q="문서관리 가이드">#문서관리 가이드</button>' +
        '<button type="button" class="hub-quickchip" data-q="RAG 챗봇 운영">#RAG 운영</button>' +
        '<button type="button" class="hub-quickchip" data-q="장애 대응">#장애 대응</button>' +
        '<button type="button" class="hub-quickchip" data-q="AI 카피라이팅">#AI 카피</button>' +
      '</div>' +
      '<div class="hub-widgets">' +
        widgetMemo() +
        widgetEvents() +
        widgetRecent(recentDocs) +
      '</div>' +
      '<div class="hub-notice">' +
        '<span class="notice-tag">' + escapeHtml(MOCK.notice.tag) + '</span>' +
        '<span class="notice-title">' + escapeHtml(MOCK.notice.title) + '</span>' +
        '<span class="notice-date">' + escapeHtml(MOCK.notice.date) + '</span>' +
      '</div>';

    var form = $('#hubAIBar');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = ($('#hubAIInput').value || '').trim();
        if (!q) return;
        location.hash = '#search?q=' + encodeURIComponent(q);
      });
    }
    document.querySelectorAll('.hub-quickchip').forEach(function (b) {
      b.addEventListener('click', function () {
        location.hash = '#search?q=' + encodeURIComponent(b.dataset.q || '');
      });
    });
  }

  function widgetMemo() {
    var lis = MOCK.notes.map(function (n) {
      return '<li class="hub-widget-li"><span class="li-dot"></span><span>' + escapeHtml(n.text) + '</span></li>';
    }).join('');
    return '<div class="hub-widget">' +
      '<div class="hub-widget-head"><span class="hub-widget-icon">📝</span>메모</div>' +
      '<ul class="hub-widget-list">' + lis + '</ul>' +
    '</div>';
  }
  function widgetEvents() {
    var lis = MOCK.events.map(function (e) {
      return '<li class="hub-widget-li"><span class="li-time">' + escapeHtml(e.when) + '</span><span>' + escapeHtml(e.title) + '</span></li>';
    }).join('');
    return '<div class="hub-widget">' +
      '<div class="hub-widget-head"><span class="hub-widget-icon">📅</span>오늘의 일정</div>' +
      '<ul class="hub-widget-list">' + lis + '</ul>' +
    '</div>';
  }
  function widgetRecent(docs) {
    var body;
    if (!docs.length) {
      body = '<div class="hub-empty" style="padding:1rem 0;"><div class="e-emoji" style="font-size:1.5rem;">🕘</div><p>최근 조회한 문서가 여기에 표시됩니다</p></div>';
    } else {
      body = '<ul class="hub-widget-list">' + docs.map(function (d) {
        return '<li class="hub-widget-li"><a href="#doc/' + escapeHtml(d.id) + '">' + escapeHtml(d.emoji + ' ' + d.title) + '</a></li>';
      }).join('') + '</ul>';
    }
    return '<div class="hub-widget">' +
      '<div class="hub-widget-head"><span class="hub-widget-icon">🕘</span>최근 조회됨</div>' +
      body +
    '</div>';
  }

  function viewCollection(cid) {
    var col = getCollection(cid);
    var view = $('#hubView');
    if (!col) {
      view.innerHTML = emptyState('🔍', '컬렉션을 찾을 수 없습니다', '좌측에서 다른 컬렉션을 선택해주세요.');
      return;
    }
    var docs = docsIn(cid);
    var cards = docs.length
      ? '<div class="hub-doc-grid">' + docs.map(docCardHtml).join('') + '</div>'
      : emptyState('📂', '아직 문서가 없습니다', '컬렉션을 정리해두면 AI 어시스턴트의 답변 정확도가 올라갑니다.');

    view.innerHTML =
      '<div class="hub-page-head">' +
        '<div class="hub-breadcrumb"><a href="#home">홈</a> › <span>' + escapeHtml(col.name) + '</span></div>' +
        '<h1>' + escapeHtml(col.emoji + ' ' + col.name) + '</h1>' +
        '<p class="desc">' + escapeHtml(col.desc) + '</p>' +
      '</div>' +
      cards;
  }

  function docCardHtml(d) {
    var snippet = d.body.replace(/^#.*$/gm, '').replace(/[#*`>\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
    return '<a class="hub-doc-card" href="#doc/' + escapeHtml(d.id) + '">' +
      '<div class="doc-emoji">' + escapeHtml(d.emoji) + '</div>' +
      '<div class="doc-title">' + escapeHtml(d.title) + '</div>' +
      '<div class="doc-snippet">' + escapeHtml(snippet) + '…</div>' +
      '<div class="doc-meta">' + d.tags.map(function (t) { return '<span class="doc-tag">#' + escapeHtml(t) + '</span>'; }).join('') + '</div>' +
    '</a>';
  }

  function viewDoc(id) {
    var doc = getDoc(id);
    var view = $('#hubView');
    if (!doc) {
      view.innerHTML = emptyState('🔍', '문서를 찾을 수 없습니다', '좌측에서 다른 문서를 선택해주세요.');
      return;
    }
    pushRecent(id);
    var col = getCollection(doc.cid);
    view.innerHTML =
      '<div class="hub-page-head">' +
        '<div class="hub-breadcrumb">' +
          '<a href="#home">홈</a> › ' +
          '<a href="#collection/' + escapeHtml(doc.cid) + '">' + escapeHtml(col ? col.name : '컬렉션') + '</a> › ' +
          '<span>' + escapeHtml(doc.title) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="hub-doc-layout">' +
        '<article class="hub-doc-body">' + md(doc.body) + '</article>' +
        '<aside class="hub-aside">' +
          '<div class="hub-aipanel" id="hubAIPanel">' +
            '<h3>AI 어시스턴트</h3>' +
            '<div class="hub-ai-actions">' +
              '<button type="button" class="hub-ai-btn" data-act="summarize">요약</button>' +
              '<button type="button" class="hub-ai-btn" data-act="related">연관 문서</button>' +
              '<button type="button" class="hub-ai-btn" data-act="tags">태그 추천</button>' +
              '<button type="button" class="hub-ai-btn" data-act="draft">초안 작성</button>' +
            '</div>' +
            '<div class="hub-ai-output" id="hubAIOut">버튼을 눌러 AI 도움을 받아보세요.\n(Phase 2에서 RAG 백엔드와 연결 예정)</div>' +
          '</div>' +
          '<div class="hub-aipanel">' +
            '<h3 style="margin-bottom:0.5rem;">기본 정보</h3>' +
            '<ul class="meta-list">' +
              '<li><span>컬렉션</span><b>' + escapeHtml(col ? col.name : '-') + '</b></li>' +
              '<li><span>업데이트</span><b>' + escapeHtml(doc.updatedAt) + '</b></li>' +
              '<li><span>태그</span><b>' + doc.tags.map(function (t) { return '#' + escapeHtml(t); }).join(' ') + '</b></li>' +
            '</ul>' +
          '</div>' +
        '</aside>' +
      '</div>';

    document.querySelectorAll('#hubAIPanel .hub-ai-btn').forEach(function (b) {
      b.addEventListener('click', function () { runAI(b.dataset.act, doc); });
    });
  }

  function runAI(act, doc) {
    var out = $('#hubAIOut');
    if (!out) return;
    out.textContent = 'AI 응답 생성 중…';
    setTimeout(function () {
      var msg;
      switch (act) {
        case 'summarize':
          msg = '요약 (mock):\n• ' + doc.title + '의 핵심을 3줄로 정리합니다.\n• 본문에서 가장 자주 등장하는 키워드는 [' + doc.tags.join(', ') + '] 입니다.\n• 다음 단계로 ' + (getCollection(doc.cid) || {}).name + ' 내 다른 문서도 참고해보세요.';
          break;
        case 'related':
          var others = MOCK.docs.filter(function (d) { return d.id !== doc.id && d.cid === doc.cid; }).slice(0, 3);
          msg = '연관 문서 (mock):\n' + (others.length ? others.map(function (d) { return '• ' + d.emoji + ' ' + d.title; }).join('\n') : '• 같은 컬렉션 내 다른 문서가 없습니다.');
          break;
        case 'tags':
          msg = '태그 추천 (mock):\n#' + doc.tags.join('  #') + '  #자동추천';
          break;
        case 'draft':
          msg = '초안 (mock):\n"' + doc.title + '"의 후속 문서 초안 — 도입부 / 본문 3섹션 / 결론 / 다음 액션 으로 구성을 제안합니다.';
          break;
        default: msg = '지원하지 않는 작업입니다.';
      }
      out.textContent = msg + '\n\n※ 본 응답은 mock 입니다 — Phase 2에서 Bedrock + RAG 백엔드와 연결됩니다.';
    }, 350);
  }

  function viewSearch(q) {
    var view = $('#hubView');
    var term = (q || '').toLowerCase().trim();
    var results = !term ? [] : MOCK.docs.filter(function (d) {
      return d.title.toLowerCase().indexOf(term) !== -1
          || d.body.toLowerCase().indexOf(term) !== -1
          || d.tags.join(' ').toLowerCase().indexOf(term) !== -1;
    });
    var list = results.length
      ? '<div class="hub-doc-grid">' + results.map(docCardHtml).join('') + '</div>'
      : emptyState('🔎', term ? '검색 결과가 없습니다' : '검색어를 입력해주세요', term ? '다른 키워드로 다시 시도해보세요.' : '예: "RAG", "캠페인", "장애"');

    view.innerHTML =
      '<div class="hub-page-head">' +
        '<div class="hub-breadcrumb"><a href="#home">홈</a> › <span>검색</span></div>' +
        '<h1>"' + escapeHtml(q || '') + '" 검색 결과</h1>' +
        '<p class="desc">' + results.length + '건</p>' +
      '</div>' +
      list;
  }

  function viewSimple(title, desc, emoji) {
    $('#hubView').innerHTML =
      '<div class="hub-page-head">' +
        '<div class="hub-breadcrumb"><a href="#home">홈</a> › <span>' + escapeHtml(title) + '</span></div>' +
        '<h1>' + escapeHtml(title) + '</h1>' +
      '</div>' +
      emptyState(emoji, title, desc);
  }

  function emptyState(emoji, title, desc) {
    return '<div class="hub-empty">' +
      '<div class="e-emoji">' + escapeHtml(emoji) + '</div>' +
      '<h3>' + escapeHtml(title) + '</h3>' +
      '<p>' + escapeHtml(desc) + '</p>' +
    '</div>';
  }

  // -------------------------------------------------------------------------
  // Search modal (⌘K)
  // -------------------------------------------------------------------------
  function openSearchModal() {
    var m = $('#hubSearchModal');
    if (!m) return;
    m.hidden = false;
    var inp = $('#hubSearchInput');
    if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 0); }
    renderSearchModalResults('');
  }
  function closeSearchModal() {
    var m = $('#hubSearchModal');
    if (m) m.hidden = true;
  }
  function renderSearchModalResults(term) {
    var host = $('#hubSearchResults');
    if (!host) return;
    var t = (term || '').toLowerCase().trim();
    if (!t) {
      host.innerHTML = '<div class="hub-search-empty">최근 항목 또는 키워드를 입력하세요 (예: "RAG", "캠페인")</div>';
      return;
    }
    var hits = MOCK.docs.filter(function (d) {
      return d.title.toLowerCase().indexOf(t) !== -1
          || d.body.toLowerCase().indexOf(t) !== -1
          || d.tags.join(' ').toLowerCase().indexOf(t) !== -1;
    }).slice(0, 8);
    if (!hits.length) { host.innerHTML = '<div class="hub-search-empty">결과가 없습니다</div>'; return; }
    host.innerHTML = hits.map(function (d) {
      var col = getCollection(d.cid);
      var snippet = d.body.replace(/[#*`>\-]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
      return '<a class="hub-search-result" href="#doc/' + escapeHtml(d.id) + '" data-close>' +
        '<div class="r-title">' + escapeHtml(d.emoji + ' ' + d.title) + '</div>' +
        '<div class="r-meta">' + escapeHtml((col ? col.name : '-') + ' · ' + d.updatedAt) + '</div>' +
        '<div class="r-snippet">' + escapeHtml(snippet) + '…</div>' +
      '</a>';
    }).join('');
  }

  // -------------------------------------------------------------------------
  // Router
  // -------------------------------------------------------------------------
  function parseHash() {
    var h = (location.hash || '#home').replace(/^#/, '');
    var qIdx = h.indexOf('?');
    var path = qIdx === -1 ? h : h.slice(0, qIdx);
    var query = {};
    if (qIdx !== -1) {
      h.slice(qIdx + 1).split('&').forEach(function (pair) {
        var kv = pair.split('=');
        query[decodeURIComponent(kv[0] || '')] = decodeURIComponent(kv[1] || '');
      });
    }
    var parts = path.split('/');
    return { route: parts[0] || 'home', param: parts[1] || '', query: query };
  }

  function render() {
    var r = parseHash();
    setActiveSidebar(r.route, r.param);
    switch (r.route) {
      case 'home': viewHome(); break;
      case 'collection': viewCollection(r.param); break;
      case 'doc': viewDoc(r.param); break;
      case 'search': viewSearch(r.query.q || ''); break;
      case 'trash': viewSimple('임시 보관함', '삭제 예정 문서가 여기에 보관됩니다. (Phase 2에서 활성화)', '🗑️'); break;
      case 'mine': viewSimple('내 컬렉션', '내가 만들었거나 참여하는 컬렉션이 여기에 표시됩니다. (Phase 2)', '📁'); break;
      case 'favorites': viewSimple('즐겨찾기', '자주 보는 문서를 즐겨찾기에 추가해 빠르게 접근하세요. (Phase 2)', '⭐'); break;
      default: viewHome();
    }
    // Scroll main to top on route change
    var m = document.querySelector('.hub-main');
    if (m) m.scrollTop = 0;
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  function init() {
    renderSidebarCollections();

    // Default route
    if (!location.hash) location.hash = '#home';

    window.addEventListener('hashchange', render);
    render();

    // Sidebar search button
    var ssBtn = $('#hubSideSearchBtn');
    if (ssBtn) ssBtn.addEventListener('click', openSearchModal);

    // Add collection (P2 placeholder)
    var addBtn = $('#hubAddCollectionBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (window.modal && window.modal.alert) window.modal.alert('컬렉션 생성', '컬렉션 추가는 Phase 2(백엔드 CRUD)에서 활성화됩니다.');
        else alert('컬렉션 추가는 Phase 2에서 활성화됩니다.');
      });
    }

    // Search modal events
    var modalEl = $('#hubSearchModal');
    if (modalEl) {
      modalEl.addEventListener('click', function (e) {
        var t = e.target;
        if (t && (t.hasAttribute('data-close') || t.closest('[data-close]'))) {
          closeSearchModal();
        }
      });
      var inp = $('#hubSearchInput');
      if (inp) {
        inp.addEventListener('input', function (e) { renderSearchModalResults(e.target.value); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSearchModal(); });
      }
    }

    // Cmd/Ctrl + K → open Hub search.
    // Capture phase + stopImmediatePropagation so the global app-shell Cmd+K palette
    // does NOT also fire on this page (single source of search on Hub).
    document.addEventListener('keydown', function (e) {
      var isModK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (isModK) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var m = $('#hubSearchModal');
        if (m && m.hidden) openSearchModal();
        else closeSearchModal();
      } else if (e.key === 'Escape') {
        var mm = $('#hubSearchModal');
        if (mm && !mm.hidden) { closeSearchModal(); return; }
        // Esc on mobile also closes the off-canvas sidebar
        var sb = $('#hubSidebar');
        if (sb && sb.classList.contains('open')) closeMobileSidebar();
      }
    }, true);

    // Mobile sidebar off-canvas toggle
    var mobileToggle = $('#hubMobileToggle');
    var backdrop = $('#hubSidebarBackdrop');
    if (mobileToggle) mobileToggle.addEventListener('click', toggleMobileSidebar);
    if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);

    // Auto-close mobile sidebar after route change (clicking a nav item)
    window.addEventListener('hashchange', closeMobileSidebar);
  }

  function toggleMobileSidebar() {
    var sb = $('#hubSidebar');
    var bd = $('#hubSidebarBackdrop');
    var btn = $('#hubMobileToggle');
    if (!sb) return;
    var willOpen = !sb.classList.contains('open');
    sb.classList.toggle('open', willOpen);
    if (bd) bd.hidden = !willOpen;
    if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }
  function closeMobileSidebar() {
    var sb = $('#hubSidebar');
    var bd = $('#hubSidebarBackdrop');
    var btn = $('#hubMobileToggle');
    if (sb) sb.classList.remove('open');
    if (bd) bd.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
