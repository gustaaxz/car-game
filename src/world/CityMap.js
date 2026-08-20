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
    this._geometries = this._createGeometries();

    // Batch instances collections for ultra-high-performance rendering
    this._dashInstances = [];
    this._crosswalkInstances = [];
    this._edgeLineInstances = [];
    this._manholeInstances = [];
    this._curbInstances = [];
    this._stormDrainInstances = [];
    this._facadeGlassInstances = [];
    this._roofLipInstances = [];
    this._hvacInstances = [];
    this._waterTankInstances = [];
    this._antennaInstances = [];
    this._doorCanopyInstances = [];
    this._doorGlowInstances = [];

    this._windowInstances = {
      windowDark: [],
      windowLit: [],
      windowOfficeLit: [],
    };

    this._treeTrunkInstances = [];
    this._treeRootInstances = [];
    this._treeBranchInstances = [];
    this._treeFoliageInstances = {
      tree: [],
      treeAlt: [],
      treeDark: [],
      treeBright: [],
    };
    this._treePineInstances = {
      tree: [],
      treeAlt: [],
      treeDark: [],
      treeBright: [],
    };

    this._benchSeatInstances = [];
    this._benchBackInstances = [];
    this._benchLegInstances = [];

    this._poleMastInstances = [];
    this._poleArmInstances = [];
    this._poleHeadInstances = [];
    this._poleLampInstances = [];

    this._trafficMastInstances = [];
    this._trafficArmInstances = [];
    this._trafficBoxInstances = [];
    this._trafficRedInstances = [];
    this._trafficYellowInstances = [];
    this._trafficGreenInstances = [];

    this._hydrantBarrelInstances = [];
    this._hydrantCapInstances = [];
    this._hydrantNozzleInstances = [];

    this._dumpsterInstances = [];
    this._dumpsterLidInstances = [];
    this._trashCanInstances = [];
    this._trashLidInstances = [];

    this._mailboxInstances = [];
    this._mailboxTopInstances = [];
    this._utilityCabinetInstances = [];
    this._stopSignPoleInstances = [];
    this._stopSignPlateInstances = [];

    this._containerInstances = {
      industrial: [],
      office: [],
      brick: [],
    };
    this._containerRibInstances = [];

    this._parkingLineInstances = [];
    this._wheelStopInstances = [];
    this._handicapInstances = [];

    this._gasPumpBaseInstances = [];
    this._gasPumpInstances = [];
    this._gasPumpScreenInstances = [];

    this._planterInstances = [];
    this._bushInstances = [];

    // Build city structure
    this._buildGround();
    this._buildRoadGrid();
    this._buildDistricts();
    this._buildLandmarks();
    this._buildStreetPoles();
    this._buildBoundary();
    this._addStreetProps();

    // Flush all instanced batches into single draw calls
    this._flushAllBatches();
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

  _createGeometries() {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const plane = new THREE.PlaneGeometry(1, 1);
    const sphere = new THREE.SphereGeometry(1, 8, 6);
    const cylManhole = new THREE.CylinderGeometry(0.55, 0.55, 0.03, 12);
    const cylPole = new THREE.CylinderGeometry(0.12, 0.18, 5.2, 8);
    const cylTrafficMast = new THREE.CylinderGeometry(0.12, 0.16, 5.6, 8);
    const cylTrafficLamp = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10);
    cylTrafficLamp.rotateX(Math.PI / 2);
    const cylTrunk = new THREE.CylinderGeometry(0.24, 0.36, 2.4, 8);
    const cylRoot = new THREE.CylinderGeometry(0.36, 0.54, 0.8, 8);
    const cylBranch = new THREE.CylinderGeometry(0.10, 0.15, 1.1, 6);
    const cylPine = new THREE.CylinderGeometry(1, 1, 1.4, 8);
    const cylHydrantBarrel = new THREE.CylinderGeometry(0.18, 0.22, 0.72, 10);
    const cylHydrantNozzle = new THREE.CylinderGeometry(0.08, 0.08, 0.52, 8);
    cylHydrantNozzle.rotateZ(Math.PI / 2);
    const cylTrashCan = new THREE.CylinderGeometry(0.24, 0.20, 0.85, 10);
    const cylTrashLid = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 10);
    const cylMailboxTop = new THREE.CylinderGeometry(0.27, 0.27, 0.65, 8);
    cylMailboxTop.rotateZ(Math.PI / 2);
    const cylStopPole = new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6);
    const cylStopPlate = new THREE.CylinderGeometry(0.38, 0.38, 0.04, 8);
    cylStopPlate.rotateX(Math.PI / 2);
    const cylWaterTank = new THREE.CylinderGeometry(0.85, 0.85, 1.8, 10);
    const cylAntenna = new THREE.CylinderGeometry(0.04, 0.08, 4.2, 6);

    return {
      box,
      plane,
      sphere,
      cylManhole,
      cylPole,
      cylTrafficMast,
      cylTrafficLamp,
      cylTrunk,
      cylRoot,
      cylBranch,
      cylPine,
      cylHydrantBarrel,
      cylHydrantNozzle,
      cylTrashCan,
      cylTrashLid,
      cylMailboxTop,
      cylStopPole,
      cylStopPlate,
      cylWaterTank,
      cylAntenna,
    };
  }

  _buildGround() {
    const size = GAME_CONFIG.city.halfSize * 2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this._materials.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.06;
    ground.matrixAutoUpdate = false;
    ground.updateMatrix();
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
  }

  _addDashedLaneLine(x, z, horizontal, length) {
    const dashLength = 5.5;
    const gap = 8.5;
    for (let offset = -length / 2 + 10; offset < length / 2 - 10; offset += dashLength + gap) {
      this._dashInstances.push({
        x: horizontal ? offset : x,
        y: 0.028,
        z: horizontal ? z : offset,
        sx: horizontal ? dashLength : 0.2,
        sz: horizontal ? 0.2 : dashLength,
        rotX: -Math.PI / 2,
      });
    }
  }

  _addRoadEdgeLines(x, z, horizontal, length) {
    const edge = GAME_CONFIG.city.roadWidth * 0.5 - 1.15;
    for (const side of [-1, 1]) {
      this._edgeLineInstances.push({
        x: horizontal ? 0 : x + side * edge,
        y: 0.026,
        z: horizontal ? z + side * edge : 0,
        sx: horizontal ? length : 0.12,
        sz: horizontal ? 0.12 : length,
        rotX: -Math.PI / 2,
      });
    }
  }

  _addCrosswalk(x, z, orientationSeed = 0) {
    const width = GAME_CONFIG.city.roadWidth;
    const rotate = orientationSeed % 2 === 1;
    for (let i = -3; i <= 3; i++) {
      this._crosswalkInstances.push({
        x: rotate ? x + width * 0.31 : x + i * 1.2,
        y: 0.03,
        z: rotate ? z + i * 1.2 : z + width * 0.31,
        sx: rotate ? 4.5 : 0.72,
        sz: rotate ? 0.72 : 4.5,
        rotX: -Math.PI / 2,
      });
    }
  }

  _addManholesAlongRoad(x, z, horizontal, length) {
    const step = 48;
    for (let offset = -length / 2 + 25; offset < length / 2 - 25; offset += step) {
      this._manholeInstances.push({
        x: horizontal ? offset : x + 2.8,
        y: 0.02,
        z: horizontal ? z + 2.8 : offset,
      });
    }
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
    this._curbInstances.push(
      { x, y: h * 0.5, z: z - size * 0.5, sx: size, sy: h, sz: t },
      { x, y: h * 0.5, z: z + size * 0.5, sx: size, sy: h, sz: t },
      { x: x - size * 0.5, y: h * 0.5, z, sx: t, sy: h, sz: size },
      { x: x + size * 0.5, y: h * 0.5, z, sx: t, sy: h, sz: size }
    );
  }

  _addStormDrains(x, z, size) {
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
      this._stormDrainInstances.push({ x: px, y: py, z: pz, sx: 1.4, sy: 0.03, sz: 0.65 });
    }
  }

  _buildPlaza(x, z, size) {
    this._plane(size - 7, size - 7, this._materials.concrete, x, 0.018, z);

    // Stepped Monument Pedestal
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.35, 24), this._materials.curb);
    base1.position.set(x, 0.18, z);
    base1.castShadow = true;
    base1.matrixAutoUpdate = false;
    base1.updateMatrix();
    this.group.add(base1);

    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.5, 0.35, 24), this._materials.concrete);
    base2.position.set(x, 0.53, z);
    base2.castShadow = true;
    base2.matrixAutoUpdate = false;
    base2.updateMatrix();
    this.group.add(base2);

    // Fountain Basin & Water
    const fountainBasin = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.4, 0.60, 20), this._materials.barrier);
    fountainBasin.position.set(x, 0.95, z);
    fountainBasin.castShadow = true;
    fountainBasin.matrixAutoUpdate = false;
    fountainBasin.updateMatrix();
    this.group.add(fountainBasin);

    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.08, 20), this._materials.water);
    water.position.set(x, 1.26, z);
    water.matrixAutoUpdate = false;
    water.updateMatrix();
    this.group.add(water);

    // Spire with Gold Finial
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.85, 4.2, 8), this._materials.concrete);
    spire.position.set(x, 3.1, z);
    spire.castShadow = true;
    spire.matrixAutoUpdate = false;
    spire.updateMatrix();
    this.group.add(spire);

    const goldGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), this._materials.gold);
    goldGlobe.position.set(x, 5.4, z);
    goldGlobe.castShadow = true;
    goldGlobe.matrixAutoUpdate = false;
    goldGlobe.updateMatrix();
    this.group.add(goldGlobe);

    this.collision.addBox(x - 3.4, x + 3.4, z - 3.4, z + 3.4, 'monument');

    // Planters with Foliage
    const planterOffsets = [[-7, -7], [7, -7], [-7, 7], [7, 7]];
    for (const [px, pz] of planterOffsets) {
      this._planterInstances.push({ x: x + px, y: 0.24, z: z + pz, sx: 2.4, sy: 0.45, sz: 1.2 });
      this._bushInstances.push({ x: x + px, y: 0.65, z: z + pz, sx: 1.4 * 0.65, sy: 0.7 * 0.65, sz: 0.8 * 0.65 });
    }

    this._addTrees(x, z, 8, Math.min(17, size * 0.38));
    this._addBenches(x, z);
  }

  _buildParking(x, z, size) {
    this._plane(size - 6, size - 6, this._materials.asphalt, x, 0.018, z);

    for (let i = -4; i <= 4; i++) {
      for (const row of [-1, 1]) {
        this._parkingLineInstances.push({
          x: x + i * 4.2,
          y: 0.03,
          z: z + row * 10.2,
          sx: 0.14,
          sz: 6.4,
          rotX: -Math.PI / 2,
        });

        this._wheelStopInstances.push({
          x: x + i * 4.2 + 2.1,
          y: 0.07,
          z: z + row * 13.0,
          sx: 2.0,
          sy: 0.14,
          sz: 0.22,
        });
      }
    }

    for (const row of [-1, 1]) {
      this._handicapInstances.push({
        x: x - 4.2 * 3.5,
        y: 0.026,
        z: z + row * 10.2,
        sx: 2.8,
        sz: 4.2,
        rotX: -Math.PI / 2,
      });
    }

    const island = new THREE.Mesh(new THREE.BoxGeometry(10, 0.22, 2.4), this._materials.curb);
    island.position.set(x, 0.11, z);
    island.matrixAutoUpdate = false;
    island.updateMatrix();
    this.group.add(island);

    const islandGrass = this._plane(9.4, 1.8, this._materials.grass, x, 0.23, z);
    islandGrass.receiveShadow = true;

    this._tree(x - 3.2, z, 1);
    this._tree(x + 3.2, z, 2);
  }

  _buildGasStation(x, z, size) {
    this._plane(size - 6, size - 6, this._materials.concrete, x, 0.018, z);
    this._building(x + 11, z + 9, 15, 12, 6, this._materials.officeLight, 'office');

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(19, 0.75, 11), this._materials.barrier);
    canopy.position.set(x - 6, 4.6, z - 5);
    canopy.castShadow = true;
    canopy.matrixAutoUpdate = false;
    canopy.updateMatrix();
    this.group.add(canopy);

    const canopyTrim = new THREE.Mesh(new THREE.BoxGeometry(19.2, 0.18, 11.2), this._materials.yellow);
    canopyTrim.position.set(x - 6, 4.85, z - 5);
    canopyTrim.matrixAutoUpdate = false;
    canopyTrim.updateMatrix();
    this.group.add(canopyTrim);

    for (const px of [-11, -2]) {
      for (const pz of [-8, -2]) {
        const posX = x + px + 5;
        const posZ = z + pz + 5;

        this._gasPumpBaseInstances.push({ x: posX, y: 0.11, z: posZ, sx: 1.6, sy: 0.22, sz: 2.6 });
        this._gasPumpInstances.push({ x: posX, y: 1.15, z: posZ, sx: 0.85, sy: 2.2, sz: 0.85 });
        this._gasPumpScreenInstances.push({ x: posX, y: 1.45, z: posZ, sx: 0.5, sy: 0.35, sz: 0.90 });

        this.collision.addBox(posX - 0.6, posX + 0.6, posZ - 0.6, posZ + 0.6, 'gas-pump');
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
      const bx = x + ox;
      const bz = z + oz;
      this._benchSeatInstances.push({ x: bx, y: 0.65, z: bz, sx: 3.2, sy: 0.18, sz: 0.65, rotY: rot });
      this._benchBackInstances.push({ x: bx, y: 1.05, z: bz, sx: 3.2, sy: 0.75, sz: 0.14, rotY: rot });

      for (const side of [-1.3, 1.3]) {
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const lx = bx + side * cosR - 0.12 * sinR;
        const lz = bz + side * sinR + 0.12 * cosR;
        this._benchLegInstances.push({ x: lx, y: 0.32, z: lz, sx: 0.12, sy: 0.65, sz: 0.70, rotY: rot });
      }
    }
  }

  _addIndustrialProps(x, z) {
    const types = ['industrial', 'office', 'brick'];
    const positions = [[-15, 15], [-9, 15], [15, -15]];
    positions.forEach(([ox, oz], index) => {
      const colorType = types[index % types.length];
      const cx = x + ox;
      const cz = z + oz;

      this._containerInstances[colorType].push({
        x: cx,
        y: 1.33,
        z: cz,
        sx: 5.5,
        sy: 2.65,
        sz: 2.45,
      });

      for (let r = -2.2; r <= 2.2; r += 0.55) {
        this._containerRibInstances.push({
          x: cx + r,
          y: 1.33,
          z: cz + 1.25,
          sx: 0.06,
          sy: 2.5,
          sz: 0.08,
        });
      }

      this.collision.addBox(cx - 2.75, cx + 2.75, cz - 1.25, cz + 1.25, 'container');
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
    this._treeRootInstances.push({ x, y: 0.4, z });
    this._treeTrunkInstances.push({ x, y: 1.6, z });

    this._treeBranchInstances.push(
      { x: x + 0.3, y: 2.4, z: z + 0.2, rotX: 0.4, rotY: 0.3, rotZ: -0.5 },
      { x: x - 0.25, y: 2.5, z: z - 0.2, rotX: -0.3, rotY: -0.4, rotZ: 0.5 }
    );

    const matKeys = ['tree', 'treeAlt', 'treeDark', 'treeBright'];
    const keyA = matKeys[seed % matKeys.length];
    const keyB = matKeys[(seed + 1) % matKeys.length];
    const keyC = matKeys[(seed + 2) % matKeys.length];

    const isPine = seed % 4 === 3;

    if (isPine) {
      for (let layer = 0; layer < 3; layer++) {
        const rTop = 0.4 + (2 - layer) * 0.4;
        const rBot = 1.2 + (2 - layer) * 0.6;
        const scaleAvg = (rTop + rBot) * 0.5;
        const k = layer % 2 ? keyA : keyB;
        this._treePineInstances[k].push({
          x,
          y: 3.0 + layer * 1.1,
          z,
          sx: scaleAvg,
          sy: 1,
          sz: scaleAvg,
        });
      }
    } else {
      const crownR = 1.65 + (seed % 3) * 0.15;
      this._treeFoliageInstances[keyA].push({
        x,
        y: 3.6,
        z,
        sx: crownR * 1.1,
        sy: crownR,
        sz: crownR * 1.1,
      });

      this._treeFoliageInstances[keyB].push({
        x: x + 0.7,
        y: 3.9,
        z: z + 0.5,
        sx: 1.15,
        sy: 1.15,
        sz: 1.15,
      });

      this._treeFoliageInstances[keyC].push({
        x: x - 0.6,
        y: 3.8,
        z: z - 0.4,
        sx: 1.05,
        sy: 1.05,
        sz: 1.05,
      });

      this._treeFoliageInstances[keyA].push({
        x: x + 0.2,
        y: 4.4,
        z: z - 0.3,
        sx: 0.95,
        sy: 0.95,
        sz: 0.95,
      });
    }

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
      wall.matrixAutoUpdate = false;
      wall.updateMatrix();
      this.group.add(wall);
      this.collision.addBox(wall.position.x - 0.7, wall.position.x + 0.7, z - 16, z + 16, 'tunnel-wall');
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 3.5, 0.75, 32), this._materials.concrete);
    roof.position.set(x, 5.7, z);
    roof.castShadow = true;
    roof.matrixAutoUpdate = false;
    roof.updateMatrix();
    this.group.add(roof);
  }

  _buildIndustrialOverpass() {
    const x = -210;
    const z = -245;
    const beamMat = this._materials.industrial;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 0.85, 2.2), beamMat);
    beam.position.set(x, 6.4, z);
    beam.castShadow = true;
    beam.matrixAutoUpdate = false;
    beam.updateMatrix();
    this.group.add(beam);
    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.4, 1.2), beamMat);
      support.position.set(x + side * 12.5, 3.2, z);
      support.castShadow = true;
      support.matrixAutoUpdate = false;
      support.updateMatrix();
      this.group.add(support);
      this.collision.addBox(support.position.x - 0.6, support.position.x + 0.6, z - 0.6, z + 0.6, 'overpass-support');
    }
  }

  _buildStreetPoles() {
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

          this._poleMastInstances.push({ x, y: 2.6, z });
          this._poleArmInstances.push({ x: x - sign * 0.65, y: 5.15, z, sx: 1.5, sy: 0.10, sz: 0.10 });
          this._poleHeadInstances.push({ x: x - sign * 1.25, y: 5.08, z, sx: 0.85, sy: 0.16, sz: 0.38 });
          this._poleLampInstances.push({ x: x - sign * 1.25, y: 4.98, z, sx: 0.72, sy: 0.05, sz: 0.30 });

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

        if ((ix + iz) % 2 === 0) {
          this._addTrafficLight(rx - cornerOffset, rz - cornerOffset, 0);
          this._addTrafficLight(rx + cornerOffset, rz + cornerOffset, Math.PI);
        }

        if (seed % 3 === 0) {
          this._addFireHydrant(rx + cornerOffset, rz - cornerOffset + 3.2);
        } else if (seed % 3 === 1) {
          this._addFireHydrant(rx - cornerOffset, rz + cornerOffset - 3.2);
        }

        if (seed % 4 === 0) {
          this._addSidewalkTrash(rx + cornerOffset + 1.2, rz - cornerOffset + 6.0);
        } else if (seed % 4 === 2) {
          this._addDumpster(rx - cornerOffset - 2.5, rz + cornerOffset + 4.5, Math.PI / 2);
        }

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
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    this._trafficMastInstances.push({ x, y: 2.8, z });

    const armX = x + 1.6 * cosR;
    const armZ = z + 1.6 * sinR;
    this._trafficArmInstances.push({ x: armX, y: 5.4, z: armZ, sx: 3.6, sy: 0.12, sz: 0.12, rotY: rotation });

    const boxX = x + 3.0 * cosR;
    const boxZ = z + 3.0 * sinR;
    this._trafficBoxInstances.push({ x: boxX, y: 5.2, z: boxZ, sx: 0.42, sy: 1.25, sz: 0.38, rotY: rotation });

    const lampOffsetX = 0.18 * (-sinR);
    const lampOffsetZ = 0.18 * cosR;

    this._trafficRedInstances.push({ x: boxX + lampOffsetX, y: 5.55, z: boxZ + lampOffsetZ, rotY: rotation });
    this._trafficYellowInstances.push({ x: boxX + lampOffsetX, y: 5.20, z: boxZ + lampOffsetZ, rotY: rotation });
    this._trafficGreenInstances.push({ x: boxX + lampOffsetX, y: 4.85, z: boxZ + lampOffsetZ, rotY: rotation });

    this.collision.addBox(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 'traffic-light');
  }

  _addFireHydrant(x, z) {
    this._hydrantBarrelInstances.push({ x, y: 0.36, z });
    this._hydrantCapInstances.push({ x, y: 0.72, z, sx: 0.18, sy: 0.18, sz: 0.18 });
    this._hydrantNozzleInstances.push({ x, y: 0.46, z });
    this.collision.addBox(x - 0.22, x + 0.22, z - 0.22, z + 0.22, 'hydrant');
  }

  _addDumpster(x, z, rotation = 0) {
    this._dumpsterInstances.push({ x, y: 0.73, z, sx: 2.4, sy: 1.45, sz: 1.4, rotY: rotation });
    this._dumpsterLidInstances.push({ x, y: 1.48, z, sx: 2.46, sy: 0.10, sz: 1.46, rotY: rotation });
    this.collision.addBox(x - 1.2, x + 1.2, z - 0.75, z + 0.75, 'dumpster');
  }

  _addSidewalkTrash(x, z) {
    this._trashCanInstances.push({ x, y: 0.42, z });
    this._trashLidInstances.push({ x, y: 0.86, z });
  }

  _addMailbox(x, z) {
    this._mailboxInstances.push({ x, y: 0.48, z, sx: 0.65, sy: 0.95, sz: 0.55 });
    this._mailboxTopInstances.push({ x, y: 0.95, z });
    this.collision.addBox(x - 0.35, x + 0.35, z - 0.3, z + 0.3, 'mailbox');
  }

  _addUtilityCabinet(x, z) {
    this._utilityCabinetInstances.push({ x, y: 0.68, z, sx: 0.95, sy: 1.35, sz: 0.65 });
    this.collision.addBox(x - 0.5, x + 0.5, z - 0.35, z + 0.35, 'utility-cabinet');
  }

  _addStopSign(x, z) {
    this._stopSignPoleInstances.push({ x, y: 1.3, z });
    this._stopSignPlateInstances.push({ x, y: 2.35, z });
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
      wall.matrixAutoUpdate = false;
      wall.updateMatrix();
      this.group.add(wall);
    }
  }

  _building(x, z, width, depth, height, material, style = 'generic') {
    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    building.matrixAutoUpdate = false;
    building.updateMatrix();
    this.group.add(building);
    this.collision.addBox(x - width / 2, x + width / 2, z - depth / 2, z + depth / 2, 'building');

    this._roofLipInstances.push({
      x,
      y: height + 0.11,
      z,
      sx: width + 0.35,
      sy: 0.22,
      sz: depth + 0.35,
    });

    if (height > 5 && style !== 'industrial') {
      this._addWindowGrid(x, z, width, depth, height, style);
    }

    if (style === 'office' && height > 11) {
      this._addFacadeBands(x, z, width, depth, height);
    }

    if (style === 'office' || style === 'industrial') {
      this._hvacInstances.push({
        x: x + width * 0.18,
        y: height + 0.65,
        z: z - depth * 0.12,
        sx: Math.min(4, width * 0.28),
        sy: 1.1,
        sz: Math.min(3, depth * 0.28),
      });
    }

    if (height > 14) {
      this._waterTankInstances.push({
        x: x - width * 0.25,
        y: height + 1.05,
        z: z - depth * 0.2,
      });

      this._antennaInstances.push({
        x: x + width * 0.2,
        y: height + 2.2,
        z: z + depth * 0.2,
      });
    }

    if (style === 'residential' || style === 'office') {
      this._doorCanopyInstances.push({
        x,
        y: 2.3,
        z: z - depth * 0.5 - 0.55,
        sx: Math.min(3.4, width * 0.35),
        sy: 0.12,
        sz: 1.35,
      });

      this._doorGlowInstances.push({
        x,
        y: 0.95,
        z: z - depth * 0.5 - 0.05,
        sx: Math.min(2.4, width * 0.25),
        sy: 1.9,
        sz: 0.08,
      });
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
          let winKey = 'windowDark';
          if (randSeed % 3 === 0) {
            winKey = style === 'office' ? 'windowOfficeLit' : 'windowLit';
          } else if (randSeed % 7 === 0) {
            winKey = 'windowLit';
          }
          this._windowInstances[winKey].push({
            x: wx,
            y,
            z: z + face * (depth * 0.5 + 0.04),
            sx: windowW,
            sy: windowH,
            sz: 0.06,
          });
        }
      }

      // Left and right facades
      for (const face of [-1, 1]) {
        const cols = Math.max(1, Math.floor((depth - 2) / (windowW + 0.8)));
        const startZ = z - (cols - 1) * (windowW + 0.8) * 0.5;
        for (let col = 0; col < cols; col++) {
          const wz = startZ + col * (windowW + 0.8);
          const randSeed = ((row + col) * 11 + Math.floor(x + z + col * 5));
          let winKey = 'windowDark';
          if (randSeed % 3 === 0) {
            winKey = style === 'office' ? 'windowOfficeLit' : 'windowLit';
          } else if (randSeed % 6 === 0) {
            winKey = 'windowLit';
          }
          this._windowInstances[winKey].push({
            x: x + face * (width * 0.5 + 0.04),
            y,
            z: wz,
            sx: 0.06,
            sy: windowH,
            sz: windowW,
          });
        }
      }
    }
  }

  _addFacadeBands(x, z, width, depth, height) {
    const rows = Math.min(5, Math.max(2, Math.floor(height / 6)));
    for (let row = 1; row <= rows; row++) {
      const y = (height / (rows + 1)) * row;
      this._facadeGlassInstances.push(
        { x, y, z: z - depth * 0.5 - 0.045, sx: width * 0.76, sy: 0.55, sz: 0.08 },
        { x, y, z: z + depth * 0.5 + 0.045, sx: width * 0.76, sy: 0.55, sz: 0.08 }
      );
    }
  }

  _plane(width, depth, material, x, y, z, parent = null) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    (parent ?? this.group).add(mesh);
    return mesh;
  }

  _instantiateBatch(geometry, material, list, name, castShadow = false, receiveShadow = false) {
    if (!list || list.length === 0) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    mesh.name = name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = true;
    mesh.matrixAutoUpdate = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      dummy.position.set(it.x, it.y ?? 0, it.z);
      if (it.rotX || it.rotY || it.rotZ) {
        dummy.rotation.set(it.rotX || 0, it.rotY || 0, it.rotZ || 0);
      } else {
        dummy.rotation.set(0, 0, 0);
      }
      dummy.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.updateMatrix();
    this.group.add(mesh);
    list.length = 0;
    return mesh;
  }

  _flushAllBatches() {
    const g = this._geometries;
    const m = this._materials;

    // Road markings
    this._instantiateBatch(g.plane, m.lane, this._dashInstances, 'LaneDashes', false, false);
    this._instantiateBatch(g.plane, m.white, this._crosswalkInstances, 'Crosswalks', false, false);
    this._instantiateBatch(g.plane, m.white, this._edgeLineInstances, 'RoadEdgeLines', false, false);
    this._instantiateBatch(g.cylManhole, m.manhole, this._manholeInstances, 'Manholes', false, false);

    // Curbs & storm drains
    this._instantiateBatch(g.box, m.curb, this._curbInstances, 'Curbs', false, true);
    this._instantiateBatch(g.box, m.drainGrill, this._stormDrainInstances, 'StormDrains', false, false);

    // Architectural features & Windows
    this._instantiateBatch(g.box, m.windowDark, this._windowInstances.windowDark, 'WindowsDark', false, false);
    this._instantiateBatch(g.box, m.windowLit, this._windowInstances.windowLit, 'WindowsLit', false, false);
    this._instantiateBatch(g.box, m.windowOfficeLit, this._windowInstances.windowOfficeLit, 'WindowsOfficeLit', false, false);
    this._instantiateBatch(g.box, m.facadeGlass, this._facadeGlassInstances, 'FacadeBands', false, false);
    this._instantiateBatch(g.box, m.roof, this._roofLipInstances, 'RoofLips', true, false);
    this._instantiateBatch(g.box, m.roofAC, this._hvacInstances, 'RoofHVAC', true, false);
    this._instantiateBatch(g.cylWaterTank, m.industrialDark, this._waterTankInstances, 'WaterTanks', true, false);
    this._instantiateBatch(g.cylAntenna, m.chrome, this._antennaInstances, 'Antennas', false, false);
    this._instantiateBatch(g.box, m.trafficPole, this._doorCanopyInstances, 'DoorCanopies', true, false);
    this._instantiateBatch(g.box, m.windowLit, this._doorGlowInstances, 'DoorGlows', false, false);

    // Trees
    this._instantiateBatch(g.cylRoot, m.trunkDark, this._treeRootInstances, 'TreeRoots', true, false);
    this._instantiateBatch(g.cylTrunk, m.trunk, this._treeTrunkInstances, 'TreeTrunks', true, false);
    this._instantiateBatch(g.cylBranch, m.trunk, this._treeBranchInstances, 'TreeBranches', false, false);
    this._instantiateBatch(g.sphere, m.tree, this._treeFoliageInstances.tree, 'TreeFoliageA', true, false);
    this._instantiateBatch(g.sphere, m.treeAlt, this._treeFoliageInstances.treeAlt, 'TreeFoliageB', true, false);
    this._instantiateBatch(g.sphere, m.treeDark, this._treeFoliageInstances.treeDark, 'TreeFoliageC', true, false);
    this._instantiateBatch(g.sphere, m.treeBright, this._treeFoliageInstances.treeBright, 'TreeFoliageD', true, false);
    this._instantiateBatch(g.cylPine, m.tree, this._treePineInstances.tree, 'PineFoliageA', true, false);
    this._instantiateBatch(g.cylPine, m.treeAlt, this._treePineInstances.treeAlt, 'PineFoliageB', true, false);
    this._instantiateBatch(g.cylPine, m.treeDark, this._treePineInstances.treeDark, 'PineFoliageC', true, false);
    this._instantiateBatch(g.cylPine, m.treeBright, this._treePineInstances.treeBright, 'PineFoliageD', true, false);

    // Street poles
    this._instantiateBatch(g.cylPole, m.trafficPole, this._poleMastInstances, 'PoleMasts', true, false);
    this._instantiateBatch(g.box, m.trafficPole, this._poleArmInstances, 'PoleArms', false, false);
    this._instantiateBatch(g.box, m.trafficPole, this._poleHeadInstances, 'PoleHeads', false, false);
    this._instantiateBatch(g.box, m.yellow, this._poleLampInstances, 'PoleLamps', false, false);

    // Traffic signals
    this._instantiateBatch(g.cylTrafficMast, m.trafficPole, this._trafficMastInstances, 'TrafficMasts', true, false);
    this._instantiateBatch(g.box, m.trafficPole, this._trafficArmInstances, 'TrafficArms', false, false);
    this._instantiateBatch(g.box, m.trafficPole, this._trafficBoxInstances, 'TrafficBoxes', false, false);
    this._instantiateBatch(g.cylTrafficLamp, m.trafficRed, this._trafficRedInstances, 'TrafficRedLamps', false, false);
    this._instantiateBatch(g.cylTrafficLamp, m.trafficYellow, this._trafficYellowInstances, 'TrafficYellowLamps', false, false);
    this._instantiateBatch(g.cylTrafficLamp, m.trafficGreen, this._trafficGreenInstances, 'TrafficGreenLamps', false, false);

    // Street props
    this._instantiateBatch(g.cylHydrantBarrel, m.hydrantRed, this._hydrantBarrelInstances, 'HydrantBarrels', true, false);
    this._instantiateBatch(g.sphere, m.hydrantRed, this._hydrantCapInstances, 'HydrantCaps', false, false);
    this._instantiateBatch(g.cylHydrantNozzle, m.chrome, this._hydrantNozzleInstances, 'HydrantNozzles', false, false);
    this._instantiateBatch(g.box, m.dumpster, this._dumpsterInstances, 'Dumpsters', true, false);
    this._instantiateBatch(g.box, m.trafficPole, this._dumpsterLidInstances, 'DumpsterLids', false, false);
    this._instantiateBatch(g.cylTrashCan, m.trafficPole, this._trashCanInstances, 'TrashCans', true, false);
    this._instantiateBatch(g.cylTrashLid, m.curb, this._trashLidInstances, 'TrashLids', false, false);
    this._instantiateBatch(g.box, m.mailbox, this._mailboxInstances, 'Mailboxes', true, false);
    this._instantiateBatch(g.cylMailboxTop, m.mailbox, this._mailboxTopInstances, 'MailboxTops', false, false);
    this._instantiateBatch(g.box, m.utilityGray, this._utilityCabinetInstances, 'UtilityCabinets', true, false);
    this._instantiateBatch(g.cylStopPole, m.chrome, this._stopSignPoleInstances, 'StopSignPoles', false, false);
    this._instantiateBatch(g.cylStopPlate, m.barrierRed, this._stopSignPlateInstances, 'StopSignPlates', false, false);

    // Industrial props
    this._instantiateBatch(g.box, m.industrial, this._containerInstances.industrial, 'ContainersInd', true, false);
    this._instantiateBatch(g.box, m.office, this._containerInstances.office, 'ContainersOff', true, false);
    this._instantiateBatch(g.box, m.brick, this._containerInstances.brick, 'ContainersBrk', true, false);
    this._instantiateBatch(g.box, m.trafficPole, this._containerRibInstances, 'ContainerRibs', false, false);

    // Parking props
    this._instantiateBatch(g.plane, m.white, this._parkingLineInstances, 'ParkingLines', false, false);
    this._instantiateBatch(g.box, m.curb, this._wheelStopInstances, 'WheelStops', false, false);
    this._instantiateBatch(g.plane, m.handicapBlue, this._handicapInstances, 'HandicapMarks', false, false);

    // Gas station props
    this._instantiateBatch(g.box, m.curb, this._gasPumpBaseInstances, 'PumpBases', false, false);
    this._instantiateBatch(g.box, m.industrial, this._gasPumpInstances, 'GasPumps', true, false);
    this._instantiateBatch(g.box, m.windowLit, this._gasPumpScreenInstances, 'PumpScreens', false, false);

    // Benches & Plaza
    this._instantiateBatch(g.box, m.trunk, this._benchSeatInstances, 'BenchSeats', true, false);
    this._instantiateBatch(g.box, m.trunk, this._benchBackInstances, 'BenchBacks', true, false);
    this._instantiateBatch(g.box, m.trafficPole, this._benchLegInstances, 'BenchLegs', false, false);
    this._instantiateBatch(g.box, m.curb, this._planterInstances, 'Planters', true, false);
    this._instantiateBatch(g.sphere, m.treeBright, this._bushInstances, 'Bushes', true, false);
  }
}
