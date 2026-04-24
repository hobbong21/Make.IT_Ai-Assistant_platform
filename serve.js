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

const DEMO_USERS = [
  {
    id: 1,
    email: 'demo@Human.Ai.D.com',
    password: 'password123',
    name: '관리자',
    role: 'ADMIN',
  },
  {
    id: 2,
    email: 'marketer@example.com',
    password: 'password123',
    name: '마케터',
    role: 'MARKETER',
  },
];

const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function userPublic(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

function jsonRes(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(json);
  return true;
}

function getTokenFromReq(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (_) { resolve({}); }
    });
    req.on('error', reject);
  });
}

async function handleAuthApi(urlPath, req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return true;
  }

  if (urlPath === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    const user = DEMO_USERS.find(
      u => u.email.toLowerCase() === (body.email || '').toLowerCase()
        && u.password === body.password
    );
    if (!user) {
      return jsonRes(res, 401, { errorCode: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const token = generateToken();
    const refreshToken = generateToken();
    sessions.set(token, { user, refreshToken });
    return jsonRes(res, 200, { token, refreshToken, user: userPublic(user) });
  }

  if (urlPath === '/api/auth/me' && req.method === 'GET') {
    const token = getTokenFromReq(req);
    const session = token && sessions.get(token);
    if (!session) return jsonRes(res, 401, { errorCode: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
    return jsonRes(res, 200, userPublic(session.user));
  }

  if (urlPath === '/api/auth/logout' && req.method === 'POST') {
    const token = getTokenFromReq(req);
    if (token) sessions.delete(token);
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    res.end();
    return true;
  }

  if (urlPath === '/api/auth/register' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.email || !body.password || !body.name) {
      return jsonRes(res, 400, { errorCode: 'VALIDATION_ERROR', message: '이메일, 이름, 비밀번호를 입력해주세요.' });
    }
    const exists = DEMO_USERS.find(u => u.email.toLowerCase() === body.email.toLowerCase());
    if (exists) {
      return jsonRes(res, 409, { errorCode: 'EMAIL_ALREADY_EXISTS', message: '이미 사용 중인 이메일입니다.' });
    }
    const newUser = {
      id: DEMO_USERS.length + 1,
      email: body.email,
      password: body.password,
      name: body.name,
      role: 'USER',
    };
    DEMO_USERS.push(newUser);
    const token = generateToken();
    const refreshToken = generateToken();
    sessions.set(token, { user: newUser, refreshToken });
    return jsonRes(res, 200, { token, refreshToken, user: userPublic(newUser) });
  }

  if (urlPath === '/api/auth/refresh' && req.method === 'POST') {
    const body = await readBody(req);
    const entry = [...sessions.entries()].find(([, v]) => v.refreshToken === body.refreshToken);
    if (!entry) return jsonRes(res, 401, { errorCode: 'INVALID_REFRESH_TOKEN', message: '유효하지 않은 토큰입니다.' });
    const [oldToken, { user }] = entry;
    sessions.delete(oldToken);
    const token = generateToken();
    const refreshToken = generateToken();
    sessions.set(token, { user, refreshToken });
    return jsonRes(res, 200, { token, refreshToken, user: userPublic(user) });
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  let urlPath = req.url.split('?')[0];

  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (urlPath.startsWith('/api/auth/')) {
    const handled = await handleAuthApi(urlPath, req, res);
    if (handled) return;
    return jsonRes(res, 404, { errorCode: 'NOT_FOUND', message: '엔드포인트를 찾을 수 없습니다.' });
  }

  if (urlPath.startsWith('/api/')) {
    return jsonRes(res, 503, {
      errorCode: 'BACKEND_UNAVAILABLE',
      message: '백엔드 서버가 실행 중이지 않습니다. 인증 기능은 데모 모드로 이용 가능합니다.',
    });
  }

  let filePath = path.join(ROOT, urlPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MaKIT frontend + auth API serving on http://${HOST}:${PORT}`);
  console.log('Demo accounts:');
  DEMO_USERS.forEach(u => console.log(`  ${u.email} / ${u.password} (${u.role})`));
});
