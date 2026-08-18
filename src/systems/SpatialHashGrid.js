export class SpatialHashGrid {
  constructor(cellSize = 24) {
    this.cellSize = Math.max(4, cellSize);
    this.cells = new Map();
  }

  clear() { this.cells.clear(); }

  _key(cx, cz) { return `${cx},${cz}`; }
  _cell(value) { return Math.floor(value / this.cellSize); }

  insert(item, position = item?.object3D?.position) {
    if (!item || !position) return;
    const cx = this._cell(position.x);
    const cz = this._cell(position.z);
    const key = this._key(cx, cz);
    let bucket = this.cells.get(key);
    if (!bucket) this.cells.set(key, bucket = []);
    bucket.push(item);
  }

  rebuild(items = []) {
    this.clear();
    for (const item of items) this.insert(item);
  }

  query(position, radius) {
    if (!position) return [];
    const r = Math.max(0, radius);
    const minX = this._cell(position.x - r);
    const maxX = this._cell(position.x + r);
    const minZ = this._cell(position.z - r);
    const maxZ = this._cell(position.z + r);
    const result = [];
    const radiusSq = r * r;
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(this._key(cx, cz));
        if (!bucket) continue;
        for (const item of bucket) {
          const p = item?.object3D?.position;
          if (!p) continue;
          const dx = p.x - position.x;
          const dz = p.z - position.z;
          if (dx * dx + dz * dz <= radiusSq) result.push(item);
        }
      }
    }
    return result;
  }

  getCellCount() { return this.cells.size; }
}
