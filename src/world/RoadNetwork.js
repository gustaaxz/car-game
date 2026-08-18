export class RoadNetwork {
  constructor(roadCenters) {
    this.roadCenters = [...roadCenters];
    this.nodes = new Map();
    this._buildGrid();
  }

  _key(ix, iz) {
    return `${ix}:${iz}`;
  }

  _buildGrid() {
    for (let ix = 0; ix < this.roadCenters.length; ix++) {
      for (let iz = 0; iz < this.roadCenters.length; iz++) {
        const id = this._key(ix, iz);
        this.nodes.set(id, {
          id,
          ix,
          iz,
          x: this.roadCenters[ix],
          z: this.roadCenters[iz],
          neighbors: [],
        });
      }
    }

    for (const node of this.nodes.values()) {
      const candidates = [
        [node.ix - 1, node.iz],
        [node.ix + 1, node.iz],
        [node.ix, node.iz - 1],
        [node.ix, node.iz + 1],
      ];
      for (const [ix, iz] of candidates) {
        const neighbor = this.nodes.get(this._key(ix, iz));
        if (neighbor) node.neighbors.push(neighbor.id);
      }
    }
  }

  getClosestNode(position) {
    let best = null;
    let bestDistanceSq = Infinity;
    for (const node of this.nodes.values()) {
      const dx = node.x - position.x;
      const dz = node.z - position.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < bestDistanceSq) {
        best = node;
        bestDistanceSq = distanceSq;
      }
    }
    return best;
  }

  getRandomNode(excludeId = null) {
    const pool = [...this.nodes.values()].filter((node) => node.id !== excludeId);
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  }

  findPath(startPosition, targetPosition) {
    const start = this.getClosestNode(startPosition);
    const goal = this.getClosestNode(targetPosition);
    if (!start || !goal) return [];
    if (start.id === goal.id) return [{ x: goal.x, z: goal.z }];

    const open = new Set([start.id]);
    const cameFrom = new Map();
    const gScore = new Map([[start.id, 0]]);
    const fScore = new Map([[start.id, this._heuristic(start, goal)]]);

    while (open.size > 0) {
      let currentId = null;
      let currentScore = Infinity;
      for (const id of open) {
        const score = fScore.get(id) ?? Infinity;
        if (score < currentScore) {
          currentId = id;
          currentScore = score;
        }
      }

      if (currentId === goal.id) return this._reconstruct(cameFrom, currentId);
      open.delete(currentId);
      const current = this.nodes.get(currentId);

      for (const neighborId of current.neighbors) {
        const neighbor = this.nodes.get(neighborId);
        const tentative = (gScore.get(currentId) ?? Infinity) + this._distance(current, neighbor);
        if (tentative >= (gScore.get(neighborId) ?? Infinity)) continue;

        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentative);
        fScore.set(neighborId, tentative + this._heuristic(neighbor, goal));
        open.add(neighborId);
      }
    }

    return [];
  }

  _reconstruct(cameFrom, currentId) {
    const ids = [currentId];
    while (cameFrom.has(currentId)) {
      currentId = cameFrom.get(currentId);
      ids.unshift(currentId);
    }
    return ids.map((id) => {
      const node = this.nodes.get(id);
      return { x: node.x, z: node.z };
    });
  }

  _heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }

  _distance(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
}
