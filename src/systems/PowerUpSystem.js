import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.js';

export const PowerUpType = Object.freeze({ REPAIR: 'REPAIR', NITRO: 'NITRO', JAMMER: 'JAMMER', CASH: 'CASH' });

export class PowerUpSystem {
  constructor(scene, city, player, damageSystem, policeManager, scoreSystem) { this.scene = scene; this.city = city; this.player = player; this.damage = damageSystem; this.police = policeManager; this.score = scoreSystem; this.pickups = []; this.respawnQueue = []; this.nextId = 1; this.lastPickup = null; }
  reset() { this._clear(); this.respawnQueue = []; this.nextId = 1; this.lastPickup = null; for (const type of Object.values(PowerUpType)) this._spawn(type); }
  update(deltaTime) {
    if (deltaTime <= 0) return; const playerPos = this.player.object3D.position;
    for (const pickup of [...this.pickups]) { pickup.age += deltaTime; pickup.group.rotation.y += deltaTime * 1.8; pickup.icon.position.y = 1.4 + Math.sin(pickup.age * 3.2) * 0.18; const distance = Math.hypot(pickup.group.position.x - playerPos.x, pickup.group.position.z - playerPos.z); if (distance <= GAME_CONFIG.powerUps.pickupRadius) this._collect(pickup); }
    for (const item of this.respawnQueue) item.remaining -= deltaTime; const ready = this.respawnQueue.filter((item) => item.remaining <= 0); this.respawnQueue = this.respawnQueue.filter((item) => item.remaining > 0); for (const item of ready) this._spawn(item.type);
  }
  _collect(pickup) {
    const cfg = GAME_CONFIG.powerUps; let label = pickup.type; let value = 0;
    if (pickup.type === PowerUpType.REPAIR) { value = this.damage.repair(cfg.repairAmount); label = value > 0 ? `REPARO +${Math.round(value)}%` : 'REPARO — INTEGRIDADE CHEIA'; }
    else if (pickup.type === PowerUpType.NITRO) { this.player.activateNitro(cfg.nitroDuration, cfg.nitroSpeedMultiplier, cfg.nitroAccelerationMultiplier); value = cfg.nitroDuration; label = `NITRO ${cfg.nitroDuration}s`; }
    else if (pickup.type === PowerUpType.JAMMER) { this.police.activateJammer(cfg.jammerDuration); value = cfg.jammerDuration; label = `JAMMER ${cfg.jammerDuration}s`; }
    else if (pickup.type === PowerUpType.CASH) { this.score.awardBonus('CASH_PICKUP', cfg.cashPoints, 'Dinheiro coletado'); value = cfg.cashPoints; label = `DINHEIRO +${cfg.cashPoints}`; }
    this.lastPickup = { type: pickup.type, label, value }; this.scene.remove(pickup.group); this.pickups = this.pickups.filter((item) => item !== pickup); this.respawnQueue.push({ type: pickup.type, remaining: cfg.respawnDelay });
  }
  _spawn(type) {
    const position = this._findSpawnPosition(); if (!position) return null; const group = new THREE.Group(); group.name = `PowerUp-${type}`; group.position.set(position.x, 0, position.z);
    const color = { REPAIR: 0x46d66b, NITRO: 0xff7a24, JAMMER: 0x39c9ef, CASH: 0xf0c63a }[type]; const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.34, roughness: 0.4, metalness: 0.2 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.18, 24), new THREE.MeshStandardMaterial({ color: 0x161c22, roughness: 0.86 })); base.position.y = 0.12; group.add(base);
    let icon;
    if (type === PowerUpType.REPAIR) { icon = new THREE.Group(); icon.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.25, 0.34), material), new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.34, 0.34), material)); }
    else if (type === PowerUpType.NITRO) { icon = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 16), material); icon.rotation.z = Math.PI / 2; }
    else if (type === PowerUpType.JAMMER) { icon = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), material); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.08, 10, 28), material); ring.rotation.x = Math.PI / 2; icon.add(core, ring); }
    else icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.68), material);
    icon.position.y = 1.4; group.add(icon); const halo = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.3, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.34, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05; group.add(halo);
    this.scene.add(group); const pickup = { id: `powerup-${this.nextId++}`, type, group, icon, age: Math.random() * 2 }; this.pickups.push(pickup); return pickup;
  }
  _findSpawnPosition() {
    const nodes = [...this.city.roadNetwork.nodes.values()]; const playerPos = this.player.object3D.position;
    const candidates = nodes.filter((node) => { const distance = Math.hypot(node.x - playerPos.x, node.z - playerPos.z); if (distance < 38) return false; return this.pickups.every((pickup) => Math.hypot(node.x - pickup.group.position.x, node.z - pickup.group.position.z) > 48); });
    const node = candidates[Math.floor(Math.random() * candidates.length)] ?? nodes[0]; if (!node) return null; const offset = (this.nextId % 2 === 0 ? 1 : -1) * 5.6; const horizontal = this.nextId % 3 !== 0; return { x: node.x + (horizontal ? 0 : offset), z: node.z + (horizontal ? offset : 0) };
  }
  _clear() { for (const pickup of this.pickups) this.scene.remove(pickup.group); this.pickups = []; }
  getActiveCount() { return this.pickups.length; }
  getActiveTypes() { return this.pickups.map((pickup) => pickup.type); }
}
