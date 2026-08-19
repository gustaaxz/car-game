import * as THREE from 'three';
import { Entity } from './Entity.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

const TYPE_CONFIG = Object.freeze({
  CAR:        { length: 4.1, width: 1.82, height: 0.6, cabin: 1.55, speed: 13.2, radius: 1.35, color: 0x3d5a80 },
  TAXI:       { length: 4.1, width: 1.82, height: 0.6, cabin: 1.55, speed: 14.0, radius: 1.38, color: 0xf4b41a },
  MOTORCYCLE: { length: 2.25, width: 0.72, height: 0.55, cabin: 0.0, speed: 16.2, radius: 0.8, color: 0x22252a },
  TRUCK:      { length: 6.6, width: 2.35, height: 1.15, cabin: 1.6, speed: 9.8, radius: 2.1, color: 0x4a6b82 },
  BUS:        { length: 8.4, width: 2.4, height: 1.55, cabin: 0.0, speed: 9.0, radius: 2.4, color: 0x2e7d5e },
});

const CAR_PALETTE = [
  0x2c4a6f, // deep blue
  0x8b2635, // crimson red
  0x2e5a44, // dark green
  0x4a5568, // slate gray
  0x718096, // silver gray
  0xd69e2e, // amber gold
  0x1a202c, // midnight black
  0x553c9a, // royal purple
  0xc53030, // cherry red
  0x2b6cb0, // vibrant blue
  0x319795, // teal
];

let TRAFFIC_ID = 1;

export class TrafficVehicle extends Entity {
  constructor(type = 'CAR') {
    const root = new THREE.Group();
    super(root);
    this.type = TYPE_CONFIG[type] ? type : 'CAR';
    this.spec = TYPE_CONFIG[this.type];
    this.collisionId = `traffic-${TRAFFIC_ID++}`;
    this.collisionRadius = this.spec.radius;
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.route = [];
    this.routeIndex = 0;
    this.targetSpeed = this.spec.speed;
    this._desired = new THREE.Vector3();
    this._temp = new THREE.Vector3();

    // Pick a distinct color from the palette for CARs to ensure rich traffic variety
    if (this.type === 'CAR') {
      const paletteIndex = (TRAFFIC_ID * 7) % CAR_PALETTE.length;
      this.color = CAR_PALETTE[paletteIndex];
    } else {
      this.color = this.spec.color;
    }

    this._buildVisual();
    root.userData.realismEnhanced = true; // Mark as fully built to prevent legacy double-geometry
  }

