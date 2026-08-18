export class PerformanceSystem {
  constructor(renderer, camera, player, trafficManager, policeManager) {
    this.renderer = renderer;
    this.camera = camera;
    this.player = player;
    this.trafficManager = trafficManager;
    this.policeManager = policeManager;
    this.sampleTime = 0;
    this.frameTime = 0;
    this.frameCount = 0;
    this.targetPixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.currentPixelRatio = this.targetPixelRatio;
    this.visibleTraffic = 0;
    this.visiblePolice = 0;
  }

  reset() {
    this.sampleTime = 0;
    this.frameTime = 0;
    this.frameCount = 0;
    this._applyVehicleLod();
  }

  update(deltaTime) {
    if (deltaTime <= 0) return;
    this.sampleTime += deltaTime;
    this.frameTime += deltaTime;
    this.frameCount += 1;
    this._applyVehicleLod();

    if (this.sampleTime >= 2) {
      const avgMs = this.frameCount ? (this.frameTime / this.frameCount) * 1000 : 16.7;
      let next = this.currentPixelRatio;
      if (avgMs > 24) next = Math.max(1, this.currentPixelRatio - 0.25);
      else if (avgMs < 17.5) next = Math.min(this.targetPixelRatio, this.currentPixelRatio + 0.25);
      if (Math.abs(next - this.currentPixelRatio) >= 0.1) {
        this.currentPixelRatio = next;
        this.renderer.setPixelRatio(this.currentPixelRatio);
      }
      this.sampleTime = 0;
      this.frameTime = 0;
      this.frameCount = 0;
    }
  }

  _applyVehicleLod() {
    const playerPos = this.player.object3D.position;
    let visibleTraffic = 0;
    for (const vehicle of this.trafficManager.vehicles) {
      const d = vehicle.object3D.position.distanceTo(playerPos);
      const visible = d <= 320;
      if (vehicle.object3D.visible !== visible) vehicle.object3D.visible = visible;
      if (visible) visibleTraffic += 1;
      const castShadow = d <= 95;
      if (vehicle._perfShadow !== castShadow) {
        vehicle._perfShadow = castShadow;
        vehicle.object3D.traverse?.((child) => { if ('castShadow' in child) child.castShadow = castShadow; if ('frustumCulled' in child) child.frustumCulled = true; });
      }
    }

    let visiblePolice = 0;
    for (const unit of this.policeManager.units) {
      const d = unit.vehicle.object3D.position.distanceTo(playerPos);
      const visible = d <= 360;
      if (unit.vehicle.object3D.visible !== visible) unit.vehicle.object3D.visible = visible;
      if (visible) visiblePolice += 1;
      const castShadow = d <= 115;
      if (unit.vehicle._perfShadow !== castShadow) {
        unit.vehicle._perfShadow = castShadow;
        unit.vehicle.object3D.traverse?.((child) => { if ('castShadow' in child) child.castShadow = castShadow; if ('frustumCulled' in child) child.frustumCulled = true; });
      }
    }
    this.visibleTraffic = visibleTraffic;
    this.visiblePolice = visiblePolice;
  }

  getStats() {
    return {
      pixelRatio: this.currentPixelRatio,
      visibleTraffic: this.visibleTraffic,
      visiblePolice: this.visiblePolice,
      trafficCells: this.trafficManager.spatialGrid?.getCellCount?.() ?? 0,
      pooledPolice: this.policeManager.getPoolSize?.() ?? 0,
      reusedTraffic: this.trafficManager.reusedLastReset ?? 0,
    };
  }
}
