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
    this._addStreetProps();
  }

  _createMaterials() {
    return {
      asphalt: new THREE.MeshStandardMaterial({ color: 0x272a2d, roughness: 0.95 }),
      asphaltLight: new THREE.MeshStandardMaterial({ color: 0x353a3d, roughness: 0.92 }),
      sidewalk: new THREE.MeshStandardMaterial({ color: 0x9fa19d, roughness: 0.92 }),
      sidewalkEdge: new THREE.MeshStandardMaterial({ color: 0x888a86, roughness: 0.94 }),
      grass: new THREE.MeshStandardMaterial({ color: 0x3d6139, roughness: 1 }),
      grassDark: new THREE.MeshStandardMaterial({ color: 0x2e4c2b, roughness: 1 }),
      concrete: new THREE.MeshStandardMaterial({ color: 0x7c8082, roughness: 0.92 }),
      industrial: new THREE.MeshStandardMaterial({ color: 0x5e666c, roughness: 0.88, metalness: 0.08 }),
      industrialDark: new THREE.MeshStandardMaterial({ color: 0x42484c, roughness: 0.85, metalness: 0.12 }),
      brick: new THREE.MeshStandardMaterial({ color: 0x874e42, roughness: 0.94 }),
      brickLight: new THREE.MeshStandardMaterial({ color: 0xa86a58, roughness: 0.95 }),
      office: new THREE.MeshStandardMaterial({ color: 0x5c7080, roughness: 0.65, metalness: 0.18 }),
      officeLight: new THREE.MeshStandardMaterial({ color: 0x7d92a0, roughness: 0.70, metalness: 0.12 }),
      darkGlass: new THREE.MeshStandardMaterial({ color: 0x14222b, roughness: 0.15, metalness: 0.35 }),
      facadeGlass: new THREE.MeshStandardMaterial({ color: 0x1f3f4f, roughness: 0.18, metalness: 0.25, emissive: 0x0c212d, emissiveIntensity: 0.35 }),
      windowLit: new THREE.MeshStandardMaterial({ color: 0xffe680, emissive: 0xffca3a, emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.1 }),
      windowOfficeLit: new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x7dd3fc, emissiveIntensity: 0.70, roughness: 0.35, metalness: 0.1 }),
      windowDark: new THREE.MeshStandardMaterial({ color: 0x111c24, roughness: 0.18, metalness: 0.35, emissive: 0x05090c, emissiveIntensity: 0.08 }),
      lane: new THREE.MeshBasicMaterial({ color: 0xf5cf47 }),
      white: new THREE.MeshBasicMaterial({ color: 0xf0f2eb }),
      barrier: new THREE.MeshStandardMaterial({ color: 0xc4c7c6, roughness: 0.85 }),
      barrierRed: new THREE.MeshStandardMaterial({ color: 0xcc2929, roughness: 0.80 }),
      curb: new THREE.MeshStandardMaterial({ color: 0xb5b7b0, roughness: 0.96 }),
      tree: new THREE.MeshStandardMaterial({ color: 0x2e5c2a, roughness: 1 }),
      treeAlt: new THREE.MeshStandardMaterial({ color: 0x3d7037, roughness: 1 }),
      treeDark: new THREE.MeshStandardMaterial({ color: 0x20431d, roughness: 1 }),
      treeBright: new THREE.MeshStandardMaterial({ color: 0x4c853d, roughness: 1 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x543b27, roughness: 1 }),
      trunkDark: new THREE.MeshStandardMaterial({ color: 0x3d2a1a, roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x42474a, roughness: 0.90 }),
      roofAC: new THREE.MeshStandardMaterial({ color: 0x5a6064, roughness: 0.80, metalness: 0.18 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xe5b72e, roughness: 0.65 }),
      hydrantRed: new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.55, metalness: 0.2 }),
      trafficPole: new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.75, metalness: 0.3 }),
      trafficRed: new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff1111, emissiveIntensity: 1.2, roughness: 0.2 }),
      trafficYellow: new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 1.0, roughness: 0.2 }),
      trafficGreen: new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 1.2, roughness: 0.2 }),
      dumpster: new THREE.MeshStandardMaterial({ color: 0x236838, roughness: 0.80, metalness: 0.15 }),
      mailbox: new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.65, metalness: 0.2 }),
      utilityGray: new THREE.MeshStandardMaterial({ color: 0x52585c, roughness: 0.75, metalness: 0.25 }),
      manhole: new THREE.MeshStandardMaterial({ color: 0x2c2f32, roughness: 0.90, metalness: 0.35 }),
      drainGrill: new THREE.MeshStandardMaterial({ color: 0x1e2124, roughness: 0.85, metalness: 0.5 }),
      water: new THREE.MeshStandardMaterial({ color: 0x16698a, roughness: 0.1, metalness: 0.45 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.28, metalness: 0.8 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.25, metalness: 0.75 }),
      handicapBlue: new THREE.MeshBasicMaterial({ color: 0x2563eb }),
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
      this._addManholesAlongRoad(x, 0, false, size);
    }

    for (const z of centers) {
      this._plane(size, width, this._materials.asphalt, 0, 0.012, z);
      this._addDashedLaneLine(0, z, true, size);
      this._addRoadEdgeLines(0, z, true, size);
      this._addManholesAlongRoad(0, z, true, size);
    }

    for (let ix = 0; ix < centers.length; ix++) {
      for (let iz = 0; iz < centers.length; iz++) {
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

  _addManholesAlongRoad(x, z, horizontal, length) {
    const step = 48;
    const manholeGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.03, 16);
    for (let offset = -length / 2 + 25; offset < length / 2 - 25; offset += step) {
      const mh = new THREE.Mesh(manholeGeo, this._materials.manhole);
      mh.position.set(horizontal ? offset : x + 2.8, 0.02, horizontal ? z + 2.8 : offset);
      this.group.add(mh);
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
    this._addStormDrains(x, z, size);

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
    const h = 0.20;
    const t = 0.36;
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

  _addStormDrains(x, z, size) {
    const drainGeo = new THREE.BoxGeometry(1.4, 0.03, 0.65);
    const half = size * 0.5;
    const offsets = [
      [x - 8, 0.02, z - half - 0.4],
      [x + 8, 0.02, z - half - 0.4],
      [x - 8, 0.02, z + half + 0.4],
      [x + 8, 0.02, z + half + 0.4],
      [x - half - 0.4, 0.02, z - 8],
      [x - half - 0.4, 0.02, z + 8],
      [x + half + 0.4, 0.02, z - 8],
      [x + half + 0.4, 0.02, z + 8],
    ];
    for (const [px, py, pz] of offsets) {
      const drain = new THREE.Mesh(drainGeo, this._materials.drainGrill);
      drain.position.set(px, py, pz);
      this.group.add(drain);
    }
  }

  _buildPlaza(x, z, size) {
    // 1. Decorative Plaza Paver Ground
    this._plane(size - 7, size - 7, this._materials.concrete, x, 0.018, z);

    // 2. Stepped Monument Pedestal
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.35, 24), this._materials.curb);
    base1.position.set(x, 0.18, z);
    base1.castShadow = true;
    this.group.add(base1);

    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.5, 0.35, 24), this._materials.concrete);
    base2.position.set(x, 0.53, z);
    base2.castShadow = true;
    this.group.add(base2);

    // 3. Central Fountain Basin with Water
    const fountainBasin = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.4, 0.60, 20), this._materials.barrier);
    fountainBasin.position.set(x, 0.95, z);
    fountainBasin.castShadow = true;
    this.group.add(fountainBasin);

    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.08, 20), this._materials.water);
    water.position.set(x, 1.26, z);
    this.group.add(water);

    // 4. Central Obelisk / Spire with Gold Finial
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.85, 4.2, 8), this._materials.concrete);
    spire.position.set(x, 3.1, z);
    spire.castShadow = true;
    this.group.add(spire);

    const goldGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), this._materials.gold);
    goldGlobe.position.set(x, 5.4, z);
    goldGlobe.castShadow = true;
    this.group.add(goldGlobe);

    this.collision.addBox(x - 3.4, x + 3.4, z - 3.4, z + 3.4, 'monument');

    // 5. Surrounding Planters with Foliage & Flowers
    const planterGeo = new THREE.BoxGeometry(2.4, 0.45, 1.2);
    const planterOffsets = [
      [-7, -7], [7, -7], [-7, 7], [7, 7]
    ];
    for (const [px, pz] of planterOffsets) {
      const planter = new THREE.Mesh(planterGeo, this._materials.curb);
      planter.position.set(x + px, 0.24, z + pz);
      planter.castShadow = true;
      this.group.add(planter);

      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 6), this._materials.treeBright);
      bush.scale.set(1.4, 0.7, 0.8);
      bush.position.set(x + px, 0.65, z + pz);
      bush.castShadow = true;
      this.group.add(bush);
    }

    this._addTrees(x, z, 8, Math.min(17, size * 0.38));
    this._addBenches(x, z);
  }

  _buildParking(x, z, size) {
    this._plane(size - 6, size - 6, this._materials.asphalt, x, 0.018, z);

    // Parking Bays with Divider Lines & Concrete Wheel Stops
    const wheelStopGeo = new THREE.BoxGeometry(2.0, 0.14, 0.22);
    for (let i = -4; i <= 4; i++) {
      for (const row of [-1, 1]) {
        // Divider Line
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 6.4), this._materials.white);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x + i * 4.2, 0.03, z + row * 10.2);
        this.group.add(line);

        // Concrete Wheel Stop at head of stall
        const stop = new THREE.Mesh(wheelStopGeo, this._materials.curb);
        stop.position.set(x + i * 4.2 + 2.1, 0.07, z + row * 13.0);
        this.group.add(stop);
      }
    }

    // Special Blue Handicap Parking Stalls
    for (const row of [-1, 1]) {
      const handicapMark = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 4.2), this._materials.handicapBlue);
      handicapMark.rotation.x = -Math.PI / 2;
      handicapMark.position.set(x - 4.2 * 3.5, 0.026, z + row * 10.2);
      this.group.add(handicapMark);
    }

    // Central Landscaping Island
    const island = new THREE.Mesh(new THREE.BoxGeometry(10, 0.22, 2.4), this._materials.curb);
    island.position.set(x, 0.11, z);
    this.group.add(island);

    const islandGrass = this._plane(9.4, 1.8, this._materials.grass, x, 0.23, z);
    islandGrass.receiveShadow = true;

    this._tree(x - 3.2, z, 1);
    this._tree(x + 3.2, z, 2);
  }

  _buildGasStation(x, z, size) {
    this._plane(size - 6, size - 6, this._materials.concrete, x, 0.018, z);
    this._building(x + 11, z + 9, 15, 12, 6, this._materials.officeLight, 'office');

    // Canopy with illuminated edge
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(19, 0.75, 11), this._materials.barrier);
    canopy.position.set(x - 6, 4.6, z - 5);
    canopy.castShadow = true;
    this.group.add(canopy);

    const canopyTrim = new THREE.Mesh(new THREE.BoxGeometry(19.2, 0.18, 11.2), this._materials.yellow);
    canopyTrim.position.set(x - 6, 4.85, z - 5);
    this.group.add(canopyTrim);

    // Fuel Pumps with island bases
    for (const px of [-11, -2]) {
      for (const pz of [-8, -2]) {
        const islandBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 2.6), this._materials.curb);
        islandBase.position.set(x + px + 5, 0.11, z + pz + 5);
        this.group.add(islandBase);

        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.2, 0.85), this._materials.industrial);
        pump.position.set(x + px + 5, 1.15, z + pz + 5);
        pump.castShadow = true;
        this.group.add(pump);

        const pumpScreen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.90), this._materials.windowLit);
        pumpScreen.position.set(x + px + 5, 1.45, z + pz + 5);
        this.group.add(pumpScreen);

        this.collision.addBox(pump.position.x - 0.6, pump.position.x + 0.6, pump.position.z - 0.6, pump.position.z + 0.6, 'gas-pump');
      }
    }
  }

  _buildPark(x, z, size) {
    this._plane(size - 4, size - 4, this._materials.grass, x, 0.018, z);
    this._addTrees(x, z, 12, Math.min(20, size * 0.44));
    const pathA = this._plane(size - 10, 3.2, this._materials.concrete, x, 0.03, z);
    const pathB = this._plane(3.2, size - 10, this._materials.concrete, x, 0.032, z);
    pathA.receiveShadow = pathB.receiveShadow = true;
    this._addBenches(x, z);
  }

  _addBenches(x, z) {
    for (const [ox, oz, rot] of [[-8, 5, 0], [8, -5, Math.PI], [5, 8, Math.PI / 2], [-5, -8, -Math.PI / 2]]) {
      const bench = new THREE.Group();
      // Wooden Slats
      const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.65), this._materials.trunk);
      seat.position.y = 0.65;
      seat.castShadow = true;

      const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.75, 0.14), this._materials.trunk);
      back.position.set(0, 1.05, 0.28);
      back.castShadow = true;

      // Iron Legs
      const legGeo = new THREE.BoxGeometry(0.12, 0.65, 0.70);
      for (const side of [-1.3, 1.3]) {
        const leg = new THREE.Mesh(legGeo, this._materials.trafficPole);
        leg.position.set(side, 0.32, 0.12);
        bench.add(leg);
      }

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

      // Rib details on shipping containers
      const ribGeo = new THREE.BoxGeometry(0.06, 2.5, 0.08);
      for (let r = -2.2; r <= 2.2; r += 0.55) {
        const rib = new THREE.Mesh(ribGeo, this._materials.trafficPole);
        rib.position.set(x + ox + r, 1.33, z + oz + 1.25);
        this.group.add(rib);
      }

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
    const treeGroup = new THREE.Group();

    // 1. Flared Root Base
    const rootBase = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.54, 0.8, 8), this._materials.trunkDark);
    rootBase.position.y = 0.4;
    rootBase.castShadow = true;
    treeGroup.add(rootBase);

    // 2. Main Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 2.4, 8), this._materials.trunk);
    trunk.position.y = 1.6;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // 3. Branch Forks
    const branchGeo = new THREE.CylinderGeometry(0.10, 0.15, 1.1, 6);
    const branch1 = new THREE.Mesh(branchGeo, this._materials.trunk);
    branch1.position.set(0.3, 2.4, 0.2);
    branch1.rotation.set(0.4, 0.3, -0.5);
    treeGroup.add(branch1);

    const branch2 = new THREE.Mesh(branchGeo, this._materials.trunk);
    branch2.position.set(-0.25, 2.5, -0.2);
    branch2.rotation.set(-0.3, -0.4, 0.5);
    treeGroup.add(branch2);

    // 4. Multi-Cluster Layered Organic Foliage Canopy
    const materials = [this._materials.tree, this._materials.treeAlt, this._materials.treeDark, this._materials.treeBright];
    const matA = materials[seed % materials.length];
    const matB = materials[(seed + 1) % materials.length];
    const matC = materials[(seed + 2) % materials.length];

    const isPine = seed % 4 === 3;

    if (isPine) {
      // Conical Pine / Cypress Tree
      for (let layer = 0; layer < 3; layer++) {
        const rTop = 0.4 + (2 - layer) * 0.4;
        const rBot = 1.2 + (2 - layer) * 0.6;
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1.4, 8), layer % 2 ? matA : matB);
        cone.position.y = 3.0 + layer * 1.1;
        cone.castShadow = true;
        treeGroup.add(cone);
      }
    } else {
      // Volumetric Deciduous Oak / Maple Canopy
      const mainCrown = new THREE.Mesh(new THREE.SphereGeometry(1.65 + (seed % 3) * 0.15, 10, 8), matA);
      mainCrown.position.set(0, 3.6, 0);
      mainCrown.scale.set(1.1, 1.0, 1.1);
      mainCrown.castShadow = true;
      treeGroup.add(mainCrown);

      const cluster1 = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 6), matB);
      cluster1.position.set(0.7, 3.9, 0.5);
      cluster1.castShadow = true;
      treeGroup.add(cluster1);

      const cluster2 = new THREE.Mesh(new THREE.SphereGeometry(1.05, 8, 6), matC);
      cluster2.position.set(-0.6, 3.8, -0.4);
      cluster2.castShadow = true;
      treeGroup.add(cluster2);

      const cluster3 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 6), matA);
      cluster3.position.set(0.2, 4.4, -0.3);
      cluster3.castShadow = true;
      treeGroup.add(cluster3);
    }

    treeGroup.position.set(x, 0, z);
    this.group.add(treeGroup);
    this.collision.addBox(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 'tree');
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
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4347, roughness: 0.78, metalness: 0.35 });
    const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd966, emissiveIntensity: 0.85, roughness: 0.25 });
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

          // 1. Tapered Mast
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 5.2, 8), poleMaterial);
          pole.position.set(x, 2.6, z);
          pole.castShadow = true;
          this.group.add(pole);

          // 2. Curved / L-Arm Bracket
          const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.10, 0.10), poleMaterial);
          arm.position.set(x - sign * 0.65, 5.15, z);
          this.group.add(arm);

          // 3. Modern Luminaire Head
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.38), poleMaterial);
          head.position.set(x - sign * 1.25, 5.08, z);
          this.group.add(head);

          // 4. Emissive Lamp Lens
          const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.30), lampMaterial);
          lamp.position.set(x - sign * 1.25, 4.98, z);
          this.group.add(lamp);

          this.collision.addBox(x - 0.28, x + 0.28, z - 0.28, z + 0.28, 'street-pole');
        }
      }
    }
  }

  _addStreetProps() {
    const roads = GAME_CONFIG.city.roadCenters;
    const width = GAME_CONFIG.city.roadWidth;
    const cornerOffset = width * 0.5 + 2.6;

    for (let ix = 0; ix < roads.length; ix++) {
      for (let iz = 0; iz < roads.length; iz++) {
        const rx = roads[ix];
        const rz = roads[iz];
        const seed = ix * 19 + iz * 23;

        // 1. Traffic Lights at Major Intersections
        if ((ix + iz) % 2 === 0) {
          this._addTrafficLight(rx - cornerOffset, rz - cornerOffset, 0);
          this._addTrafficLight(rx + cornerOffset, rz + cornerOffset, Math.PI);
        }

        // 2. Fire Hydrants at Sidewalk Corners
        if (seed % 3 === 0) {
          this._addFireHydrant(rx + cornerOffset, rz - cornerOffset + 3.2);
        } else if (seed % 3 === 1) {
          this._addFireHydrant(rx - cornerOffset, rz + cornerOffset - 3.2);
        }

        // 3. Sidewalk Trash Cans & Dumpsters
        if (seed % 4 === 0) {
          this._addSidewalkTrash(rx + cornerOffset + 1.2, rz - cornerOffset + 6.0);
        } else if (seed % 4 === 2) {
          this._addDumpster(rx - cornerOffset - 2.5, rz + cornerOffset + 4.5, Math.PI / 2);
        }

        // 4. Street Signs & Mailboxes / Utility Cabinets
        if (seed % 5 === 0) {
          this._addMailbox(rx - cornerOffset + 1.5, rz - cornerOffset + 5.5);
        } else if (seed % 5 === 2) {
          this._addUtilityCabinet(rx + cornerOffset + 1.8, rz + cornerOffset - 5.5);
        }

        if ((ix * iz + 3) % 4 === 0) {
          this._addStopSign(rx + cornerOffset - 1.2, rz - cornerOffset - 3.5);
        }
      }
    }
  }

  _addTrafficLight(x, z, rotation = 0) {
    const group = new THREE.Group();

    // Vertical Pole
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.6, 8), this._materials.trafficPole);
    mast.position.y = 2.8;
    mast.castShadow = true;
    group.add(mast);

    // Cantilever Arm reaching over road
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.12), this._materials.trafficPole);
    arm.position.set(1.6, 5.4, 0);
    group.add(arm);

    // Traffic Signal Box
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.25, 0.38), this._materials.trafficPole);
    box.position.set(3.0, 5.2, 0);
    group.add(box);

    // 3 Signal Lamps (Red, Yellow, Green)
    const lampGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12);
    lampGeo.rotateX(Math.PI / 2);

    const redLamp = new THREE.Mesh(lampGeo, this._materials.trafficRed);
    redLamp.position.set(3.0, 5.55, 0.18);
    group.add(redLamp);

    const yellowLamp = new THREE.Mesh(lampGeo, this._materials.trafficYellow);
    yellowLamp.position.set(3.0, 5.20, 0.18);
    group.add(yellowLamp);

    const greenLamp = new THREE.Mesh(lampGeo, this._materials.trafficGreen);
    greenLamp.position.set(3.0, 4.85, 0.18);
    group.add(greenLamp);

    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    this.group.add(group);
    this.collision.addBox(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 'traffic-light');
  }

  _addFireHydrant(x, z) {
    const group = new THREE.Group();

    // Red Main Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.72, 10), this._materials.hydrantRed);
    barrel.position.y = 0.36;
    barrel.castShadow = true;
    group.add(barrel);

    // Domed Top Cap
    const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), this._materials.hydrantRed);
    topCap.position.y = 0.72;
    group.add(topCap);

    // Chrome Nozzle Outlets
    const nozzleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.52, 8);
    nozzleGeo.rotateZ(Math.PI / 2);
    const nozzle = new THREE.Mesh(nozzleGeo, this._materials.chrome);
    nozzle.position.y = 0.46;
    group.add(nozzle);

    group.position.set(x, 0, z);
    this.group.add(group);
    this.collision.addBox(x - 0.22, x + 0.22, z - 0.22, z + 0.22, 'hydrant');
  }

  _addDumpster(x, z, rotation = 0) {
    const dumpster = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.45, 1.4), this._materials.dumpster);
    dumpster.position.set(x, 0.73, z);
    dumpster.rotation.y = rotation;
    dumpster.castShadow = true;
    this.group.add(dumpster);

    // Lid
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.10, 1.46), this._materials.trafficPole);
    lid.position.set(x, 1.48, z);
    lid.rotation.y = rotation;
    this.group.add(lid);

    this.collision.addBox(x - 1.2, x + 1.2, z - 0.75, z + 0.75, 'dumpster');
  }

  _addSidewalkTrash(x, z) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.85, 10), this._materials.trafficPole);
    can.position.set(x, 0.42, z);
    can.castShadow = true;
    this.group.add(can);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 10), this._materials.curb);
    lid.position.set(x, 0.86, z);
    this.group.add(lid);
  }

  _addMailbox(x, z) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.95, 0.55), this._materials.mailbox);
    box.position.set(x, 0.48, z);
    box.castShadow = true;
    this.group.add(box);

    const topRound = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.65, 8), this._materials.mailbox);
    topRound.rotateZ(Math.PI / 2);
    topRound.position.set(x, 0.95, z);
    this.group.add(topRound);

    this.collision.addBox(x - 0.35, x + 0.35, z - 0.3, z + 0.3, 'mailbox');
  }

  _addUtilityCabinet(x, z) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.35, 0.65), this._materials.utilityGray);
    cab.position.set(x, 0.68, z);
    cab.castShadow = true;
    this.group.add(cab);
    this.collision.addBox(x - 0.5, x + 0.5, z - 0.35, z + 0.35, 'utility-cabinet');
  }

  _addStopSign(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), this._materials.chrome);
    pole.position.set(x, 1.3, z);
    this.group.add(pole);

    const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 8), this._materials.barrierRed);
    sign.position.set(x, 2.35, z);
    sign.rotation.x = Math.PI / 2;
    this.group.add(sign);
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

    // Add window grid to buildings (except low industrial)
    if (height > 5 && style !== 'industrial') {
      this._addWindowGrid(x, z, width, depth, height, style);
    }

    if (style === 'office' && height > 11) this._addFacadeBands(x, z, width, depth, height);
    if (style === 'office' || style === 'industrial') {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(Math.min(4, width * 0.28), 1.1, Math.min(3, depth * 0.28)), this._materials.roofAC);
      hvac.position.set(x + width * 0.18, height + 0.65, z - depth * 0.12);
      hvac.castShadow = true;
      this.group.add(hvac);
    }

    // Add rooftop details for taller buildings
    if (height > 14) {
      const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.8, 10), this._materials.industrialDark);
      waterTank.position.set(x - width * 0.25, height + 1.05, z - depth * 0.2);
      waterTank.castShadow = true;
      this.group.add(waterTank);

      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 4.2, 6), this._materials.chrome);
      antenna.position.set(x + width * 0.2, height + 2.2, z + depth * 0.2);
      this.group.add(antenna);
    }

    // Add entrance canopy & glowing doorway for residential/office
    if (style === 'residential' || style === 'office') {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(Math.min(3.4, width * 0.35), 0.12, 1.35), this._materials.trafficPole);
      canopy.position.set(x, 2.3, z - depth * 0.5 - 0.55);
      canopy.castShadow = true;
      this.group.add(canopy);

      const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(Math.min(2.4, width * 0.25), 1.9, 0.08), this._materials.windowLit);
      doorGlow.position.set(x, 0.95, z - depth * 0.5 - 0.05);
      this.group.add(doorGlow);
    }
  }

  _addWindowGrid(x, z, width, depth, height, style) {
    const windowSpacing = style === 'residential' ? 2.8 : 2.4;
    const windowW = style === 'residential' ? 1.1 : 1.4;
    const windowH = style === 'residential' ? 1.3 : 1.6;
    const startY = 2.2;
    const rows = Math.max(1, Math.floor((height - startY - 1) / windowSpacing));

    for (let row = 0; row < rows; row++) {
      const y = startY + row * windowSpacing + windowH * 0.5;
      if (y + windowH * 0.5 > height - 0.8) break;

      // Front and back facades
      for (const face of [-1, 1]) {
        const cols = Math.max(1, Math.floor((width - 2) / (windowW + 0.8)));
        const startX = x - (cols - 1) * (windowW + 0.8) * 0.5;
        for (let col = 0; col < cols; col++) {
          const wx = startX + col * (windowW + 0.8);
          const randSeed = ((row + col) * 7 + Math.floor(x + z + row * 3));
          let winMat = this._materials.windowDark;
          if (randSeed % 3 === 0) {
            winMat = style === 'office' ? this._materials.windowOfficeLit : this._materials.windowLit;
          } else if (randSeed % 7 === 0) {
            winMat = this._materials.windowLit;
          }
          const win = new THREE.Mesh(new THREE.BoxGeometry(windowW, windowH, 0.06), winMat);
          win.position.set(wx, y, z + face * (depth * 0.5 + 0.04));
          this.group.add(win);
        }
      }

      // Left and right facades
      for (const face of [-1, 1]) {
        const cols = Math.max(1, Math.floor((depth - 2) / (windowW + 0.8)));
        const startZ = z - (cols - 1) * (windowW + 0.8) * 0.5;
        for (let col = 0; col < cols; col++) {
          const wz = startZ + col * (windowW + 0.8);
          const randSeed = ((row + col) * 11 + Math.floor(x + z + col * 5));
          let winMat = this._materials.windowDark;
          if (randSeed % 3 === 0) {
            winMat = style === 'office' ? this._materials.windowOfficeLit : this._materials.windowLit;
          } else if (randSeed % 6 === 0) {
            winMat = this._materials.windowLit;
          }
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, windowH, windowW), winMat);
          win.position.set(x + face * (width * 0.5 + 0.04), y, wz);
          this.group.add(win);
        }
      }
    }
  }

  _addFacadeBands(x, z, width, depth, height) {
    const rows = Math.min(5, Math.max(2, Math.floor(height / 6)));
    for (let row = 1; row <= rows; row++) {
      const y = (height / (rows + 1)) * row;
      const front = new THREE.Mesh(new THREE.BoxGeometry(width * 0.76, 0.55, 0.08), this._materials.facadeGlass);
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
