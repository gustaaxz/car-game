export class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.lastTime = 0;
    this.rafId = null;
    this.maxDelta = 1 / 20;

    this.frame = (timeMs) => {
      if (!this.running) return;
      const now = timeMs / 1000;
      const rawDelta = this.lastTime === 0 ? 0 : now - this.lastTime;
      const deltaTime = Math.min(rawDelta, this.maxDelta);
      this.lastTime = now;

      this.update(deltaTime);
      this.render();
      this.rafId = requestAnimationFrame(this.frame);
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
