export const VEHICLE_CATALOG = Object.freeze([
  Object.freeze({
    id: 'COMPACT', name: 'Compacto', description: 'Ágil e equilibrado para escapar por ruas urbanas.',
    price: 0, requiredLevel: 1, color: 0xb51624,
    stats: { speed: 72, acceleration: 78, control: 88, resistance: 62 },
    profile: { speedFactor: 1.00, accelerationFactor: 1.06, steeringFactor: 1.13, gripFactor: 1.06, resistanceFactor: 1.00, scaleX: 0.94, scaleZ: 0.94 },
  }),
  Object.freeze({
    id: 'MUSCLE', name: 'Muscle', description: 'Aceleração forte e boa resistência, com direção mais pesada.',
    price: 1800, requiredLevel: 2, color: 0x294e9b,
    stats: { speed: 82, acceleration: 88, control: 63, resistance: 82 },
    profile: { speedFactor: 1.08, accelerationFactor: 1.15, steeringFactor: 0.91, gripFactor: 0.97, resistanceFactor: 1.20, scaleX: 1.05, scaleZ: 1.04 },
  }),
  Object.freeze({
    id: 'SPORT', name: 'Esportivo', description: 'Velocidade máxima elevada e resposta rápida, mas pouca resistência.',
    price: 2800, requiredLevel: 3, color: 0xe6a51b,
    stats: { speed: 96, acceleration: 94, control: 79, resistance: 48 },
    profile: { speedFactor: 1.18, accelerationFactor: 1.20, steeringFactor: 1.04, gripFactor: 1.03, resistanceFactor: 0.82, scaleX: 0.98, scaleZ: 1.04 },
  }),
  Object.freeze({
    id: 'SUV', name: 'SUV', description: 'Muito resistente e estável, porém pesado e menos veloz.',
    price: 2400, requiredLevel: 3, color: 0x3b5c47,
    stats: { speed: 67, acceleration: 61, control: 65, resistance: 96 },
    profile: { speedFactor: 0.94, accelerationFactor: 0.88, steeringFactor: 0.88, gripFactor: 1.10, resistanceFactor: 1.48, scaleX: 1.10, scaleZ: 1.07 },
  }),
]);

export class GarageSystem {
  constructor(player, progression) {
    this.player = player;
    this.progression = progression;
  }

  getVehicles() { return VEHICLE_CATALOG; }
  getVehicle(id) { return VEHICLE_CATALOG.find((vehicle) => vehicle.id === id) ?? VEHICLE_CATALOG[0]; }
  getSelectedVehicle() { return this.getVehicle(this.progression.getSelectedVehicleId()); }

  getState(id) {
    const vehicle = this.getVehicle(id);
    const unlocked = this.progression.isVehicleUnlocked(vehicle.id);
    const levelMet = this.progression.getLevel() >= vehicle.requiredLevel;
    const affordable = this.progression.getCash() >= vehicle.price;
    return { vehicle, unlocked, selected: this.progression.getSelectedVehicleId() === vehicle.id, levelMet, affordable, canBuy: !unlocked && levelMet && affordable };
  }

  purchase(id) {
    const state = this.getState(id);
    if (state.unlocked) return { ok: true, reason: 'ALREADY_UNLOCKED' };
    if (!state.levelMet) return { ok: false, reason: 'LEVEL_REQUIRED' };
    if (!state.affordable) return { ok: false, reason: 'INSUFFICIENT_CASH' };
    if (!this.progression.spendCash(state.vehicle.price)) return { ok: false, reason: 'INSUFFICIENT_CASH' };
    this.progression.unlockVehicle(state.vehicle.id);
    return { ok: true, reason: 'PURCHASED' };
  }

  select(id) {
    if (!this.progression.selectVehicle(id)) return false;
    this.applySelectedVehicle();
    return true;
  }

  purchaseAndSelect(id) {
    const purchase = this.purchase(id);
    if (!purchase.ok) return purchase;
    this.select(id);
    return purchase;
  }

  applySelectedVehicle() {
    const vehicle = this.getSelectedVehicle();
    this.player.applyVehicleProfile(vehicle);
    return vehicle;
  }
}
