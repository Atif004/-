// يبني مدينة خليجية حديثة خيالية بشكل إجرائي حسب إعدادات المرحلة.
import * as THREE from 'three';
import { CollisionWorld } from '../core/Collision.js';
import { makeRng } from '../core/Random.js';
import { StaticBatcher, tiledBox } from './Geometry.js';
import { facadeTexture, villaTexture, asphaltTexture, sidewalkTexture, sandTexture, labelTexture } from './Textures.js';
import {
  mat, makeCar, makePalm, makeBarrier, makeLamp, makeBench, makePlanter, makeCone, makeFountain, makeShade,
} from './Props.js';

export const BLOCK = 28;
export const ROAD = 11;

const TOWER_STYLES = [
  { base: '#d9d4c8', glass: '#2f6f8f', frame: '#c9c4b6' },
  { base: '#e4dccb', glass: '#3c8aa0', frame: '#d8cfba' },
  { base: '#b9b2a4', glass: '#28485e', frame: '#a8a191' },
  { base: '#cfc7b5', glass: '#7a6a4c', frame: '#bdb39d' },
  { base: '#e8e8e8', glass: '#4a7fa8', frame: '#dcdcdc' },
];
const VILLA_COLORS = ['#e6d3b0', '#ead9bd', '#dcc39a', '#f0e4cc', '#d9b98c'];

