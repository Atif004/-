// نظام القوارير: رمي بفيزياء مقذوفات حقيقية (جاذبية + ارتداد + دوران).
// الإصابة تبطئ المطارد وتُحدث رذاذ ماء فقط — بدون أي عنف.
import * as THREE from 'three';
import { makeBottleMesh } from '../entities/CharacterModel.js';

const GRAVITY = 18;

export class BottleSystem {
  constructor(scene, collision, particles, audio) {
    this.scene = scene;
    this.collision = collision;
    this.particles = particles;
    this.audio = audio;
    this.active = [];
    this.pool = [];
    this.onHit = null; // (chaser, dir) => void
  }

  throw(origin, dir, speed = 19) {
    const b = this.pool.pop() || { mesh: makeBottleMesh(1.4), vel: new THREE.Vector3(), spin: new THREE.Vector3() };
    b.mesh.position.copy(origin);
    b.vel.copy(dir).multiplyScalar(speed);
    b.vel.y += 3.2; // قوس طبيعي
    b.spin.set(Math.random() * 10 + 8, Math.random() * 4, Math.random() * 6);
    b.life = 4;
    b.bounces = 0;
    b.mesh.visible = true;
    this.scene.add(b.mesh);
    this.active.push(b);
    this.audio?.play('throw');
  }

  burst(b, x, y, z) {
    this.particles.splash(x, y, z, 45, 4.5);
    this.particles.puddle(x, z);
    this.audio?.play('splash', { x, z });
    b.life = 0;
  }

  update(dt, chasers) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      const p = b.mesh.position;
      const steps = 3, h = dt / steps;
      for (let s = 0; s < steps && b.life > 0; s++) {
        b.vel.y -= GRAVITY * h;
        const ox = p.x, oy = p.y, oz = p.z;
        p.addScaledVector(b.vel, h);

        // إصابة مطارد
        for (const c of chasers) {
          const cp = c.body.pos;
          const dx = p.x - cp.x, dz = p.z - cp.z;
          if (dx * dx + dz * dz < 0.55 * 0.55 && p.y > cp.y && p.y < cp.y + 2.0 * c.scale) {
            this.onHit?.(c, new THREE.Vector3(b.vel.x, 0, b.vel.z).normalize());
            this.burst(b, p.x, p.y, p.z);
            break;
          }
        }
        if (b.life <= 0) break;

        // اصطدام بالأرض
        if (p.y < 0.12) {
          p.y = 0.12;
          if (Math.abs(b.vel.y) > 5 || b.bounces > 0) { this.burst(b, p.x, 0.2, p.z); break; }
          b.vel.y *= -0.45; b.vel.x *= 0.6; b.vel.z *= 0.6; b.bounces++;
          this.audio?.play('bounce', { x: p.x, z: p.z });
        }
        // اصطدام بالعوائق
        const box = this.collision.pointHit(p.x, p.y, p.z, 0.08);
        if (box) {
          if (b.vel.length() > 9) { this.burst(b, ox, oy, oz); break; }
          // ارتداد حسب الوجه الأقرب
          const inX = ox > box.minX && ox < box.maxX, inZ = oz > box.minZ && oz < box.maxZ, inY = oy > box.minY && oy < box.maxY;
          p.set(ox, oy, oz);
          if (!inX) b.vel.x *= -0.4; else if (!inZ) b.vel.z *= -0.4; else if (!inY) b.vel.y *= -0.4;
          b.bounces++;
        }
      }
      b.mesh.rotation.x += b.spin.x * dt;
      b.mesh.rotation.y += b.spin.y * dt;
      b.mesh.rotation.z += b.spin.z * dt;
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        this.active.splice(i, 1);
        this.pool.push(b);
      }
    }
  }

  clear() {
    for (const b of this.active) { this.scene.remove(b.mesh); this.pool.push(b); }
    this.active.length = 0;
  }
}
