// الشخصية الرئيسية: حركة نسبية للكاميرا، جري بطاقة تحمّل، قفز، ورمي القوارير.
import * as THREE from 'three';
import { makePlayerModel, animateRig } from './CharacterModel.js';
import { Health } from '../systems/Health.js';

const WALK = 4.6, SPRINT = 7.8, ACCEL = 40, AIR_ACCEL = 12, JUMP_V = 7.4;

export class Player {
  constructor(scene) {
    this.model = makePlayerModel();
    scene.add(this.model);
    this.rig = this.model.userData.rig;
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), radius: 0.38, height: 1.8, onGround: true };
    this.health = new Health(100);
    this.stamina = 100;
    this.exhausted = false;
    this.bottles = 0;
    this.maxBottles = 12;
    this.facing = 0;
    this.phase = 0;
    this.aim = 0;
    this.throwCooldown = 0;
    this.hurt = 0;
    this.daze = 0;
    this.sprinting = false;
    this.knock = new THREE.Vector3();
    this.lastStepPhase = 0;
  }

  reset(pos, bottles, facing = Math.PI / 4) {
    this.body.pos.copy(pos);
    this.body.vel.set(0, 0, 0);
    this.health.value = this.health.max;
    this.health.invuln = 0;
    this.stamina = 100;
    this.bottles = bottles;
    this.facing = facing;
    this.knock.set(0, 0, 0);
    this.aim = 0;
    this.daze = 0;
    this.model.position.copy(pos);
    this.model.rotation.y = this.facing;
    this.updatePackBottles();
  }

  updatePackBottles() {
    this.rig.packBottles.forEach((b, i) => { b.visible = i < this.bottles; });
  }

  /**
   * in: إدخال اللاعب، camYaw: اتجاه الكاميرا، world: عالم التصادم.
   * يعيد أحداثًا مثل { step: true, jumped: true, throwReq: true }
   */
  update(dt, input, camYaw, world) {
    const ev = {};
    const b = this.body;
    this.health.update(dt);
    this.hurt = Math.max(0, this.hurt - dt * 3);
    this.daze = Math.max(0, this.daze - dt);
    this.throwCooldown -= dt;

    // اتجاه الحركة نسبةً للكاميرا
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = -fz, rz = fx;
    let mx = fx * input.moveY + rx * input.moveX;
    let mz = fz * input.moveY + rz * input.moveX;
    const mlen = Math.hypot(mx, mz);
    if (mlen > 1) { mx /= mlen; mz /= mlen; }

    // الجري وطاقة التحمل
    const wantsSprint = input.sprint && mlen > 0.2 && !this.exhausted;
    this.sprinting = wantsSprint;
    if (wantsSprint) {
      this.stamina -= 20 * dt;
      if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; }
    } else {
      this.stamina = Math.min(100, this.stamina + (mlen > 0.2 ? 11 : 18) * dt);
      if (this.exhausted && this.stamina > 30) this.exhausted = false;
    }
    const maxSpeed = (wantsSprint ? SPRINT : WALK) * (this.aim > 0.5 ? 0.8 : 1) * (this.daze > 0 ? 0.5 : 1);
    const tx = mx * maxSpeed, tz = mz * maxSpeed;
    const acc = (b.onGround ? ACCEL : AIR_ACCEL) * dt;
    const dvx = tx - b.vel.x, dvz = tz - b.vel.z;
    const dl = Math.hypot(dvx, dvz);
    if (dl > acc) { b.vel.x += (dvx / dl) * acc; b.vel.z += (dvz / dl) * acc; } else { b.vel.x = tx; b.vel.z = tz; }

    // دفعة الضربة
    b.vel.x += this.knock.x; b.vel.z += this.knock.z;
    this.knock.multiplyScalar(Math.max(0, 1 - dt * 8));

    if (input.jump && b.onGround) { b.vel.y = JUMP_V; b.onGround = false; ev.jumped = true; }

    world.moveCharacter(b, dt);
    b.vel.x -= this.knock.x; b.vel.z -= this.knock.z;

    // التصويب والرمي
    this.aim = THREE.MathUtils.damp(this.aim, input.aim || this.throwCooldown > 0.1 ? 1 : 0, 14, dt);
    if (input.throw && this.throwCooldown <= 0) {
      if (this.bottles > 0) { ev.throwReq = true; this.throwCooldown = 0.45; } else ev.empty = true;
    }

    // الدوران: نحو اتجاه الحركة، أو اتجاه الكاميرا عند التصويب
    const speed = Math.hypot(b.vel.x, b.vel.z);
    let targetYaw = this.facing;
    if (this.aim > 0.3) targetYaw = Math.atan2(fx, fz);
    else if (speed > 0.5) targetYaw = Math.atan2(b.vel.x, b.vel.z);
    let d = targetYaw - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * Math.min(1, dt * 14);

    // التحريك وأصوات الخطوات
    this.phase += dt * (b.onGround ? 3 + speed * 1.45 : 0);
    if (b.onGround && speed > 1) {
      const stepIdx = Math.floor(this.phase / Math.PI);
      if (stepIdx !== this.lastStepPhase) { this.lastStepPhase = stepIdx; ev.step = this.sprinting ? 'run' : 'walk'; }
    }
    this.model.position.copy(b.pos);
    this.model.rotation.y = this.facing;
    animateRig(this.rig, { speed, phase: this.phase, airborne: !b.onGround, attack: 0, aim: this.aim, hurt: this.hurt, stagger: 0 }, dt);
    // وميض أثناء المناعة المؤقتة
    this.model.visible = this.health.invuln <= 0 || Math.floor(this.health.invuln * 14) % 2 === 0;
    return ev;
  }

  takeHit(amount, fromPos) {
    if (!this.health.damage(amount)) return false;
    const dx = this.body.pos.x - fromPos.x, dz = this.body.pos.z - fromPos.z;
    const l = Math.hypot(dx, dz) || 1;
    this.knock.set((dx / l) * 9, 0, (dz / l) * 9);
    this.body.vel.y = 3;
    this.hurt = 1;
    this.daze = 0.8; // دوخة قصيرة بعد الضربة
    return true;
  }

  /** نقطة انطلاق القارورة (فوق الكتف الأيمن). */
  handPosition(out) {
    const s = Math.sin(this.facing), c = Math.cos(this.facing);
    return out.set(this.body.pos.x - c * 0.25 + s * 0.4, this.body.pos.y + 1.7, this.body.pos.z + s * 0.25 + c * 0.4);
  }
}
