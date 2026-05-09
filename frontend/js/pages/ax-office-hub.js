/**
 * AX Office Hub — front-end SPA shell (Phase 2: backend-connected).
 *
 * Hash router:
 *   #home                     → 위젯형 홈 (AI 입력바 + 메모/일정/최근/공지)
 *   #collection/<id>          → 컬렉션 내 문서 목록 (실제 데이터)
 *   #doc/<id>                 → 문서 본문 + AI 사이드 패널 (편집/삭제/즐겨찾기)
 *   #search?q=<term>          → 전체 검색 결과 (서버 검색)
 *   #trash | #mine | #favorites → 보조 뷰 (서버 데이터)
 *
 * Backed by `/api/knowledge/*` (see backend/src/main/java/.../knowledge).
 * All write actions use api.knowledge.* and refresh affected views.
 *
 * Phase 3 (Task #14): AI 입력바와 4개 액션(요약/연관/태그/초안)이
 * `/api/knowledge/ai/*` RAG 백엔드를 호출합니다. SSE 스트리밍 + 인용 +
 * 👍/👎 피드백 지원. 백엔드가 없으면 (현 Replit 정적 환경) 자동으로
 * 결정론적 mock 응답으로 폴백합니다.
 *
 * Notes/Events/Notice 위젯은 별도 백엔드 작업 범위 밖이라 정적 placeholder
 * 로 유지합니다(intro 영역에 영향 없음).
 */
