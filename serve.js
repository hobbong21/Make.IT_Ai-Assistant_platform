const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 5000;
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webmanifest': 'application/manifest+json',
};

// ── In-memory stores ────────────────────────────────────────────────────────

const DEMO_USERS = [
  { id: 1, email: 'demo@Human.Ai.D.com', password: 'password123', name: '관리자', role: 'ADMIN' },
  { id: 2, email: 'marketer@example.com', password: 'password123', name: '마케터', role: 'MARKETER' },
];
const sessions = new Map();

const campaigns = [
  { id: 'c1', title: '봄 시즌 인스타그램 캠페인', status: 'ACTIVE', channel: 'INSTAGRAM', budget: 500000, spent: 230000, startDate: '2026-04-01', endDate: '2026-04-30', impressions: 42800, clicks: 1920, conversions: 87 },
  { id: 'c2', title: '신제품 유튜브 광고', status: 'DRAFT', channel: 'YOUTUBE', budget: 1200000, spent: 0, startDate: '2026-05-01', endDate: '2026-05-31', impressions: 0, clicks: 0, conversions: 0 },
  { id: 'c3', title: '브랜드 인지도 캠페인', status: 'COMPLETED', channel: 'FACEBOOK', budget: 800000, spent: 800000, startDate: '2026-03-01', endDate: '2026-03-31', impressions: 95300, clicks: 4100, conversions: 210 },
];

const contents = [
  { id: 'ct1', type: 'INSTAGRAM_POST', title: '봄 신상 소개', status: 'PUBLISHED', channel: 'INSTAGRAM', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'ct2', type: 'YOUTUBE_SCRIPT', title: '제품 리뷰 영상 스크립트', status: 'DRAFT', channel: 'YOUTUBE', createdAt: new Date(Date.now() - 172800000).toISOString() },
];

const auditLogs = [];
const chatContexts = new Map();
const pushSubscriptions = new Set();

