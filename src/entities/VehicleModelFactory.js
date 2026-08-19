import * as THREE from 'three';

// ─── Materiais reutilizáveis e otimizados ──────────────────────────────────
const _matCache = {};
function mat(key, props) {
  if (!_matCache[key]) _matCache[key] = new THREE.MeshStandardMaterial(props);
  return _matCache[key];
}

export const M = {
  tire:       () => mat('tire',       { color: 0x181818, roughness: 0.9, metalness: 0.05 }),
  rim:        () => mat('rim',        { color: 0xcccccc, roughness: 0.25, metalness: 0.8 }),
  rimDark:    () => mat('rimDark',    { color: 0x2b2b2b, roughness: 0.4, metalness: 0.7 }),
  glass:      () => mat('glass',      { color: 0x141e28, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 }),
  headlight:  () => mat('headlight',  { color: 0xffffee, emissive: 0xfff4d0, emissiveIntensity: 1.8, roughness: 0.1, metalness: 0.5 }),
  taillight:  () => mat('taillight',  { color: 0xee1515, emissive: 0xdd1111, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.2 }),
  reverseLight: () => mat('reverse',  { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.2 }),
  turnLight:  () => mat('turn',       { color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 1.2 }),
  chrome:     () => mat('chrome',     { color: 0xdddddd, roughness: 0.1, metalness: 0.9 }),
  darkPlastic:() => mat('darkPlastic',{ color: 0x22262a, roughness: 0.8, metalness: 0.1 }),
  grille:     () => mat('grille',     { color: 0x15181c, roughness: 0.7, metalness: 0.3 }),
  policeRed:  () => mat('policeRed',  { color: 0xff1a2a, emissive: 0xff0015, emissiveIntensity: 3.0, roughness: 0.1 }),
  policeBlue: () => mat('policeBlue', { color: 0x1a75ff, emissive: 0x0055ff, emissiveIntensity: 3.0, roughness: 0.1 }),
  uniform:    () => mat('uniform',    { color: 0x152238, roughness: 0.75, metalness: 0.05 }),
  skin:       () => mat('skin',       { color: 0xdfa77e, roughness: 0.85 }),
  vest:       () => mat('vest',       { color: 0x111620, roughness: 0.6, metalness: 0.15 }),
  helmet:     () => mat('helmet',     { color: 0x191e2b, roughness: 0.35, metalness: 0.2 }),
  yellowSign: () => mat('yellowSign', { color: 0xffc400, emissive: 0xcca000, emissiveIntensity: 0.8, roughness: 0.3 }),
  busGlass:   () => mat('busGlass',   { color: 0x1e2d3d, roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.75 }),
  exhaust:    () => mat('exhaust',    { color: 0x555555, roughness: 0.35, metalness: 0.75 }),
  metalFrame: () => mat('metalFrame', { color: 0x333a42, roughness: 0.5, metalness: 0.6 }),
  containerBlue: () => mat('cBlue',   { color: 0x204a87, roughness: 0.6, metalness: 0.2 }),
  containerWhite:() => mat('cWhite',  { color: 0xeeeeee, roughness: 0.55, metalness: 0.15 }),
};

// ─── Helpers de Rodas e Detalhes ───────────────────────────────────────────

function createWheel(radius = 0.36, width = 0.26, isSport = false) {
  const wheel = new THREE.Group();
  wheel.name = 'animated_wheel';

  // Pneu
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, M.tire());
  tire.castShadow = true;
  wheel.add(tire);

  // Aro
  const rimGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 1.02, 14);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, isSport ? M.rimDark() : M.rim());
  wheel.add(rim);

  // Calotinha central
  const capGeo = new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width * 1.06, 10);
  capGeo.rotateZ(Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, M.chrome());
  wheel.add(cap);

  // Raios
  const spokeCount = isSport ? 7 : 5;
  const spokeGeo = new THREE.BoxGeometry(width * 1.03, radius * 0.42, radius * 0.08);
  for (let i = 0; i < spokeCount; i++) {
    const spoke = new THREE.Mesh(spokeGeo, isSport ? M.rim() : M.rimDark());
    const angle = (i / spokeCount) * Math.PI * 2;
    spoke.position.set(0, Math.sin(angle) * radius * 0.26, Math.cos(angle) * radius * 0.26);
    spoke.rotation.x = angle;
    wheel.add(spoke);
  }

  return wheel;
}

