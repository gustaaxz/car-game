import * as THREE from 'three';
import { Entity } from './Entity.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { VehicleModelFactory } from './VehicleModelFactory.js';

export class PoliceVehicle extends Entity {
  constructor(variant = 'STANDARD') {
    const root = new THREE.Group();
    super(root);
    this.config = GAME_CONFIG.police;
    this.variant = variant;
    this.performanceMultiplier = 1;
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this._target = new THREE.Vector3();
    this._desiredDirection = new THREE.Vector3();
    this._tempDirection = new THREE.Vector3();
    this.trafficManager = null;
    this._buildVisual();
  }

  _buildVisual() {
    const visualGroup = VehicleModelFactory.buildPoliceCar(this.variant);
    this.object3D.add(visualGroup);
  }

  reset(spawnOverride = null) {
    const spawn = spawnOverride ?? this.config.spawn;
    this.object3D.position.set(spawn.x, 0, spawn.z);
    this.velocity.set(0, 0, 0);
    this.heading = spawn.heading;
    this.object3D.rotation.y = this.heading;
    this._refreshAxes();
  }

  driveToward(deltaTime, target, worldCollision, speedFactor = 1) {
    if (deltaTime <= 0 || !target) return;

    const c = this.config;
    this._target.set(target.x, 0, target.z);
    this._desiredDirection.copy(this._target).sub(this.object3D.position);
    const distance = this._desiredDirection.length();

    if (distance < 0.2) {
      this.coast(deltaTime, worldCollision);
      return;
    }

    this._desiredDirection.normalize();
    this._refreshAxes();

    // Fase 12: a viatura continua seguindo o alvo tático, mas desloca levemente
    // sua direção para contornar veículos civis que estejam diretamente à frente.
    if (this.trafficManager) {
      const avoidance = this.trafficManager.getAvoidanceVector(this.object3D.position, this.forward, 13);
      if (avoidance.lengthSq() > 0.0001) this._desiredDirection.addScaledVector(avoidance, 1.55).normalize();
    }

    // O veículo tem a frente local em -Z. Converte a direção mundial para o
    // heading usando a mesma convenção de rotação Y do Three.js.
    const desiredHeading = Math.atan2(-this._desiredDirection.x, -this._desiredDirection.z);
    const angleDelta = this._normalizeAngle(desiredHeading - this.heading);
    const turnSeverity = Math.abs(angleDelta);
    const steerInput = THREE.MathUtils.clamp(angleDelta / (Math.PI * 0.34), -1, 1);

    let forwardSpeed = this.velocity.dot(this.forward);

    // A IA reduz bastante a velocidade antes de curvas fechadas em vez de "virar deslizando".
    const cornerFactor = THREE.MathUtils.clamp(1 - turnSeverity / (Math.PI * 0.78), 0.22, 1);
    const distanceFactor = THREE.MathUtils.clamp(distance / 10, 0.42, 1);
    const maxSpeed = c.maxSpeed * this.performanceMultiplier;
    const desiredSpeed = maxSpeed
      * THREE.MathUtils.clamp(speedFactor, 0.4, 1)
      * cornerFactor
      * distanceFactor;

    if (forwardSpeed > desiredSpeed + 0.8) {
      this._brakeLongitudinal(forwardSpeed, c.brakeForce, deltaTime);
    } else if (forwardSpeed < desiredSpeed) {
      const accelerationFactor = THREE.MathUtils.clamp(
        1 - Math.max(forwardSpeed, 0) / (maxSpeed * 1.4),
        0.32,
        1
      );
      this.velocity.addScaledVector(this.forward, c.acceleration * accelerationFactor * deltaTime);
    }

    forwardSpeed = this.velocity.dot(this.forward);
    this._applySteering(steerInput, forwardSpeed, deltaTime);
    this._refreshAxes();
    this._applyLateralGrip(deltaTime);
    this._applyDrag(deltaTime);
    this._clampLongitudinalSpeed(maxSpeed);

    if (this.velocity.length() < c.stopSpeed && desiredSpeed < c.stopSpeed) {
      this.velocity.set(0, 0, 0);
    }

    this.object3D.position.addScaledVector(this.velocity, deltaTime);
    this.object3D.rotation.y = this.heading;

    const collided = worldCollision.resolveCircle(
      this.object3D.position,
      this.velocity,
      c.collisionRadius,
      0.05
    );

    if (collided) this.velocity.multiplyScalar(0.68);
  }

  coast(deltaTime, worldCollision) {
    if (deltaTime <= 0) return;
    this._applyDrag(deltaTime);

    if (this.velocity.length() < this.config.stopSpeed) {
      this.velocity.set(0, 0, 0);
    }

    this.object3D.position.addScaledVector(this.velocity, deltaTime);
    const collided = worldCollision.resolveCircle(
      this.object3D.position,
      this.velocity,
      this.config.collisionRadius,
      0.05
    );

    if (collided) this.velocity.multiplyScalar(0.68);
  }

  _applySteering(steerInput, forwardSpeed, deltaTime) {
    if (Math.abs(steerInput) < 0.001) return;

    const c = this.config;
    const speed = Math.abs(forwardSpeed);
    if (speed < c.minSteerSpeed) return;

    const lowSpeedAuthority = THREE.MathUtils.clamp(speed / c.steeringFullSpeed, 0, 1);
    const speedRatio = THREE.MathUtils.clamp(speed / c.maxSpeed, 0, 1);
    const highSpeedAuthority = THREE.MathUtils.lerp(1, c.highSpeedSteerFactor, speedRatio * speedRatio);
    const direction = forwardSpeed >= 0 ? 1 : -1;

    const yawRate = c.steeringRate * lowSpeedAuthority * highSpeedAuthority * direction;
    this.heading += steerInput * yawRate * deltaTime;
  }

  _applyLateralGrip(deltaTime) {
    const lateralSpeed = this.velocity.dot(this.right);
    const correction = 1 - Math.exp(-this.config.grip * deltaTime);
    this.velocity.addScaledVector(this.right, -lateralSpeed * correction);
  }

  _brakeLongitudinal(forwardSpeed, brakeForce, deltaTime) {
    if (Math.abs(forwardSpeed) < 0.0001) return;
    const braking = Math.min(Math.abs(forwardSpeed), brakeForce * deltaTime);
    this.velocity.addScaledVector(this.forward, -Math.sign(forwardSpeed) * braking);
  }

  _applyDrag(deltaTime) {
    const speed = this.velocity.length();
    if (speed <= 0.001) return;
    const c = this.config;
    const drag = c.rollingResistance + c.aerodynamicDrag * speed * speed;
    const decel = Math.min(speed, drag * deltaTime);
    this._tempDirection.copy(this.velocity).normalize();
    this.velocity.addScaledVector(this._tempDirection, -decel);
  }

  _clampLongitudinalSpeed(maxSpeed = this.config.maxSpeed * this.performanceMultiplier) {
    const forwardSpeed = this.velocity.dot(this.forward);
    if (forwardSpeed > maxSpeed) {
      this.velocity.addScaledVector(this.forward, maxSpeed - forwardSpeed);
    }
  }

  setTrafficManager(trafficManager) {
    this.trafficManager = trafficManager ?? null;
  }

  setPerformanceMultiplier(multiplier) {
    this.performanceMultiplier = THREE.MathUtils.clamp(multiplier, 0.75, 1.45);
  }

  _refreshAxes() {
    // Mantém os eixos físicos alinhados com a orientação visual do modelo.
    this.forward.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.right.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  _normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  getSpeedKmh() {
    return this.velocity.length() * 3.6;
  }
}
