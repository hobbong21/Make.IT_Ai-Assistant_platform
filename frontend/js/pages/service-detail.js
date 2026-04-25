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

  // 새 HTML v2: #chatMessages (camelCase) — 구 v1: #chat-messages (kebab) — 둘 다 호환
  function chatMessagesEl() {
    return document.getElementById('chatMessages') || document.getElementById('chat-messages');
  }
  function welcomeEl() { return document.querySelector('.chat-welcome'); }
  function chatInputContainerEl() {
    // 새 HTML은 chat-input-container 안에 form을 mount, 구 HTML은 chat-area에 직접 append
    return document.getElementById('chatInputContainer') || document.querySelector('.chat-area');
  }

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

  function renderRemoveBg(content, data) {
    // backend 응답 추정: { downloadUrl, contentType, sizeBytes } 또는 { resultUrl, jobId }
    var url = data.downloadUrl || data.resultUrl || data.url || '';
    var jobId = data.jobId || '';
    var html = '<p>배경 제거 처리 완료.</p>';
    if (url) {
      html +=
        '<div class="analysis-result">' +
        '  <img src="' + ui.escapeHtml(url) + '" alt="배경 제거된 이미지" ' +
        '       style="max-width:100%;border-radius:var(--mk-radius-md,10px);background:var(--mk-color-bg-muted,#f2f2f2);background-image:linear-gradient(45deg,#e6e6e6 25%,transparent 25%),linear-gradient(-45deg,#e6e6e6 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e6e6e6 75%),linear-gradient(-45deg,transparent 75%,#e6e6e6 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0px;">' +
        '  <p class="result-summary"><a href="' + ui.escapeHtml(url) + '" download>다운로드</a></p>' +
        '</div>';
    } else if (jobId) {
      html +=
        '<div class="analysis-result"><p class="result-summary">작업 ID: <code>' +
        ui.escapeHtml(jobId) + '</code> — 결과는 곧 준비됩니다.</p></div>';
    } else {
      html +=
        '<div class="analysis-result"><p class="result-summary">' +
        ui.escapeHtml(JSON.stringify(data).slice(0, 400)) + '</p></div>';
    }
    content.innerHTML = html;
  }

  function renderModelshot(content, data) {
    // backend 응답 추정: { jobId, statusUrl, status } 비동기 작업
    var jobId = data.jobId || data.id || '';
    var status = data.status || 'PENDING';
    var html =
      '<p>모델컷 생성 작업이 시작되었습니다.</p>' +
      '<div class="analysis-result">' +
      '  <p class="result-summary"><strong>작업 ID:</strong> <code>' + ui.escapeHtml(jobId || '—') + '</code></p>' +
      '  <p class="result-summary"><strong>상태:</strong> ' + ui.escapeHtml(status) + '</p>' +
      '</div>';
    content.innerHTML = html;
    // 비동기 폴링 (api.jobs.poll 사용 가능 시)
    if (jobId && api.jobs && api.jobs.poll) {
      api.jobs.poll('commerce', jobId, {
        onUpdate: function (s) {
          var statusEl = content.querySelectorAll('.result-summary')[1];
          if (statusEl) statusEl.innerHTML = '<strong>상태:</strong> ' + ui.escapeHtml(s.status || 'RUNNING');
        }
      }).then(function (final) {
        var resultUrl = final.resultUrl || final.downloadUrl || (final.result && final.result.url);
        if (resultUrl) {
          content.innerHTML +=
            '<div class="analysis-result">' +
            '  <img src="' + ui.escapeHtml(resultUrl) + '" alt="생성된 모델컷" ' +
            '       style="max-width:100%;border-radius:var(--mk-radius-md,10px);">' +
            '</div>';
        }
      }).catch(function (err) {
        ui.toast('모델컷 생성 실패: ' + (err.message || ''), 'error');
      });
    }
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
          // question is { file, extra, label } from file form
          if (!question || !question.file) {
            if (loadingNode) loadingNode.remove();
            content.innerHTML = '<p>파일이 첨부되지 않았습니다.</p>';
            break;
          }
          res = await api.marketing.removeBackground(question.file, question.extra || 'PNG');
          if (loadingNode) loadingNode.remove();
          renderRemoveBg(content, res);
          break;

        case 'modelshot':
          // question is JSON string or natural-language description
          var payload;
          try {
            payload = JSON.parse(question);
          } catch (_) {
            payload = { description: question };
          }
          res = await api.commerce.generateModelshot(payload);
          if (loadingNode) loadingNode.remove();
          renderModelshot(content, res);
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

  // --- Service metadata (10 services) ---------------------------------
  // 각 서비스 키별로 페이지 hero / welcome / 입력 placeholder / 예시 질문을 정의.
  // service-detail.html은 골격만 유지하고, init()에서 이 메타데이터로 DOM을 동적 갱신한다.

  var SERVICE_META = {
    'nlp-analyze': {
      title: '자연어 분석',
      subtitle: '비데이터 직군도 쉽게 분석하도록',
      description: '비정형 텍스트에서 감정·주제·키워드를 추출합니다. 분석할 텍스트를 입력하거나 아래 예시 질문을 선택해보세요.',
      welcome: '자연어로 데이터를 분석해보세요',
      welcomeDesc: '아래 예시 질문 또는 자유 입력으로 텍스트 분석 결과를 확인할 수 있습니다.',
      inputType: 'textarea',
      inputPlaceholder: '분석할 텍스트나 질문을 입력하세요 (예: "최근 1주일간 매출 추이를 알려줘")',
      examples: [
        '최근 1주일간 매출 추이를 알려줘',
        '가장 많이 팔린 상품 카테고리 TOP 5는?',
        '고객 연령대별 구매 패턴을 분석해줘',
        '온라인과 오프라인 매장의 매출 비교',
        '베스트셀러 제품의 월별 판매 추이는?',
        '고객 만족도가 가장 높은 제품은?',
        '마케팅 채널별 ROI 분석해줘',
        '신규 고객과 재구매 고객의 구매 패턴 비교해줘'
      ]
    },
    'youtube-comments': {
      title: '유튜브 댓글 분석',
      subtitle: '영상 댓글에서 청중의 진짜 목소리를',
      description: '유튜브 영상 URL을 입력하면 댓글을 수집·분석하여 감정과 핵심 주제를 추출합니다.',
      welcome: '유튜브 영상 URL을 입력하세요',
      welcomeDesc: '분석할 영상의 URL을 입력하거나 아래 예시 질문을 선택하세요.',
      inputType: 'text',
      inputPlaceholder: 'https://www.youtube.com/watch?v=...',
      examples: [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        '이 영상 댓글에서 가장 많이 언급된 키워드는?',
        '시청자 반응의 전반적 감정은 어땠나요?'
      ]
    },
    'youtube-influence': {
      title: '유튜브 영향력 분석',
      subtitle: '채널의 영향력을 정량 평가',
      description: '채널 URL이나 핸들을 입력하면 구독자/조회수/참여도 기반 영향력 지수를 산출합니다.',
      welcome: '유튜브 채널 URL 또는 핸들을 입력하세요',
      welcomeDesc: '@channel 또는 youtube.com/c/channel 형식으로 입력하세요.',
      inputType: 'text',
      inputPlaceholder: '@channelhandle 또는 https://youtube.com/c/...',
      examples: ['@MrBeast', '@ChannelKorea', 'https://youtube.com/@example']
    },
    'url-analyze': {
      title: '웹사이트 URL 분석',
      subtitle: '웹페이지에서 인사이트 추출',
      description: '웹페이지 URL을 입력하면 본문을 수집·분석하여 요약·주제·키워드를 추출합니다.',
      welcome: '분석할 웹사이트 URL을 입력하세요',
      welcomeDesc: 'http(s)://로 시작하는 URL을 입력하거나 예시를 선택하세요.',
      inputType: 'text',
      inputPlaceholder: 'https://example.com/article',
      examples: [
        'https://www.anthropic.com/news/claude-design-anthropic-labs',
        'https://en.wikipedia.org/wiki/Marketing'
      ]
    },
    'youtube-keyword-search': {
      title: '유튜브 키워드 채널 검색',
      subtitle: '관심 키워드로 채널 발굴',
      description: '쉼표로 구분된 키워드를 입력하면 관련 채널을 검색하여 영향력 순으로 반환합니다.',
      welcome: '검색할 키워드를 입력하세요',
      welcomeDesc: '쉼표(,)로 여러 키워드를 구분할 수 있습니다.',
      inputType: 'text',
      inputPlaceholder: '예: 마케팅, AI, 데이터 분석',
      examples: ['마케팅, AI', '쇼핑몰, 광고', '브랜드, 콘텐츠']
    },
    'feed-generate': {
      title: '인스타그램 피드 생성',
      subtitle: 'AI가 브리프를 시각으로',
      description: '브랜드/톤/타깃 등의 브리프를 입력하면 AI가 인스타그램 피드용 콘텐츠 초안을 생성합니다.',
      welcome: '브리프를 입력해주세요',
      welcomeDesc: '브랜드, 톤, 타깃, 메시지를 자유롭게 기술하면 AI가 피드 초안을 만듭니다.',
      inputType: 'textarea',
      inputPlaceholder: '예: 20대 여성 타깃 친환경 화장품 브랜드, 따뜻하고 자연스러운 톤, 재구매 유도 메시지',
      examples: [
        '여름 신상 운동화 런칭, 활기찬 톤, 10-20대 타깃',
        '커피 원두 정기구독 서비스, 차분한 톤, 30-40대 직장인 타깃'
      ]
    },
    'remove-bg': {
      title: '배경 제거',
      subtitle: '이미지에서 피사체만 깔끔하게',
      description: '상품 이미지의 배경을 자동으로 제거합니다. PNG/JPG 이미지를 업로드하세요.',
      welcome: '이미지를 업로드해주세요',
      welcomeDesc: '아래 영역에서 PNG/JPG 파일을 선택하고 출력 형식(투명 PNG / 흰 배경 JPG)을 고른 후 전송하세요.',
      inputType: 'file',
      fileAccept: 'image/*',
      fileExtraField: { name: 'outputFormat', type: 'select', label: '출력 형식', options: [{ value: 'PNG', label: 'PNG (투명 배경)' }, { value: 'JPG', label: 'JPG (흰 배경)' }] },
      examples: []
    },
    'chatbot': {
      title: '고객 응대 AI 챗봇',
      subtitle: 'RAG 기반 24/7 고객 응대',
      description: '제품/FAQ에 대해 자유롭게 질문하면 AI가 실시간 스트리밍으로 답변합니다.',
      welcome: '무엇이든 물어보세요',
      welcomeDesc: 'AI 챗봇이 실시간으로 답변합니다. 자유롭게 입력하거나 예시를 선택하세요.',
      inputType: 'text',
      inputPlaceholder: '메시지를 입력하세요...',
      examples: [
        '환불 정책이 어떻게 되나요?',
        '배송은 며칠이나 걸리나요?',
        '제품 사용 후기를 추천해주세요',
        '가장 인기 있는 상품은 무엇인가요?'
      ]
    },
    'review-analysis': {
      title: '상품 리뷰 분석',
      subtitle: '리뷰에서 개선 인사이트 추출',
      description: '상품 ID를 입력하면 누적된 리뷰를 AI가 분석하여 강점·약점·개선 제안을 제공합니다.',
      welcome: '분석할 상품 ID를 입력하세요',
      welcomeDesc: '상품 식별자(ID)를 입력하면 누적 리뷰를 자동 분석합니다.',
      inputType: 'text',
      inputPlaceholder: 'product-001',
      examples: ['product-001', 'product-042', 'product-123']
    },
    'modelshot': {
      title: '이미지 + 모델컷 생성',
      subtitle: '상품 이미지에 모델을 합성',
      description: '상품과 모델 정보를 JSON 또는 자연어로 입력하면 AI가 모델컷을 생성하는 비동기 작업을 시작합니다.',
      welcome: '모델컷 요청을 입력하세요',
      welcomeDesc: 'JSON으로 입력하면 그대로 전달되고, 자연어로 입력하면 description 필드로 wrapping됩니다.',
      inputType: 'textarea',
      inputPlaceholder: '예: {"productImageUrl":"https://...", "modelGender":"female", "background":"studio-white", "pose":"standing"}\n또는 자연어: "20대 여성 모델, 흰색 배경, 정면 포즈로 운동화 사진"',
      examples: [
        '{"productImageUrl":"https://example.com/shoe.jpg","modelGender":"female","background":"studio-white","pose":"standing"}',
        '20대 여성 모델, 흰색 배경, 정면 포즈로 운동화 사진'
      ]
    }
  };

  function getMeta(key) {
    return SERVICE_META[key] || SERVICE_META['nlp-analyze'];
  }

  // --- DOM dynamic update ---------------------------------------------

  function applyMetaToDom(meta) {
    // ID 우선 (새 HTML v2), class fallback (구 v1)
    var titleEl = document.getElementById('serviceTitle') || document.querySelector('.service-title');
    var subEl = document.getElementById('serviceSubtitle') || document.querySelector('.service-subtitle');
    var descEl = document.getElementById('serviceDescription') || document.querySelector('.service-description');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;
    if (descEl) descEl.textContent = meta.description;

    var welcomeTitle = document.getElementById('welcomeTitle') || document.querySelector('.chat-welcome h3');
    var welcomeDesc = document.getElementById('welcomeMessage') || document.querySelector('.chat-welcome p');
    if (welcomeTitle) welcomeTitle.textContent = meta.welcome;
    if (welcomeDesc) welcomeDesc.textContent = meta.welcomeDesc;

    // 예시 질문 — ID 우선 fallback class
    var grid = document.getElementById('questionsGrid') || document.querySelector('.questions-grid');
    if (grid) {
      grid.innerHTML = '';
      (meta.examples || []).forEach(function (q, i) {
        var btn = document.createElement('button');
        btn.className = 'question-btn';
        btn.dataset.question = q;
        btn.innerHTML =
          '<span class="question-number">' + (i + 1) + '</span>' +
          '<span class="question-text">' + ui.escapeHtml(q) + '</span>';
        grid.appendChild(btn);
      });
      // 예시가 없으면 섹션 자체 숨김
      var examplesSection = document.querySelector('.example-questions');
      if (examplesSection) examplesSection.style.display = (meta.examples && meta.examples.length) ? '' : 'none';
    }

    // page title (브라우저 탭)
    document.title = 'MaKIT - ' + meta.title + ' | Human.Ai.D';
  }

  // --- 자유 입력 form ------------------------------------------------

  function buildInputForm(meta, serviceKey) {
    var existing = document.querySelector('.chat-input-form');
    if (existing) existing.remove();

    if (meta.inputType === 'disabled') return;

    var form = document.createElement('form');
    form.className = 'chat-input-form';
    form.setAttribute('aria-label', meta.title + ' 입력 폼');
    form.noValidate = true;

    if (meta.inputType === 'file') {
      // 파일 업로드 form (remove-bg)
      form.classList.add('chat-input-form-file');
      var extra = meta.fileExtraField;
      var extraHtml = '';
      if (extra && extra.type === 'select') {
        extraHtml =
          '<label class="chat-extra-label">' + ui.escapeHtml(extra.label || extra.name) + ':' +
          '  <select class="chat-extra-select" name="' + extra.name + '">' +
          (extra.options || []).map(function (o) {
            return '<option value="' + ui.escapeHtml(o.value) + '">' + ui.escapeHtml(o.label) + '</option>';
          }).join('') +
          '  </select>' +
          '</label>';
      }
      form.innerHTML =
        '<label class="chat-file-input">' +
        '  <input type="file" name="file" accept="' + ui.escapeHtml(meta.fileAccept || 'image/*') + '" required>' +
        '  <span class="chat-file-cta">파일 선택</span>' +
        '  <span class="chat-file-name" data-empty="선택된 파일 없음">선택된 파일 없음</span>' +
        '</label>' +
        extraHtml +
        '<button class="chat-send-btn" type="submit" aria-label="전송">' +
        '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '    <path d="M22 2L11 13"></path><path d="M22 2L15 22 11 13 2 9 22 2z"></path>' +
        '  </svg>' +
        '</button>';

      var chatArea = chatInputContainerEl();
      if (chatArea) chatArea.appendChild(form);

      var fileInput = form.querySelector('input[type="file"]');
      var fileNameEl = form.querySelector('.chat-file-name');
      if (fileInput && fileNameEl) {
        fileInput.addEventListener('change', function () {
          fileNameEl.textContent = (fileInput.files && fileInput.files[0]) ? fileInput.files[0].name : '선택된 파일 없음';
        });
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
          if (fileInput) fileInput.focus();
          ui.toast('파일을 선택해주세요.', 'warn');
          return;
        }
        var file = fileInput.files[0];
        var extraVal = null;
        if (extra && extra.type === 'select') {
          var selectEl = form.querySelector('.chat-extra-select');
          extraVal = selectEl ? selectEl.value : null;
        }
        sendQuestion(serviceKey, { file: file, extra: extraVal, label: file.name + (extraVal ? ' (' + extraVal + ')' : '') });
        // form 리셋
        fileInput.value = '';
        if (fileNameEl) fileNameEl.textContent = '선택된 파일 없음';
      });
      return;
    }

    // text / textarea form
    var inputHtml;
    if (meta.inputType === 'textarea') {
      inputHtml =
        '<textarea class="chat-input" name="q" rows="2" maxlength="4000" required ' +
        'placeholder="' + ui.escapeHtml(meta.inputPlaceholder || '') + '"></textarea>';
    } else {
      inputHtml =
        '<input class="chat-input" name="q" type="text" maxlength="2000" required ' +
        'placeholder="' + ui.escapeHtml(meta.inputPlaceholder || '') + '">';
    }

    form.innerHTML =
      '<label class="mk-sr-only" for="chat-input-field">' + ui.escapeHtml(meta.title) + ' 질문</label>' +
      inputHtml +
      '<button class="chat-send-btn" type="submit" aria-label="전송">' +
      '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '    <path d="M22 2L11 13"></path><path d="M22 2L15 22 11 13 2 9 22 2z"></path>' +
      '  </svg>' +
      '</button>';

    var chatArea = document.querySelector('.chat-area');
    if (chatArea) chatArea.appendChild(form);

    var fieldEl = form.querySelector('.chat-input');
    if (fieldEl) fieldEl.id = 'chat-input-field';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = (fieldEl && fieldEl.value || '').trim();
      if (!q) { if (fieldEl) fieldEl.focus(); return; }
      sendQuestion(serviceKey, q);
      if (fieldEl) fieldEl.value = '';
    });

    if (meta.inputType === 'textarea' && fieldEl) {
      fieldEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          form.requestSubmit();
        }
      });
    }
  }

  function sendQuestion(serviceKey, payload) {
    hideWelcome();
    // payload는 string 또는 { file, extra, label } 객체
    var displayLabel = (typeof payload === 'string') ? payload : (payload && payload.label) || '[파일 전송]';
    appendUserMessage(displayLabel);
    var loadingNode = appendLoading();
    var contentShell = botMessageShell();
    if (!contentShell) return;
    runService(serviceKey, payload, contentShell, loadingNode);
  }

  // --- Init -----------------------------------------------------------

  function init() {
    if (!auth.requireLogin()) return;

    var serviceKey = getServiceKey();
    var meta = getMeta(serviceKey);

    // 1. 메타데이터를 DOM에 적용 (title / subtitle / description / welcome / 예시 질문)
    applyMetaToDom(meta);

    // 2. Sidebar dropdown toggles
    document.querySelectorAll('.nav-dropdown-header').forEach(function (h) {
      h.addEventListener('click', function () {
        if (h.parentElement) h.parentElement.classList.toggle('expanded');
      });
    });

    // 3. 동적으로 다시 만들어진 예시 질문 버튼에 click 핸들러
    document.querySelectorAll('.question-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var q = btn.dataset.question || btn.textContent.trim();
        sendQuestion(serviceKey, q);
      });
    });

    // 4. 자유 입력 form
    buildInputForm(meta, serviceKey);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
