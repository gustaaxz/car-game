import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.js';

export const DynamicEventType = Object.freeze({ ACCIDENT: 'ACCIDENT', ROADWORKS: 'ROADWORKS', HEAVY_TRAFFIC: 'HEAVY_TRAFFIC' });

export class DynamicEventSystem {
  constructor(scene, city, player, trafficManager, policeManager) {
    this.scene = scene; this.city = city; this.player = player; this.traffic = trafficManager; this.police = policeManager;
    this.activeEvents = []; this.nextEventTimer = GAME_CONFIG.events.initialDelay; this.nextId = 1;
    this.eventCycle = [DynamicEventType.ACCIDENT, DynamicEventType.ROADWORKS, DynamicEventType.HEAVY_TRAFFIC];
    this.eventCycleIndex = 0; this.lastEvent = null;
  }
  reset() {
    for (const event of [...this.activeEvents]) this._removeEvent(event);
    this.activeEvents = []; this.traffic.setHeavyTrafficZones([]); this.nextEventTimer = GAME_CONFIG.events.initialDelay;
    this.nextId = 1; this.eventCycleIndex = 0; this.lastEvent = null;
  }
  update(deltaTime) {
    if (deltaTime <= 0) return;
    for (const event of [...this.activeEvents]) { event.remaining -= deltaTime; if (event.remaining <= 0) this._removeEvent(event); }
    this.activeEvents = this.activeEvents.filter((event) => event.remaining > 0); this._syncTrafficZones();
    this.nextEventTimer -= deltaTime;
    if (this.nextEventTimer <= 0 && this.activeEvents.length < GAME_CONFIG.events.maxActive) {
      const type = this.eventCycle[this.eventCycleIndex++ % this.eventCycle.length]; this.triggerEvent(type); this.nextEventTimer = this._randomInterval();
    }
  }
  triggerEvent(type, forcedSegment = null) {
    const segment = forcedSegment ?? this._pickRoadSegment(); if (!segment) return null;
    let event = null;
    if (type === DynamicEventType.ACCIDENT) event = this._createAccident(segment);
    else if (type === DynamicEventType.ROADWORKS) event = this._createRoadworks(segment);
    else if (type === DynamicEventType.HEAVY_TRAFFIC) event = this._createHeavyTraffic(segment);
    if (!event) return null;
    this.activeEvents.push(event); this.lastEvent = { type: event.type, label: event.label }; this._syncTrafficZones(); return event;
  }
  _createAccident(segment) {
    const group = new THREE.Group(); group.name = 'DynamicAccident'; group.position.set(segment.x, 0, segment.z); group.rotation.y = segment.heading;
    const red = new THREE.MeshStandardMaterial({ color: 0x9e2430, roughness: 0.65 }); const gray = new THREE.MeshStandardMaterial({ color: 0x6f7a83, roughness: 0.72 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x151a1f, roughness: 0.9 }); const orange = new THREE.MeshStandardMaterial({ color: 0xe9781d, roughness: 0.75 });
    const makeCar = (material, x, z, rot) => { const car = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 4.2), material); body.position.y = 0.62; const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.58, 1.8), dark); cabin.position.set(0, 1.15, 0.08); car.add(body, cabin); car.position.set(x, 0, z); car.rotation.y = rot; group.add(car); };
    makeCar(red, -2.2, 0.35, 0.48); makeCar(gray, 2.0, -0.25, -0.62);
    for (const x of [-5, -3.4, 3.4, 5]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 9), orange); cone.position.set(x, 0.45, 2.4); group.add(cone); }
    this.scene.add(group);
    const handles = this._addSegmentCollision(segment, [{ along: -2.2, lateral: 0.35, halfAlong: 2.15, halfLateral: 1.05 }, { along: 2.0, lateral: -0.25, halfAlong: 2.15, halfLateral: 1.05 }], 'dynamic-accident');
    return { id: `event-${this.nextId++}`, type: DynamicEventType.ACCIDENT, label: 'ACIDENTE NA VIA', remaining: GAME_CONFIG.events.accidentDuration, group, collisionHandles: handles, segment };
  }
  _createRoadworks(segment) {
    const group = new THREE.Group(); group.name = 'DynamicRoadworks'; group.position.set(segment.x, 0, segment.z); group.rotation.y = segment.heading;
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xe9e9e9, roughness: 0.8 }); const orange = new THREE.MeshStandardMaterial({ color: 0xf07d21, roughness: 0.78 }); const yellow = new THREE.MeshStandardMaterial({ color: 0xf1c536, roughness: 0.7 });
    for (const x of [-5.2, -2.6, 0, 2.6, 5.2]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.05, 10), orange); cone.position.set(x, 0.52, -2.6); group.add(cone); }
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.9, 0.7), barrierMat); barrier.position.set(0, 0.55, -1.25); group.add(barrier);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.18), yellow); sign.position.set(-5.2, 1.4, -1.25); sign.rotation.z = Math.PI / 4; group.add(sign); this.scene.add(group);
    const handles = this._addSegmentCollision(segment, [{ along: 0, lateral: -1.25, halfAlong: 4.4, halfLateral: 0.42 }], 'dynamic-roadworks');
    return { id: `event-${this.nextId++}`, type: DynamicEventType.ROADWORKS, label: 'OBRAS NA VIA', remaining: GAME_CONFIG.events.roadworksDuration, group, collisionHandles: handles, segment };
  }
  _createHeavyTraffic(segment) {
    const group = new THREE.Group(); group.name = 'DynamicHeavyTraffic'; group.position.set(segment.x, 0.08, segment.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.25, 48), new THREE.MeshBasicMaterial({ color: 0xf0b429, transparent: true, opacity: 0.34, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; group.add(ring); this.scene.add(group);
    return { id: `event-${this.nextId++}`, type: DynamicEventType.HEAVY_TRAFFIC, label: 'TRÂNSITO INTENSO', remaining: GAME_CONFIG.events.heavyTrafficDuration, group, collisionHandles: [], segment, trafficZone: { x: segment.x, z: segment.z, radius: GAME_CONFIG.events.heavyTrafficRadius, speedFactor: GAME_CONFIG.events.heavyTrafficSpeedFactor } };
  }
  _addSegmentCollision(segment, specs, label) {
    const handles = []; const alongX = Math.sin(-segment.heading); const alongZ = -Math.cos(segment.heading); const rightX = -alongZ; const rightZ = alongX;
    for (const spec of specs) { const cx = segment.x + alongX * spec.along + rightX * spec.lateral; const cz = segment.z + alongZ * spec.along + rightZ * spec.lateral; const alongMostlyX = Math.abs(alongX) > Math.abs(alongZ); const halfX = alongMostlyX ? spec.halfAlong : spec.halfLateral; const halfZ = alongMostlyX ? spec.halfLateral : spec.halfAlong; handles.push(this.city.collision.addBox(cx - halfX, cx + halfX, cz - halfZ, cz + halfZ, label)); }
    return handles;
  }
  _removeEvent(event) { if (event.group) this.scene.remove(event.group); for (const handle of event.collisionHandles ?? []) this.city.collision.removeObstacle(handle); event.remaining = 0; }
  _syncTrafficZones() { this.traffic.setHeavyTrafficZones(this.activeEvents.filter((event) => event.remaining > 0 && event.trafficZone).map((event) => event.trafficZone)); }
  _pickRoadSegment() {
    const nodes = [...this.city.roadNetwork.nodes.values()]; const player = this.player.object3D.position; const candidates = [];
    for (const node of nodes) for (const neighborId of node.neighbors) { if (node.id > neighborId) continue; const neighbor = this.city.roadNetwork.nodes.get(neighborId); const x = (node.x + neighbor.x) * 0.5; const z = (node.z + neighbor.z) * 0.5; const distance = Math.hypot(x - player.x, z - player.z); if (distance < 60 || distance > 270) continue; const dx = neighbor.x - node.x; const dz = neighbor.z - node.z; candidates.push({ x, z, heading: Math.atan2(-dx, -dz), nodeA: node, nodeB: neighbor }); }
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }
  _randomInterval() { const cfg = GAME_CONFIG.events; return cfg.intervalMin + Math.random() * (cfg.intervalMax - cfg.intervalMin); }
  getActiveEvents() { return this.activeEvents; }
  getActiveLabels() { const labels = this.activeEvents.map((event) => event.label); if (this.police?.roadblocks?.getCount?.() > 0) labels.unshift('BLOQUEIO POLICIAL'); return labels; }
}
