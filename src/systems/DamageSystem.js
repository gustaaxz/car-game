import { GAME_CONFIG } from '../config/gameConfig.js';

export class DamageSystem {
  constructor(player) {
    this.player = player;
    this.integrity = 100;
    this.lastConsumedCollisionSerial = 0;
    this.lastDamage = null;
    this.damageHistory = [];
  }

  reset() {
    this.integrity = 100;
    this.lastConsumedCollisionSerial = 0;
    this.lastDamage = null;
    this.damageHistory = [];
    this._applyPerformance();
  }

  update() {
    const event = this.player.lastCollisionEvent;
    if (!event || event.serial <= this.lastConsumedCollisionSerial) return;
    this.lastConsumedCollisionSerial = event.serial;
    this.applyCollision(event.label, event.impactSpeedKmh);
  }

  applyCollision(label, impactSpeedKmh = 0) {
    const rawDamage = this._calculateDamage(label, impactSpeedKmh);
    if (rawDamage <= 0) return 0;
    const resistance = Math.max(0.5, this.player.getDamageResistanceFactor?.() ?? 1);
    const damage = Math.max(1, Math.round(rawDamage / resistance));

    this.integrity = Math.max(0, this.integrity - damage);
    this.lastDamage = {
      label,
      damage,
      impactSpeedKmh,
      integrity: this.integrity,
    };
    this.damageHistory.push(this.lastDamage);
    if (this.damageHistory.length > 12) this.damageHistory.shift();
    this._applyPerformance();
    return damage;
  }

  _calculateDamage(label, speedKmh) {
    const cfg = GAME_CONFIG.damage;
    const speed = Math.max(0, speedKmh);

    if (label === 'civilian-vehicle') {
      return this._scale(cfg.civilianCar, speed, 38, 1.55);
    }
    if (label === 'police-vehicle') {
      return this._scale(cfg.policeCar, speed, 42, 1.6);
    }
    if (label === 'police-roadblock') {
      return this._scale(cfg.roadblock, speed, 48, 1.45);
    }
    if (['street-pole', 'tree', 'gas-pump'].includes(label)) {
      return this._scale(cfg.pole, speed, 50, 1.55);
    }
    if (['container', 'monument', 'bridge-rail'].includes(label)) {
      return this._scale(cfg.heavyObject, speed, 45, 1.55);
    }
    if (['building', 'tunnel-wall', 'boundary'].includes(label)) {
      if (speed >= cfg.highSpeedWallThresholdKmh) return cfg.highSpeedWall;
      return this._scale(cfg.wall, speed, 35, 1.7);
    }
    return this._scale(cfg.other, speed, 45, 1.45);
  }

  _scale(base, speedKmh, referenceKmh, maxFactor) {
    if (speedKmh < 8) return 1;
    const factor = Math.min(maxFactor, Math.max(1, speedKmh / referenceKmh));
    return Math.max(1, Math.round(base * factor));
  }

  _applyPerformance() {
    const ratio = this.integrity / 100;
    const cfg = GAME_CONFIG.damage.performance;
    const maxSpeedFactor = cfg.minMaxSpeedFactor + (1 - cfg.minMaxSpeedFactor) * Math.sqrt(ratio);
    const accelerationFactor = cfg.minAccelerationFactor + (1 - cfg.minAccelerationFactor) * ratio;
    const steeringFactor = cfg.minSteeringFactor + (1 - cfg.minSteeringFactor) * Math.sqrt(ratio);
    this.player.setDamagePerformance({ maxSpeedFactor, accelerationFactor, steeringFactor });
  }

  repair(amount = 0) {
    const before = this.integrity;
    this.integrity = Math.min(100, this.integrity + Math.max(0, amount));
    this._applyPerformance();
    return this.integrity - before;
  }

  getIntegrity() { return this.integrity; }
  getIntegrityPercent() { return Math.round(this.integrity); }
  isCritical() { return this.integrity <= GAME_CONFIG.damage.criticalIntegrity; }
}
