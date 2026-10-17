// High-Performance 2D Spatial Hash Grid for 500+ Active Entities

export class SpatialHashGrid {
  constructor(cellSize = 4.0) {
    this.cellSize = cellSize;
    this.invCellSize = 1.0 / cellSize;
    this.buckets = new Map();
    this.pool = [];
  }

  clear() {
    for (const arr of this.buckets.values()) {
      arr.length = 0;
      this.pool.push(arr);
    }
    this.buckets.clear();
  }

  _hash(cx, cz) {
    // Pack two 16-bit signed grid coordinates into a 32-bit integer key
    return ((cx & 0xffff) << 16) | (cz & 0xffff);
  }

  insert(entity) {
    const cx = Math.floor(entity.x * this.invCellSize);
    const cz = Math.floor(entity.z * this.invCellSize);
    const key = this._hash(cx, cz);

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = this.pool.length > 0 ? this.pool.pop() : [];
      this.buckets.set(key, bucket);
    }
    bucket.push(entity);
  }

  /**
   * Appends all active entities within `radius` of `(x, z)` into `outArray`.
   */
  queryRadius(x, z, radius, outArray) {
    outArray.length = 0;
    const rCells = Math.ceil(radius * this.invCellSize);
    const cx0 = Math.floor(x * this.invCellSize);
    const cz0 = Math.floor(z * this.invCellSize);

    for (let dx = -rCells; dx <= rCells; dx++) {
      const cx = cx0 + dx;
      for (let dz = -rCells; dz <= rCells; dz++) {
        const bucket = this.buckets.get(this._hash(cx, cz0 + dz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const e = bucket[i];
          if (!e.active) continue;
          const ex = e.x - x;
          const ez = e.z - z;
          const maxR = radius + (e.radius || 0.5);
          if (ex * ex + ez * ez <= maxR * maxR) {
            outArray.push(e);
          }
        }
      }
    }
    return outArray;
  }

  /**
   * Finds the best target within `maxRange` of `(x, z)`.
   * Prioritizes nearest and high-threat targets (Elites/Snipers/Bruisers get a threat weight).
   */
  findBestTarget(x, z, maxRange, prioritizeThreat = true) {
    let bestEntity = null;
    let bestScore = Infinity;
    const rCells = Math.ceil(maxRange * this.invCellSize);
    const cx0 = Math.floor(x * this.invCellSize);
    const cz0 = Math.floor(z * this.invCellSize);
    const maxRangeSq = maxRange * maxRange;

    for (let dx = -rCells; dx <= rCells; dx++) {
      const cx = cx0 + dx;
      for (let dz = -rCells; dz <= rCells; dz++) {
        const bucket = this.buckets.get(this._hash(cx, cz0 + dz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const e = bucket[i];
          if (!e.active) continue;
          const ex = e.x - x;
          const ez = e.z - z;
          const dSq = ex * ex + ez * ez;
          if (dSq > maxRangeSq) continue;

          // Lower score = higher priority
          const threatWeight = prioritizeThreat ? (e.threatWeight || 1.0) : 1.0;
          const score = dSq / threatWeight;
          if (score < bestScore) {
            bestScore = score;
            bestEntity = e;
          }
        }
      }
    }
    return bestEntity;
  }
}
