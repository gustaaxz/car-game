import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.js';

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.config = GAME_CONFIG.camera;
    this.baseFov = camera.fov;
    this.currentLookAt = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.desiredLookAt = new THREE.Vector3();
    this.shakeOffset = new THREE.Vector3();
    this.trauma = 0;
    this.tension = 0;
  }

  snapTo(target) {
    const forward = target.forward;
    this.trauma = 0;
    this.tension = 0;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.desiredPosition.copy(target.object3D.position)
      .addScaledVector(forward, -this.config.distance)
      .add(new THREE.Vector3(0, this.config.height, 0));
    this.camera.position.copy(this.desiredPosition);

    this.currentLookAt.copy(target.object3D.position)
      .addScaledVector(forward, this.config.lookAhead)
      .add(new THREE.Vector3(0, 1.0, 0));
    this.camera.lookAt(this.currentLookAt);
  }

  addTrauma(amount = 0.2) {
    this.trauma = THREE.MathUtils.clamp(this.trauma + Math.max(0, amount), 0, 1);
  }

  setTension(value = 0) {
    this.tension = THREE.MathUtils.clamp(value, 0, 1);
  }

  update(deltaTime, target) {
    if (deltaTime <= 0) return;

    const speedKmh = Math.abs(target.getSpeedKmh?.() ?? 0);
    const speedRatio = THREE.MathUtils.clamp(speedKmh / 180, 0, 1);
    const nitro = target.isNitroActive?.() ?? false;
    const dynamicDistance = this.config.distance + speedRatio * 1.65 + (nitro ? 0.7 : 0);
    const dynamicHeight = this.config.height + speedRatio * 0.32;
    const dynamicLookAhead = this.config.lookAhead + speedRatio * 1.9;

    this.desiredPosition.copy(target.object3D.position)
      .addScaledVector(target.forward, -dynamicDistance)
      .add(new THREE.Vector3(0, dynamicHeight, 0));

    this.desiredLookAt.copy(target.object3D.position)
      .addScaledVector(target.forward, dynamicLookAhead)
      .add(new THREE.Vector3(0, 1.0, 0));

    const posAlpha = 1 - Math.exp(-this.config.positionSharpness * deltaTime);
    const lookAlpha = 1 - Math.exp(-this.config.lookSharpness * deltaTime);
    this.camera.position.lerp(this.desiredPosition, posAlpha);
    this.currentLookAt.lerp(this.desiredLookAt, lookAlpha);

    const shake = this.trauma * this.trauma;
    if (shake > 0.0001) {
      const amplitude = 0.34 * shake;
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * amplitude,
        (Math.random() * 2 - 1) * amplitude * 0.58,
        (Math.random() * 2 - 1) * amplitude,
      );
      this.camera.position.add(this.shakeOffset);
    }

    this.camera.lookAt(this.currentLookAt);
    const lateralSpeed = target.velocity?.dot?.(target.right) ?? 0;
    const roll = THREE.MathUtils.clamp(-lateralSpeed * 0.0045, -0.035, 0.035);
    this.camera.rotateZ(roll);

    const targetFov = this.baseFov
      + speedRatio * 5.2
      + (nitro ? 3.8 : 0)
      - this.tension * 1.4;
    const fovAlpha = 1 - Math.exp(-4.2 * deltaTime);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, fovAlpha);
    this.camera.updateProjectionMatrix();

    this.trauma = Math.max(0, this.trauma - deltaTime * 1.65);
  }
}
