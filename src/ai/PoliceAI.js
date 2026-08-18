import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { PoliceRole } from './PoliceCoordinator.js';

export const PoliceAIState = Object.freeze({
  PATROL: 'PATROL',
  SEARCH: 'SEARCH',
  CHASE: 'CHASE',
  INTERCEPT: 'INTERCEPT',
});

export class PoliceAI {
  constructor(policeVehicle, player, cityMap) {
    this.vehicle = policeVehicle;
    this.player = player;
    this.city = cityMap;
    this.config = GAME_CONFIG.police;
    this.state = PoliceAIState.PATROL;
    this.role = PoliceRole.PURSUER;
    this.path = [];
    this.pathIndex = 0;
    this.repathTimer = 0;
    this.searchTimer = 0;
    this.lastSeenPosition = new THREE.Vector3();
    this.predictedPosition = new THREE.Vector3();
    this.tacticalTarget = new THREE.Vector3();
    this.hasTacticalTarget = false;
    this.hasVisualContact = false;
    this.jammed = false;
    this.patrolTarget = null;
    this._setRandomPatrolTarget();
  }

  reset() {
    this.state = PoliceAIState.PATROL;
    this.path = [];
    this.pathIndex = 0;
    this.repathTimer = 0;
    this.searchTimer = 0;
    this.hasVisualContact = false;
    this.jammed = false;
    this.hasTacticalTarget = false;
    this.lastSeenPosition.copy(this.player.object3D.position);
    this._setRandomPatrolTarget();
  }

  setJammed(active) {
    const next = Boolean(active);
    if (next === this.jammed) return;
    this.jammed = next;
    if (next) {
      this.hasVisualContact = false;
      this.hasTacticalTarget = false;
      this.state = PoliceAIState.SEARCH;
      this.searchTimer = Math.max(this.searchTimer, this.config.searchDuration * 0.75);
      this.path = [];
      this.pathIndex = 0;
      this.repathTimer = 0;
    }
  }

  setRole(role) {
    if (!role || role === this.role) return;
    this.role = role;
    this.path = [];
    this.pathIndex = 0;
    this.repathTimer = 0;
  }

  setTacticalTarget(target) {
    if (!target) {
      this.hasTacticalTarget = false;
      return;
    }
    this.tacticalTarget.set(target.x, 0, target.z);
    this.hasTacticalTarget = true;
  }

  receiveDispatch(position) {
    if (!position) return;
    this.lastSeenPosition.copy(position);
    this.searchTimer = this.config.searchDuration;
    if (this.state === PoliceAIState.PATROL || this.state === PoliceAIState.SEARCH) {
      this.state = this.role === PoliceRole.PURSUER ? PoliceAIState.SEARCH : PoliceAIState.INTERCEPT;
      this.path = [];
      this.pathIndex = 0;
      this.repathTimer = 0;
    }
  }

  update(deltaTime) {
    if (deltaTime <= 0) return;
    this.repathTimer -= deltaTime;

    const policePos = this.vehicle.object3D.position;
    const playerPos = this.player.object3D.position;
    const distance = policePos.distanceTo(playerPos);
    const lineOfSight = distance <= this.config.loseSightRange
      && this.city.collision.hasLineOfSight(policePos, playerPos);
    const detected = !this.jammed && distance <= this.config.detectionRange && lineOfSight;
    this.hasVisualContact = detected;

    if (detected) {
      this.lastSeenPosition.copy(playerPos);
      this.searchTimer = this.config.searchDuration;
      this.state = this.role === PoliceRole.PURSUER ? PoliceAIState.CHASE : PoliceAIState.INTERCEPT;
    } else if (this.role !== PoliceRole.PURSUER && this.hasTacticalTarget && this.searchTimer > 0) {
      this.state = PoliceAIState.INTERCEPT;
      this.searchTimer -= deltaTime;
    } else if (this.state === PoliceAIState.CHASE || this.state === PoliceAIState.INTERCEPT) {
      this.state = PoliceAIState.SEARCH;
      this.searchTimer = this.config.searchDuration;
      this.path = [];
    }

    if (this.state === PoliceAIState.PATROL) this._updatePatrol(deltaTime);
    else if (this.state === PoliceAIState.SEARCH) this._updateSearch(deltaTime);
    else if (this.state === PoliceAIState.CHASE) this._updateChase(deltaTime);
    else if (this.state === PoliceAIState.INTERCEPT) this._updateTactical(deltaTime);
  }

