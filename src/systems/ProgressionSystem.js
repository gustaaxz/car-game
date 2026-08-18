import { GAME_CONFIG } from '../config/gameConfig.js';

const STORAGE_KEY = 'policia-vs-ladrao.progression.v1';
const DEFAULT_DATA = Object.freeze({
  totalXp: 0,
  cash: 0,
  runs: 0,
  bestTimeSeconds: 0,
  bestScore: 0,
  selectedVehicleId: 'COMPACT',
  unlockedVehicleIds: ['COMPACT'],
});

export class ProgressionSystem {
  constructor(storage = null) {
    this.storage = storage ?? this._resolveStorage();
    this.data = this._load();
    this.lastRunRewards = null;
    this.runFinished = false;
  }

  _resolveStorage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
  }

  _load() {
    if (!this.storage) return this._cloneDefault();
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return this._cloneDefault();
      const parsed = JSON.parse(raw);
      return this._sanitize(parsed);
    } catch {
      return this._cloneDefault();
    }
  }

  _cloneDefault() {
    return { ...DEFAULT_DATA, unlockedVehicleIds: [...DEFAULT_DATA.unlockedVehicleIds] };
  }

  _sanitize(data = {}) {
    const unlocked = Array.isArray(data.unlockedVehicleIds) ? data.unlockedVehicleIds.filter(Boolean) : [];
    if (!unlocked.includes('COMPACT')) unlocked.unshift('COMPACT');
    const selected = unlocked.includes(data.selectedVehicleId) ? data.selectedVehicleId : 'COMPACT';
    return {
      totalXp: Math.max(0, Math.floor(Number(data.totalXp) || 0)),
      cash: Math.max(0, Math.floor(Number(data.cash) || 0)),
      runs: Math.max(0, Math.floor(Number(data.runs) || 0)),
      bestTimeSeconds: Math.max(0, Number(data.bestTimeSeconds) || 0),
      bestScore: Math.max(0, Math.floor(Number(data.bestScore) || 0)),
      selectedVehicleId: selected,
      unlockedVehicleIds: [...new Set(unlocked)],
    };
  }

  _save() {
    if (!this.storage) return;
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* armazenamento indisponível */ }
  }

  beginRun() {
    this.runFinished = false;
    this.lastRunRewards = null;
  }

  finishRun({ timeSeconds = 0, score = 0, maxWantedLevel = 1 } = {}) {
    if (this.runFinished && this.lastRunRewards) return this.lastRunRewards;

    const safeTime = Math.max(0, Number(timeSeconds) || 0);
    const safeScore = Math.max(0, Math.floor(Number(score) || 0));
    const safeWanted = Math.max(1, Math.floor(Number(maxWantedLevel) || 1));
    const cfg = GAME_CONFIG.progression.rewards;

    const xpGained = Math.max(cfg.minXp, Math.floor(
      safeTime * cfg.xpPerSecond + safeScore * cfg.xpPerScorePoint + safeWanted * cfg.xpPerWantedLevel
    ));
    const cashGained = Math.max(cfg.minCash, Math.floor(
      safeTime * cfg.cashPerSecond + safeScore * cfg.cashPerScorePoint + safeWanted * cfg.cashPerWantedLevel
    ));

    const previousLevel = this.getLevel();
    const newTimeRecord = safeTime > this.data.bestTimeSeconds;
    const newScoreRecord = safeScore > this.data.bestScore;

    this.data.totalXp += xpGained;
    this.data.cash += cashGained;
    this.data.runs += 1;
    if (newTimeRecord) this.data.bestTimeSeconds = safeTime;
    if (newScoreRecord) this.data.bestScore = safeScore;

    const currentLevel = this.getLevel();
    this.lastRunRewards = {
      xpGained,
      cashGained,
      previousLevel,
      currentLevel,
      leveledUp: currentLevel > previousLevel,
      newTimeRecord,
      newScoreRecord,
      timeSeconds: safeTime,
      score: safeScore,
    };
    this.runFinished = true;
    this._save();
    return this.lastRunRewards;
  }

  getLevel() {
    const thresholds = GAME_CONFIG.progression.levelThresholds;
    let level = 1;
    for (let i = 0; i < thresholds.length; i++) {
      if (this.data.totalXp >= thresholds[i]) level = i + 1;
      else break;
    }
    return level;
  }

  getXpIntoLevel() {
    const thresholds = GAME_CONFIG.progression.levelThresholds;
    const level = this.getLevel();
    const current = thresholds[level - 1] ?? thresholds.at(-1) ?? 0;
    const next = thresholds[level] ?? current;
    return { current: Math.max(0, this.data.totalXp - current), required: Math.max(0, next - current), total: this.data.totalXp, maxLevel: level >= thresholds.length };
  }

  addCash(amount = 0) {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    this.data.cash += value;
    this._save();
    return value;
  }

  spendCash(amount = 0) {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (this.data.cash < value) return false;
    this.data.cash -= value;
    this._save();
    return true;
  }

  isVehicleUnlocked(id) { return this.data.unlockedVehicleIds.includes(id); }

  unlockVehicle(id) {
    if (!this.isVehicleUnlocked(id)) this.data.unlockedVehicleIds.push(id);
    this._save();
  }

  selectVehicle(id) {
    if (!this.isVehicleUnlocked(id)) return false;
    this.data.selectedVehicleId = id;
    this._save();
    return true;
  }

  getSnapshot() {
    return { ...this.data, unlockedVehicleIds: [...this.data.unlockedVehicleIds] };
  }

  getSelectedVehicleId() { return this.data.selectedVehicleId; }
  getCash() { return this.data.cash; }
  getTotalXp() { return this.data.totalXp; }
  getRuns() { return this.data.runs; }
  getBestTimeSeconds() { return this.data.bestTimeSeconds; }
  getBestScore() { return this.data.bestScore; }
}
