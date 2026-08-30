import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { VEHICLE_CATALOG } from '../src/systems/GarageSystem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const PORT = Number(process.env.PORT || 8000);
const JWT_ISSUER = 'policia-vs-ladrao';
const JWT_TTL_SECONDS = 60 * 60 * 24 * 7;
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const rateLimits = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const defaultStore = () => ({ version: 1, players: {} });

class ApiError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function issueSessionToken(playerId, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson({ sub: playerId, iss: JWT_ISSUER, iat: issuedAt, exp: issuedAt + JWT_TTL_SECONDS });
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifySessionToken(token, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || header.typ !== 'JWT' || payload.iss !== JWT_ISSUER || typeof payload.sub !== 'string') return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(now / 1000)) return null;
    const expected = Buffer.from(createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url'));
    const actual = Buffer.from(parts[2]);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getSession(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  return verifySessionToken(authorization.slice(7).trim());
}

function requirePlayerSession(req, playerId) {
  const session = getSession(req);
  if (!session || session.sub !== playerId) throw new ApiError(401, 'INVALID_SESSION', 'Sessão inválida ou expirada');
  return session;
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://unpkg.com 'sha256-yohyHrAzVja3hJ7syK4Q1pyrNU02Tog1LU8478mWlCg='; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
}

function enforceRateLimit(req, res) {
  const now = Date.now();
  const address = req.socket.remoteAddress || 'unknown';
  const bucket = `${address}:${req.method === 'GET' ? 'read' : 'write'}`;
  const limit = req.method === 'GET' ? 240 : 80;
  let entry = rateLimits.get(bucket);
  if (!entry || now - entry.startedAt >= 60_000) entry = { startedAt: now, count: 0 };
  entry.count += 1;
  rateLimits.set(bucket, entry);
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
  if (entry.count <= limit) return true;
  res.setHeader('Retry-After', String(Math.ceil((60_000 - (now - entry.startedAt)) / 1000)));
  return false;
}

async function readStore() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const store = defaultStore();
    await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
    return store;
  }
}

let writeQueue = Promise.resolve();
async function writeStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  writeQueue = writeQueue.then(() => fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2)));
  return writeQueue;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = '';
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 128_000) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Payload muito grande');
    raw += chunk;
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'JSON inválido');
  }
}

function cleanProfile(profile = {}) {
  const unlocked = Array.isArray(profile.unlockedVehicleIds) ? profile.unlockedVehicleIds.filter(v => typeof v === 'string').slice(0, 20) : ['COMPACT'];
  if (!unlocked.includes('COMPACT')) unlocked.unshift('COMPACT');
  return {
    totalXp: Math.max(0, Math.floor(Number(profile.totalXp) || 0)),
    cash: Math.max(0, Math.floor(Number(profile.cash) || 0)),
    runs: Math.max(0, Math.floor(Number(profile.runs) || 0)),
    bestTimeSeconds: Math.max(0, Number(profile.bestTimeSeconds) || 0),
    bestScore: Math.max(0, Math.floor(Number(profile.bestScore) || 0)),
    selectedVehicleId: typeof profile.selectedVehicleId === 'string' ? profile.selectedVehicleId : 'COMPACT',
    unlockedVehicleIds: [...new Set(unlocked)],
  };
}

function cleanRun(run = {}) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    timeSeconds: Math.max(0, Number(run.timeSeconds) || 0),
    score: Math.max(0, Math.floor(Number(run.score) || 0)),
    maxWantedLevel: Math.min(7, Math.max(1, Math.floor(Number(run.maxWantedLevel) || 1))),
    policeEvaded: Math.max(0, Math.floor(Number(run.policeEvaded) || 0)),
    vehicleId: typeof run.vehicleId === 'string' ? run.vehicleId : 'COMPACT',
    xpGained: Math.max(0, Math.floor(Number(run.xpGained) || 0)),
    cashGained: Math.max(0, Math.floor(Number(run.cashGained) || 0)),
  };
}

function validateRun(run = {}) {
  for (const field of ['timeSeconds', 'score', 'maxWantedLevel', 'policeEvaded']) {
    if (run[field] !== undefined && !Number.isFinite(Number(run[field]))) throw new ApiError(422, 'INVALID_RUN', `Campo inválido: ${field}`);
  }
  const cleaned = cleanRun(run);
  if (cleaned.timeSeconds <= 0 || cleaned.timeSeconds > 21_600) throw new ApiError(422, 'INVALID_RUN', 'Duração da partida fora do limite');
  const minimumWantedTime = [0, 0, 30, 60, 120, 240, 360, 600][cleaned.maxWantedLevel] ?? 0;
  if (cleaned.timeSeconds + 3 < minimumWantedTime) throw new ApiError(422, 'IMPOSSIBLE_RUN', 'Nível de procurado incompatível com a duração');
  if (cleaned.score > cleaned.timeSeconds * 500 + 25_000) throw new ApiError(422, 'IMPOSSIBLE_RUN', 'Pontuação incompatível com a duração');
  if (!VEHICLE_CATALOG.some((vehicle) => vehicle.id === cleaned.vehicleId)) throw new ApiError(422, 'INVALID_VEHICLE', 'Veículo desconhecido');
  return cleaned;
}


function getPeriodStart(period, now = new Date()) {
  const d = new Date(now);
  if (period === 'daily') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (period === 'weekly') {
    const day = d.getUTCDay() || 7;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 1));
  }
  if (period === 'monthly') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return null;
}