  _buildVisual() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.45,
      metalness: 0.28,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0d1a24,
      roughness: 0.18,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x141414,
      roughness: 0.95,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.25,
      metalness: 0.75,
    });
    const blackMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.85,
      metalness: 0.05,
    });
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfffce6,
      emissive: 0xfff4c2,
      emissiveIntensity: 0.65,
      roughness: 0.3,
      metalness: 0.1,
    });
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xcc1122,
      emissive: 0x991010,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    });

    if (this.type === 'MOTORCYCLE') {
      this._buildMotorcycle(bodyMat, tireMat, chromeMat, blackMat, headlightMat, taillightMat);
      return;
    }

    const w = this.spec.width;
    const h = this.spec.height;
    const l = this.spec.length;

    if (this.type === 'BUS') {
      this._buildBus(w, h, l, bodyMat, glassMat, tireMat, blackMat, chromeMat, headlightMat, taillightMat);
    } else if (this.type === 'TRUCK') {
      this._buildTruck(w, h, l, bodyMat, glassMat, tireMat, blackMat, chromeMat, headlightMat, taillightMat);
    } else if (this.type === 'TAXI') {
      this._buildSedan(w, h, l, bodyMat, glassMat, tireMat, blackMat, chromeMat, headlightMat, taillightMat, true);
    } else {
      this._buildSedan(w, h, l, bodyMat, glassMat, tireMat, blackMat, chromeMat, headlightMat, taillightMat, false);
    }
  }

  _buildSedan(w, h, l, bodyMat, glassMat, tireMat, blackMat, chromeMat, headlightMat, taillightMat, isTaxi = false) {
    // 1. Lower Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, 0.50, l * 0.96), bodyMat);
    chassis.position.y = 0.54;
    chassis.castShadow = true;
    this.object3D.add(chassis);

    // 2. Sloped Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.18, l * 0.32), bodyMat);
    hood.position.set(0, 0.84, -l * 0.30);
    hood.rotation.x = -0.07;
    hood.castShadow = true;
    this.object3D.add(hood);

    // 3. Sloped Trunk
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.16, l * 0.24), bodyMat);
    trunk.position.set(0, 0.83, l * 0.33);
    trunk.castShadow = true;
    this.object3D.add(trunk);

    // 4. Roof Panel
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.80, 0.08, l * 0.38), bodyMat);
    roof.position.set(0, 1.44, 0.04);
    roof.castShadow = true;
    this.object3D.add(roof);

    // 5. Angled Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.80, 0.54, 0.06), glassMat);
    windshield.position.set(0, 1.18, -l * 0.14);
    windshield.rotation.x = 0.50;
    this.object3D.add(windshield);

    // 6. Angled Rear Window
    const rearWin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.46, 0.06), glassMat);
    rearWin.position.set(0, 1.18, l * 0.21);
    rearWin.rotation.x = -0.46;
    this.object3D.add(rearWin);

    // 7. Side Windows
    const sideWinGeo = new THREE.BoxGeometry(0.05, 0.40, l * 0.33);
    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(sideWinGeo, glassMat);
      sw.position.set(side * w * 0.41, 1.18, 0.04);
      this.object3D.add(sw);
    }

    // 8. Pillars (A-Pillars & C-Pillars)
    const pillarGeo = new THREE.BoxGeometry(0.08, 0.50, 0.08);
    for (const side of [-1, 1]) {
      const pillarA = new THREE.Mesh(pillarGeo, blackMat);
      pillarA.position.set(side * w * 0.39, 1.16, -l * 0.13);
      this.object3D.add(pillarA);

      const pillarC = new THREE.Mesh(pillarGeo, blackMat);
      pillarC.position.set(side * w * 0.38, 1.16, l * 0.20);
      this.object3D.add(pillarC);
    }

    // 9. Front & Rear Bumpers
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.24, 0.28), blackMat);
    frontBumper.position.set(0, 0.40, -l * 0.50);
    frontBumper.castShadow = true;
    this.object3D.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.22, 0.26), blackMat);
    rearBumper.position.set(0, 0.40, l * 0.49);
    rearBumper.castShadow = true;
    this.object3D.add(rearBumper);

    // 10. Front Grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.60, 0.12, 0.06), chromeMat);
    grille.position.set(0, 0.50, -l * 0.51);
    this.object3D.add(grille);

    // 11. Headlights
    const hlGeo = new THREE.BoxGeometry(w * 0.18, 0.16, 0.10);
    for (const side of [-w * 0.34, w * 0.34]) {
      const hl = new THREE.Mesh(hlGeo, headlightMat);
      hl.position.set(side, 0.60, -l * 0.49);
      this.object3D.add(hl);
    }

    // 12. Taillights
    const tlGeo = new THREE.BoxGeometry(w * 0.20, 0.14, 0.08);
    for (const side of [-w * 0.33, w * 0.33]) {
      const tl = new THREE.Mesh(tlGeo, taillightMat);
      tl.position.set(side, 0.62, l * 0.49);
      this.object3D.add(tl);
    }

    // 13. Side Mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.14, 0.10, 0.16);
    for (const side of [-1, 1]) {
      const mirror = new THREE.Mesh(mirrorGeo, blackMat);
      mirror.position.set(side * (w * 0.52 + 0.03), 0.92, -l * 0.08);
      this.object3D.add(mirror);
    }

    // 14. Chrome Exhaust Pipe
    const exhaustGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exhaustGeo, chromeMat);
    exhaust.position.set(-w * 0.26, 0.32, l * 0.50);
    this.object3D.add(exhaust);

    // 15. Wheel Arches (Fender Flares)
    const archGeo = new THREE.BoxGeometry(0.18, 0.18, 0.68);
    const axle = l * 0.32;
    for (const side of [-1, 1]) {
      for (const z of [-axle, axle]) {
        const arch = new THREE.Mesh(archGeo, bodyMat);
        arch.position.set(side * w * 0.48, 0.56, z);
        this.object3D.add(arch);
      }
    }

    // 16. Wheels with Chrome Rims
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.24, 8);
    rimGeo.rotateZ(Math.PI / 2);
    const halfW = w * 0.51;

    for (const [x, z] of [[-halfW, -axle], [halfW, -axle], [-halfW, axle], [halfW, axle]]) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(x, 0.35, z);
      wheel.castShadow = true;
      this.object3D.add(wheel);

      const rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.position.set(x, 0.35, z);
      this.object3D.add(rim);
    }

    // 17. Taxi Specifics (Luminous Roof Sign & Livery Decals)
    if (isTaxi) {
      // Checkered / Black Side Stripes
      const stripeGeo = new THREE.BoxGeometry(0.06, 0.14, l * 0.68);
      for (const side of [-1, 1]) {
        const stripe = new THREE.Mesh(stripeGeo, blackMat);
        stripe.position.set(side * (w * 0.50 + 0.01), 0.68, 0.02);
        this.object3D.add(stripe);
      }

      // Roof Base & Illuminated "TAXI" Sign
      const signBase = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.32), blackMat);
      signBase.position.set(0, 1.50, 0.04);
      this.object3D.add(signBase);

      const signMat = new THREE.MeshStandardMaterial({
        color: 0xffe066,
        emissive: 0xffa500,
        emissiveIntensity: 0.75,
        roughness: 0.3,
      });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.20, 0.26), signMat);
      sign.position.set(0, 1.62, 0.04);
      sign.castShadow = true;
      this.object3D.add(sign);
    }
  }

  _buildMotorcycle(bodyMat, tireMat, chromeMat, blackMat, headlightMat, taillightMat) {
    // 1. Main Frame Chassis
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 1.35), bodyMat);
    frame.position.y = 0.64;
    frame.castShadow = true;
    this.object3D.add(frame);

    // 2. Fuel Tank (Sculpted)
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.26, 0.54), bodyMat);
    tank.position.set(0, 0.90, -0.22);
    tank.castShadow = true;
    this.object3D.add(tank);

    // 3. Leather Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.14, 0.66), blackMat);
    seat.position.set(0, 0.86, 0.24);
    this.object3D.add(seat);

    // 4. Front Dual Chrome Forks
    const forkGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.78, 8);
    for (const side of [-0.09, 0.09]) {
      const fork = new THREE.Mesh(forkGeo, chromeMat);
      fork.position.set(side, 0.60, -0.70);
      fork.rotation.x = -0.22;
      this.object3D.add(fork);
    }

    // 5. Handlebars with Rubber Grips
    const handlebar = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.06), chromeMat);
    handlebar.position.set(0, 1.04, -0.40);
    this.object3D.add(handlebar);

    const gripGeo = new THREE.BoxGeometry(0.12, 0.07, 0.07);
    for (const side of [-0.34, 0.34]) {
      const grip = new THREE.Mesh(gripGeo, blackMat);
      grip.position.set(side, 1.04, -0.40);
      this.object3D.add(grip);
    }

    // 6. Round Headlight
    const headlightGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.10, 12);
    headlightGeo.rotateX(Math.PI / 2);
    const headlight = new THREE.Mesh(headlightGeo, headlightMat);
    headlight.position.set(0, 0.86, -0.84);
    this.object3D.add(headlight);

    // 7. Taillight
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.06), taillightMat);
    tail.position.set(0, 0.78, 0.80);
    this.object3D.add(tail);

    // 8. Detailed Engine Block with Cooling Fins
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.36), blackMat);
    engine.position.set(0, 0.46, -0.10);
    this.object3D.add(engine);

    const finGeo = new THREE.BoxGeometry(0.34, 0.03, 0.38);
    for (let i = -0.08; i <= 0.08; i += 0.08) {
      const fin = new THREE.Mesh(finGeo, chromeMat);
      fin.position.set(0, 0.46 + i, -0.10);
      this.object3D.add(fin);
    }

    // 9. Chrome Side Exhaust Pipe
    const exhaustGeo = new THREE.CylinderGeometry(0.045, 0.065, 0.75, 8);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exhaustGeo, chromeMat);
    exhaust.position.set(0.22, 0.38, 0.36);
    this.object3D.add(exhaust);

    // 10. Wheels with Chrome Rims & Spokes
    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.12, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 8);
    rimGeo.rotateZ(Math.PI / 2);

    for (const z of [-0.80, 0.80]) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(0, 0.33, z);
      wheel.castShadow = true;
      this.object3D.add(wheel);

      const rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.position.set(0, 0.33, z);
      this.object3D.add(rim);
    }
  }

  _buildTruck(w, h, l, bodyMat, glassMat, tireMat, blackMat, chromeMat, headlightMat, taillightMat) {
    // 1. Lower Heavy Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.30, l * 0.96), blackMat);
    chassis.position.y = 0.50;
    chassis.castShadow = true;
    this.object3D.add(chassis);

    // 2. Cab Body
    const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 1.48, 2.10), bodyMat);
    cab.position.set(0, 1.60, -l * 0.33);
    cab.castShadow = true;
    this.object3D.add(cab);

    // 3. Cab Roof Sun Visor
    const visor = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.10, 0.36), blackMat);
    visor.position.set(0, 2.38, -l * 0.33 - 0.98);
    this.object3D.add(visor);

    // 4. Angled Windshield
    const cabWin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.84, 0.06), glassMat);
    cabWin.position.set(0, 1.78, -l * 0.33 - 1.04);
    cabWin.rotation.x = 0.14;
    this.object3D.add(cabWin);

    // 5. Cab Side Windows
    const sideWinGeo = new THREE.BoxGeometry(0.05, 0.62, 0.94);
    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(sideWinGeo, glassMat);
      sw.position.set(side * w * 0.46, 1.78, -l * 0.33);
      this.object3D.add(sw);
    }

    // 6. Heavy Duty Front Bumper
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, 0.36, 0.28), blackMat);
    frontBumper.position.set(0, 0.52, -l * 0.49);
    frontBumper.castShadow = true;
    this.object3D.add(frontBumper);

    // 7. Chrome Front Grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 0.64, 0.08), chromeMat);
    grille.position.set(0, 1.12, -l * 0.49);
    this.object3D.add(grille);

    // 8. Headlights
    const hlGeo = new THREE.BoxGeometry(0.40, 0.28, 0.10);
    for (const side of [-w * 0.35, w * 0.35]) {
      const hl = new THREE.Mesh(hlGeo, headlightMat);
      hl.position.set(side, 0.88, -l * 0.48);
      this.object3D.add(hl);
    }

    // 9. Large Truck Dual-Arm Mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.34, 0.12);
    for (const side of [-1, 1]) {
      const mirror = new THREE.Mesh(mirrorGeo, blackMat);
      mirror.position.set(side * (w * 0.56 + 0.04), 1.74, -l * 0.33 - 0.55);
      this.object3D.add(mirror);
    }

    // 10. Vertical Chrome Exhaust Stack
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 1.65, 8), chromeMat);
    stack.position.set(-w * 0.38, 2.10, -l * 0.33 + 1.15);
    this.object3D.add(stack);

    // 11. Cylindrical Fuel Tanks under Chassis
    const tankGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.35, 12);
    tankGeo.rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      const fTank = new THREE.Mesh(tankGeo, chromeMat);
      fTank.position.set(side * w * 0.42, 0.52, -0.45);
      this.object3D.add(fTank);
    }

    // 12. Cargo Box (Baú)
    const cargoBoxMat = new THREE.MeshStandardMaterial({
      color: 0xd4d8db,
      roughness: 0.40,
      metalness: 0.30,
    });
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 2.15, l * 0.58), cargoBoxMat);
    cargo.position.set(0, 1.84, l * 0.18);
    cargo.castShadow = true;
    this.object3D.add(cargo);

    // 13. Cargo Box Vertical Reinforcement Ribs
    const stripGeo = new THREE.BoxGeometry(0.06, 2.10, 0.08);
    for (const side of [-1, 1]) {
      for (let offset = -l * 0.24; offset <= l * 0.24; offset += 0.72) {
        const strip = new THREE.Mesh(stripGeo, blackMat);
        strip.position.set(side * w * 0.495, 1.84, l * 0.18 + offset);
        this.object3D.add(strip);
      }
    }

    // 14. Rear Cargo Doors & Lock Bars
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(w * 0.90, 2.05, 0.08), blackMat);
    doorFrame.position.set(0, 1.84, l * 0.47);
    this.object3D.add(doorFrame);

    const lockBarGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.95, 6);
    for (const side of [-0.25, 0.25]) {
      const bar = new THREE.Mesh(lockBarGeo, chromeMat);
      bar.position.set(side, 1.84, l * 0.48);
      this.object3D.add(bar);
    }

    // 15. Rear Taillights & Under-Ride Guard
    const tlGeo = new THREE.BoxGeometry(0.34, 0.18, 0.08);
    for (const side of [-w * 0.36, w * 0.36]) {
      const tl = new THREE.Mesh(tlGeo, taillightMat);
      tl.position.set(side, 0.78, l * 0.48);
      this.object3D.add(tl);
    }

    const rearGuard = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.16, 0.14), blackMat);
    rearGuard.position.set(0, 0.42, l * 0.48);
    this.object3D.add(rearGuard);

    // 16. 6 Heavy-Duty Wheels with Chrome Hubs
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.28, 8);
    rimGeo.rotateZ(Math.PI / 2);
    const halfW = w * 0.52;

    const wheelPositions = [
      [-halfW, -l * 0.33], [halfW, -l * 0.33],
      [-halfW, l * 0.14],  [halfW, l * 0.14],
      [-halfW, l * 0.34],  [halfW, l * 0.34],
    ];

    for (const [x, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(x, 0.38, z);
      wheel.castShadow = true;
      this.object3D.add(wheel);

      const rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.position.set(x, 0.38, z);
      this.object3D.add(rim);
    }
  }

  _buildBus(w, h, l, bodyMat, glassMat, tireMat, blackMat, chromeMat, headlightMat, taillightMat) {
    // 1. Lower Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.32, l * 0.96), blackMat);
    chassis.position.y = 0.48;
    chassis.castShadow = true;
    this.object3D.add(chassis);

    // 2. Main Coach Body
    const upper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 2.15, l * 0.96), bodyMat);
    upper.position.set(0, 1.66, 0);
    upper.castShadow = true;
    this.object3D.add(upper);

    // 3. Continuous Tinted Side Window Band
    const windowBandGeo = new THREE.BoxGeometry(0.06, 0.84, l * 0.84);
    for (const side of [-1, 1]) {
      const band = new THREE.Mesh(windowBandGeo, glassMat);
      band.position.set(side * w * 0.465, 1.90, 0);
      this.object3D.add(band);
    }

    // 4. Window Pillars (Dividing Mullions)
    const pillarGeo = new THREE.BoxGeometry(0.08, 0.84, 0.08);
    for (const side of [-1, 1]) {
      for (let z = -l * 0.36; z <= l * 0.36; z += 1.15) {
        const pillar = new THREE.Mesh(pillarGeo, blackMat);
        pillar.position.set(side * w * 0.468, 1.90, z);
        this.object3D.add(pillar);
      }
    }

    // 5. Large Curved Panoramic Front Windshield
    const frontWin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 1.18, 0.06), glassMat);
    frontWin.position.set(0, 1.78, -l * 0.47);
    frontWin.rotation.x = 0.10;
    this.object3D.add(frontWin);

    // 6. Rear Window
    const rearWin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.74, 0.06), glassMat);
    rearWin.position.set(0, 1.86, l * 0.47);
    this.object3D.add(rearWin);

    // 7. Destination Display / Top Sign Box (Letreiro)
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      emissive: 0xffaa00,
      emissiveIntensity: 0.65,
      roughness: 0.3,
    });
    const destSign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.64, 0.24, 0.08), signMat);
    destSign.position.set(0, 2.50, -l * 0.47);
    this.object3D.add(destSign);

    // 8. Rooftop AC / Climate Control Units
    const acGeo = new THREE.BoxGeometry(1.45, 0.32, 1.35);
    for (const z of [-l * 0.18, l * 0.18]) {
      const ac = new THREE.Mesh(acGeo, blackMat);
      ac.position.set(0, 2.84, z);
      ac.castShadow = true;
      this.object3D.add(ac);
    }

    // 9. Decorative Chrome/Livery Stripe Along Sides
    const stripeGeo = new THREE.BoxGeometry(0.06, 0.18, l * 0.94);
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(stripeGeo, chromeMat);
      stripe.position.set(side * w * 0.468, 0.95, 0);
      this.object3D.add(stripe);
    }

    // 10. Heavy Duty Front & Rear Bumpers
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.38, 0.28), blackMat);
    frontBumper.position.set(0, 0.46, -l * 0.49);
    frontBumper.castShadow = true;
    this.object3D.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.34, 0.26), blackMat);
    rearBumper.position.set(0, 0.46, l * 0.48);
    rearBumper.castShadow = true;
    this.object3D.add(rearBumper);

    // 11. Dual Headlights
    const hlGeo = new THREE.BoxGeometry(0.36, 0.24, 0.10);
    for (const side of [-w * 0.35, w * 0.35]) {
      const hl = new THREE.Mesh(hlGeo, headlightMat);
      hl.position.set(side, 0.78, -l * 0.48);
      this.object3D.add(hl);
    }

    // 12. Vertical Taillights
    const tlGeo = new THREE.BoxGeometry(0.24, 0.38, 0.08);
    for (const side of [-w * 0.36, w * 0.36]) {
      const tl = new THREE.Mesh(tlGeo, taillightMat);
      tl.position.set(side, 0.92, l * 0.48);
      this.object3D.add(tl);
    }

    // 13. Extended Bus Side Mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.20, 0.36, 0.14);
    for (const side of [-1, 1]) {
      const mirror = new THREE.Mesh(mirrorGeo, blackMat);
      mirror.position.set(side * (w * 0.58 + 0.05), 1.66, -l * 0.42);
      this.object3D.add(mirror);
    }

    // 14. 6 Wheels with Chrome Rims & Wheel Arches
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.26, 8);
    rimGeo.rotateZ(Math.PI / 2);
    const halfW = w * 0.51;

    const wheelPositions = [
      [-halfW, -l * 0.32], [halfW, -l * 0.32],
      [-halfW, l * 0.16],  [halfW, l * 0.16],
      [-halfW, l * 0.34],  [halfW, l * 0.34],
    ];

    for (const [x, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(x, 0.38, z);
      wheel.castShadow = true;
      this.object3D.add(wheel);

      const rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.position.set(x, 0.38, z);
      this.object3D.add(rim);
    }

    // Wheel arches
    const archGeo = new THREE.BoxGeometry(0.20, 0.20, 0.85);
    for (const [x, z] of wheelPositions) {
      const arch = new THREE.Mesh(archGeo, bodyMat);
      arch.position.set(x, 0.65, z);
      this.object3D.add(arch);
    }
  }

  reset(spawn, route) {
    this.object3D.position.set(spawn.x, 0, spawn.z);
    this.heading = spawn.heading ?? 0;
    this.object3D.rotation.y = this.heading;
    this.velocity.set(0, 0, 0);
    this.route = route ?? [];
    this.routeIndex = this.route.length > 1 ? 1 : 0;
    this._refreshAxes();
  }

  setRoute(route) {
    this.route = route ?? [];
    this.routeIndex = this.route.length > 1 ? 1 : 0;
  }

  update(deltaTime, city, trafficManager, policeManager) {
    if (deltaTime <= 0 || this.route.length === 0) return;
    let target = this.route[Math.min(this.routeIndex, this.route.length - 1)];
    if (!target) return;

    const distance = Math.hypot(target.x - this.object3D.position.x, target.z - this.object3D.position.z);
    if (distance < GAME_CONFIG.traffic.waypointRadius) {
      if (this.routeIndex < this.route.length - 1) {
        this.routeIndex += 1;
        target = this.route[this.routeIndex];
      } else {
        trafficManager.assignNewRoute(this);
        target = this.route[Math.min(this.routeIndex, this.route.length - 1)] ?? target;
      }
    }

    this._desired.set(target.x, 0, target.z).sub(this.object3D.position);
    if (this._desired.lengthSq() < 0.01) return;
    this._desired.normalize();
    this._refreshAxes();

    const desiredHeading = Math.atan2(-this._desired.x, -this._desired.z);
    const angleDelta = this._normalizeAngle(desiredHeading - this.heading);
    const steerInput = THREE.MathUtils.clamp(angleDelta / 0.7, -1, 1);

    const forwardSpeed = this.velocity.dot(this.forward);
    const trafficFactor = trafficManager.getTrafficSpeedFactor(this);
    const policeFactor = this._getPoliceYieldFactor(policeManager);
    const cornerFactor = THREE.MathUtils.clamp(1 - Math.abs(angleDelta) / 1.5, 0.28, 1);
    const desiredSpeed = this.targetSpeed * trafficFactor * policeFactor * cornerFactor;

    if (forwardSpeed < desiredSpeed) {
      this.velocity.addScaledVector(this.forward, GAME_CONFIG.traffic.acceleration * deltaTime);
    } else if (forwardSpeed > desiredSpeed + 0.4) {
      const braking = Math.min(forwardSpeed, GAME_CONFIG.traffic.brakeForce * deltaTime);
      this.velocity.addScaledVector(this.forward, -braking);
    }

    const speed = Math.abs(this.velocity.dot(this.forward));
    if (speed > 0.35) {
      const authority = THREE.MathUtils.clamp(speed / 5, 0.18, 1);
      this.heading += steerInput * GAME_CONFIG.traffic.steeringRate * authority * deltaTime;
    }

    this._refreshAxes();
    const lateral = this.velocity.dot(this.right);
    const grip = 1 - Math.exp(-GAME_CONFIG.traffic.grip * deltaTime);
    this.velocity.addScaledVector(this.right, -lateral * grip);

    const currentForward = this.velocity.dot(this.forward);
    if (currentForward > this.targetSpeed * 1.05) {
      this.velocity.addScaledVector(this.forward, this.targetSpeed * 1.05 - currentForward);
    }

    const drag = Math.min(this.velocity.length(), GAME_CONFIG.traffic.rollingResistance * deltaTime);
    if (drag > 0.0001) {
      this._temp.copy(this.velocity).normalize();
      this.velocity.addScaledVector(this._temp, -drag);
    }

    this.object3D.position.addScaledVector(this.velocity, deltaTime);
    this.object3D.rotation.y = this.heading;
    const collided = city.collision.resolveCircle(this.object3D.position, this.velocity, this.collisionRadius, 0.03);
    if (collided) this.velocity.multiplyScalar(0.45);
  }

  _getPoliceYieldFactor(policeManager) {
    if (!policeManager) return 1;
    let closest = Infinity;
    for (const unit of policeManager.units) {
      const d = unit.vehicle.object3D.position.distanceTo(this.object3D.position);
      if (d < closest) closest = d;
    }
    if (closest < 6) return 0.22;
    if (closest < 12) return 0.55;
    return 1;
  }

  _refreshAxes() {
    this.forward.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.right.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  _normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}