function addStandardCarDetails(group, w, l, bodyY, h, frontZ, rearZ, bodyColor) {
  const hw = w / 2;

  // Faróis dianteiros (esferas ou caixas com emissive)
  const headGeo = new THREE.BoxGeometry(0.28, 0.12, 0.08);
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(headGeo, M.headlight());
    head.position.set(side * (hw - 0.25), bodyY + h * 0.45, frontZ - 0.02);
    group.add(head);

    // Seta / pisca
    const turnGeo = new THREE.BoxGeometry(0.1, 0.08, 0.06);
    const turn = new THREE.Mesh(turnGeo, M.turnLight());
    turn.position.set(side * (hw - 0.08), bodyY + h * 0.45, frontZ - 0.02);
    group.add(turn);
  }

  // Grade frontal
  const grilleGeo = new THREE.BoxGeometry(w * 0.45, 0.16, 0.05);
  const grille = new THREE.Mesh(grilleGeo, M.grille());
  grille.position.set(0, bodyY + h * 0.4, frontZ - 0.02);
  group.add(grille);

  // Lanternas traseiras
  const tailGeo = new THREE.BoxGeometry(0.32, 0.11, 0.06);
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(tailGeo, M.taillight());
    tail.position.set(side * (hw - 0.26), bodyY + h * 0.5, rearZ + 0.02);
    group.add(tail);
  }

  // Retrovisores laterais
  const mirrorGeo = new THREE.BoxGeometry(0.14, 0.09, 0.12);
  const mirrorMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.3 });
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
    mirror.position.set(side * (hw + 0.1), bodyY + h + 0.18, frontZ * 0.25);
    group.add(mirror);
  }

  // Para-choques
  const bumperGeoF = new THREE.BoxGeometry(w * 0.96, 0.14, 0.15);
  const bumperF = new THREE.Mesh(bumperGeoF, M.darkPlastic());
  bumperF.position.set(0, bodyY + 0.08, frontZ - 0.06);
  group.add(bumperF);

  const bumperGeoR = new THREE.BoxGeometry(w * 0.96, 0.14, 0.15);
  const bumperR = new THREE.Mesh(bumperGeoR, M.darkPlastic());
  bumperR.position.set(0, bodyY + 0.08, rearZ + 0.06);
  group.add(bumperR);
}

function installFourWheels(group, halfW, frontZ, rearZ, radius = 0.36, width = 0.26, isSport = false) {
  const wheels = [];
  const positions = [
    [-halfW, radius, frontZ],
    [halfW,  radius, frontZ],
    [-halfW, radius, rearZ],
    [halfW,  radius, rearZ],
  ];

  for (const [x, y, z] of positions) {
    const w = createWheel(radius, width, isSport);
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
  }
  return wheels;
}

// ─── CARROCERIA BASE POLIDA ────────────────────────────────────────────────

