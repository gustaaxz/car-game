import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { TrafficVehicle } from '../entities/TrafficVehicle.js';
import { SpatialHashGrid } from './SpatialHashGrid.js';

export class TrafficManager {
  constructor(scene, city, player) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.vehicles = [];
    this._avoidance = new THREE.Vector3();
    this._scratch = new THREE.Vector3();
    this.heavyTrafficZones = [];
    this.spatialGrid = new SpatialHashGrid(24);
    this.reusedLastReset = 0;
  }

  reset() {
    this.heavyTrafficZones = [];
    const types = ['CAR','CAR','TAXI','CAR','MOTORCYCLE','CAR','CAR','TRUCK','CAR','TAXI','CAR','MOTORCYCLE','CAR','CAR','BUS','CAR','TAXI','CAR','MOTORCYCLE','TRUCK'];
    const count = GAME_CONFIG.traffic.vehicleCount;
    this.reusedLastReset = 0;

    while (this.vehicles.length > count) {
      const removed = this.vehicles.pop();
      this.scene.remove(removed.object3D);
    }

    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      let vehicle = this.vehicles[i];
      if (!vehicle || vehicle.type !== type) {
        if (vehicle) this.scene.remove(vehicle.object3D);
        vehicle = new TrafficVehicle(type);
        this.vehicles[i] = vehicle;
        this.scene.add(vehicle.object3D);
      } else {
        this.reusedLastReset += 1;
        if (!vehicle.object3D.parent) this.scene.add(vehicle.object3D);
      }
      const spawn = this._findSpawn(i);
      const route = this._routeFromSpawn(spawn, i);
      vehicle.reset(spawn, route);
      vehicle._perfAccumulator = 0;
      vehicle.object3D.visible = true;
    }
    this.spatialGrid.rebuild(this.vehicles);
  }

  update(deltaTime, policeManager = null) {
    if (deltaTime <= 0) return;
    this.spatialGrid.rebuild(this.vehicles);
    const playerPos = this.player.object3D.position;

    for (const vehicle of this.vehicles) {
      const distance = vehicle.object3D.position.distanceTo(playerPos);
      const interval = distance < 80 ? 0 : distance < 160 ? 0.065 : 0.14;
      vehicle._perfAccumulator = (vehicle._perfAccumulator ?? 0) + deltaTime;
      if (interval === 0 || vehicle._perfAccumulator >= interval) {
        const dt = interval === 0 ? deltaTime : vehicle._perfAccumulator;
        vehicle._perfAccumulator = 0;
        vehicle.update(dt, this.city, this, policeManager);
      }
    }

    this.spatialGrid.rebuild(this.vehicles);
    this._resolveTrafficSpacing();
    this.spatialGrid.rebuild(this.vehicles);
  }

  assignNewRoute(vehicle) {
    const start = this.city.roadNetwork.getClosestNode(vehicle.object3D.position);
    let target = this.city.roadNetwork.getRandomNode(start?.id ?? null);
    let attempts = 0;
    while (target && start && this._manhattanNodes(start, target) < 110 && attempts < 8) {
      target = this.city.roadNetwork.getRandomNode(start.id);
      attempts += 1;
    }
    const path = target ? this.city.roadNetwork.findPath(vehicle.object3D.position, target) : [];
    vehicle.setRoute(this._offsetRoute(path));
  }

  getTrafficSpeedFactor(vehicle) {
    let factor = 1;
    for (const zone of this.heavyTrafficZones) {
      const dx = vehicle.object3D.position.x - zone.x;
      const dz = vehicle.object3D.position.z - zone.z;
      if (dx * dx + dz * dz <= zone.radius * zone.radius) factor = Math.min(factor, zone.speedFactor);
    }
    vehicle._refreshAxes?.();
    const nearby = this.spatialGrid.query(vehicle.object3D.position, GAME_CONFIG.traffic.followDistance);
    for (const other of nearby) {
      if (other === vehicle) continue;
      this._scratch.copy(other.object3D.position).sub(vehicle.object3D.position);
      const distance = this._scratch.length();
      if (distance > GAME_CONFIG.traffic.followDistance || distance < 0.001) continue;
      this._scratch.multiplyScalar(1 / distance);
      const ahead = this._scratch.dot(vehicle.forward);
      if (ahead < 0.68) continue;
      if (distance < 4.5) return 0.08;
      factor = Math.min(factor, THREE.MathUtils.clamp((distance - 4) / 8, 0.25, 1));
    }
    return factor;
  }

  getAvoidanceVector(position, forward, radius = 14) {
    this._avoidance.set(0, 0, 0);
    const nearby = this.spatialGrid.query(position, radius);
    for (const traffic of nearby) {
      this._scratch.copy(position).sub(traffic.object3D.position);
      this._scratch.y = 0;
      const distance = this._scratch.length();
      if (distance <= 0.001 || distance > radius) continue;
      const toTraffic = this._scratch.clone().multiplyScalar(-1 / distance);
      if (toTraffic.dot(forward) < 0.2) continue;
      const weight = (radius - distance) / radius;
      this._avoidance.addScaledVector(this._scratch.normalize(), weight * weight);
    }
    return this._avoidance;
  }

  queryNearby(position, radius) { return this.spatialGrid.query(position, radius); }

  setHeavyTrafficZones(zones = []) { this.heavyTrafficZones = zones.map((zone) => ({ ...zone })); }
  getHeavyTrafficZoneCount() { return this.heavyTrafficZones.length; }

  getCountByType() {
    const counts = { CAR: 0, TAXI: 0, MOTORCYCLE: 0, TRUCK: 0, BUS: 0 };
    for (const vehicle of this.vehicles) counts[vehicle.type] = (counts[vehicle.type] ?? 0) + 1;
    return counts;
  }

  _findSpawn(seed) {
    const nodes = [...this.city.roadNetwork.nodes.values()];
    const safe = nodes.filter((node) => Math.hypot(node.x - this.player.object3D.position.x, node.z - this.player.object3D.position.z) > 28);
    const source = safe.length ? safe : nodes;
    const node = source[(seed * 7 + 3) % Math.max(1, source.length)];
    const next = node?.neighbors?.length ? this.city.roadNetwork.nodes.get(node.neighbors[seed % node.neighbors.length]) : null;
    const dx = (next?.x ?? node.x) - node.x;
    const dz = (next?.z ?? node.z) - node.z;
    const heading = Math.atan2(-dx, -dz);
    const laneOffset = GAME_CONFIG.traffic.laneOffset;
    const length = Math.hypot(dx, dz) || 1;
    const rightX = -dz / length;
    const rightZ = dx / length;
    return { x: node.x + rightX * laneOffset, z: node.z + rightZ * laneOffset, heading };
  }

  _routeFromSpawn(spawn, seed) {
    const start = this.city.roadNetwork.getClosestNode(spawn);
    const nodes = [...this.city.roadNetwork.nodes.values()];
    const target = nodes[(seed * 11 + 9) % nodes.length];
    const path = this.city.roadNetwork.findPath(spawn, target);
    return this._offsetRoute(path.length > 1 ? path : [start, target].filter(Boolean));
  }

  _offsetRoute(path) {
    if (!path || path.length < 2) return path ?? [];
    const offset = GAME_CONFIG.traffic.laneOffset;
    const result = [];
    for (let i = 0; i < path.length; i++) {
      const previous = path[Math.max(0, i - 1)];
      const next = path[Math.min(path.length - 1, i + 1)];
      const dx = next.x - previous.x;
      const dz = next.z - previous.z;
      const length = Math.hypot(dx, dz) || 1;
      result.push({ x: path[i].x + (-dz / length) * offset, z: path[i].z + (dx / length) * offset });
    }
    return result;
  }

  _resolveTrafficSpacing() {
    const seen = new Set();
    for (const a of this.vehicles) {
      const nearby = this.spatialGrid.query(a.object3D.position, 7);
      for (const b of nearby) {
        if (a === b) continue;
        const key = a.collisionId < b.collisionId ? `${a.collisionId}|${b.collisionId}` : `${b.collisionId}|${a.collisionId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        this._scratch.copy(a.object3D.position).sub(b.object3D.position);
        this._scratch.y = 0;
        const minDistance = a.collisionRadius + b.collisionRadius;
        const distanceSq = this._scratch.lengthSq();
        if (distanceSq >= minDistance * minDistance || distanceSq < 0.000001) continue;
        const distance = Math.sqrt(distanceSq);
        this._scratch.multiplyScalar(1 / distance);
        const overlap = minDistance - distance;
        a.object3D.position.addScaledVector(this._scratch, overlap * 0.5);
        b.object3D.position.addScaledVector(this._scratch, -overlap * 0.5);
        a.velocity.multiplyScalar(0.72);
        b.velocity.multiplyScalar(0.72);
      }
    }
  }

  _manhattanNodes(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.z - b.z); }
}
