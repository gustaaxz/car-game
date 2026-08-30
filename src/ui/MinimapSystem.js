import { GAME_CONFIG } from '../config/gameConfig.js';

const MAP_PADDING = 20;

export class MinimapSystem {
  constructor(canvas, city, player, policeManager, powerUpSystem) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') ?? null;
    this.city = city;
    this.player = player;
    this.police = policeManager;
    this.powerUps = powerUpSystem;
    this.mode = 'FULL';
    this.radarRange = 165;
  }

  setVisible(visible) {
    this.canvas?.closest('#minimapHud')?.classList.toggle('hidden', !visible);
  }

  toggleMode() {
    this.mode = this.mode === 'FULL' ? 'RADAR' : 'FULL';
    const label = document.querySelector('#minimapMode');
    if (label) label.textContent = this.mode === 'FULL' ? 'MAPA COMPLETO · M' : 'RADAR LOCAL · M';
    return this.mode;
  }

  update() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const playerPos = this.player.object3D.position;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    this._roundedRect(ctx, 5, 5, width - 10, height - 10, 26);
    ctx.clip();
    ctx.fillStyle = '#071016';
    ctx.fillRect(0, 0, width, height);

    if (this.mode === 'FULL') this._drawFullMap(ctx, playerPos, width, height);
    else this._drawRadar(ctx, playerPos, width, height);

    ctx.restore();
    ctx.strokeStyle = 'rgba(169, 208, 225, .48)';
    ctx.lineWidth = 3;
    this._roundedRect(ctx, 6.5, 6.5, width - 13, height - 13, 25);
    ctx.stroke();
  }

  _drawFullMap(ctx, playerPos, width, height) {
    const bounds = this.city.bounds;
    const usable = Math.min(width, height) - MAP_PADDING * 2;
    const worldSize = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    const scale = usable / worldSize;
    const toMap = (x, z) => ({
      x: width * 0.5 + (x - (bounds.minX + bounds.maxX) * 0.5) * scale,
      y: height * 0.5 + (z - (bounds.minZ + bounds.maxZ) * 0.5) * scale,
    });

    this._drawDistrictGrid(ctx, toMap);
    this._drawFullRoads(ctx, toMap, scale);

    const playerMap = toMap(playerPos.x, playerPos.z);
    ctx.strokeStyle = 'rgba(92, 231, 255, .20)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(playerMap.x, playerMap.y, this.radarRange * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    this._drawPowerUps(ctx, toMap, 4.2);
    this._drawRoadblocks(ctx, toMap, 5.4);
    this._drawPolice(ctx, toMap, 4.2);
    this._drawPlayer(ctx, playerMap.x, playerMap.y, this.player.heading ?? 0, 8.5);

    ctx.fillStyle = 'rgba(214, 234, 242, .65)';
    ctx.font = '700 15px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(worldSize)} m`, MAP_PADDING + 4, height - MAP_PADDING - 7);
  }

  _drawRadar(ctx, playerPos, width, height) {
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const radius = Math.min(width, height) * 0.46;
    const scale = radius / this.radarRange;
    const heading = this.player.heading ?? 0;
    const toMap = (x, z) => {
      const dx = x - playerPos.x;
      const dz = z - playerPos.z;
      if (Math.hypot(dx, dz) > this.radarRange * 1.42) return null;
      const sin = Math.sin(heading);
      const cos = Math.cos(heading);
      return { x: centerX + (dx * cos - dz * sin) * scale, y: centerY + (dx * sin + dz * cos) * scale };
    };

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();
    this._drawRadarRoads(ctx, playerPos, toMap, scale);
    this._drawPowerUps(ctx, toMap, 4.5);
    this._drawRoadblocks(ctx, toMap, 5.5);
    this._drawPolice(ctx, toMap, 4.5);
    this._drawPlayer(ctx, centerX, centerY, 0, 8.5);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    for (const factor of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * factor, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawDistrictGrid(ctx, toMap) {
    const roads = GAME_CONFIG.city.roadCenters;
    const roadWidth = GAME_CONFIG.city.roadWidth;
    for (let ix = 0; ix < roads.length - 1; ix++) {
      for (let iz = 0; iz < roads.length - 1; iz++) {
        const min = toMap(roads[ix] + roadWidth * 0.5, roads[iz] + roadWidth * 0.5);
        const max = toMap(roads[ix + 1] - roadWidth * 0.5, roads[iz + 1] - roadWidth * 0.5);
        const central = Math.abs((roads[ix] + roads[ix + 1]) * 0.5) < 120 && Math.abs((roads[iz] + roads[iz + 1]) * 0.5) < 120;
        ctx.fillStyle = central ? 'rgba(54, 75, 84, .72)' : ((ix + iz) % 4 === 0 ? 'rgba(38, 72, 56, .67)' : 'rgba(45, 58, 66, .70)');
        ctx.fillRect(min.x, min.y, Math.max(1, max.x - min.x), Math.max(1, max.y - min.y));
      }
    }
  }

  _drawFullRoads(ctx, toMap, scale) {
    const bounds = this.city.bounds;
    const centers = GAME_CONFIG.city.roadCenters;
    ctx.strokeStyle = 'rgba(137, 157, 166, .70)';
    ctx.lineWidth = Math.max(3, GAME_CONFIG.city.roadWidth * scale);
    for (const x of centers) this._line(ctx, toMap(x, bounds.minZ), toMap(x, bounds.maxZ));
    for (const z of centers) this._line(ctx, toMap(bounds.minX, z), toMap(bounds.maxX, z));
    ctx.strokeStyle = 'rgba(238, 206, 83, .38)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    for (const x of centers) this._line(ctx, toMap(x, bounds.minZ), toMap(x, bounds.maxZ));
    for (const z of centers) this._line(ctx, toMap(bounds.minX, z), toMap(bounds.maxX, z));
    ctx.setLineDash([]);
  }

  _drawRadarRoads(ctx, playerPos, toMap, scale) {
    const range = this.radarRange;
    ctx.strokeStyle = 'rgba(137, 157, 166, .62)';
    ctx.lineWidth = Math.max(4, GAME_CONFIG.city.roadWidth * scale);
    for (const x of GAME_CONFIG.city.roadCenters) this._line(ctx, toMap(x, playerPos.z - range * 1.4), toMap(x, playerPos.z + range * 1.4));
    for (const z of GAME_CONFIG.city.roadCenters) this._line(ctx, toMap(playerPos.x - range * 1.4, z), toMap(playerPos.x + range * 1.4, z));
  }

  _drawPolice(ctx, toMap, size) {
    for (const unit of this.police.units) {
      const pos = unit.vehicle.object3D.position;
      const point = toMap(pos.x, pos.z);
      if (!point) continue;
      ctx.fillStyle = unit.ai.hasVisualContact ? '#ff4545' : '#d7e1e6';
      ctx.beginPath();
      ctx.arc(point.x, point.y, unit.ai.hasVisualContact ? size + 1 : size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawRoadblocks(ctx, toMap, size) {
    for (const roadblock of this.police.roadblocks.getRoadblocks()) {
      const pos = roadblock.group.position;
      const point = toMap(pos.x, pos.z);
      if (!point) continue;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ff9b39';
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.restore();
    }
  }

  _drawPowerUps(ctx, toMap, size) {
    const colors = { REPAIR: '#57df76', NITRO: '#ff7a24', JAMMER: '#46d9ff', CASH: '#f2d250' };
    for (const pickup of this.powerUps.pickups) {
      const pos = pickup.group.position;
      const point = toMap(pos.x, pos.z);
      if (!point) continue;
      ctx.fillStyle = colors[pickup.type] ?? '#fff';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size);
      ctx.lineTo(point.x + size, point.y);
      ctx.lineTo(point.x, point.y + size);
      ctx.lineTo(point.x - size, point.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawPlayer(ctx, x, y, heading, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-heading);
    ctx.fillStyle = '#5ce7ff';
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.72, size * 0.68);
    ctx.lineTo(0, size * 0.34);
    ctx.lineTo(-size * 0.72, size * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  _line(ctx, a, b) {
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  _roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }
}
