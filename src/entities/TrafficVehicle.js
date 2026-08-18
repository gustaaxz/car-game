import * as THREE from 'three';
import { Entity } from './Entity.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

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
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.spec.color, roughness: 0.58, metalness: 0.12 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d2a32, roughness: 0.28, metalness: 0.2 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.96 });

    if (this.type === 'MOTORCYCLE') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.35), bodyMat);
      body.position.y = 0.62;
      body.castShadow = true;
      this.object3D.add(body);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.72), glassMat);
      seat.position.set(0, 0.92, 0.2);
      this.object3D.add(seat);
      const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 16);
      wheelGeo.rotateZ(Math.PI / 2);
      for (const z of [-0.82, 0.82]) {
        const wheel = new THREE.Mesh(wheelGeo, tireMat);
        wheel.position.set(0, 0.35, z);
        wheel.castShadow = true;
        this.object3D.add(wheel);
      }
      return;
    }

    const body = new THREE.Mesh(new THREE.BoxGeometry(this.spec.width, this.spec.height, this.spec.length), bodyMat);
    body.position.y = this.spec.height * 0.72;
    body.castShadow = true;
    this.object3D.add(body);

    if (this.type === 'BUS') {
      const upper = new THREE.Mesh(new THREE.BoxGeometry(this.spec.width * 0.92, 1.4, this.spec.length * 0.84), glassMat);
      upper.position.set(0, 1.85, 0);
      upper.castShadow = true;
      this.object3D.add(upper);
    } else if (this.type === 'TRUCK') {
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(this.spec.width * 0.92, 1.35, 1.9), glassMat);
      cabin.position.set(0, 1.55, -1.85);
      cabin.castShadow = true;
      this.object3D.add(cabin);
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(this.spec.width * 0.96, 1.85, 3.6), bodyMat);
      cargo.position.set(0, 1.55, 1.1);
      cargo.castShadow = true;
      this.object3D.add(cargo);
    } else {
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(this.spec.width * 0.82, 0.62, this.spec.cabin), glassMat);
      cabin.position.set(0, 1.15, 0.08);
      cabin.castShadow = true;
      this.object3D.add(cabin);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const halfW = this.spec.width * 0.52;
    const axle = this.spec.length * 0.32;
    for (const [x, z] of [[-halfW, -axle], [halfW, -axle], [-halfW, axle], [halfW, axle]]) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(x, 0.35, z);
      wheel.castShadow = true;
      this.object3D.add(wheel);
    }

    if (this.type === 'TAXI') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0xf4e6aa }));
      sign.position.set(0, 1.55, 0);
      this.object3D.add(sign);
    }
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
