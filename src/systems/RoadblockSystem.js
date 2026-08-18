import * as THREE from 'three';

export class RoadblockSystem {
  constructor(scene, city, player) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.roadblocks = [];
    this.refreshTimer = 0;
    this.currentLevel = 0;
    this.strategicNodes = [];
    this.nextId = 1;
  }

  reset() {
    this._clearAll();
    this.refreshTimer = 0;
    this.currentLevel = 0;
    this.strategicNodes = [];
    this.nextId = 1;
  }

  setStrategicNodes(nodes) {
    // Atualiza apenas as sugestões futuras. Não força reconstrução dos bloqueios
    // existentes, evitando o efeito visual de piscar/aparecer e sumir.
    this.strategicNodes = (nodes ?? []).filter(Boolean);
  }

  update(deltaTime, profile) {
    const desiredCount = Math.max(0, profile?.roadblocks ?? 0);
    const levelChanged = this.currentLevel !== (profile?.level ?? 0);
    this.currentLevel = profile?.level ?? 0;

    if (desiredCount === 0) {
      if (this.roadblocks.length) this._clearAll();
      return;
    }

    // Quantidade muda de forma incremental: nada de destruir todos e recriar.
    while (this.roadblocks.length < desiredCount) {
      if (!this._spawnOne()) break;
    }
    while (this.roadblocks.length > desiredCount) {
      const farthest = [...this.roadblocks].sort((a, b) => this._distanceToPlayer(b) - this._distanceToPlayer(a))[0];
      this._removeRoadblock(farthest);
    }

    this.refreshTimer -= Math.max(0, deltaTime);
    if (levelChanged) this.refreshTimer = Math.max(this.refreshTimer, 8);
    if (this.refreshTimer > 0) return;

    // Só troca um bloqueio que ficou realmente para trás/muito longe. O novo é
    // criado primeiro e o antigo removido depois, evitando qualquer frame vazio.
    const stale = this.roadblocks.find((roadblock) => this._isStale(roadblock));
    if (stale && this.roadblocks.length >= desiredCount) {
      const replacement = this._createCandidateRoadblock([stale]);
      if (replacement) {
        this.roadblocks.push(replacement);
        this._removeRoadblock(stale);
      }
    }

    this.refreshTimer = Math.max(18, profile?.roadblockRefresh ?? 24);
  }

  _isStale(roadblock) {
    const player = this.player.object3D.position;
    const dx = roadblock.node.x - player.x;
    const dz = roadblock.node.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 315) return true;
    if (distance < 115) return false;

    const forwardX = -Math.sin(this.player.heading);
    const forwardZ = -Math.cos(this.player.heading);
    const dot = (dx * forwardX + dz * forwardZ) / Math.max(1, distance);
    return dot < -0.48;
  }

  _spawnOne() {
    const roadblock = this._createCandidateRoadblock();
    if (!roadblock) return false;
    this.roadblocks.push(roadblock);
    return true;
  }

  _createCandidateRoadblock(extraExclusions = []) {
    const playerPos = this.player.object3D.position;
    const occupied = [...this.roadblocks, ...extraExclusions];
    const valid = (node) => {
      const distance = Math.hypot(node.x - playerPos.x, node.z - playerPos.z);
      if (distance < 72 || distance > 270) return false;
      return !occupied.some((roadblock) => Math.hypot(node.x - roadblock.node.x, node.z - roadblock.node.z) < 92);
    };

    let node = this.strategicNodes.find(valid) ?? null;
    if (!node) {
      const candidates = [...this.city.roadNetwork.nodes.values()].filter(valid);
      this._shuffle(candidates);
      node = candidates[0] ?? null;
    }
    if (!node) return null;
    return this._createRoadblock(node, this._orientationAgainstPlayerTravel());
  }

  _orientationAgainstPlayerTravel() {
    const v = this.player.velocity;
    if (v.lengthSq() > 2) return Math.abs(v.x) > Math.abs(v.z) ? 'z' : 'x';
    const forwardX = -Math.sin(this.player.heading);
    const forwardZ = -Math.cos(this.player.heading);
    return Math.abs(forwardX) > Math.abs(forwardZ) ? 'z' : 'x';
  }

  _createRoadblock(node, orientation) {
    const group = new THREE.Group();
    group.name = 'PoliceRoadblock';
    group.position.set(node.x, 0, node.z);

    const concrete = new THREE.MeshStandardMaterial({ color: 0xd1d1cb, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x151b20, roughness: 0.5, metalness: 0.1 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe96f17, roughness: 0.72 });
    const reflective = new THREE.MeshStandardMaterial({ color: 0xff7b19, emissive: 0x8b2704, emissiveIntensity: 0.36, roughness: 0.55 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc91c29, emissive: 0x5c050b, emissiveIntensity: 1.0 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x205bd1, emissive: 0x061c61, emissiveIntensity: 1.0 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x172832, roughness: 0.22, metalness: 0.12 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x101112, roughness: 0.98 });

    const collisionHandles = [];
    const offsets = [-3.7, 3.7];

    for (const offset of offsets) {
      const geometry = orientation === 'x'
        ? new THREE.BoxGeometry(5.6, 0.82, 0.72)
        : new THREE.BoxGeometry(0.72, 0.82, 5.6);
      const barrier = new THREE.Mesh(geometry, concrete);
      if (orientation === 'x') barrier.position.set(offset, 0.45, 0);
      else barrier.position.set(0, 0.45, offset);
      barrier.castShadow = true;
      group.add(barrier);

      const panelGeo = orientation === 'x'
        ? new THREE.BoxGeometry(3.9, 0.22, 0.76)
        : new THREE.BoxGeometry(0.76, 0.22, 3.9);
      const panel = new THREE.Mesh(panelGeo, reflective);
      panel.position.copy(barrier.position);
      panel.position.y = 0.62;
      group.add(panel);

      if (orientation === 'x') {
        collisionHandles.push(this.city.collision.addBox(node.x + offset - 2.8, node.x + offset + 2.8, node.z - 0.48, node.z + 0.48, 'police-roadblock'));
      } else {
        collisionHandles.push(this.city.collision.addBox(node.x - 0.48, node.x + 0.48, node.z + offset - 2.8, node.z + offset + 2.8, 'police-roadblock'));
      }
    }

    for (const side of [-1, 1]) {
      const car = this._createParkedPoliceCar({ dark, concrete, glass, red, blue, tire });
      if (orientation === 'x') {
        car.position.set(side * 7.2, 0, side * 3.25);
        car.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        collisionHandles.push(this.city.collision.addBox(node.x + side * 7.2 - 2.2, node.x + side * 7.2 + 2.2, node.z + side * 3.25 - 1.05, node.z + side * 3.25 + 1.05, 'police-roadblock'));
      } else {
        car.position.set(side * 3.25, 0, side * 7.2);
        car.rotation.y = side > 0 ? 0 : Math.PI;
        collisionHandles.push(this.city.collision.addBox(node.x + side * 3.25 - 1.05, node.x + side * 3.25 + 1.05, node.z + side * 7.2 - 2.2, node.z + side * 7.2 + 2.2, 'police-roadblock'));
      }
      group.add(car);
    }

    for (const offset of [-1.3, 0, 1.3]) {
      const cone = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.62), tire);
      base.position.y = 0.04;
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.82, 12), orange);
      top.position.y = 0.47;
      cone.add(base, top);
      if (orientation === 'x') cone.position.set(offset, 0, 0);
      else cone.position.set(0, 0, offset);
      group.add(cone);
    }

    this.scene.add(group);
    return { id: `roadblock-${this.nextId++}`, group, node, orientation, collisionHandles };
  }

  _createParkedPoliceCar(materials) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.58, 4.35), materials.concrete);
    body.position.y = 0.62;
    body.castShadow = true;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.18, 1.28), materials.concrete);
    hood.position.set(0, 0.94, -1.38);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.62, 1.72), materials.glass);
    cabin.position.set(0, 1.2, 0.08);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.99, 0.17, 2.5), materials.dark);
    stripe.position.set(0, 0.78, 0.25);
    const lightBase = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.1, 0.3), materials.dark);
    lightBase.position.set(0, 1.57, 0.05);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.27), materials.red);
    const lightB = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.27), materials.blue);
    lightR.position.set(-0.3, 1.66, 0.05);
    lightB.position.set(0.3, 1.66, 0.05);
    const push = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 0.14), materials.dark);
    push.position.set(0, 0.5, -2.24);
    car.add(body, hood, cabin, stripe, lightBase, lightR, lightB, push);

    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [[-1.0, -1.35], [1.0, -1.35], [-1.0, 1.35], [1.0, 1.35]]) {
      const wheel = new THREE.Mesh(wheelGeo, materials.tire);
      wheel.position.set(x, 0.36, z);
      wheel.castShadow = true;
      car.add(wheel);
    }
    return car;
  }

  _distanceToPlayer(roadblock) {
    const p = this.player.object3D.position;
    return Math.hypot(roadblock.node.x - p.x, roadblock.node.z - p.z);
  }

  _removeRoadblock(roadblock) {
    if (!roadblock) return;
    this.scene.remove(roadblock.group);
    for (const handle of roadblock.collisionHandles ?? []) this.city.collision.removeObstacle(handle);
    const index = this.roadblocks.indexOf(roadblock);
    if (index >= 0) this.roadblocks.splice(index, 1);
  }

  _clearAll() {
    for (const roadblock of [...this.roadblocks]) this._removeRoadblock(roadblock);
    this.roadblocks = [];
  }

  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  getCount() { return this.roadblocks.length; }
  getRoadblocks() { return this.roadblocks; }
}
