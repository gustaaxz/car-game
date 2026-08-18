import * as THREE from 'three';

export const PoliceRole = Object.freeze({
  PURSUER: 'PURSUER',
  INTERCEPTOR: 'INTERCEPTOR',
  FLANKER: 'FLANKER',
  BLOCKER: 'BLOCKER',
});

export class PoliceCoordinator {
  constructor(player, city, roadblocks) {
    this.player = player;
    this.city = city;
    this.roadblocks = roadblocks;
    this.updateTimer = 0;
    this.updateInterval = 0.42;
    this._playerForward = new THREE.Vector3(0, 0, -1);
    this._playerRight = new THREE.Vector3(1, 0, 0);
    this._scratch = new THREE.Vector3();
  }

  reset() {
    this.updateTimer = 0;
    this.roadblocks.setStrategicNodes([]);
  }

  assignRoles(units, profile) {
    const blockerCount = Math.min(profile.roadblocks, Math.max(0, units.length - 1));
    const tacticalCount = units.length - blockerCount;
    const cycle = [PoliceRole.PURSUER, PoliceRole.INTERCEPTOR, PoliceRole.FLANKER];

    for (let i = 0; i < units.length; i++) {
      const role = i >= tacticalCount ? PoliceRole.BLOCKER : cycle[i % cycle.length];
      units[i].role = role;
      units[i].ai.setRole(role);
    }
  }

  update(deltaTime, units, profile) {
    if (deltaTime <= 0 || units.length === 0) return;
    this.updateTimer -= deltaTime;
    if (this.updateTimer > 0) return;
    this.updateTimer = this.updateInterval;

    this._refreshPlayerAxes();
    const blockerUnits = units.filter((unit) => unit.role === PoliceRole.BLOCKER);
    const blockerNodes = this._chooseBlockerNodes(blockerUnits.length);
    this.roadblocks.setStrategicNodes(blockerNodes);

    let flankerSide = -1;
    let blockerIndex = 0;
    for (const unit of units) {
      if (unit.role === PoliceRole.PURSUER) {
        unit.ai.setTacticalTarget(this.player.object3D.position);
      } else if (unit.role === PoliceRole.INTERCEPTOR) {
        unit.ai.setTacticalTarget(this._getInterceptTarget(unit));
      } else if (unit.role === PoliceRole.FLANKER) {
        unit.ai.setTacticalTarget(this._getFlankTarget(flankerSide));
        flankerSide *= -1;
      } else if (unit.role === PoliceRole.BLOCKER) {
        const node = blockerNodes[blockerIndex++] ?? this.city.roadNetwork.getClosestNode(this.player.object3D.position);
        unit.ai.setTacticalTarget(node ?? this.player.object3D.position);
      }
    }
  }

  _refreshPlayerAxes() {
    const speed = this.player.velocity.length();
    if (speed > 1.2) this._playerForward.copy(this.player.velocity).normalize();
    else this._playerForward.set(-Math.sin(this.player.heading), 0, -Math.cos(this.player.heading));
    this._playerRight.set(-this._playerForward.z, 0, this._playerForward.x);
  }

  _getInterceptTarget(unit) {
    const playerPos = this.player.object3D.position;
    const playerSpeed = this.player.velocity.length();
    const distance = unit.vehicle.object3D.position.distanceTo(playerPos);
    const leadSeconds = THREE.MathUtils.clamp(1.1 + distance / 75, 1.15, 2.8);
    const leadScale = THREE.MathUtils.clamp(playerSpeed / 12, 0.65, 1.25);
    this._scratch.copy(playerPos).addScaledVector(this.player.velocity, leadSeconds * leadScale);
    return this._clampToCity(this._scratch.clone());
  }

  _getFlankTarget(side) {
    const playerPos = this.player.object3D.position;
    const speed = this.player.velocity.length();
    const ahead = THREE.MathUtils.clamp(18 + speed * 1.25, 22, 52);
    const lateral = 42 * side;
    const desired = playerPos.clone()
      .addScaledVector(this._playerForward, ahead)
      .addScaledVector(this._playerRight, lateral);
    this._clampToCity(desired);
    const node = this.city.roadNetwork.getClosestNode(desired);
    return node ? { x: node.x, z: node.z } : desired;
  }

  _chooseBlockerNodes(count) {
    if (count <= 0) return [];
    const playerPos = this.player.object3D.position;
    const candidates = [...this.city.roadNetwork.nodes.values()]
      .map((node) => {
        const dx = node.x - playerPos.x;
        const dz = node.z - playerPos.z;
        const forward = dx * this._playerForward.x + dz * this._playerForward.z;
        const lateral = Math.abs(dx * this._playerRight.x + dz * this._playerRight.z);
        const distance = Math.hypot(dx, dz);
        const score = Math.abs(forward - 78) + lateral * 0.55 + Math.abs(distance - 82) * 0.22;
        return { node, forward, distance, score };
      })
      .filter(({ forward, distance }) => forward > 28 && distance > 58 && distance < 260)
      .sort((a, b) => a.score - b.score);

    const chosen = [];
    for (const candidate of candidates) {
      if (chosen.some((node) => Math.hypot(node.x - candidate.node.x, node.z - candidate.node.z) < 55)) continue;
      chosen.push(candidate.node);
      if (chosen.length >= count) break;
    }
    return chosen;
  }

  _clampToCity(position) {
    position.x = THREE.MathUtils.clamp(position.x, this.city.bounds.minX + 6, this.city.bounds.maxX - 6);
    position.z = THREE.MathUtils.clamp(position.z, this.city.bounds.minZ + 6, this.city.bounds.maxZ - 6);
    return position;
  }
}