  _updatePatrol(deltaTime) {
    if (!this.patrolTarget) this._setRandomPatrolTarget();
    if (this.vehicle.object3D.position.distanceTo(this._asVector3(this.patrolTarget)) < 8) this._setRandomPatrolTarget();
    this._ensurePathTo(this.patrolTarget);
    this._followPath(deltaTime, 0.62);
  }

  _updateSearch(deltaTime) {
    this.searchTimer -= deltaTime;
    if (this.searchTimer <= 0) {
      this.state = PoliceAIState.PATROL;
      this.path = [];
      this._setRandomPatrolTarget();
      return;
    }

    this._ensurePathTo(this.lastSeenPosition);
    if (this.path.length === 0 || this.pathIndex >= this.path.length) {
      this.vehicle.driveToward(deltaTime, this.lastSeenPosition, this.city.collision, 0.68);
    } else {
      this._followPath(deltaTime, 0.74);
    }
  }

  _updateChase(deltaTime) {
    this._ensurePathTo(this.player.object3D.position);
    this._followPath(deltaTime, 0.97, this.player.object3D.position);
  }

  _updateTactical(deltaTime) {
    let target = this.hasTacticalTarget ? this.tacticalTarget : null;

    if (!target) {
      this.predictedPosition.copy(this.player.object3D.position)
        .addScaledVector(this.player.velocity, this.config.interceptLeadSeconds);
      this.predictedPosition.x = THREE.MathUtils.clamp(this.predictedPosition.x, this.city.bounds.minX + 5, this.city.bounds.maxX - 5);
      this.predictedPosition.z = THREE.MathUtils.clamp(this.predictedPosition.z, this.city.bounds.minZ + 5, this.city.bounds.maxZ - 5);
      target = this.predictedPosition;
    }

    const distanceToTarget = this.vehicle.object3D.position.distanceTo(target);
    if (this.role === PoliceRole.BLOCKER && distanceToTarget < 10) {
      this.vehicle.coast(deltaTime, this.city.collision);
      return;
    }

    const speedFactor = this.role === PoliceRole.INTERCEPTOR
      ? 1.0
      : this.role === PoliceRole.FLANKER
        ? 0.94
        : 0.82;

    this._ensurePathTo(target);
    this._followPath(deltaTime, speedFactor, target);
  }

  _ensurePathTo(target) {
    if (this.repathTimer > 0 && this.path.length > 0) return;
    this.path = this.city.roadNetwork.findPath(this.vehicle.object3D.position, target);
    this.pathIndex = this.path.length > 1 ? 1 : 0;
    this.repathTimer = this.config.repathInterval;
  }

  _followPath(deltaTime, speedFactor, finalTarget = null) {
    if (this.path.length === 0) {
      if (finalTarget) this.vehicle.driveToward(deltaTime, finalTarget, this.city.collision, speedFactor);
      else this.vehicle.coast(deltaTime, this.city.collision);
      return;
    }

    let waypoint = this.path[Math.min(this.pathIndex, this.path.length - 1)];
    const distance = Math.hypot(
      waypoint.x - this.vehicle.object3D.position.x,
      waypoint.z - this.vehicle.object3D.position.z
    );

    if (distance < this.config.waypointRadius && this.pathIndex < this.path.length - 1) {
      this.pathIndex += 1;
      waypoint = this.path[this.pathIndex];
    }

    if (this.pathIndex >= this.path.length - 1 && finalTarget) {
      const canApproachDirectly = this.city.collision.hasLineOfSight(
        this.vehicle.object3D.position,
        finalTarget,
        0.8
      );
      if (canApproachDirectly) waypoint = finalTarget;
    }
    this.vehicle.driveToward(deltaTime, waypoint, this.city.collision, speedFactor);
  }

  _setRandomPatrolTarget() {
    const closest = this.city.roadNetwork.getClosestNode(this.vehicle.object3D.position);
    this.patrolTarget = this.city.roadNetwork.getRandomNode(closest?.id ?? null);
    this.path = [];
    this.pathIndex = 0;
    this.repathTimer = 0;
  }

  _asVector3(point) {
    return new THREE.Vector3(point.x, 0, point.z);
  }
}
