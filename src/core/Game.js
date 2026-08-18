import * as THREE from 'three';
import { GameLoop } from './GameLoop.js';
import { InputManager } from './InputManager.js';
import { GameState, GameStateManager } from './GameState.js';
import { PlayerVehicle } from '../entities/PlayerVehicle.js';
import { CityMap } from '../world/CityMap.js';
import { FollowCamera } from '../camera/FollowCamera.js';
import { WantedSystem } from '../systems/WantedSystem.js';
import { PoliceManager } from '../systems/PoliceManager.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { ComboSystem } from '../systems/ComboSystem.js';
import { CaptureSystem } from '../systems/CaptureSystem.js';
import { DamageSystem } from '../systems/DamageSystem.js';
import { TrafficManager } from '../systems/TrafficManager.js';
import { VehicleCollisionSystem } from '../systems/VehicleCollisionSystem.js';
import { DynamicEventSystem } from '../systems/DynamicEventSystem.js';
import { PowerUpSystem } from '../systems/PowerUpSystem.js';
import { ProgressionSystem } from '../systems/ProgressionSystem.js';
import { GarageSystem } from '../systems/GarageSystem.js';
import { HUDSystem } from '../ui/HUDSystem.js';
import { MinimapSystem } from '../ui/MinimapSystem.js';
import { BackendClient } from '../network/BackendClient.js';
import { PerformanceSystem } from '../systems/PerformanceSystem.js';
import { VisualPolishSystem } from '../systems/VisualPolishSystem.js';
import { ScreenFeedbackSystem } from '../ui/ScreenFeedbackSystem.js';
import { VehicleRealismSystem } from '../systems/VehicleRealismSystem.js';

