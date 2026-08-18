export class HUDSystem {
  constructor(root = document) {
    this.ui = {
      root: root.querySelector('#gameHud'),
      wantedStars: root.querySelector('#wantedStars'),
      wantedLabel: root.querySelector('#wantedLabel'),
      wantedTime: root.querySelector('#wantedTime'),
      policeCount: root.querySelector('#policeCount'),
      scoreValue: root.querySelector('#scoreValue'),
      multiplierValue: root.querySelector('#multiplierValue'),
      comboValue: root.querySelector('#comboValue'),
      comboBarFill: root.querySelector('#comboBarFill'),
      captureValue: root.querySelector('#captureValue'),
      captureStatus: root.querySelector('#captureStatus'),
      captureBarFill: root.querySelector('#captureBarFill'),
      integrityValue: root.querySelector('#integrityValue'),
      integrityBarFill: root.querySelector('#integrityBarFill'),
      damageStatus: root.querySelector('#damageStatus'),
      speedValue: root.querySelector('#speedValue'),
      speedGear: root.querySelector('#speedGear'),
      effectNitro: root.querySelector('#effectNitro'),
      effectJammer: root.querySelector('#effectJammer'),
      nitroTime: root.querySelector('#nitroTime'),
      jammerTime: root.querySelector('#jammerTime'),
    };
  }

  setVisible(visible) {
    this.ui.root?.classList.toggle('hidden', !visible);
  }

  update({ wanted, score, combo, capture, damage, player, policeManager }) {
    if (!this.ui.root) return;
    const profile = wanted.getProfile();
    const filled = wanted.getFilledStars();
    const speed = Math.round(Math.abs(player.getSpeedKmh()));
    const integrity = damage.getIntegrityPercent();
    const capturePercent = capture.getProgressPercent();

    this.ui.wantedStars.textContent = Array.from({ length: 6 }, (_, i) => i < filled ? '★' : '☆').join(' ');
    this.ui.wantedLabel.textContent = profile.label;
    this.ui.wantedLabel.classList.toggle('maximum', wanted.isMaximum());
    this.ui.wantedTime.textContent = wanted.getFormattedTime();
    this.ui.policeCount.textContent = `${policeManager.getUnitCount()} VIATURA${policeManager.getUnitCount() === 1 ? '' : 'S'}`;

    this.ui.scoreValue.textContent = score.getFormattedScore();
    this.ui.multiplierValue.textContent = `PROCURADO x${score.getMultiplier(profile.level).toFixed(1)}`;
    this.ui.comboValue.textContent = `COMBO x${combo.getMultiplier().toFixed(1)}`;
    this.ui.comboBarFill.style.width = `${combo.getRiskPercent()}%`;

    this.ui.captureValue.textContent = `${capturePercent}%`;
    this.ui.captureStatus.textContent = capture.status;
    this.ui.captureBarFill.style.width = `${capturePercent}%`;
    this.ui.captureBarFill.dataset.danger = capturePercent >= 70 ? 'critical' : capturePercent >= 35 ? 'warning' : 'safe';

    this.ui.integrityValue.textContent = `${integrity}%`;
    this.ui.integrityBarFill.style.width = `${integrity}%`;
    this.ui.integrityBarFill.dataset.state = integrity <= 25 ? 'critical' : integrity < 60 ? 'warning' : 'safe';
    this.ui.damageStatus.textContent = damage.isCritical() ? 'VEÍCULO CRÍTICO' : integrity < 60 ? 'VEÍCULO DANIFICADO' : 'INTEGRIDADE';

    this.ui.speedValue.textContent = String(speed).padStart(3, '0');
    const longitudinalSpeed = player.velocity?.dot?.(player.forward) ?? 0;
    this.ui.speedGear.textContent = longitudinalSpeed < -0.35 ? 'R' : speed < 2 ? 'N' : 'D';

    const nitroActive = player.isNitroActive();
    const jammerActive = policeManager.isJammed();
    this.ui.effectNitro?.classList.toggle('active', nitroActive);
    this.ui.effectJammer?.classList.toggle('active', jammerActive);
    if (this.ui.nitroTime) this.ui.nitroTime.textContent = nitroActive ? `${player.getNitroTimeRemaining().toFixed(1)}s` : '';
    if (this.ui.jammerTime) this.ui.jammerTime.textContent = jammerActive ? `${policeManager.getJammerTimeRemaining().toFixed(1)}s` : '';
  }
}