function displayNameFor(playerId) {
  return `Fugitivo-${String(playerId).replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function buildRanking(store, { period = 'global', limit = 50, playerId = null, now = new Date() } = {}) {
  const allowed = new Set(['daily', 'weekly', 'monthly', 'global']);
  const normalizedPeriod = allowed.has(period) ? period : 'global';
  const cutoff = getPeriodStart(normalizedPeriod, now);
  const entries = [];

  for (const player of Object.values(store.players ?? {})) {
    const runs = (player.runs ?? []).filter((run) => !cutoff || new Date(run.createdAt) >= cutoff);
    if (!runs.length) continue;
    const best = [...runs].sort((a, b) => b.score - a.score || b.timeSeconds - a.timeSeconds || new Date(a.createdAt) - new Date(b.createdAt))[0];
    entries.push({
      playerId: player.id,
      playerName: displayNameFor(player.id),
      score: best.score,
      timeSeconds: best.timeSeconds,
      maxWantedLevel: best.maxWantedLevel,
      vehicleId: best.vehicleId,
      achievedAt: best.createdAt,
    });
  }

  entries.sort((a, b) => b.score - a.score || b.timeSeconds - a.timeSeconds || new Date(a.achievedAt) - new Date(b.achievedAt));
  const ranked = entries.map((entry, index) => ({ rank: index + 1, ...entry }));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));
  const me = playerId ? ranked.find((entry) => entry.playerId === playerId) ?? null : null;
  return { period: normalizedPeriod, generatedAt: new Date(now).toISOString(), totalPlayers: ranked.length, entries: ranked.slice(0, safeLimit), me };
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (req.method === 'GET' && url.pathname === '/api/vehicles') {
    return json(res, 200, { vehicles: VEHICLE_CATALOG.map(({ id, name, price, requiredLevel, stats }) => ({ id, name, price, requiredLevel, stats })) });
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'policia-vs-ladrao-backend', phase: 26, security: 'JWT-HS256', implemented: [22, 24, 25, 26], skipped: [19] });
  }

  if (req.method === 'GET' && url.pathname === '/api/ranking') {
    const store = await readStore();
    const session = getSession(req);
    return json(res, 200, buildRanking(store, {
      period: url.searchParams.get('period') || 'global',
      limit: url.searchParams.get('limit') || 50,
      playerId: session?.sub || null,
    }));
  }

  if (req.method === 'POST' && url.pathname === '/api/players') {
    const body = await readBody(req);
    const store = await readStore();
    const requested = typeof body.playerId === 'string' && body.playerId.trim() ? body.playerId.trim() : null;
    const session = getSession(req);
    const canResume = requested && store.players[requested] && session?.sub === requested;
    const id = canResume ? requested : randomUUID();
    const now = new Date().toISOString();
    const existing = store.players[id];
    store.players[id] = existing || {
      id, createdAt: now, updatedAt: now, profile: cleanProfile(body.profile), runs: [],
    };
    if (existing && body.profile) {
      existing.profile = cleanProfile(body.profile);
      existing.updatedAt = now;
    }
    await writeStore(store);
    return json(res, canResume ? 200 : 201, { player: store.players[id], token: issueSessionToken(id), expiresIn: JWT_TTL_SECONDS });
  }

  if (parts[0] === 'api' && parts[1] === 'players' && parts[2]) {
    const playerId = decodeURIComponent(parts[2]);
    requirePlayerSession(req, playerId);
    const store = await readStore();
    const player = store.players[playerId];
    if (!player) return json(res, 404, { error: 'PLAYER_NOT_FOUND' });

    if (req.method === 'GET' && parts.length === 3) {
      return json(res, 200, { player });
    }

    if (req.method === 'PUT' && parts[3] === 'profile') {
      const body = await readBody(req);
      player.profile = cleanProfile(body.profile);
      player.updatedAt = new Date().toISOString();
      await writeStore(store);
      return json(res, 200, { player });
    }

    if (req.method === 'POST' && parts[3] === 'runs') {
      const body = await readBody(req);
      const run = validateRun(body.run);
      player.runs.push(run);
      if (player.runs.length > 250) player.runs = player.runs.slice(-250);
      if (body.profile) player.profile = cleanProfile(body.profile);
      player.updatedAt = new Date().toISOString();
      await writeStore(store);
      return json(res, 201, { run, player: { ...player, runs: undefined } });
    }
  }

  return json(res, 404, { error: 'API_NOT_FOUND' });
}

async function serveStatic(req, res, url) {
  let requestPath = decodeURIComponent(url.pathname);
  if (requestPath.startsWith('/server/') || requestPath.startsWith('/tests/')) {
    return json(res, 404, { error: 'NOT_FOUND' });
  }
  if (requestPath === '/') requestPath = '/index.html';
  const normalized = path.normalize(requestPath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.resolve(ROOT, `.${normalized}`);
  const relative = path.relative(ROOT, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return json(res, 403, { error: 'FORBIDDEN' });
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('not file');
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path.extname(filePath).toLowerCase() === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado');
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    applySecurityHeaders(res);
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/') && !enforceRateLimit(req, res)) return json(res, 429, { error: 'RATE_LIMITED' });
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else await serveStatic(req, res, url);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      if (status >= 500) console.error(error);
      json(res, status, { error: code, message: status < 500 ? error.message : 'Erro interno do servidor' });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  if (!process.env.JWT_SECRET) console.warn('JWT_SECRET não definido: as sessões serão reiniciadas quando o servidor reiniciar.');
  createServer().listen(PORT, () => console.log(`Polícia VS Ladrão: http://localhost:${PORT}`));
}
