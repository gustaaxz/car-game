import * as THREE from 'three';
import { Entity } from './Entity.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

export class PlayerVehicle extends Entity {
  constructor() {
    const root = new THREE.Group();
    super(root);

    this.config = GAME_CONFIG.player;
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this._tempVelocityDirection = new THREE.Vector3();
    this.lastCollisionLabel = null;
    this.collisionSerial = 0;
    this.collisionEventCooldown = 0;
    this.lastCollisionEvent = null;
    this.damagePerformance = { maxSpeedFactor: 1, accelerationFactor: 1, steeringFactor: 1 };
    this.vehicleProfile = { speedFactor: 1, accelerationFactor: 1, steeringFactor: 1, gripFactor: 1, resistanceFactor: 1, scaleX: 1, scaleZ: 1 };
    this.vehicleId = 'COMPACT';
    this.nitroTimer = 0;
    this.nitroSpeedMultiplier = 1;
    this.nitroAccelerationMultiplier = 1;
    this._buildVisual();
  }

  _buildVisual() {
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xb51624, roughness: 0.55, metalness: 0.2 });
    this.bodyMaterial = bodyMaterial;
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x17212a, roughness: 0.25, metalness: 0.25 });
    const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.62, 4.2), bodyMaterial);
    body.position.y = 0.62;
    body.castShadow = true;
    this.object3D.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.62, 1.8), glassMaterial);
    cabin.position.set(0, 1.2, 0.15);
    cabin.castShadow = true;
    this.object3D.add(cabin);

    const wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18);
    wheelGeometry.rotateZ(Math.PI / 2);
    const wheelPositions = [
      [-0.98, 0.38, -1.35], [0.98, 0.38, -1.35],
      [-0.98, 0.38, 1.35], [0.98, 0.38, 1.35],
    ];

    for (const [x, y, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeometry, tireMaterial);
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      this.object3D.add(wheel);
    }
  }

  reset() {
    const spawn = this.config.spawn;
    this.object3D.position.set(spawn.x, 0, spawn.z);
    this.velocity.set(0, 0, 0);
    this.heading = spawn.heading;
    this.lastCollisionLabel = null;
    this.collisionSerial = 0;
    this.collisionEventCooldown = 0;
    this.lastCollisionEvent = null;
    this.damagePerformance = { maxSpeedFactor: 1, accelerationFactor: 1, steeringFactor: 1 };
    this.nitroTimer = 0;
    this.nitroSpeedMultiplier = 1;
    this.nitroAccelerationMultiplier = 1;
    this.object3D.rotation.y = this.heading;
    this._refreshAxes();
  }

  update(deltaTime, input, worldCollision) {
    if (deltaTime <= 0) return;

    const c = this.config;
    this.nitroTimer = Math.max(0, this.nitroTimer - deltaTime);
    const nitroActive = this.nitroTimer > 0;
    const nitroSpeed = nitroActive ? this.nitroSpeedMultiplier : 1;
    const nitroAcceleration = nitroActive ? this.nitroAccelerationMultiplier : 1;
    const maxForwardSpeed = c.maxForwardSpeed * this.vehicleProfile.speedFactor * this.damagePerformance.maxSpeedFactor * nitroSpeed;
    const maxReverseSpeed = c.maxReverseSpeed * (0.92 + this.vehicleProfile.speedFactor * 0.08) * (0.78 + this.damagePerformance.maxSpeedFactor * 0.22);
    const acceleration = c.acceleration * this.vehicleProfile.accelerationFactor * this.damagePerformance.accelerationFactor * nitroAcceleration;
    const reverseAcceleration = c.reverseAcceleration * this.vehicleProfile.accelerationFactor * this.damagePerformance.accelerationFactor;
    this.collisionEventCooldown = Math.max(0, this.collisionEventCooldown - deltaTime);
    this.lastCollisionLabel = null;
    this._refreshAxes();

    const accelerate = input.isDown('KeyW') || input.isDown('ArrowUp');
    const brakeOrReverse = input.isDown('KeyS') || input.isDown('ArrowDown');
    const steerLeft = input.isDown('KeyA') || input.isDown('ArrowLeft');
    const steerRight = input.isDown('KeyD') || input.isDown('ArrowRight');
    const handbrake = input.isDown('Space');

    let forwardSpeed = this.velocity.dot(this.forward);

    // W acelera para frente. Se o carro ainda estiver em ré, W primeiro o desacelera.
    if (accelerate) {
      if (forwardSpeed < -c.reverseEngageSpeed) {
        this._brakeLongitudinal(forwardSpeed, c.brakeForce, deltaTime);
      } else {
        const accelerationFactor = THREE.MathUtils.clamp(
          1 - Math.max(forwardSpeed, 0) / (maxForwardSpeed * 1.35),
          0.28,
          1
        );
        this.velocity.addScaledVector(this.forward, acceleration * accelerationFactor * deltaTime);
      }
    }

    // S freia enquanto o carro vai para frente. Só depois de quase parar começa a ré.
    if (brakeOrReverse) {
      forwardSpeed = this.velocity.dot(this.forward);
      if (forwardSpeed > c.reverseEngageSpeed) {
        this._brakeLongitudinal(forwardSpeed, c.brakeForce, deltaTime);
      } else {
        const reverseFactor = THREE.MathUtils.clamp(
          1 - Math.max(-forwardSpeed, 0) / (maxReverseSpeed * 1.2),
          0.34,
          1
        );
        this.velocity.addScaledVector(this.forward, -reverseAcceleration * reverseFactor * deltaTime);
      }
    }

    forwardSpeed = this.velocity.dot(this.forward);
    // Convenção de rotação do Three.js: rotação Y positiva vira o eixo frontal (-Z) para a esquerda (-X).
    // Portanto, esquerda precisa ser positiva e direita negativa para o visual e a física coincidirem.
    const steerInput = Number(steerLeft) - Number(steerRight);
    this._applySteering(steerInput, forwardSpeed, handbrake, deltaTime);

    // Após mudar o heading, os eixos locais precisam ser recalculados antes da aderência.
    this._refreshAxes();
    this._applyLateralGrip(deltaTime, handbrake);

    if (handbrake && this.velocity.lengthSq() > 0.01) {
      const handbrakeDecel = Math.min(this.velocity.length(), c.handbrakeDrag * deltaTime);
      this._tempVelocityDirection.copy(this.velocity).normalize();
      this.velocity.addScaledVector(this._tempVelocityDirection, -handbrakeDecel);
    }

    this._applyDrag(deltaTime, c);
    this._clampLongitudinalSpeed(c, maxForwardSpeed, maxReverseSpeed);

    if (!accelerate && !brakeOrReverse && this.velocity.length() < c.stopSpeed) {
      this.velocity.set(0, 0, 0);
    }

    this.object3D.position.addScaledVector(this.velocity, deltaTime);
    this.object3D.rotation.y = this.heading;

    const impactSpeedKmh = this.velocity.length() * 3.6;
    const collision = worldCollision.resolveCircleDetailed(
      this.object3D.position,
      this.velocity,
      c.collisionRadius * Math.max(this.vehicleProfile.scaleX, this.vehicleProfile.scaleZ),
      c.collisionRestitution
    );

    if (collision.collided) {
      this.lastCollisionLabel = collision.label;
      this.velocity.multiplyScalar(0.82);
      this.registerExternalCollision(collision.label, impactSpeedKmh);
    }
  }

  _applySteering(steerInput, forwardSpeed, handbrake, deltaTime) {
    if (steerInput === 0) return;

    const c = this.config;
    const speed = Math.abs(forwardSpeed);
    if (speed < c.minSteerSpeed) return;

    const lowSpeedAuthority = THREE.MathUtils.clamp(speed / c.steeringFullSpeed, 0, 1);
    const effectiveMaxSpeed = c.maxForwardSpeed * this.vehicleProfile.speedFactor * this.damagePerformance.maxSpeedFactor;
    const speedRatio = THREE.MathUtils.clamp(speed / effectiveMaxSpeed, 0, 1);
    const highSpeedAuthority = THREE.MathUtils.lerp(1, c.highSpeedSteerFactor, speedRatio * speedRatio);
    const reverseDirection = forwardSpeed >= 0 ? 1 : -1;
    const handbrakeBoost = handbrake ? c.handbrakeTurnBoost : 1;

    const yawRate = c.steeringRate * this.vehicleProfile.steeringFactor * this.damagePerformance.steeringFactor
      * lowSpeedAuthority
      * highSpeedAuthority
      * handbrakeBoost
      * reverseDirection;

    this.heading += steerInput * yawRate * deltaTime;
  }

  _applyLateralGrip(deltaTime, handbrake) {
    const c = this.config;
    const lateralSpeed = this.velocity.dot(this.right);
    const grip = (handbrake ? c.handbrakeGrip : c.grip) * this.vehicleProfile.gripFactor;
    const correction = 1 - Math.exp(-grip * deltaTime);
    this.velocity.addScaledVector(this.right, -lateralSpeed * correction);
  }

  _brakeLongitudinal(forwardSpeed, brakeForce, deltaTime) {
    if (Math.abs(forwardSpeed) < 0.0001) return;
    const braking = Math.min(Math.abs(forwardSpeed), brakeForce * deltaTime);
    this.velocity.addScaledVector(this.forward, -Math.sign(forwardSpeed) * braking);
  }

  _refreshAxes() {
    // O modelo aponta para -Z quando heading = 0. Estes vetores precisam usar
    // exatamente a mesma convenção da matriz de rotação Y do Three.js.
    this.forward.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.right.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  _applyDrag(deltaTime, c) {
    const speed = this.velocity.length();
    if (speed <= 0.001) return;
    const drag = c.rollingResistance + c.aerodynamicDrag * speed * speed;
    const decel = Math.min(speed, drag * deltaTime);
    this._tempVelocityDirection.copy(this.velocity).normalize();
    this.velocity.addScaledVector(this._tempVelocityDirection, -decel);
  }

  _clampLongitudinalSpeed(c, maxForwardSpeed = c.maxForwardSpeed, maxReverseSpeed = c.maxReverseSpeed) {
    const forwardSpeed = this.velocity.dot(this.forward);
    if (forwardSpeed > maxForwardSpeed) {
      this.velocity.addScaledVector(this.forward, maxForwardSpeed - forwardSpeed);
    } else if (forwardSpeed < -maxReverseSpeed) {
      this.velocity.addScaledVector(this.forward, -maxReverseSpeed - forwardSpeed);
    }
  }

  registerExternalCollision(label, impactSpeedKmh = 0) {
    this.lastCollisionLabel = label;
    if (this.collisionEventCooldown > 0) return false;
    this.collisionSerial += 1;
    this.collisionEventCooldown = 0.35;
    this.lastCollisionEvent = {
      serial: this.collisionSerial,
      label,
      impactSpeedKmh: Math.max(0, impactSpeedKmh),
    };
    return true;
  }


  applyVehicleProfile(vehicle = {}) {
    const profile = vehicle.profile ?? vehicle;
    this.vehicleId = vehicle.id ?? this.vehicleId;
    this.vehicleProfile = {
      speedFactor: Math.max(0.7, profile.speedFactor ?? 1),
      accelerationFactor: Math.max(0.7, profile.accelerationFactor ?? 1),
      steeringFactor: Math.max(0.7, profile.steeringFactor ?? 1),
      gripFactor: Math.max(0.7, profile.gripFactor ?? 1),
      resistanceFactor: Math.max(0.5, profile.resistanceFactor ?? 1),
      scaleX: Math.max(0.8, profile.scaleX ?? 1),
      scaleZ: Math.max(0.8, profile.scaleZ ?? 1),
    };
    if (vehicle.color != null && this.bodyMaterial?.color?.setHex) this.bodyMaterial.color.setHex(vehicle.color);
    this.object3D.scale.set(this.vehicleProfile.scaleX, 1, this.vehicleProfile.scaleZ);
  }

  getVehicleId() { return this.vehicleId; }
  getVehicleProfile() { return { ...this.vehicleProfile }; }
  getDamageResistanceFactor() { return this.vehicleProfile.resistanceFactor; }

  setDamagePerformance({ maxSpeedFactor = 1, accelerationFactor = 1, steeringFactor = 1 } = {}) {
    this.damagePerformance.maxSpeedFactor = THREE.MathUtils.clamp(maxSpeedFactor, 0.45, 1);
    this.damagePerformance.accelerationFactor = THREE.MathUtils.clamp(accelerationFactor, 0.45, 1);
    this.damagePerformance.steeringFactor = THREE.MathUtils.clamp(steeringFactor, 0.55, 1);
  }

  activateNitro(duration, speedMultiplier, accelerationMultiplier) {
    this.nitroTimer = Math.max(this.nitroTimer, Math.max(0, duration));
    this.nitroSpeedMultiplier = Math.max(1, speedMultiplier ?? 1);
    this.nitroAccelerationMultiplier = Math.max(1, accelerationMultiplier ?? 1);
  }

  isNitroActive() { return this.nitroTimer > 0; }
  getNitroTimeRemaining() { return this.nitroTimer; }

  getSpeedKmh() {
    return this.velocity.length() * 3.6;
  }
}