export class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ca8ba);
    this.scene.fog = new THREE.Fog(0x8ca8ba, 220, 560);

    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 760);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    document.body.prepend(this.renderer.domElement);

    this.input = new InputManager();
    this.states = new GameStateManager(GameState.MENU);
    this.city = new CityMap(this.scene);
    this.player = new PlayerVehicle();
    this.scene.add(this.player.object3D);
    this.progression = new ProgressionSystem();
    this.backend = new BackendClient();
    this.garage = new GarageSystem(this.player, this.progression);
    this.garage.applySelectedVehicle();
    this.garageOpen = false;
    this.rankingOpen = false;
    this.rankingPeriod = 'global';
    this.polishClock = 0;

    this.traffic = new TrafficManager(this.scene, this.city, this.player);
    this.wanted = new WantedSystem();
    this.policeManager = new PoliceManager(this.scene, this.player, this.city, this.wanted, this.traffic);
    this.vehicleRealism = new VehicleRealismSystem(this.player, this.traffic, this.policeManager);
    this.score = new ScoreSystem();
    this.combo = new ComboSystem();
    this.capture = new CaptureSystem();
    this.damage = new DamageSystem(this.player);
    this.vehicleCollisions = new VehicleCollisionSystem();
    this.dynamicEvents = new DynamicEventSystem(this.scene, this.city, this.player, this.traffic, this.policeManager);
    this.powerUps = new PowerUpSystem(this.scene, this.city, this.player, this.damage, this.policeManager, this.score);
    this.followCamera = new FollowCamera(this.camera);
    this.hud = new HUDSystem(document);
    this.minimap = new MinimapSystem(document.querySelector('#minimapCanvas'), this.city, this.player, this.policeManager, this.powerUps);
    this.performance = new PerformanceSystem(this.renderer, this.camera, this.player, this.traffic, this.policeManager);
    this.visualPolish = new VisualPolishSystem(this.scene, this.player, this.input, this.followCamera, this.damage);
    this.screenFeedback = new ScreenFeedbackSystem(document);

    this.player.reset();
    this.wanted.reset();
    this.traffic.reset();
    this.policeManager.reset();
    this.score.reset();
    this.combo.reset();
    this.capture.reset();
    this.damage.reset();
    this.vehicleCollisions.reset();
    this.dynamicEvents.reset();
    this.powerUps.reset();
    this.performance.reset();
    this.visualPolish.reset();
    this.vehicleRealism.reset();
    this.screenFeedback.reset({ player: this.player, wanted: this.wanted, powerUps: this.powerUps, score: this.score });
    this.followCamera.snapTo(this.player);

    this._setupLighting();
    this._setupUI();
    this._setupEvents();
    this._updateHud();
    this._initializeBackend();

    this.wanted.subscribe(() => this._updateHud());
    this.policeManager.subscribe((event) => this.score.handlePoliceEvent(event));

    this.loop = new GameLoop((dt) => this.update(dt), () => this.render());
  }

  _setupLighting() {
    const hemi = new THREE.HemisphereLight(0xdcecff, 0x46513f, 1.38);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3df, 2.35);
    sun.position.set(90, 115, 55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -145;
    sun.shadow.camera.right = 145;
    sun.shadow.camera.top = 145;
    sun.shadow.camera.bottom = -145;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 360;
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    sun.target = this.sunTarget;
    this.scene.add(sun);
    this.hemiLight = hemi;
    this.sunLight = sun;
    this.chaseRedLight = new THREE.PointLight(0xff263c, 0, 42, 2);
    this.chaseBlueLight = new THREE.PointLight(0x2a76ff, 0, 42, 2);
    this.scene.add(this.chaseRedLight, this.chaseBlueLight);
  }

  _setupUI() {
    this.ui = {
      menu: document.querySelector('#menu'),
      pause: document.querySelector('#pause'),
      gameOver: document.querySelector('#gameOver'),
      startButton: document.querySelector('#startButton'),
      openGarageButton: document.querySelector('#openGarageButton'),
      openRankingButton: document.querySelector('#openRankingButton'),
      gameOverGarageButton: document.querySelector('#gameOverGarageButton'),
      gameOverRankingButton: document.querySelector('#gameOverRankingButton'),
      garage: document.querySelector('#garage'),
      garageBackButton: document.querySelector('#garageBackButton'),
      garageGrid: document.querySelector('#garageGrid'),
      garageProfile: document.querySelector('#garageProfile'),
      garageMessage: document.querySelector('#garageMessage'),
      ranking: document.querySelector('#ranking'),
      rankingBackButton: document.querySelector('#rankingBackButton'),
      rankingBody: document.querySelector('#rankingBody'),
      rankingStatus: document.querySelector('#rankingStatus'),
      rankingMe: document.querySelector('#rankingMe'),
      debug: document.querySelector('#debug'),
      gameHud: document.querySelector('#gameHud'),
      minimapCanvas: document.querySelector('#minimapCanvas'),
      wantedHud: document.querySelector('#wantedHud'),
      wantedStars: document.querySelector('#wantedStars'),
      wantedLabel: document.querySelector('#wantedLabel'),
      wantedTime: document.querySelector('#wantedTime'),
      policeCount: document.querySelector('#policeCount'),
      scoreValue: document.querySelector('#scoreValue'),
      multiplierValue: document.querySelector('#multiplierValue'),
      comboValue: document.querySelector('#comboValue'),
      comboBarFill: document.querySelector('#comboBarFill'),
      captureHud: document.querySelector('#captureHud'),
      captureBarFill: document.querySelector('#captureBarFill'),
      captureValue: document.querySelector('#captureValue'),
      captureStatus: document.querySelector('#captureStatus'),
      gameOverScore: document.querySelector('#gameOverScore'),
      gameOverTime: document.querySelector('#gameOverTime'),
      gameOverXp: document.querySelector('#gameOverXp'),
      gameOverCash: document.querySelector('#gameOverCash'),
      gameOverRecord: document.querySelector('#gameOverRecord'),
      gameOverWanted: document.querySelector('#gameOverWanted'),
      gameOverEvaded: document.querySelector('#gameOverEvaded'),
      gameOverBestTime: document.querySelector('#gameOverBestTime'),
      gameOverBestScore: document.querySelector('#gameOverBestScore'),
      gameOverMenuButton: document.querySelector('#gameOverMenuButton'),
      restartButton: document.querySelector('#restartButton'),
      vehicleHud: document.querySelector('#vehicleHud'),
      integrityValue: document.querySelector('#integrityValue'),
      integrityBarFill: document.querySelector('#integrityBarFill'),
      damageStatus: document.querySelector('#damageStatus'),
    };

    this.ui.startButton.addEventListener('click', () => this.startGame());
    this.ui.restartButton?.addEventListener('click', () => this.startGame());
    this.ui.gameOverMenuButton?.addEventListener('click', () => this.goToMenu());
    this.ui.openGarageButton?.addEventListener('click', () => this.openGarage());
    this.ui.openRankingButton?.addEventListener('click', () => this.openRanking());
    this.ui.gameOverGarageButton?.addEventListener('click', () => this.openGarage());
    this.ui.gameOverRankingButton?.addEventListener('click', () => this.openRanking());
    this.ui.garageBackButton?.addEventListener('click', () => this.closeGarage());
    this.ui.rankingBackButton?.addEventListener('click', () => this.closeRanking());
    for (const button of document.querySelectorAll('[data-ranking-period]')) {
      button.addEventListener('click', () => {
        this.rankingPeriod = button.dataset.rankingPeriod;
        this._renderRanking(this.rankingPeriod);
      });
    }
    this.states.subscribe((state) => this._syncScreens(state));
    this._syncScreens(this.states.state);
    this._renderGarage();
  }

  _syncScreens(state = this.states.state) {
    const menuVisible = state === GameState.MENU && !this.garageOpen && !this.rankingOpen;
    const gameOverVisible = state === GameState.GAME_OVER && !this.garageOpen && !this.rankingOpen;
    this.ui.menu.classList.toggle('hidden', !menuVisible);
    this.ui.pause.classList.toggle('hidden', state !== GameState.PAUSED || this.garageOpen || this.rankingOpen);
    this.ui.gameOver.classList.toggle('hidden', !gameOverVisible);
    this.ui.garage?.classList.toggle('hidden', !this.garageOpen);
    this.ui.ranking?.classList.toggle('hidden', !this.rankingOpen);
    const hideGameplayHud = state === GameState.MENU || state === GameState.GAME_OVER || this.garageOpen || this.rankingOpen;
    this.hud.setVisible(!hideGameplayHud);
    this.minimap.setVisible(!hideGameplayHud);
  }

  async _initializeBackend() {
    await this.backend.initialize(this.progression.getSnapshot());
  }

  _syncBackendProfile() {
    this.backend.syncProfile(this.progression.getSnapshot());
  }

  goToMenu() {
    if (this.states.is(GameState.PLAYING)) return;
    if (this.chaseRedLight) this.chaseRedLight.intensity = 0;
    if (this.chaseBlueLight) this.chaseBlueLight.intensity = 0;
    this.garageOpen = false;
    this.rankingOpen = false;
    this.states.set(GameState.MENU);
  }

  openGarage() {
    if (this.states.is(GameState.PLAYING) || this.states.is(GameState.PAUSED)) return;
    this.rankingOpen = false;
    this.garageOpen = true;
    this.ui.garageMessage.textContent = '';
    this._renderGarage();
    this._syncScreens();
  }

  closeGarage() {
    this.garageOpen = false;
    this._syncScreens();
  }

  async openRanking() {
    if (this.states.is(GameState.PLAYING) || this.states.is(GameState.PAUSED)) return;
    this.garageOpen = false;
    this.rankingOpen = true;
    this._syncScreens();
    await this._renderRanking(this.rankingPeriod);
  }

  closeRanking() {
    this.rankingOpen = false;
    this._syncScreens();
  }

  async _renderRanking(period = 'global') {
    if (!this.ui?.rankingBody) return;
    this.rankingPeriod = period;
    for (const button of document.querySelectorAll('[data-ranking-period]')) button.classList.toggle('active', button.dataset.rankingPeriod === period);
    this.ui.rankingStatus.textContent = 'Carregando ranking…';
    const ranking = await this.backend.getRanking(period, 50);
    if (!ranking) {
      this.ui.rankingBody.innerHTML = '';
      this.ui.rankingStatus.textContent = 'Ranking indisponível. Inicie o jogo pelo backend com npm start.';
      this.ui.rankingMe.textContent = 'Sem conexão com o ranking.';
      return;
    }
    this.ui.rankingStatus.textContent = `${ranking.totalPlayers} jogador${ranking.totalPlayers === 1 ? '' : 'es'} classificado${ranking.totalPlayers === 1 ? '' : 's'}.`;
    this.ui.rankingBody.innerHTML = ranking.entries.length ? ranking.entries.map((entry) => {
      const me = entry.playerId === this.backend.playerId;
      const wanted = entry.maxWantedLevel >= 7 ? 'MÁXIMO' : `NV ${entry.maxWantedLevel}`;
      return `<tr class="${me ? 'me' : ''}"><td class="rank">#${entry.rank}</td><td>${entry.playerName}${me ? ' · VOCÊ' : ''}</td><td class="score">${entry.score.toLocaleString('pt-BR')}</td><td>${this._formatTime(entry.timeSeconds)}</td><td>${wanted}</td><td>${entry.vehicleId}</td></tr>`;
    }).join('') : '<tr><td colspan="6">Nenhuma partida registrada neste período.</td></tr>';
    this.ui.rankingMe.textContent = ranking.me ? `Sua posição: #${ranking.me.rank} · ${ranking.me.score.toLocaleString('pt-BR')} pontos · ${this._formatTime(ranking.me.timeSeconds)}` : 'Você ainda não possui uma partida válida neste período.';
  }

  _renderGarage() {
    if (!this.ui?.garageGrid || !this.ui?.garageProfile) return;
    const xp = this.progression.getXpIntoLevel();
    const selected = this.garage.getSelectedVehicle();
    const xpLabel = xp.maxLevel ? 'NÍVEL MÁXIMO' : `${xp.current}/${xp.required} XP`;
    this.ui.garageProfile.innerHTML = `<b>Nível ${this.progression.getLevel()}</b><span>${xpLabel}</span><span>C$ ${this.progression.getCash().toLocaleString('pt-BR')}</span><span>Selecionado: ${selected.name}</span>`;

    this.ui.garageGrid.innerHTML = this.garage.getVehicles().map((vehicle) => {
      const state = this.garage.getState(vehicle.id);
      let label = 'SELECIONAR';
      let disabled = false;
      if (state.selected) { label = 'SELECIONADO'; disabled = true; }
      else if (!state.unlocked) {
        if (!state.levelMet) { label = `NÍVEL ${vehicle.requiredLevel} NECESSÁRIO`; disabled = true; }
        else label = `DESBLOQUEAR · C$ ${vehicle.price.toLocaleString('pt-BR')}`;
      }
      const stats = Object.entries(vehicle.stats).map(([key, value]) => `<div class="garageStat"><span>${({ speed:'Velocidade', acceleration:'Aceleração', control:'Controle', resistance:'Resistência' })[key]}</span><div><i style="width:${value}%"></i></div></div>`).join('');
      const lockText = state.unlocked ? 'DESBLOQUEADO' : `Nível ${vehicle.requiredLevel} · C$ ${vehicle.price.toLocaleString('pt-BR')}`;
      return `<article class="garageCard ${state.selected ? 'selected' : ''}"><header><strong>${vehicle.name}</strong><small>${lockText}</small></header><p>${vehicle.description}</p>${stats}<button data-vehicle-id="${vehicle.id}" ${disabled ? 'disabled' : ''}>${label}</button></article>`;
    }).join('');

    for (const button of this.ui.garageGrid.querySelectorAll('[data-vehicle-id]')) {
      button.addEventListener('click', () => this._handleGarageVehicle(button.dataset.vehicleId));
    }
  }

  _handleGarageVehicle(id) {
    const state = this.garage.getState(id);
    if (state.unlocked) {
      this.garage.select(id);
      this.ui.garageMessage.textContent = `${state.vehicle.name} selecionado.`;
    } else {
      const result = this.garage.purchaseAndSelect(id);
      if (result.ok) this.ui.garageMessage.textContent = `${state.vehicle.name} desbloqueado e selecionado.`;
      else if (result.reason === 'INSUFFICIENT_CASH') this.ui.garageMessage.textContent = 'Dinheiro insuficiente para desbloquear este veículo.';
      else this.ui.garageMessage.textContent = `Alcance o nível ${state.vehicle.requiredLevel} para desbloquear este veículo.`;
    }
    this.garage.applySelectedVehicle();
    this.player.reset();
    this.damage.reset();
    this.followCamera.snapTo(this.player);
    this._renderGarage();
    this._syncBackendProfile();
  }

  _formatTime(seconds = 0) {
    const total = Math.max(0, Math.floor(seconds));
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
  }

  _setupEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  startGame() {
    this.garageOpen = false;
    this.rankingOpen = false;
    this.garage.applySelectedVehicle();
    this.progression.beginRun();
    this.polishClock = 0;
    this.player.reset();
    this.wanted.reset();
    this.traffic.reset();
    this.policeManager.reset();
    this.score.reset();
    this.combo.reset();
    this.capture.reset();
    this.damage.reset();
    this.vehicleCollisions.reset();
    this.dynamicEvents.reset();
    this.powerUps.reset();
    this.performance.reset();
    this.visualPolish.reset();
    this.vehicleRealism.reset();
    this.screenFeedback.reset({ player: this.player, wanted: this.wanted, powerUps: this.powerUps, score: this.score });
    this.followCamera.snapTo(this.player);
    this._updateHud();
    this.states.set(GameState.PLAYING);
  }

  update(deltaTime) {
    if (this.input.consumePress('Escape')) {
      if (this.states.is(GameState.PLAYING)) this.states.set(GameState.PAUSED);
      else if (this.states.is(GameState.PAUSED)) this.states.set(GameState.PLAYING);
    }

    if (this.states.is(GameState.PLAYING)) {
      this.player.update(deltaTime, this.input, this.city.collision);
      this.damage.update();
      this.wanted.update(deltaTime);
      this.dynamicEvents.update(deltaTime);
      this.powerUps.update(deltaTime);
      this.traffic.update(deltaTime, this.policeManager);
      this.policeManager.update(deltaTime);
      this.vehicleRealism.update(deltaTime);
      this.vehicleCollisions.update(deltaTime, this.player, this.policeManager, this.traffic);
      this.damage.update();
      this.combo.update(deltaTime, this.wanted, this.player, this.policeManager);
      this.score.update(deltaTime, this.wanted, this.player, this.policeManager.roadblocks, this.combo);
      this.capture.update(deltaTime, this.player, this.policeManager);
      this.performance.update(deltaTime);
      this.followCamera.setTension(this.capture.getProgressPercent() / 100);
      this.visualPolish.update(deltaTime);
      this.screenFeedback.update(deltaTime, {
        player: this.player, wanted: this.wanted, damage: this.damage, powerUps: this.powerUps,
        score: this.score, combo: this.combo, capture: this.capture, policeManager: this.policeManager,
      });
      this._updateLightingPolish(deltaTime);

      if (this.capture.isCaptured()) {
        this._finishCapture();
      } else {
        this.followCamera.update(deltaTime, this.player);
      }
      this._updateHud();
    }

    const nearest = this.policeManager.getNearestUnit();
    const variants = this.policeManager.getVariantCounts();
    const roles = this.policeManager.getRoleCounts();
    const profile = this.wanted.getProfile();
    const lastBonus = this.score.lastBonus;

    this.ui.debug.textContent = [
      `FASES: 1–18 + 20–22 + 24–25 (19 e 23 PULADAS)`,
      `STATE: ${this.states.state}`,
      `LADRÃO: ${this.player.getSpeedKmh().toFixed(0)} km/h · ${this.garage.getSelectedVehicle().name}`,
      `PROGRESSÃO: NV ${this.progression.getLevel()} · XP ${this.progression.getTotalXp()} · C$ ${this.progression.getCash()} · PARTIDAS ${this.progression.getRuns()}`,
      `BACKEND: ${this.backend.status}${this.backend.playerId ? ` · ${this.backend.playerId.slice(0,8)}` : ''}`,
      `PERF: pixel ratio ${this.performance.getStats().pixelRatio.toFixed(2)} · tráfego visível ${this.performance.getStats().visibleTraffic}/${this.traffic.vehicles.length} · polícia visível ${this.performance.getStats().visiblePolice}/${this.policeManager.getUnitCount()} · grid ${this.performance.getStats().trafficCells} células · pool polícia ${this.performance.getStats().pooledPolice}`,
      `POLIMENTO: partículas ${this.visualPolish.getStats().particles} · marcas ${this.visualPolish.getStats().skidMarks} · FOV ${this.camera.fov.toFixed(1)}°`,
      `RECORDES: ${this._formatTime(this.progression.getBestTimeSeconds())} · ${this.progression.getBestScore().toLocaleString('pt-BR')} pts`,
      `PROCURADO: ${profile.label} (${this.wanted.getFormattedTime()})`,
      `PONTOS: ${this.score.getFormattedScore()} (procurado x${this.score.getMultiplier(profile.level).toFixed(1)} · combo x${this.combo.getMultiplier().toFixed(1)})`,
      `BÔNUS: ${lastBonus ? `+${lastBonus.points} ${lastBonus.label}` : '-'}`,
      `COMBO: x${this.combo.getMultiplier().toFixed(1)} · risco ${this.combo.getRiskPercent()}%`,
      `CAPTURA: ${this.capture.getProgressPercent()}% · ${this.capture.status}`,
      `INTEGRIDADE: ${this.damage.getIntegrityPercent()}%${this.damage.isCritical() ? ' · CRÍTICA' : ''}`,
      `ÚLTIMO DANO: ${this.damage.lastDamage ? `-${this.damage.lastDamage.damage}% ${this.damage.lastDamage.label}` : '-'}`,
      `TRÂNSITO: ${this.traffic.vehicles.length} veículos${this.traffic.getHeavyTrafficZoneCount() ? ' · INTENSO' : ''}`,
      `EVENTOS: ${this.dynamicEvents.getActiveLabels().join(' · ') || '-'}`,
      `POWER-UPS: ${this.powerUps.getActiveCount()} ativos · último ${this.powerUps.lastPickup?.label ?? '-'}`,
      `NITRO: ${this.player.isNitroActive() ? this.player.getNitroTimeRemaining().toFixed(1) + 's' : 'INATIVO'} · JAMMER: ${this.policeManager.isJammed() ? this.policeManager.getJammerTimeRemaining().toFixed(1) + 's' : 'INATIVO'}`, 
      `POLICIAIS: ${this.policeManager.getUnitCount()} / ${profile.policeCount}`,
      `TIPOS: P${variants.STANDARD} I${variants.INTERCEPTOR} E${variants.SPECIAL}`,
      `PAPÉIS: P${roles.PURSUER} I${roles.INTERCEPTOR} F${roles.FLANKER} B${roles.BLOCKER}`,
      `BLOQUEIOS: ${this.policeManager.roadblocks.getCount()}`,
      `HELICÓPTERO: ${profile.helicopter ? 'ATIVO' : 'NÃO'}`,
      `IA PRÓXIMA: ${nearest ? `${nearest.role}/${nearest.ai.state}` : '-'}`,
      `DISTÂNCIA: ${nearest ? nearest.distance.toFixed(1) + ' m' : '-'}`,
      `POS: ${this.player.object3D.position.x.toFixed(1)}, ${this.player.object3D.position.z.toFixed(1)}`,
    ].join('\n');

    this.input.endFrame();
  }


  _updateLightingPolish(deltaTime) {
    this.polishClock += Math.max(0, deltaTime);
    if (this.sunLight && this.sunTarget) {
      const p = this.player.object3D.position;
      this.sunTarget.position.set(p.x, 0, p.z);
      this.sunLight.position.set(p.x + 90, 115, p.z + 55);
      this.sunTarget.updateMatrixWorld();
    }
    const nearest = this.policeManager.getNearestUnit();
    if (!nearest || nearest.distance > 68) {
      this.chaseRedLight.intensity = THREE.MathUtils.lerp(this.chaseRedLight.intensity, 0, 0.16);
      this.chaseBlueLight.intensity = THREE.MathUtils.lerp(this.chaseBlueLight.intensity, 0, 0.16);
      return;
    }
    const pressure = THREE.MathUtils.clamp((68 - nearest.distance) / 58, 0, 1);
    const pulse = Math.sin(this.polishClock * 12.5);
    const position = nearest.vehicle.object3D.position;
    this.chaseRedLight.position.set(position.x - 0.55, 2.0, position.z);
    this.chaseBlueLight.position.set(position.x + 0.55, 2.0, position.z);
    this.chaseRedLight.intensity = pressure * (1.2 + Math.max(0, pulse) * 3.8);
    this.chaseBlueLight.intensity = pressure * (1.2 + Math.max(0, -pulse) * 3.8);
    const exposureTarget = 1.06 + (this.player.isNitroActive() ? 0.05 : 0);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(this.renderer.toneMappingExposure, exposureTarget, 0.025);
  }

  _updateHud() {
    if (!this.ui) return;
    this.hud.update({
      wanted: this.wanted,
      score: this.score,
      combo: this.combo,
      capture: this.capture,
      damage: this.damage,
      player: this.player,
      policeManager: this.policeManager,
    });
    this.minimap.update();
  }

  _finishCapture() {
    if (!this.states.is(GameState.PLAYING)) return;
    if (this.chaseRedLight) this.chaseRedLight.intensity = 0;
    if (this.chaseBlueLight) this.chaseBlueLight.intensity = 0;
    const rewards = this.progression.finishRun({
      timeSeconds: this.wanted.elapsedTime,
      score: this.score.getScore(),
      maxWantedLevel: this.wanted.getLevel(),
    });
    const runStats = this.score.getStats();
    const maxWantedLevel = this.wanted.getLevel();
    if (this.ui.gameOverScore) this.ui.gameOverScore.textContent = this.score.getFormattedScore();
    if (this.ui.gameOverTime) this.ui.gameOverTime.textContent = this.wanted.getFormattedTime();
    if (this.ui.gameOverWanted) this.ui.gameOverWanted.textContent = maxWantedLevel >= 7 ? 'MÁXIMO' : `NÍVEL ${maxWantedLevel}`;
    if (this.ui.gameOverEvaded) this.ui.gameOverEvaded.textContent = runStats.unitsEvaded.toLocaleString('pt-BR');
    if (this.ui.gameOverBestTime) this.ui.gameOverBestTime.textContent = this._formatTime(this.progression.getBestTimeSeconds());
    if (this.ui.gameOverBestScore) this.ui.gameOverBestScore.textContent = this.progression.getBestScore().toLocaleString('pt-BR');
    if (this.ui.gameOverXp) this.ui.gameOverXp.textContent = `+${rewards.xpGained} XP`;
    if (this.ui.gameOverCash) this.ui.gameOverCash.textContent = `+C$ ${rewards.cashGained}`;
    if (this.ui.gameOverRecord) {
      const records = [rewards.newTimeRecord ? 'NOVO RECORDE DE TEMPO' : '', rewards.newScoreRecord ? 'NOVO RECORDE DE PONTOS' : '', rewards.leveledUp ? `NÍVEL ${rewards.currentLevel}` : ''].filter(Boolean);
      this.ui.gameOverRecord.textContent = records.join(' · ') || `Nível ${this.progression.getLevel()} · C$ ${this.progression.getCash()}`;
    }

    this.backend.submitRun({
      timeSeconds: this.wanted.elapsedTime,
      score: this.score.getScore(),
      maxWantedLevel,
      policeEvaded: runStats.unitsEvaded,
      vehicleId: this.garage.getSelectedVehicle().id,
      xpGained: rewards.xpGained,
      cashGained: rewards.cashGained,
    }, this.progression.getSnapshot());

    this._renderGarage();
    this.states.set(GameState.GAME_OVER);
  }

  render() { this.renderer.render(this.scene, this.camera); }
  run() { this.loop.start(); }
}
