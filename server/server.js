import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { VEHICLE_CATALOG } from '../src/systems/GarageSystem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const PORT = Number(process.env.PORT || 8000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const defaultStore = () => ({ version: 1, players: {} });

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
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('Payload muito grande');
  }
  return raw ? JSON.parse(raw) : {};
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
    return json(res, 200, { ok: true, service: 'policia-vs-ladrao-backend', phase: 25, implemented: [22, 24, 25], skipped: [19, 23] });
  }

  if (req.method === 'GET' && url.pathname === '/api/ranking') {
    const store = await readStore();
    return json(res, 200, buildRanking(store, {
      period: url.searchParams.get('period') || 'global',
      limit: url.searchParams.get('limit') || 50,
      playerId: url.searchParams.get('playerId') || null,
    }));
  }

  if (req.method === 'POST' && url.pathname === '/api/players') {
    const body = await readBody(req);
    const store = await readStore();
    const requested = typeof body.playerId === 'string' && body.playerId.trim() ? body.playerId.trim() : null;
    const id = requested && store.players[requested] ? requested : randomUUID();
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
    return json(res, 200, { player: store.players[id] });
  }

  if (parts[0] === 'api' && parts[1] === 'players' && parts[2]) {
    const playerId = decodeURIComponent(parts[2]);
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
      const run = cleanRun(body.run);
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
  if (!filePath.startsWith(ROOT)) return json(res, 403, { error: 'FORBIDDEN' });
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('not file');
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado');
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else await serveStatic(req, res, url);
    } catch (error) {
      json(res, 500, { error: 'INTERNAL_ERROR', message: error.message });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  createServer().listen(PORT, () => console.log(`Polícia VS Ladrão: http://localhost:${PORT}`));
}
