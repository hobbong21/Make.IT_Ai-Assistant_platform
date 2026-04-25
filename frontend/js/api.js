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

  function buildHeaders(extra) {
    var token = localStorage.getItem(KEYS.token);
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

    // 401 handling: clear session and redirect to login (unless already on login)
    if (resp.status === 401) {
      localStorage.removeItem(KEYS.token);
      localStorage.removeItem(KEYS.refresh);
      localStorage.removeItem(KEYS.user);
      if (!/login\.html$/.test(location.pathname)) {
        location.href = 'login.html';
      }
      throw new ApiError(401, 'UNAUTHORIZED', '로그인이 필요합니다');
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
      read: function (id) { return request('/notifications/' + id + '/read', { method: 'POST' }); }
    },

    data: {
      nlpAnalyze: function (text, opts) {
        var body = { text: text };
        if (opts && opts.tasks) body.tasks = opts.tasks;
        if (opts && opts.language) body.language = opts.language;
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
    }
  };
})();