function buildSleekCar(width, length, baseHeight, cabinHeight, cabinZ, cabinLen, bodyColor, isSport = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: isSport ? 0.25 : 0.38,
    metalness: isSport ? 0.6 : 0.35,
  });
  group.__bodyMat = bodyMat;

  const bodyY = 0.32;
  const hw = width / 2;
  const hl = length / 2;

  // Chassi inferior
  const baseBox = new THREE.Mesh(new THREE.BoxGeometry(width, baseHeight, length), bodyMat);
  baseBox.position.set(0, bodyY + baseHeight / 2, 0);
  baseBox.castShadow = true;
  baseBox.receiveShadow = true;
  group.add(baseBox);

  // Capô inclinado
  const hoodLen = hl - Math.abs(cabinZ) - cabinLen / 2;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, baseHeight * 0.7, hoodLen * 1.05), bodyMat);
  hood.position.set(0, bodyY + baseHeight * 0.72, -hl + hoodLen / 2 + 0.1);
  hood.rotation.x = -0.06;
  group.add(hood);

  // Cabine com vidros
  const cabinWidth = width * 0.86;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLen), M.glass());
  cabin.position.set(0, bodyY + baseHeight + cabinHeight / 2 - 0.02, cabinZ);
  cabin.castShadow = true;
  group.add(cabin);

  // Teto pintado
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.92, 0.05, cabinLen * 0.78), bodyMat);
  roof.position.set(0, bodyY + baseHeight + cabinHeight, cabinZ + 0.05);
  roof.castShadow = true;
  group.add(roof);

  // Colunas da cabine (A-pillars e C-pillars)
  const pillarMat = M.darkPlastic();
  const pillarGeo = new THREE.BoxGeometry(0.06, cabinHeight, 0.08);
  for (const side of [-1, 1]) {
    const pFront = new THREE.Mesh(pillarGeo, pillarMat);
    pFront.position.set(side * (cabinWidth / 2 - 0.02), bodyY + baseHeight + cabinHeight / 2, cabinZ - cabinLen / 2 + 0.08);
    pFront.rotation.x = -0.28;
    group.add(pFront);

    const pRear = new THREE.Mesh(pillarGeo, pillarMat);
    pRear.position.set(side * (cabinWidth / 2 - 0.02), bodyY + baseHeight + cabinHeight / 2, cabinZ + cabinLen / 2 - 0.08);
    pRear.rotation.x = 0.28;
    group.add(pRear);
  }

  addStandardCarDetails(group, width, length, bodyY, baseHeight, -hl, hl, bodyColor);
  return group;
}

// ─── 1. MODELOS DOS CARROS DO JOGADOR ──────────────────────────────────────

function buildPlayerCompact(color = 0xb51624) {
  const group = buildSleekCar(1.8, 4.0, 0.58, 0.56, 0.25, 1.9, color, false);

  // Aerofólio de teto traseiro
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.25), M.darkPlastic());
  wing.position.set(0, 1.48, 1.35);
  group.add(wing);

  // Escapamento cromado
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), M.exhaust());
  exh.rotateX(Math.PI / 2);
  exh.position.set(0.55, 0.32, 2.05);
  group.add(exh);

  installFourWheels(group, 0.94, -1.25, 1.25, 0.35, 0.25, false);
  return group;
}

function buildPlayerMuscle(color = 0x294e9b) {
  const group = buildSleekCar(1.95, 4.6, 0.62, 0.54, 0.45, 1.8, color, true);

  // Supercharger / Blower no capô
  const blower = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.65), M.chrome());
  blower.position.set(0, 1.05, -1.1);
  group.add(blower);

  const intakeFlaps = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.1), M.policeRed());
  intakeFlaps.position.set(0, 1.08, -1.4);
  group.add(intakeFlaps);

  // Faixa de corrida dupla (Racing stripes)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 4.4), M.containerWhite());
  stripe.position.set(0, 0.96, 0.05);
  group.add(stripe);

  // Aerofólio traseiro grande de competição
  const spoilerMat = M.darkPlastic();
  const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.06, 0.32), spoilerMat);
  spoilerWing.position.set(0, 1.36, 2.15);
  group.add(spoilerWing);

  for (const side of [-0.55, 0.55]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.08), spoilerMat);
    post.position.set(side, 1.18, 2.15);
    group.add(post);
  }

  // Escapamento duplo
  for (const side of [-0.6, 0.6]) {
    const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10), M.exhaust());
    exh.rotateX(Math.PI / 2);
    exh.position.set(side, 0.3, 2.34);
    group.add(exh);
  }

  installFourWheels(group, 1.04, -1.45, 1.45, 0.39, 0.3, true);
  return group;
}

