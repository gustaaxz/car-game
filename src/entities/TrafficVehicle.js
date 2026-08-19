import * as THREE from 'three';
import { Entity } from './Entity.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { VehicleModelFactory } from './VehicleModelFactory.js';

const TYPE_CONFIG = Object.freeze({
  CAR:        { length: 3.9, width: 1.75, height: 0.6, cabin: 1.55, speed: 13.2, radius: 1.35, color: 0x58718a },
  TAXI:       { length: 4.05, width: 1.78, height: 0.62, cabin: 1.6, speed: 14.0, radius: 1.38, color: 0xe2b932 },
  MOTORCYCLE: { length: 2.25, width: 0.72, height: 0.55, cabin: 0.0, speed: 16.2, radius: 0.8, color: 0x2f3035 },
  TRUCK:      { length: 6.4, width: 2.25, height: 1.15, cabin: 1.55, speed: 9.8, radius: 2.05, color: 0x8e4d3e },
  BUS:        { length: 8.0, width: 2.35, height: 1.55, cabin: 0.0, speed: 9.0, radius: 2.35, color: 0x3f7b61 },
});

let TRAFFIC_ID = 1;

export class TrafficVehicle extends Entity {
  constructor(type = 'CAR') {
    const root = new THREE.Group();
    super(root);
    this.type = TYPE_CONFIG[type] ? type : 'CAR';
    this.spec = TYPE_CONFIG[this.type];
    this.collisionId = `traffic-${TRAFFIC_ID++}`;
    this.collisionRadius = this.spec.radius;
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.route = [];
    this.routeIndex = 0;
    this.targetSpeed = this.spec.speed;
    this._desired = new THREE.Vector3();
    this._temp = new THREE.Vector3();
    this._buildVisual();
  }

  _buildVisual() {
    const visualGroup = VehicleModelFactory.buildTrafficVehicle(this.type, this.spec.color);
    this.object3D.add(visualGroup);
  }

  reset(spawn, route) {
    this.object3D.position.set(spawn.x, 0, spawn.z);
    this.heading = spawn.heading ?? 0;
    this.object3D.rotation.y = this.heading;
    this.velocity.set(0, 0, 0);
    this.route = route ?? [];
    this.routeIndex = this.route.length > 1 ? 1 : 0;
    this._refreshAxes();
  }

  setRoute(route) {
    this.route = route ?? [];
    this.routeIndex = this.route.length > 1 ? 1 : 0;
  }

  update(deltaTime, city, trafficManager, policeManager) {
    if (deltaTime <= 0 || this.route.length === 0) return;
    let target = this.route[Math.min(this.routeIndex, this.route.length - 1)];
    if (!target) return;

    const distance = Math.hypot(target.x - this.object3D.position.x, target.z - this.object3D.position.z);
    if (distance < GAME_CONFIG.traffic.waypointRadius) {
      if (this.routeIndex < this.route.length - 1) {
        this.routeIndex += 1;
        target = this.route[this.routeIndex];
      } else {
        trafficManager.assignNewRoute(this);
        target = this.route[Math.min(this.routeIndex, this.route.length - 1)] ?? target;
      }
    }

    this._desired.set(target.x, 0, target.z).sub(this.object3D.position);
    if (this._desired.lengthSq() < 0.01) return;
    this._desired.normalize();
    this._refreshAxes();

    const desiredHeading = Math.atan2(-this._desired.x, -this._desired.z);
    const angleDelta = this._normalizeAngle(desiredHeading - this.heading);
    const steerInput = THREE.MathUtils.clamp(angleDelta / 0.7, -1, 1);

    const forwardSpeed = this.velocity.dot(this.forward);
    const trafficFactor = trafficManager.getTrafficSpeedFactor(this);
    const policeFactor = this._getPoliceYieldFactor(policeManager);
    const cornerFactor = THREE.MathUtils.clamp(1 - Math.abs(angleDelta) / 1.5, 0.28, 1);
    const desiredSpeed = this.targetSpeed * trafficFactor * policeFactor * cornerFactor;

    if (forwardSpeed < desiredSpeed) {
      this.velocity.addScaledVector(this.forward, GAME_CONFIG.traffic.acceleration * deltaTime);
    } else if (forwardSpeed > desiredSpeed + 0.4) {
      const braking = Math.min(forwardSpeed, GAME_CONFIG.traffic.brakeForce * deltaTime);
      this.velocity.addScaledVector(this.forward, -braking);
    }

    const speed = Math.abs(this.velocity.dot(this.forward));
    if (speed > 0.35) {
      const authority = THREE.MathUtils.clamp(speed / 5, 0.18, 1);
      this.heading += steerInput * GAME_CONFIG.traffic.steeringRate * authority * deltaTime;
    }

    this._refreshAxes();
    const lateral = this.velocity.dot(this.right);
    const grip = 1 - Math.exp(-GAME_CONFIG.traffic.grip * deltaTime);
    this.velocity.addScaledVector(this.right, -lateral * grip);

    const currentForward = this.velocity.dot(this.forward);
    if (currentForward > this.targetSpeed * 1.05) {
      this.velocity.addScaledVector(this.forward, this.targetSpeed * 1.05 - currentForward);
    }

    const drag = Math.min(this.velocity.length(), GAME_CONFIG.traffic.rollingResistance * deltaTime);
    if (drag > 0.0001) {
      this._temp.copy(this.velocity).normalize();
      this.velocity.addScaledVector(this._temp, -drag);
    }

    this.object3D.position.addScaledVector(this.velocity, deltaTime);
    this.object3D.rotation.y = this.heading;
    const collided = city.collision.resolveCircle(this.object3D.position, this.velocity, this.collisionRadius, 0.03);
    if (collided) this.velocity.multiplyScalar(0.45);
  }

  _getPoliceYieldFactor(policeManager) {
    if (!policeManager) return 1;
    let closest = Infinity;
    for (const unit of policeManager.units) {
      const d = unit.vehicle.object3D.position.distanceTo(this.object3D.position);
      if (d < closest) closest = d;
    }
    if (closest < 6) return 0.22;
    if (closest < 12) return 0.55;
    return 1;
  }

  _refreshAxes() {
    this.forward.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.right.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  _normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}
