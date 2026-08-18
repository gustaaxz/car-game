import * as THREE from 'three';

export class VehicleRealismSystem {
  constructor(player, trafficManager, policeManager) {
    this.player = player;
    this.traffic = trafficManager;
    this.police = policeManager;
    this._previousHeadings = new WeakMap();
    this._clock = 0;
    this._materials = this._createMaterials();
    this._enhancePlayer();
  }

  _createMaterials() {
    return {
      glass: new THREE.MeshStandardMaterial({ color: 0x172a34, roughness: 0.18, metalness: 0.14, transparent: true, opacity: 0.88 }),
      black: new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.82, metalness: 0.12 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0x9ca4a8, roughness: 0.3, metalness: 0.72 }),
      rim: new THREE.MeshStandardMaterial({ color: 0x767d82, roughness: 0.34, metalness: 0.75 }),
      headlight: new THREE.MeshStandardMaterial({ color: 0xe9f4ff, emissive: 0xa8d6ff, emissiveIntensity: 0.62, roughness: 0.25 }),
      tail: new THREE.MeshStandardMaterial({ color: 0xbc1723, emissive: 0x5b050a, emissiveIntensity: 0.55, roughness: 0.35 }),
      amber: new THREE.MeshStandardMaterial({ color: 0xe88418, emissive: 0x6f2a02, emissiveIntensity: 0.4 }),
      policeBlue: new THREE.MeshStandardMaterial({ color: 0x215dd0, emissive: 0x061d69, emissiveIntensity: 0.55 }),
      policeRed: new THREE.MeshStandardMaterial({ color: 0xd31d2b, emissive: 0x65050b, emissiveIntensity: 0.55 }),
    };
  }

  reset() {
    this._previousHeadings = new WeakMap();
    for (const vehicle of this.traffic?.vehicles ?? []) vehicle.object3D.rotation.z = 0;
    this._enhancePlayer();
    this.update(0);
  }

  update(deltaTime) {
    this._clock += Math.max(0, deltaTime);
    this._updateEmergencyLights();
    this._enhancePlayer();
    for (const vehicle of this.traffic?.vehicles ?? []) {
      this._enhanceTraffic(vehicle);
      this._animateVehicle(vehicle, deltaTime, vehicle.type === 'MOTORCYCLE');
    }
    for (const unit of this.police?.units ?? []) {
      this._enhancePolice(unit.vehicle);
      this._animateVehicle(unit.vehicle, deltaTime, false);
    }
    this._animateVehicle(this.player, deltaTime, false);
  }


  _updateEmergencyLights() {
    const pulse = Math.sin(this._clock * 13.5);
    this._materials.policeRed.emissiveIntensity = 0.35 + Math.max(0, pulse) * 2.2;
    this._materials.policeBlue.emissiveIntensity = 0.35 + Math.max(0, -pulse) * 2.2;
  }

  _enhancePlayer() {
    const root = this.player?.object3D;
    if (!root || root.userData.realismEnhanced) return;
    root.userData.realismEnhanced = true;
    const body = this.player.bodyMaterial ?? new THREE.MeshStandardMaterial({ color: 0xb51624, roughness: 0.48, metalness: 0.24 });
    this._addCarDetails(root, body, { length: 4.2, width: 1.85, police: false, sport: true });
    this._markWheels(root);
  }

  _enhancePolice(vehicle) {
    const root = vehicle?.object3D;
    if (!root || root.userData.realismEnhanced) return;
    root.userData.realismEnhanced = true;
    const palette = {
      STANDARD: 0xeeeeea,
      INTERCEPTOR: 0x263746,
      SPECIAL: 0x161a1d,
    };
    const body = new THREE.MeshStandardMaterial({ color: palette[vehicle.variant] ?? 0xeeeeea, roughness: 0.46, metalness: 0.2 });
    this._addCarDetails(root, body, { length: 4.45, width: 1.95, police: true, sport: vehicle.variant === 'INTERCEPTOR', suv: vehicle.variant === 'SPECIAL' });

    const push = this._box(1.62, 0.38, 0.13, this._materials.black, 0, 0.48, -2.31);
    root.add(push);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6), this._materials.black);
    antenna.position.set(0.45, 2.02, 0.62);
    antenna.rotation.z = -0.08;
    root.add(antenna);
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.24, 12), this._materials.black);
    spot.rotation.z = Math.PI / 2;
    spot.position.set(-1.02, 1.45, -0.55);
    root.add(spot);
    this._markWheels(root);
  }

  _enhanceTraffic(vehicle) {
    const root = vehicle?.object3D;
    if (!root || root.userData.realismEnhanced) return;
    root.userData.realismEnhanced = true;
    const body = new THREE.MeshStandardMaterial({ color: vehicle.spec?.color ?? 0x68737b, roughness: 0.5, metalness: 0.16 });

    if (vehicle.type === 'MOTORCYCLE') {
      this._addMotorcycleDetails(root, body);
    } else if (vehicle.type === 'TRUCK') {
      this._addTruckDetails(root, body, vehicle.spec);
    } else if (vehicle.type === 'BUS') {
      this._addBusDetails(root, body, vehicle.spec);
    } else {
      this._addCarDetails(root, body, {
        length: vehicle.spec?.length ?? 4.0,
        width: vehicle.spec?.width ?? 1.78,
        taxi: vehicle.type === 'TAXI',
      });
    }
    this._markWheels(root);
  }

  _addCarDetails(root, bodyMaterial, options = {}) {
    const length = options.length ?? 4.1;
    const width = options.width ?? 1.82;
    const halfL = length * 0.5;
    const halfW = width * 0.5;
    const hoodZ = -halfL + 0.68;

    root.add(this._box(width * 0.94, 0.16, 1.25, bodyMaterial, 0, 0.93, hoodZ));
    root.add(this._box(width * 0.92, 0.14, 0.78, bodyMaterial, 0, 0.9, halfL - 0.42));
    root.add(this._box(width * 1.01, 0.22, 0.18, this._materials.black, 0, 0.43, -halfL - 0.05));
    root.add(this._box(width * 1.01, 0.2, 0.16, this._materials.black, 0, 0.43, halfL + 0.04));

    const grille = this._box(width * 0.55, 0.24, 0.08, this._materials.black, 0, 0.62, -halfL - 0.1);
    root.add(grille);
    for (const side of [-1, 1]) {
      root.add(this._box(width * 0.24, 0.19, 0.09, this._materials.headlight, side * width * 0.3, 0.73, -halfL - 0.11));
      root.add(this._box(width * 0.22, 0.18, 0.09, this._materials.tail, side * width * 0.31, 0.72, halfL + 0.1));
      root.add(this._box(0.25, 0.12, 0.42, this._materials.black, side * (halfW + 0.14), 1.18, -0.45));
      root.add(this._box(0.08, 0.44, length * 0.34, this._materials.black, side * (halfW + 0.025), 0.64, 0.25));
    }

    const windshield = this._box(width * 0.75, 0.5, 0.08, this._materials.glass, 0, 1.27, -0.77);
    windshield.rotation.x = -0.2;
    root.add(windshield);
    const rearGlass = this._box(width * 0.72, 0.42, 0.08, this._materials.glass, 0, 1.24, 0.96);
    rearGlass.rotation.x = 0.18;
    root.add(rearGlass);

    const roof = this._box(width * 0.66, 0.1, options.suv ? 1.55 : 1.25, bodyMaterial, 0, options.suv ? 1.7 : 1.56, 0.08);
    root.add(roof);

    if (options.sport) {
      const splitter = this._box(width * 0.9, 0.09, 0.32, this._materials.black, 0, 0.24, -halfL - 0.12);
      root.add(splitter);
    }
    if (options.taxi) {
      const sign = this._box(0.68, 0.16, 0.32, this._materials.amber, 0, 1.7, 0.02);
      root.add(sign);
    }
    if (options.police) {
      const sideStripeMat = new THREE.MeshStandardMaterial({ color: 0x1d2930, roughness: 0.5 });
      for (const side of [-1, 1]) root.add(this._box(0.06, 0.24, 2.7, sideStripeMat, side * (halfW + 0.04), 0.78, 0.12));
      root.add(this._box(0.48, 0.11, 0.26, this._materials.policeRed, -0.29, 1.76, 0.05));
      root.add(this._box(0.48, 0.11, 0.26, this._materials.policeBlue, 0.29, 1.76, 0.05));
    }

    this._addRims(root);
  }

  _addMotorcycleDetails(root, bodyMaterial) {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 9), bodyMaterial);
    tank.scale.set(0.72, 0.72, 1.12);
    tank.position.set(0, 0.98, -0.2);
    tank.castShadow = true;
    root.add(tank);

    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.15, 8), this._materials.chrome);
    frame.rotation.x = Math.PI / 2.7;
    frame.position.set(0, 0.63, 0.02);
    root.add(frame);
    for (const side of [-1, 1]) {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 7), this._materials.chrome);
      fork.position.set(side * 0.12, 0.62, -0.72);
      fork.rotation.x = -0.18;
      root.add(fork);
    }
    const handle = this._box(0.75, 0.06, 0.06, this._materials.chrome, 0, 1.18, -0.58);
    root.add(handle);
    const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), this._materials.headlight);
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.92, -1.08);
    root.add(headlight);
    const tail = this._box(0.3, 0.14, 0.1, this._materials.tail, 0, 0.85, 1.03);
    root.add(tail);
    this._addRims(root, 0.28);
  }

  _addTruckDetails(root, bodyMaterial, spec = {}) {
    const width = spec.width ?? 2.25;
    root.add(this._box(width * 0.8, 0.42, 0.12, this._materials.black, 0, 0.55, -3.28));
    root.add(this._box(width * 0.72, 0.56, 0.08, this._materials.glass, 0, 1.75, -2.82));
    for (const side of [-1, 1]) {
      root.add(this._box(0.34, 0.18, 0.09, this._materials.headlight, side * 0.72, 0.82, -3.28));
      root.add(this._box(0.22, 0.18, 0.4, this._materials.black, side * (width * 0.53), 1.68, -2.5));
    }
    for (const z of [-0.15, 0.72, 1.59, 2.46]) root.add(this._box(width * 0.92, 0.045, 0.05, this._materials.chrome, 0, 2.05, z));
    this._addRims(root);
  }

  _addBusDetails(root, bodyMaterial, spec = {}) {
    const width = spec.width ?? 2.35;
    const length = spec.length ?? 8;
    root.add(this._box(width * 0.82, 0.72, 0.08, this._materials.glass, 0, 1.85, -length * 0.5 - 0.05));
    root.add(this._box(width * 0.82, 0.5, 0.08, this._materials.glass, 0, 1.75, length * 0.5 + 0.05));
    for (let i = -3; i <= 3; i++) {
      for (const side of [-1, 1]) {
        root.add(this._box(0.06, 0.64, 0.72, this._materials.glass, side * (width * 0.5 + 0.035), 1.82, i * 0.92));
      }
    }
    for (const side of [-1, 1]) {
      root.add(this._box(0.3, 0.18, 0.09, this._materials.headlight, side * 0.72, 0.72, -length * 0.5 - 0.08));
      root.add(this._box(0.28, 0.18, 0.09, this._materials.tail, side * 0.74, 0.74, length * 0.5 + 0.08));
    }
    this._addRims(root);
  }

  _addRims(root, radius = 0.25) {
    const existingWheels = root.children.filter((child) => child.geometry?.type === 'CylinderGeometry' && child.position.y < 0.55);
    const rimGeo = new THREE.CylinderGeometry(radius, radius, 0.02, 16);
    rimGeo.rotateZ(Math.PI / 2);
    for (const wheel of existingWheels) {
      const rim = new THREE.Mesh(rimGeo, this._materials.rim);
      rim.position.copy(wheel.position);
      rim.position.x += Math.sign(wheel.position.x || 1) * 0.15;
      rim.userData.isWheelDetail = true;
      root.add(rim);
    }
  }

  _markWheels(root) {
    for (const child of root.children) {
      if (child.geometry?.type === 'CylinderGeometry' && child.position.y < 0.58) child.userData.isVehicleWheel = true;
    }
  }

  _animateVehicle(vehicle, deltaTime, motorcycle) {
    if (!vehicle?.object3D || deltaTime <= 0) return;
    const speed = vehicle.velocity?.length?.() ?? 0;
    const spin = speed * deltaTime / 0.36;
    for (const child of vehicle.object3D.children) {
      if (child.userData?.isVehicleWheel) child.rotation.x -= spin;
    }

    if (motorcycle) {
      const previous = this._previousHeadings.get(vehicle) ?? vehicle.heading ?? 0;
      let delta = (vehicle.heading ?? 0) - previous;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const yawRate = delta / Math.max(deltaTime, 0.001);
      const targetLean = THREE.MathUtils.clamp(-yawRate * speed * 0.015, -0.28, 0.28);
      vehicle.object3D.rotation.z = THREE.MathUtils.lerp(vehicle.object3D.rotation.z, targetLean, 0.16);
      this._previousHeadings.set(vehicle, vehicle.heading ?? 0);
    }
  }

  _box(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    return mesh;
  }
}
