import { GAME_CONFIG } from '../config/gameConfig.js';

export class MinimapSystem {
  constructor(canvas, city, player, policeManager, powerUpSystem) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') ?? null;
    this.city = city;
    this.player = player;
    this.police = policeManager;
    this.powerUps = powerUpSystem;
    this.radarRange = 150;
    this.worldScale = (canvas?.width ?? 220) / (this.radarRange * 2);
  }

  setVisible(visible) {
    this.canvas?.closest('#minimapHud')?.classList.toggle('hidden', !visible);
  }

  update() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const playerPos = this.player.object3D.position;
    const heading = this.player.heading ?? 0;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, width * 0.48, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(8, 13, 17, 0.94)';
    ctx.fillRect(0, 0, width, height);
    this._drawRoads(ctx, playerPos, heading, centerX, centerY);
    this._drawRangeRings(ctx, centerX, centerY);
    this._drawPowerUps(ctx, playerPos, heading, centerX, centerY);
    this._drawRoadblocks(ctx, playerPos, heading, centerX, centerY);
    this._drawPolice(ctx, playerPos, heading, centerX, centerY);
    this._drawPlayer(ctx, centerX, centerY);

    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.26)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, width * 0.48, 0, Math.PI * 2);
    ctx.stroke();
  }

  _toRadar(worldX, worldZ, playerPos, heading, centerX, centerY) {
    const dx = worldX - playerPos.x;
    const dz = worldZ - playerPos.z;
    const distance = Math.hypot(dx, dz);
    if (distance > this.radarRange) return null;

    // Rotaciona o mundo para manter a direção do ladrão apontada para cima no radar.
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    return {
      x: centerX + rx * this.worldScale,
      y: centerY + rz * this.worldScale,
      distance,
    };
  }

  _drawRoads(ctx, playerPos, heading, centerX, centerY) {
    const centers = GAME_CONFIG.city.roadCenters;
    ctx.strokeStyle = 'rgba(126, 145, 156, .42)';
    ctx.lineWidth = Math.max(4, GAME_CONFIG.city.roadWidth * this.worldScale * 0.22);
    ctx.lineCap = 'round';

    for (const roadX of centers) {
      const a = this._toRadar(roadX, playerPos.z - this.radarRange, playerPos, heading, centerX, centerY);
      const b = this._toRadar(roadX, playerPos.z + this.radarRange, playerPos, heading, centerX, centerY);
      this._strokeClampedLine(ctx, roadX, playerPos.z - this.radarRange, roadX, playerPos.z + this.radarRange, playerPos, heading, centerX, centerY, a, b);
    }
    for (const roadZ of centers) {
      this._strokeClampedLine(ctx, playerPos.x - this.radarRange, roadZ, playerPos.x + this.radarRange, roadZ, playerPos, heading, centerX, centerY);
    }
  }

  _strokeClampedLine(ctx, x1, z1, x2, z2, playerPos, heading, centerX, centerY, pointA = null, pointB = null) {
    // Pontos das extremidades ficam exatamente no limite do radar, então a conversão é válida.
    const a = pointA ?? this._toRadar(x1, z1, playerPos, heading, centerX, centerY);
    const b = pointB ?? this._toRadar(x2, z2, playerPos, heading, centerX, centerY);
    if (!a || !b) {
      // Converte sem descarte para linhas que atravessam o radar mas começam fora do círculo.
      const raw = (x, z) => {
        const dx = x - playerPos.x;
        const dz = z - playerPos.z;
        const sin = Math.sin(heading);
        const cos = Math.cos(heading);
        return { x: centerX + (dx * cos - dz * sin) * this.worldScale, y: centerY + (dx * sin + dz * cos) * this.worldScale };
      };
      const ra = raw(x1, z1), rb = raw(x2, z2);
      ctx.beginPath(); ctx.moveTo(ra.x, ra.y); ctx.lineTo(rb.x, rb.y); ctx.stroke();
      return;
    }
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  _drawRangeRings(ctx, centerX, centerY) {
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    for (const factor of [0.33, 0.66]) {
      ctx.beginPath(); ctx.arc(centerX, centerY, this.canvas.width * 0.48 * factor, 0, Math.PI * 2); ctx.stroke();
    }
  }

  _drawPolice(ctx, playerPos, heading, centerX, centerY) {
    for (const unit of this.police.units) {
      const pos = unit.vehicle.object3D.position;
      const radar = this._toRadar(pos.x, pos.z, playerPos, heading, centerX, centerY);
      if (!radar) continue;
      ctx.fillStyle = unit.ai.hasVisualContact ? '#ff4545' : '#e7e7e7';
      ctx.beginPath(); ctx.arc(radar.x, radar.y, unit.ai.hasVisualContact ? 4.4 : 3.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  _drawRoadblocks(ctx, playerPos, heading, centerX, centerY) {
    for (const roadblock of this.police.roadblocks.getRoadblocks()) {
      const pos = roadblock.group.position;
      const radar = this._toRadar(pos.x, pos.z, playerPos, heading, centerX, centerY);
      if (!radar) continue;
      ctx.save(); ctx.translate(radar.x, radar.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#ff9b39'; ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    }
  }

  _drawPowerUps(ctx, playerPos, heading, centerX, centerY) {
    const colors = { REPAIR: '#57df76', NITRO: '#ff7a24', JAMMER: '#46d9ff', CASH: '#f2d250' };
    for (const pickup of this.powerUps.pickups) {
      const pos = pickup.group.position;
      const radar = this._toRadar(pos.x, pos.z, playerPos, heading, centerX, centerY);
      if (!radar) continue;
      ctx.fillStyle = colors[pickup.type] ?? '#fff';
      ctx.beginPath();
      ctx.moveTo(radar.x, radar.y - 4.5); ctx.lineTo(radar.x + 4.5, radar.y); ctx.lineTo(radar.x, radar.y + 4.5); ctx.lineTo(radar.x - 4.5, radar.y); ctx.closePath(); ctx.fill();
    }
  }

  _drawPlayer(ctx, centerX, centerY) {
    ctx.fillStyle = '#5ce7ff';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 8);
    ctx.lineTo(centerX + 6, centerY + 6);
    ctx.lineTo(centerX, centerY + 3);
    ctx.lineTo(centerX - 6, centerY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.stroke();
  }
}
