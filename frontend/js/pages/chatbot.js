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

  async function streamInto(container, message) {
    if (!container) return;
    var buffer = '';
    var textHolder = document.createElement('p');
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
            textHolder.textContent = accumulated;
          } else if (ev === 'citation') {
            // Citations are optional metadata; skip rendering for brevity.
          } else if (ev === 'done') {
            if (payload && payload.contextId) activeContextId = payload.contextId;
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
