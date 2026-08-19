import * as THREE from 'three';
import { Entity } from './Entity.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

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
    const palette = {
      STANDARD: { body: 0xf1f1f1, stripe: 0x11171c },
      INTERCEPTOR: { body: 0x263746, stripe: 0xe8ecef },
      SPECIAL: { body: 0x15191d, stripe: 0x5d6870 },
    }[this.variant] ?? { body: 0xf1f1f1, stripe: 0x11171c };

    const white = new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.4, metalness: 0.22 });
    const dark = new THREE.MeshStandardMaterial({ color: palette.stripe, roughness: 0.32, metalness: 0.22 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.96 });
    const red = new THREE.MeshStandardMaterial({ color: 0xd81e2b, emissive: 0x5d070d, emissiveIntensity: 1.4 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x1d57dc, emissive: 0x071b5d, emissiveIntensity: 1.4 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.22, metalness: 0.78 });
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfffce6, emissive: 0xfff4c2, emissiveIntensity: 0.7, roughness: 0.3 });
    const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85, metalness: 0.05 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0d1a24, roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.88 });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.56, 4.45), white);
    body.position.y = 0.58;
    body.castShadow = true;
    this.object3D.add(body);

    // Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.16, 1.4), white);
    hood.position.set(0, 0.92, -1.35);
    hood.rotation.x = -0.06;
    hood.castShadow = true;
    this.object3D.add(hood);

    // Trunk
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.14, 1.05), white);
    trunk.position.set(0, 0.91, 1.5);
    trunk.castShadow = true;
    this.object3D.add(trunk);

    // Roof
    const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 1.7), white);
    roofPanel.position.set(0, 1.5, 0.1);
    roofPanel.castShadow = true;
    this.object3D.add(roofPanel);

    // Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.56, 0.06), glassMat);
    windshield.position.set(0, 1.24, -0.58);
    windshield.rotation.x = 0.5;
    this.object3D.add(windshield);

    // Rear window
    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.46, 0.06), glassMat);
    rearWindow.position.set(0, 1.24, 0.9);
    rearWindow.rotation.x = -0.46;
    this.object3D.add(rearWindow);

    // Side windows
    const sideWinGeo = new THREE.BoxGeometry(0.05, 0.4, 1.35);
    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(sideWinGeo, glassMat);
      sw.position.set(side * 0.8, 1.24, 0.1);
      this.object3D.add(sw);
    }

    // Police stripe on body sides
    const stripeGeo = new THREE.BoxGeometry(0.06, 0.22, 2.8);
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(stripeGeo, dark);
      stripe.position.set(side * 0.97, 0.72, 0.2);
      this.object3D.add(stripe);
    }

    // Front push bar (police bumper guard)
    const pushBarVert = new THREE.BoxGeometry(0.12, 0.52, 0.12);
    const pushBarHoriz = new THREE.BoxGeometry(1.65, 0.1, 0.12);
    for (const side of [-0.72, 0.72]) {
      const bar = new THREE.Mesh(pushBarVert, chrome);
      bar.position.set(side, 0.46, -2.35);
      bar.castShadow = true;
      this.object3D.add(bar);
    }
    const topBar = new THREE.Mesh(pushBarHoriz, chrome);
    topBar.position.set(0, 0.7, -2.35);
    this.object3D.add(topBar);
    const midBar = new THREE.Mesh(pushBarHoriz, chrome);
    midBar.position.set(0, 0.46, -2.35);
    this.object3D.add(midBar);

    // Front bumper
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.26, 0.28), blackPlastic);
    frontBumper.position.set(0, 0.4, -2.28);
    frontBumper.castShadow = true;
    this.object3D.add(frontBumper);

    // Rear bumper
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 0.26), blackPlastic);
    rearBumper.position.set(0, 0.4, 2.28);
    rearBumper.castShadow = true;
    this.object3D.add(rearBumper);

    // Headlights
    const headlightGeo = new THREE.BoxGeometry(0.36, 0.2, 0.12);
    for (const side of [-0.64, 0.64]) {
      const hl = new THREE.Mesh(headlightGeo, headlightMat);
      hl.position.set(side, 0.64, -2.16);
      this.object3D.add(hl);
    }

    // Taillights
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xcc1122, emissive: 0x991010, emissiveIntensity: 0.5 });
    const taillightGeo = new THREE.BoxGeometry(0.38, 0.16, 0.08);
    for (const side of [-0.66, 0.66]) {
      const tl = new THREE.Mesh(taillightGeo, taillightMat);
      tl.position.set(side, 0.66, 2.18);
      this.object3D.add(tl);
    }

    // Lightbar assembly on roof
    const lightbarBase = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 0.36), blackPlastic);
    lightbarBase.position.set(0, 1.62, 0.05);
    this.object3D.add(lightbarBase);

    // Red light (left)
    const leftLight = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.3), red);
    leftLight.position.set(-0.38, 1.76, 0.05);
    this.object3D.add(leftLight);

    // White center light
    const whiteLight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }));
    whiteLight.position.set(0, 1.76, 0.05);
    this.object3D.add(whiteLight);

    // Blue light (right)
    const rightLight = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.3), blue);
    rightLight.position.set(0.38, 1.76, 0.05);
    this.object3D.add(rightLight);

    // Spotlight (driver side)
    const spotlightMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3, metalness: 0.5, emissive: 0xffeebb, emissiveIntensity: 0.15 });
    const spotlightGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.18, 8);
    spotlightGeo.rotateZ(Math.PI / 2);
    const spotlight = new THREE.Mesh(spotlightGeo, spotlightMat);
    spotlight.position.set(-1.08, 1.18, -0.3);
    this.object3D.add(spotlight);

    // Antenna (rear)
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.2, 6), antennaMat);
    antenna.position.set(-0.42, 2.05, 0.9);
    antenna.rotation.z = 0.15;
    this.object3D.add(antenna);

    // Second antenna
    const antenna2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.8, 6), antennaMat);
    antenna2.position.set(0.35, 1.95, 1.0);
    antenna2.rotation.z = -0.12;
    this.object3D.add(antenna2);

    // Side mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.16, 0.12, 0.2);
    for (const side of [-1, 1]) {
      const mirror = new THREE.Mesh(mirrorGeo, blackPlastic);
      mirror.position.set(side * 1.06, 0.98, -0.3);
      this.object3D.add(mirror);
    }

    // "POLICE" text placeholder - small plate on doors
    const plateGeo = new THREE.BoxGeometry(0.06, 0.18, 0.8);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x0033aa, roughness: 0.5 });
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.set(side * 0.98, 0.88, 0.2);
      this.object3D.add(plate);
    }

    // Wheel arches
    const archGeo = new THREE.BoxGeometry(0.22, 0.22, 0.74);
    for (const [x, z] of [[-1.04, -1.4], [1.04, -1.4], [-1.04, 1.4], [1.04, 1.4]]) {
      const arch = new THREE.Mesh(archGeo, white);
      arch.position.set(x, 0.6, z);
      this.object3D.add(arch);
    }

    // Wheels with rims
    const wheelGeometry = new THREE.CylinderGeometry(0.37, 0.37, 0.26, 18);
    wheelGeometry.rotateZ(Math.PI / 2);
    const rimGeometry = new THREE.CylinderGeometry(0.23, 0.23, 0.28, 8);
    rimGeometry.rotateZ(Math.PI / 2);
    for (const [x, y, z] of [[-1.02, 0.38, -1.4], [1.02, 0.38, -1.4], [-1.02, 0.38, 1.4], [1.02, 0.38, 1.4]]) {
      const wheel = new THREE.Mesh(wheelGeometry, tire);
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      this.object3D.add(wheel);
      const rim = new THREE.Mesh(rimGeometry, chrome);
      rim.position.set(x, y, z);
      this.object3D.add(rim);
    }

    // Roof lightbar guard rails
    const guardGeo = new THREE.BoxGeometry(1.5, 0.04, 0.04);
    for (const z of [-0.18, 0.28]) {
      const guard = new THREE.Mesh(guardGeo, chrome);
      guard.position.set(0, 1.58, z);
      this.object3D.add(guard);
    }

    // Exhaust
    const exhaustGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.2, 8);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exhaustGeo, chrome);
    exhaust.position.set(-0.48, 0.34, 2.3);
    this.object3D.add(exhaust);
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
