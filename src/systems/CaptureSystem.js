import { GAME_CONFIG } from '../config/gameConfig.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export class CaptureSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.progress = 0;
    this.pressure = 0;
    this.captured = false;
    this.nearbyPolice = 0;
    this.surroundingSectors = 0;
    this.status = 'LIVRE';
  }

  update(deltaTime, player, policeManager) {
    if (deltaTime <= 0 || this.captured) return;

    const cfg = GAME_CONFIG.capture;
    const playerPos = player.object3D.position;
    const sectors = new Set();
    let nearest = Infinity;
    let near8 = 0;
    let near16 = 0;
    let near24 = 0;
    let visual = 0;

    for (const unit of policeManager.units) {
      const policePos = unit.vehicle.object3D.position;
      const dx = policePos.x - playerPos.x;
      const dz = policePos.z - playerPos.z;
      const distance = Math.hypot(dx, dz);
      nearest = Math.min(nearest, distance);

      if (distance <= 8) near8 += 1;
      if (distance <= 16) near16 += 1;
      if (distance <= cfg.pressureRadius) {
        near24 += 1;
        const angle = Math.atan2(dz, dx) + Math.PI;
        const sector = Math.floor((angle / (Math.PI * 2)) * cfg.sectorCount) % cfg.sectorCount;
        sectors.add(sector);
      }
      if (unit.ai.hasVisualContact) visual += 1;
    }

    this.nearbyPolice = near24;
    this.surroundingSectors = sectors.size;

    const speedKmh = player.getSpeedKmh();
    const proximity = Number.isFinite(nearest) ? clamp01((cfg.pressureRadius - nearest) / cfg.pressureRadius) : 0;
    const density = clamp01(near16 / 4);
    const surrounded = clamp01(sectors.size / 5);
    const stopped = clamp01(1 - speedKmh / cfg.escapeSpeedKmh);
    const visualFactor = clamp01(visual / 3);
    const blocked = player.lastCollisionLabel === 'police-roadblock' ? 1 : 0;

    let pressure = proximity * 0.26
      + density * 0.22
      + surrounded * 0.22
      + stopped * 0.16
      + visualFactor * 0.09
      + blocked * 0.05;

    if (near8 >= 2 && speedKmh < 15) pressure += 0.18;
    if (near24 === 0 || visual === 0) pressure *= 0.25;
    if (speedKmh >= cfg.fastEscapeSpeedKmh) pressure *= 0.45;
    this.pressure = clamp01(pressure);

    if (this.pressure >= cfg.captureThreshold) {
      const normalizedPressure = clamp01((this.pressure - cfg.captureThreshold) / (1 - cfg.captureThreshold));
      const rate = cfg.minCaptureRate + (cfg.maxCaptureRate - cfg.minCaptureRate) * normalizedPressure;
      this.progress += rate * deltaTime;
    } else {
      const speedEscape = clamp01(speedKmh / cfg.fastEscapeSpeedKmh);
      const decay = cfg.baseDecayRate + cfg.speedDecayBonus * speedEscape;
      this.progress -= decay * deltaTime;
    }

    this.progress = Math.max(0, Math.min(100, this.progress));
    this.captured = this.progress >= 100;

    if (this.captured) this.status = 'CAPTURADO';
    else if (this.progress >= 75) this.status = 'CERCO CRÍTICO';
    else if (this.progress >= 40) this.status = 'SENDO CERCADO';
    else if (this.pressure >= cfg.captureThreshold) this.status = 'SOB PRESSÃO';
    else this.status = 'ESCAPANDO';
  }

  getProgress() { return this.progress; }
  getProgressPercent() { return Math.round(this.progress); }
  isCaptured() { return this.captured; }
}
