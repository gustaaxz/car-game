import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer, buildRanking } from '../server/server.js';
import { SpatialHashGrid } from '../src/systems/SpatialHashGrid.js';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

function fakeItem(x, z, id) { return { id, object3D: { position: { x, z } } }; }

const now = new Date('2026-08-18T12:00:00.000Z');
const fakeStore = {
  version: 1,
  players: {
    p1: { id: 'p1', runs: [
      { createdAt: '2026-08-18T09:00:00.000Z', score: 1200, timeSeconds: 90, maxWantedLevel: 3, vehicleId: 'COMPACT' },
      { createdAt: '2026-08-18T10:00:00.000Z', score: 1600, timeSeconds: 105, maxWantedLevel: 4, vehicleId: 'MUSCLE' },
    ] },
    p2: { id: 'p2', runs: [
      { createdAt: '2026-08-17T15:00:00.000Z', score: 2100, timeSeconds: 150, maxWantedLevel: 5, vehicleId: 'SPORT' },
    ] },
    p3: { id: 'p3', runs: [
      { createdAt: '2026-07-10T15:00:00.000Z', score: 5000, timeSeconds: 300, maxWantedLevel: 7, vehicleId: 'SUV' },
    ] },
  },
};

test('Ranking global usa somente a melhor fuga de cada jogador', () => {
  const ranking = buildRanking(fakeStore, { period: 'global', now });
  assert.equal(ranking.totalPlayers, 3);
  assert.equal(ranking.entries.filter(e => e.playerId === 'p1').length, 1);
  assert.equal(ranking.entries.find(e => e.playerId === 'p1').score, 1600);
});

test('Ranking global ordena por pontuação', () => {
  const ranking = buildRanking(fakeStore, { period: 'global', now });
  assert.deepEqual(ranking.entries.map(e => e.playerId), ['p3', 'p2', 'p1']);
});

test('Ranking diário respeita início do dia UTC', () => {
  const ranking = buildRanking(fakeStore, { period: 'daily', now });
  assert.deepEqual(ranking.entries.map(e => e.playerId), ['p1']);
});

test('Ranking semanal respeita semana corrente', () => {
  const ranking = buildRanking(fakeStore, { period: 'weekly', now });
  assert.deepEqual(ranking.entries.map(e => e.playerId), ['p2', 'p1']);
});

test('Ranking mensal exclui partidas de meses anteriores', () => {
  const ranking = buildRanking(fakeStore, { period: 'monthly', now });
  assert.deepEqual(ranking.entries.map(e => e.playerId), ['p2', 'p1']);
});

test('Ranking retorna posição do jogador mesmo com limite pequeno', () => {
  const ranking = buildRanking(fakeStore, { period: 'global', limit: 1, playerId: 'p1', now });
  assert.equal(ranking.entries.length, 1);
  assert.equal(ranking.me.rank, 3);
});

test('SpatialHashGrid retorna apenas objetos próximos', () => {
  const grid = new SpatialHashGrid(20);
  const a = fakeItem(0, 0, 'a');
  const b = fakeItem(10, 0, 'b');
  const c = fakeItem(80, 80, 'c');
  grid.rebuild([a,b,c]);
  const nearby = grid.query({ x: 0, z: 0 }, 15).map(v => v.id).sort();
  assert.deepEqual(nearby, ['a','b']);
  assert.ok(grid.getCellCount() >= 2);
});

test('Interface contém tela e filtros do ranking', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const token of ['id="ranking"','id="rankingBody"','data-ranking-period="daily"','data-ranking-period="weekly"','data-ranking-period="monthly"','data-ranking-period="global"']) assert.ok(html.includes(token));
});

test('Otimização usa partição espacial nas colisões e no trânsito', async () => {
  const traffic = await readFile(new URL('../src/systems/TrafficManager.js', import.meta.url), 'utf8');
  const collisions = await readFile(new URL('../src/systems/VehicleCollisionSystem.js', import.meta.url), 'utf8');
  assert.match(traffic, /SpatialHashGrid/);
  assert.match(traffic, /queryNearby/);
  assert.match(collisions, /queryNearby/);
});

