export class ScreenFeedbackSystem {
  constructor(root = document) {
    this.root = root;
    this.ui = {
      speedFx: root.querySelector('#speedFx'),
      dangerFx: root.querySelector('#dangerFx'),
      impactFx: root.querySelector('#impactFx'),
      toastLayer: root.querySelector('#toastLayer'),
      wantedHud: root.querySelector('#wantedHud'),
      scoreHud: root.querySelector('#scoreHud'),
    };
    this.lastCollisionSerial = 0;
    this.lastWantedLevel = 1;
    this.lastPickup = null;
    this.lastBonus = null;
    this.lastComboBand = 1;
    this.flashTimer = 0;
  }

  reset({ player, wanted, powerUps, score } = {}) {
    this.lastCollisionSerial = player?.collisionSerial ?? 0;
    this.lastWantedLevel = wanted?.getLevel?.() ?? 1;
    this.lastPickup = powerUps?.lastPickup ?? null;
    this.lastBonus = score?.lastBonus ?? null;
    this.lastComboBand = 1;
    this.flashTimer = 0;
    if (this.ui.toastLayer) this.ui.toastLayer.innerHTML = '';
    if (this.ui.impactFx) this.ui.impactFx.style.opacity = '0';
  }

  update(deltaTime, { player, wanted, damage, powerUps, score, combo, capture, policeManager }) {
    if (deltaTime <= 0) return;
    const speed = Math.abs(player.getSpeedKmh?.() ?? 0);
    const nitro = player.isNitroActive?.() ?? false;
    const speedIntensity = Math.max(0, Math.min(1, (speed - 72) / 105 + (nitro ? 0.25 : 0)));
    if (this.ui.speedFx) {
      this.ui.speedFx.style.opacity = (speedIntensity * 0.72).toFixed(3);
      this.ui.speedFx.style.setProperty('--speed-stretch', `${1 + speedIntensity * 0.75}`);
    }

    const capturePercent = capture?.getProgressPercent?.() ?? 0;
    const integrity = damage?.getIntegrityPercent?.() ?? 100;
    const nearest = policeManager?.getNearestUnit?.();
    const policePressure = nearest ? Math.max(0, Math.min(1, (48 - nearest.distance) / 36)) : 0;
    const danger = Math.max(capturePercent / 100, integrity <= 25 ? 0.55 : 0, policePressure * 0.55);
    if (this.ui.dangerFx) {
      this.ui.dangerFx.style.opacity = Math.min(0.72, danger * 0.66).toFixed(3);
      this.ui.dangerFx.classList.toggle('critical', capturePercent >= 70 || integrity <= 15);
    }

    const serial = player?.collisionSerial ?? 0;
    if (serial !== this.lastCollisionSerial) {
      this.lastCollisionSerial = serial;
      this._flashImpact();
      const last = damage?.lastDamage;
      this.toast(last ? `IMPACTO  −${last.damage}%` : 'IMPACTO', 'danger');
    }

    const wantedLevel = wanted?.getLevel?.() ?? 1;
    if (wantedLevel !== this.lastWantedLevel) {
      this.lastWantedLevel = wantedLevel;
      this.ui.wantedHud?.classList.remove('hudPulse');
      void this.ui.wantedHud?.offsetWidth;
      this.ui.wantedHud?.classList.add('hudPulse');
      this.toast(wanted?.isMaximum?.() ? 'PROCURADO MÁXIMO' : `PROCURADO · NÍVEL ${wantedLevel}`, 'wanted');
    }

    if (powerUps?.lastPickup && powerUps.lastPickup !== this.lastPickup) {
      this.lastPickup = powerUps.lastPickup;
      this.toast(powerUps.lastPickup.label, 'power');
    }

    if (score?.lastBonus && score.lastBonus !== this.lastBonus) {
      this.lastBonus = score.lastBonus;
      if (score.lastBonus.type !== 'CASH_PICKUP') this.toast(`+${score.lastBonus.points} · ${score.lastBonus.label}`, 'bonus');
    }

    const comboBand = Math.max(1, Math.floor((combo?.getMultiplier?.() ?? 1) + 0.001));
    if (comboBand > this.lastComboBand) {
      this.ui.scoreHud?.classList.remove('comboBurst');
      void this.ui.scoreHud?.offsetWidth;
      this.ui.scoreHud?.classList.add('comboBurst');
      if (comboBand >= 2) this.toast(`COMBO x${comboBand}`, 'combo');
    }
    this.lastComboBand = comboBand;

    if (this.flashTimer > 0) {
      this.flashTimer -= deltaTime;
      if (this.ui.impactFx) this.ui.impactFx.style.opacity = String(Math.max(0, this.flashTimer / 0.2) * 0.68);
    }
  }

  _flashImpact() {
    this.flashTimer = 0.2;
    if (this.ui.impactFx) this.ui.impactFx.style.opacity = '0.68';
  }

  toast(text, kind = 'info') {
    if (!this.ui.toastLayer || !text) return;
    const el = this.root.createElement('div');
    el.className = `gameToast ${kind}`;
    el.textContent = text;
    this.ui.toastLayer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    }, 1700);
    while (this.ui.toastLayer.children.length > 4) this.ui.toastLayer.firstElementChild?.remove();
  }
}
