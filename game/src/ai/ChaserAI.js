// الذكاء الاصطناعي للمطاردين — آلة حالات:
// PATROL (بحث/دورية) → ALERT (رد فعل) → CHASE (مطاردة) / INTERCEPT (قطع طريق الهروب)
// → ATTACK (هجوم قريب) → SEARCH (فقدان اللاعب والبحث عنه) → PATROL
// GUARD: حراسة منطقة المخرج (في المراحل المتقدمة).
import * as THREE from 'three';

export const S = { PATROL: 'patrol', GUARD: 'guard', ALERT: 'alert', CHASE: 'chase', INTERCEPT: 'intercept', ATTACK: 'attack', SEARCH: 'search' };

const ATTACK_RANGE = 1.45;
const EYE = new THREE.Vector3(), TARGET = new THREE.Vector3(), TMP = new THREE.Vector3();

/** ذاكرة الفريق المشتركة: آخر موقع معروف للاعب. */
export class Squad {
  constructor() { this.reset(); }
  reset() {
    this.lastKnown = new THREE.Vector3();
    this.lastVel = new THREE.Vector3();
    this.lastTime = -1e9;
    this.reporter = null;
  }
  report(pos, vel, time, who) {
    this.lastKnown.copy(pos); this.lastVel.copy(vel); this.lastTime = time; this.reporter = who;
  }
}

export class ChaserAI {
  constructor(chaser, params, ctx, role) {
    this.c = chaser;
    this.p = params;
    this.ctx = ctx; // { world, nav, squad, player, exits, patrolPoints, rng, audio }
    this.role = role; // 'chaser' | 'interceptor' | 'guard'
    this.state = role === 'guard' ? S.GUARD : S.PATROL;
    this.timer = 0;
    this.lastSeen = -1e9;
    this.sees = false;
    this.target = new THREE.Vector3();
    this.searchPoint = null;
    this.attackCd = 0;
    this.patrolTarget = null;
    this.guardHome = null;
  }

  get time() { return this.ctx.time(); }

  /** الإدراك: رؤية ضمن مخروط ومدى محددين + خط رؤية، أو سماع خطوات قريبة. */
  perceive() {
    const { player, world } = this.ctx;
    const pp = player.body.pos, cp = this.c.body.pos;
    const dx = pp.x - cp.x, dz = pp.z - cp.z;
    const dist = Math.hypot(dx, dz);
    this.dist = dist;
    const hear = player.sprinting ? this.p.hearSprint : this.p.hearWalk;
    let sees = false;
    const chasing = this.state === S.CHASE || this.state === S.ATTACK;
    const range = chasing ? this.p.viewRange * 1.25 : this.p.viewRange;
    if (dist < range) {
      const f = this.c.forward();
      const cos = (f.x * dx + f.z * dz) / (dist || 1);
      const fov = chasing ? Math.PI * 1.6 : this.p.fov;
      if (cos > Math.cos(fov / 2) || dist < hear) {
        EYE.set(cp.x, cp.y + 1.6 * this.c.scale, cp.z);
        TARGET.set(pp.x, pp.y + 1.05, pp.z);
        sees = world.lineOfSight(EYE, TARGET);
        // سماع خطوات قريبة حتى بدون رؤية
        if (!sees && dist < hear * 0.6) sees = true;
      }
    }
    this.sees = sees;
    if (sees) {
      this.lastSeen = this.time;
      this.ctx.squad.report(pp, player.body.vel, this.time, this);
    }
    return sees;
  }

