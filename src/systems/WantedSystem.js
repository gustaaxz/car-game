import { GAME_CONFIG } from '../config/gameConfig.js';

export class WantedSystem {
  constructor() {
    this.elapsedTime = 0;
    this.profileIndex = 0;
    this.listeners = new Set();
  }

  reset() {
    this.elapsedTime = 0;
    this._setProfileIndex(0, true);
  }

  update(deltaTime) {
    if (deltaTime <= 0) return;
    this.elapsedTime += deltaTime;

    const levels = GAME_CONFIG.wanted.levels;
    let nextIndex = 0;
    for (let i = 0; i < levels.length; i++) {
      if (this.elapsedTime >= levels[i].minTime) nextIndex = i;
      else break;
    }

    this._setProfileIndex(nextIndex);
  }

  _setProfileIndex(index, forceNotify = false) {
    if (!forceNotify && index === this.profileIndex) return;
    this.profileIndex = index;
    const profile = this.getProfile();
    for (const listener of this.listeners) listener(profile, this);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getProfile() {
    return GAME_CONFIG.wanted.levels[this.profileIndex];
  }

  getLevel() {
    return this.getProfile().level;
  }

  getFilledStars() {
    return Math.min(6, this.getProfile().starCount);
  }

  isMaximum() {
    return this.getProfile().maximum === true;
  }

  getFormattedTime() {
    const total = Math.floor(this.elapsedTime);
    const minutes = Math.floor(total / 60).toString().padStart(2, '0');
    const seconds = (total % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
}
