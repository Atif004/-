// نماذج شخصيات خيالية مبنية من أشكال بسيطة (خفيفة على الهواتف) مع تحريك إجرائي.
import * as THREE from 'three';
import { shemaghTexture } from '../world/Textures.js';

const matCache = {};
function M(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  return matCache[key];
}

function mesh(geo, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function pivot(parent, x, y, z) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

const SKIN_TONES = ['#c48a5c', '#b07a50', '#d19a6c', '#9c6a44', '#c9925f'];

/** قارورة ماء (تُستخدم في الحقيبة واليد والمقذوفات). */
export function makeBottleMesh(scale = 1) {
  const g = new THREE.Group();
  const water = M('#4fb3ff', { transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.1, emissive: '#0a3a66', emissiveIntensity: 0.4 });
  const cap = M('#f4f4f4', { roughness: 0.5 });
  const label = M('#1a7fd6', { roughness: 0.6 });
  mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.24, 10), water, g, 0, 0.12, 0);
  mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 10), label, g, 0, 0.12, 0);
  mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.05, 8), water, g, 0, 0.265, 0);
  mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.035, 8), cap, g, 0, 0.3, 0);
  g.scale.setScalar(scale);
  return g;
}

function makeFace(head, skin, opts = {}) {
  const eye = M('#1b1b1b', { roughness: 0.3 });
  mesh(new THREE.SphereGeometry(0.018, 6, 6), eye, head, -0.045, 0.02, 0.118);
  mesh(new THREE.SphereGeometry(0.018, 6, 6), eye, head, 0.045, 0.02, 0.118);
  const brow = M('#2a1e16');
  mesh(new THREE.BoxGeometry(0.045, 0.012, 0.01), brow, head, -0.045, 0.055, 0.118);
  mesh(new THREE.BoxGeometry(0.045, 0.012, 0.01), brow, head, 0.045, 0.055, 0.118);
  mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), M(skin), head, 0, -0.005, 0.13);
  if (opts.beard) {
    const b = M('#231912', { roughness: 1 });
    mesh(new THREE.BoxGeometry(0.17, 0.08, 0.06), b, head, 0, -0.085, 0.085);
    mesh(new THREE.BoxGeometry(0.08, 0.018, 0.02), b, head, 0, -0.045, 0.125);
  } else if (opts.moustache) {
    mesh(new THREE.BoxGeometry(0.08, 0.018, 0.02), M('#231912'), head, 0, -0.045, 0.125);
  }
}

/** الشخصية الرئيسية: شاب عربي خيالي بملابس عصرية وحقيبة مليئة بقوارير الماء. */
export function makePlayerModel() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const skin = '#c48a5c';
  const shirt = M('#178f8a');
  const jeans = M('#2c3e5c');
  const shoe = M('#f2f2f2', { roughness: 0.5 });
  const hips = pivot(body, 0, 0.92, 0);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = pivot(hips, s * 0.11, 0, 0);
    mesh(new THREE.CapsuleGeometry(0.075, 0.7, 3, 8), jeans, leg, 0, -0.42, 0);
    mesh(new THREE.BoxGeometry(0.13, 0.09, 0.27), shoe, leg, 0, -0.86, 0.05);
    legs.push(leg);
  }
  const torso = pivot(hips, 0, 0, 0);
  mesh(new THREE.CapsuleGeometry(0.19, 0.32, 4, 10), shirt, torso, 0, 0.33, 0).scale.set(1.15, 1, 0.75);
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 8), M(skin), torso, 0, 0.62, 0);
  const head = pivot(torso, 0, 0.74, 0);
  mesh(new THREE.SphereGeometry(0.13, 14, 12), M(skin), head);
  const hair = mesh(new THREE.SphereGeometry(0.137, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M('#1d1510', { roughness: 1 }), head, 0, 0.012, -0.008);
  hair.rotation.x = -0.25;
  makeFace(head, skin, { moustache: false });

  const arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(torso, s * 0.26, 0.52, 0);
    mesh(new THREE.CapsuleGeometry(0.06, 0.18, 3, 8), shirt, arm, 0, -0.12, 0);
    mesh(new THREE.CapsuleGeometry(0.05, 0.22, 3, 8), M(skin), arm, 0, -0.37, 0);
    mesh(new THREE.SphereGeometry(0.055, 8, 6), M(skin), arm, 0, -0.52, 0);
    arms.push(arm);
  }
  // قارورة في اليد اليمنى (تظهر عند التصويب)
  const handBottle = makeBottleMesh(1.1);
  handBottle.position.set(0, -0.62, 0.04);
  arms[0].add(handBottle);

  // الحقيبة مع قوارير ظاهرة
  const pack = pivot(torso, 0, 0.32, -0.2);
  mesh(new THREE.BoxGeometry(0.36, 0.42, 0.18), M('#e0702a', { roughness: 0.9 }), pack);
  mesh(new THREE.BoxGeometry(0.3, 0.16, 0.06), M('#c45d1f'), pack, 0, -0.08, -0.11);
  const packBottles = [];
  for (let k = 0; k < 4; k++) {
    const b = makeBottleMesh(1);
    b.position.set(-0.12 + k * 0.08, 0.1, (k % 2) * 0.04 - 0.02);
    b.rotation.z = (k - 1.5) * 0.12;
    pack.add(b);
    packBottles.push(b);
  }
  for (const s of [-1, 1]) {
    const b = makeBottleMesh(1);
    b.position.set(s * 0.21, -0.15, 0);
    pack.add(b);
    packBottles.push(b);
  }

  root.userData.rig = { body, hips, legs, arms, torso, head, handBottle, packBottles, kind: 'player' };
  return root;
}

