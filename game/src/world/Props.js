// نماذج العناصر الحضرية: سيارات، نخيل، حواجز، أعمدة إنارة، مقاعد...
import * as THREE from 'three';

const mats = {};
export function mat(key, params) {
  if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial(params);
  return mats[key];
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  wheel: new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12).rotateZ(Math.PI / 2),
  trunk: new THREE.CylinderGeometry(0.16, 0.26, 1, 7),
  frond: new THREE.ConeGeometry(0.35, 2.6, 4).rotateX(Math.PI / 2).translate(0, 0, 1.3),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
};

function part(geo, material, sx, sy, sz, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const CAR_COLORS = ['#f2f2f0', '#c9ccd1', '#1d1f24', '#9b1c22', '#1e4b8f', '#d6c6a3', '#f2f2f0', '#5a5f66'];

/** سيارة متوقفة (سيدان أو دفع رباعي). الطول على محور Z. */
export function makeCar(rng) {
  const g = new THREE.Group();
  const suv = rng() < 0.4;
  const color = rng.pick(CAR_COLORS);
  const body = mat(`car-${color}`, { color, metalness: 0.55, roughness: 0.35 });
  const glass = mat('car-glass', { color: '#1a2633', metalness: 0.8, roughness: 0.15 });
  const dark = mat('car-dark', { color: '#151515', roughness: 0.9 });
  const light = mat('car-light', { color: '#fff4d0', emissive: '#ffd27a', emissiveIntensity: 0.4 });
  const L = suv ? 4.8 : 4.5, W = 1.9;
  part(G.box, body, W, suv ? 0.85 : 0.7, L, 0, suv ? 0.75 : 0.65, 0, g);
  part(G.box, body, W * 0.92, suv ? 0.75 : 0.55, L * (suv ? 0.72 : 0.5), 0, suv ? 1.5 : 1.25, suv ? -0.2 : -0.15, g);
  part(G.box, glass, W * 0.94, suv ? 0.55 : 0.42, L * (suv ? 0.7 : 0.48), 0, suv ? 1.52 : 1.26, suv ? -0.2 : -0.15, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(G.wheel, dark);
    w.position.set(sx * W * 0.47, 0.36, sz * L * 0.32);
    w.castShadow = true;
    g.add(w);
  }
  part(G.box, light, 0.4, 0.14, 0.05, -0.6, 0.75, L / 2, g);
  part(G.box, light, 0.4, 0.14, 0.05, 0.6, 0.75, L / 2, g);
  return { obj: g, w: W, l: L, h: suv ? 1.9 : 1.55 };
}

/** نخلة. */
export function makePalm(rng) {
  const g = new THREE.Group();
  const h = rng.range(4.5, 7);
  const trunk = mat('palm-trunk', { color: '#7a5a3a', roughness: 1 });
  const leaf = mat('palm-leaf', { color: '#3f7a3a', roughness: 0.8, side: THREE.DoubleSide });
  const lean = rng.range(-0.08, 0.08);
  part(G.trunk, trunk, 1, h, 1, 0, h / 2, 0, g).rotation.z = lean;
  const top = new THREE.Group();
  top.position.set(-Math.sin(lean) * h, h, 0);
  g.add(top);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(G.frond, leaf);
    f.scale.set(1, 0.25, rng.range(0.9, 1.2));
    f.rotation.set(rng.range(0.35, 0.75), (i / n) * Math.PI * 2, 0, 'YXZ');
    f.castShadow = true;
    top.add(f);
  }
  part(G.sphere, mat('palm-dates', { color: '#8a5a20' }), 0.5, 0.4, 0.5, 0, -0.1, 0, top);
  return g;
}

/** حاجز خرساني (جيرسي) — يمكن للاعب القفز فوقه، المطاردون يلتفون حوله. */
export function makeBarrier() {
  const g = new THREE.Group();
  const conc = mat('barrier', { color: '#c8c3b8', roughness: 0.95 });
  const stripe = mat('barrier-stripe', { color: '#d23a2a', roughness: 0.8 });
  part(G.box, conc, 0.7, 0.35, 3.4, 0, 0.175, 0, g);
  part(G.box, conc, 0.38, 0.5, 3.4, 0, 0.6, 0, g);
  part(G.box, stripe, 0.4, 0.12, 3.42, 0, 0.72, 0, g);
  return g;
}

export function makeLamp() {
  const g = new THREE.Group();
  const pole = mat('lamp-pole', { color: '#5c5f63', metalness: 0.6, roughness: 0.4 });
  const bulb = mat('lamp-bulb', { color: '#fff3d6', emissive: '#ffcf7a', emissiveIntensity: 1.2 });
  part(G.cyl, pole, 0.16, 6, 0.16, 0, 3, 0, g);
  part(G.box, pole, 0.12, 0.12, 1.4, 0, 6, 0.6, g);
  part(G.box, bulb, 0.3, 0.12, 0.5, 0, 5.92, 1.2, g);
  return g;
}

export function makeBench() {
  const g = new THREE.Group();
  const wood = mat('bench-wood', { color: '#8d6a45', roughness: 0.8 });
  const metal = mat('bench-metal', { color: '#3d4043', metalness: 0.5, roughness: 0.5 });
  part(G.box, wood, 2, 0.08, 0.5, 0, 0.48, 0, g);
  part(G.box, wood, 2, 0.4, 0.08, 0, 0.75, -0.22, g);
  part(G.box, metal, 0.08, 0.45, 0.45, -0.85, 0.22, 0, g);
  part(G.box, metal, 0.08, 0.45, 0.45, 0.85, 0.22, 0, g);
  return g;
}

export function makePlanter(rng) {
  const g = new THREE.Group();
  part(G.box, mat('planter', { color: '#b7a07a', roughness: 0.9 }), 1.6, 0.7, 1.6, 0, 0.35, 0, g);
  part(G.sphere, mat('bush', { color: '#4e8a3e', roughness: 0.9 }), 1.4, rng.range(0.7, 1.1), 1.4, 0, 0.9, 0, g);
  return g;
}

export function makeCone() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 8), mat('cone', { color: '#ff6a1a', roughness: 0.6 }));
  c.position.y = 0.35; c.castShadow = true;
  g.add(c);
  return g;
}

export function makeFountain() {
  const g = new THREE.Group();
  const stone = mat('fountain-stone', { color: '#d9ccb4', roughness: 0.7 });
  const water = mat('fountain-water', { color: '#3fa7d6', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.8 });
  part(new THREE.CylinderGeometry(2.4, 2.6, 0.7, 20), stone, 1, 1, 1, 0, 0.35, 0, g);
  part(new THREE.CylinderGeometry(2.1, 2.1, 0.08, 20), water, 1, 1, 1, 0, 0.66, 0, g).castShadow = false;
  part(new THREE.CylinderGeometry(0.3, 0.5, 1.8, 10), stone, 1, 1, 1, 0, 1.2, 0, g);
  part(new THREE.CylinderGeometry(1, 0.8, 0.2, 14), stone, 1, 1, 1, 0, 2.1, 0, g);
  return g;
}

/** مظلة مواقف سيارات. */
export function makeShade(w, d) {
  const g = new THREE.Group();
  const pole = mat('shade-pole', { color: '#e8e8e8', metalness: 0.4, roughness: 0.4 });
  const roof = mat('shade-roof', { color: '#e9e1d0', roughness: 0.9, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(G.cyl, pole, 0.2, 3, 0.2, sx * (w / 2 - 0.3), 1.5, sz * (d / 2 - 0.3), g);
  part(G.box, roof, w, 0.12, d, 0, 3.05, 0, g);
  return g;
}