export function buildMap(level) {
  const rng = makeRng(level.seed * 7919);
  const B = level.blocks;
  const size = B * BLOCK + (B + 1) * ROAD;
  const group = new THREE.Group();
  const col = new CollisionWorld();
  const batch = new StaticBatcher();
  const minimap = { size, buildings: [], props: [] };
  const M4 = new THREE.Matrix4();
  const tmpObj = new THREE.Object3D();

  const place = (obj, x, y, z, ry = 0, castShadow = true) => {
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    batch.addObject(obj, castShadow);
  };
  const boxMesh = (geo, material, x, y, z, castShadow = true) => {
    tmpObj.position.set(x, y, z); tmpObj.rotation.set(0, 0, 0); tmpObj.scale.set(1, 1, 1);
    tmpObj.updateMatrix();
    batch.add(geo, material, M4.copy(tmpObj.matrix), castShadow, true);
  };
  /** مبنى مع تصادم + سطح. */
  const building = (cx, cz, w, d, h, material, roofColor) => {
    boxMesh(tiledBox(w, h, d, material.userData.tile || 14), material, cx, h / 2, cz);
    boxMesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), mat(`roof-${roofColor}`, { color: roofColor, roughness: 0.9 }), cx, h + 0.2, cz);
    col.addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, 0, h + 0.4, true);
    minimap.buildings.push([cx - w / 2, cz - d / 2, w, d]);
  };

  // ---------- الأرض والطرق ----------
  const asphalt = mat('asphalt', { map: asphaltTexture(), roughness: 0.95 });
  const ground = new THREE.Mesh(tiledBox(size, 0.2, size, 8), asphalt);
  ground.position.set(size / 2, -0.1, size / 2);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = mat('sand', { map: sandTexture(), roughness: 1 });
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(size * 6, size * 6).rotateX(-Math.PI / 2), sand);
  outer.position.set(size / 2, -0.25, size / 2);
  sand.map.repeat.set(size / 6, size / 6);
  group.add(outer);

  const lineMat = mat('road-line', { color: '#f2f0e6', roughness: 0.6 });
  const yellowMat = mat('road-yellow', { color: '#e0b43a', roughness: 0.6 });
  const step = BLOCK + ROAD;
  for (let k = 0; k <= B; k++) {
    const c = k * step + ROAD / 2;
    for (let s = 0; s < B; s++) {
      const a = s * step + ROAD;
      for (let t = 1.5; t < BLOCK - 1; t += 4) {
        boxMesh(new THREE.BoxGeometry(0.18, 0.02, 2), lineMat, c, 0.01, a + t + 1, false);
        boxMesh(new THREE.BoxGeometry(2, 0.02, 0.18), lineMat, a + t + 1, 0.01, c, false);
      }
      // ممرات المشاة عند التقاطعات
      for (let z = 0; z < 5; z++) {
        boxMesh(new THREE.BoxGeometry(ROAD - 2, 0.02, 0.5), lineMat, c, 0.012, a + 1 + z * 0.9 - 0.5 + 0.3, false);
        boxMesh(new THREE.BoxGeometry(0.5, 0.02, ROAD - 2), lineMat, a + 1 + z * 0.9 - 0.5 + 0.3, 0.012, c, false);
      }
    }
    boxMesh(new THREE.BoxGeometry(0.15, 0.021, size), yellowMat, c - ROAD / 2 + 0.6, 0.01, size / 2, false);
    boxMesh(new THREE.BoxGeometry(size, 0.021, 0.15), yellowMat, size / 2, 0.01, c - ROAD / 2 + 0.6, false);
  }

  // سور خارجي للمدينة
  const wallMat = mat('outer-wall', { map: villaTexture('#d8c4a0', 31), roughness: 0.9 });
  wallMat.userData.tile = 8;
  const WH = 3.2;
  [[size / 2, -0.5, size + 1, 1], [size / 2, size + 0.5, size + 1, 1], [-0.5, size / 2, 1, size + 1], [size + 0.5, size / 2, 1, size + 1]]
    .forEach(([x, z, w, d]) => {
      boxMesh(tiledBox(w, WH, d, 8), wallMat, x, WH / 2, z);
      col.addBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, 30, true);
    });

  // ---------- نقاط البداية والهروب ----------
  const corner = (i, j) => new THREE.Vector3(i * step + ROAD / 2, 0, j * step + ROAD / 2);
  const start = corner(0, 0).add(new THREE.Vector3(1.5, 0, 1.5));
  const exitCandidates = [corner(B, B), corner(B, Math.ceil(B / 2)), corner(Math.ceil(B / 2), B), corner(B, 1), corner(1, B)];
  const exits = exitCandidates.slice(0, level.exits);
  const nearAny = (x, z, pts, r) => pts.some((p) => Math.hypot(p.x - x, p.z - z) < r);

  // ---------- محتوى البلوكات ----------
  const sidewalk = mat('sidewalk', { map: sidewalkTexture(), roughness: 0.9 });
  const kerb = mat('kerb', { color: '#9c9486', roughness: 0.9 });
  const grass = mat('grass', { color: '#5f9446', roughness: 1 });
  const pickupSpots = [];
  const patrolPoints = [];
  const types = ['towers', 'villas', 'plaza', 'parking', 'mall'];

  for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
    const x0 = ROAD + i * step, z0 = ROAD + j * step;
    const cx = x0 + BLOCK / 2, cz = z0 + BLOCK / 2;
    boxMesh(tiledBox(BLOCK, 0.15, BLOCK, 4), sidewalk, cx, 0.075, cz, false);
    boxMesh(new THREE.BoxGeometry(BLOCK + 0.3, 0.12, BLOCK + 0.3), kerb, cx, 0.06, cz, false);
    const isStartBlock = i === 0 && j === 0;
    let type = isStartBlock ? 'plaza' : rng.pick(types);
    if (B <= 3 && type === 'towers' && rng() < 0.5) type = 'villas';

    // نقاط دوريات عند زوايا البلوك
    patrolPoints.push(new THREE.Vector3(x0 - ROAD / 2, 0, z0 - ROAD / 2));
    patrolPoints.push(new THREE.Vector3(cx, 0, z0 - 2.5));

    if (type === 'towers') {
      const style = rng.pick(TOWER_STYLES);
      const m = mat(`tower-${style.glass}`, { map: facadeTexture(style.base, style.glass, style.frame, i * 7 + j), roughness: 0.35, metalness: 0.35 });
      const two = rng() < 0.6;
      if (two) {
        const w = rng.range(9, 11);
        building(x0 + 2 + w / 2, z0 + 2 + w / 2, w, w, rng.range(18, 40), m, '#9a948a');
        building(x0 + BLOCK - 2 - w / 2, z0 + BLOCK - 2 - w / 2, w, w, rng.range(22, 48), m, '#9a948a');
        pickupSpots.push(new THREE.Vector3(x0 + BLOCK - 5, 0, z0 + 5));
        place(makePlanter(rng), x0 + 5, 0, z0 + BLOCK - 5);
        col.addBox(x0 + 4.2, z0 + BLOCK - 5.8, x0 + 5.8, z0 + BLOCK - 4.2, 0, 0.7, false);
      } else {
        const w = rng.range(13, 16);
        building(cx, cz, w, w, rng.range(30, 55), m, '#9a948a');
        for (const [px, pz] of [[x0 + 3, z0 + 3], [x0 + BLOCK - 3, z0 + BLOCK - 3]]) {
          place(makePalm(rng), px, 0.15, pz);
          col.addBox(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, 0, 6, false);
        }
        pickupSpots.push(new THREE.Vector3(x0 + 3, 0, z0 + BLOCK - 3));
      }
    } else if (type === 'villas') {
      const vc = rng.pick(VILLA_COLORS);
      const m = mat(`villa-${vc}`, { map: villaTexture(vc, i + j * 5), roughness: 0.85 });
      m.userData.tile = 6;
      const wm = mat(`vwall-${vc}`, { color: new THREE.Color(vc).offsetHSL(0, 0, -0.06), roughness: 0.9 });
      for (const [qx, qz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (rng() < 0.15) continue;
        const bx = x0 + 3.5 + qx * 14 + 3.5, bz = z0 + 3.5 + qz * 14 + 3.5;
        building(bx, bz, 7.5, 7.5, rng.range(5.5, 8), m, '#cdbb9a');
        // سور منخفض حول الفيلا مع فتحة (للاختباء والمراوغة)
        const hw = 6, wh = 2.1;
        const segs = [
          [bx - hw, bz - hw, bx + hw, bz - hw + 0.35],
          [bx - hw, bz + hw - 0.35, bx - 1.2, bz + hw],
          [bx + 1.2, bz + hw - 0.35, bx + hw, bz + hw],
          [bx - hw, bz - hw, bx - hw + 0.35, bz + hw],
          [bx + hw - 0.35, bz - hw, bx + hw, bz + 1],
        ];
        for (const [a, b, c2, d] of segs) {
          if (rng() < 0.2) continue;
          boxMesh(new THREE.BoxGeometry(c2 - a, wh, d - b), wm, (a + c2) / 2, wh / 2, (b + d) / 2);
          col.addBox(a, b, c2, d, 0, wh, true);
          minimap.props.push([a, b, c2 - a, d - b]);
        }
        if (rng() < 0.6) {
          place(makePalm(rng), bx + hw - 1.4, 0.15, bz + hw - 1.4);
          col.addBox(bx + hw - 1.7, bz + hw - 1.7, bx + hw - 1.1, bz + hw - 1.1, 0, 6, false);
        }
      }
      pickupSpots.push(new THREE.Vector3(cx, 0, cz));
      patrolPoints.push(new THREE.Vector3(cx, 0, cz));
    } else if (type === 'plaza') {
      boxMesh(new THREE.BoxGeometry(BLOCK - 6, 0.06, BLOCK - 6), grass, cx, 0.17, cz, false);
      if (!isStartBlock) {
        place(makeFountain(), cx, 0.15, cz);
        col.addBox(cx - 2.4, cz - 2.4, cx + 2.4, cz + 2.4, 0, 0.85, false);
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const px = cx + Math.cos(a) * 9.5, pz = cz + Math.sin(a) * 9.5;
        place(makePalm(rng), px, 0.15, pz);
        col.addBox(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, 0, 6, false);
      }
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const px = cx + Math.cos(a) * 5.5, pz = cz + Math.sin(a) * 5.5;
        const bench = makeBench();
        place(bench, px, 0.15, pz, -a + Math.PI / 2);
        col.addBox(px - 0.8, pz - 0.8, px + 0.8, pz + 0.8, 0, 0.55, false);
      }
      for (let k = 0; k < 4; k++) {
        const px = x0 + (k % 2 ? BLOCK - 2.5 : 2.5), pz = z0 + (k < 2 ? 2.5 : BLOCK - 2.5);
        if (isStartBlock && k === 0) continue;
        place(makePlanter(rng), px, 0.15, pz);
        col.addBox(px - 0.8, pz - 0.8, px + 0.8, pz + 0.8, 0, 0.85, false);
      }
      pickupSpots.push(new THREE.Vector3(cx + 6, 0, cz - 6));
      patrolPoints.push(new THREE.Vector3(cx, 0, cz + 7));
    } else if (type === 'parking') {
      const shade = makeShade(BLOCK - 8, 6);
      for (const r of [0, 1]) {
        const rz = z0 + 7 + r * 14;
        place(shade.clone(), cx, 0.15, rz);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const px = cx + sx * ((BLOCK - 8) / 2 - 0.3), pz = rz + sz * 2.7;
          col.addBox(px - 0.15, pz - 0.15, px + 0.15, pz + 0.15, 0, 3, false);
        }
        col.addBox(cx - (BLOCK - 8) / 2, rz - 3, cx + (BLOCK - 8) / 2, rz + 3, 2.95, 3.15, true);
        for (let k = 0; k < 6; k++) {
          if (rng() < 0.3) continue;
          const car = makeCar(rng);
          const px = x0 + 5 + k * 3.6, pz = rz;
          place(car.obj, px, 0.15, pz, rng() < 0.5 ? 0 : Math.PI);
          col.addBox(px - car.w / 2, pz - car.l / 2, px + car.w / 2, pz + car.l / 2, 0, car.h, true);
          minimap.props.push([px - car.w / 2, pz - car.l / 2, car.w, car.l]);
        }
      }
      pickupSpots.push(new THREE.Vector3(cx, 0, cz));
      patrolPoints.push(new THREE.Vector3(cx, 0, cz));
    } else {
      // مركز تسوق: مبنى عريض مع ممر جانبي
      const m = mat('mall', { map: facadeTexture('#efe7d6', '#4f8fa8', '#e2d8c2', 77), roughness: 0.4, metalness: 0.2 });
      const w = BLOCK - 6, d = 13;
      building(cx, z0 + 3 + d / 2, w, d, rng.range(10, 14), m, '#bfb6a4');
      const canopy = mat('canopy', { color: '#a0472c', roughness: 0.7 });
      boxMesh(new THREE.BoxGeometry(w * 0.6, 0.25, 3), canopy, cx, 3.6, z0 + 3 + d + 1.5);
      col.addBox(cx - w * 0.3, z0 + 3 + d, cx + w * 0.3, z0 + 3 + d + 3, 3.45, 3.75, true);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: labelTexture('سوق المدينة', '#a0472c'), transparent: true }));
      sign.position.set(cx, 6, z0 + 3 + d + 0.05);
      group.add(sign);
      for (let k = 0; k < 3; k++) {
        const px = x0 + 6 + k * 8, pz = z0 + BLOCK - 4;
        place(makePlanter(rng), px, 0.15, pz);
        col.addBox(px - 0.8, pz - 0.8, px + 0.8, pz + 0.8, 0, 0.85, false);
      }
      pickupSpots.push(new THREE.Vector3(x0 + 3, 0, z0 + BLOCK - 3));
      patrolPoints.push(new THREE.Vector3(cx, 0, z0 + BLOCK - 2));
    }

    // أعمدة إنارة عند زوايا البلوك
    for (const [px, pz, ry] of [[x0 + 0.6, z0 + 0.6, Math.PI * 1.25], [x0 + BLOCK - 0.6, z0 + BLOCK - 0.6, Math.PI * 0.25]]) {
      place(makeLamp(), px, 0.15, pz, ry);
      col.addBox(px - 0.12, pz - 0.12, px + 0.12, pz + 0.12, 0, 6, false);
    }
  }

  // ---------- سيارات متوقفة على جوانب الطرق ----------
  const avoid = [start, ...exits];
  let placed = 0, tries = 0;
  while (placed < level.cars && tries++ < level.cars * 8) {
    const horiz = rng() < 0.5;
    const k = rng.int(0, B);
    const s = rng.int(0, B - 1);
    const along = s * step + ROAD + rng.range(3, BLOCK - 3);
    const side = rng() < 0.5 ? -1 : 1;
    const across = k * step + ROAD / 2 + side * (ROAD / 2 - 1.4);
    const x = horiz ? along : across, z = horiz ? across : along;
    if (nearAny(x, z, avoid, 9)) continue;
    const car = makeCar(rng);
    const ry = horiz ? Math.PI / 2 : 0;
    const hw = horiz ? car.l / 2 : car.w / 2, hd = horiz ? car.w / 2 : car.l / 2;
    if (col.boxes.some((b) => x + hw > b.minX - 0.6 && x - hw < b.maxX + 0.6 && z + hd > b.minZ - 0.6 && z - hd < b.maxZ + 0.6)) continue;
    place(car.obj, x, 0, z, ry + (rng() < 0.5 ? Math.PI : 0));
    col.addBox(x - hw, z - hd, x + hw, z + hd, 0, car.h, true);
    minimap.props.push([x - hw, z - hd, hw * 2, hd * 2]);
    placed++;
  }

  // ---------- حواجز خرسانية للمراوغة (تترك فجوات دائمًا) ----------
  placed = 0; tries = 0;
  while (placed < level.barriers && tries++ < level.barriers * 10) {
    const horiz = rng() < 0.5;
    const k = rng.int(0, B);
    const s = rng.int(0, B - 1);
    const along = s * step + ROAD + rng.range(5, BLOCK - 5);
    const across = k * step + ROAD / 2 + rng.range(-1.8, 1.8);
    const x = horiz ? along : across, z = horiz ? across : along;
    if (nearAny(x, z, avoid, 10)) continue;
    // الحاجز متعامد مع الطريق
    const hw = horiz ? 0.35 : 1.7, hd = horiz ? 1.7 : 0.35;
    if (col.boxes.some((b) => x + hw > b.minX - 1.6 && x - hw < b.maxX + 1.6 && z + hd > b.minZ - 1.6 && z - hd < b.maxZ + 1.6)) continue;
    place(makeBarrier(), x, 0, z, horiz ? 0 : Math.PI / 2);
    col.addBox(x - hw, z - hd, x + hw, z + hd, 0, 0.85, false);
    minimap.props.push([x - hw, z - hd, hw * 2, hd * 2]);
    if (rng() < 0.6) place(makeCone(), x + (horiz ? 0.9 : 2.3), 0, z + (horiz ? 2.3 : 0.9));
    placed++;
  }

  // ---------- أفق المدينة البعيد (ديكور فقط بدون تصادم) ----------
  const far = mat('far-tower', { color: '#b8b2a8', roughness: 1, fog: true });
  for (let k = 0; k < 40; k++) {
    const a = rng() * Math.PI * 2, r = size * rng.range(0.85, 1.6);
    const h = rng.range(20, 90), w = rng.range(8, 18);
    boxMesh(new THREE.BoxGeometry(w, h, w), far, size / 2 + Math.cos(a) * r, h / 2 - 0.2, size / 2 + Math.sin(a) * r, false);
  }

  batch.build(group);

  // ---------- علامات الهروب (ديناميكية) ----------
  const exitMarkers = exits.map((p) => makeExitMarker(p));
  exitMarkers.forEach((m) => group.add(m));

  const chaserSpawns = patrolPoints.filter((p) => p.distanceTo(start) > 30);
  return { group, collision: col, size, start, exits, exitMarkers, pickupSpots, patrolPoints, chaserSpawns, minimap };
}

function makeExitMarker(p) {
  const g = new THREE.Group();
  g.position.copy(p);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#2cff9a', transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.position.y = 0.05;
  g.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 40, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: '#2cff9a', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = 20;
  g.add(beam);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture('نقطة الهروب'), depthTest: true }));
  sign.scale.set(6, 6, 1);
  sign.position.y = 5;
  g.add(sign);
  g.userData = { ring, beam, sign };
  return g;
}