/**
 * مطارد: شخصية عربية خيالية بالزي الإماراتي التقليدي (كندورة + غترة + عقال).
 * variant يحدد اختلافات بسيطة في الطول والبنية والألوان.
 */
export function makeChaserModel(variant) {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const skin = SKIN_TONES[variant.skin % SKIN_TONES.length];
  const kandura = M(variant.kandura, { roughness: 0.75 });
  const hips = pivot(body, 0, 0.95, 0);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = pivot(hips, s * 0.1, 0, 0);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), M(skin), leg, 0, -0.45, 0);
    mesh(new THREE.BoxGeometry(0.12, 0.04, 0.26), M('#5a3b22', { roughness: 0.9 }), leg, 0, -0.9, 0.04);
    mesh(new THREE.BoxGeometry(0.1, 0.02, 0.06), M('#3b2615'), leg, 0, -0.87, 0.08);
    legs.push(leg);
  }

  // الكندورة: شكل دوراني من الكتف حتى الكاحل
  const pts = [
    [0.27, -0.88], [0.27, -0.6], [0.24, -0.2], [0.22, 0.1], [0.24, 0.35], [0.25, 0.48], [0.2, 0.55], [0.08, 0.6], [0.0, 0.6],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = pivot(hips, 0, 0, 0);
  const robe = mesh(new THREE.LatheGeometry(pts, 16), kandura, torso);
  robe.scale.set(variant.girth, 1, variant.girth * 0.85);
  // الطربوشة (الشرّابة) على الصدر
  mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.28, 5), M(variant.kandura === '#f4f4f0' ? '#e6e6df' : '#f6f2e8'), torso, 0, 0.42, 0.205 * variant.girth);
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), M(skin), torso, 0, 0.63, 0);

  const head = pivot(torso, 0, 0.76, 0);
  mesh(new THREE.SphereGeometry(0.125, 14, 12), M(skin), head);
  makeFace(head, skin, { beard: variant.beard, moustache: !variant.beard });

  // الغترة: غطاء للرأس + انسدال على الكتفين والظهر
  const cloth = variant.shemagh
    ? new THREE.MeshStandardMaterial({ map: shemaghTexture(), roughness: 0.85, side: THREE.DoubleSide })
    : M('#fbfbf8', { roughness: 0.85, side: THREE.DoubleSide });
  mesh(new THREE.SphereGeometry(0.142, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), cloth, head, 0, 0.01, -0.005);
  const drape = mesh(new THREE.CylinderGeometry(0.15, 0.26, 0.42, 16, 1, true, Math.PI * 0.28, Math.PI * 1.44), cloth, head, 0, -0.18, -0.02);
  drape.userData.openFront = true; // الفتحة نحو +Z (الوجه)
  // العقال: حلقتان سوداوان
  const agal = M('#111111', { roughness: 0.6 });
  const r1 = mesh(new THREE.TorusGeometry(0.128, 0.014, 6, 20), agal, head, 0, 0.075, -0.01);
  r1.rotation.x = Math.PI / 2 + 0.12;
  const r2 = mesh(new THREE.TorusGeometry(0.124, 0.014, 6, 20), agal, head, 0, 0.1, -0.012);
  r2.rotation.x = Math.PI / 2 + 0.12;

  const arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(torso, s * 0.27 * variant.girth, 0.47, 0);
    mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.5, 8), kandura, arm, 0, -0.25, 0);
    mesh(new THREE.SphereGeometry(0.055, 8, 6), M(skin), arm, 0, -0.55, 0);
    arms.push(arm);
  }

  root.scale.setScalar(variant.height);
  root.userData.rig = { body, hips, legs, arms, torso, head, robe, kind: 'chaser' };
  return root;
}