(function () {
  'use strict';

  if (window.auth && typeof window.auth.requireLogin === 'function') {
    if (!window.auth.requireLogin()) return;
  }

  // -------------------------------------------------------------------------
  // Static UI fixtures (홈 위젯 — 백엔드 연결은 별도 후속 작업)
  // -------------------------------------------------------------------------
  var STATIC_NOTES = [
    { id: 'n1', text: '금요일까지 Q4 자료 정리 마무리하기' },
    { id: 'n2', text: '아침에 비타민·챙겨먹기' },
    { id: 'n3', text: '신규 카탈로그 운영 정책 v2 검토' }
  ];
  var STATIC_EVENTS = [
    { id: 'e1', when: 'PM 2:30', title: '오후 팀 미팅' },
    { id: 'e2', when: 'PM 6:00', title: '헬스장' }
  ];
  var STATIC_NOTICE = { tag: '공지사항', title: 'AX Office Hub 베타 오픈 안내', date: '2026.05.09' };

  var RECENT_KEY = 'mk:axhub:recent';

  // -------------------------------------------------------------------------
  // In-memory caches (refreshed on writes)
  // -------------------------------------------------------------------------
  var COLLECTIONS = [];
  var COLLECTIONS_BY_ID = {};
  var DOCS_CACHE = {};      // docId → DocumentDto
  var FAVORITES_CACHE = null; // List<DocumentDto> | null

  function indexCollections(list) {
    COLLECTIONS = Array.isArray(list) ? list : [];
    COLLECTIONS_BY_ID = {};
    COLLECTIONS.forEach(function (c) { COLLECTIONS_BY_ID[c.id] = c; });
  }

  function ensureCollections() {
    if (COLLECTIONS.length) return Promise.resolve(COLLECTIONS);
    return window.api.knowledge.listCollections().then(function (list) {
      indexCollections(list);
      return COLLECTIONS;
    });
  }

  function refreshCollections() {
    return window.api.knowledge.listCollections().then(function (list) {
      indexCollections(list);
      renderSidebarCollections();
      return COLLECTIONS;
    });
  }

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
      try { return sanitize(window.marked.parse(text || '')); } catch (_) { /* fall through */ }
    }
    return '<pre>' + escapeHtml(text || '') + '</pre>';
  }
  function fmtDate(iso) {
    if (!iso) return '';
    try { return iso.slice(0, 10); } catch (_) { return String(iso); }
  }
  function emoji(d) { return d && d.emoji ? d.emoji : '📄'; }
  function colEmoji(c) { return c && c.emoji ? c.emoji : '📁'; }

  function pushRecent(docId) {
    var arr = [];
    try { arr = JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]'); } catch (_) { arr = []; }
    arr = [docId].concat(arr.filter(function (x) { return x !== docId; })).slice(0, 5);
    try { sessionStorage.setItem(RECENT_KEY, JSON.stringify(arr)); } catch (_) { /* noop */ }
  }
  function getRecent() {
    try { return JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]'); } catch (_) { return []; }
  }

  function notifyError(message) {
    var msg = message || '요청을 처리하지 못했습니다.';
    if (window.makitModal && window.makitModal.open) {
      window.makitModal.open({
        title: '오류', message: msg,
        actions: [{ label: '확인', type: 'primary', onClick: function () { window.makitModal.close(); } }]
      });
    } else { alert(msg); }
  }
  function confirmDialog(title, message, danger) {
    if (window.makitModal && window.makitModal.confirm) {
      return window.makitModal.confirm({ title: title, message: message, danger: !!danger });
    }
    return Promise.resolve(window.confirm(message));
  }

  function renderLoading(host) {
    host.innerHTML = '<div class="hub-empty"><div class="e-emoji">⏳</div><p>불러오는 중…</p></div>';
  }

  // -------------------------------------------------------------------------
  // RAG bridge — calls /api/knowledge/ai/* with SSE streaming, falls back to
  // a deterministic mock when the backend is unreachable so the page stays
  // demoable in the static frontend-only Replit environment.
  // -------------------------------------------------------------------------
  var AI = {
    /**
     * Stream an `ask` (free-form) or `action` (summarize/related/tags/draft)
     * request. Calls `handlers.onCitation`, `onDelta`, `onDone`, `onError`.
     * Returns a Promise that resolves once the stream terminates.
     */
    stream: function (kind, action, payload, handlers) {
      handlers = handlers || {};
      if (!window.api || !window.api.knowledge) {
        return Promise.resolve(AI._mockStream(kind, action, payload, handlers));
      }
      var p = (kind === 'ask')
        ? window.api.knowledge.askStream(payload)
        : window.api.knowledge.actionStream(action, payload);

      return p.then(function (resp) {
        if (!resp || !resp.ok || !resp.body) {
          return AI._mockStream(kind, action, payload, handlers);
        }
        return AI._consumeSSE(resp, handlers);
      }).catch(function (_err) {
        return AI._mockStream(kind, action, payload, handlers);
      });
    },

    _consumeSSE: function (resp, handlers) {
      var reader = resp.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buf = '';
      function flushEvent(rawBlock) {
        // SSE event = lines separated by \n; fields: event:, data:
        var ev = 'message';
        var dataLines = [];
        rawBlock.split('\n').forEach(function (ln) {
          if (ln.indexOf('event:') === 0) ev = ln.slice(6).trim();
          else if (ln.indexOf('data:') === 0) dataLines.push(ln.slice(5).trim());
        });
        var data = dataLines.join('\n');
        if (ev === 'delta') { handlers.onDelta && handlers.onDelta(data); return; }
        if (ev === 'citation') {
          var c = null; try { c = JSON.parse(data); } catch (_) { /* ignore */ }
          if (c && handlers.onCitation) handlers.onCitation(c);
          return;
        }
        if (ev === 'done') {
          var d = {}; try { d = JSON.parse(data || '{}'); } catch (_) { d = {}; }
          handlers.onDone && handlers.onDone(d);
          return;
        }
        if (ev === 'error') { handlers.onError && handlers.onError(data); return; }
        // 'ping' and unknowns: noop
      }
      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) {
            if (buf.trim()) flushEvent(buf);
            return;
          }
          buf += decoder.decode(chunk.value, { stream: true });
          var idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            var block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            if (block.trim()) flushEvent(block);
          }
          return pump();
        });
      }
      return pump();
    },

    /** Mock streaming used when backend is unavailable. */
    _mockStream: function (kind, action, payload, handlers) {
      var msg = '';
      var citations = [];
      // Pull whatever docs we have cached locally so the mock can stay
      // useful even though Phase 2 removed the static MOCK fixture.
      var cachedDocs = Object.keys(DOCS_CACHE).map(function (k) { return DOCS_CACHE[k]; });
      function bodyOf(d) { return (d && (d.bodyMd || d.body)) || ''; }
      function tagsOf(d) { return (d && d.tags) || []; }
      function collectionOf(d) { return d && (d.collectionId || d.cid); }

      if (kind === 'ask') {
        var q = (payload && payload.question) || '';
        var t = q.toLowerCase();
        var hits = cachedDocs.filter(function (d) {
          return (d.title || '').toLowerCase().indexOf(t) !== -1
              || bodyOf(d).toLowerCase().indexOf(t) !== -1
              || tagsOf(d).join(' ').toLowerCase().indexOf(t) !== -1;
        }).slice(0, 3);
        if (hits.length) {
          msg = '"' + q + '"에 대해 사내 문서 ' + hits.length + '건을 참고했어요.\n\n'
              + hits.map(function (d, i) { return '• ' + d.title + ' [#' + (i + 1) + ']'; }).join('\n');
          citations = hits.map(function (d, i) {
            return { documentId: d.id, title: d.title, chunkIndex: 0, score: 0.7 - i * 0.05,
                     snippet: bodyOf(d).replace(/\s+/g, ' ').slice(0, 120) };
          });
        } else {
          msg = '관련 문서를 찾지 못했어요. 컬렉션에 자료를 추가하거나 검색어를 바꿔 다시 시도해 보세요.';
        }
      } else {
        // For actions the caller sends title/body/tags/collectionId in payload.
        var doc = payload || null;
        if (doc && doc.documentId && DOCS_CACHE[doc.documentId]) {
          var cached = DOCS_CACHE[doc.documentId];
          doc = {
            id: doc.documentId,
            title: doc.title || cached.title,
            body: doc.body || bodyOf(cached),
            tags: (doc.tags && doc.tags.length) ? doc.tags : tagsOf(cached),
            collectionId: doc.collectionId || collectionOf(cached)
          };
        }
        switch (action) {
          case 'summarize':
            msg = doc
              ? '• ' + doc.title + ' 핵심을 3줄로 정리합니다.\n• 본문 키워드: ' + (doc.tags || []).join(', ') + '\n• 다음 행동 추천: 같은 컬렉션 내 관련 문서 함께 보기'
              : '문서를 찾지 못했어요.';
            break;
          case 'related':
            var others = doc
              ? cachedDocs.filter(function (d) { return d.id !== doc.id && collectionOf(d) === doc.collectionId; }).slice(0, 3)
              : [];
            if (others.length) {
              msg = others.map(function (d, i) { return '📎 ' + d.title + ' — 같은 컬렉션의 후속 자료 [#' + (i + 1) + ']'; }).join('\n');
              citations = others.map(function (d, i) {
                return { documentId: d.id, title: d.title, chunkIndex: 0, score: 0.6 - i * 0.05,
                         snippet: bodyOf(d).replace(/\s+/g, ' ').slice(0, 120) };
              });
            } else {
              msg = '같은 주제의 다른 문서를 아직 찾지 못했어요.';
            }
            break;
          case 'tags':
            msg = (doc && doc.tags && doc.tags.length) ? ('#' + doc.tags.join(' #') + ' #자동추천') : '#자동추천';
            break;
          case 'draft':
            msg = doc
              ? '# ' + doc.title + ' — 후속 가이드\n\n도입부 한 문장으로 배경을 정리합니다.\n\n## 본문\n- 섹션 1: 현황 정리\n- 섹션 2: 개선 포인트\n- 섹션 3: 적용 사례\n\n## 결론\n다음 분기 운영에 즉시 반영 가능한 권고를 제시합니다.\n\n## 다음 액션\n- [ ] 담당자 지정\n- [ ] 리뷰 일정 잡기'
              : '초안을 작성할 문서를 찾지 못했어요.';
            break;
          default:
            msg = '지원하지 않는 작업입니다.';
        }
      }
      // Replay as if streamed.
      citations.forEach(function (c) { handlers.onCitation && handlers.onCitation(c); });
      var step = 32;
      for (var i = 0; i < msg.length; i += step) {
        handlers.onDelta && handlers.onDelta(msg.slice(i, i + step));
      }
      handlers.onDone && handlers.onDone({ contextId: 'mock-' + Date.now(), mock: true });
    },

    sendFeedback: function (payload) {
      if (!window.api || !window.api.knowledge) return Promise.resolve();
      return window.api.knowledge.feedback(payload).catch(function (_) { /* swallow */ });
    }
  };

  /**
   * Render a streaming AI panel into `host`. Returns nothing.
   * - `payload`: request body sent to AI.stream
   * - `kind`: 'ask' | 'action'
   * - `action`: only used when kind === 'action'
   * - `documentId`: for the feedback payload (optional)
   */
  function renderAIStream(host, kind, action, payload, documentId) {
    if (!host) return;
    host.innerHTML =
      '<div class="hub-ai-confidence" hidden></div>' +
      '<div class="hub-ai-citations" hidden></div>' +
      '<div class="hub-ai-answer">AI 응답 생성 중<span class="hub-ai-dots">…</span></div>' +
      '<div class="hub-ai-feedback" hidden>' +
        '<span>이 답변이 도움이 되었나요?</span>' +
        '<button type="button" class="hub-fb hub-fb-up"   aria-label="도움이 됨">👍</button>' +
        '<button type="button" class="hub-fb hub-fb-down" aria-label="도움이 안 됨">👎</button>' +
        '<span class="hub-fb-thanks" hidden>피드백 감사합니다 🙏</span>' +
      '</div>';
    var confEl = host.querySelector('.hub-ai-confidence');
    var citesEl = host.querySelector('.hub-ai-citations');
    var answerEl = host.querySelector('.hub-ai-answer');
    var fbEl = host.querySelector('.hub-ai-feedback');
    var answerText = '';
    var citations = [];
    var contextId = null;
    var firstDelta = true;

    AI.stream(kind, action, payload, {
      onCitation: function (c) {
        citations.push(c);
        renderCitations(citesEl, citations);
      },
      onDelta: function (t) {
        if (firstDelta) { answerEl.textContent = ''; firstDelta = false; }
        answerText += t;
        // Render citation-aware markdown: convert [#N] tokens into clickable spans.
        answerEl.innerHTML = renderAnswerWithCitations(answerText, citations);
      },
      onDone: function (info) {
        contextId = info && info.contextId;
        if (firstDelta) { answerEl.textContent = '(빈 응답)'; }
        renderConfidence(confEl, citations);
        fbEl.hidden = false;
      },
      onError: function (msg) {
        answerEl.textContent = msg || 'AI 응답 생성 중 오류가 발생했어요.';
      }
    });

    fbEl.addEventListener('click', function (e) {
      var up   = e.target.closest('.hub-fb-up');
      var down = e.target.closest('.hub-fb-down');
      if (!up && !down) return;
      var helpful = !!up;
      AI.sendFeedback({
        contextId: contextId || ('local-' + Date.now()),
        documentId: documentId || null,
        action: kind === 'ask' ? 'ask' : action,
        helpful: helpful
      });
      fbEl.querySelector('.hub-fb-up').disabled = true;
      fbEl.querySelector('.hub-fb-down').disabled = true;
      fbEl.querySelector('.hub-fb-thanks').hidden = false;
    });
  }

  /**
   * Render a confidence badge above the answer based on retrieval signals.
   * - 0 citations → "근거 문서 없음 — 일반 지식 기반 답변" (red/none)
   * - avg(score) < 0.5 → "근거가 약합니다" (yellow/weak)
   * - otherwise hidden
   */
  function renderConfidence(host, citations) {
    if (!host) return;
    if (!citations || !citations.length) {
      host.hidden = false;
      host.className = 'hub-ai-confidence hub-ai-confidence--none';
      host.innerHTML =
        '<span class="hub-conf-icon" aria-hidden="true">⚠️</span>' +
        '<span class="hub-conf-text">근거 문서 없음 — 일반 지식 기반 답변</span>';
      return;
    }
    var scored = citations.filter(function (c) { return typeof c.score === 'number'; });
    if (scored.length) {
      var avg = scored.reduce(function (s, c) { return s + c.score; }, 0) / scored.length;
      if (avg < 0.5) {
        host.hidden = false;
        host.className = 'hub-ai-confidence hub-ai-confidence--weak';
        host.innerHTML =
          '<span class="hub-conf-icon" aria-hidden="true">⚠️</span>' +
          '<span class="hub-conf-text">근거가 약합니다 (평균 ' + Math.round(avg * 100) + '%)</span>';
        return;
      }
    }
    host.hidden = true;
    host.className = 'hub-ai-confidence';
    host.innerHTML = '';
  }

  function renderCitations(host, citations) {
    if (!host) return;
    if (!citations.length) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = '<div class="cite-label">출처</div>' + citations.map(function (c, i) {
      var title = c.title || ('문서 ' + c.documentId);
      var score = (typeof c.score === 'number') ? (Math.round(c.score * 100) + '%') : '';
      return '<a class="hub-cite" href="#doc/' + escapeHtml(c.documentId) + '" title="' + escapeHtml(c.snippet || '') + '">' +
        '<span class="cite-num">[#' + (i + 1) + ']</span>' +
        '<span class="cite-title">' + escapeHtml(title) + '</span>' +
        (score ? '<span class="cite-score">' + escapeHtml(score) + '</span>' : '') +
      '</a>';
    }).join('');
  }

  /** Convert plaintext answer with `[#N]` markers into HTML with clickable inline citations. */
  function renderAnswerWithCitations(text, citations) {
    var safe = escapeHtml(text);
    return safe.replace(/\[#(\d+)]/g, function (_m, n) {
      var idx = parseInt(n, 10) - 1;
      var c = citations[idx];
      if (!c) return '<sup class="cite-ref cite-ref-missing">[#' + n + ']</sup>';
      return '<a class="cite-ref" href="#doc/' + escapeHtml(c.documentId) + '" title="' + escapeHtml(c.title || '') + '">[#' + n + ']</a>';
    }).replace(/\n/g, '<br>');
  }

  // -------------------------------------------------------------------------
  // Sidebar (collection list, active state)
  // -------------------------------------------------------------------------
  function renderSidebarCollections() {
    var host = $('#hubCollectionList');
    if (!host) return;
    host.innerHTML = '';
    if (!COLLECTIONS.length) {
      host.appendChild(el('div', { class: 'hub-side-empty' },
        '아직 컬렉션이 없습니다.<br>+ 버튼으로 추가하세요.'));
      return;
    }
    COLLECTIONS.forEach(function (c) {
      var a = el('a', {
        href: '#collection/' + c.id,
        class: 'hub-side-collection',
        dataset: { collection: c.id }
      });
      a.innerHTML =
        '<span class="col-emoji">' + escapeHtml(colEmoji(c)) + '</span>' +
        '<span class="col-name">' + escapeHtml(c.name) + '</span>' +
        '<span class="col-count">' + (c.docCount || 0) + '</span>';
      host.appendChild(a);
    });
    setActiveSidebarFromHash();
  }

  function setActiveSidebar(route, param) {
    document.querySelectorAll('.hub-side-item').forEach(function (it) {
      it.classList.toggle('active', it.dataset.route === route);
    });
    document.querySelectorAll('.hub-side-collection').forEach(function (it) {
      it.classList.toggle('active', route === 'collection' && it.dataset.collection === param);
    });
  }
  function setActiveSidebarFromHash() {
    var r = parseHash();
    setActiveSidebar(r.route, r.param);
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------
  function viewHome() {
    var view = $('#hubView');
    var recentIds = getRecent();
    // Resolve recent docs from cache; fetch any missing
    var unknown = recentIds.filter(function (id) { return !DOCS_CACHE[id]; });
    var prep = unknown.length
      ? Promise.all(unknown.map(function (id) {
          return window.api.knowledge.getDocument(id)
            .then(function (d) { DOCS_CACHE[id] = d; })
            .catch(function () { /* ignore — likely deleted */ });
        }))
      : Promise.resolve();

    prep.then(function () {
      var recentDocs = recentIds.map(function (id) { return DOCS_CACHE[id]; }).filter(Boolean);
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
          '<button type="button" class="hub-quickchip" data-q="문서관리">#문서관리</button>' +
          '<button type="button" class="hub-quickchip" data-q="RAG">#RAG</button>' +
          '<button type="button" class="hub-quickchip" data-q="장애 대응">#장애 대응</button>' +
          '<button type="button" class="hub-quickchip" data-q="AI 카피">#AI 카피</button>' +
        '</div>' +
        '<div class="hub-aibar-answer" id="hubAIAnswer" hidden></div>' +
        '<div class="hub-widgets">' +
          widgetMemo() +
          widgetEvents() +
          widgetRecent(recentDocs) +
        '</div>' +
        '<div class="hub-notice">' +
          '<span class="notice-tag">' + escapeHtml(STATIC_NOTICE.tag) + '</span>' +
          '<span class="notice-title">' + escapeHtml(STATIC_NOTICE.title) + '</span>' +
          '<span class="notice-date">' + escapeHtml(STATIC_NOTICE.date) + '</span>' +
        '</div>';

      var form = $('#hubAIBar');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var q = ($('#hubAIInput').value || '').trim();
          if (!q) return;
          var ans = $('#hubAIAnswer');
          if (ans) {
            ans.hidden = false;
            renderAIStream(ans, 'ask', null, { question: q }, null);
          }
        });
      }
      document.querySelectorAll('.hub-quickchip').forEach(function (b) {
        b.addEventListener('click', function () {
          var inp = $('#hubAIInput');
          if (inp) inp.value = b.dataset.q || '';
          var f = $('#hubAIBar');
          if (f) f.dispatchEvent(new Event('submit', { cancelable: true }));
        });
      });
    });
  }

  function widgetMemo() {
    var lis = STATIC_NOTES.map(function (n) {
      return '<li class="hub-widget-li"><span class="li-dot"></span><span>' + escapeHtml(n.text) + '</span></li>';
    }).join('');
    return '<div class="hub-widget">' +
      '<div class="hub-widget-head"><span class="hub-widget-icon">📝</span>메모</div>' +
      '<ul class="hub-widget-list">' + lis + '</ul>' +
    '</div>';
  }
  function widgetEvents() {
    var lis = STATIC_EVENTS.map(function (e) {
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
        return '<li class="hub-widget-li"><a href="#doc/' + escapeHtml(d.id) + '">' +
               escapeHtml(emoji(d) + ' ' + d.title) + '</a></li>';
      }).join('') + '</ul>';
    }
    return '<div class="hub-widget">' +
      '<div class="hub-widget-head"><span class="hub-widget-icon">🕘</span>최근 조회됨</div>' +
      body +
    '</div>';
  }

  function viewCollection(cid) {
    var view = $('#hubView');
    renderLoading(view);

    ensureCollections().then(function () {
      var col = COLLECTIONS_BY_ID[cid];
      if (!col) {
        view.innerHTML = emptyState('🔍', '컬렉션을 찾을 수 없습니다', '좌측에서 다른 컬렉션을 선택해주세요.');
        return;
      }
      window.api.knowledge.listDocuments(cid).then(function (docs) {
        docs = docs || [];
        docs.forEach(function (d) { DOCS_CACHE[d.id] = d; });

        var headActions = col.canEdit
          ? '<div class="hub-page-actions">' +
              '<button type="button" class="hub-btn-primary" id="hubNewDocBtn">+ 새 문서</button>' +
              '<button type="button" class="hub-btn-secondary" id="hubEditCollectionBtn">컬렉션 편집</button>' +
              '<button type="button" class="hub-btn-danger" id="hubDeleteCollectionBtn">컬렉션 삭제</button>' +
            '</div>'
          : '';

        var cards = docs.length
          ? '<div class="hub-doc-grid">' + docs.map(docCardHtml).join('') + '</div>'
          : emptyState('📂', '아직 문서가 없습니다',
              col.canEdit ? '"+ 새 문서" 버튼으로 첫 문서를 작성해보세요.' : '컬렉션에 문서가 추가되면 여기에 표시됩니다.');

        view.innerHTML =
          '<div class="hub-page-head">' +
            '<div class="hub-breadcrumb"><a href="#home">홈</a> › <span>' + escapeHtml(col.name) + '</span></div>' +
            '<h1>' + escapeHtml(colEmoji(col) + ' ' + col.name) + '</h1>' +
            (col.description ? '<p class="desc">' + escapeHtml(col.description) + '</p>' : '') +
            headActions +
          '</div>' +
          cards;

        var newBtn = $('#hubNewDocBtn');
        if (newBtn) newBtn.addEventListener('click', function () { openNewDocPrompt(col); });
        var editColBtn = $('#hubEditCollectionBtn');
        if (editColBtn) editColBtn.addEventListener('click', function () { openEditCollectionPrompt(col); });
        var delColBtn = $('#hubDeleteCollectionBtn');
        if (delColBtn) delColBtn.addEventListener('click', function () { confirmDeleteCollection(col); });
      }).catch(function (err) {
        view.innerHTML = emptyState('⚠️', '문서를 불러오지 못했습니다', (err && err.message) || '잠시 후 다시 시도하세요.');
      });
    }).catch(function (err) {
      view.innerHTML = emptyState('⚠️', '컬렉션을 불러오지 못했습니다', (err && err.message) || '잠시 후 다시 시도하세요.');
    });
  }

  function docCardHtml(d) {
    var snippet = (d.bodyMd || '').replace(/^#.*$/gm, '').replace(/[#*`>\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
    var tagsHtml = (d.tags || []).map(function (t) { return '<span class="doc-tag">#' + escapeHtml(t) + '</span>'; }).join('');
    var fav = d.favorite ? '<span class="doc-fav" title="즐겨찾기">⭐</span>' : '';
    return '<a class="hub-doc-card" href="#doc/' + escapeHtml(d.id) + '">' +
      '<div class="doc-emoji">' + escapeHtml(emoji(d)) + fav + '</div>' +
      '<div class="doc-title">' + escapeHtml(d.title) + '</div>' +
      '<div class="doc-snippet">' + escapeHtml(snippet) + (snippet ? '…' : '') + '</div>' +
      '<div class="doc-meta">' + tagsHtml + '</div>' +
    '</a>';
  }

  function viewDoc(id) {
    var view = $('#hubView');
    renderLoading(view);

    Promise.all([ensureCollections(), window.api.knowledge.getDocument(id)])
      .then(function (results) {
        var doc = results[1];
        DOCS_CACHE[doc.id] = doc;
        pushRecent(doc.id);
        renderDoc(doc, false);
      })
      .catch(function (err) {
        var msg = (err && err.message) || '문서를 찾을 수 없습니다.';
        view.innerHTML = emptyState('🔍', '문서를 찾을 수 없습니다', msg);
      });
  }

  function renderDoc(doc, editing) {
    var view = $('#hubView');
    var col = COLLECTIONS_BY_ID[doc.collectionId];
    var favBtn = '<button type="button" class="hub-btn-icon" id="hubFavBtn" title="즐겨찾기">' +
                 (doc.favorite ? '⭐' : '☆') + '</button>';
    var actions = doc.canEdit
      ? favBtn +
        '<button type="button" class="hub-btn-secondary" id="hubEditDocBtn">편집</button>' +
        '<button type="button" class="hub-btn-danger" id="hubDeleteDocBtn">' +
        (doc.status === 'TRASH' ? '영구 삭제' : '휴지통으로') + '</button>' +
        (doc.status === 'TRASH' ? '<button type="button" class="hub-btn-primary" id="hubRestoreDocBtn">복원</button>' : '')
      : favBtn;

    var head =
      '<div class="hub-page-head">' +
        '<div class="hub-breadcrumb">' +
          '<a href="#home">홈</a> › ' +
          '<a href="#collection/' + escapeHtml(doc.collectionId) + '">' + escapeHtml(col ? col.name : '컬렉션') + '</a> › ' +
          '<span>' + escapeHtml(doc.title) + '</span>' +
        '</div>' +
        '<div class="hub-page-actions">' + actions + '</div>' +
      '</div>';

    var sideMeta =
      '<div class="hub-aipanel">' +
        '<h3 style="margin-bottom:0.5rem;">기본 정보</h3>' +
        '<ul class="meta-list">' +
          '<li><span>컬렉션</span><b>' + escapeHtml(col ? col.name : '-') + '</b></li>' +
          '<li><span>업데이트</span><b>' + escapeHtml(fmtDate(doc.updatedAt)) + '</b></li>' +
          '<li><span>상태</span><b>' + escapeHtml(doc.status || 'PUBLISHED') + '</b></li>' +
          '<li><span>태그</span><b>' + (doc.tags || []).map(function (t) { return '#' + escapeHtml(t); }).join(' ') + '</b></li>' +
        '</ul>' +
      '</div>';

    var aiPanel =
      '<div class="hub-aipanel" id="hubAIPanel">' +
        '<h3>AI 어시스턴트</h3>' +
        '<div class="hub-ai-actions">' +
          '<button type="button" class="hub-ai-btn" data-act="summarize">요약</button>' +
          '<button type="button" class="hub-ai-btn" data-act="related">연관 문서</button>' +
          '<button type="button" class="hub-ai-btn" data-act="tags">태그 추천</button>' +
          '<button type="button" class="hub-ai-btn" data-act="draft">초안 작성</button>' +
        '</div>' +
        '<div class="hub-ai-output" id="hubAIOut">버튼을 눌러 AI 도움을 받아보세요.\n(Phase 3에서 RAG 백엔드와 연결 예정)</div>' +
      '</div>';

    if (editing) {
      view.innerHTML = head +
        '<div class="hub-doc-layout">' +
          '<form class="hub-doc-edit" id="hubDocEditForm">' +
            '<label class="hub-field">' +
              '<span>제목</span>' +
              '<input type="text" id="hubDocTitle" required maxlength="255" value="' + escapeHtml(doc.title) + '">' +
            '</label>' +
            '<div class="hub-field-row">' +
              '<label class="hub-field hub-field-emoji">' +
                '<span>이모지</span>' +
                '<input type="text" id="hubDocEmoji" maxlength="4" value="' + escapeHtml(doc.emoji || '') + '">' +
              '</label>' +
              '<label class="hub-field hub-field-grow">' +
                '<span>태그 (쉼표로 구분)</span>' +
                '<input type="text" id="hubDocTags" value="' + escapeHtml((doc.tags || []).join(', ')) + '">' +
              '</label>' +
            '</div>' +
            '<label class="hub-field">' +
              '<span>본문 (마크다운)</span>' +
              '<textarea id="hubDocBody" rows="18">' + escapeHtml(doc.bodyMd || '') + '</textarea>' +
            '</label>' +
            '<div class="hub-form-actions">' +
              '<button type="submit" class="hub-btn-primary">저장</button>' +
              '<button type="button" class="hub-btn-secondary" id="hubDocCancelBtn">취소</button>' +
            '</div>' +
          '</form>' +
          '<aside class="hub-aside">' + sideMeta + '</aside>' +
        '</div>';

      $('#hubDocEditForm').addEventListener('submit', function (e) {
        e.preventDefault();
        saveDocEdits(doc);
      });
      $('#hubDocCancelBtn').addEventListener('click', function () { renderDoc(doc, false); });
    } else {
      view.innerHTML = head +
        '<div class="hub-doc-layout">' +
          '<article class="hub-doc-body">' + md(doc.bodyMd) + '</article>' +
          '<aside class="hub-aside">' + aiPanel + sideMeta + '</aside>' +
        '</div>';

      document.querySelectorAll('#hubAIPanel .hub-ai-btn').forEach(function (b) {
        b.addEventListener('click', function () { runAI(b.dataset.act, doc); });
      });
    }

    var fb = $('#hubFavBtn');
    if (fb) fb.addEventListener('click', function () { toggleFavorite(doc); });
    var eb = $('#hubEditDocBtn');
    if (eb) eb.addEventListener('click', function () { renderDoc(doc, true); });
    var db = $('#hubDeleteDocBtn');
    if (db) db.addEventListener('click', function () { confirmDeleteDoc(doc); });
    var rb = $('#hubRestoreDocBtn');
    if (rb) rb.addEventListener('click', function () { restoreDoc(doc); });
  }

  function saveDocEdits(doc) {
    var title = ($('#hubDocTitle').value || '').trim();
    var emojiVal = ($('#hubDocEmoji').value || '').trim();
    var tags = ($('#hubDocTags').value || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    var body = $('#hubDocBody').value || '';
    if (!title) { notifyError('제목은 필수입니다.'); return; }
    window.api.knowledge.updateDocument(doc.id, {
      title: title, emoji: emojiVal, tags: tags, bodyMd: body
    }).then(function (updated) {
      DOCS_CACHE[updated.id] = updated;
      renderDoc(updated, false);
      refreshCollections(); // doc count may shift on status changes; safe to refresh
    }).catch(function (err) { notifyError((err && err.message) || '저장에 실패했습니다.'); });
  }

  function toggleFavorite(doc) {
    var op = doc.favorite ? window.api.knowledge.removeFavorite(doc.id)
                          : window.api.knowledge.addFavorite(doc.id);
    op.then(function () { return window.api.knowledge.getDocument(doc.id); })
      .then(function (updated) {
        DOCS_CACHE[updated.id] = updated;
        FAVORITES_CACHE = null;
        renderDoc(updated, false);
      })
      .catch(function (err) { notifyError((err && err.message) || '즐겨찾기 변경 실패'); });
  }

  function confirmDeleteDoc(doc) {
    var msg = doc.status === 'TRASH'
      ? '"' + doc.title + '" 문서를 영구 삭제할까요? 되돌릴 수 없습니다.'
      : '"' + doc.title + '" 문서를 휴지통으로 옮길까요?';
    confirmDialog('확인', msg, true).then(function (ok) {
      if (!ok) return;
      var op = doc.status === 'TRASH'
        ? window.api.knowledge.purgeFromTrash(doc.id)
        : window.api.knowledge.trashDocument(doc.id);
      op.then(function () {
        delete DOCS_CACHE[doc.id];
        FAVORITES_CACHE = null;
        refreshCollections();
        location.hash = doc.status === 'TRASH' ? '#trash' : '#collection/' + doc.collectionId;
      }).catch(function (err) { notifyError((err && err.message) || '삭제 실패'); });
    });
  }

  function restoreDoc(doc) {
    window.api.knowledge.restoreFromTrash(doc.id)
      .then(function (updated) {
        DOCS_CACHE[updated.id] = updated;
        refreshCollections();
        location.hash = '#doc/' + updated.id;
      })
      .catch(function (err) { notifyError((err && err.message) || '복원 실패'); });
  }

  function runAI(act, doc) {
    var out = $('#hubAIOut');
    if (!out) return;
    var payload = {
      documentId: doc.id,
      title: doc.title,
      body: doc.bodyMd,
      tags: doc.tags || [],
      collectionId: doc.collectionId
    };
    renderAIStream(out, 'action', act, payload, doc.id);
  }

  function viewSearch(q) {
    var view = $('#hubView');
    var term = (q || '').trim();
    if (!term) {
      view.innerHTML =
        '<div class="hub-page-head">' +
          '<div class="hub-breadcrumb"><a href="#home">홈</a> › <span>검색</span></div>' +
          '<h1>검색</h1>' +
          '<p class="desc">검색어를 입력하세요.</p>' +
        '</div>' +
        emptyState('🔎', '검색어를 입력해주세요', '예: "RAG", "캠페인", "장애"');
      return;
    }
    renderLoading(view);
    window.api.knowledge.searchDocuments(term).then(function (results) {
      results = results || [];
      results.forEach(function (d) { DOCS_CACHE[d.id] = d; });
      var list = results.length
        ? '<div class="hub-doc-grid">' + results.map(docCardHtml).join('') + '</div>'
        : emptyState('🔎', '검색 결과가 없습니다', '다른 키워드로 다시 시도해보세요.');
      view.innerHTML =
        '<div class="hub-page-head">' +
          '<div class="hub-breadcrumb"><a href="#home">홈</a> › <span>검색</span></div>' +
          '<h1>"' + escapeHtml(term) + '" 검색 결과</h1>' +
          '<p class="desc">' + results.length + '건</p>' +
        '</div>' +
        list;
    }).catch(function (err) {
      view.innerHTML = emptyState('⚠️', '검색에 실패했습니다', (err && err.message) || '잠시 후 다시 시도하세요.');
    });
  }

  function viewFavorites() {
    var view = $('#hubView');
    renderLoading(view);
    window.api.knowledge.listFavorites().then(function (docs) {
      docs = docs || [];
      FAVORITES_CACHE = docs;
      docs.forEach(function (d) { DOCS_CACHE[d.id] = d; });
      var body = docs.length
        ? '<div class="hub-doc-grid">' + docs.map(docCardHtml).join('') + '</div>'
        : emptyState('⭐', '즐겨찾기가 비어있습니다', '문서 페이지에서 ☆ 버튼을 눌러 즐겨찾기에 추가하세요.');
      view.innerHTML =
        '<div class="hub-page-head">' +
          '<div class="hub-breadcrumb"><a href="#home">홈</a> › <span>즐겨찾기</span></div>' +
          '<h1>⭐ 즐겨찾기</h1>' +
          '<p class="desc">' + docs.length + '건</p>' +
        '</div>' + body;
    }).catch(function (err) {
      view.innerHTML = emptyState('⚠️', '즐겨찾기를 불러오지 못했습니다', (err && err.message) || '잠시 후 다시 시도하세요.');
    });
  }

  function viewTrash() {
    var view = $('#hubView');
    renderLoading(view);
    window.api.knowledge.listTrash().then(function (docs) {
      docs = docs || [];
      docs.forEach(function (d) { DOCS_CACHE[d.id] = d; });
      var body;
      if (!docs.length) {
        body = emptyState('🗑️', '임시 보관함이 비어있습니다', '삭제된 문서가 여기에 30일간 보관됩니다.');
      } else {
        body = '<div class="hub-trash-list">' + docs.map(function (d) {
          var col = COLLECTIONS_BY_ID[d.collectionId];
          return '<div class="hub-trash-row">' +
            '<a class="hub-trash-info" href="#doc/' + escapeHtml(d.id) + '">' +
              '<span class="r-emoji">' + escapeHtml(emoji(d)) + '</span>' +
              '<span class="r-title">' + escapeHtml(d.title) + '</span>' +
              '<span class="r-meta">' + escapeHtml((col ? col.name : '-') + ' · ' + fmtDate(d.deletedAt || d.updatedAt)) + '</span>' +
            '</a>' +
            (d.canEdit
              ? '<div class="hub-trash-actions">' +
                  '<button type="button" class="hub-btn-secondary" data-restore="' + escapeHtml(d.id) + '">복원</button>' +
                  '<button type="button" class="hub-btn-danger" data-purge="' + escapeHtml(d.id) + '">영구 삭제</button>' +
                '</div>'
              : '') +
          '</div>';
        }).join('') + '</div>';
      }
      view.innerHTML =
        '<div class="hub-page-head">' +
          '<div class="hub-breadcrumb"><a href="#home">홈</a> › <span>임시 보관함</span></div>' +
          '<h1>🗑️ 임시 보관함</h1>' +
          '<p class="desc">' + docs.length + '건</p>' +
        '</div>' + body;

      view.querySelectorAll('[data-restore]').forEach(function (b) {
        b.addEventListener('click', function () {
          window.api.knowledge.restoreFromTrash(b.dataset.restore)
            .then(function () { refreshCollections(); viewTrash(); })
            .catch(function (err) { notifyError((err && err.message) || '복원 실패'); });
        });
      });
      view.querySelectorAll('[data-purge]').forEach(function (b) {
        b.addEventListener('click', function () {
          confirmDialog('확인', '문서를 영구 삭제할까요? 되돌릴 수 없습니다.', true).then(function (ok) {
            if (!ok) return;
            window.api.knowledge.purgeFromTrash(b.dataset.purge)
              .then(function () { refreshCollections(); viewTrash(); })
              .catch(function (err) { notifyError((err && err.message) || '삭제 실패'); });
          });
        });
      });
    }).catch(function (err) {
      view.innerHTML = emptyState('⚠️', '임시 보관함을 불러오지 못했습니다', (err && err.message) || '잠시 후 다시 시도하세요.');
    });
  }

  function viewMine() {
    var view = $('#hubView');
    renderLoading(view);
    ensureCollections().then(function () {
      var mine = COLLECTIONS.filter(function (c) { return c.canEdit; });
      var body = mine.length
        ? '<div class="hub-mine-grid">' + mine.map(function (c) {
            return '<a class="hub-mine-card" href="#collection/' + escapeHtml(c.id) + '">' +
              '<div class="m-emoji">' + escapeHtml(colEmoji(c)) + '</div>' +
              '<div class="m-name">' + escapeHtml(c.name) + '</div>' +
              '<div class="m-meta">' + (c.docCount || 0) + '개 문서</div>' +
            '</a>';
          }).join('') + '</div>'
        : emptyState('📁', '내가 관리하는 컬렉션이 없습니다', '+ 버튼으로 새 컬렉션을 만들어보세요.');
      view.innerHTML =
        '<div class="hub-page-head">' +
          '<div class="hub-breadcrumb"><a href="#home">홈</a> › <span>내 컬렉션</span></div>' +
          '<h1>📁 내 컬렉션</h1>' +
          '<p class="desc">소유자/관리자 권한이 있는 컬렉션</p>' +
        '</div>' + body;
    });
  }

  function emptyState(emo, title, desc) {
    return '<div class="hub-empty">' +
      '<div class="e-emoji">' + escapeHtml(emo) + '</div>' +
      '<h3>' + escapeHtml(title) + '</h3>' +
      '<p>' + escapeHtml(desc) + '</p>' +
    '</div>';
  }

  // -------------------------------------------------------------------------
  // Create / edit prompts (lightweight modals via window.modal or prompt())
  // -------------------------------------------------------------------------
  function openNewCollectionPrompt() {
    var name = window.prompt('새 컬렉션 이름', '');
    if (name == null) return;
    name = name.trim();
    if (!name) return;
    var emojiVal = window.prompt('아이콘 이모지 (선택)', '📁') || '';
    var desc = window.prompt('설명 (선택)', '') || '';
    window.api.knowledge.createCollection({
      name: name, emoji: emojiVal.trim() || null, description: desc.trim() || null, sortOrder: 0
    }).then(function (created) {
      refreshCollections().then(function () {
        location.hash = '#collection/' + created.id;
      });
    }).catch(function (err) { notifyError((err && err.message) || '컬렉션 생성 실패'); });
  }

  function openEditCollectionPrompt(col) {
    var name = window.prompt('컬렉션 이름', col.name);
    if (name == null) return;
    name = name.trim();
    if (!name) return;
    var emojiVal = window.prompt('이모지', col.emoji || '');
    var desc = window.prompt('설명', col.description || '');
    window.api.knowledge.updateCollection(col.id, {
      name: name,
      emoji: (emojiVal == null ? col.emoji : emojiVal.trim()) || null,
      description: (desc == null ? col.description : desc.trim()) || null,
      sortOrder: col.sortOrder
    }).then(function () {
      refreshCollections().then(function () { viewCollection(col.id); });
    }).catch(function (err) { notifyError((err && err.message) || '컬렉션 수정 실패'); });
  }

  function confirmDeleteCollection(col) {
    var msg = '"' + col.name + '" 컬렉션과 그 안의 모든 문서를 영구 삭제할까요? 되돌릴 수 없습니다.';
    confirmDialog('확인', msg, true).then(function (ok) {
      if (!ok) return;
      window.api.knowledge.deleteCollection(col.id).then(function () {
        Object.keys(DOCS_CACHE).forEach(function (k) {
          if (DOCS_CACHE[k] && DOCS_CACHE[k].collectionId === col.id) delete DOCS_CACHE[k];
        });
        refreshCollections();
        location.hash = '#home';
      }).catch(function (err) { notifyError((err && err.message) || '컬렉션 삭제 실패'); });
    });
  }

  function openNewDocPrompt(col) {
    var title = window.prompt('문서 제목', '제목 없음');
    if (title == null) return;
    title = title.trim();
    if (!title) return;
    window.api.knowledge.createDocument({
      collectionId: col.id, title: title, bodyMd: '', tags: [], status: 'PUBLISHED'
    }).then(function (doc) {
      DOCS_CACHE[doc.id] = doc;
      refreshCollections();
      location.hash = '#doc/' + doc.id;
      // After hash navigation, kick into edit mode
      setTimeout(function () { renderDoc(doc, true); }, 0);
    }).catch(function (err) { notifyError((err && err.message) || '문서 생성 실패'); });
  }

  // -------------------------------------------------------------------------
  // Search modal (⌘K)
  // -------------------------------------------------------------------------
  var searchDebounce = null;

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
    var t = (term || '').trim();
    if (!t) {
      host.innerHTML = '<div class="hub-search-empty">검색어를 입력하세요 (예: "RAG", "캠페인")</div>';
      return;
    }
    host.innerHTML = '<div class="hub-search-empty">검색 중…</div>';
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(function () {
      window.api.knowledge.searchDocuments(t).then(function (hits) {
        hits = (hits || []).slice(0, 8);
        if (!hits.length) { host.innerHTML = '<div class="hub-search-empty">결과가 없습니다</div>'; return; }
        host.innerHTML = hits.map(function (d) {
          var col = COLLECTIONS_BY_ID[d.collectionId];
          var snippet = (d.bodyMd || '').replace(/[#*`>\-]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
          return '<a class="hub-search-result" href="#doc/' + escapeHtml(d.id) + '" data-close>' +
            '<div class="r-title">' + escapeHtml(emoji(d) + ' ' + d.title) + '</div>' +
            '<div class="r-meta">' + escapeHtml((col ? col.name : '-') + ' · ' + fmtDate(d.updatedAt)) + '</div>' +
            '<div class="r-snippet">' + escapeHtml(snippet) + (snippet ? '…' : '') + '</div>' +
          '</a>';
        }).join('');
      }).catch(function () {
        host.innerHTML = '<div class="hub-search-empty">검색에 실패했습니다</div>';
      });
    }, 200);
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
      case 'home':       viewHome(); break;
      case 'collection': viewCollection(r.param); break;
      case 'doc':        viewDoc(r.param); break;
      case 'search':     viewSearch(r.query.q || ''); break;
      case 'trash':      viewTrash(); break;
      case 'mine':       viewMine(); break;
      case 'favorites':  viewFavorites(); break;
      default:           viewHome();
    }
    var m = document.querySelector('.hub-main');
    if (m) m.scrollTop = 0;
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  function init() {
    // Initial sidebar (empty placeholder until fetched)
    renderSidebarCollections();

    if (!location.hash) location.hash = '#home';

    refreshCollections().then(function () { render(); }, function () { render(); });

    window.addEventListener('hashchange', render);

    var ssBtn = $('#hubSideSearchBtn');
    if (ssBtn) ssBtn.addEventListener('click', openSearchModal);

    var addBtn = $('#hubAddCollectionBtn');
    if (addBtn) addBtn.addEventListener('click', openNewCollectionPrompt);

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
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var v = (inp.value || '').trim();
            if (v) { closeSearchModal(); location.hash = '#search?q=' + encodeURIComponent(v); }
          }
        });
      }
    }

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
        var sb = $('#hubSidebar');
        if (sb && sb.classList.contains('open')) closeMobileSidebar();
      }
    }, true);

    var mobileToggle = $('#hubMobileToggle');
    var backdrop = $('#hubSidebarBackdrop');
    if (mobileToggle) mobileToggle.addEventListener('click', toggleMobileSidebar);
    if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);
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