  nearestExit(from) {
    let best = this.ctx.exits[0], bd = Infinity;
    for (const e of this.ctx.exits) { const d = e.distanceToSquared(from); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  go(state) {
    if (this.state === state) return;
    this.state = state;
    this.timer = 0;
    if (state === S.ALERT) this.ctx.audio?.play('alert', { x: this.c.body.pos.x, z: this.c.body.pos.z });
  }

  update(dt) {
    const { nav, squad, player, rng } = this.ctx;
    const c = this.c;
    const now = this.time;
    this.timer += dt;
    this.attackCd -= dt;
    const sees = this.perceive();
    c.lookAt = null;
    const base = this.ctx.speed;
    const pp = player.body.pos;

    // تنبيه من الفريق (المراحل الأذكى تتواصل لمسافات أبعد)
    const squadFresh = now - squad.lastTime < this.p.memory && squad.reporter !== this;
    const alerted = squadFresh && this.p.alertRadius > 0 && squad.lastKnown.distanceTo(c.body.pos) < this.p.alertRadius;

    switch (this.state) {
      case S.PATROL:
      case S.GUARD: {
        if (sees) { this.go(S.ALERT); break; }
        if (alerted) { this.go(this.role === 'interceptor' ? S.INTERCEPT : S.CHASE); break; }
        if (this.state === S.GUARD) {
          if (!this.guardHome) this.guardHome = this.nearestExit(c.body.pos);
          if (!this.patrolTarget || c.body.pos.distanceTo(this.patrolTarget) < 1.5 || this.timer > 8) {
            const a = rng() * Math.PI * 2;
            this.patrolTarget = TMP.set(this.guardHome.x + Math.cos(a) * 9, 0, this.guardHome.z + Math.sin(a) * 9).clone();
            this.timer = 0;
          }
        } else if (!this.patrolTarget || c.body.pos.distanceTo(this.patrolTarget) < 1.5 || this.timer > 12) {
          this.patrolTarget = rng.pick(this.ctx.patrolPoints).clone();
          this.timer = 0;
        }
        c.steer(this.patrolTarget, base * 0.42, nav, this.p.repath * 2, dt);
        break;
      }
      case S.ALERT: {
        // لحظة رد فعل: يلتفت للاعب قبل الانطلاق
        c.stop();
        c.lookAt = pp;
        if (this.timer >= this.p.reaction) this.go(this.role === 'interceptor' && this.dist > 10 ? S.INTERCEPT : S.CHASE);
        break;
      }
      case S.CHASE: {
        const lost = now - this.lastSeen > this.p.memory && !squadFresh;
        if (lost || this.dist > this.p.loseRange) { this.searchPoint = squad.lastKnown.clone(); this.go(S.SEARCH); break; }
        if (this.dist < ATTACK_RANGE && this.attackCd <= 0 && Math.abs(pp.y - c.body.pos.y) < 1) { this.go(S.ATTACK); c.attackAnim = 1; break; }
        // مطاردة مع توقع حركة اللاعب
        const src = sees ? pp : squad.lastKnown;
        const vel = sees ? player.body.vel : squad.lastVel;
        const lead = Math.min(this.p.lead, this.dist / 8);
        this.target.set(src.x + vel.x * lead, 0, src.z + vel.z * lead);
        if (this.dist < 3) this.target.copy(pp);
        if (!nav.walkableAt(this.target.x, this.target.z)) this.target.copy(src);
        c.steer(this.target, base, nav, this.p.repath, dt);
        if (this.dist < 4) c.lookAt = pp;
        break;
      }
      case S.INTERCEPT: {
        // قطع الطريق: التوجه إلى نقطة بين اللاعب وأقرب مخرج له
        if (!squadFresh && !sees) { this.searchPoint = squad.lastKnown.clone(); this.go(S.SEARCH); break; }
        if (this.dist < 9 && sees) { this.go(S.CHASE); break; }
        const src = sees ? pp : squad.lastKnown;
        const exit = this.nearestExit(src);
        const t = 0.45;
        this.target.set(src.x + (exit.x - src.x) * t, 0, src.z + (exit.z - src.z) * t);
        if (!nav.walkableAt(this.target.x, this.target.z)) {
          const ci = nav.nearestWalkable(nav.toCell(this.target.x, this.target.z));
          if (ci >= 0) nav.cellCenter(ci, this.target);
        }
        const d = c.steer(this.target, base * 1.02, nav, this.p.repath, dt);
        if (d < 2) { c.stop(); c.lookAt = pp; }
        break;
      }
      case S.ATTACK: {
        // اندفاعة قصيرة نحو اللاعب أثناء التحضير للهجوم، ثم توقف
        if (!this.struck) c.steer(pp, base * 1.15, nav, this.p.repath, dt); else c.stop();
        c.lookAt = pp;
        if (this.timer >= this.p.attackWindup && !this.struck) {
          this.struck = true;
          const f = c.forward();
          const dx = pp.x - c.body.pos.x, dz = pp.z - c.body.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < ATTACK_RANGE + 0.6 && (f.x * dx + f.z * dz) / (d || 1) > 0.3 && Math.abs(pp.y - c.body.pos.y) < 1.1) {
            this.ctx.onAttack(this, this.p.damage);
          } else this.ctx.audio?.play('whiff', { x: c.body.pos.x, z: c.body.pos.z });
        }
        if (this.timer >= this.p.attackWindup + 0.3) {
          this.struck = false;
          this.attackCd = this.p.attackCooldown;
          this.go(S.CHASE);
        }
        break;
      }
      case S.SEARCH: {
        if (sees) { this.go(S.ALERT); this.timer = this.p.reaction * 0.5; break; }
        if (alerted) { this.go(S.CHASE); break; }
        if (this.timer > this.p.searchTime) { this.go(this.role === 'guard' ? S.GUARD : S.PATROL); break; }
        const d = c.steer(this.searchPoint, base * 0.65, nav, this.p.repath * 1.5, dt);
        if (d < 1.2) {
          // تفقد نقطة عشوائية قريبة من آخر موقع معروف
          const a = rng() * Math.PI * 2, r = 4 + rng() * 8;
          const nx = squad.lastKnown.x + Math.cos(a) * r, nz = squad.lastKnown.z + Math.sin(a) * r;
          if (nav.walkableAt(nx, nz)) this.searchPoint.set(nx, 0, nz);
        }
        break;
      }
    }
  }
}