function buildPlayerSport(color = 0xe6a51b) {
  const group = buildSleekCar(1.92, 4.45, 0.46, 0.44, 0.35, 1.7, color, true);

  // Difusor de ar traseiro com aletas
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.3), M.darkPlastic());
  diffuser.position.set(0, 0.26, 2.22);
  group.add(diffuser);

  // Saia lateral aerodinâmica
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.4), M.darkPlastic());
    skirt.position.set(side * 0.98, 0.26, 0);
    group.add(skirt);
  }

  // Spoiler integrado (Ducktail / Lip spoiler)
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.18), group.__bodyMat);
  lip.position.set(0, 0.88, 2.2);
  lip.rotation.x = -0.3;
  group.add(lip);

  // Quádruplo escapamento esportivo
  for (const x of [-0.42, -0.28, 0.28, 0.42]) {
    const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), M.exhaust());
    exh.rotateX(Math.PI / 2);
    exh.position.set(x, 0.32, 2.26);
    group.add(exh);
  }

  installFourWheels(group, 1.0, -1.4, 1.35, 0.36, 0.28, true);
  return group;
}

function buildPlayerSUV(color = 0x3b5c47) {
  const group = buildSleekCar(2.08, 4.65, 0.78, 0.7, 0.3, 2.3, color, false);

  // Para-choque frontal reforçado (Mata-Cachorro / Bull-bar offroad)
  const bullMat = M.darkPlastic();
  const bull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.15), bullMat);
  bull.position.set(0, 0.55, -2.42);
  group.add(bull);

  // Faróis de milha auxiliares no para-choque
  for (const side of [-0.4, 0.4]) {
    const fog = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), M.headlight());
    fog.position.set(side, 0.65, -2.48);
    group.add(fog);
  }

  // Rack de teto (Roof rack com barras)
  const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.06, 2.0), M.metalFrame());
  rackFrame.position.set(0, 1.88, 0.3);
  group.add(rackFrame);

  // Estepe na traseira
  const spare = createWheel(0.38, 0.26, false);
  spare.position.set(0, 0.95, 2.44);
  spare.rotation.y = Math.PI / 2;
  group.add(spare);

  installFourWheels(group, 1.1, -1.45, 1.45, 0.42, 0.32, false);
  return group;
}

// ─── 2. VIATURAS POLICIAIS DETALHADAS ──────────────────────────────────────

function installPoliceLightbar(group, y, z, width = 1.15, isSleek = false) {
  const barGroup = new THREE.Group();
  barGroup.name = 'police_lightbar';

  // Base de fixação preta/cromada
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, isSleek ? 0.08 : 0.12, 0.24), M.darkPlastic());
  base.position.set(0, y, z);
  barGroup.add(base);

  // Domo de luzes vermelho e azul
  const halfW = width * 0.42;
  const lightGeo = new THREE.BoxGeometry(halfW, isSleek ? 0.1 : 0.14, 0.2);

  const redLight = new THREE.Mesh(lightGeo, M.policeRed());
  redLight.position.set(-halfW / 2 - 0.04, y + 0.02, z);
  redLight.name = 'siren_red';
  barGroup.add(redLight);

  const blueLight = new THREE.Mesh(lightGeo, M.policeBlue());
  blueLight.position.set(halfW / 2 + 0.04, y + 0.02, z);
  blueLight.name = 'siren_blue';
  barGroup.add(blueLight);

  // Luz estroboscópica branca central
  const strobe = new THREE.Mesh(new THREE.BoxGeometry(0.12, isSleek ? 0.09 : 0.13, 0.2), M.headlight());
  strobe.position.set(0, y + 0.02, z);
  barGroup.add(strobe);

  group.add(barGroup);
}

function buildPoliceStandard() {
  const group = buildSleekCar(1.92, 4.45, 0.62, 0.58, 0.3, 1.9, 0xf0f2f5, false);

  // Faixa tática preta/azul nas laterais
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 3.2), M.uniform());
  stripe.position.set(0, 0.68, 0.15);
  group.add(stripe);

  // Grade de impulsão frontal (Push bumper)
  const pushBumper = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.12), M.darkPlastic());
  pushBumper.position.set(0, 0.55, -2.32);
  group.add(pushBumper);

  // Barra de sirene no teto
  installPoliceLightbar(group, 1.58, 0.25, 1.25, false);

  installFourWheels(group, 1.0, -1.35, 1.35, 0.37, 0.27, false);
  return group;
}

