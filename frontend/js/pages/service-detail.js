// Service-detail page wiring.
// Reads ?service= from the URL and routes the 12 example-question buttons to
// the matching API method. UI (message bubbles, typing indicator, chart
// placeholder) is preserved from the existing HTML — we only swap the data
// source from simulateChat() to real API calls.

(function () {
  function getServiceKey() {
    var params = new URLSearchParams(location.search);
    return (params.get('service') || 'nlp-analyze').trim();
  }

  function chatMessagesEl() { return document.getElementById('chat-messages'); }
  function welcomeEl()       { return document.querySelector('.chat-welcome'); }

  function appendUserMessage(text) {
    var wrap = chatMessagesEl(); if (!wrap) return;
    var m = document.createElement('div');
    m.className = 'message user-message';
    m.innerHTML = '<div class="message-content"><p>' + ui.escapeHtml(text) + '</p></div>';
    wrap.appendChild(m);
    wrap.scrollTop = wrap.scrollHeight;
  }

  function appendLoading() {
    var wrap = chatMessagesEl(); if (!wrap) return null;
    var m = document.createElement('div');
    m.className = 'message bot-message loading';
    m.innerHTML =
      '<div class="message-avatar">' +
      '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '    <path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect>' +
      '    <path d="M2 14h2"></path><path d="M20 14h2"></path>' +
      '    <path d="M15 13v2"></path><path d="M9 13v2"></path>' +
      '  </svg>' +
      '</div>' +
      '<div class="message-content">' +
      '  <div class="typing-indicator"><span></span><span></span><span></span></div>' +
      '</div>';
    wrap.appendChild(m);
    wrap.scrollTop = wrap.scrollHeight;
    return m;
  }

  function botMessageShell() {
    var wrap = chatMessagesEl(); if (!wrap) return null;
    var m = document.createElement('div');
    m.className = 'message bot-message';
    m.innerHTML =
      '<div class="message-avatar">' +
      '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '    <path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect>' +
      '    <path d="M2 14h2"></path><path d="M20 14h2"></path>' +
      '    <path d="M15 13v2"></path><path d="M9 13v2"></path>' +
      '  </svg>' +
      '</div>' +
      '<div class="message-content"></div>';
    wrap.appendChild(m);
    wrap.scrollTop = wrap.scrollHeight;
    return m.querySelector('.message-content');
  }

  function hideWelcome() {
    var w = welcomeEl();
    if (w) w.style.display = 'none';
  }

  // --- Renderers per response shape -----------------------------------

  function renderNlp(content, data) {
    var sentiment = data.sentiment || {};
    var keywords = Array.isArray(data.keywords) ? data.keywords : [];
    var summary = data.summary || '';
    var html =
      '<p>' + ui.escapeHtml(summary || '분석을 완료했습니다.') + '</p>' +
      '<div class="analysis-result">' +
      '  <div class="chart-placeholder">' +
      '    📊 감정: <strong>' + ui.escapeHtml(sentiment.label || '—') + '</strong>' +
      (sentiment.score != null ? ' (' + Number(sentiment.score).toFixed(2) + ')' : '') +
      '  </div>' +
      (keywords.length
        ? '  <p class="result-summary">키워드: ' + keywords.map(ui.escapeHtml).join(', ') + '</p>'
        : '') +
      '</div>';
    content.innerHTML = html;
  }

  function renderYoutubeComments(content, data) {
    var dist = data.sentimentDistribution || {};
    var themes = Array.isArray(data.topThemes) ? data.topThemes : [];
    var html =
      '<p>총 ' + (data.totalAnalyzed || 0) + '개의 댓글을 분석했습니다.</p>' +
      '<div class="analysis-result">' +
      '  <div class="chart-placeholder">📊 긍정: ' + pct(dist.positive) +
      ' · 부정: ' + pct(dist.negative) + ' · 중립: ' + pct(dist.neutral) + '</div>' +
      (themes.length
        ? '  <p class="result-summary">주요 주제: ' +
          themes.slice(0, 5).map(function (t) {
            return ui.escapeHtml(t.theme) + '(' + t.count + ')';
          }).join(', ') + '</p>'
        : '') +
      '</div>';
    content.innerHTML = html;
  }

  function renderUrl(content, data) {
    var html =
      '<p>' + ui.escapeHtml(data.title || 'URL 분석 완료') + '</p>' +
      '<div class="analysis-result">' +
      '  <div class="chart-placeholder">📊 단어 수: ' + (data.wordCount || 0) +
      (data.language ? ' · 언어: ' + ui.escapeHtml(data.language) : '') + '</div>' +
      '  <p class="result-summary">' + ui.escapeHtml(data.summary || '') + '</p>' +
      '</div>';
    content.innerHTML = html;
  }

  function renderInfluence(content, data) {
    var m = data.metrics || {};
    var html =
      '<p>영향력 점수: <strong>' + (data.influenceScore != null ? data.influenceScore.toFixed(1) : '—') +
      '</strong> (' + ui.escapeHtml(data.tier || '—') + ')</p>' +
      '<div class="analysis-result">' +
      '  <div class="chart-placeholder">구독자: ' + (m.subscribers || 0) +
      ' · 평균 조회수: ' + (m.avgViews || 0) + '</div>' +
      '  <p class="result-summary">평균 참여율: ' + (m.avgEngagementRate != null ? (m.avgEngagementRate * 100).toFixed(2) + '%' : '—') + '</p>' +
      '</div>';
    content.innerHTML = html;
  }

  function renderKeywordSearch(content, data) {
    var channels = Array.isArray(data.channels) ? data.channels : [];
    var html =
      '<p>' + channels.length + '개의 채널을 찾았습니다.</p>' +
      '<div class="analysis-result"><div class="chart-placeholder">' +
      channels.slice(0, 5).map(function (c) {
        return '🔹 ' + ui.escapeHtml(c.title) + ' (구독자 ' + (c.subscriberCount || 0) + ')';
      }).join('<br>') +
      '</div></div>';
    content.innerHTML = html;
  }

  function renderReviews(content, data) {
    var overall = data.overallSentiment || {};
    var themes = Array.isArray(data.themes) ? data.themes : [];
    var improvements = Array.isArray(data.improvementPoints) ? data.improvementPoints : [];
    var html =
      '<p>리뷰 ' + (data.reviewCount || 0) + '건 분석 완료 · 전반적 감정: ' + ui.escapeHtml(overall.label || '—') + '</p>' +
      '<div class="analysis-result">' +
      '  <div class="chart-placeholder">주요 주제: ' +
      themes.slice(0, 5).map(function (t) {
        return ui.escapeHtml(t.theme) + '(' + t.frequency + ')';
      }).join(', ') + '</div>' +
      (improvements.length
        ? '  <p class="result-summary">개선 포인트: ' + improvements.map(ui.escapeHtml).join(' / ') + '</p>'
        : '') +
      '</div>';
    content.innerHTML = html;
  }

  function renderFeed(content, data) {
    var hashtags = Array.isArray(data.hashtags) ? data.hashtags : [];
    var html =
      '<p>' + ui.escapeHtml(data.caption || '피드 생성 완료') + '</p>' +
      (hashtags.length
        ? '<div class="analysis-result"><p class="result-summary">' +
          hashtags.map(function (h) { return ui.escapeHtml(h.charAt(0) === '#' ? h : '#' + h); }).join(' ') +
          '</p></div>'
        : '');
    content.innerHTML = html;
  }

  function pct(v) {
    if (v == null) return '—';
    return (Number(v) * 100).toFixed(0) + '%';
  }

  // --- Service dispatcher ---------------------------------------------

  async function runService(serviceKey, question, content, loadingNode) {
    try {
      var res;
      switch (serviceKey) {
        case 'nlp-analyze':
          res = await api.data.nlpAnalyze(question);
          if (loadingNode) loadingNode.remove();
          renderNlp(content, res);
          break;

        case 'youtube-comments':
          // Question is a video URL in a real flow; for demo we use the question as-is.
          res = await api.data.youtubeComments(question);
          if (loadingNode) loadingNode.remove();
          renderYoutubeComments(content, res);
          break;

        case 'youtube-influence':
          res = await api.data.youtubeInfluence(question, 30);
          if (loadingNode) loadingNode.remove();
          renderInfluence(content, res);
          break;

        case 'youtube-keyword-search':
          res = await api.data.youtubeKeywordSearch([question]);
          if (loadingNode) loadingNode.remove();
          renderKeywordSearch(content, res);
          break;

        case 'url-analyze':
          res = await api.data.urlAnalyze(question);
          if (loadingNode) loadingNode.remove();
          renderUrl(content, res);
          break;

        case 'feed-generate':
          res = await api.marketing.generateFeed({ brief: question, includeImage: false });
          if (loadingNode) loadingNode.remove();
          renderFeed(content, res);
          break;

        case 'review-analysis':
          // The "question" is treated as a productId for demo purposes.
          res = await api.commerce.analyzeReviews(question);
          if (loadingNode) loadingNode.remove();
          renderReviews(content, res);
          break;

        case 'chatbot':
          // Delegate to the chatbot streaming helper for token-by-token UI.
          if (loadingNode) loadingNode.remove();
          await window.makitChatbot.streamInto(content, question);
          break;

        case 'remove-bg':
        case 'modelshot':
          if (loadingNode) loadingNode.remove();
          content.innerHTML =
            '<p>이 서비스는 이미지 업로드 UI가 필요합니다. 데모에서는 지원되지 않습니다.</p>';
          break;

        default:
          // Fallback: use NLP analyze so the button remains responsive.
          res = await api.data.nlpAnalyze(question);
          if (loadingNode) loadingNode.remove();
          renderNlp(content, res);
      }
    } catch (err) {
      if (loadingNode) loadingNode.remove();
      console.error('[service-detail] ' + serviceKey, err);
      content.innerHTML =
        '<p>요청 처리 중 오류가 발생했습니다.</p>' +
        '<div class="analysis-result"><p class="result-summary">' +
        ui.escapeHtml(err && err.message ? err.message : '알 수 없는 오류') + '</p></div>';
      ui.toast(err && err.message ? err.message : '요청 실패', 'error');
    }
  }

  // --- Init -----------------------------------------------------------

  function init() {
    if (!auth.requireLogin()) return;

    var serviceKey = getServiceKey();

    // Sidebar dropdown toggles
    document.querySelectorAll('.nav-dropdown-header').forEach(function (h) {
      h.addEventListener('click', function () {
        if (h.parentElement) h.parentElement.classList.toggle('expanded');
      });
    });

    // Wire example-question buttons
    document.querySelectorAll('.question-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var q = btn.dataset.question || btn.textContent.trim();
        hideWelcome();
        appendUserMessage(q);
        var loadingNode = appendLoading();
        var contentShell = botMessageShell();
        if (!contentShell) return;
        // Remove shell-supplied empty content; we'll fill it in runService.
        runService(serviceKey, q, contentShell, loadingNode);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
