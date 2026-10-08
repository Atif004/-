// المطارد: الجسم والحركة واتباع المسار. القرارات في ChaserAI.
import * as THREE from 'three';
import { makeChaserModel, animateRig } from './CharacterModel.js';

const KANDURAS = ['#f4f4f0', '#ece6d8', '#f4f4f0', '#dcdde0', '#e3d7bf', '#f4f4f0'];

export function chaserVariant(i, rng) {
  return {
    height: 0.92 + rng() * 0.18,
    girth: 0.9 + rng() * 0.3,
    kandura: KANDURAS[i % KANDURAS.length],
    skin: Math.floor(rng() * 5),
    beard: rng() < 0.6,
    shemagh: i % 3 === 2,
  };
}

export class Chaser {
  constructor(scene, variant, index) {
    this.index = index;
    this.model = makeChaserModel(variant);
    this.scale = variant.height;
    scene.add(this.model);
    this.rig = this.model.userData.rig;
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), radius: 0.42, height: 1.8, onGround: true };
    this.facing = 0;
    this.phase = Math.random() * 6;
    this.path = null;
    this.pathIdx = 0;
    this.repathTimer = 0;
    this.pathTarget = new THREE.Vector3(1e9, 0, 0);
    this.slowTimer = 0;
    this.stagger = 0;
    this.attackAnim = 0;
    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.lookAt = null;
  }

  spawn(pos) {
    this.body.pos.copy(pos);
    this.body.vel.set(0, 0, 0);
    this.path = null;
    this.slowTimer = this.stagger = this.attackAnim = 0;
  }

  /** تُحدد سرعة الحركة النهائية مع الإبطاء (ماء/بقعة). */
  speedMultiplier(particles) {
    let m = 1;
    if (this.slowTimer > 0) m *= 0.4;
    if (particles.inPuddle(this.body.pos.x, this.body.pos.z)) m *= 0.55;
    if (this.stagger > 0) m = 0;
    return m;
  }

  /** التحرك نحو هدف باستخدام خط مستقيم إن أمكن، وإلا مسار A*. */
  steer(target, speed, nav, repathInterval, dt) {
    const p = this.body.pos;
    let wx = target.x, wz = target.z;
    if (nav.lineWalkable(p.x, p.z, target.x, target.z)) {
      this.path = null;
    } else {
      this.repathTimer -= dt;
      const moved = this.pathTarget.distanceToSquared(target) > 4;
      if (!this.path || this.repathTimer <= 0 || (moved && this.repathTimer < repathInterval * 0.5)) {
        this.path = nav.findPath(p.x, p.z, target.x, target.z);
        this.pathIdx = 0;
        this.pathTarget.copy(target);
        this.repathTimer = repathInterval * (0.8 + Math.random() * 0.4);
      }
      if (this.path && this.path.length) {
        // تخطي النقاط التي وصلناها أو التي يمكن الوصول لما بعدها مباشرة
        while (this.pathIdx < this.path.length - 1) {
          const w = this.path[this.pathIdx];
          const n = this.path[this.pathIdx + 1];
          if (Math.hypot(w.x - p.x, w.z - p.z) < 0.9 || nav.lineWalkable(p.x, p.z, n.x, n.z)) this.pathIdx++;
          else break;
        }
        const w = this.path[this.pathIdx];
        wx = w.x; wz = w.z;
      }
    }
    const dx = wx - p.x, dz = wz - p.z;
    const d = Math.hypot(dx, dz);
    this.desired = d > 0.05 ? { x: (dx / d) * speed, z: (dz / d) * speed } : { x: 0, z: 0 };
    if (d < 0.3) this.desired.x = this.desired.z = 0;
    return d;
  }

  stop() { this.desired = { x: 0, z: 0 }; }

  /** تطبيق الحركة، الفصل بين المطاردين، والتحريك. */
  integrate(dt, world, others, particles) {
    const b = this.body;
    const mul = this.speedMultiplier(particles);
    let tx = (this.desired?.x || 0) * mul, tz = (this.desired?.z || 0) * mul;

    // فصل بسيط حتى لا يتكدسوا
    for (const o of others) {
      if (o === this) continue;
      const dx = b.pos.x - o.body.pos.x, dz = b.pos.z - o.body.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.6 && d2 > 1e-4) { const d = Math.sqrt(d2); tx += (dx / d) * (1.3 - d) * 4; tz += (dz / d) * (1.3 - d) * 4; }
    }
    const k = Math.min(1, dt * 9);
    b.vel.x += (tx - b.vel.x) * k;
    b.vel.z += (tz - b.vel.z) * k;
    world.moveCharacter(b, dt);

    // كشف العلوق
    this.stuckTimer = Math.hypot(tx, tz) > 1 && b.pos.distanceToSquared(this.lastPos) < (0.4 * dt) ** 2 ? this.stuckTimer + dt : 0;
    this.lastPos.copy(b.pos);
    if (this.stuckTimer > 0.8) { this.path = null; this.repathTimer = 0; this.stuckTimer = 0; b.vel.x += (Math.random() - 0.5) * 6; b.vel.z += (Math.random() - 0.5) * 6; }

    const speed = Math.hypot(b.vel.x, b.vel.z);
    let targetYaw = this.facing;
    if (this.lookAt) targetYaw = Math.atan2(this.lookAt.x - b.pos.x, this.lookAt.z - b.pos.z);
    else if (speed > 0.4) targetYaw = Math.atan2(b.vel.x, b.vel.z);
    let d = targetYaw - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * Math.min(1, dt * 10);

    this.slowTimer -= dt;
    this.stagger = Math.max(0, this.stagger - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt * 2.2);
    if (this.slowTimer > 0 && Math.random() < 0.4) particles.drip(b.pos.x, b.pos.y + 1.5 * this.scale, b.pos.z);

    this.phase += dt * (3 + speed * 1.5);
    this.model.position.copy(b.pos);
    this.model.rotation.y = this.facing;
    animateRig(this.rig, {
      speed, phase: this.phase, airborne: false, attack: this.attackAnim > 0 ? 1 - this.attackAnim : 0,
      aim: 0, hurt: 0, stagger: this.stagger > 0 ? 1 : 0,
    }, dt);
  }

  forward() { return { x: Math.sin(this.facing), z: Math.cos(this.facing) }; }
}
