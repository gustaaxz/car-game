export class Entity {
  constructor(object3D) {
    this.object3D = object3D;
    this.active = true;
  }

  update() {}

  setPosition(x, y, z) {
    this.object3D.position.set(x, y, z);
  }
}
