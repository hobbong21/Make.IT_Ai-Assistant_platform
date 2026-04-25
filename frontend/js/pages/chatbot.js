// Chatbot SSE streaming client.
// Exposes window.makitChatbot.streamInto(container, message) — consumed by
// service-detail.js when ?service=chatbot. Also usable standalone.
//
// Protocol (from architect spec):
//   Stream is text/event-stream. Each event chunk looks like:
//     event: delta
//     data: {"event":"delta","data":"token fragment"}
//
//   The server may also emit event: ping heartbeats (ignored) and event: done
//   to terminate. We parse the `data:` JSON of each event.
(function () {
  var activeContextId = null;

  // ---- 마크다운 → HTML (XSS 안전 minimal subset) ----
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function renderMarkdown(text) {
    if (!text) return '';
    // 1) escape (XSS 안전성 1순위)
    var html = escapeHtml(text);

    // 2) fenced code block ```...```
    html = html.replace(/```([\w-]*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      return '<pre class="mk-md-pre"><code>' + code.replace(/\n+$/, '') + '</code></pre>';
    });

    // 3) inline code `...`
    html = html.replace(/`([^`\n]+)`/g, '<code class="mk-md-code">$1</code>');

    // 4) bold **...** (먼저 처리)
    html = html.replace(/\*\*([^\*\n]+)\*\*/g, '<strong>$1</strong>');

    // 5) italic *...*
    html = html.replace(/(^|[^\*])\*([^\*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

    // 6) link [text](url) — url은 http(s) 또는 상대 경로만 허용
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="mk-md-link">$1</a>');

    // 7) 줄 시작 - 또는 * → <li>로 묶음
    html = html.replace(/(?:^|\n)((?:[-*] .+\n?)+)/g, function (m, block) {
      var items = block.trim().split(/\n/).map(function (l) {
        return '<li>' + l.replace(/^[-*]\s+/, '') + '</li>';
      }).join('');
      return '<ul class="mk-md-list">' + items + '</ul>';
    });

    // 8) 두 줄 이상 줄바꿈은 단락
    html = html.split(/\n{2,}/).map(function (p) {
      return p.indexOf('<ul') === 0 || p.indexOf('<pre') === 0 ? p : '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('');

    return html;
  }

  async function streamInto(container, message) {
    if (!container) return;
    var buffer = '';
    var textHolder = document.createElement('div');
    textHolder.className = 'mk-md-content';
    container.appendChild(textHolder);

    var resp;
    try {
      resp = await api.commerce.chatbotStream(message, { contextId: activeContextId });
    } catch (e) {
      textHolder.textContent = '서버와 연결할 수 없습니다.';
      return;
    }

    if (!resp.ok) {
      if (resp.status === 401) {
        auth.clearSession();
        location.href = 'login.html';
        return;
      }
      textHolder.textContent = '요청 실패 (' + resp.status + ')';
      return;
    }

    if (!resp.body || !resp.body.getReader) {
      // Fallback: non-streaming
      try {
        var sync = await api.commerce.chatbotMessage(message, { contextId: activeContextId });
        if (sync && sync.contextId) activeContextId = sync.contextId;
        textHolder.textContent = (sync && sync.reply) || '';
      } catch (e) {
        textHolder.textContent = e && e.message ? e.message : '요청 실패';
      }
      return;
    }

    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var accumulated = '';

    try {
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        var parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (var i = 0; i < parts.length; i++) {
          var block = parts[i];
          var eventName = '';
          var dataLine = '';
          var lines = block.split('\n');
          for (var j = 0; j < lines.length; j++) {
            var line = lines[j];
            if (line.indexOf('event:') === 0) eventName = line.slice(6).trim();
            else if (line.indexOf('data:') === 0) dataLine += line.slice(5).trim();
          }
          if (eventName === 'ping') continue;
          if (!dataLine) continue;

          var payload;
          try { payload = JSON.parse(dataLine); }
          catch (_) { payload = { event: eventName || 'delta', data: dataLine }; }

          var ev = payload.event || eventName || 'delta';
          if (ev === 'delta') {
            accumulated += (payload.data || '');
            // 스트리밍 중엔 raw 표시 (성능), done에서 마크다운 렌더
            textHolder.textContent = accumulated;
          } else if (ev === 'citation') {
            // Citations 메타데이터 — skip
          } else if (ev === 'done') {
            if (payload && payload.contextId) activeContextId = payload.contextId;
            // 스트리밍 완료 시 마크다운 → HTML 변환
            textHolder.innerHTML = renderMarkdown(accumulated);
            return;
          } else if (ev === 'error') {
            textHolder.textContent = (payload.data || '스트리밍 오류가 발생했습니다.');
            return;
          }
        }
        // Auto-scroll parent chat if present
        var wrap = document.getElementById('chat-messages');
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
      }
    } catch (e) {
      console.error('[chatbot] stream error', e);
      if (!accumulated) textHolder.textContent = '스트리밍 중 오류가 발생했습니다.';
    }
  }

  function resetContext() { activeContextId = null; }

  window.makitChatbot = {
    streamInto: streamInto,
    resetContext: resetContext,
    getContextId: function () { return activeContextId; }
  };
})();
