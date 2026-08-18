import { GAME_CONFIG } from '../config/gameConfig.js';
import { PoliceVehicle } from '../entities/PoliceVehicle.js';
import { PoliceAI } from '../ai/PoliceAI.js';
import { PoliceCoordinator, PoliceRole } from '../ai/PoliceCoordinator.js';
import { RoadblockSystem } from './RoadblockSystem.js';
import { PoliceHelicopter } from './PoliceHelicopter.js';

export class PoliceManager {
  constructor(scene, player, city, wantedSystem, trafficManager = null) {
    this.scene = scene;
    this.player = player;
    this.city = city;
    this.wanted = wantedSystem;
    this.trafficManager = trafficManager;
    this.units = [];
    this.dispatchTimer = 0;
    this.lastProfile = null;
    this.listeners = new Set();
    this.visualPursuitActive = false;
    this.allEvadedTimer = 0;
    this.jammerTimer = 0;
    this.vehiclePool = new Map();

    this.roadblocks = new RoadblockSystem(scene, city, player);
    this.helicopter = new PoliceHelicopter(scene);
    this.coordinator = new PoliceCoordinator(player, city, this.roadblocks);
  }

  reset() {
    this._removeAllUnits();
    this.roadblocks.reset();
    this.helicopter.setActive(false);
    this.coordinator.reset();
    this.dispatchTimer = 0;
    this.lastProfile = null;
    this.visualPursuitActive = false;
    this.allEvadedTimer = 0;
    this.jammerTimer = 0;
    this._applyProfile(this.wanted.getProfile(), true);
  }

  update(deltaTime) {
    if (deltaTime <= 0) return;
    const profile = this.wanted.getProfile();
    if (profile !== this.lastProfile) this._applyProfile(profile);

    this.jammerTimer = Math.max(0, this.jammerTimer - deltaTime);
    const jammed = this.jammerTimer > 0;
    for (const unit of this.units) unit.ai.setJammed(jammed);

    this.dispatchTimer -= deltaTime;
    if (this.dispatchTimer <= 0) {
      if (!jammed) this._dispatchSearchingUnits();
      this.dispatchTimer = GAME_CONFIG.wanted.dispatchInterval;
    }

    if (!jammed) this.coordinator.update(deltaTime, this.units, profile);

    let anyVisualContact = false;
    for (const unit of this.units) {
      const distance = unit.vehicle.object3D.position.distanceTo(this.player.object3D.position);
      const interval = distance < 90 ? 0 : distance < 180 ? 0.055 : 0.12;
      unit.aiAccumulator = (unit.aiAccumulator ?? 0) + deltaTime;
      if (interval === 0 || unit.aiAccumulator >= interval) {
        const aiDt = interval === 0 ? deltaTime : unit.aiAccumulator;
        unit.aiAccumulator = 0;
        unit.ai.update(aiDt);
      }

      const hasVisual = unit.ai.hasVisualContact;
      unit.hadVisualContact = hasVisual;
      anyVisualContact ||= hasVisual;

      if (hasVisual) {
        unit.evadeArmed = true;
        unit.lostVisualTime = 0;
      } else if (unit.evadeArmed) {
        unit.lostVisualTime += deltaTime;
        if (unit.lostVisualTime >= 1.5) {
          unit.evadeArmed = false;
          unit.lostVisualTime = 0;
          this._emit({ type: 'UNIT_EVADED', role: unit.role, variant: unit.variant });
        }
      }
    }

    if (anyVisualContact) {
      this.visualPursuitActive = true;
      this.allEvadedTimer = 0;
    } else if (this.visualPursuitActive) {
      this.allEvadedTimer += deltaTime;
      if (this.allEvadedTimer >= 2.5) {
        this.visualPursuitActive = false;
        this.allEvadedTimer = 0;
        this._emit({ type: 'ALL_UNITS_EVADED' });
      }
    }

    this.roadblocks.update(deltaTime, profile);
    this.helicopter.setActive(profile.helicopter && !jammed, this.player.object3D.position);
    this.helicopter.update(deltaTime, this.player.object3D.position);
  }

  _applyProfile(profile, force = false) {
    if (!force && profile === this.lastProfile) return;
    this.lastProfile = profile;
    while (this.units.length < profile.policeCount) this._spawnUnit(profile);
    while (this.units.length > profile.policeCount) this._removeLastUnit();

    for (const unit of this.units) {
      const variantFactor = unit.variant === 'INTERCEPTOR' ? 1.04 : unit.variant === 'SPECIAL' ? 1.02 : 1;
      unit.vehicle.setPerformanceMultiplier(profile.speedMultiplier * variantFactor);
      if (!this.isJammed()) unit.ai.receiveDispatch(this.player.object3D.position);
      else unit.ai.setJammed(true);
    }

    this.coordinator.assignRoles(this.units, profile);
    this.coordinator.updateTimer = 0;
    this.helicopter.setActive(profile.helicopter && !this.isJammed(), this.player.object3D.position);
  }

