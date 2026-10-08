// يبني ملعب كرة قدم خياليًا: أرض الملعب، مضمار، مدرجات بجمهور يشجّع، أنفاق عبر المدرجات،
// وممشى خارجي (كونكورس) بأكشاك وأعمدة وحواجز، والهروب من بوابات السور الخارجي.
import * as THREE from 'three';
import { CollisionWorld } from '../core/Collision.js';
import { makeRng } from '../core/Random.js';
import { StaticBatcher, tiledBox } from './Geometry.js';
import {
  sidewalkTexture, sandTexture, villaTexture, grassTexture, trackTexture, uaeFlagTexture,
  adBoardTexture, scoreboardTexture, labelTexture,
} from './Textures.js';
import { mat, makeBarrier, makePlanter, makePalm, makeBench, makeCone } from './Props.js';
import { makeExitMarker } from './MapBuilder.js';

const ADS = [
  ['كأس الصيف', '#0b5d3b', '#ffffff'],
  ['مرحبًا بكم', '#b3242c', '#ffffff'],
  ['شجّع فريقك', '#10283a', '#f2c14e'],
  ['اللعب النظيف', '#ffffff', '#0b5d3b'],
  ['ماء بارد', '#1676b3', '#ffffff'],
];
// ألوان مقاعد المدرجات من الأسفل للأعلى: أحمر، أخضر، أبيض، أسود
const SEAT_BANDS = ['#c8323a', '#0f7a43', '#ecebe6', '#2a2a2a'];
const TIER_DEPTH = 1.0, TIER_RISE = 0.5, TIER_BASE = 1.1;