function buildPoliceInterceptor() {
  // Sedan esportivo preto e grafite tático
  const group = buildSleekCar(1.94, 4.55, 0.55, 0.5, 0.35, 1.8, 0x1a212b, true);

  // Faixa reflexiva branca fina
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.1, 3.6), M.containerWhite());
  stripe.position.set(0, 0.65, 0.1);
  group.add(stripe);

  // Lightbar de perfil ultrabaixo (Sleek LED bar)
  installPoliceLightbar(group, 1.44, 0.3, 1.15, true);

  // Spoiler traseiro
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.25), M.darkPlastic());
  spoiler.position.set(0, 1.08, 2.15);
  group.add(spoiler);

  // Push bumper tático
  const pushBumper = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.12), M.darkPlastic());
  pushBumper.position.set(0, 0.52, -2.36);
  group.add(pushBumper);

  installFourWheels(group, 1.02, -1.4, 1.4, 0.37, 0.28, true);
  return group;
}

function buildPoliceSpecial() {
  // SUV blindado das Forças Especiais / Tático
  const group = buildSleekCar(2.15, 4.75, 0.82, 0.72, 0.3, 2.4, 0x111418, false);

  // Blindagem nas janelas e portas
  const armorStripe = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.15, 3.8), M.darkPlastic());
  armorStripe.position.set(0, 0.78, 0);
  group.add(armorStripe);

  // Quebra-mato gigante blindado
  const heavyBumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 0.18), M.darkPlastic());
  heavyBumper.position.set(0, 0.65, -2.48);
  group.add(heavyBumper);

  // Sirenes duplas (frente e traseira do teto)
  installPoliceLightbar(group, 1.94, -0.2, 1.35, false);
  installPoliceLightbar(group, 1.94, 0.9, 1.1, true);

  installFourWheels(group, 1.12, -1.5, 1.5, 0.42, 0.34, false);
  return group;
}

// ─── 3. VEÍCULOS CIVIS / TRÁFEGO (CAMINHÃO, ÔNIBUS, CARRO, TAXI, MOTO) ────

function buildTrafficCar(color = 0x58718a) {
  const group = buildSleekCar(1.78, 4.1, 0.55, 0.52, 0.25, 1.8, color, false);
  installFourWheels(group, 0.92, -1.25, 1.25, 0.34, 0.24, false);
  return group;
}

function buildTrafficTaxi(color = 0xe2b932) {
  const group = buildSleekCar(1.82, 4.2, 0.56, 0.54, 0.25, 1.85, color, false);

  // Letreiro iluminado TAXI no teto
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.26), M.yellowSign());
  sign.position.set(0, 1.54, 0.25);
  sign.castShadow = true;
  group.add(sign);

  // Faixa xadrezada lateral (detalhe estilizado)
  const checkered = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.1, 3.0), M.darkPlastic());
  checkered.position.set(0, 0.65, 0.1);
  group.add(checkered);

  installFourWheels(group, 0.94, -1.3, 1.3, 0.35, 0.25, false);
  return group;
}

function buildTrafficMotorcycle(color = 0xd43828) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });

  // Chassi central e bloco do motor
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.65), M.metalFrame());
  engine.position.set(0, 0.42, 0);
  engine.castShadow = true;
  group.add(engine);

  // Tanque de combustível esportivo
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.6), bodyMat);
  tank.position.set(0, 0.72, -0.22);
  tank.castShadow = true;
  group.add(tank);

  // Assento duplo
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.65), M.darkPlastic());
  seat.position.set(0, 0.76, 0.3);
  group.add(seat);

  // Carenagem dianteira e para-brisa
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.35), bodyMat);
  cowl.position.set(0, 0.85, -0.65);
  group.add(cowl);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.05), M.glass());
  windshield.position.set(0, 1.08, -0.68);
  windshield.rotation.x = -0.4;
  group.add(windshield);

  // Guidão cromado
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.68, 8), M.chrome());
  bar.rotateZ(Math.PI / 2);
  bar.position.set(0, 0.95, -0.55);
  group.add(bar);

  // Farol dianteiro de LED
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), M.headlight());
  head.position.set(0, 0.82, -0.84);
  group.add(head);

  // Lanterna traseira
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.05), M.taillight());
  tail.position.set(0, 0.78, 0.72);
  group.add(tail);

  // Cano de descarga esportivo
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.75, 8), M.exhaust());
  exh.rotateX(Math.PI / 2 - 0.2);
  exh.position.set(0.22, 0.38, 0.42);
  group.add(exh);

  // Rodas dianteira e traseira (com disco de freio)
  const wheelF = createWheel(0.35, 0.14, true);
  wheelF.position.set(0, 0.35, -0.88);
  group.add(wheelF);

  const wheelR = createWheel(0.35, 0.18, true);
  wheelR.position.set(0, 0.35, 0.88);
  group.add(wheelR);

  return group;
}