/**
 * تحريك إجرائي: يُستدعى كل إطار.
 * state: { speed (م/ث), phase, airborne, attack (0..1), aim (0..1), hurt (0..1), wet (0..1) }
 */
export function animateRig(rig, s, dt) {
  const run = Math.min(1, s.speed / 7);
  const sw = Math.sin(s.phase);
  const legAmp = 0.25 + run * 0.6;
  const robe = rig.kind === 'chaser';

  rig.legs[0].rotation.x = sw * legAmp * (robe ? 0.6 : 1);
  rig.legs[1].rotation.x = -sw * legAmp * (robe ? 0.6 : 1);
  rig.arms[0].rotation.x = -sw * (0.2 + run * 0.7);
  rig.arms[1].rotation.x = sw * (0.2 + run * 0.7);
  rig.arms[0].rotation.z = 0.08; rig.arms[1].rotation.z = -0.08;
  rig.body.position.y = Math.abs(Math.cos(s.phase)) * 0.06 * run;
  rig.torso.rotation.x = run * 0.22;
  rig.torso.rotation.y = sw * 0.08 * run;
  if (robe) rig.robe.rotation.x = -sw * 0.05 * run;

  if (s.airborne) {
    rig.legs[0].rotation.x = -0.6; rig.legs[1].rotation.x = 0.3;
    rig.arms[0].rotation.x = -1.2; rig.arms[1].rotation.x = -1.0;
  }
  if (s.speed < 0.2 && !s.airborne) {
    // تنفس خفيف أثناء الوقوف
    const b = Math.sin(performance.now() * 0.002) * 0.02;
    rig.torso.rotation.x = b; rig.legs[0].rotation.x = rig.legs[1].rotation.x = 0;
    rig.arms[0].rotation.x = rig.arms[1].rotation.x = b;
  }
  if (s.attack > 0) {
    // رفع الذراع للأمام (حركة إمساك/دفع)
    const a = Math.sin(Math.min(1, s.attack) * Math.PI);
    rig.arms[0].rotation.x = -1.6 * a - 0.2;
    rig.arms[1].rotation.x = -1.3 * a;
    rig.torso.rotation.x = 0.3 * a;
  }
  if (s.aim > 0) {
    rig.arms[0].rotation.x = -2.2 * s.aim + rig.arms[0].rotation.x * (1 - s.aim);
    rig.arms[0].rotation.z = 0.1;
  }
  if (rig.handBottle) rig.handBottle.visible = s.aim > 0.05;
  if (s.hurt > 0) {
    rig.torso.rotation.x -= 0.5 * s.hurt;
    rig.head.rotation.x = -0.3 * s.hurt;
  } else rig.head.rotation.x = 0;
  if (s.stagger > 0) {
    rig.torso.rotation.z = Math.sin(performance.now() * 0.03) * 0.15 * s.stagger;
    rig.arms[0].rotation.x = -0.8; rig.arms[1].rotation.x = -0.6;
    rig.arms[0].rotation.z = 0.9; rig.arms[1].rotation.z = -0.9;
  } else rig.torso.rotation.z = 0;
}
