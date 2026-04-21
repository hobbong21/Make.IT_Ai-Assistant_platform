---
name: frontend-integration
description: "MaKIT 프론트엔드(HTML/CSS/Vanilla JS)를 백엔드 API와 연결하는 가이드. fetch 래퍼, JWT 토큰 관리, 로딩/에러 UX, SSE 스트리밍, 중복 파일 정리. 'frontend 연동', 'API 연결', '로그인 붙이기', '챗봇 UI 붙이기', '프론트 개발' 등 HTML/CSS/JS 프론트엔드 작업 시 반드시 이 스킬을 사용할 것."
---

# Frontend Integration — API 연결 & UX 완성

## 언제 사용하나

- 기존 HTML 페이지에 실제 API 호출 붙이기
- JWT 로그인/토큰 저장/만료 처리
- 로딩/에러/빈 상태 UX 구현
- SSE (Server-Sent Events) 스트리밍 UI (챗봇)
- 3곳 중복 파일(`/`, `/frontend/`, `/0. Design1_Mokup/`) 정리

## 원칙

1. **디자인은 건드리지 않는다**: 색상·레이아웃·타이포그래피·간격 수정 금지. JS 동작과 데이터 연결만 추가.
2. **Vanilla JS**: React/Vue 도입 금지. 기존 스타일 유지.
3. **`/frontend/`를 정식 소스로**: 루트의 중복 파일은 정리 대상. `0. Design1_Mokup/`은 디자인 스냅샷으로 읽기전용 보관.
4. **API 호출은 `api.js`를 경유**: 모든 fetch는 중앙화. Base URL 하나, 토큰 주입 하나, 에러 처리 하나.
5. **상태 변화는 DOM에 투영**: 로딩·에러·빈 상태를 모든 API 호출에 동반. 사용자가 "클릭했는데 아무 반응 없음"을 겪지 않도록.

## 디렉토리 최종 목표

```
frontend/
├── index.html
├── intro.html
├── login.html
├── all-services.html
├── service-detail.html
├── css/
│   ├── common.css            (토스트, 스피너, 에러 뱃지)
│   ├── styles.css
│   ├── intro-styles.css
│   ├── all-services-styles.css
│   └── service-detail-styles.css
├── js/
│   ├── api.js                (fetch 래퍼)
│   ├── auth.js               (토큰 관리)
│   ├── ui.js                 (로딩/토스트/모달)
│   └── pages/
│       ├── login.js
│       ├── index.js
│       ├── all-services.js
│       └── service-detail.js
└── assets/ (필요 시)
```

루트 HTML/CSS는 `frontend/`로 이전 후 삭제 또는 `<meta http-equiv="refresh">` 리다이렉트 stub만 남김 (리더 승인 후).

## 표준 파일 템플릿

### `js/api.js`
```javascript
const API_BASE = (window.MAKIT_CONFIG && window.MAKIT_CONFIG.apiBase) || '/api';

async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const token = localStorage.getItem('makit_token');
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (resp.status === 401) {
    localStorage.removeItem('makit_token');
    localStorage.removeItem('makit_user');
    if (!location.pathname.endsWith('/login.html')) {
      location.href = '/login.html';
    }
    throw new ApiError(401, 'UNAUTHORIZED', '로그인이 필요합니다');
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ApiError(resp.status, data.errorCode, data.message || '요청 실패', data);
  }
  return data;
}

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

window.api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },
  data: {
    nlpAnalyze: (text) => request('/data/nlp/analyze', { method: 'POST', body: { text } }),
    youtubeComments: (videoUrl) => request('/data/youtube/comments', { method: 'POST', body: { videoUrl } }),
    urlAnalyze: (url) => request('/data/url/analyze', { method: 'POST', body: { url } }),
  },
  marketing: {
    generateFeed: (brief) => request('/marketing/feed/generate', { method: 'POST', body: brief }),
    removeBackground: (imageUrl) => request('/marketing/image/remove-bg', { method: 'POST', body: { imageUrl } }),
  },
  commerce: {
    chatbot: (sessionId, message) => request('/commerce/chatbot/message', { method: 'POST', body: { sessionId, message } }),
    analyzeReviews: (productId) => request(`/commerce/reviews/${productId}/analyze`, { method: 'POST' }),
  },
};

window.ApiError = ApiError;
```

### `js/auth.js`
```javascript
const auth = {
  isLoggedIn: () => !!localStorage.getItem('makit_token'),
  getUser: () => JSON.parse(localStorage.getItem('makit_user') || 'null'),
  saveSession: (token, user) => {
    localStorage.setItem('makit_token', token);
    localStorage.setItem('makit_user', JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem('makit_token');
    localStorage.removeItem('makit_user');
  },
  requireLogin: () => {
    if (!auth.isLoggedIn() && !location.pathname.endsWith('/login.html')) {
      location.href = '/login.html';
    }
  },
};
window.auth = auth;
```