function buildTrafficTruck(color = 0x8e4d3e) {
  // CAMINHÃO COM CABINE FRONTAL REALISTA + CHASSI LONGO + CONTAINER TRASEIRO ALINHADO
  const group = new THREE.Group();
  const cabMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35 });
  group.__bodyMat = cabMat;

  // 1. Chassi inferior longo metálico
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.32, 6.2), M.metalFrame());
  chassis.position.set(0, 0.48, 0);
  chassis.castShadow = true;
  group.add(chassis);

  // Tanques de combustível e bateria nas laterais do chassi
  for (const side of [-1, 1]) {
    const fuelTank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 12), M.chrome());
    fuelTank.rotateZ(Math.PI / 2);
    fuelTank.position.set(side * 1.05, 0.45, 0.1);
    group.add(fuelTank);
  }

  // 2. Cabine do motorista (Frontal, imponente e robusta)
  const cabWidth = 2.2;
  const cabHeight = 1.65;
  const cabLen = 1.9;
  const cabZ = -1.9; // Frente do caminhão

  const cabBase = new THREE.Mesh(new THREE.BoxGeometry(cabWidth, cabHeight, cabLen), cabMat);
  cabBase.position.set(0, 0.6 + cabHeight / 2, cabZ);
  cabBase.castShadow = true;
  group.add(cabBase);

  // Para-brisa panorâmico da cabine
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabWidth * 0.92, 0.72, 0.08), M.glass());
  windshield.position.set(0, 1.62, cabZ - cabLen / 2 + 0.02);
  windshield.rotation.x = -0.08;
  group.add(windshield);

  // Vidros laterais da cabine
  for (const side of [-1, 1]) {
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.85), M.glass());
    sideWin.position.set(side * (cabWidth / 2 + 0.01), 1.6, cabZ);
    group.add(sideWin);

    // Retrovisores de caminhão grandes
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), M.darkPlastic());
    mirror.position.set(side * (cabWidth / 2 + 0.2), 1.55, cabZ - 0.6);
    group.add(mirror);
  }

  // Grade dianteira cromada e faróis
  const grill = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.08), M.chrome());
  grill.position.set(0, 0.95, cabZ - cabLen / 2 - 0.02);
  group.add(grill);

  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), M.headlight());
    head.position.set(side * 0.88, 0.85, cabZ - cabLen / 2 - 0.02);
    group.add(head);
  }

  // Para-choque dianteiro pesado
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(cabWidth * 1.02, 0.26, 0.2), M.darkPlastic());
  frontBumper.position.set(0, 0.48, cabZ - cabLen / 2 - 0.08);
  group.add(frontBumper);

  // Escapamento vertical cromado atrás da cabine
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 10), M.chrome());
  stack.position.set(0.9, 1.6, cabZ + cabLen / 2 + 0.15);
  group.add(stack);

  // 3. Baú de carga / Container traseiro
  const boxWidth = 2.35;
  const boxHeight = 2.1;
  const boxLen = 3.9;
  const boxZ = 1.05;

  const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(boxWidth, boxHeight, boxLen), M.containerBlue());
  cargoBox.position.set(0, 0.65 + boxHeight / 2, boxZ);
  cargoBox.castShadow = true;
  group.add(cargoBox);

  // Friso / Moldura do container
  const boxFrame = new THREE.Mesh(new THREE.BoxGeometry(boxWidth * 1.02, boxHeight * 1.02, 0.12), M.metalFrame());
  boxFrame.position.set(0, 0.65 + boxHeight / 2, boxZ + boxLen / 2);
  group.add(boxFrame);

  // Lanternas traseiras do caminhão
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), M.taillight());
    tail.position.set(side * 0.85, 0.55, boxZ + boxLen / 2 + 0.08);
    group.add(tail);
  }

  // 4. Rodas (6 rodas: 2 dianteiras + 4 traseiras duplas)
  const wheelR = 0.44;
  const wheelW = 0.28;
  // Dianteiras
  for (const side of [-1, 1]) {
    const w = createWheel(wheelR, wheelW, false);
    w.position.set(side * 1.12, wheelR, cabZ);
    group.add(w);
  }
  // Traseiras eixo 1
  for (const side of [-1, 1]) {
    const w = createWheel(wheelR, wheelW, false);
    w.position.set(side * 1.12, wheelR, 0.7);
    group.add(w);
  }
  // Traseiras eixo 2
  for (const side of [-1, 1]) {
    const w = createWheel(wheelR, wheelW, false);
    w.position.set(side * 1.12, wheelR, 2.0);
    group.add(w);
  }

  return group;
}

