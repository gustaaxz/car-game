import { GAME_CONFIG } from '../config/gameConfig.js';

export class ScoreSystem {
  constructor() {
    this.score = 0;
    this.lastBonus = null;
    this.bonusHistory = [];
    this.extremeBonusAwarded = false;
    this.roadblockTrackers = new Map();
    this.stats = { unitsEvaded: 0, allPoliceEvaded: 0, roadblocksAvoided: 0 };
  }

  reset() {
    this.score = 0;
    this.lastBonus = null;
    this.bonusHistory = [];
    this.extremeBonusAwarded = false;
    this.roadblockTrackers.clear();
    this.stats = { unitsEvaded: 0, allPoliceEvaded: 0, roadblocksAvoided: 0 };
  }

  update(deltaTime, wantedSystem, player, roadblocks, comboSystem = null) {
    if (deltaTime <= 0) return;
    const level = wantedSystem.getLevel();
    const comboMultiplier = comboSystem?.getMultiplier?.() ?? 1;
    this.score += GAME_CONFIG.score.basePointsPerSecond * this.getMultiplier(level) * comboMultiplier * deltaTime;

    if (level >= 6 && !this.extremeBonusAwarded) {
      this.extremeBonusAwarded = true;
      this.awardBonus('EXTREME_SURVIVED', GAME_CONFIG.score.bonuses.extremeSurvived, 'Perseguição extrema sobrevivida');
    }

    this._trackRoadblocks(player, roadblocks);
  }

  handlePoliceEvent(event) {
    if (!event) return;
    if (event.type === 'UNIT_EVADED') {
      this.stats.unitsEvaded += 1;
      this.awardBonus('UNIT_EVADED', GAME_CONFIG.score.bonuses.unitEvaded, 'Viatura despistada');
    } else if (event.type === 'ALL_UNITS_EVADED') {
      this.stats.allPoliceEvaded += 1;
      this.awardBonus('ALL_UNITS_EVADED', GAME_CONFIG.score.bonuses.allPoliceEvaded, 'Polícia despistada');
    }
  }

  awardBonus(type, points, label) {
    this.score += points;
    this.lastBonus = { type, points, label };
    this.bonusHistory.push(this.lastBonus);
    if (this.bonusHistory.length > 12) this.bonusHistory.shift();
  }

  _trackRoadblocks(player, roadblockSystem) {
    const currentIds = new Set();
    const hitRoadblock = player.lastCollisionLabel === 'police-roadblock';

    for (const roadblock of roadblockSystem.getRoadblocks()) {
      currentIds.add(roadblock.id);
      let tracker = this.roadblockTrackers.get(roadblock.id);
      if (!tracker) {
        tracker = { approached: false, hit: false, awarded: false };
        this.roadblockTrackers.set(roadblock.id, tracker);
      }

      const distance = player.object3D.position.distanceTo(roadblock.group.position);
      if (distance < 21) tracker.approached = true;
      if (tracker.approached && hitRoadblock && distance < 15) tracker.hit = true;
      if (tracker.approached && distance > 34 && !tracker.awarded) {
        tracker.awarded = true;
        if (!tracker.hit) {
          this.stats.roadblocksAvoided += 1;
          this.awardBonus('ROADBLOCK_AVOIDED', GAME_CONFIG.score.bonuses.roadblockAvoided, 'Bloqueio evitado');
        }
      }
    }

    for (const id of [...this.roadblockTrackers.keys()]) {
      if (!currentIds.has(id)) this.roadblockTrackers.delete(id);
    }
  }

  getMultiplier(level) {
    return GAME_CONFIG.score.multipliers[level] ?? GAME_CONFIG.score.multipliers[6];
  }

  getEffectiveMultiplier(level, comboSystem = null) {
    return this.getMultiplier(level) * (comboSystem?.getMultiplier?.() ?? 1);
  }

  getStats() { return { ...this.stats }; }
  getUnitsEvadedCount() { return this.stats.unitsEvaded; }
  getScore() { return Math.floor(this.score); }
  getFormattedScore() { return this.getScore().toLocaleString('pt-BR'); }
}