  _spawnUnit(profile) {
    const index = this.units.length;
    const variant = this._variantFor(index, profile.level);
    const pool = this.vehiclePool.get(variant) ?? [];
    const vehicle = pool.pop() ?? new PoliceVehicle(variant);
    this.vehiclePool.set(variant, pool);
    const spawn = this._findSpawn(index);
    vehicle.reset(spawn);
    vehicle.object3D.visible = true;
    vehicle.setTrafficManager(this.trafficManager);

    const variantFactor = variant === 'INTERCEPTOR' ? 1.04 : variant === 'SPECIAL' ? 1.02 : 1;
    vehicle.setPerformanceMultiplier(profile.speedMultiplier * variantFactor);
    this.scene.add(vehicle.object3D);

    const ai = new PoliceAI(vehicle, this.player, this.city);
    ai.reset();
    if (!this.isJammed()) ai.receiveDispatch(this.player.object3D.position);
    else ai.setJammed(true);

    this.units.push({
      vehicle,
      ai,
      variant,
      role: PoliceRole.PURSUER,
      hadVisualContact: false,
      evadeArmed: false,
      lostVisualTime: 0,
      aiAccumulator: 0,
    });
  }

  _variantFor(index, level) {
    if (level >= 6 && index > 0 && index % 5 === 0) return 'SPECIAL';
    if (level >= 5 && index > 1 && index % 3 === 0) return 'INTERCEPTOR';
    return 'STANDARD';
  }

  _findSpawn(seed) {
    const playerPos = this.player.object3D.position;
    const cfg = GAME_CONFIG.wanted;
    const candidates = [...this.city.roadNetwork.nodes.values()]
      .map((node) => ({ node, distance: Math.hypot(node.x - playerPos.x, node.z - playerPos.z) }))
      .filter(({ distance }) => distance >= cfg.spawnMinDistance && distance <= cfg.spawnMaxDistance)
      .sort((a, b) => b.distance - a.distance);

    const used = new Set(this.units.map((unit) => this.city.roadNetwork.getClosestNode(unit.vehicle.object3D.position)?.id));
    const pool = candidates.filter(({ node }) => !used.has(node.id));
    const source = pool.length ? pool : candidates;
    const selected = source[seed % Math.max(1, source.length)]?.node;
    const fallback = selected ?? this.city.roadNetwork.getRandomNode();
    const dx = playerPos.x - fallback.x;
    const dz = playerPos.z - fallback.z;
    return { x: fallback.x, z: fallback.z, heading: Math.atan2(-dx, -dz) };
  }

  _dispatchSearchingUnits() {
    for (const unit of this.units) unit.ai.receiveDispatch(this.player.object3D.position);
  }

  _poolUnit(unit) {
    if (!unit) return;
    this.scene.remove(unit.vehicle.object3D);
    unit.vehicle.object3D.visible = false;
    const pool = this.vehiclePool.get(unit.variant) ?? [];
    pool.push(unit.vehicle);
    this.vehiclePool.set(unit.variant, pool);
  }

  _removeLastUnit() {
    const unit = this.units.pop();
    this._poolUnit(unit);
  }

  _removeAllUnits() {
    for (const unit of this.units) this._poolUnit(unit);
    this.units = [];
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emit(event) {
    for (const listener of this.listeners) listener(event, this);
  }

  getNearestUnit() {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const unit of this.units) {
      const distance = unit.vehicle.object3D.position.distanceTo(this.player.object3D.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = unit;
      }
    }
    return nearest ? { ...nearest, distance: nearestDistance } : null;
  }

  activateJammer(duration) {
    this.jammerTimer = Math.max(this.jammerTimer, Math.max(0, duration));
    for (const unit of this.units) unit.ai.setJammed(true);
  }

  isJammed() { return this.jammerTimer > 0; }
  getJammerTimeRemaining() { return this.jammerTimer; }

  getUnitCount() { return this.units.length; }
  getPoolSize() { return [...this.vehiclePool.values()].reduce((sum, pool) => sum + pool.length, 0); }

  getVariantCounts() {
    const counts = { STANDARD: 0, INTERCEPTOR: 0, SPECIAL: 0 };
    for (const unit of this.units) counts[unit.variant] = (counts[unit.variant] ?? 0) + 1;
    return counts;
  }

  getRoleCounts() {
    const counts = { PURSUER: 0, INTERCEPTOR: 0, FLANKER: 0, BLOCKER: 0 };
    for (const unit of this.units) counts[unit.role] = (counts[unit.role] ?? 0) + 1;
    return counts;
  }
}
