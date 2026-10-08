// شبكة ملاحة ثنائية الأبعاد + بحث A* لمسارات المطاردين.
import { STEP_HEIGHT } from '../core/Collision.js';

const SQRT2 = Math.SQRT2;

export class NavGrid {
  constructor(width, depth, cell = 1.5) {
    this.cell = cell;
    this.w = Math.ceil(width / cell);
    this.h = Math.ceil(depth / cell);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.visit = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.gen = 1;
    this.heap = new Int32Array(n);
    this.heapSize = 0;
  }

  /** يعلّم الخلايا المحجوبة من عالم التصادم مع تضخيم بنصف قطر العميل. */
  bake(collision, agentRadius = 0.5) {
    const c = this.cell;
    for (const b of collision.boxes) {
      if (b.maxY <= STEP_HEIGHT) continue;
      const x0 = Math.max(0, Math.floor((b.minX - agentRadius) / c));
      const x1 = Math.min(this.w - 1, Math.floor((b.maxX + agentRadius) / c));
      const z0 = Math.max(0, Math.floor((b.minZ - agentRadius) / c));
      const z1 = Math.min(this.h - 1, Math.floor((b.maxZ + agentRadius) / c));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * this.w + x] = 1;
    }
    // حدود الخريطة
    for (let x = 0; x < this.w; x++) { this.blocked[x] = 1; this.blocked[(this.h - 1) * this.w + x] = 1; }
    for (let z = 0; z < this.h; z++) { this.blocked[z * this.w] = 1; this.blocked[z * this.w + this.w - 1] = 1; }
  }

  toCell(x, z) {
    const cx = Math.min(this.w - 1, Math.max(0, Math.floor(x / this.cell)));
    const cz = Math.min(this.h - 1, Math.max(0, Math.floor(z / this.cell)));
    return cz * this.w + cx;
  }

  cellCenter(i, out) {
    out.x = ((i % this.w) + 0.5) * this.cell;
    out.z = (Math.floor(i / this.w) + 0.5) * this.cell;
    return out;
  }

  walkableAt(x, z) { return !this.blocked[this.toCell(x, z)]; }

  /** أقرب خلية قابلة للمشي (بحث حلزوني بسيط). */
  nearestWalkable(i) {
    if (!this.blocked[i]) return i;
    const cx = i % this.w, cz = Math.floor(i / this.w);
    for (let r = 1; r < 12; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= this.w || z >= this.h) continue;
        const j = z * this.w + x;
        if (!this.blocked[j]) return j;
      }
    }
    return -1;
  }

  /** هل الخط المستقيم بين نقطتين قابل للمشي بالكامل. */
  lineWalkable(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      if (this.blocked[this.toCell(ax + dx * t, az + dz * t)]) return false;
    }
    return true;
  }

  // ---- كومة ثنائية ----
  push(i) {
    const h = this.heap, f = this.f;
    let k = this.heapSize++;
    h[k] = i;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[h[p]] <= f[h[k]]) break;
      const t = h[p]; h[p] = h[k]; h[k] = t; k = p;
    }
  }
  pop() {
    const h = this.heap, f = this.f;
    const top = h[0];
    h[0] = h[--this.heapSize];
    let k = 0;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < this.heapSize && f[h[l]] < f[h[m]]) m = l;
      if (r < this.heapSize && f[h[r]] < f[h[m]]) m = r;
      if (m === k) break;
      const t = h[m]; h[m] = h[k]; h[k] = t; k = m;
    }
    return top;
  }

  /** يعيد مصفوفة نقاط {x,z} مبسطة من البداية للهدف، أو null. */
  findPath(sx, sz, tx, tz, maxIter = 9000) {
    let start = this.nearestWalkable(this.toCell(sx, sz));
    let goal = this.nearestWalkable(this.toCell(tx, tz));
    if (start < 0 || goal < 0) return null;
    const gen = ++this.gen;
    const w = this.w, gx = goal % w, gz = Math.floor(goal / w);
    const { g, f, parent, visit, closed, blocked } = this;
    this.heapSize = 0;
    g[start] = 0; visit[start] = gen; parent[start] = -1;
    const hfun = (i) => {
      const dx = Math.abs((i % w) - gx), dz = Math.abs(Math.floor(i / w) - gz);
      return (dx + dz) + (SQRT2 - 2) * Math.min(dx, dz);
    };
    f[start] = hfun(start);
    this.push(start);
    let found = false, iter = 0;
    while (this.heapSize > 0 && iter++ < maxIter) {
      const cur = this.pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === goal) { found = true; break; }
      const cx = cur % w, cz = (cur - cx) / w;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= this.h) continue;
        const ni = nz * w + nx;
        if (blocked[ni] || closed[ni] === gen) continue;
        if (dx && dz && (blocked[cz * w + nx] || blocked[nz * w + cx])) continue; // لا قطع للزوايا
        const ng = g[cur] + (dx && dz ? SQRT2 : 1);
        if (visit[ni] !== gen || ng < g[ni]) {
          visit[ni] = gen; g[ni] = ng; parent[ni] = cur;
          f[ni] = ng + hfun(ni) * 1.05;
          this.push(ni);
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = parent[i]) cells.push(i);
    cells.reverse();
    // تبسيط المسار (string pulling)
    const pts = cells.map((i) => this.cellCenter(i, { x: 0, z: 0 }));
    const out = [];
    let a = { x: sx, z: sz };
    let k = 0;
    while (k < pts.length - 1) {
      let far = k + 1;
      for (let j = Math.min(pts.length - 1, k + 24); j > k + 1; j--) {
        if (this.lineWalkable(a.x, a.z, pts[j].x, pts[j].z)) { far = j; break; }
      }
      out.push(pts[far]);
      a = pts[far];
      k = far;
    }
    if (out.length) out[out.length - 1] = { x: tx, z: tz };
    return out;
  }
}
