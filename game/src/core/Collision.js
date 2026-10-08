// عالم التصادم: كل العوائق الثابتة صناديق محاذية للمحاور (AABB).
// هذا يجعل الفيزياء سريعة جدًا ومناسبة للهواتف.

export const STEP_HEIGHT = 0.35;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
  }

  /** يضيف عائقًا. y0/y1 الارتفاع، blocksView: هل يحجب رؤية المطاردين. */
  addBox(minX, minZ, maxX, maxZ, y0 = 0, y1 = 3, blocksView = true) {
    const b = { minX, minZ, maxX, maxZ, minY: y0, maxY: y1, blocksView };
    this.boxes.push(b);
    return b;
  }

  /**
   * يحرك جسمًا أسطوانيًا ويحل التصادم مع الصناديق.
   * body: { pos: Vector3, vel: Vector3, radius, height, onGround }
   */
  moveCharacter(body, dt, gravity = 22) {
    const p = body.pos;
    p.x += body.vel.x * dt;
    p.z += body.vel.z * dt;

    let groundY = 0;
    const r = body.radius;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.boxes) {
        if (p.x + r < b.minX || p.x - r > b.maxX || p.z + r < b.minZ || p.z - r > b.maxZ) continue;
        if (b.minY >= p.y + body.height) continue;
        const cx = Math.min(Math.max(p.x, b.minX), b.maxX);
        const cz = Math.min(Math.max(p.z, b.minZ), b.maxZ);
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (b.maxY <= p.y + STEP_HEIGHT) {
          // سطح يمكن الوقوف عليه — فقط إذا كان المركز قريبًا منه
          if (d2 < r * r * 0.36) groundY = Math.max(groundY, b.maxY);
          continue;
        }
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          const push = r - d;
          p.x += (dx / d) * push;
          p.z += (dz / d) * push;
          // إزالة مركبة السرعة نحو الجدار
          const nx = dx / d, nz = dz / d;
          const vn = body.vel.x * nx + body.vel.z * nz;
          if (vn < 0) { body.vel.x -= vn * nx; body.vel.z -= vn * nz; }
        } else {
          // المركز داخل الصندوق: ادفعه عبر أقصر محور
          const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
          const m = Math.min(l, rr, t, bt);
          if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r;
          else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
        }
      }
    }

    body.vel.y -= gravity * dt;
    p.y += body.vel.y * dt;
    if (p.y <= groundY) {
      p.y = groundY;
      if (body.vel.y < 0) body.vel.y = 0;
      body.onGround = true;
    } else {
      body.onGround = p.y - groundY < 0.05 && body.vel.y <= 0;
    }
    body.groundY = groundY;
  }

  /** تقاطع شعاع مع الصناديق. يعيد أقرب مسافة أو Infinity. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, viewOnly = false) {
    let best = maxDist;
    const ix = 1 / (dx || 1e-12), iy = 1 / (dy || 1e-12), iz = 1 / (dz || 1e-12);
    for (const b of this.boxes) {
      if (viewOnly && !b.blocksView) continue;
      let t1 = (b.minX - ox) * ix, t2 = (b.maxX - ox) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (b.minY - oy) * iy; t2 = (b.maxY - oy) * iy;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (b.minZ - oz) * iz; t2 = (b.maxZ - oz) * iz;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= Math.max(tmin, 0) && tmin < best) best = Math.max(tmin, 0);
    }
    return best < maxDist ? best : Infinity;
  }

  /** خط رؤية بين نقطتين. */
  lineOfSight(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    return this.raycast(a.x, a.y, a.z, dx / len, dy / len, dz / len, len, true) === Infinity;
  }

  /** هل النقطة داخل صندوق (للمقذوفات). */
  pointHit(x, y, z, r = 0) {
    for (const b of this.boxes) {
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ && y - r < b.maxY && y + r > b.minY) return b;
    }
    return null;
  }
}
