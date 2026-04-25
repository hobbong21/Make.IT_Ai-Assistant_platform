// MaKIT Global Chatbot Widget — 모든 페이지 우하단 floating AI 도우미
//
// 자동 마운트:
//   - DOMContentLoaded 시 #makit-chatbot-widget이 없으면 body에 inject
//   - login 페이지는 비활성화 (로그인 전이라 토큰 없음)
//
// 동작:
//   - 우하단 토글 버튼 클릭 → 패널 열림/닫힘
//   - 사용자 입력 → window.makitChatbot.streamInto() 활용 (SSE)
//   - 대화 이력은 localStorage('makit_chat_history')에 마지막 30턴 보존
//   - 페이지 컨텍스트(현재 page title)를 첫 메시지에 system context로 prepend

(function () {
  if (window.__makitChatbotWidgetMounted) return;
  window.__makitChatbotWidgetMounted = true;

  // 로그인 페이지에서는 비활성화
  if (/login\.html$/i.test(location.pathname)) return;
  // 미로그인 상태에서는 마운트하지 않음 (auth.requireLogin 흐름이 우선)
  if (!window.auth || !window.auth.isLoggedIn || !window.auth.isLoggedIn()) return;

  var STORAGE_KEY = 'makit_chat_history';
  var MAX_HISTORY = 30;

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveHistory(arr) {
    try {
      var trimmed = arr.slice(-MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (_) { /* quota exceeded etc. */ }
  }
  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    if (window.makitChatbot && window.makitChatbot.resetContext) window.makitChatbot.resetContext();
  }

  // 페이지 컨텍스트 추출 — 챗봇이 어떤 화면에서 호출됐는지 hint
  function derivePageContext() {
    try {
      var path = location.pathname.split('/').pop() || 'index.html';
      var title = document.title || '';
      var serviceKey = '';
      try {
        serviceKey = new URLSearchParams(location.search).get('service') || '';
      } catch (_) {}
      var hint = title;
      if (serviceKey) hint += ' (서비스 키: ' + serviceKey + ')';
      return hint || path;
    } catch (_) { return ''; }
  }

  function escapeHtml(s) {
    if (window.ui && ui.escapeHtml) return ui.escapeHtml(s);
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ---------- DOM ----------

  function buildDom() {
    var wrap = document.createElement('div');
    wrap.id = 'makit-chatbot-widget';
    wrap.className = 'mk-chat-widget';
    wrap.innerHTML =
      '<button type="button" class="mk-chat-fab" id="mkChatFab" aria-label="AI 챗봇 열기" aria-expanded="false">' +
      '  <svg class="mk-chat-fab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
      '  </svg>' +
      '  <span class="mk-chat-fab-badge" hidden>1</span>' +
      '</button>' +

      '<section class="mk-chat-panel" role="dialog" aria-label="MaKIT AI 어시스턴트" aria-hidden="true">' +
      '  <header class="mk-chat-panel-header">' +
      '    <div class="mk-chat-panel-title">' +
      '      <span class="mk-chat-panel-avatar" aria-hidden="true">AI</span>' +
      '      <div>' +
      '        <strong>MaKIT 어시스턴트</strong>' +
      '        <small>무엇이든 물어보세요</small>' +
      '      </div>' +
      '    </div>' +
      '    <div class="mk-chat-panel-actions">' +
      '      <button type="button" class="mk-chat-icon-btn" id="mkChatClear" aria-label="대화 이력 초기화" title="대화 이력 초기화">' +
      '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '          <path d="M3 6h18"></path><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>' +
      '        </svg>' +
      '      </button>' +
      '      <button type="button" class="mk-chat-icon-btn" id="mkChatClose" aria-label="패널 닫기" title="패널 닫기">' +
      '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '          <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>' +
      '        </svg>' +
      '      </button>' +
      '    </div>' +
      '  </header>' +

      '  <div class="mk-chat-messages" id="mkChatMessages" aria-live="polite">' +
      '    <div class="mk-chat-empty">' +
      '      <p><strong>안녕하세요!</strong></p>' +
      '      <p>제품 사용법, 데이터 분석 방법, 마케팅 전략 등 무엇이든 물어보세요.</p>' +
      '      <div class="mk-chat-suggestions">' +
      '        <button type="button" class="mk-chat-suggestion" data-q="MaKIT의 주요 기능을 알려줘">주요 기능 알려줘</button>' +
      '        <button type="button" class="mk-chat-suggestion" data-q="자연어 분석은 어떻게 사용하나요?">자연어 분석 사용법</button>' +
      '        <button type="button" class="mk-chat-suggestion" data-q="추천하는 마케팅 워크플로우는?">추천 워크플로우</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +

      '  <form class="mk-chat-form" id="mkChatForm" novalidate>' +
      '    <label class="mk-sr-only" for="mkChatInput">AI 챗봇 메시지</label>' +
      '    <input class="mk-chat-input" id="mkChatInput" type="text" maxlength="1000" autocomplete="off" placeholder="메시지를 입력하세요…" required>' +
      '    <button class="mk-chat-send" type="submit" aria-label="전송">' +
      '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '        <path d="M22 2L11 13"></path><path d="M22 2L15 22 11 13 2 9 22 2z"></path>' +
      '      </svg>' +
      '    </button>' +
      '  </form>' +
      '</section>';

    return wrap;
  }

  // ---------- 메시지 렌더 ----------

  function appendUser(text) {
    var msgs = document.getElementById('mkChatMessages');
    if (!msgs) return;
    hideEmpty();
    var m = document.createElement('div');
    m.className = 'mk-chat-msg mk-chat-msg-user';
    m.innerHTML = '<div class="mk-chat-bubble">' + escapeHtml(text) + '</div>';
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function appendBotShell() {
    var msgs = document.getElementById('mkChatMessages');
    if (!msgs) return null;
    hideEmpty();
    var m = document.createElement('div');
    m.className = 'mk-chat-msg mk-chat-msg-bot';
    m.innerHTML =
      '<span class="mk-chat-msg-avatar" aria-hidden="true">AI</span>' +
      '<div class="mk-chat-msg-body">' +
      '  <div class="mk-chat-bubble"></div>' +
      '</div>';
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m.querySelector('.mk-chat-bubble');
  }

  // 답변 완료 후 thumbs-up/down 피드백 UI 마운트
  function attachFeedback(bubble, messageIdx) {
    if (!bubble) return;
    var body = bubble.parentElement; // .mk-chat-msg-body
    if (!body || body.querySelector('.mk-chat-feedback')) return; // 중복 방지
    var fb = document.createElement('div');
    fb.className = 'mk-chat-feedback';
    fb.setAttribute('role', 'group');
    fb.setAttribute('aria-label', '답변 평가');
    fb.innerHTML =
      '<button type="button" class="mk-chat-fb-btn" data-helpful="true" aria-label="도움이 됨">' +
      '  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '    <path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7l-3 -3"></path>' +
      '  </svg>' +
      '</button>' +
      '<button type="button" class="mk-chat-fb-btn" data-helpful="false" aria-label="도움이 되지 않음">' +
      '  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '    <path d="M17 14V2"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1 -1.92 -2.56l2.33 -8A2 2 0 0 1 6.5 2H17l3 3"></path>' +
      '  </svg>' +
      '</button>' +
      '<small class="mk-chat-fb-status" aria-live="polite"></small>';
    body.appendChild(fb);

    var status = fb.querySelector('.mk-chat-fb-status');
    fb.addEventListener('click', function (e) {
      var btn = e.target.closest('.mk-chat-fb-btn');
      if (!btn) return;
      var helpful = btn.dataset.helpful === 'true';
      // 시각적 잠금 + 두 버튼 disable
      fb.querySelectorAll('.mk-chat-fb-btn').forEach(function (b) { b.disabled = true; });
      btn.classList.add('mk-chat-fb-btn--active');
      var ctxId = (window.makitChatbot && window.makitChatbot.getContextId && window.makitChatbot.getContextId()) || null;
      if (api && api.commerce && api.commerce.chatbotFeedback) {
        api.commerce.chatbotFeedback({ contextId: ctxId, messageIdx: messageIdx, helpful: helpful, comment: null })
          .then(function () { if (status) status.textContent = helpful ? '의견 감사합니다 🙏' : '개선에 반영하겠습니다.'; })
          .catch(function (err) {
            if (status) status.textContent = '피드백 전송 실패';
            console.warn('[chatbot-widget] feedback failed', err);
            // 재시도 가능하도록 풀어줌
            fb.querySelectorAll('.mk-chat-fb-btn').forEach(function (b) { b.disabled = false; });
            btn.classList.remove('mk-chat-fb-btn--active');
          });
      }
    });
  }

  function hideEmpty() {
    var emptyEl = document.querySelector('#mkChatMessages .mk-chat-empty');
    if (emptyEl) emptyEl.style.display = 'none';
  }
  function showEmpty() {
    var msgs = document.getElementById('mkChatMessages');
    if (!msgs) return;
    msgs.innerHTML =
      '<div class="mk-chat-empty">' +
      '  <p><strong>대화가 초기화되었습니다.</strong></p>' +
      '  <p>새로운 질문을 입력해주세요.</p>' +
      '</div>';
  }

  function restoreHistory() {
    var hist = loadHistory();
    if (!hist.length) return;
    hideEmpty();
    var msgs = document.getElementById('mkChatMessages');
    hist.forEach(function (turn) {
      var m = document.createElement('div');
      m.className = 'mk-chat-msg ' + (turn.role === 'user' ? 'mk-chat-msg-user' : 'mk-chat-msg-bot');
      m.innerHTML = (turn.role === 'user' ? '' : '<span class="mk-chat-msg-avatar" aria-hidden="true">AI</span>') +
        '<div class="mk-chat-bubble">' + escapeHtml(turn.content) + '</div>';
      msgs.appendChild(m);
    });
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ---------- 이벤트 ----------

  function bindEvents(root) {
    var fab = root.querySelector('#mkChatFab');
    var panel = root.querySelector('.mk-chat-panel');
    var closeBtn = root.querySelector('#mkChatClose');
    var clearBtn = root.querySelector('#mkChatClear');
    var form = root.querySelector('#mkChatForm');
    var input = root.querySelector('#mkChatInput');

    function openPanel() {
      panel.classList.add('mk-chat-panel--open');
      panel.setAttribute('aria-hidden', 'false');
      fab.setAttribute('aria-expanded', 'true');
      var badge = fab.querySelector('.mk-chat-fab-badge');
      if (badge) badge.hidden = true;
      setTimeout(function () { if (input) input.focus(); }, 200);
    }
    function closePanel() {
      panel.classList.remove('mk-chat-panel--open');
      panel.setAttribute('aria-hidden', 'true');
      fab.setAttribute('aria-expanded', 'false');
    }

    fab.addEventListener('click', function () {
      if (panel.classList.contains('mk-chat-panel--open')) closePanel(); else openPanel();
    });
    closeBtn.addEventListener('click', closePanel);
    clearBtn.addEventListener('click', function () {
      if (!confirm('대화 이력을 모두 삭제할까요?')) return;
      clearHistory();
      showEmpty();
    });

    // 추천 질문 버튼 (event delegation)
    root.addEventListener('click', function (e) {
      var s = e.target.closest('.mk-chat-suggestion');
      if (!s) return;
      var q = s.dataset.q || s.textContent.trim();
      input.value = q;
      form.requestSubmit();
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      input.disabled = true;

      appendUser(text);
      var bubble = appendBotShell();
      try {
        if (!window.makitChatbot || !window.makitChatbot.streamInto) {
          throw new Error('chatbot streaming helper 미로드 (chatbot.js 필요)');
        }
        // 페이지 컨텍스트 자동 prepend — 첫 메시지에만 (이력 없을 때) 페이지 hint 포함
        var historyForCtx = loadHistory();
        var contextualText = text;
        if (historyForCtx.length === 0) {
          var pageHint = derivePageContext();
          if (pageHint) {
            contextualText = '[페이지 컨텍스트: ' + pageHint + ']\n' + text;
          }
        }
        await window.makitChatbot.streamInto(bubble, contextualText);
        // 이력 저장
        var hist = loadHistory();
        hist.push({ role: 'user', content: text, at: Date.now() });
        hist.push({ role: 'bot', content: bubble.textContent || '', at: Date.now() });
        saveHistory(hist);
        // 답변 완료 후 thumbs 피드백 UI 마운트 (messageIdx = 봇 메시지 누적 인덱스)
        var botCount = hist.filter(function (h) { return h.role === 'bot'; }).length;
        attachFeedback(bubble, botCount - 1);
      } catch (err) {
        bubble.textContent = (err && err.message) || '응답 처리 중 오류가 발생했습니다.';
        if (window.ui && ui.toast) ui.toast('챗봇 오류: ' + (err && err.message || ''), 'error');
        console.error('[chatbot-widget]', err);
      } finally {
        input.disabled = false;
        input.focus();
      }
    });

    // ESC로 패널 닫기
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('mk-chat-panel--open')) closePanel();
    });
  }

  // ---------- 마운트 ----------

  function mount() {
    var root = buildDom();
    document.body.appendChild(root);
    bindEvents(root);
    restoreHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
