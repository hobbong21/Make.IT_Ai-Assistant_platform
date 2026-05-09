// MaKIT - 고객 응대 AI 챗봇 (chatbot 페이지)
// window.makitChatbot.streamInto() (frontend/js/pages/chatbot.js)에 의존.
// 메시지 리스트 + 입력 + 새 대화 + 컨텍스트 ID 표시.

(function () {
  'use strict';

  var state = {
    messages: [],  // {role:'user'|'assistant', text, ts}
    busy: false,
  };

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg, type) {
    if (window.ui && ui.toast) { ui.toast(msg, type || 'info'); return; }
    console.log('[cb] ' + msg);
  }

  function renderEmpty() {
    var box = $('cbMsgs');
    if (!box) return;
    box.innerHTML = '<div class="an-chat-empty">' +
      '<p style="margin:0 0 0.5rem;font-weight:600;color:var(--mk-color-text,#1f1f1f);">무엇을 도와드릴까요?</p>' +
      '<p class="an-hint">상품, 주문, 배송 등 궁금한 점을 자유롭게 물어보세요.</p>' +
      '</div>';
  }

  function appendBubble(role, text) {
    var box = $('cbMsgs');
    if (!box) return null;
    if (state.messages.length === 1 && state.messages[0] === undefined) state.messages = [];
    if (box.querySelector('.an-chat-empty')) box.innerHTML = '';
    var row = document.createElement('div');
    row.className = 'an-chat-row' + (role === 'user' ? ' is-user' : '');
    var bubble = document.createElement('div');
    bubble.className = 'an-bubble';
    if (role === 'user') {
      bubble.textContent = text || '';
    } else {
      // assistant: streamInto가 채워줌
      bubble.innerHTML = '<span class="an-loading" aria-hidden="true"></span><span class="an-hint" style="margin-left:0.3rem;">응답 생성 중...</span>';
    }
    row.appendChild(bubble);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    return bubble;
  }

  function updateContextDisplay() {
    var el = $('cbContextId');
    if (!el) return;
    var id = (window.makitChatbot && window.makitChatbot.getContextId && window.makitChatbot.getContextId()) || '';
    el.textContent = id ? id.slice(0, 12) + (id.length > 12 ? '…' : '') : '새 대화';
    el.title = id || '아직 대화가 시작되지 않았습니다.';
  }

  async function send() {
    if (state.busy) return;
    var ta = $('cbInput');
    var msg = (ta.value || '').trim();
    if (!msg) return;
    if (!window.makitChatbot || !window.makitChatbot.streamInto) {
      toast('챗봇 스트리밍 헬퍼를 불러오지 못했습니다.', 'error');
      return;
    }
    state.busy = true;
    var sendBtn = $('cbSendBtn');
    sendBtn.disabled = true;

    state.messages.push({ role: 'user', text: msg, ts: Date.now() });
    appendBubble('user', msg);
    ta.value = '';
    autoResize(ta);

    var bubble = appendBubble('assistant', '');
    try {
      // streamInto는 bubble 내부에 .mk-md-content div를 추가하고 토큰을 누적함.
      // 시작 시 placeholder를 비움.
      bubble.innerHTML = '';
      await window.makitChatbot.streamInto(bubble, msg);
      // 완료 후 메시지 history에 추출 (텍스트만)
      var holder = bubble.querySelector('.mk-md-content');
      var text = holder ? (holder.innerText || holder.textContent || '') : (bubble.innerText || '');
      state.messages.push({ role: 'assistant', text: text, ts: Date.now() });
      updateContextDisplay();
    } catch (err) {
      console.error('[cb] send error', err);
      bubble.textContent = (err && err.message) || '응답 중 오류가 발생했습니다.';
    } finally {
      state.busy = false;
      sendBtn.disabled = false;
      ta.focus();
      var box = $('cbMsgs');
      if (box) box.scrollTop = box.scrollHeight;
    }
  }

  function newConversation() {
    if (state.busy) { toast('응답 생성 중에는 새 대화를 시작할 수 없습니다.', 'info'); return; }
    if (state.messages.length && !confirm('현재 대화를 종료하고 새 대화를 시작할까요?')) return;
    if (window.makitChatbot && window.makitChatbot.resetContext) window.makitChatbot.resetContext();
    state.messages = [];
    renderEmpty();
    updateContextDisplay();
    toast('새 대화를 시작했습니다.', 'info');
  }

  function autoResize(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
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

    var ta = $('cbInput');
    var sendBtn = $('cbSendBtn');
    var newBtn = $('cbNewBtn');

    ta.addEventListener('input', function () { autoResize(ta); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    sendBtn.addEventListener('click', send);
    newBtn.addEventListener('click', newConversation);

    renderEmpty();
    updateContextDisplay();
    setTimeout(function () { ta.focus(); }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
