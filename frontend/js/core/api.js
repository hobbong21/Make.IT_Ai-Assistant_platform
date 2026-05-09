// MaKIT API client — thin fetch wrapper with JWT injection and 401 redirect.
// Depends on: window.MAKIT_CONFIG (config.js)

(function () {
  var CONFIG = window.MAKIT_CONFIG || { apiBase: '/api', storageKeys: { token: 'makit_token', refresh: 'makit_refresh', user: 'makit_user' } };
  var API_BASE = CONFIG.apiBase;
  var KEYS = CONFIG.storageKeys;

  class ApiError extends Error {
    constructor(status, code, message, details) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details || {};
    }
  }

  function readToken() {
    if (window.auth && typeof auth.getToken === 'function') return auth.getToken();
    // fallback: auth.js 로드 전이면 양쪽 스토어를 직접 확인
    return sessionStorage.getItem(KEYS.token) || localStorage.getItem(KEYS.token);
  }
  function clearStoredSession() {
    if (window.auth && typeof auth.clearSession === 'function') { auth.clearSession(); return; }
    ['token', 'refresh', 'user'].forEach(function (k) {
      sessionStorage.removeItem(KEYS[k]);
      localStorage.removeItem(KEYS[k]);
    });
  }

  function buildHeaders(extra) {
    var token = readToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (extra) Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
    return headers;
  }

  async function request(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var body = opts.body;
    var headers = buildHeaders(opts.headers);
    var signal = opts.signal;
    var isForm = opts.form === true;

    if (isForm && headers['Content-Type']) delete headers['Content-Type']; // let browser set multipart boundary

    var resp;
    try {
      resp = await fetch(API_BASE + path, {
        method: method,
        headers: headers,
        body: isForm ? body : (body ? JSON.stringify(body) : undefined),
        signal: signal
      });
    } catch (networkErr) {
      throw new ApiError(0, 'NETWORK_ERROR', '서버와 연결할 수 없습니다. 잠시 후 다시 시도하세요.', { cause: String(networkErr) });
    }

    // 401 handling: clear session and redirect to login.
    // /auth/login, /auth/register는 사용자가 직접 인증 시도 중이므로 redirect 제외 (페이지 내 에러 메시지로 처리).
    if (resp.status === 401) {
      var isAuthAttempt = path === '/auth/login' || path === '/auth/register';
      if (!isAuthAttempt) {
        clearStoredSession();
        if (!/login\.html$/.test(location.pathname)) {
          location.href = 'login.html';
        }
      }
      // 응답 body에서 에러 메시지/코드 추출 (login.js가 INVALID_CREDENTIALS 등 활용)
      var errData = null;
      try { errData = await resp.json(); } catch (_) { errData = null; }
      var errCode = (errData && errData.errorCode) || 'UNAUTHORIZED';
      var errMsg = (errData && errData.message) || '로그인이 필요합니다';
      throw new ApiError(401, errCode, errMsg, errData || {});
    }

    if (resp.status === 204) return null;

    var data = null;
    var ct = resp.headers.get('content-type') || '';
    if (ct.indexOf('application/json') !== -1) {
      try { data = await resp.json(); } catch (_) { data = {}; }
    } else {
      try { data = await resp.text(); } catch (_) { data = ''; }
    }

    if (!resp.ok) {
      var code = (data && data.errorCode) || 'HTTP_' + resp.status;
      var msg = (data && data.message) || ('요청 실패 (' + resp.status + ')');
      throw new ApiError(resp.status, code, msg, data || {});
    }
    return data;
  }

  function rawFetch(path, opts) {
    opts = opts || {};
    var headers = buildHeaders(opts.headers);
    return fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal
    });
  }

  window.ApiError = ApiError;
  window.api = {
    _raw: rawFetch,
    _request: request,

    auth: {
      login: function (email, password) {
        return request('/auth/login', { method: 'POST', body: { email: email, password: password } });
      },
      register: function (payload) {
        return request('/auth/register', { method: 'POST', body: payload });
      },
      me: function () {
        return request('/auth/me');
      },
      logout: function () {
        return request('/auth/logout', { method: 'POST' });
      },
      refresh: function (refreshToken) {
        return request('/auth/refresh', { method: 'POST', body: { refreshToken: refreshToken } });
      },
      // PATCH /api/auth/me — name/email 갱신
      updateProfile: function (payload) {
        return request('/auth/me', { method: 'PATCH', body: payload });
      },
      // POST /api/auth/change-password — oldPassword/newPassword
      changePassword: function (payload) {
        return request('/auth/change-password', { method: 'POST', body: payload });
      }
    },

    notifications: {
      // GET /api/notifications/me?page=&size=
      list: function (opts) {
        opts = opts || {};
        return request('/notifications/me?page=' + (opts.page || 0) + '&size=' + (opts.size || 20));
      },
      unreadCount: function () { return request('/notifications/me/unread-count'); },
      readAll: function () { return request('/notifications/me/read-all', { method: 'POST' }); },
      read: function (id) { return request('/notifications/' + id + '/read', { method: 'POST' }); },
      // Web Push (VAPID) — R14c
      pushVapidKey: function () { return request('/notifications/push/vapid-key'); },
      pushSubscribe: function (subscription) { return request('/notifications/push/subscribe', { method: 'POST', body: subscription }); },
      pushUnsubscribe: function (endpoint) { return request('/notifications/push/unsubscribe?endpoint=' + encodeURIComponent(endpoint), { method: 'DELETE' }); }
    },

    data: {
      nlpAnalyze: function (text, opts) {
        var body = { text: text };
        if (opts && opts.tasks) body.tasks = opts.tasks;
        if (opts && opts.language) body.language = opts.language;
        if (opts && opts.maxKeywords != null) body.maxKeywords = opts.maxKeywords;
        if (opts && opts.summaryLength) body.summaryLength = opts.summaryLength;
        return request('/data/nlp/analyze', { method: 'POST', body: body });
      },
      youtubeComments: function (videoUrl, opts) {
        var body = { videoUrl: videoUrl };
        if (opts && opts.maxComments != null) body.maxComments = opts.maxComments;
        if (opts && opts.async != null) body.async = opts.async;
        return request('/data/youtube/comments', { method: 'POST', body: body });
      },
      youtubeInfluence: function (channelId, windowDays) {
        return request('/data/youtube/influence', {
          method: 'POST',
          body: { channelId: channelId, windowDays: windowDays != null ? windowDays : 30 }
        });
      },
      youtubeKeywordSearch: function (keywords, opts) {
        var body = { keywords: keywords };
        if (opts && opts.regionCode) body.regionCode = opts.regionCode;
        if (opts && opts.maxResults != null) body.maxResults = opts.maxResults;
        return request('/data/youtube/keyword-search', { method: 'POST', body: body });
      },
      urlAnalyze: function (url, extractMode) {
        return request('/data/url/analyze', {
          method: 'POST',
          body: { url: url, extractMode: extractMode || 'READER' }
        });
      }
    },

    marketing: {
      generateFeed: function (brief) {
        return request('/marketing/feed/generate', { method: 'POST', body: brief });
      },
      removeBackground: function (file, outputFormat) {
        var fd = new FormData();
        fd.append('file', file);
        if (outputFormat) fd.append('outputFormat', outputFormat);
        return request('/marketing/image/remove-bg', { method: 'POST', body: fd, form: true });
      },
      // 마케팅 허브 API
      hub: function () {
        return request('/marketing/hub');
      },
      campaigns: function (status) {
        var path = '/marketing/campaigns';
        if (status) path += '?status=' + encodeURIComponent(status);
        return request(path);
      },
      // 캠페인 CRUD (R7)
      campaignGet: function (id) {
        return request('/marketing/campaigns/' + encodeURIComponent(id));
      },
      campaignCreate: function (payload) {
        return request('/marketing/campaigns', { method: 'POST', body: payload });
      },
      campaignUpdate: function (id, payload) {
        return request('/marketing/campaigns/' + encodeURIComponent(id), { method: 'PATCH', body: payload });
      },
      campaignChangeStatus: function (id, status) {
        return request('/marketing/campaigns/' + encodeURIComponent(id) + '/status', { method: 'POST', body: { status: status } });
      },
      campaignDelete: function (id) {
        return request('/marketing/campaigns/' + encodeURIComponent(id), { method: 'DELETE' });
      },
      contents: function (limit) {
        var path = '/marketing/contents';
        if (limit) path += '?limit=' + limit;
        return request(path);
      },
      // 콘텐츠 CRUD (R8)
      contentGet: function (id) {
        return request('/marketing/contents/' + encodeURIComponent(id));
      },
      contentCreate: function (payload) {
        return request('/marketing/contents', { method: 'POST', body: payload });
      },
      contentUpdate: function (id, payload) {
        return request('/marketing/contents/' + encodeURIComponent(id), { method: 'PATCH', body: payload });
      },
      contentDelete: function (id) {
        return request('/marketing/contents/' + encodeURIComponent(id), { method: 'DELETE' });
      },
      calendar: function () {
        return request('/marketing/calendar/week');
      },
      insightsWeekly: function () {
        return request('/marketing/insights/weekly');
      },
      channelPerformance: function (days) {
        var path = '/marketing/channels/performance';
        if (days) path += '?days=' + days;
        return request(path);
      }
    },

    commerce: {
      chatbotMessage: function (message, opts) {
        var body = { message: message };
        if (opts && opts.contextId) body.contextId = opts.contextId;
        if (opts && opts.useRag != null) body.useRag = opts.useRag;
        if (opts && opts.temperature != null) body.temperature = opts.temperature;
        return request('/commerce/chatbot/message', { method: 'POST', body: body });
      },
      // Returns the raw Response for SSE consumption via reader.
      chatbotStream: function (message, opts) {
        var body = { message: message };
        if (opts && opts.contextId) body.contextId = opts.contextId;
        if (opts && opts.useRag != null) body.useRag = opts.useRag;
        if (opts && opts.temperature != null) body.temperature = opts.temperature;
        return rawFetch('/commerce/chatbot/stream', { method: 'POST', body: body });
      },
      analyzeReviews: function (productId, opts) {
        return request('/commerce/reviews/' + encodeURIComponent(productId) + '/analyze', {
          method: 'POST',
          body: opts || {}
        });
      },
      generateModelshot: function (payload) {
        return request('/commerce/modelshot/generate', { method: 'POST', body: payload });
      },
      // POST /api/commerce/chatbot/feedback {contextId, messageIdx, helpful, comment}
      chatbotFeedback: function (payload) {
        return request('/commerce/chatbot/feedback', { method: 'POST', body: payload });
      }
    },

    dashboard: {
      // GET /api/dashboard/stats — userCount, myRequestCount, myJobsInProgress, topServices[], lastLoginAt
      stats: function () {
        return request('/dashboard/stats');
      },
      // GET /api/dashboard/activity?days=N — List<ActivityBucket{date, count}>
      activity: function (days) {
        return request('/dashboard/activity?days=' + (days || 7));
      }
    },

    audit: {
      // GET /api/audit-logs/me?page=&size= — Page<AuditLogDto>
      mine: function (opts) {
        opts = opts || {};
        var qs = '?page=' + (opts.page || 0) + '&size=' + (opts.size || 20);
        return request('/audit-logs/me' + qs);
      }
    },

    notifications: {
      list: function (opts) {
        opts = opts || {};
        var qs = '?page=' + (opts.page || 0) + '&size=' + (opts.size || 20);
        return request('/notifications/me' + qs);
      }
    },

    push: {
      // GET /api/notifications/push/analytics?days=7
      analytics: function (days) {
        return request('/notifications/push/analytics?days=' + (days || 7));
      },
      // POST /api/notifications/push/track-click (called by sw.js, but expose for testing)
      trackClick: function (payload) {
        return request('/notifications/push/track-click', { method: 'POST', body: payload });
      }
    },

    jobs: {
      // domain: 'data' | 'marketing' | 'commerce'
      get: function (domain, jobId) {
        return request('/' + domain + '/jobs/' + encodeURIComponent(jobId));
      },
      // Poll a statusUrl (relative path already prefixed with /api) until terminal state.
      poll: async function (domain, jobId, opts) {
        opts = opts || {};
        var intervalMs = opts.intervalMs || 2000;
        var timeoutMs = opts.timeoutMs || 120000;
        var onUpdate = opts.onUpdate;
        var start = Date.now();
        while (true) {
          if (Date.now() - start > timeoutMs) {
            throw new ApiError(0, 'JOB_TIMEOUT', '작업이 시간 내에 완료되지 않았습니다.');
          }
          var status = await request('/' + domain + '/jobs/' + encodeURIComponent(jobId));
          if (onUpdate) { try { onUpdate(status); } catch (_) { /* ignore */ } }
          if (status.status === 'SUCCESS') return status;
          if (status.status === 'FAILED') {
            throw new ApiError(500, 'JOB_FAILED', status.errorMessage || '작업이 실패했습니다.', status);
          }
          await new Promise(function (r) { setTimeout(r, intervalMs); });
        }
      }
    },

    meetingNotes: {
      // POST /api/meeting-notes/summarize
      // body: { title, meetingAt, attendees: [], transcript }
      // returns: { title, meetingAt, attendees, summary, decisions: [], actionItems: [{owner,task,due}], generatedBy }
      summarize: function (payload) {
        return request('/meeting-notes/summarize', { method: 'POST', body: payload });
      }
    },

    admin: {
      // GET /api/admin/stats/overview — AdminOverviewDto
      overview: function () {
        return request('/admin/stats/overview');
      },
      // GET /api/admin/users?page=0&size=20 — Page<AdminUserDto>
      users: function (page, size) {
        return request('/admin/users?page=' + (page || 0) + '&size=' + (size || 20));
      },
      // GET /api/admin/usage?days=30 — List<UsageDto>
      usage: function (days) {
        return request('/admin/usage?days=' + (days || 30));
      },
      // GET /api/admin/notifications/breakdown?days=7 — NotificationBreakdownDto
      notifBreakdown: function (days) {
        return request('/admin/notifications/breakdown?days=' + (days || 7));
      },
      // GET /api/admin/features — List<FeatureManifestDto>
      features: function () {
        return request('/admin/features');
      },
      // GET /api/admin/features/{name} — Map with manifest, readme, changelog, api
      featureDetail: function (name) {
        return request('/admin/features/' + encodeURIComponent(name));
      },
      // PATCH /api/admin/features/{name}/status {status} — Update feature lifecycle status
      updateFeatureStatus: function (name, status) {
        return request('/admin/features/' + encodeURIComponent(name) + '/status', {
          method: 'PATCH',
          body: { status: status }
        });
      }
    }
  };
})();
