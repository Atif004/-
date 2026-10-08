// أدوات هندسية + دمج الأجسام الثابتة لتقليل عدد draw calls (مهم للهواتف).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** صندوق بإحداثيات UV بالمتر (tile = طول البلاطة بالمتر). */
export function tiledBox(w, h, d, tile = 4) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [a, b] = dims[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * a / tile, uv.getY(i) * b / tile);
    }
  }
  return g;
}

/**
 * يجمع الشبكات الثابتة حسب المادة ويدمجها في شبكة واحدة لكل مادة.
 */
export class StaticBatcher {
  constructor() { this.buckets = new Map(); }

  add(geometry, material, matrix, castShadow = true, receiveShadow = true) {
    // تقسيم المدينة إلى قطع 80م ليعمل الاستبعاد خارج مجال الرؤية (frustum culling)
    const chunk = `${Math.floor(matrix.elements[12] / 80)},${Math.floor(matrix.elements[14] / 80)}`;
    const key = `${material.uuid}|${castShadow ? 1 : 0}|${chunk}`;
    let b = this.buckets.get(key);
    if (!b) { b = { material, geos: [], castShadow, receiveShadow }; this.buckets.set(key, b); }
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    g.applyMatrix4(matrix);
    b.geos.push(g);
  }

  /** يضيف مجموعة Object3D (مثلًا سيارة) — كل شبكاتها تُدمج. */
  addObject(obj, castShadow = true) {
    obj.updateMatrixWorld(true);
    obj.traverse((m) => {
      if (m.isMesh) this.add(m.geometry, m.material, m.matrixWorld, castShadow && m.castShadow !== false, true);
    });
  }

  build(parent) {
    for (const b of this.buckets.values()) {
      if (!b.geos.length) continue;
      const merged = mergeGeometries(b.geos, false);
      b.geos.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.material);
      mesh.castShadow = b.castShadow;
      mesh.receiveShadow = b.receiveShadow;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.buckets.clear();
  }
}