function buildTrafficBus(color = 0x2e7d5b) {
  // ÔNIBUS URBANO MODERNO COM ORIENTAÇÃO HORIZONTAL PERFEITA E VIDROS
  const group = new THREE.Group();
  const busMat = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.3 });
  group.__bodyMat = busMat;

  const busWidth = 2.4;
  const busHeight = 2.3;
  const busLen = 8.2;
  const halfLen = busLen / 2;
  const bodyY = 0.45;

  // 1. Carroceria principal horizontal
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(busWidth, busHeight, busLen), busMat);
  mainBody.position.set(0, bodyY + busHeight / 2, 0);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  group.add(mainBody);

  // 2. Para-brisa frontal panorâmico curvo
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(busWidth * 0.94, 1.15, 0.1), M.glass());
  windshield.position.set(0, bodyY + busHeight * 0.58, -halfLen - 0.01);
  windshield.rotation.x = -0.06;
  group.add(windshield);

  // Letreiro digital de itinerário acima do para-brisa
  const destSign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.08), M.yellowSign());
  destSign.position.set(0, bodyY + busHeight * 0.88, -halfLen - 0.02);
  group.add(destSign);

  // Vidro traseiro
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(busWidth * 0.88, 0.85, 0.08), M.glass());
  rearGlass.position.set(0, bodyY + busHeight * 0.6, halfLen + 0.01);
  group.add(rearGlass);

  // 3. Janelas laterais contínuas e elegantes
  const windowLen = 0.88;
  const windowGap = 0.16;
  const winCount = 6;
  const winZStart = -halfLen + 1.6;

  for (let i = 0; i < winCount; i++) {
    const wz = winZStart + i * (windowLen + windowGap);
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.88, windowLen), M.busGlass());
      win.position.set(side * (busWidth / 2 + 0.01), bodyY + busHeight * 0.62, wz);
      group.add(win);
    }
  }

  // 4. Ar-condicionado / exaustores no teto
  const acUnit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 2.2), M.darkPlastic());
  acUnit.position.set(0, bodyY + busHeight + 0.14, -0.4);
  group.add(acUnit);

  // 5. Faróis dianteiros e lanternas traseiras
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.08), M.headlight());
    head.position.set(side * 0.9, bodyY + 0.45, -halfLen - 0.02);
    group.add(head);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.08), M.taillight());
    tail.position.set(side * 0.92, bodyY + 0.55, halfLen + 0.02);
    group.add(tail);
  }

  // Para-choques frontal e traseiro
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(busWidth * 1.02, 0.25, 0.18), M.darkPlastic());
  bumperF.position.set(0, bodyY + 0.15, -halfLen - 0.05);
  group.add(bumperF);

  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(busWidth * 1.02, 0.25, 0.18), M.darkPlastic());
  bumperR.position.set(0, bodyY + 0.15, halfLen + 0.05);
  group.add(bumperR);

  // 6. Rodas (4 rodas grandes com caixa de roda protegida)
  const wheelR = 0.46;
  const wheelW = 0.3;
  // Dianteiras
  for (const side of [-1, 1]) {
    const w = createWheel(wheelR, wheelW, false);
    w.position.set(side * 1.18, wheelR, -halfLen + 1.8);
    group.add(w);
  }
  // Traseiras
  for (const side of [-1, 1]) {
    const w = createWheel(wheelR, wheelW, false);
    w.position.set(side * 1.18, wheelR, halfLen - 2.0);
    group.add(w);
  }

  return group;
}