const features = [
  { name: 'nlp-analysis', displayName: 'NLP 분석', enabled: true, description: '텍스트 감성·키워드 분석' },
  { name: 'youtube-analysis', displayName: 'YouTube 분석', enabled: true, description: 'YouTube 댓글·영향력 분석' },
  { name: 'ai-feed-generation', displayName: 'AI 피드 생성', enabled: true, description: 'SNS 캡션·해시태그 자동 생성' },
  { name: 'chatbot', displayName: 'AI 챗봇', enabled: true, description: '커머스 AI 상담 챗봇' },
  { name: 'modelshot', displayName: '모델샷 생성', enabled: true, description: 'AI 모델 이미지 생성' },
  { name: 'push-notifications', displayName: 'Push 알림', enabled: true, description: 'PWA 웹 푸시 알림' },
  { name: 'admin-dashboard', displayName: '어드민 대시보드', enabled: true, description: '시스템 관리 패널' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return crypto.randomBytes(8).toString('hex'); }
function tok() { return crypto.randomBytes(32).toString('hex'); }
function userPublic(u) { return { id: u.id, email: u.email, name: u.name, role: u.role }; }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function jsonRes(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(JSON.stringify(body));
  return true;
}

function noContent(res) {
  res.writeHead(204, CORS_HEADERS);
  res.end();
  return true;
}

function getToken(req) {
  const a = req.headers['authorization'] || '';
  return a.startsWith('Bearer ') ? a.slice(7) : null;
}

function getSession(req) {
  const t = getToken(req);
  return t ? sessions.get(t) : null;
}

function requireAuth(req, res) {
  const s = getSession(req);
  if (!s) { jsonRes(res, 401, { errorCode: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }); return null; }
  return s;
}

function requireAdmin(req, res) {
  const s = requireAuth(req, res);
  if (!s) return null;
  if (s.user.role !== 'ADMIN') { jsonRes(res, 403, { errorCode: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' }); return null; }
  return s;
}

function readBody(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => { d += c; });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function addAudit(userId, action, resource, detail) {
  auditLogs.unshift({ id: uid(), userId, action, resource, detail, createdAt: new Date().toISOString() });
  if (auditLogs.length > 500) auditLogs.pop();
}

function pageOf(arr, page = 0, size = 20) {
  const p = Number(page) || 0;
  const s = Number(size) || 20;
  return { content: arr.slice(p * s, (p + 1) * s), totalElements: arr.length, totalPages: Math.ceil(arr.length / s), page: p, size: s };
}

function qp(url) {
  const u = new URL('http://x' + url);
  return Object.fromEntries(u.searchParams.entries());
}

// ── AI Mock Helpers ──────────────────────────────────────────────────────────

function nlpMock(text) {
  const positive = text.includes('좋') || text.includes('훌륭') || text.includes('만족') || text.includes('최고');
  return {
    sentiment: { label: positive ? 'POSITIVE' : 'NEUTRAL', score: positive ? 0.85 : 0.52 },
    keywords: ['마케팅', 'AI', '플랫폼', '성장', '분석'].slice(0, 4),
    entities: [{ text: 'Human.Ai.D', type: 'ORGANIZATION' }],
    summary: `입력 텍스트는 ${text.slice(0, 40)}... 에 관한 내용입니다.`,
    language: 'ko',
    wordCount: text.split(/\s+/).length,
  };
}

function chatbotReply(message) {
  const m = message.toLowerCase();
  if (m.includes('반품') || m.includes('환불')) return '반품·환불은 구매 후 30일 이내에 신청 가능합니다. 고객센터(1234-5678)로 문의해 주세요.';
  if (m.includes('배송') || m.includes('배달')) return '일반 배송은 2-3 영업일, 빠른배송은 당일·익일 도착합니다.';
  if (m.includes('가격') || m.includes('할인')) return '현재 최대 30% 할인 프로모션이 진행 중입니다. 이벤트 페이지를 확인해 주세요.';
  if (m.includes('재고') || m.includes('품절')) return '실시간 재고는 제품 상세 페이지에서 확인하실 수 있습니다.';
  return `안녕하세요! "${message}"에 대해 문의해 주셨군요. MaKIT AI 어시스턴트입니다. 더 자세한 정보를 알려주시면 정확하게 안내해 드리겠습니다. 😊`;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

async function handleApi(urlPath, req, res) {
  const m = req.method;

  if (m === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return true;
  }

  // ── Health ────────────────────────────────────────────────────────────────
  if (urlPath === '/api/healthz' || urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end('ok');
    return true;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (urlPath === '/api/auth/login' && m === 'POST') {
    const b = await readBody(req);
    const u = DEMO_USERS.find(x => x.email.toLowerCase() === (b.email || '').toLowerCase() && x.password === b.password);
    if (!u) return jsonRes(res, 401, { errorCode: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    const token = tok(), refreshToken = tok();
    sessions.set(token, { user: u, refreshToken });
    addAudit(u.id, 'LOGIN', 'auth', `${u.email} 로그인`);
    return jsonRes(res, 200, { token, refreshToken, user: userPublic(u) });
  }

  if (urlPath === '/api/auth/me' && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, userPublic(s.user));
  }

  if (urlPath === '/api/auth/me' && m === 'PATCH') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    if (b.name) s.user.name = b.name;
    if (b.email) s.user.email = b.email;
    return jsonRes(res, 200, userPublic(s.user));
  }

  if (urlPath === '/api/auth/logout' && m === 'POST') {
    const t = getToken(req); if (t) sessions.delete(t);
    return noContent(res);
  }

  if (urlPath === '/api/auth/register' && m === 'POST') {
    const b = await readBody(req);
    if (!b.email || !b.password || !b.name)
      return jsonRes(res, 400, { errorCode: 'VALIDATION_ERROR', message: '이름, 이메일, 비밀번호를 모두 입력해주세요.' });
    if (DEMO_USERS.find(x => x.email.toLowerCase() === b.email.toLowerCase()))
      return jsonRes(res, 409, { errorCode: 'EMAIL_EXISTS', message: '이미 사용 중인 이메일입니다.' });
    const nu = { id: DEMO_USERS.length + 1, email: b.email, password: b.password, name: b.name, role: 'USER' };
    DEMO_USERS.push(nu);
    const token = tok(), refreshToken = tok();
    sessions.set(token, { user: nu, refreshToken });
    return jsonRes(res, 200, { token, refreshToken, user: userPublic(nu) });
  }

  if (urlPath === '/api/auth/refresh' && m === 'POST') {
    const b = await readBody(req);
    const entry = [...sessions.entries()].find(([, v]) => v.refreshToken === b.refreshToken);
    if (!entry) return jsonRes(res, 401, { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' });
    const [old, { user }] = entry; sessions.delete(old);
    const token = tok(), refreshToken = tok();
    sessions.set(token, { user, refreshToken });
    return jsonRes(res, 200, { token, refreshToken, user: userPublic(user) });
  }

  if (urlPath === '/api/auth/change-password' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    if (b.currentPassword !== s.user.password)
      return jsonRes(res, 400, { errorCode: 'WRONG_PASSWORD', message: '현재 비밀번호가 올바르지 않습니다.' });
    s.user.password = b.newPassword;
    return jsonRes(res, 200, { message: '비밀번호가 변경되었습니다.' });
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (urlPath === '/api/dashboard/stats' && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
      totalImpressions: campaigns.reduce((a, c) => a + c.impressions, 0),
      totalClicks: campaigns.reduce((a, c) => a + c.clicks, 0),
      totalConversions: campaigns.reduce((a, c) => a + c.conversions, 0),
      totalBudget: campaigns.reduce((a, c) => a + c.budget, 0),
      totalSpent: campaigns.reduce((a, c) => a + c.spent, 0),
      avgCtr: 4.5, avgCvr: 2.1, aiCallsToday: 23, aiCallsMonth: 312,
    });
  }

  if (urlPath.startsWith('/api/dashboard/activity') && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    const items = [
      { id: 1, type: 'CAMPAIGN_CREATED', message: '봄 시즌 인스타그램 캠페인이 생성되었습니다.', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, type: 'AI_ANALYSIS', message: 'YouTube 댓글 분석이 완료되었습니다.', createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 3, type: 'CONTENT_PUBLISHED', message: '인스타그램 게시물이 발행되었습니다.', createdAt: new Date(Date.now() - 86400000).toISOString() },
      ...auditLogs.slice(0, 5).map(l => ({ id: l.id, type: l.action, message: l.detail, createdAt: l.createdAt })),
    ];
    return jsonRes(res, 200, { activities: items, total: items.length });
  }

  // ── Marketing – Hub ───────────────────────────────────────────────────────
  if (urlPath === '/api/marketing/hub' && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      summary: { activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length, scheduledPosts: 5, pendingApprovals: 2, monthlyBudget: 2500000, budgetUsed: campaigns.reduce((a, c) => a + c.spent, 0) },
      recentCampaigns: campaigns.slice(0, 3),
      channelPerformance: [
        { channel: 'INSTAGRAM', impressions: 42800, clicks: 1920, ctr: 4.49 },
        { channel: 'YOUTUBE', impressions: 0, clicks: 0, ctr: 0 },
        { channel: 'FACEBOOK', impressions: 95300, clicks: 4100, ctr: 4.30 },
      ],
    });
  }

  // ── Marketing – Campaigns ─────────────────────────────────────────────────
  if (urlPath.startsWith('/api/marketing/campaigns') && m === 'GET' && !urlPath.match(/\/campaigns\/.+/)) {
    const s = requireAuth(req, res); if (!s) return true;
    const q = qp(req.url);
    let list = [...campaigns];
    if (q.status) list = list.filter(c => c.status === q.status);
    if (q.channel) list = list.filter(c => c.channel === q.channel);
    return jsonRes(res, 200, { campaigns: list, total: list.length, ...pageOf(list, q.page, q.size) });
  }

  if (urlPath === '/api/marketing/campaigns' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    const nc = { id: uid(), status: 'DRAFT', impressions: 0, clicks: 0, conversions: 0, spent: 0, createdAt: new Date().toISOString(), ...b };
    campaigns.unshift(nc);
    addAudit(s.user.id, 'CAMPAIGN_CREATED', 'campaigns', `캠페인 "${nc.title}" 생성`);
    return jsonRes(res, 201, nc);
  }

  const campId = urlPath.match(/^\/api\/marketing\/campaigns\/([^/]+)$/);
  if (campId) {
    const s = requireAuth(req, res); if (!s) return true;
    const idx = campaigns.findIndex(c => c.id === campId[1]);
    if (m === 'GET') {
      if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' });
      return jsonRes(res, 200, campaigns[idx]);
    }
    if (m === 'PATCH' || m === 'PUT') {
      if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' });
      const b = await readBody(req);
      campaigns[idx] = { ...campaigns[idx], ...b, id: campId[1] };
      addAudit(s.user.id, 'CAMPAIGN_UPDATED', 'campaigns', `캠페인 "${campaigns[idx].title}" 수정`);
      return jsonRes(res, 200, campaigns[idx]);
    }
    if (m === 'DELETE') {
      if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' });
      const [r] = campaigns.splice(idx, 1);
      addAudit(s.user.id, 'CAMPAIGN_DELETED', 'campaigns', `캠페인 "${r.title}" 삭제`);
      return noContent(res);
    }
  }

  const campStatus = urlPath.match(/^\/api\/marketing\/campaigns\/([^/]+)\/status$/);
  if (campStatus && (m === 'POST' || m === 'PATCH')) {
    const s = requireAuth(req, res); if (!s) return true;
    const idx = campaigns.findIndex(c => c.id === campStatus[1]);
    if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' });
    const b = await readBody(req);
    campaigns[idx].status = b.status;
    addAudit(s.user.id, 'CAMPAIGN_STATUS', 'campaigns', `캠페인 상태 → ${b.status}`);
    return jsonRes(res, 200, campaigns[idx]);
  }

  // ── Marketing – Contents ──────────────────────────────────────────────────
  if (urlPath.startsWith('/api/marketing/contents') && m === 'GET' && !urlPath.match(/\/contents\/.+/)) {
    const s = requireAuth(req, res); if (!s) return true;
    const q = qp(req.url);
    let list = [...contents];
    if (q.status) list = list.filter(c => c.status === q.status);
    return jsonRes(res, 200, { contents: list, total: list.length, ...pageOf(list, q.page, q.size) });
  }

  if (urlPath === '/api/marketing/contents' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    const nc = { id: uid(), status: 'DRAFT', createdAt: new Date().toISOString(), ...b };
    contents.unshift(nc);
    return jsonRes(res, 201, nc);
  }

  const contId = urlPath.match(/^\/api\/marketing\/contents\/([^/]+)$/);
  if (contId) {
    const s = requireAuth(req, res); if (!s) return true;
    const idx = contents.findIndex(c => c.id === contId[1]);
    if (m === 'GET') {
      if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND' });
      return jsonRes(res, 200, contents[idx]);
    }
    if (m === 'PATCH' || m === 'PUT') {
      if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND' });
      const b = await readBody(req);
      contents[idx] = { ...contents[idx], ...b, id: contId[1] };
      return jsonRes(res, 200, contents[idx]);
    }
    if (m === 'DELETE') {
      if (idx >= 0) contents.splice(idx, 1);
      return noContent(res);
    }
  }

  // ── Marketing – Other ─────────────────────────────────────────────────────
  if (urlPath === '/api/marketing/calendar/week' && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      events: [
        { id: 'e1', title: '인스타그램 게시물', date: '2026-04-26', channel: 'INSTAGRAM', status: 'SCHEDULED' },
        { id: 'e2', title: '유튜브 영상 업로드', date: '2026-04-28', channel: 'YOUTUBE', status: 'DRAFT' },
        { id: 'e3', title: '페이스북 광고 시작', date: '2026-05-01', channel: 'FACEBOOK', status: 'SCHEDULED' },
      ],
    });
  }

  if (urlPath === '/api/marketing/insights/weekly' && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      week: '2026-W17',
      totalReach: 138100, totalEngagement: 6020, totalConversions: 297,
      topPerformingChannel: 'FACEBOOK', roas: 3.2,
      weeklyTrend: [
        { date: '2026-04-19', impressions: 18200, clicks: 780 },
        { date: '2026-04-20', impressions: 22400, clicks: 960 },
        { date: '2026-04-21', impressions: 19800, clicks: 870 },
        { date: '2026-04-22', impressions: 25100, clicks: 1100 },
        { date: '2026-04-23', impressions: 21300, clicks: 920 },
        { date: '2026-04-24', impressions: 17600, clicks: 760 },
        { date: '2026-04-25', impressions: 13700, clicks: 630 },
      ],
    });
  }

  if ((urlPath === '/api/marketing/channel-performance' || urlPath === '/api/marketing/channels/performance') && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      channels: [
        { channel: 'INSTAGRAM', impressions: 42800, clicks: 1920, conversions: 87, spend: 230000, ctr: 4.49, cvr: 4.53, cpc: 120 },
        { channel: 'FACEBOOK', impressions: 95300, clicks: 4100, conversions: 210, spend: 800000, ctr: 4.30, cvr: 5.12, cpc: 195 },
        { channel: 'YOUTUBE', impressions: 0, clicks: 0, conversions: 0, spend: 0, ctr: 0, cvr: 0, cpc: 0 },
      ],
    });
  }

  if (urlPath === '/api/marketing/feed/generate' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    addAudit(s.user.id, 'AI_GENERATION', 'marketing', 'Feed 콘텐츠 생성');
    return jsonRes(res, 200, {
      captions: [
        `✨ ${b.topic || '새로운 트렌드'}를 경험해 보세요!\n\n지금 바로 확인하고 일상을 더욱 풍요롭게!\n\n#MaKIT #AI마케팅 #트렌드`,
        `💡 ${b.topic || '혁신적인 솔루션'}으로 비즈니스를 성장시키세요!\n\n스마트한 선택이 최고의 결과를 만듭니다. 🚀\n\n#마케팅자동화 #성장`,
        `🎯 목표 달성을 위한 최고의 파트너!\n${b.topic || 'MaKIT'}이 함께합니다. 💪\n\n#디지털마케팅 #HumanAiD`,
      ],
      hashtags: ['#MaKIT', '#AI마케팅', '#디지털마케팅', '#비즈니스성장', '#HumanAiD'],
      imagePrompt: `Professional marketing visual for ${b.topic || 'AI platform'}, modern, clean, Korean market`,
    });
  }

  if (urlPath === '/api/marketing/image/remove-bg' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { resultUrl: 'https://via.placeholder.com/400x400.png?text=BG+Removed', message: '배경이 제거되었습니다.' });
  }

  // ── Data Intelligence ─────────────────────────────────────────────────────
  if (urlPath === '/api/data/nlp/analyze' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    addAudit(s.user.id, 'AI_ANALYSIS', 'data', 'NLP 분석 실행');
    return jsonRes(res, 200, nlpMock(b.text || ''));
  }

  if (urlPath === '/api/data/youtube/comments' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    addAudit(s.user.id, 'AI_ANALYSIS', 'data', 'YouTube 댓글 분석');
    return jsonRes(res, 202, {
      jobId: uid(), status: 'SUCCESS',
      comments: [
        { text: '정말 좋은 제품이에요! 강력 추천합니다.', sentiment: 'POSITIVE', likes: 42 },
        { text: '가격 대비 품질이 훌륭합니다.', sentiment: 'POSITIVE', likes: 28 },
        { text: '배송이 조금 느렸지만 제품은 만족스럽습니다.', sentiment: 'NEUTRAL', likes: 15 },
        { text: '생각보다 별로네요. 실망입니다.', sentiment: 'NEGATIVE', likes: 8 },
        { text: '디자인이 예뻐요! 재구매 의사 있어요.', sentiment: 'POSITIVE', likes: 35 },
      ],
      summary: { total: 5, positive: 3, neutral: 1, negative: 1, positiveRate: 60, avgSentimentScore: 0.65 },
    });
  }

  if (urlPath === '/api/data/youtube/influence' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    return jsonRes(res, 200, {
      channelId: b.channelId || 'UCexample',
      subscriberCount: 128400, viewCount: 5820000, videoCount: 234,
      engagementRate: 4.8, influenceScore: 72,
      topTopics: ['테크리뷰', '일상', '제품리뷰'],
      monthlyTrend: { views: 420000, newSubscribers: 3200, avgViewDuration: '4분 23초' },
    });
  }

  if (urlPath === '/api/data/youtube/keyword-search' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    return jsonRes(res, 200, {
      keywords: b.keywords || [],
      results: (b.keywords || ['키워드']).map(k => ({
        keyword: k,
        searchVolume: Math.floor(Math.random() * 50000) + 5000,
        competition: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
        trend: 'RISING',
        relatedKeywords: [`${k} 추천`, `${k} 리뷰`, `베스트 ${k}`],
      })),
    });
  }

  if (urlPath === '/api/data/url/analyze' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    return jsonRes(res, 200, {
      url: b.url, title: '웹페이지 분석 결과',
      summary: `${b.url}의 핵심 내용을 분석했습니다. 마케팅에 활용할 키워드와 주제를 추출했습니다.`,
      keywords: ['브랜드', '제품', '서비스', '혁신'],
      sentiment: 'POSITIVE', readabilityScore: 78,
      wordCount: 1240, language: 'ko',
    });
  }

  // ── Commerce / Chatbot ────────────────────────────────────────────────────
  if (urlPath === '/api/commerce/chatbot/message' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    const reply = chatbotReply(b.message || '');
    const contextId = b.contextId || uid();
    if (!chatContexts.has(contextId)) chatContexts.set(contextId, []);
    chatContexts.get(contextId).push({ role: 'user', content: b.message }, { role: 'assistant', content: reply });
    return jsonRes(res, 200, { reply, contextId, usedRag: false, tokensUsed: 150 });
  }

  if (urlPath === '/api/commerce/chatbot/stream' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const b = await readBody(req);
    const reply = chatbotReply(b.message || '');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS_HEADERS });
    const chars = reply.split('');
    let i = 0;
    const iv = setInterval(() => {
      if (i >= chars.length) { res.write('data: [DONE]\n\n'); res.end(); clearInterval(iv); return; }
      res.write(`data: ${JSON.stringify({ token: chars.slice(i, i + 3).join('') })}\n\n`);
      i += 3;
    }, 30);
    req.on('close', () => clearInterval(iv));
    return true;
  }

  if (urlPath === '/api/commerce/chatbot/feedback' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { message: '피드백이 저장되었습니다.' });
  }

  const reviewMatch = urlPath.match(/^\/api\/commerce\/reviews\/([^/]+)\/analyze$/);
  if (reviewMatch && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      productId: reviewMatch[1], totalReviews: 142,
      sentimentSummary: { positive: 98, neutral: 28, negative: 16, positiveRate: 69.0 },
      avgRating: 4.2,
      topPositivePoints: ['품질 우수', '빠른 배송', '가격 대비 만족'],
      topNegativePoints: ['포장 아쉬움', '설명서 부족'],
      keyPhrases: ['좋은 품질', '만족', '재구매', '추천'],
      recentTrend: 'IMPROVING',
    });
  }

  if (urlPath === '/api/commerce/modelshot/generate' && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    addAudit(s.user.id, 'AI_GENERATION', 'commerce', 'Modelshot 이미지 생성');
    return jsonRes(res, 202, {
      jobId: uid(), status: 'SUCCESS',
      imageUrl: 'https://via.placeholder.com/512x512.png?text=AI+Modelshot',
      message: '모델샷 이미지가 생성되었습니다.',
    });
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  if (urlPath.startsWith('/api/notifications/me/unread-count') && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { count: 0 });
  }

  if (urlPath.startsWith('/api/notifications/me/read-all') && m === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { message: '모든 알림을 읽음 처리했습니다.' });
  }

  if (urlPath.startsWith('/api/notifications/me') && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { content: [], totalElements: 0, ...pageOf([], 0, 20) });
  }

  const notifRead = urlPath.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (notifRead && m === 'POST') {
    return jsonRes(res, 200, { message: '알림을 읽음 처리했습니다.' });
  }

  if (urlPath === '/api/notifications/push/vapid-key' && m === 'GET') {
    return jsonRes(res, 200, { publicKey: 'BDummyVAPIDPublicKeyForMockServer12345678901234567890' });
  }

  if (urlPath === '/api/notifications/push/subscribe' && m === 'POST') {
    const b = await readBody(req);
    if (b.endpoint) pushSubscriptions.add(b.endpoint);
    return jsonRes(res, 200, { message: 'Push 구독이 완료되었습니다.' });
  }

  if (urlPath.startsWith('/api/notifications/push/unsubscribe') && m === 'DELETE') {
    return jsonRes(res, 200, { message: 'Push 구독이 해제되었습니다.' });
  }

  if (urlPath.startsWith('/api/notifications/push/analytics') && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { sent: 142, clicked: 38, ctr: 26.8, subscribers: pushSubscriptions.size });
  }

  if (urlPath === '/api/notifications/push/track-click' && m === 'POST') {
    return jsonRes(res, 200, { ok: true });
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────
  if (urlPath.startsWith('/api/audit-logs/me') && m === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    const q = qp(req.url);
    const userLogs = auditLogs.filter(l => l.userId === s.user.id);
    return jsonRes(res, 200, pageOf(userLogs, q.page, q.size));
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const jobMatch = urlPath.match(/^\/api\/([a-z]+)\/jobs\/([^/]+)$/);
  if (jobMatch && m === 'GET') {
    requireAuth(req, res);
    return jsonRes(res, 200, { jobId: jobMatch[2], status: 'SUCCESS', progress: 100 });
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  if (urlPath === '/api/admin/stats/overview' && m === 'GET') {
    const s = requireAdmin(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      totalUsers: DEMO_USERS.length, activeUsers: sessions.size,
      totalCampaigns: campaigns.length, activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
      aiCallsToday: 23, aiCallsMonth: 312,
      totalNotificationsSent: 142, pushSubscribers: pushSubscriptions.size,
    });
  }

  if (urlPath.startsWith('/api/admin/users') && m === 'GET') {
    const s = requireAdmin(req, res); if (!s) return true;
    const q = qp(req.url);
    return jsonRes(res, 200, pageOf(DEMO_USERS.map(userPublic), q.page, q.size));
  }

  if (urlPath.startsWith('/api/admin/usage') && m === 'GET') {
    const s = requireAdmin(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      days: 30,
      aiCalls: { nlp: 45, youtube: 28, feedGeneration: 19, chatbot: 89, modelshot: 12 },
      campaignsCreated: 5, contentsCreated: 8,
    });
  }

  if (urlPath.startsWith('/api/admin/notifications/breakdown') && m === 'GET') {
    const s = requireAdmin(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      totalSent: 142, clicked: 38, dismissed: 18, ctr: 26.8,
      byType: [{ type: 'CAMPAIGN_ALERT', count: 52 }, { type: 'AI_COMPLETE', count: 90 }],
    });
  }

  if (urlPath === '/api/admin/features' && m === 'GET') {
    const s = requireAdmin(req, res); if (!s) return true;
    return jsonRes(res, 200, features);
  }

  const featureName = urlPath.match(/^\/api\/admin\/features\/([^/]+)$/);
  if (featureName && m === 'GET') {
    const s = requireAdmin(req, res); if (!s) return true;
    const f = features.find(x => x.name === featureName[1]);
    if (!f) return jsonRes(res, 404, { errorCode: 'NOT_FOUND' });
    return jsonRes(res, 200, f);
  }

  const featureStatus = urlPath.match(/^\/api\/admin\/features\/([^/]+)\/status$/);
  if (featureStatus && m === 'PATCH') {
    const s = requireAdmin(req, res); if (!s) return true;
    const f = features.find(x => x.name === featureStatus[1]);
    if (!f) return jsonRes(res, 404, { errorCode: 'NOT_FOUND' });
    const b = await readBody(req);
    f.enabled = b.enabled;
    addAudit(s.user.id, 'FEATURE_TOGGLE', 'admin', `기능 "${f.name}" → ${b.enabled ? '활성' : '비활성'}`);
    return jsonRes(res, 200, f);
  }

  return false;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  if (urlPath.startsWith('/api/') || urlPath === '/healthz') {
    const handled = await handleApi(urlPath, req, res).catch(err => {
      console.error('API error:', err);
      jsonRes(res, 500, { errorCode: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' });
      return true;
    });
    if (!handled) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: `엔드포인트를 찾을 수 없습니다: ${urlPath}` });
    return;
  }

  let filePath = path.join(ROOT, urlPath);
  // Root → intro.html (public landing). index.html도 비로그인 자유 접근(replit.md 참고).
  // 로그인 페이지로의 이동은 사용자가 nav의 "로그인" CTA를 클릭했을 때만 발생.
  if (urlPath === '/' || urlPath === '') {
    filePath = path.join(ROOT, 'intro.html');
  } else if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT, 'intro.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(500); res.end('Internal Server Error'); return; }
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MaKIT serving on http://${HOST}:${PORT}`);
  console.log('Demo accounts:');
  DEMO_USERS.forEach(u => console.log(`  ${u.email} / ${u.password} (${u.role})`));
  console.log('\nEndpoints: Auth · Dashboard · Marketing · Data · Commerce · Notifications · Admin · Jobs · Audit');
});
