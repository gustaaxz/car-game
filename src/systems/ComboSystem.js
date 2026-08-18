import { GAME_CONFIG } from '../config/gameConfig.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export class ComboSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.risk = 0;
    this.multiplier = 1;
    this.targetRisk = 0;
    this.nearbyPolice = 0;
    this.visualPolice = 0;
    this.lastCollisionSerial = 0;
    this.lastReason = 'Perseguição controlada';
  }

  update(deltaTime, wantedSystem, player, policeManager) {
    if (deltaTime <= 0) return;

    const playerPos = player.object3D.position;
    let nearestDistance = Infinity;
    let nearby = 0;
    let close = 0;
    let visual = 0;

    for (const unit of policeManager.units) {
      const distance = unit.vehicle.object3D.position.distanceTo(playerPos);
      nearestDistance = Math.min(nearestDistance, distance);
      if (distance <= GAME_CONFIG.combo.nearbyRadius) nearby += 1;
      if (distance <= GAME_CONFIG.combo.closeRadius) close += 1;
      if (unit.ai.hasVisualContact) visual += 1;
    }

    this.nearbyPolice = nearby;
    this.visualPolice = visual;

    const wantedFactor = clamp01((wantedSystem.getLevel() - 1) / 6);
    const speedFactor = clamp01((player.getSpeedKmh() - 35) / 75);
    const densityFactor = clamp01(nearby / 5);
    const closeFactor = clamp01(close / 3);
    const nearestFactor = Number.isFinite(nearestDistance)
      ? clamp01((GAME_CONFIG.combo.nearbyRadius - nearestDistance) / GAME_CONFIG.combo.nearbyRadius)
      : 0;
    const visualFactor = clamp01(visual / 3);

    let danger = wantedFactor * 0.24
      + speedFactor * 0.24
      + densityFactor * 0.18
      + closeFactor * 0.12
      + nearestFactor * 0.12
      + visualFactor * 0.10;

    // Sem contato próximo, o combo não deve permanecer alto apenas pelo nível de procurado.
    if (nearby === 0 && visual === 0) danger *= 0.28;

    this.targetRisk = clamp01(danger);

    // Uma colisão relevante quebra grande parte do combo e também pode gerar dano pela Fase 11.
    const collisionSerial = player.collisionSerial ?? 0;
    if (collisionSerial !== this.lastCollisionSerial) {
      this.lastCollisionSerial = collisionSerial;
      this.risk *= GAME_CONFIG.combo.collisionRetention;
      this.lastReason = 'Combo reduzido por colisão';
    }

    const sharpness = this.targetRisk > this.risk
      ? GAME_CONFIG.combo.riseSharpness
      : GAME_CONFIG.combo.decaySharpness;
    const blend = 1 - Math.exp(-sharpness * deltaTime);
    this.risk += (this.targetRisk - this.risk) * blend;

    const rawMultiplier = 1 + this.risk * (GAME_CONFIG.combo.maxMultiplier - 1);
    this.multiplier = Math.round(rawMultiplier * 10) / 10;

    if (this.multiplier >= 4) this.lastReason = 'Perseguição extrema';
    else if (this.multiplier >= 3) this.lastReason = 'Alto risco';
    else if (this.multiplier >= 2) this.lastReason = 'Pressão policial';
    else if (!this.lastReason.includes('colisão')) this.lastReason = 'Perseguição controlada';
  }

  getMultiplier() { return this.multiplier; }
  getRisk() { return this.risk; }
  getRiskPercent() { return Math.round(this.risk * 100); }
}