test('Otimização escalona atualização de IA distante', async () => {
  const police = await readFile(new URL('../src/systems/PoliceManager.js', import.meta.url), 'utf8');
  assert.match(police, /aiAccumulator/);
  assert.match(police, /distance < 90/);
  assert.match(police, /distance < 180/);
});

test('Polícia possui object pooling', async () => {
  const police = await readFile(new URL('../src/systems/PoliceManager.js', import.meta.url), 'utf8');
  assert.match(police, /vehiclePool/);
  assert.match(police, /_poolUnit/);
  assert.match(police, /getPoolSize/);
});

test('Trânsito reutiliza veículos entre reinícios', async () => {
  const traffic = await readFile(new URL('../src/systems/TrafficManager.js', import.meta.url), 'utf8');
  assert.match(traffic, /reusedLastReset/);
  assert.doesNotMatch(traffic, /this\._clear\(\);/);
});

test('PerformanceSystem implementa LOD por distância e pixel ratio adaptativo', async () => {
  const perf = await readFile(new URL('../src/systems/PerformanceSystem.js', import.meta.url), 'utf8');
  assert.match(perf, /d <= 320/);
  assert.match(perf, /d <= 360/);
  assert.match(perf, /setPixelRatio/);
});

test('Movimentação do jogador permanece byte a byte igual à versão validada', async () => {
  const bytes = await readFile(new URL('../src/entities/PlayerVehicle.js', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '049155b84a45abd5e5a5d4777668e43d0d189deaaec3d7f6103297ffb71f2242');
});

test('Movimentação policial permanece byte a byte igual à versão validada', async () => {
  const bytes = await readFile(new URL('../src/entities/PoliceVehicle.js', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '983fdebece8859011a2ef665dd530c9d8beb385527bfd824ac732c4f5dbd0453');
});


test('Fase 25 possui sistema de partículas, fumaça, nitro e marcas de pneu', async () => {
  const polish = await readFile(new URL('../src/systems/VisualPolishSystem.js', import.meta.url), 'utf8');
  for (const token of ['_emitImpact','_updateSkids','_updateNitro','_updateDamageSmoke','particlePool','skidPool']) assert.match(polish, new RegExp(token));
});

test('Fase 25 possui câmera dinâmica com FOV e trauma', async () => {
  const camera = await readFile(new URL('../src/camera/FollowCamera.js', import.meta.url), 'utf8');
  assert.match(camera, /addTrauma/);
  assert.match(camera, /targetFov/);
  assert.match(camera, /dynamicDistance/);
  assert.match(camera, /rotateZ/);
});

test('Fase 25 possui feedback visual de velocidade, perigo, impacto e toasts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const feedback = await readFile(new URL('../src/ui/ScreenFeedbackSystem.js', import.meta.url), 'utf8');
  for (const token of ['id="speedFx"','id="dangerFx"','id="impactFx"','id="toastLayer"','FASE 25 — POLIMENTO FINAL']) assert.ok(html.includes(token));
  assert.match(feedback, /COMBO x/);
  assert.match(feedback, /PROCURADO/);
  assert.match(feedback, /IMPACTO/);
});

test('Fase 25 ativa tone mapping e iluminação policial reativa', async () => {
  const game = await readFile(new URL('../src/core/Game.js', import.meta.url), 'utf8');
  assert.match(game, /ACESFilmicToneMapping/);
  assert.match(game, /SRGBColorSpace/);
  assert.match(game, /chaseRedLight/);
  assert.match(game, /chaseBlueLight/);
});

test('Balanceamento final suaviza perseguição e melhora recuperação da captura', async () => {
  const cfg = await readFile(new URL('../src/config/gameConfig.js', import.meta.url), 'utf8');
  assert.match(cfg, /speedMultiplier: 1\.19/);
  assert.match(cfg, /maxCaptureRate: 27/);
  assert.match(cfg, /baseDecayRate: 11/);
  assert.match(cfg, /speedDecayBonus: 14/);
});



test('Refino amplia o mapa para 9x9 cruzamentos e 64 quarteirões potenciais', async () => {
  const { GAME_CONFIG } = await import('../src/config/gameConfig.js');
  assert.equal(GAME_CONFIG.city.halfSize, 330);
  assert.equal(GAME_CONFIG.city.roadCenters.length, 9);
  assert.deepEqual(GAME_CONFIG.city.roadCenters, [-280,-210,-140,-70,0,70,140,210,280]);
  assert.equal((GAME_CONFIG.city.roadCenters.length - 1) ** 2, 64);
});

test('Mapa maior usa distritos procedurais e mobiliário urbano detalhado', async () => {
  const city = await readFile(new URL('../src/world/CityMap.js', import.meta.url), 'utf8');
  assert.match(city, /_districtType/);
  assert.match(city, /_addCurbs/);
  assert.match(city, /_addFacadeBands/);
  assert.match(city, /_buildStreetPoles/);
});

test('Bloqueios policiais persistem sem reconstrução total periódica', async () => {
  const roadblocks = await readFile(new URL('../src/systems/RoadblockSystem.js', import.meta.url), 'utf8');
  assert.doesNotMatch(roadblocks, /_rebuild\(/);
  assert.match(roadblocks, /_spawnOne/);
  assert.match(roadblocks, /_isStale/);
  assert.match(roadblocks, /criado primeiro e o antigo removido depois/);
});

test('Realismo de veículos adiciona detalhes e anima rodas/motos', async () => {
  const realism = await readFile(new URL('../src/systems/VehicleRealismSystem.js', import.meta.url), 'utf8');
  for (const token of ['_enhancePlayer','_enhancePolice','_enhanceTraffic','_addMotorcycleDetails','_addTruckDetails','_addBusDetails','_animateVehicle']) assert.match(realism, new RegExp(token));
});

test('Trânsito maior usa distribuição ponderada e 42 veículos', async () => {
  const { GAME_CONFIG } = await import('../src/config/gameConfig.js');
  const traffic = await readFile(new URL('../src/systems/TrafficManager.js', import.meta.url), 'utf8');
  assert.equal(GAME_CONFIG.traffic.vehicleCount, 42);
  assert.match(traffic, /'CAR','CAR','TAXI','CAR','MOTORCYCLE'/);
});

const storeUrl = new URL('../server/data/store.json', import.meta.url);
const originalStore = await readFile(storeUrl, 'utf8').catch(() => '{"version":1,"players":{}}');
await writeFile(storeUrl, JSON.stringify({ version: 1, players: {} }, null, 2));

const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

async function api(path, options = {}) {
  const res = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await res.json();
  return { res, body };
}

let playerA, playerB;
test('Backend anuncia Fases 22, 24 e 25 e registra pulos 19/23', async () => {
  const { body } = await api('/api/health');
  assert.equal(body.phase, 25);
  assert.deepEqual(body.implemented, [22,24,25]);
  assert.deepEqual(body.skipped, [19,23]);
});

test('Endpoint /api/ranking classifica partidas reais do backend', async () => {
  playerA = (await api('/api/players', { method:'POST', body: JSON.stringify({ profile:{} }) })).body.player.id;
  playerB = (await api('/api/players', { method:'POST', body: JSON.stringify({ profile:{} }) })).body.player.id;
  await api(`/api/players/${playerA}/runs`, { method:'POST', body: JSON.stringify({ run:{ score:4200, timeSeconds:180, maxWantedLevel:5, vehicleId:'MUSCLE' } }) });
  await api(`/api/players/${playerB}/runs`, { method:'POST', body: JSON.stringify({ run:{ score:7600, timeSeconds:240, maxWantedLevel:6, vehicleId:'SPORT' } }) });
  const { res, body } = await api(`/api/ranking?period=global&playerId=${playerA}`);
  assert.equal(res.status, 200);
  assert.equal(body.entries[0].playerId, playerB);
  assert.equal(body.entries[1].playerId, playerA);
  assert.equal(body.me.rank, 2);
});

let passed = 0;
try {
  for (const [name, fn] of tests) {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  }
  console.log(`\n${passed}/${tests.length} PASS`);
} finally {
  server.close();
  await once(server, 'close').catch(() => {});
  await writeFile(storeUrl, originalStore);
}
