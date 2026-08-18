import * as THREE from 'three';

export class PoliceHelicopter {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'PoliceHelicopter';
    this.active = false;
    this.group.visible = false;
    this._target = new THREE.Vector3();
    this._buildVisual();
    this.scene.add(this.group);
  }

  _buildVisual() {
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b2228, roughness: 0.48, metalness: 0.18 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe9edf0, roughness: 0.52, metalness: 0.12 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x203947, roughness: 0.22, metalness: 0.28 });
    const rotorMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xf5efc7, transparent: true, opacity: 0.12, depthWrite: false });

    const body = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 10), dark);
    body.scale.set(1.3, 0.72, 1.0);
    body.castShadow = true;
    this.group.add(body);

    const cabin = new THREE.Mesh(new THREE.SphereGeometry(1.42, 14, 8), glass);
    cabin.scale.set(1.0, 0.66, 0.82);
    cabin.position.set(0, 0.05, -1.0);
    this.group.add(cabin);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.28, 1.6), white);
    stripe.position.set(0, -0.25, 0.25);
    this.group.add(stripe);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 5.2), dark);
    tail.position.set(0, 0.1, 3.8);
    this.group.add(tail);

    this.mainRotor = new THREE.Group();
    const rotorA = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.08, 0.24), rotorMaterial);
    const rotorB = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 9.0), rotorMaterial);
    this.mainRotor.position.y = 1.65;
    this.mainRotor.add(rotorA, rotorB);
    this.group.add(this.mainRotor);

    this.tailRotor = new THREE.Group();
    const tailA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.18), rotorMaterial);
    const tailB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 2.6), rotorMaterial);
    this.tailRotor.position.set(0.35, 0.35, 6.2);
    this.tailRotor.add(tailA, tailB);
    this.group.add(this.tailRotor);

    const beam = new THREE.Mesh(new THREE.ConeGeometry(5.5, 22, 20, 1, true), beamMaterial);
    beam.position.y = -11;
    beam.rotation.x = Math.PI;
    this.group.add(beam);
  }

  setActive(active, playerPosition = null) {
    if (this.active === active) return;
    this.active = active;
    this.group.visible = active;
    if (active && playerPosition) {
      this.group.position.set(playerPosition.x + 12, 28, playerPosition.z + 10);
    }
  }

  update(deltaTime, playerPosition) {
    if (!this.active || deltaTime <= 0) return;

    this._target.set(playerPosition.x + 10, 28, playerPosition.z + 8);
    const blend = 1 - Math.exp(-1.7 * deltaTime);
    this.group.position.lerp(this._target, blend);
    this.group.rotation.y += deltaTime * 0.16;
    this.mainRotor.rotation.y += deltaTime * 18;
    this.tailRotor.rotation.x += deltaTime * 21;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
