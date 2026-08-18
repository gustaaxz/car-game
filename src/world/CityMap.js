import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { RoadNetwork } from './RoadNetwork.js';
import { WorldCollision } from './WorldCollision.js';

export class CityMap {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CityMap';
    this.scene.add(this.group);

    const half = GAME_CONFIG.city.halfSize;
    this.bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };
    this.collision = new WorldCollision(this.bounds);
    this.roadNetwork = new RoadNetwork(GAME_CONFIG.city.roadCenters);
    this._materials = this._createMaterials();
    this._dashInstances = [];
    this._crosswalkInstances = [];

    this._buildGround();
    this._buildRoadGrid();
    this._buildDistricts();
    this._buildLandmarks();
    this._buildStreetPoles();
    this._buildBoundary();
  }

  _createMaterials() {
    return {
      asphalt: new THREE.MeshStandardMaterial({ color: 0x292d30, roughness: 0.97 }),
      sidewalk: new THREE.MeshStandardMaterial({ color: 0x9a9b98, roughness: 0.94 }),
      grass: new THREE.MeshStandardMaterial({ color: 0x435f3f, roughness: 1 }),
      concrete: new THREE.MeshStandardMaterial({ color: 0x777a79, roughness: 0.94 }),
      industrial: new THREE.MeshStandardMaterial({ color: 0x62696d, roughness: 0.9, metalness: 0.06 }),
      brick: new THREE.MeshStandardMaterial({ color: 0x805247, roughness: 0.94 }),
      brickLight: new THREE.MeshStandardMaterial({ color: 0xa0715f, roughness: 0.95 }),
      office: new THREE.MeshStandardMaterial({ color: 0x657784, roughness: 0.73, metalness: 0.1 }),
      officeLight: new THREE.MeshStandardMaterial({ color: 0x87929a, roughness: 0.78, metalness: 0.06 }),
      darkGlass: new THREE.MeshStandardMaterial({ color: 0x1b2b34, roughness: 0.2, metalness: 0.18 }),
      facadeGlass: new THREE.MeshStandardMaterial({ color: 0x274552, roughness: 0.2, metalness: 0.15, emissive: 0x071116, emissiveIntensity: 0.12 }),
      lane: new THREE.MeshBasicMaterial({ color: 0xe5c84e }),
      white: new THREE.MeshBasicMaterial({ color: 0xe8e9e5 }),
      barrier: new THREE.MeshStandardMaterial({ color: 0xbfc2c1, roughness: 0.88 }),
      curb: new THREE.MeshStandardMaterial({ color: 0xb0b0aa, roughness: 0.98 }),
      tree: new THREE.MeshStandardMaterial({ color: 0x31532d, roughness: 1 }),
      treeAlt: new THREE.MeshStandardMaterial({ color: 0x3e6537, roughness: 1 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x5c422d, roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x484d50, roughness: 0.92 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xd7ac28, roughness: 0.75 }),
    };
  }

  _buildGround() {
    const size = GAME_CONFIG.city.halfSize * 2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this._materials.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.06;
    this.group.add(ground);
  }

  _buildRoadGrid() {
    const size = GAME_CONFIG.city.halfSize * 2;
    const width = GAME_CONFIG.city.roadWidth;
    const centers = GAME_CONFIG.city.roadCenters;

    for (const x of centers) {
      this._plane(width, size, this._materials.asphalt, x, 0.01, 0);
      this._addDashedLaneLine(x, 0, false, size);
      this._addRoadEdgeLines(x, 0, false, size);
    }

    for (const z of centers) {
      this._plane(size, width, this._materials.asphalt, 0, 0.012, z);
      this._addDashedLaneLine(0, z, true, size);
      this._addRoadEdgeLines(0, z, true, size);
    }

    for (let ix = 0; ix < centers.length; ix++) {
      for (let iz = 0; iz < centers.length; iz++) {
        // Nem todo cruzamento urbano possui faixa em todas as aproximações.
        if ((ix + iz) % 2 === 0 || (Math.abs(centers[ix]) <= 70 && Math.abs(centers[iz]) <= 70)) {
          this._addCrosswalk(centers[ix], centers[iz], (ix + iz) % 4);
        }
      }
    }
    this._flushRoadMarkings();
  }

  _addDashedLaneLine(x, z, horizontal, length) {
    const dashLength = 5.5;
    const gap = 8.5;
    for (let offset = -length / 2 + 10; offset < length / 2 - 10; offset += dashLength + gap) {
      this._dashInstances.push({
        x: horizontal ? offset : x,
        z: horizontal ? z : offset,
        width: horizontal ? dashLength : 0.2,
        depth: horizontal ? 0.2 : dashLength,
      });
    }
  }

  _addRoadEdgeLines(x, z, horizontal, length) {
    const edge = GAME_CONFIG.city.roadWidth * 0.5 - 1.15;
    for (const side of [-1, 1]) {
      const geometry = horizontal
        ? new THREE.PlaneGeometry(length, 0.12)
        : new THREE.PlaneGeometry(0.12, length);
      const line = new THREE.Mesh(geometry, this._materials.white);
      line.rotation.x = -Math.PI / 2;
      line.position.set(horizontal ? 0 : x + side * edge, 0.026, horizontal ? z + side * edge : 0);
      this.group.add(line);
    }
  }

  _addCrosswalk(x, z, orientationSeed = 0) {
    const width = GAME_CONFIG.city.roadWidth;
    const rotate = orientationSeed % 2 === 1;
    for (let i = -3; i <= 3; i++) {
      this._crosswalkInstances.push({
        x: rotate ? x + width * 0.31 : x + i * 1.2,
        z: rotate ? z + i * 1.2 : z + width * 0.31,
        width: rotate ? 4.5 : 0.72,
        depth: rotate ? 0.72 : 4.5,
      });
    }
  }

  _flushRoadMarkings() {
    const createBatch = (instances, material, y, name) => {
      if (!instances.length) return;
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, instances.length);
      mesh.name = name;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      const dummy = new THREE.Object3D();
      instances.forEach((item, index) => {
        dummy.position.set(item.x, y, item.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(item.width, item.depth, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    };
    createBatch(this._dashInstances, this._materials.lane, 0.028, 'LaneDashes');
    createBatch(this._crosswalkInstances, this._materials.white, 0.03, 'Crosswalks');
    this._dashInstances.length = 0;
    this._crosswalkInstances.length = 0;
  }

  _buildDistricts() {
    const roads = GAME_CONFIG.city.roadCenters;
    const gap = Math.min(...roads.slice(1).map((value, index) => value - roads[index]));
    const blockSize = gap - GAME_CONFIG.city.roadWidth - 4;

    for (let ix = 0; ix < roads.length - 1; ix++) {
      for (let iz = 0; iz < roads.length - 1; iz++) {
        const x = (roads[ix] + roads[ix + 1]) * 0.5;
        const z = (roads[iz] + roads[iz + 1]) * 0.5;
        const type = this._districtType(ix, iz, x, z);
        this._buildBlock({ x, z, type, size: blockSize, seed: ix * 31 + iz * 17 });
      }
    }
  }

  _districtType(ix, iz, x, z) {
    const ax = Math.abs(x);
    const az = Math.abs(z);
    if (ax < 75 && az < 75) return (ix + iz) % 3 === 0 ? 'plaza' : ((ix + iz) % 2 ? 'downtown' : 'office');
    if (z < -175) return (ix + iz) % 4 === 0 ? 'parking' : ((ix + iz) % 3 === 0 ? 'warehouse' : 'industrial');
    if (x > 175 && z > -105 && z < 175) return (ix + iz) % 4 === 0 ? 'gas' : ((ix + iz) % 2 ? 'office' : 'residential');
    if (x < -175 && z > 70) return (ix + iz) % 3 === 0 ? 'park' : 'residential';
    if (z > 175) return (ix + iz) % 5 === 0 ? 'park' : ((ix + iz) % 3 === 0 ? 'office' : 'residential');
    const cycle = ['residential', 'office', 'residential', 'parking', 'residential', 'warehouse'];
    return cycle[(ix * 3 + iz * 5) % cycle.length];
  }

  _buildBlock({ x, z, type, size = 46, seed = 0 }) {
    this._plane(size, size, type === 'park' ? this._materials.grass : this._materials.sidewalk, x, 0, z);
    this._addCurbs(x, z, size);

    if (type === 'plaza') return this._buildPlaza(x, z, size);
    if (type === 'parking') return this._buildParking(x, z, size);
    if (type === 'gas') return this._buildGasStation(x, z, size);
    if (type === 'park') return this._buildPark(x, z, size);

    const variation = 0.86 + ((seed % 7) / 7) * 0.28;
    const materialA = seed % 2 ? this._materials.brick : this._materials.brickLight;
    const officeA = seed % 2 ? this._materials.office : this._materials.officeLight;
    const layouts = {
      industrial: [
        [-11, -8, 18, 15, 8 * variation, this._materials.industrial, 'industrial'],
        [10, 10, 15, 13, 6.5 * variation, this._materials.industrial, 'industrial'],
      ],
      warehouse: [[0, 0, 31, 25, 8.5 * variation, this._materials.industrial, 'industrial']],
      residential: [
        [-11, -10, 13, 14, 10 * variation, materialA, 'residential'],
        [10, 9, 12, 15, 13 * variation, this._materials.brick, 'residential'],
      ],
      office: [
        [-9, 0, 16, 29, 18 * variation, officeA, 'office'],
        [11, 9, 11, 12, 12 * variation, this._materials.darkGlass, 'office'],
      ],
      downtown: [
        [-10, -9, 13, 16, 27 * variation, this._materials.darkGlass, 'office'],
        [9, -8, 13, 16, 34 * variation, officeA, 'office'],
        [0, 11, 24, 10, 17 * variation, this._materials.office, 'office'],
      ],
    };

    for (const [ox, oz, w, d, h, material, style] of layouts[type] ?? []) {
      this._building(x + ox, z + oz, w, d, h, material, style);
    }

    if (type === 'industrial' || type === 'warehouse') this._addIndustrialProps(x, z);
    if (type === 'residential') this._addTrees(x, z, 4, Math.min(18, size * 0.38));
  }

  _addCurbs(x, z, size) {
    const h = 0.18;
    const t = 0.32;
    const entries = [
      [new THREE.BoxGeometry(size, h, t), x, h * 0.5, z - size * 0.5],
      [new THREE.BoxGeometry(size, h, t), x, h * 0.5, z + size * 0.5],
      [new THREE.BoxGeometry(t, h, size), x - size * 0.5, h * 0.5, z],
      [new THREE.BoxGeometry(t, h, size), x + size * 0.5, h * 0.5, z],
    ];
    for (const [geometry, px, py, pz] of entries) {
      const curb = new THREE.Mesh(geometry, this._materials.curb);
      curb.position.set(px, py, pz);
      curb.receiveShadow = true;
      this.group.add(curb);
    }
  }

  _buildPlaza(x, z, size) {
    this._plane(size - 7, size - 7, this._materials.concrete, x, 0.018, z);
    const monument = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 1.3, 20), this._materials.barrier);
    monument.position.set(x, 0.65, z);
    monument.castShadow = true;
    this.group.add(monument);
    this.collision.addBox(x - 3.2, x + 3.2, z - 3.2, z + 3.2, 'monument');
    this._addTrees(x, z, 8, Math.min(17, size * 0.38));
    this._addBenches(x, z);
  }

  _buildParking(x, z, size) {
    this._plane(size - 6, size - 6, this._materials.asphalt, x, 0.018, z);
    for (let i = -4; i <= 4; i++) {
      for (const row of [-1, 1]) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 6.2), this._materials.white);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x + i * 4.2, 0.03, z + row * 10.2);
        this.group.add(line);
      }
    }
    const island = new THREE.Mesh(new THREE.BoxGeometry(7, 0.22, 2.1), this._materials.curb);
    island.position.set(x, 0.11, z);
    this.group.add(island);
    this._tree(x - 2.2, z);
    this._tree(x + 2.2, z);
  }

  _buildGasStation(x, z, size) {
    this._plane(size - 6, size - 6, this._materials.concrete, x, 0.018, z);
    this._building(x + 11, z + 9, 15, 12, 6, this._materials.officeLight, 'office');
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(19, 0.7, 10), this._materials.barrier);
    canopy.position.set(x - 6, 4.6, z - 5);
    canopy.castShadow = true;
    this.group.add(canopy);
    for (const px of [-11, -2]) {
      for (const pz of [-8, -2]) {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.75), this._materials.industrial);
        pump.position.set(x + px + 5, 1.05, z + pz + 5);
        pump.castShadow = true;
        this.group.add(pump);
        this.collision.addBox(pump.position.x - 0.55, pump.position.x + 0.55, pump.position.z - 0.5, pump.position.z + 0.5, 'gas-pump');
      }
    }
  }

  _buildPark(x, z, size) {
    this._plane(size - 4, size - 4, this._materials.grass, x, 0.018, z);
    this._addTrees(x, z, 10, Math.min(19, size * 0.42));
    const pathA = this._plane(size - 12, 3, this._materials.concrete, x, 0.03, z);
    const pathB = this._plane(3, size - 12, this._materials.concrete, x, 0.032, z);
    pathA.receiveShadow = pathB.receiveShadow = true;
    this._addBenches(x, z);
  }

  _addBenches(x, z) {
    for (const [ox, oz, rot] of [[-8, 5, 0], [8, -5, Math.PI], [5, 8, Math.PI / 2], [-5, -8, -Math.PI / 2]]) {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.22, 0.65), this._materials.trunk);
      seat.position.y = 0.7;
      const back = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.16), this._materials.trunk);
      back.position.set(0, 1.02, 0.28);
      bench.add(seat, back);
      bench.position.set(x + ox, 0, z + oz);
      bench.rotation.y = rot;
      this.group.add(bench);
    }
  }

  _addIndustrialProps(x, z) {
    const colors = [this._materials.industrial, this._materials.office, this._materials.brick];
    const positions = [[-15, 15], [-9, 15], [15, -15]];
    positions.forEach(([ox, oz], index) => {
      const container = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.65, 2.45), colors[index % colors.length]);
      container.position.set(x + ox, 1.33, z + oz);
      container.castShadow = true;
      this.group.add(container);
      this.collision.addBox(x + ox - 2.75, x + ox + 2.75, z + oz - 1.25, z + oz + 1.25, 'container');
    });
  }

  _addTrees(x, z, count, radius = 17) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.35;
      const r = radius * (0.74 + (i % 3) * 0.08);
      this._tree(x + Math.cos(angle) * r, z + Math.sin(angle) * r, i);
    }
  }

  _tree(x, z, seed = 0) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 2.8, 8), this._materials.trunk);
    trunk.position.set(x, 1.4, z);
    trunk.castShadow = true;
    this.group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.55 + (seed % 3) * 0.12, 10, 8), seed % 2 ? this._materials.treeAlt : this._materials.tree);
    crown.scale.y = 1.12;
    crown.position.set(x, 3.45, z);
    crown.castShadow = true;
    this.group.add(crown);
    this.collision.addBox(x - 0.55, x + 0.55, z - 0.55, z + 0.55, 'tree');
  }

  _buildLandmarks() {
    this._buildTunnel();
    this._buildIndustrialOverpass();
  }

  _buildTunnel() {
    const x = 280;
    const z = -245;
    const width = GAME_CONFIG.city.roadWidth;
    const wallGeometry = new THREE.BoxGeometry(1.35, 5.7, 32);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(wallGeometry, this._materials.concrete);
      wall.position.set(x + side * (width * 0.5 + 1), 2.85, z);
      wall.castShadow = true;
      this.group.add(wall);
      this.collision.addBox(wall.position.x - 0.7, wall.position.x + 0.7, z - 16, z + 16, 'tunnel-wall');
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 3.5, 0.75, 32), this._materials.concrete);
    roof.position.set(x, 5.7, z);
    roof.castShadow = true;
    this.group.add(roof);
  }

  _buildIndustrialOverpass() {
    const x = -210;
    const z = -245;
    const beamMat = this._materials.industrial;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 0.85, 2.2), beamMat);
    beam.position.set(x, 6.4, z);
    beam.castShadow = true;
    this.group.add(beam);
    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.4, 1.2), beamMat);
      support.position.set(x + side * 12.5, 3.2, z);
      support.castShadow = true;
      this.group.add(support);
      this.collision.addBox(support.position.x - 0.6, support.position.x + 0.6, z - 0.6, z + 0.6, 'overpass-support');
    }
  }

  _buildStreetPoles() {
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x44494d, roughness: 0.82, metalness: 0.28 });
    const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e2b8, emissive: 0x6c6231, emissiveIntensity: 0.28 });
    const roads = GAME_CONFIG.city.roadCenters;
    const offset = GAME_CONFIG.city.roadWidth * 0.5 + 2.2;
    const seen = new Set();

    for (let ix = 0; ix < roads.length; ix++) {
      for (let iz = 0; iz < roads.length; iz++) {
        if ((ix + iz) % 2 !== 0) continue;
        for (const sign of [-1, 1]) {
          const x = roads[ix] + offset * sign;
          const z = roads[iz] + offset * sign;
          const key = `${x.toFixed(1)}:${z.toFixed(1)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 4.8, 8), poleMaterial);
          pole.position.set(x, 2.4, z);
          pole.castShadow = true;
          this.group.add(pole);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.12), poleMaterial);
          arm.position.set(x - sign * 0.55, 4.65, z);
          this.group.add(arm);
          const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.34), lampMaterial);
          lamp.position.set(x - sign * 1.05, 4.58, z);
          this.group.add(lamp);
          this.collision.addBox(x - 0.28, x + 0.28, z - 0.28, z + 0.28, 'street-pole');
        }
      }
    }
  }

  _buildBoundary() {
    const half = GAME_CONFIG.city.halfSize;
    const size = half * 2;
    const h = 0.75;
    const t = 0.55;
    const entries = [
      [new THREE.BoxGeometry(size, h, t), 0, h / 2, -half],
      [new THREE.BoxGeometry(size, h, t), 0, h / 2, half],
      [new THREE.BoxGeometry(t, h, size), -half, h / 2, 0],
      [new THREE.BoxGeometry(t, h, size), half, h / 2, 0],
    ];
    for (const [geometry, x, y, z] of entries) {
      const wall = new THREE.Mesh(geometry, this._materials.barrier);
      wall.position.set(x, y, z);
      wall.castShadow = true;
      this.group.add(wall);
    }
  }

  _building(x, z, width, depth, height, material, style = 'generic') {
    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    this.group.add(building);
    this.collision.addBox(x - width / 2, x + width / 2, z - depth / 2, z + depth / 2, 'building');

    const roofLip = new THREE.Mesh(new THREE.BoxGeometry(width + 0.35, 0.22, depth + 0.35), this._materials.roof);
    roofLip.position.set(x, height + 0.11, z);
    roofLip.castShadow = true;
    this.group.add(roofLip);

    if (style === 'office' && height > 11) this._addFacadeBands(x, z, width, depth, height);
    if (style === 'office' || style === 'industrial') {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(Math.min(4, width * 0.28), 1.1, Math.min(3, depth * 0.28)), this._materials.industrial);
      hvac.position.set(x + width * 0.18, height + 0.65, z - depth * 0.12);
      hvac.castShadow = true;
      this.group.add(hvac);
    }
  }

  _addFacadeBands(x, z, width, depth, height) {
    const rows = Math.min(5, Math.max(2, Math.floor(height / 6)));
    for (let row = 1; row <= rows; row++) {
      const y = (height / (rows + 1)) * row;
      const front = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.5, 0.08), this._materials.facadeGlass);
      front.position.set(x, y, z - depth * 0.5 - 0.045);
      this.group.add(front);
      const back = front.clone();
      back.position.z = z + depth * 0.5 + 0.045;
      this.group.add(back);
    }
  }

  _plane(width, depth, material, x, y, z, parent = null) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    (parent ?? this.group).add(mesh);
    return mesh;
  }
}
