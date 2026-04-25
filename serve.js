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
};

// ── In-memory stores ─────────────────────────────────────────────────────────

const DEMO_USERS = [
  { id: 1, email: 'demo@Human.Ai.D.com', password: 'password123', name: '관리자', role: 'ADMIN' },
  { id: 2, email: 'marketer@example.com', password: 'password123', name: '마케터', role: 'MARKETER' },
];
const sessions = new Map();

// Campaigns store (in-memory)
const campaigns = [
  { id: 'c1', title: '봄 시즌 인스타그램 캠페인', status: 'ACTIVE', channel: 'INSTAGRAM', budget: 500000, spent: 230000, startDate: '2026-04-01', endDate: '2026-04-30', impressions: 42800, clicks: 1920, conversions: 87 },
  { id: 'c2', title: '신제품 유튜브 광고', status: 'DRAFT', channel: 'YOUTUBE', budget: 1200000, spent: 0, startDate: '2026-05-01', endDate: '2026-05-31', impressions: 0, clicks: 0, conversions: 0 },
  { id: 'c3', title: '브랜드 인지도 캠페인', status: 'COMPLETED', channel: 'FACEBOOK', budget: 800000, spent: 800000, startDate: '2026-03-01', endDate: '2026-03-31', impressions: 95300, clicks: 4100, conversions: 210 },
];

// Audit log store
const auditLogs = [];

// Chatbot context store
const chatContexts = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId() { return crypto.randomBytes(8).toString('hex'); }
function generateToken() { return crypto.randomBytes(32).toString('hex'); }
function userPublic(u) { return { id: u.id, email: u.email, name: u.name, role: u.role }; }

function jsonRes(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  res.end(json);
  return true;
}

