export class WorldCollision {
  constructor(bounds) {
    this.bounds = bounds;
    this.obstacles = [];
  }

  addBox(minX, maxX, minZ, maxZ, label = 'obstacle') {
    const obstacle = { minX, maxX, minZ, maxZ, label };
    this.obstacles.push(obstacle);
    return obstacle;
  }

  removeObstacle(obstacle) {
    const index = this.obstacles.indexOf(obstacle);
    if (index >= 0) this.obstacles.splice(index, 1);
  }

  resolveCircle(position, velocity, radius, restitution = 0.08) {
    return this.resolveCircleDetailed(position, velocity, radius, restitution).collided;
  }

  resolveCircleDetailed(position, velocity, radius, restitution = 0.08) {
    let collided = false;
    let label = null;
    const b = this.bounds;

    if (position.x < b.minX + radius) {
      position.x = b.minX + radius;
      if (velocity.x < 0) velocity.x *= -restitution;
      collided = true;
      label = 'boundary';
    } else if (position.x > b.maxX - radius) {
      position.x = b.maxX - radius;
      if (velocity.x > 0) velocity.x *= -restitution;
      collided = true;
      label = 'boundary';
    }

    if (position.z < b.minZ + radius) {
      position.z = b.minZ + radius;
      if (velocity.z < 0) velocity.z *= -restitution;
      collided = true;
      label = 'boundary';
    } else if (position.z > b.maxZ - radius) {
      position.z = b.maxZ - radius;
      if (velocity.z > 0) velocity.z *= -restitution;
      collided = true;
      label = 'boundary';
    }

    for (const obstacle of this.obstacles) {
      if (!this._circleIntersectsAabb(position.x, position.z, radius, obstacle)) continue;
      this._pushCircleOut(position, velocity, radius, obstacle, restitution);
      collided = true;
      label = obstacle.label;
    }

    return { collided, label };
  }

  hasLineOfSight(from, to, padding = 1.5) {
    for (const obstacle of this.obstacles) {
      if (!['building', 'tunnel-wall'].includes(obstacle.label)) continue;
      const expanded = {
        minX: obstacle.minX - padding,
        maxX: obstacle.maxX + padding,
        minZ: obstacle.minZ - padding,
        maxZ: obstacle.maxZ + padding,
      };
      if (this._segmentIntersectsAabb(from.x, from.z, to.x, to.z, expanded)) return false;
    }
    return true;
  }

  _circleIntersectsAabb(x, z, radius, box) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    return dx * dx + dz * dz < radius * radius;
  }

  _pushCircleOut(position, velocity, radius, box, restitution) {
    const left = Math.abs(position.x - box.minX);
    const right = Math.abs(box.maxX - position.x);
    const top = Math.abs(position.z - box.minZ);
    const bottom = Math.abs(box.maxZ - position.z);
    const smallest = Math.min(left, right, top, bottom);

    if (smallest === left) {
      position.x = box.minX - radius;
      if (velocity.x > 0) velocity.x *= -restitution;
    } else if (smallest === right) {
      position.x = box.maxX + radius;
      if (velocity.x < 0) velocity.x *= -restitution;
    } else if (smallest === top) {
      position.z = box.minZ - radius;
      if (velocity.z > 0) velocity.z *= -restitution;
    } else {
      position.z = box.maxZ + radius;
      if (velocity.z < 0) velocity.z *= -restitution;
    }
  }

  _segmentIntersectsAabb(x1, z1, x2, z2, box) {
    let tMin = 0;
    let tMax = 1;
    const dx = x2 - x1;
    const dz = z2 - z1;

    const testAxis = (origin, delta, min, max) => {
      if (Math.abs(delta) < 1e-8) return origin >= min && origin <= max;
      let t1 = (min - origin) / delta;
      let t2 = (max - origin) / delta;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      return tMin <= tMax;
    };

    return testAxis(x1, dx, box.minX, box.maxX) && testAxis(z1, dz, box.minZ, box.maxZ);
  }
}
