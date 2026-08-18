import * as THREE from 'three';

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * Fase 25 — efeitos visuais puramente observadores.
 * Este sistema não altera velocidade, heading, aderência ou colisões.
 */
export class VisualPolishSystem {
  constructor(scene, player, input, followCamera, damageSystem) {
    this.scene = scene;
    this.player = player;
    this.input = input;
    this.camera = followCamera;
    this.damage = damageSystem;

    this.particles = [];
    this.particlePool = [];
    this.skidMarks = [];
    this.skidPool = [];
    this.skidTimer = 0;
    this.nitroTimer = 0;
    this.smokeTimer = 0;
    this.lastCollisionSerial = player.collisionSerial ?? 0;

    this.particleGeometry = new THREE.SphereGeometry(0.08, 5, 4);
    this.skidGeometry = new THREE.PlaneGeometry(0.22, 1.15);
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  reset() {
    for (const p of this.particles) this._releaseParticle(p);
    this.particles.length = 0;
    for (const mark of this.skidMarks) this._releaseSkid(mark);
    this.skidMarks.length = 0;
    this.skidTimer = 0;
    this.nitroTimer = 0;
    this.smokeTimer = 0;
    this.lastCollisionSerial = this.player.collisionSerial ?? 0;
  }

  update(deltaTime) {
    if (deltaTime <= 0) return;

    this._handleCollisionFeedback();
    this._updateSkids(deltaTime);
    this._updateNitro(deltaTime);
    this._updateDamageSmoke(deltaTime);
    this._updateParticles(deltaTime);
    this._fadeSkids(deltaTime);
  }

  _handleCollisionFeedback() {
    const serial = this.player.collisionSerial ?? 0;
    if (serial === this.lastCollisionSerial) return;
    this.lastCollisionSerial = serial;
    const event = this.player.lastCollisionEvent;
    if (!event) return;

    const impact = Math.max(0, event.impactSpeedKmh ?? 0);
    const amount = THREE.MathUtils.clamp(impact / 110, 0.16, 0.92);
    this.camera?.addTrauma?.(amount);
    this._emitImpact(Math.round(7 + amount * 11), impact);
  }

  _updateSkids(deltaTime) {
    this.skidTimer -= deltaTime;
    const speed = Math.abs(this.player.getSpeedKmh?.() ?? 0);
    const lateral = Math.abs(this.player.velocity?.dot?.(this.player.right) ?? 0);
    const handbrake = this.input?.isDown?.('Space') ?? false;
    const shouldMark = speed > 34 && (handbrake || lateral > 2.9);
    if (!shouldMark || this.skidTimer > 0) return;

    this.skidTimer = handbrake ? 0.055 : 0.085;
    const rear = this._tmp.copy(this.player.object3D.position).addScaledVector(this.player.forward, -1.28);
    this._spawnSkid(rear, -0.72);
    this._spawnSkid(rear, 0.72);
  }

  _spawnSkid(rearCenter, sideOffset) {
    const mark = this.skidPool.pop() ?? this._createSkid();
    mark.age = 0;
    mark.lifetime = 16;
    mark.mesh.visible = true;
    mark.mesh.material.opacity = 0.36;
    mark.mesh.position.copy(rearCenter).addScaledVector(this.player.right, sideOffset);
    mark.mesh.position.y = 0.018;
    mark.mesh.rotation.set(-Math.PI / 2, 0, -this.player.heading);
    this.scene.add(mark.mesh);
    this.skidMarks.push(mark);

    while (this.skidMarks.length > 180) {
      const old = this.skidMarks.shift();
      this._releaseSkid(old);
    }
  }

  _createSkid() {
    const material = new THREE.MeshBasicMaterial({
      color: 0x111315,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    return { mesh: new THREE.Mesh(this.skidGeometry, material), age: 0, lifetime: 16 };
  }

  _fadeSkids(deltaTime) {
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const mark = this.skidMarks[i];
      mark.age += deltaTime;
      const fade = clamp01((mark.lifetime - mark.age) / 4);
      mark.mesh.material.opacity = 0.36 * Math.min(1, fade);
      if (mark.age >= mark.lifetime) {
        this.skidMarks.splice(i, 1);
        this._releaseSkid(mark);
      }
    }
  }

  _releaseSkid(mark) {
    if (!mark) return;
    mark.mesh.visible = false;
    this.scene.remove(mark.mesh);
    this.skidPool.push(mark);
  }

  _updateNitro(deltaTime) {
    this.nitroTimer -= deltaTime;
    if (!this.player.isNitroActive?.() || this.nitroTimer > 0) return;
    this.nitroTimer = 0.035;

    const base = this._tmp.copy(this.player.object3D.position)
      .addScaledVector(this.player.forward, -2.05);
    base.y = 0.55;
    for (const side of [-0.48, 0.48]) {
      const pos = this._tmp2.copy(base).addScaledVector(this.player.right, side);
      const velocity = this.player.forward.clone().multiplyScalar(-5.5 - Math.random() * 3);
      velocity.y = 0.4 + Math.random() * 0.7;
      this._spawnParticle('nitro', pos, velocity, 0.28 + Math.random() * 0.18, 0.12, 0.02);
    }
  }

  _updateDamageSmoke(deltaTime) {
    const integrity = this.damage?.getIntegrityPercent?.() ?? 100;
    if (integrity >= 55) return;
    this.smokeTimer -= deltaTime;
    if (this.smokeTimer > 0) return;

    const criticality = clamp01((55 - integrity) / 55);
    this.smokeTimer = THREE.MathUtils.lerp(0.24, 0.075, criticality);
    const pos = this._tmp.copy(this.player.object3D.position)
      .addScaledVector(this.player.forward, 1.28);
    pos.y = 1.05;
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.7,
      1.25 + Math.random() * 0.95,
      (Math.random() - 0.5) * 0.7,
    );
    this._spawnParticle('smoke', pos, velocity, 1.15 + Math.random() * 0.65, 0.18, 0.62);
  }

  _emitImpact(count, impactKmh) {
    const origin = this.player.object3D.position.clone();
    origin.y = 0.65;
    const scale = THREE.MathUtils.clamp(impactKmh / 80, 0.55, 1.5);
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        0.4 + Math.random() * 1.7,
        (Math.random() - 0.5) * 2.2,
      ).normalize().multiplyScalar((4.5 + Math.random() * 7) * scale);
      this._spawnParticle('spark', origin, dir, 0.35 + Math.random() * 0.35, 0.05, 0.025);
    }
    for (let i = 0; i < 3; i++) {
      const dustVelocity = new THREE.Vector3((Math.random() - 0.5) * 2, 0.6 + Math.random(), (Math.random() - 0.5) * 2);
      this._spawnParticle('dust', origin, dustVelocity, 0.8 + Math.random() * 0.45, 0.14, 0.42);
    }
  }

  _spawnParticle(kind, position, velocity, lifetime, startScale, endScale) {
    const p = this.particlePool.pop() ?? this._createParticle();
    p.kind = kind;
    p.age = 0;
    p.lifetime = lifetime;
    p.startScale = startScale;
    p.endScale = endScale;
    p.velocity.copy(velocity);
    p.mesh.position.copy(position);
    p.mesh.scale.setScalar(startScale);
    p.mesh.visible = true;

    if (kind === 'spark') {
      p.mesh.material.color.setHex(0xffc057);
      p.mesh.material.blending = THREE.AdditiveBlending;
      p.mesh.material.opacity = 1;
    } else if (kind === 'nitro') {
      p.mesh.material.color.setHex(Math.random() > 0.35 ? 0xff6a19 : 0x68c9ff);
      p.mesh.material.blending = THREE.AdditiveBlending;
      p.mesh.material.opacity = 0.9;
    } else if (kind === 'smoke') {
      p.mesh.material.color.setHex(0x44484c);
      p.mesh.material.blending = THREE.NormalBlending;
      p.mesh.material.opacity = 0.36;
    } else {
      p.mesh.material.color.setHex(0x7b7369);
      p.mesh.material.blending = THREE.NormalBlending;
      p.mesh.material.opacity = 0.32;
    }
    p.mesh.material.needsUpdate = true;
    this.scene.add(p.mesh);
    this.particles.push(p);
  }

  _createParticle() {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    return {
      mesh: new THREE.Mesh(this.particleGeometry, material),
      velocity: new THREE.Vector3(),
      age: 0,
      lifetime: 1,
      startScale: 0.1,
      endScale: 0.1,
      kind: 'spark',
    };
  }

  _updateParticles(deltaTime) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += deltaTime;
      const t = clamp01(p.age / p.lifetime);
      p.mesh.position.addScaledVector(p.velocity, deltaTime);

      if (p.kind === 'spark') {
        p.velocity.y -= 10.5 * deltaTime;
        p.velocity.multiplyScalar(Math.exp(-1.8 * deltaTime));
      } else if (p.kind === 'nitro') {
        p.velocity.multiplyScalar(Math.exp(-4.5 * deltaTime));
      } else {
        p.velocity.multiplyScalar(Math.exp(-0.55 * deltaTime));
      }

      const scale = THREE.MathUtils.lerp(p.startScale, p.endScale, t);
      p.mesh.scale.setScalar(scale);
      p.mesh.material.opacity *= Math.exp(-(p.kind === 'spark' ? 4.5 : 2.0) * deltaTime);

      if (p.age >= p.lifetime) {
        this.particles.splice(i, 1);
        this._releaseParticle(p);
      }
    }
  }

  _releaseParticle(p) {
    if (!p) return;
    p.mesh.visible = false;
    this.scene.remove(p.mesh);
    if (this.particlePool.length < 90) this.particlePool.push(p);
  }

  getStats() {
    return {
      particles: this.particles.length,
      particlePool: this.particlePool.length,
      skidMarks: this.skidMarks.length,
      skidPool: this.skidPool.length,
    };
  }
}