export function buildStadium(level) {
  const rng = makeRng(level.seed * 7919);
  const st = level.stadium;
  const [PL, PW] = st.pitch;
  const TR = st.track, D = st.stand, C = st.concourse;
  const ax = PL / 2 + TR, az = PW / 2 + TR; // الحافة الداخلية للمدرجات
  const bx = ax + D, bz = az + D;           // الحافة الخارجية للمدرجات
  const size = Math.ceil(2 * (Math.max(bx, bz) + C));
  const cx = size / 2, cz = size / 2;
  const nTiers = Math.floor(D / TIER_DEPTH) - 1;
  const standTop = TIER_BASE + (nTiers - 1) * TIER_RISE;
  const wallTop = standTop + 2.4;

  const group = new THREE.Group();
  const col = new CollisionWorld();
  const batch = new StaticBatcher();
  const minimap = { size, buildings: [], props: [], pitch: [cx - PL / 2, cz - PW / 2, PL, PW] };
  const M4 = new THREE.Matrix4();
  const tmp = new THREE.Object3D();

  const place = (obj, x, y, z, ry = 0, castShadow = true) => {
    obj.position.set(x, y, z); obj.rotation.y = ry;
    batch.addObject(obj, castShadow);
  };
  const box = (geo, material, x, y, z, castShadow = true, ry = 0) => {
    tmp.position.set(x, y, z); tmp.rotation.set(0, ry, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
    batch.add(geo, material, M4.copy(tmp.matrix), castShadow, true);
  };
  /** صندوق مرئي + تصادم بإحداثيات الحدود. */
  const solid = (minX, minZ, maxX, maxZ, y0, y1, material, opts = {}) => {
    const w = maxX - minX, d = maxZ - minZ, h = y1 - y0;
    box(opts.tile ? tiledBox(w, h, d, opts.tile) : new THREE.BoxGeometry(w, h, d), material, (minX + maxX) / 2, (y0 + y1) / 2, (minZ + maxZ) / 2, opts.shadow !== false);
    if (opts.collide !== false) col.addBox(minX, minZ, maxX, maxZ, y0, y1, opts.view !== false);
  };

  // ---------- الأرض ----------
  const paving = mat('st-paving', { map: sidewalkTexture(), roughness: 0.9 });
  const ground = new THREE.Mesh(tiledBox(size, 0.2, size, 4), paving);
  ground.position.set(cx, -0.1, cz); ground.receiveShadow = true;
  group.add(ground);
  const sand = mat('sand', { map: sandTexture(), roughness: 1 });
  sand.map.repeat.set(size / 6, size / 6);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(size * 6, size * 6).rotateX(-Math.PI / 2), sand);
  outer.position.set(cx, -0.25, cz);
  group.add(outer);

  const track = mat('st-track', { map: trackTexture(), roughness: 0.95 });
  box(tiledBox(2 * ax, 0.02, 2 * az, 6), track, cx, 0.01, cz, false);
  const grass = mat('st-grass', { map: grassTexture(), roughness: 0.95 });
  box(tiledBox(PL + 6, 0.03, PW + 6, 12), grass, cx, 0.02, cz, false);

  // خطوط الملعب
  const white = mat('st-line', { color: '#f4f4ee', roughness: 0.6 });
  const line = (x0, z0, x1, z1) => {
    const w = Math.max(0.12, Math.abs(x1 - x0)), d = Math.max(0.12, Math.abs(z1 - z0));
    box(new THREE.BoxGeometry(w, 0.02, d), white, (x0 + x1) / 2, 0.045, (z0 + z1) / 2, false);
  };
  const hx = PL / 2, hz = PW / 2;
  line(cx - hx, cz - hz, cx + hx, cz - hz); line(cx - hx, cz + hz, cx + hx, cz + hz);
  line(cx - hx, cz - hz, cx - hx, cz + hz); line(cx + hx, cz - hz, cx + hx, cz + hz);
  line(cx, cz - hz, cx, cz + hz);
  const ring = new THREE.Mesh(new THREE.RingGeometry(Math.min(9.15, PW * 0.18) - 0.12, Math.min(9.15, PW * 0.18), 48).rotateX(-Math.PI / 2), white);
  ring.position.set(cx, 0.046, cz); group.add(ring);
  for (const s of [-1, 1]) {
    const gx = cx + s * hx;
    const bw = Math.min(40, PW * 0.62) / 2, bd = Math.min(16.5, PL * 0.2);
    line(gx, cz - bw, gx - s * bd, cz - bw); line(gx, cz + bw, gx - s * bd, cz + bw); line(gx - s * bd, cz - bw, gx - s * bd, cz + bw);
    const sw = 9.2, sd = 5.5;
    line(gx, cz - sw, gx - s * sd, cz - sw); line(gx, cz + sw, gx - s * sd, cz + sw); line(gx - s * sd, cz - sw, gx - s * sd, cz + sw);
    // المرمى: قائمان وعارضة وشبكة
    const post = mat('st-post', { color: '#ffffff', roughness: 0.3 });
    const net = mat('st-net', { color: '#ffffff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    for (const pz of [cz - 3.66, cz + 3.66]) solid(gx - 0.08, pz - 0.08, gx + 0.08, pz + 0.08, 0, 2.44, post, { view: false });
    box(new THREE.BoxGeometry(0.16, 0.16, 7.48), post, gx, 2.44, cz);
    const nx = gx + s * 2; // الشبكة الخلفية خلف خط المرمى
    solid(nx - 0.05, cz - 3.66, nx + 0.05, cz + 3.66, 0, 2.44, net, { view: false, shadow: false });
    for (const pz of [cz - 3.66, cz + 3.66]) solid(Math.min(gx, nx), pz - 0.03, Math.max(gx, nx), pz + 0.03, 0, 2.44, net, { view: false, shadow: false });
  }

  // ---------- لوحات الإعلانات حول الملعب (يمكن القفز فوقها) ----------
  const adOff = 3.2;
  const boardsAlong = (horizontal, fixed, from, to) => {
    for (let a = from; a < to - 4; a += 13) {
      const len = Math.min(10, to - a - 3);
      const [text, bg, fg] = ADS[Math.floor(rng() * ADS.length)];
      const m = mat(`ad-${text}`, { map: adBoardTexture(text, bg, fg), roughness: 0.6, emissive: '#ffffff', emissiveMap: adBoardTexture(text, bg, fg), emissiveIntensity: 0.25 });
      if (horizontal) solid(a, fixed - 0.12, a + len, fixed + 0.12, 0, 0.9, m, { view: false });
      else solid(fixed - 0.12, a, fixed + 0.12, a + len, 0, 0.9, m, { view: false });
      minimap.props.push(horizontal ? [a, fixed - 0.2, len, 0.4] : [fixed - 0.2, a, 0.4, len]);
    }
  };
  boardsAlong(true, cz - hz - adOff, cx - hx - adOff + 2, cx + hx + adOff);
  boardsAlong(true, cz + hz + adOff, cx - hx - adOff + 2, cx + hx + adOff);
  boardsAlong(false, cx - hx - adOff, cz - hz - adOff + 2, cz + hz + adOff);
  boardsAlong(false, cx + hx + adOff, cz - hz - adOff + 2, cz + hz + adOff);

  // ---------- المدرجات ----------
  const concrete = mat('st-concrete', { color: '#cfc9bd', roughness: 0.95 });
  const backWall = mat('st-backwall', { map: villaTexture('#e9e3d6', 51), roughness: 0.9 });
  backWall.userData.tile = 8;
  const roofMat = mat('st-roof', { color: '#f2f2f2', roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
  const seatMats = SEAT_BANDS.map((c) => mat(`seat-${c}`, { color: c, roughness: 0.7 }));
  const crowd = [];
  const flags = [];
  const tunnels = [];

  // يعيد حدود مستطيل لجهة معينة: a على طول الجهة، o بالعمق من الحافة الداخلية للخارج
  const rectFor = (side, a0, a1, o0, o1) => {
    switch (side) {
      case 'N': return [a0, cz - az - o1, a1, cz - az - o0];
      case 'S': return [a0, cz + az + o0, a1, cz + az + o1];
      case 'W': return [cx - ax - o1, a0, cx - ax - o0, a1];
      default: return [cx + ax + o0, a0, cx + ax + o1, a1];
    }
  };
  const facing = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }; // اتجاه الجمهور نحو الملعب

  const standPiece = (side, a0, a1) => {
    if (a1 - a0 < 1) return;
    for (let k = 0; k < nTiers; k++) {
      const h = TIER_BASE + k * TIER_RISE;
      const [x0, z0, x1, z1] = rectFor(side, a0, a1, k * TIER_DEPTH, (k + 1) * TIER_DEPTH);
      solid(x0, z0, x1, z1, 0, h, concrete, { collide: false, shadow: k % 3 === 0 });
      const [sx0, sz0, sx1, sz1] = rectFor(side, a0, a1, k * TIER_DEPTH + 0.45, k * TIER_DEPTH + 0.8);
      solid(sx0, sz0, sx1, sz1, h, h + 0.35, seatMats[Math.min(3, Math.floor((k / nTiers) * 4))], { collide: false, shadow: false });
      // الجمهور على صف واحد من كل صفّين
      if (k % 2 === 0) {
        for (let a = a0 + 0.6; a < a1 - 0.4; a += 1.25) {
          if (rng() > 0.68) continue;
          const [fx0, fz0, fx1, fz1] = rectFor(side, a, a, k * TIER_DEPTH + 0.35, k * TIER_DEPTH + 0.35);
          crowd.push({ x: (fx0 + fx1) / 2, y: h, z: (fz0 + fz1) / 2, ry: facing[side] + (rng() - 0.5) * 0.4, p: rng() * 6.28 });
          if (rng() < 0.035) flags.push({ x: (fx0 + fx1) / 2, y: h + 1.4, z: (fz0 + fz1) / 2, ry: facing[side], p: rng() * 6.28 });
        }
      }
    }
    // الجدار الخلفي والسقف
    const [wx0, wz0, wx1, wz1] = rectFor(side, a0, a1, D - 0.6, D);
    solid(wx0, wz0, wx1, wz1, 0, wallTop, backWall, { tile: 8, collide: false });
    const [rx0, rz0, rx1, rz1] = rectFor(side, a0, a1, D * 0.3, D + 0.6);
    solid(rx0, rz0, rx1, rz1, wallTop + 3.2, wallTop + 3.5, roofMat, { collide: false });
    // تصادم واحد يغطي القطعة كلها
    const [cx0, cz0, cx1, cz1] = rectFor(side, a0, a1, 0, D);
    col.addBox(cx0, cz0, cx1, cz1, 0, wallTop, true);
    minimap.buildings.push([cx0, cz0, cx1 - cx0, cz1 - cz0]);
  };

  // تقسيم كل جهة إلى قطع بينها أنفاق
  const TW = 5; // عرض النفق
  const sides = [
    { side: 'N', from: cx - bx, to: cx + bx, center: cx, half: PL, n: st.tunnels[0] },
    { side: 'S', from: cx - bx, to: cx + bx, center: cx, half: PL, n: st.tunnels[0] },
    { side: 'W', from: cz - az, to: cz + az, center: cz, half: PW, n: st.tunnels[1] },
    { side: 'E', from: cz - az, to: cz + az, center: cz, half: PW, n: st.tunnels[1] },
  ];
  let gateNo = 1;
  for (const s of sides) {
    const gaps = [];
    for (let i = 0; i < s.n; i++) gaps.push(s.center + ((i + 1) / (s.n + 1) - 0.5) * s.half);
    let a = s.from;
    for (const g of gaps) {
      standPiece(s.side, a, g - TW / 2);
      a = g + TW / 2;
      // سقف النفق: يمر الجميع تحته
      const [tx0, tz0, tx1, tz1] = rectFor(s.side, g - TW / 2, g + TW / 2, 0, D);
      solid(tx0, tz0, tx1, tz1, 3.3, wallTop, backWall, { tile: 8 });
      const [ix0, iz0, ix1, iz1] = rectFor(s.side, g, g, -1.5, -1.5);
      const [ox0, oz0, ox1, oz1] = rectFor(s.side, g, g, D + 2, D + 2);
      tunnels.push({ inner: new THREE.Vector3(ix0, 0, iz0), outer: new THREE.Vector3(ox0, 0, oz0) });
      // لافتة رقم البوابة فوق مدخل النفق من جهة الملعب
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: labelTexture(`نفق ${gateNo++}`, '#10283a'), transparent: true }));
      const [lx0, lz0] = rectFor(s.side, g, g, -0.05, -0.05);
      sign.position.set(lx0, 3.9, lz0);
      sign.rotation.y = facing[s.side];
      group.add(sign);
    }
    standPiece(s.side, a, s.to);
  }

  // ---------- الجمهور (Instanced: كندورة + رأس + غترة) ----------
  const crowdMeshes = [];
  if (crowd.length) {
    const bodyGeo = new THREE.CylinderGeometry(0.19, 0.25, 0.95, 6).translate(0, 0.47, 0);
    const headGeo = new THREE.SphereGeometry(0.13, 6, 5).translate(0, 1.07, 0);
    const clothGeo = new THREE.CylinderGeometry(0.15, 0.22, 0.34, 7, 1, true, Math.PI * 0.3, Math.PI * 1.4).translate(0, 1.0, -0.01);
    const capGeo = new THREE.SphereGeometry(0.145, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 1.08, 0);
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const body = new THREE.InstancedMesh(bodyGeo, lam('#ffffff'), crowd.length);
    const head = new THREE.InstancedMesh(headGeo, lam('#ffffff'), crowd.length);
    const cloth = new THREE.InstancedMesh(clothGeo, new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide }), crowd.length);
    const cap = new THREE.InstancedMesh(capGeo, lam('#ffffff'), crowd.length);
    const shirts = ['#f6f6f2', '#f6f6f2', '#f6f6f2', '#ebe4d4', '#c8323a', '#0f7a43', '#f6f6f2', '#2a2a2a'];
    const skins = ['#c48a5c', '#b07a50', '#d19a6c', '#9c6a44'];
    const c = new THREE.Color();
    crowd.forEach((f, i) => {
      tmp.position.set(f.x, f.y, f.z); tmp.rotation.set(0, f.ry, 0);
      const s = 0.92 + rng() * 0.16; tmp.scale.set(s, s, s); tmp.updateMatrix();
      body.setMatrixAt(i, tmp.matrix);
      body.setColorAt(i, c.set(shirts[Math.floor(rng() * shirts.length)]));
      head.setColorAt(i, c.set(skins[Math.floor(rng() * skins.length)]));
      const red = rng() < 0.25;
      cloth.setColorAt(i, c.set(red ? '#d9a3a3' : '#fbfbf8'));
      cap.setColorAt(i, c.set(red ? '#d9a3a3' : '#fbfbf8'));
    });
    // كل الأجزاء تشترك في نفس مصفوفات المواقع حتى تتحرك معًا بتحديث واحد
    for (const m of [head, cloth, cap]) m.instanceMatrix = body.instanceMatrix;
    for (const m of [body, head, cloth, cap]) {
      m.frustumCulled = false; m.receiveShadow = true; m.castShadow = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(m);
      crowdMeshes.push(m);
    }
  }
  // أعلام يلوّح بها الجمهور
  let flagMesh = null;
  if (flags.length) {
    const fg = new THREE.PlaneGeometry(1.1, 1.1).translate(0.55, 0, 0);
    flagMesh = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ map: uaeFlagTexture(), transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }), flags.length);
    flagMesh.frustumCulled = false;
    flagMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(flagMesh);
  }

  // أعلام كبيرة على الجدران الخلفية
  const bigFlag = new THREE.MeshLambertMaterial({ map: uaeFlagTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  for (const [x, z, ry] of [[cx - bx * 0.5, cz - bz + 0.7, 0], [cx + bx * 0.5, cz - bz + 0.7, 0], [cx - bx * 0.5, cz + bz - 0.7, Math.PI], [cx + bx * 0.5, cz + bz - 0.7, Math.PI]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), bigFlag);
    f.position.set(x, standTop + 1.0, z); f.rotation.y = ry;
    group.add(f);
  }

  // شاشة النتائج فوق المدرج الشرقي
  const sbMat = new THREE.MeshBasicMaterial({ map: scoreboardTexture() });
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), sbMat);
  sb.scale.y = 0.45;
  sb.position.set(cx + bx - 0.8, wallTop + 4.2 + 3.6, cz);
  sb.rotation.y = -Math.PI / 2;
  group.add(sb);
  box(new THREE.BoxGeometry(0.8, 8, 17), mat('st-sbframe', { color: '#4a525c', roughness: 0.6 }), cx + bx - 0.35, wallTop + 4.2 + 3.6, cz);

  // أبراج الإضاءة في الزوايا
  const pole = mat('st-flood-pole', { color: '#8a8f98', metalness: 0.5, roughness: 0.4 });
  const lamp = mat('st-flood-lamp', { color: '#ffffff', emissive: '#fff4d6', emissiveIntensity: 1.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = cx + sx * (bx + 2.5), pz = cz + sz * (bz + 2.5);
    solid(px - 0.5, pz - 0.5, px + 0.5, pz + 0.5, 0, 30, pole);
    box(new THREE.BoxGeometry(6, 3.5, 0.6), lamp, px, 30, pz, false, Math.atan2(cx - px, cz - pz));
  }

  // ---------- دكة البدلاء قرب نقطة البداية ----------
  const dug = mat('st-dugout', { color: '#1d4e7a', roughness: 0.6 });
  const glass = mat('st-dugout-glass', { color: '#bfe3ff', transparent: true, opacity: 0.35, roughness: 0.1 });
  for (const s of [-1, 1]) {
    const dx = cx + s * 10, dz = cz + hz + adOff + 1.6;
    solid(dx - 4, dz + 1.1, dx + 4, dz + 1.3, 0, 2.2, dug);
    box(new THREE.BoxGeometry(8, 0.1, 2.4), glass, dx, 2.25, dz + 0.1, false);
    place(makeBench(), dx, 0, dz + 0.5, Math.PI);
    col.addBox(dx - 1.1, dz, dx + 1.1, dz + 0.9, 0, 0.55, false);
  }

  // ---------- السور الخارجي ----------
  const outerWall = mat('st-outer', { map: villaTexture('#d8c4a0', 33), roughness: 0.9 });
  outerWall.userData.tile = 8;
  const OW = 6;
  for (const [x0, z0, x1, z1] of [[-1, -1, size + 1, 0], [-1, size, size + 1, size + 1], [-1, 0, 0, size], [size, 0, size + 1, size]]) {
    solid(x0, z0, x1, z1, 0, OW, outerWall, { tile: 8 });
    col.boxes[col.boxes.length - 1].maxY = 40;
  }

  // ---------- البداية والمخارج ----------
  const Cz = cz - bz; // عرض الممشى من الجهة الشمالية/الجنوبية
  // البداية في الممشى الجنوبي الغربي، والمخرج الرئيسي في الشمال الشرقي (قطريًا) — لا يوجد خط مستقيم بينهما
  const start = new THREE.Vector3(cx - bx * 0.55, 0, size - Cz / 2);
  const exitList = [
    new THREE.Vector3(cx + bx * 0.55, 0, 3.2),
    new THREE.Vector3(size - 3.2, 0, cz - az * 0.75),
    new THREE.Vector3(cx - bx * 0.6, 0, 3.2),
  ];
  const exits = exitList.slice(0, level.exits);
  // بوابة (قوس) خلف كل مخرج على السور
  const gateMat = mat('st-gate', { color: '#0b5d3b', roughness: 0.6 });
  for (const e of exits) {
    const onNorth = e.z < 6;
    const ry = onNorth ? 0 : Math.PI / 2;
    const gx = onNorth ? e.x : (e.x > cx ? size - 0.3 : 0.3), gz = onNorth ? 0.3 : e.z;
    const g = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.5, 0.8), gateMat); p1.position.set(-3.5, 3.75, 0); g.add(p1);
    const p2 = p1.clone(); p2.position.x = 3.5; g.add(p2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 0.9), gateMat); top.position.set(0, 7.4, 0); g.add(top);
    place(g, gx, 0, gz, ry);
  }

  // ---------- الممشى الخارجي: أعمدة، أكشاك، حواجز، مجموعات مشجعين ----------
  const avoid = [start, ...exits, ...tunnels.map((t) => t.outer)];
  const nearAny = (x, z, r) => avoid.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  const free = (x0, z0, x1, z1, pad) => !col.boxes.some((b) => x1 > b.minX - pad && x0 < b.maxX + pad && z1 > b.minZ - pad && z0 < b.maxZ + pad);

  // أعمدة إنشائية خلف المدرجات (اختباء وحجب رؤية)
  const pillar = mat('st-pillar', { color: '#bdb6a8', roughness: 0.9 });
  const ringPts = (off, step) => {
    const pts = [];
    const X = bx + off, Z = bz + off;
    for (let x = -X; x <= X; x += step) { pts.push([cx + x, cz - Z]); pts.push([cx + x, cz + Z]); }
    for (let z = -Z + step; z < Z; z += step) { pts.push([cx - X, cz + z]); pts.push([cx + X, cz + z]); }
    return pts;
  };
  for (const [px, pz] of ringPts(2.2, 12)) {
    if (nearAny(px, pz, 4) || !free(px - 0.6, pz - 0.6, px + 0.6, pz + 0.6, 0.8)) continue;
    solid(px - 0.6, pz - 0.6, px + 0.6, pz + 0.6, 0, wallTop + 3.3, pillar);
    minimap.props.push([px - 0.6, pz - 0.6, 1.2, 1.2]);
  }

  // أكشاك الطعام والمشروبات
  const kioskColors = ['#c8323a', '#0f7a43', '#1676b3', '#e0702a'];
  const kioskNames = ['شاي كرك', 'عصائر', 'ماء بارد', 'فلافل'];
  const pickupSpots = [];
  let kiosks = 0, tries = 0;
  const kioskRing = ringPts(C * 0.62, 9).sort(() => rng() - 0.5);
  for (const [kx, kz] of kioskRing) {
    if (kiosks >= st.kiosks || tries++ > 200) break;
    if (nearAny(kx, kz, 7) || !free(kx - 1.8, kz - 1.8, kx + 1.8, kz + 1.8, 1.5)) continue;
    const i = kiosks % 4;
    const km = mat(`kiosk-${i}`, { color: kioskColors[i], roughness: 0.7 });
    solid(kx - 1.6, kz - 1.2, kx + 1.6, kz + 1.2, 0, 2.6, km);
    box(new THREE.BoxGeometry(3.8, 0.15, 3.2), mat('kiosk-roof', { color: '#f2efe6' }), kx, 2.7, kz);
    const lbl = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(kioskNames[i], kioskColors[i]) }));
    lbl.scale.set(4, 4, 1); lbl.position.set(kx, 3.6, kz);
    group.add(lbl);
    minimap.props.push([kx - 1.6, kz - 1.2, 3.2, 2.4]);
    // صندوق قوارير بجانب الكشك
    pickupSpots.push(new THREE.Vector3(kx + (kx < cx ? 2.8 : -2.8), 0, kz));
    kiosks++;
  }

  // مجموعات مشجعين واقفين في الممشى (عائق ومكان اختباء)
  const groupCrowd = [];
  let groups = 0; tries = 0;
  const groupRing = ringPts(C * 0.35, 7).sort(() => rng() - 0.5);
  for (const [gx, gz] of groupRing) {
    if (groups >= st.fanGroups || tries++ > 200) break;
    if (nearAny(gx, gz, 8) || !free(gx - 1.2, gz - 1.2, gx + 1.2, gz + 1.2, 2)) continue;
    for (let k = 0; k < 4; k++) groupCrowd.push({ x: gx + (k % 2 ? 0.5 : -0.5), y: 0, z: gz + (k < 2 ? 0.5 : -0.5), ry: rng() * 6.28, p: rng() * 6.28 });
    col.addBox(gx - 1.1, gz - 1.1, gx + 1.1, gz + 1.1, 0, 1.9, true);
    minimap.props.push([gx - 1.1, gz - 1.1, 2.2, 2.2]);
    groups++;
  }
  if (groupCrowd.length && crowdMeshes.length) {
    // نعيد استخدام نفس أشكال الجمهور لمجموعة ثانية ثابتة
    const [body, head, cloth, cap] = crowdMeshes;
    const n = groupCrowd.length;
    const extra = [body, head, cloth, cap].map((m) => new THREE.InstancedMesh(m.geometry, m.material, n));
    const c = new THREE.Color();
    groupCrowd.forEach((f, i) => {
      tmp.position.set(f.x, 0, f.z); tmp.rotation.set(0, f.ry, 0); tmp.scale.set(1.25, 1.55, 1.25); tmp.updateMatrix();
      extra[0].setMatrixAt(i, tmp.matrix);
      extra[0].setColorAt(i, c.set(rng() < 0.75 ? '#f6f6f2' : '#ebe4d4'));
      extra[1].setColorAt(i, c.set('#c48a5c'));
      extra[2].setColorAt(i, c.set('#fbfbf8'));
      extra[3].setColorAt(i, c.set('#fbfbf8'));
    });
    for (const m of extra.slice(1)) m.instanceMatrix = extra[0].instanceMatrix;
    extra.forEach((m) => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
  }

  // حواجز تنظيم الجماهير (يقفز فوقها اللاعب، والمطاردون يلتفون حولها)
  let placed = 0; tries = 0;
  while (placed < level.barriers && tries++ < level.barriers * 20) {
    const pts = ringPts(rng.range(2, C - 3), 5);
    const [x, z] = pts[Math.floor(rng() * pts.length)];
    const alongX = Math.abs(z - cz) > bz; // على الجهة الشمالية/الجنوبية الحاجز متعامد مع الممر
    const hw = alongX ? 0.35 : 1.7, hd = alongX ? 1.7 : 0.35;
    if (nearAny(x, z, 6) || !free(x - hw, z - hd, x + hw, z + hd, 1.8)) continue;
    place(makeBarrier(), x, 0, z, alongX ? 0 : Math.PI / 2);
    col.addBox(x - hw, z - hd, x + hw, z + hd, 0, 0.85, false);
    minimap.props.push([x - hw, z - hd, hw * 2, hd * 2]);
    if (rng() < 0.4) place(makeCone(), x + (alongX ? 0.9 : 2.3), 0, z + (alongX ? 2.3 : 0.9));
    placed++;
  }

  // نخيل وأحواض زرع قرب البوابات
  for (const e of exits) {
    for (const s of [-1, 1]) {
      const onNorth = e.z < 6;
      const px = onNorth ? e.x + s * 6 : e.x + (e.x < cx ? 2 : -2), pz = onNorth ? 2.5 : e.z + s * 6;
      if (px < 2 || px > size - 2 || !free(px - 0.8, pz - 0.8, px + 0.8, pz + 0.8, 0.5)) continue;
      place(makePlanter(rng), px, 0, pz);
      col.addBox(px - 0.8, pz - 0.8, px + 0.8, pz + 0.8, 0, 0.85, false);
    }
  }
  for (const [px, pz] of [[start.x - 7, start.z + 3], [start.x + 6, start.z + 3]]) {
    if (!free(px - 0.4, pz - 0.4, px + 0.4, pz + 0.4, 0.5)) continue;
    place(makePalm(rng), px, 0, pz);
    col.addBox(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, 0, 6, false);
  }

  // أفق المدينة البعيد خارج الملعب
  const far = mat('far-tower', { color: '#b8b2a8', roughness: 1 });
  for (let k = 0; k < 36; k++) {
    const a = rng() * Math.PI * 2, r = size * rng.range(0.9, 1.7);
    const h = rng.range(20, 90), w = rng.range(8, 18);
    box(new THREE.BoxGeometry(w, h, w), far, cx + Math.cos(a) * r, h / 2 - 0.2, cz + Math.sin(a) * r, false);
  }

  batch.build(group);
  const exitMarkers = exits.map((p) => makeExitMarker(p));
  exitMarkers.forEach((m) => group.add(m));

  // ---------- نقاط الدوريات وصناديق القوارير ----------
  const patrolPoints = [];
  const conc = ringPts(C * 0.5, 14);
  for (const [x, z] of conc) patrolPoints.push(new THREE.Vector3(x, 0, z));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) patrolPoints.push(new THREE.Vector3(cx + x * (hx + 1.5), 0, cz + z * (hz + 1.5)));
  patrolPoints.push(new THREE.Vector3(cx, 0, cz));
  for (const t of tunnels) patrolPoints.push(t.inner.clone(), t.outer.clone());

  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pickupSpots.push(new THREE.Vector3(cx + x * (ax - 1.5), 0, cz + z * (az - 1.5)));
  pickupSpots.push(new THREE.Vector3(cx, 0, cz + 6));

  const chaserSpawns = patrolPoints.filter((p) => p.distanceTo(start) > 30);

  // ---------- تحريك الجمهور (تشجيع) ----------
  const crowdArr = crowdMeshes[0]?.instanceMatrix.array;
  let frame = 0;
  const update = (t, excite = 0.3) => {
    if (!crowdArr || (frame++ & 1)) return;
    const amp = 0.08 + excite * 0.22;
    for (let i = 0; i < crowd.length; i++) {
      const f = crowd[i];
      crowdArr[i * 16 + 13] = f.y + Math.max(0, Math.sin(t * (5 + excite * 4) + f.p)) * amp;
    }
    crowdMeshes[0].instanceMatrix.needsUpdate = true;
    if (flagMesh) {
      flags.forEach((f, i) => {
        tmp.position.set(f.x, f.y + Math.max(0, Math.sin(t * 5 + f.p)) * amp, f.z);
        tmp.rotation.set(0, f.ry + Math.sin(t * 3 + f.p) * 0.6, Math.sin(t * 4 + f.p) * 0.15);
        tmp.scale.set(1, 1, 1); tmp.updateMatrix();
        flagMesh.setMatrixAt(i, tmp.matrix);
      });
      flagMesh.instanceMatrix.needsUpdate = true;
    }
  };

  const groundAt = (x, z) => (Math.abs(x - cx) < PL / 2 + 3 && Math.abs(z - cz) < PW / 2 + 3 ? 0.04 : 0.01);

  return {
    group, collision: col, size, start, exits, exitMarkers, pickupSpots, patrolPoints, chaserSpawns, minimap,
    update, groundAt, startFacing: Math.PI, crowdCount: crowd.length,
  };
}
