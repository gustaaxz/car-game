import * as THREE from 'three';

export class VehicleCollisionSystem {
  constructor() {
    this.pairCooldowns = new Map();
    this._normal = new THREE.Vector3();
    this._relative = new THREE.Vector3();
  }

  reset() { this.pairCooldowns.clear(); }

  update(deltaTime, player, policeManager, trafficManager) {
    this._tickCooldowns(deltaTime);

    const nearbyPlayerTraffic = trafficManager.queryNearby?.(player.object3D.position, 8) ?? trafficManager.vehicles;
    for (const traffic of nearbyPlayerTraffic) this._resolvePair(player, traffic, 'civilian-vehicle');

    for (const unit of policeManager.units) this._resolvePair(player, unit.vehicle, 'police-vehicle');
    this._resolveTrafficVsPolice(policeManager, trafficManager);
  }

  _resolvePair(player, other, label) {
    const playerRadius = player.config.collisionRadius;
    const otherRadius = other.collisionRadius ?? other.config?.collisionRadius ?? 1.3;
    const minDistance = playerRadius + otherRadius;

    this._normal.copy(player.object3D.position).sub(other.object3D.position);
    this._normal.y = 0;
    let distance = this._normal.length();
    if (distance >= minDistance) return;

    if (distance < 0.001) {
      this._normal.set(1, 0, 0);
      distance = 0.001;
    } else this._normal.multiplyScalar(1 / distance);

    const overlap = minDistance - distance;
    // Separação posicional — empurra os veículos para fora um do outro
    player.object3D.position.addScaledVector(this._normal, overlap * 0.65);
    other.object3D.position.addScaledVector(this._normal, -overlap * 0.35);

    this._relative.copy(player.velocity).sub(other.velocity ?? this._zeroVector());
    const relativeSpeed = Math.abs(this._relative.dot(this._normal));
    const impactKmh = Math.max(relativeSpeed * 3.6, this._relative.length() * 2.25);

    // Reflexão da velocidade apenas na componente NORMAL à colisão.
    // Isso faz o player "quicar" para fora mas manter a velocidade tangencial
    // (ao longo da superfície de contato), permitindo continuar acelerando.
    const playerNormalSpeed = player.velocity.dot(this._normal);
    if (playerNormalSpeed < 0) {
      // Bounce: reflete a componente normal com um fator de restituição
      const bounceFactor = label === 'police-vehicle' ? 0.55 : 0.65;
      player.velocity.addScaledVector(this._normal, -playerNormalSpeed * (1 + bounceFactor));
    }
    // NÃO aplicar multiplyScalar global — isso drenava toda a velocidade a cada frame.
    // Apenas um leve atrito instantâneo na velocidade tangencial para sentir o impacto.
    const isPolice = label === 'police-vehicle';
    const frictionFactor = isPolice ? 0.94 : 0.92;
    player.velocity.multiplyScalar(frictionFactor);

    if (other.velocity) {
      const otherNormalSpeed = other.velocity.dot(this._normal);
      if (otherNormalSpeed > 0) {
        const otherBounce = isPolice ? 0.45 : 0.5;
        other.velocity.addScaledVector(this._normal, -otherNormalSpeed * (1 + otherBounce));
      }
      // A polícia também perde velocidade no impacto, criando pancada mais realista
      other.velocity.multiplyScalar(isPolice ? 0.88 : 0.78);
    }

    const key = `${label}:${other.collisionId ?? other.object3D.uuid ?? 'vehicle'}`;
    if ((this.pairCooldowns.get(key) ?? 0) <= 0) {
      player.registerExternalCollision(label, impactKmh);
      this.pairCooldowns.set(key, 0.45);
    }
  }

  _resolveTrafficVsPolice(policeManager, trafficManager) {
    for (const unit of policeManager.units) {
      const police = unit.vehicle;
      const nearby = trafficManager.queryNearby?.(police.object3D.position, 8) ?? trafficManager.vehicles;
      for (const traffic of nearby) {
        const minDistance = (police.config.collisionRadius ?? 1.5) + traffic.collisionRadius;
        this._normal.copy(police.object3D.position).sub(traffic.object3D.position);
        this._normal.y = 0;
        const distanceSq = this._normal.lengthSq();
        if (distanceSq >= minDistance * minDistance || distanceSq < 0.000001) continue;
        const distance = Math.sqrt(distanceSq);
        this._normal.multiplyScalar(1 / distance);
        const overlap = minDistance - distance;
        police.object3D.position.addScaledVector(this._normal, overlap * 0.55);
        traffic.object3D.position.addScaledVector(this._normal, -overlap * 0.45);
        police.velocity.multiplyScalar(0.82);
        traffic.velocity.multiplyScalar(0.7);
      }
    }
  }

  _tickCooldowns(deltaTime) {
    for (const [key, value] of this.pairCooldowns) {
      const next = value - deltaTime;
      if (next <= 0) this.pairCooldowns.delete(key);
      else this.pairCooldowns.set(key, next);
    }
  }

  _zeroVector() {
    if (!this.__zero) this.__zero = new THREE.Vector3();
    return this.__zero.set(0, 0, 0);
  }
}
