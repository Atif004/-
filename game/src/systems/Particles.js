// جسيمات رذاذ الماء + بقع ماء على الأرض. مجمّعة (pooled) لأداء ثابت.
import * as THREE from 'three';

const MAX = 600;

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#9fdcff', size: 0.16, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -100;

    // بقع الماء: تبطئ المطاردين الذين يمرون فوقها
    this.puddles = [];
    const pm = new THREE.MeshStandardMaterial({ color: '#4aa8e0', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, depthWrite: false });
    const pg = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(pg, pm.clone());
      m.visible = false;
      m.renderOrder = 1;
      scene.add(m);
      this.puddles.push({ mesh: m, t: 0, r: 1.6, x: 0, z: 0 });
    }
    this.scene = scene;
  }

  splash(x, y, z, count = 40, power = 4) {
    for (let k = 0; k < count; k++) {
      const i = this.next; this.next = (this.next + 1) % MAX;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, u = Math.random();
      this.vel[i * 3] = Math.cos(a) * power * u;
      this.vel[i * 3 + 1] = power * (0.6 + Math.random() * 0.9);
      this.vel[i * 3 + 2] = Math.sin(a) * power * u;
      this.life[i] = 0.6 + Math.random() * 0.5;
    }
  }

  /** قطرات صغيرة تتساقط من مطارد مبلل. */
  drip(x, y, z) {
    const i = this.next; this.next = (this.next + 1) % MAX;
    this.pos[i * 3] = x + (Math.random() - 0.5) * 0.4; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
    this.vel[i * 3] = 0; this.vel[i * 3 + 1] = -0.5; this.vel[i * 3 + 2] = 0;
    this.life[i] = 0.5;
  }

  puddle(x, z, duration = 6) {
    const p = this.puddles.reduce((a, b) => (a.t < b.t ? a : b));
    p.x = x; p.z = z; p.t = duration; p.max = duration;
    p.mesh.position.set(x, (this.groundAt ? this.groundAt(x, z) : 0) + 0.02, z);
    p.mesh.scale.setScalar(p.r);
    p.mesh.visible = true;
  }

  /** هل النقطة داخل بقعة ماء نشطة. */
  inPuddle(x, z) {
    for (const p of this.puddles) if (p.t > 0 && (p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r) return true;
    return false;
  }

  update(dt) {
    const P = this.pos, V = this.vel, L = this.life;
    for (let i = 0; i < MAX; i++) {
      if (L[i] <= 0) continue;
      L[i] -= dt;
      V[i * 3 + 1] -= 14 * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (P[i * 3 + 1] < 0.18 || L[i] <= 0) { L[i] = 0; P[i * 3 + 1] = -100; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    for (const p of this.puddles) {
      if (p.t <= 0) continue;
      p.t -= dt;
      p.mesh.material.opacity = 0.55 * Math.min(1, p.t / 1.5);
      if (p.t <= 0) p.mesh.visible = false;
    }
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -100;
    for (const p of this.puddles) { p.t = 0; p.mesh.visible = false; }
  }
}