function getToken(req) {
  const auth = req.headers['authorization'] || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function getSession(req) {
  const t = getToken(req);
  return t ? sessions.get(t) : null;
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    jsonRes(res, 401, { errorCode: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
    return null;
  }
  return session;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function addAudit(userId, action, resource, detail) {
  auditLogs.unshift({ id: generateId(), userId, action, resource, detail, createdAt: new Date().toISOString() });
  if (auditLogs.length > 200) auditLogs.pop();
}

// ── AI Mock Responses ─────────────────────────────────────────────────────────

const AI_NLP_MOCK = (text) => ({
  sentiment: { label: text.includes('좋') || text.includes('최고') ? 'POSITIVE' : 'NEUTRAL', score: 0.82 },
  keywords: ['마케팅', 'AI', '플랫폼', '성장'].slice(0, 3),
  entities: [{ text: 'Human.Ai.D', type: 'ORGANIZATION' }],
  summary: `입력 텍스트의 핵심 주제는 ${text.slice(0, 30)}...에 관한 내용입니다.`,
  language: 'ko',
  wordCount: text.split(/\s+/).length,
});

const AI_FEED_MOCK = (brief) => ({
  captions: [
    `✨ ${brief.topic || '새로운 트렌드'}를 경험해 보세요!\n\n지금 바로 확인하고 일상을 더욱 풍요롭게 만들어보세요. 🌟\n\n#MaKIT #AI마케팅 #트렌드`,
    `💡 ${brief.topic || '혁신적인 솔루션'}으로 비즈니스를 성장시키세요!\n\n스마트한 선택이 최고의 결과를 만듭니다. 🚀\n\n#마케팅자동화 #성장 #AI`,
    `🎯 목표 달성을 위한 최고의 파트너!\n${brief.topic || 'MaKIT'}이 함께합니다.\n\n지금 시작해보세요 💪\n\n#디지털마케팅 #성공 #HumanAiD`,
  ],
  hashtags: ['#MaKIT', '#AI마케팅', '#디지털마케팅', '#비즈니스성장', '#Human_AiD'],
  imagePrompt: `Professional marketing visual for ${brief.topic || 'AI platform'}, modern, clean design, Korean market`,
});

const AI_CHATBOT_MOCK = (message) => {
  const lower = message.toLowerCase();
  if (lower.includes('반품') || lower.includes('환불')) {
    return '반품 및 환불은 구매 후 30일 이내에 신청 가능합니다. 제품이 미사용 상태여야 하며, 고객센터(1234-5678)로 문의해 주시면 안내해 드리겠습니다.';
  }
  if (lower.includes('배송') || lower.includes('배달')) {
    return '일반 배송은 2-3 영업일, 빠른배송은 당일 또는 익일 도착합니다. 주문 후 발송 안내 문자를 통해 배송 현황을 확인하실 수 있습니다.';
  }
  if (lower.includes('가격') || lower.includes('할인')) {
    return '현재 진행 중인 프로모션을 통해 최대 30% 할인 혜택을 받으실 수 있습니다. 자세한 내용은 이벤트 페이지를 확인해 주세요.';
  }
  return `안녕하세요! "${message}"에 대해 문의해 주셨군요. 저는 MaKIT AI 어시스턴트입니다. 더 구체적인 정보를 알려주시면 정확한 답변을 드릴 수 있습니다. 추가 질문이 있으시면 언제든지 말씀해 주세요! 😊`;
};

// ── API Route Handler ─────────────────────────────────────────────────────────

async function handleApi(urlPath, req, res) {
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    });
    res.end();
    return true;
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  if (urlPath === '/api/auth/login' && method === 'POST') {
    const body = await readBody(req);
    const user = DEMO_USERS.find(u => u.email.toLowerCase() === (body.email || '').toLowerCase() && u.password === body.password);
    if (!user) return jsonRes(res, 401, { errorCode: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    const token = generateToken(); const refreshToken = generateToken();
    sessions.set(token, { user, refreshToken });
    addAudit(user.id, 'LOGIN', 'auth', `${user.email} logged in`);
    return jsonRes(res, 200, { token, refreshToken, user: userPublic(user) });
  }

  if (urlPath === '/api/auth/me' && method === 'GET') {
    const s = requireAuth(req, res);
    if (!s) return true;
    return jsonRes(res, 200, userPublic(s.user));
  }

  if (urlPath === '/api/auth/logout' && method === 'POST') {
    const t = getToken(req); if (t) sessions.delete(t);
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }); res.end(); return true;
  }

  if (urlPath === '/api/auth/register' && method === 'POST') {
    const body = await readBody(req);
    if (!body.email || !body.password || !body.name) return jsonRes(res, 400, { errorCode: 'VALIDATION_ERROR', message: '이름, 이메일, 비밀번호를 모두 입력해주세요.' });
    if (DEMO_USERS.find(u => u.email.toLowerCase() === body.email.toLowerCase())) return jsonRes(res, 409, { errorCode: 'EMAIL_EXISTS', message: '이미 사용 중인 이메일입니다.' });
    const newUser = { id: DEMO_USERS.length + 1, email: body.email, password: body.password, name: body.name, role: 'USER' };
    DEMO_USERS.push(newUser);
    const token = generateToken(); const refreshToken = generateToken();
    sessions.set(token, { user: newUser, refreshToken });
    return jsonRes(res, 200, { token, refreshToken, user: userPublic(newUser) });
  }

  if (urlPath === '/api/auth/refresh' && method === 'POST') {
    const body = await readBody(req);
    const entry = [...sessions.entries()].find(([, v]) => v.refreshToken === body.refreshToken);
    if (!entry) return jsonRes(res, 401, { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' });
    const [oldToken, { user }] = entry; sessions.delete(oldToken);
    const token = generateToken(); const refreshToken = generateToken();
    sessions.set(token, { user, refreshToken });
    return jsonRes(res, 200, { token, refreshToken, user: userPublic(user) });
  }

  if (urlPath === '/api/auth/profile' && method === 'PUT') {
    const s = requireAuth(req, res); if (!s) return true;
    const body = await readBody(req);
    if (body.name) s.user.name = body.name;
    if (body.email) s.user.email = body.email;
    return jsonRes(res, 200, userPublic(s.user));
  }

  if (urlPath === '/api/auth/password' && method === 'PUT') {
    const s = requireAuth(req, res); if (!s) return true;
    const body = await readBody(req);
    if (!body.currentPassword || body.currentPassword !== s.user.password) return jsonRes(res, 400, { errorCode: 'WRONG_PASSWORD', message: '현재 비밀번호가 올바르지 않습니다.' });
    s.user.password = body.newPassword;
    return jsonRes(res, 200, { message: '비밀번호가 변경되었습니다.' });
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  if (urlPath === '/api/dashboard/stats' && method === 'GET') {
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

  if (urlPath === '/api/dashboard/activity' && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    const activities = [
      { id: 1, type: 'CAMPAIGN_CREATED', message: '봄 시즌 인스타그램 캠페인이 생성되었습니다.', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, type: 'AI_ANALYSIS', message: 'YouTube 댓글 분석이 완료되었습니다.', createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 3, type: 'LOGIN', message: '새로운 로그인이 감지되었습니다.', createdAt: new Date(Date.now() - 86400000).toISOString() },
      ...auditLogs.slice(0, 5).map(l => ({ id: l.id, type: l.action, message: l.detail, createdAt: l.createdAt })),
    ];
    return jsonRes(res, 200, { activities, total: activities.length });
  }

  // ── Marketing ───────────────────────────────────────────────────────────────

  if (urlPath === '/api/marketing/hub' && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      summary: { activeCampaigns: 1, scheduledPosts: 5, pendingApprovals: 2, monthlyBudget: 2500000, budgetUsed: 1030000 },
      recentCampaigns: campaigns.slice(0, 3),
      channelPerformance: [
        { channel: 'INSTAGRAM', impressions: 42800, clicks: 1920, ctr: 4.49 },
        { channel: 'YOUTUBE', impressions: 0, clicks: 0, ctr: 0 },
        { channel: 'FACEBOOK', impressions: 95300, clicks: 4100, ctr: 4.30 },
      ],
    });
  }

  if (urlPath === '/api/marketing/campaigns' && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { campaigns, total: campaigns.length, page: 0, size: 20 });
  }

  if (urlPath === '/api/marketing/campaigns' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const body = await readBody(req);
    const newCampaign = { id: generateId(), status: 'DRAFT', impressions: 0, clicks: 0, conversions: 0, spent: 0, ...body, createdAt: new Date().toISOString() };
    campaigns.unshift(newCampaign);
    addAudit(s.user.id, 'CAMPAIGN_CREATED', 'campaigns', `캠페인 "${newCampaign.title}" 생성`);
    return jsonRes(res, 201, newCampaign);
  }

  const campaignMatch = urlPath.match(/^\/api\/marketing\/campaigns\/([^/]+)$/);
  if (campaignMatch) {
    const s = requireAuth(req, res); if (!s) return true;
    const id = campaignMatch[1];
    const idx = campaigns.findIndex(c => c.id === id);
    if (method === 'GET') {
      if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' });
      return jsonRes(res, 200, campaigns[idx]);
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' });
      const body = await readBody(req);
      campaigns[idx] = { ...campaigns[idx], ...body, id };
      addAudit(s.user.id, 'CAMPAIGN_UPDATED', 'campaigns', `캠페인 "${campaigns[idx].title}" 수정`);
      return jsonRes(res, 200, campaigns[idx]);
    }
    if (method === 'DELETE') {
      if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' });
      const [removed] = campaigns.splice(idx, 1);
      addAudit(s.user.id, 'CAMPAIGN_DELETED', 'campaigns', `캠페인 "${removed.title}" 삭제`);
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }); res.end(); return true;
    }
  }

  const campaignStatusMatch = urlPath.match(/^\/api\/marketing\/campaigns\/([^/]+)\/status$/);
  if (campaignStatusMatch && method === 'PATCH') {
    const s = requireAuth(req, res); if (!s) return true;
    const id = campaignStatusMatch[1];
    const idx = campaigns.findIndex(c => c.id === id);
    if (idx < 0) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' });
    const body = await readBody(req);
    campaigns[idx].status = body.status;
    addAudit(s.user.id, 'CAMPAIGN_STATUS', 'campaigns', `캠페인 상태 변경: ${body.status}`);
    return jsonRes(res, 200, campaigns[idx]);
  }

  if (urlPath === '/api/marketing/insights/weekly' && method === 'GET') {
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

  if (urlPath === '/api/marketing/calendar/week' && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      events: [
        { id: 'e1', title: '인스타그램 게시물', date: '2026-04-26', channel: 'INSTAGRAM', status: 'SCHEDULED' },
        { id: 'e2', title: '유튜브 영상 업로드', date: '2026-04-28', channel: 'YOUTUBE', status: 'DRAFT' },
        { id: 'e3', title: '페이스북 광고 시작', date: '2026-05-01', channel: 'FACEBOOK', status: 'SCHEDULED' },
      ],
    });
  }

  if (urlPath === '/api/marketing/channel-performance' && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      channels: [
        { channel: 'INSTAGRAM', impressions: 42800, clicks: 1920, conversions: 87, spend: 230000, ctr: 4.49, cvr: 4.53, cpc: 120 },
        { channel: 'FACEBOOK', impressions: 95300, clicks: 4100, conversions: 210, spend: 800000, ctr: 4.30, cvr: 5.12, cpc: 195 },
        { channel: 'YOUTUBE', impressions: 0, clicks: 0, conversions: 0, spend: 0, ctr: 0, cvr: 0, cpc: 0 },
      ],
    });
  }

  if (urlPath === '/api/marketing/contents' && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      contents: [
        { id: 'ct1', type: 'INSTAGRAM_POST', title: '봄 신상 소개', status: 'PUBLISHED', channel: 'INSTAGRAM', createdAt: new Date(Date.now() - 86400000).toISOString() },
        { id: 'ct2', type: 'YOUTUBE_SCRIPT', title: '제품 리뷰 영상 스크립트', status: 'DRAFT', channel: 'YOUTUBE', createdAt: new Date(Date.now() - 172800000).toISOString() },
      ],
      total: 2,
    });
  }

  if (urlPath === '/api/marketing/feed/generate' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const body = await readBody(req);
    addAudit(s.user.id, 'AI_GENERATION', 'marketing', 'Instagram feed 생성');
    return jsonRes(res, 200, AI_FEED_MOCK(body));
  }

  if (urlPath === '/api/marketing/image/remove-bg' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { resultUrl: 'https://via.placeholder.com/400x400.png?text=Background+Removed', message: '배경이 제거되었습니다.' });
  }

  // ── Data Intelligence ────────────────────────────────────────────────────────

  if (urlPath === '/api/data/nlp/analyze' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const body = await readBody(req);
    addAudit(s.user.id, 'AI_ANALYSIS', 'data', 'NLP 분석 실행');
    return jsonRes(res, 200, AI_NLP_MOCK(body.text || ''));
  }

  if (urlPath === '/api/data/youtube/comments' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const jobId = generateId();
    addAudit(s.user.id, 'AI_ANALYSIS', 'data', 'YouTube 댓글 분석 시작');
    return jsonRes(res, 202, {
      jobId, status: 'SUCCESS',
      comments: [
        { text: '정말 좋은 제품이에요! 강력 추천합니다.', sentiment: 'POSITIVE', likes: 42 },
        { text: '가격 대비 품질이 훌륭합니다.', sentiment: 'POSITIVE', likes: 28 },
        { text: '배송이 조금 느렸지만 제품은 만족스럽습니다.', sentiment: 'NEUTRAL', likes: 15 },
        { text: '생각보다 별로네요. 실망입니다.', sentiment: 'NEGATIVE', likes: 8 },
        { text: '디자인이 정말 예뻐요! 재구매 의사 있어요.', sentiment: 'POSITIVE', likes: 35 },
      ],
      summary: { total: 5, positive: 3, neutral: 1, negative: 1, positiveRate: 60, avgSentimentScore: 0.65 },
    });
  }

  if (urlPath === '/api/data/youtube/influence' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, {
      channelId: (await readBody(req)).channelId || 'UCexample',
      subscriberCount: 128400, viewCount: 5820000, videoCount: 234,
      engagementRate: 4.8, influenceScore: 72,
      topTopics: ['테크리뷰', '일상', '제품리뷰'],
      monthlyTrend: { views: 420000, newSubscribers: 3200, avgViewDuration: '4분 23초' },
    });
  }

  if (urlPath === '/api/data/youtube/keyword-search' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const body = await readBody(req);
    return jsonRes(res, 200, {
      keywords: body.keywords || [],
      results: (body.keywords || ['키워드']).map(k => ({
        keyword: k, searchVolume: Math.floor(Math.random() * 50000) + 5000,
        competition: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
        trend: 'RISING', relatedKeywords: [`${k} 추천`, `${k} 리뷰`, `베스트 ${k}`],
      })),
    });
  }

  if (urlPath === '/api/data/url/analyze' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const body = await readBody(req);
    return jsonRes(res, 200, {
      url: body.url, title: '웹페이지 분석 결과',
      summary: `${body.url}의 주요 내용을 분석했습니다. 핵심 키워드와 주제를 추출하여 마케팅에 활용할 수 있습니다.`,
      keywords: ['브랜드', '제품', '서비스', '혁신'],
      sentiment: 'POSITIVE', readabilityScore: 78,
      wordCount: 1240, language: 'ko',
    });
  }

  // ── Commerce / Chatbot ───────────────────────────────────────────────────────

  if (urlPath === '/api/commerce/chatbot/message' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const body = await readBody(req);
    const reply = AI_CHATBOT_MOCK(body.message || '');
    const contextId = body.contextId || generateId();
    if (!chatContexts.has(contextId)) chatContexts.set(contextId, []);
    chatContexts.get(contextId).push({ role: 'user', content: body.message }, { role: 'assistant', content: reply });
    return jsonRes(res, 200, { reply, contextId, usedRag: false, tokensUsed: 150 });
  }

  if (urlPath === '/api/commerce/chatbot/stream' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const body = await readBody(req);
    const reply = AI_CHATBOT_MOCK(body.message || '');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    const words = reply.split('');
    let i = 0;
    const interval = setInterval(() => {
      if (i >= words.length) {
        res.write('data: [DONE]\n\n');
        res.end();
        clearInterval(interval);
        return;
      }
      const chunk = words.slice(i, i + 3).join('');
      res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
      i += 3;
    }, 30);
    req.on('close', () => clearInterval(interval));
    return true;
  }

  if (urlPath === '/api/commerce/chatbot/feedback' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { message: '피드백이 저장되었습니다.' });
  }

  const reviewMatch = urlPath.match(/^\/api\/commerce\/reviews\/([^/]+)\/analyze$/);
  if (reviewMatch && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    const productId = reviewMatch[1];
    return jsonRes(res, 200, {
      productId, totalReviews: 142,
      sentimentSummary: { positive: 98, neutral: 28, negative: 16, positiveRate: 69.0 },
      avgRating: 4.2,
      topPositivePoints: ['품질 우수', '빠른 배송', '가격 대비 만족'],
      topNegativePoints: ['포장 아쉬움', '설명서 부족'],
      keyPhrases: ['좋은 품질', '만족', '재구매', '추천'],
      recentTrend: 'IMPROVING',
    });
  }

  if (urlPath === '/api/commerce/modelshot/generate' && method === 'POST') {
    const s = requireAuth(req, res); if (!s) return true;
    addAudit(s.user.id, 'AI_GENERATION', 'commerce', 'Modelshot 이미지 생성');
    return jsonRes(res, 202, {
      jobId: generateId(), status: 'SUCCESS',
      imageUrl: 'https://via.placeholder.com/512x512.png?text=AI+Modelshot',
      message: '모델샷 이미지가 생성되었습니다.',
    });
  }

  // ── Jobs ─────────────────────────────────────────────────────────────────────

  const jobMatch = urlPath.match(/^\/api\/(data|marketing|commerce)\/jobs\/([^/]+)$/);
  if (jobMatch && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { jobId: jobMatch[2], status: 'SUCCESS', progress: 100 });
  }

  // ── Audit ─────────────────────────────────────────────────────────────────────

  if (urlPath === '/api/audit/mine' && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    const userLogs = auditLogs.filter(l => l.userId === s.user.id).slice(0, 50);
    return jsonRes(res, 200, { logs: userLogs, total: userLogs.length });
  }

  // ── Notifications ─────────────────────────────────────────────────────────────

  if (urlPath.startsWith('/api/notifications/') && method === 'PATCH') {
    return jsonRes(res, 200, { message: '알림이 읽음 처리되었습니다.' });
  }

  if (urlPath === '/api/notifications' && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return true;
    return jsonRes(res, 200, { notifications: [], unreadCount: 0 });
  }

  return false;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return;
  }

  if (urlPath.startsWith('/api/')) {
    const handled = await handleApi(urlPath, req, res);
    if (!handled) return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: `엔드포인트를 찾을 수 없습니다: ${urlPath}` });
    return;
  }

  let filePath = path.join(ROOT, urlPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) filePath = path.join(ROOT, 'index.html');

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(500); res.end('Internal Server Error'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MaKIT API + Frontend serving on http://${HOST}:${PORT}`);
  console.log('Demo accounts:');
  DEMO_USERS.forEach(u => console.log(`  ${u.email} / ${u.password} (${u.role})`));
  console.log('\nAPI endpoints ready:');
  console.log('  Auth, Dashboard, Marketing, Data Intelligence, Commerce, Jobs, Audit');
});