// ─── 4. POLICIAL (PERSONAGEM 3D LOW-POLY) ──────────────────────────────────

function buildOfficer() {
  const group = new THREE.Group();

  // Botas policiais pretas
  const bootGeo = new THREE.BoxGeometry(0.16, 0.16, 0.24);
  const bootMat = M.darkPlastic();
  for (const side of [-0.11, 0.11]) {
    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(side, 0.08, 0.02);
    group.add(boot);
  }

  // Pernas com calça tática
  const legGeo = new THREE.CylinderGeometry(0.065, 0.07, 0.48, 8);
  for (const side of [-0.11, 0.11]) {
    const leg = new THREE.Mesh(legGeo, M.uniform());
    leg.position.set(side, 0.38, 0);
    group.add(leg);
  }

  // Cinto tático com coldre e porta-algemas
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.24), M.darkPlastic());
  belt.position.set(0, 0.64, 0);
  group.add(belt);

  const holster = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), M.darkPlastic());
  holster.position.set(0.2, 0.6, 0);
  group.add(holster);

  // Torso com colete tático policial
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.42, 0.22), M.uniform());
  torso.position.set(0, 0.86, 0);
  torso.castShadow = true;
  group.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.26), M.vest());
  vest.position.set(0, 0.88, 0);
  vest.castShadow = true;
  group.add(vest);

  // Emblema / insígnia dourada no colete
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), M.rim());
  badge.position.set(-0.1, 0.94, 0.14);
  group.add(badge);

  // Braços
  const armGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.38, 8);
  for (const side of [-0.23, 0.23]) {
    const arm = new THREE.Mesh(armGeo, M.uniform());
    arm.position.set(side, 0.82, 0);
    arm.rotation.z = side > 0 ? -0.15 : 0.15;
    group.add(arm);

    // Mão
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), M.skin());
    hand.position.set(side * 1.05, 0.6, 0);
    group.add(hand);
  }

  // Pescoço e Cabeça
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 6), M.skin());
  neck.position.set(0, 1.1, 0);
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), M.skin());
  head.position.set(0, 1.22, 0);
  head.castShadow = true;
  group.add(head);

  // Quepe / Capacete policial com aba
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.08, 10), M.helmet());
  cap.position.set(0, 1.3, 0);
  group.add(cap);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.1), M.darkPlastic());
  visor.position.set(0, 1.27, -0.11);
  visor.rotation.x = -0.15;
  group.add(visor);

  return group;
}

// ─── API PÚBLICA DO FACTORY ────────────────────────────────────────────────

export const VehicleModelFactory = {
  buildPlayerCar(vehicleId, color) {
    switch (vehicleId) {
      case 'MUSCLE':  return buildPlayerMuscle(color);
      case 'SPORT':   return buildPlayerSport(color);
      case 'SUV':     return buildPlayerSUV(color);
      case 'COMPACT':
      default:        return buildPlayerCompact(color);
    }
  },

  buildPoliceCar(variant) {
    switch (variant) {
      case 'INTERCEPTOR': return buildPoliceInterceptor();
      case 'SPECIAL':     return buildPoliceSpecial();
      case 'STANDARD':
      default:            return buildPoliceStandard();
    }
  },

  buildTrafficVehicle(type, color) {
    switch (type) {
      case 'TAXI':       return buildTrafficTaxi(color);
      case 'MOTORCYCLE': return buildTrafficMotorcycle(color);
      case 'TRUCK':      return buildTrafficTruck(color);
      case 'BUS':        return buildTrafficBus(color);
      case 'CAR':
      default:           return buildTrafficCar(color);
    }
  },

  buildPoliceOfficer() {
    return buildOfficer();
  },
};