### `js/ui.js`
```javascript
const ui = {
  toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },
  showLoading(target) {
    target.classList.add('is-loading');
    target.setAttribute('aria-busy', 'true');
  },
  hideLoading(target) {
    target.classList.remove('is-loading');
    target.removeAttribute('aria-busy');
  },
  renderError(container, err) {
    container.innerHTML = `
      <div class="error-state">
        <p>${err.message || '알 수 없는 오류'}</p>
        ${err.details?.requestId ? `<small>요청 ID: ${err.details.requestId}</small>` : ''}
      </div>`;
  },
};
window.ui = ui;
```

### `css/common.css`
```css
.is-loading { position: relative; opacity: 0.6; pointer-events: none; }
.is-loading::after {
  content: ''; position: absolute; inset: 0; margin: auto;
  width: 24px; height: 24px; border: 3px solid #e5e7eb; border-top-color: #000;
  border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.toast {
  position: fixed; bottom: 24px; right: 24px; padding: 12px 20px;
  background: #1f2937; color: #fff; border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,.2); z-index: 9999;
  animation: toast-in .2s ease-out;
}
.toast-error { background: #dc2626; }
.toast-success { background: #10b981; }
@keyframes toast-in { from { transform: translateY(20px); opacity: 0; } }

.error-state { padding: 2rem; text-align: center; color: #6b7280; }
```

## 페이지별 연결 계획

### login.html
- `/api/auth/login` 호출 → token/user 저장 → `index.html` 이동
- **포트 불일치 수정**: 현재 `http://localhost:8083/api` 하드코딩 → `api.js`의 `/api` (Nginx 프록시 경유)로 변경. `backend-engineer`와 포트 합의 후 `docker-compose`의 `8080`으로 통일.

### index.html
- 로드 시 `auth.requireLogin()`
- `api.auth.me()`로 사용자 정보 가져와 사이드바 이름 표시
- "go-to-web" 클릭 시 intro.html로 이동

### all-services.html
- 서비스 카드 "서비스 사용" 버튼 → `service-detail.html?service={serviceKey}`

### service-detail.html (현재 하드코딩된 데모)
- URL 파라미터 `service`로 분기 (예: `nlp-analyze`, `youtube-comments`, `chatbot` 등)
- 기존 예시 질문 12개는 그대로 유지하되, 클릭 시 **실제 API 호출**로 전환:
  ```javascript
  document.querySelectorAll('.question-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = btn.dataset.question;
      renderUserMessage(q);
      const loading = renderLoading();
      try {
        const res = await api.data.nlpAnalyze(q);
        loading.remove();
        renderBotMessage(res);
      } catch (e) {
        loading.remove();
        ui.toast(e.message, 'error');
      }
    });
  });
  ```

### 챗봇 (SSE 스트리밍)
```javascript
async function streamChat(sessionId, message) {
  const resp = await fetch('/api/commerce/chatbot/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
               'Authorization': `Bearer ${localStorage.getItem('makit_token')}` },
    body: JSON.stringify({ sessionId, message }),
  });
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n\n');
    buf = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const chunk = JSON.parse(line.slice(6));
        appendToBotMessage(chunk.text);
      }
    }
  }
}
```

## 에러 UX 규칙

- **네트워크 오류**: 토스트 "서버와 연결할 수 없습니다. 잠시 후 다시 시도하세요." + 해당 버튼만 재시도 가능하게
- **401**: 자동 로그인 페이지 이동 (api.js에서 처리됨)
- **400 validation**: 필드 아래 빨간 메시지 표시 (form field별)
- **500**: "일시적 오류가 발생했습니다. 요청 ID: xxx"
- **빈 결과**: "아직 데이터가 없어요" + 가이드 문구 + 주요 액션 버튼

## 반응형 검증

기존 CSS에 이미 `@media (max-width: 768px|640px)` 있음. 추가 작업 없음. 단 새로 추가하는 토스트/모달은 모바일에서도 잘리지 않는지 확인.

## 금지 사항

- 디자인 변경 (색상·간격·폰트)
- `document.write`, inline `<script>`에 비즈니스 로직
- 토큰을 URL 쿼리 파라미터에 포함
- CORS 우회 목적의 임의 프록시 설정 (Nginx가 담당)
- 한 페이지에 모든 JS 몰아넣기 — `js/pages/{page}.js`로 분리
