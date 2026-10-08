// المنسّق الرئيسي: يحمّل المرحلة، يدير حلقة اللعب والحالات (قائمة/لعب/إيقاف/نتيجة).
import * as THREE from 'three';
import { LEVELS, aiParams } from '../config/levels.js';
import { buildMap, BLOCK, ROAD } from '../world/MapBuilder.js';
import { NavGrid } from '../ai/NavGrid.js';
import { ChaserAI, Squad, S } from '../ai/ChaserAI.js';
import { Player } from '../entities/Player.js';
import { Chaser, chaserVariant } from '../entities/Chaser.js';
import { BottleSystem } from '../weapons/BottleSystem.js';
import { Particles } from '../systems/Particles.js';
import { Pickups } from '../systems/Pickups.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { makeRng } from './Random.js';

const TMP = new THREE.Vector3(), TMP2 = new THREE.Vector3();

export class Game {
  constructor({ renderer, input, audio, hud, menus, save, touch }) {
    Object.assign(this, { renderer, input, audio, hud, menus, save, touch });
    this.scene = renderer.scene;
    this.cam = new ThirdPersonCamera(renderer.camera);
    this.state = 'menu';
    this.player = new Player(this.scene);
    this.player.model.visible = false;
    this.particles = new Particles(this.scene);
    this.pickups = new Pickups(this.scene);
    this.squad = new Squad();
    this.chasers = [];
    this.ais = [];
    this.levelTime = 0;
    this.elapsed = 0;
    this.clock = new THREE.Clock();
    this.menuOrbit = 0;
    this.mapCache = new Map();
  }

  // ---------------- تحميل المرحلة ----------------
  loadLevel(id) {
    const level = LEVELS[id - 1];
    this.level = level;
    this.params = aiParams(level);
    if (this.map) this.scene.remove(this.map.group);
    // نخزن الخرائط المبنية لتسريع إعادة المحاولة
    if (!this.mapCache.has(id)) {
      const map = buildMap(level);
      const nav = new NavGrid(map.size, map.size, 1.5);
      nav.bake(map.collision, 0.45);
      this.mapCache.set(id, { map, nav });
    }
    const { map, nav } = this.mapCache.get(id);
    this.map = map;
    this.nav = nav;
    this.world = map.collision;
    this.scene.add(map.group);

    this.particles.clear();
    this.particles.groundAt = (x, z) => {
      const lx = (x - ROAD) % (BLOCK + ROAD), lz = (z - ROAD) % (BLOCK + ROAD);
      return x > ROAD && z > ROAD && lx < BLOCK && lz < BLOCK && x < map.size - ROAD && z < map.size - ROAD ? 0.16 : 0.01;
    };
    this.bottles?.clear();
    this.bottles = new BottleSystem(this.scene, this.world, this.particles, this.audio);
    this.bottles.onHit = (c, dir) => this.onChaserHit(c, dir);

    const rng = makeRng(level.seed * 31 + Date.now() % 1000);
    this.rng = rng;
    this.player.reset(map.start, level.startBottles);
    this.player.model.visible = true;
    this.pickups.setup(map.pickupSpots, level.pickups, rng);

    // المطاردون
    for (const c of this.chasers) this.scene.remove(c.model);
    this.chasers = [];
    this.ais = [];
    this.squad.reset();
    const spawns = map.chaserSpawns.slice().sort((a, b) => b.distanceTo(map.start) - a.distanceTo(map.start));
    const nInter = Math.round((level.chasers - 1) * this.params.interceptShare);
    const ctx = {
      world: this.world, nav, squad: this.squad, player: this.player, exits: map.exits,
      patrolPoints: map.patrolPoints, rng, audio: this.audio, speed: level.chaserSpeed,
      time: () => this.elapsed,
      onAttack: (ai, dmg) => this.onPlayerAttacked(ai, dmg),
    };
    for (let i = 0; i < level.chasers; i++) {
      const c = new Chaser(this.scene, chaserVariant(i, makeRng(level.seed + i * 13)), i);
      let role = 'chaser';
      if (this.params.guardExit && i === 0) role = 'guard';
      else if (i > 0 && i <= nInter) role = 'interceptor';
      // الحارس يبدأ قرب المخرج، الباقون موزعون في المدينة بعيدًا عن البداية
      let sp;
      if (role === 'guard') sp = map.exits[0].clone().add(new THREE.Vector3(-6, 0, -6));
      else sp = spawns[Math.floor((i / level.chasers) * spawns.length * 0.8)] || spawns[0];
      const ci = nav.nearestWalkable(nav.toCell(sp.x, sp.z));
      if (ci >= 0) nav.cellCenter(ci, sp = sp.clone());
      c.spawn(sp);
      c.facing = Math.atan2(map.start.x - sp.x, map.start.z - sp.z);
      this.chasers.push(c);
      this.ais.push(new ChaserAI(c, this.params, ctx, role));
    }

    this.hud.setMap(map.minimap, map.exits);
    this.levelTime = level.time;
    this.elapsed = 0;
    this.cam.snap(this.player.body.pos, this.player.facing);
    this.danger = 0;
  }

  // ---------------- التحكم بالحالات ----------------
  start(id) {
    this.audio.unlock();
    this.loadLevel(id);
    this.menus.intro(this.level);
    this.state = 'intro';
    this.introT = 2.2;
    this.hud.show(true);
    this.updateTouchVisibility();
    this.audio.setMusic('chase');
    this.input.enabled = true;
    this.input.requestLock();
  }

  beginPlay() {
    this.menus.hide();
    this.state = 'playing';
    this.hud.toast('🎯 اهرب إلى نقطة الهروب الخضراء!', 2.5);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseLock();
    this.menus.pause();
  }

  resume() {
    this.menus.hide();
    this.state = 'playing';
    this.input.requestLock();
    this.clock.getDelta();
  }

  retry() { this.start(this.level.id); }
  next() { this.start(Math.min(LEVELS.length, this.level.id + 1)); }

  toMenu() {
    this.state = 'menu';
    this.input.enabled = false;
    this.input.releaseLock();
    this.hud.show(false);
    this.touch.show(false);
    this.menus.main();
    this.audio.setMusic('menu');
  }

  end(win, reason) {
    if (this.state !== 'playing') return;
    this.state = 'ended';
    this.input.releaseLock();
    this.touch.show(false);
    const time = this.elapsed;
    let stars = 0, record = false;
    if (win) {
      const left = this.levelTime / this.level.time;
      stars = 1 + (left > 0.35 ? 1 : 0) + (this.player.health.ratio > 0.6 ? 1 : 0);
      record = this.save.recordWin(this.level.id, time, stars, LEVELS.length);
    }
    this.audio.setMusic(win ? 'win' : 'lose');
    // لحظة قصيرة قبل ظهور الشاشة
    setTimeout(() => this.menus.result(win, { levelId: this.level.id, time, stars, record, reason }), win ? 600 : 900);
  }

  updateTouchVisibility() {
    const m = this.save.get('touchControls');
    const on = m === 'on' || (m === 'auto' && this.input.touchMode);
    this.touch.show(on && (this.state === 'playing' || this.state === 'intro'));
  }

  // ---------------- الأحداث ----------------
  onChaserHit(c, dir) {
    c.slowTimer = 2.8;
    c.stagger = 0.55;
    c.body.vel.x += dir.x * 5; c.body.vel.z += dir.z * 5;
    const ai = this.ais[c.index];
    // الإصابة تكشف موقع اللاعب للمطارد
    this.squad.report(this.player.body.pos, this.player.body.vel, this.elapsed, null);
    ai.lastSeen = this.elapsed;
    if (ai.state === S.PATROL || ai.state === S.GUARD || ai.state === S.SEARCH) ai.go(S.ALERT);
    this.hud.toast('💦 إصابة! المطارد أبطأ لفترة قصيرة', 1.5);
  }

  onPlayerAttacked(ai, dmg) {
    if (this.state !== 'playing') return;
    if (this.player.takeHit(dmg, ai.c.body.pos)) {
      this.audio.play('hit');
      this.hud.flash();
      this.cam.shake(0.35, 0.35);
      if (navigator.vibrate) try { navigator.vibrate(80); } catch { /* */ }
      if (this.player.health.dead) this.end(false, 'caught');
    }
  }

  // ---------------- الحلقة ----------------
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const inp = this.input.poll();

    if (this.state === 'menu') {
      this.menuCamera(dt);
    } else if (this.state === 'intro') {
      this.introT -= dt;
      this.cam.update(dt, this.player.body.pos, { x: 0, y: 0 }, this.world);
      this.updateHud(dt, this.clock.elapsedTime);
      if (this.introT <= 0 || inp.throw || inp.jump) this.beginPlay();
    } else if (this.state === 'playing') {
      if (inp.pause) { this.pause(); } else this.step(dt, inp, t);
    } else if (this.state === 'ended') {
      // المشهد يستمر بهدوء خلف شاشة النتيجة
      for (const c of this.chasers) { c.stop(); c.integrate(dt, this.world, this.chasers, this.particles); }
      this.particles.update(dt);
      this.cam.update(dt, this.player.body.pos, { x: 0.15 * dt, y: 0 }, this.world);
    } else if (this.state === 'paused') {
      if (inp.pause) this.resume();
    }

    if (this.map) this.renderer.followShadow(this.state === 'menu' ? this.menuFocus : this.player.body.pos);
    this.audio.update();
    this.renderer.adapt(dt);
    this.renderer.render();
  }

  step(dt, inp, t) {
    this.elapsed += dt;
    this.levelTime -= dt;
    const p = this.player;

    // اللاعب
    const ev = p.update(dt, inp, this.cam.yaw, this.world);
    if (ev.step) this.audio.play(ev.step);
    if (ev.jumped) this.audio.play('jump');
    if (ev.empty) { this.audio.play('empty'); this.hud.toast('لا توجد قوارير! ابحث عن صندوق قوارير 💧', 1.5); }
    if (ev.throwReq) this.throwBottle();

    // المطاردون
    for (const ai of this.ais) ai.update(dt);
    for (const c of this.chasers) c.integrate(dt, this.world, this.chasers, this.particles);

    this.bottles.update(dt, this.chasers);
    this.particles.update(dt);
    const got = this.pickups.update(dt, p, t);
    if (got) { this.audio.play('pickup'); this.hud.toast(`+${got} قوارير 💧`, 1.2); }
    p.updatePackBottles();

    // الكاميرا
    this.cam.update(dt, p.body.pos, { x: inp.lookX, y: inp.lookY }, this.world, { aim: p.aim, sprint: p.sprinting });
    this.audio.listener.x = p.body.pos.x; this.audio.listener.z = p.body.pos.z;

    const ed = this.updateHud(dt, t);

    // شروط الفوز والخسارة
    if (ed < 2.8) this.end(true);
    else if (this.levelTime <= 0) { this.levelTime = 0; this.end(false, 'time'); }
  }

  updateHud(dt, t) {
    const p = this.player;
    // الهدف ومؤشر الاتجاه
    let exit = this.map.exits[0], ed = Infinity;
    for (const e of this.map.exits) { const d = e.distanceTo(p.body.pos); if (d < ed) { ed = d; exit = e; } }
    for (const m of this.map.exitMarkers) {
      m.userData.ring.rotation.y = t;
      m.userData.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      m.userData.beam.material.opacity = 0.12 + Math.sin(t * 2) * 0.05;
    }
    const dx = exit.x - p.body.pos.x, dz = exit.z - p.body.pos.z;
    const yaw = this.cam.yaw;
    const u = dx * Math.cos(yaw) - dz * Math.sin(yaw), v = dx * Math.sin(yaw) + dz * Math.cos(yaw);

    const chasing = this.ais.filter((a) => a.state === S.CHASE || a.state === S.ATTACK || a.state === S.INTERCEPT).length;
    const nearest = Math.min(...this.ais.map((a) => a.dist ?? 99));
    const dangerTarget = chasing ? Math.min(1, 0.45 + chasing * 0.15 + (nearest < 8 ? 0.3 : 0)) : 0.1;
    this.audio.setIntensity(dangerTarget);

    this.hud.update({
      level: this.level.id, time: this.levelTime, bottles: p.bottles,
      hp: p.health.ratio, stamina: p.stamina / 100, exhausted: p.exhausted,
      objective: ed < 25 ? 'نقطة الهروب قريبة! استمر!' : this.map.exits.length > 1 ? `اوصل إلى أي نقطة هروب (${this.map.exits.length})` : 'اوصل إلى نقطة الهروب',
      danger: chasing > 0,
      needLock: this.state === 'playing' && !this.input.touchMode && !this.input.lockFailed && document.pointerLockElement !== this.renderer.renderer.domElement, exitDist: ed, exitAngle: Math.atan2(u, -v),
    }, dt);
    this.hud.drawMinimap(p.body.pos, yaw, this.chasers.map((c, i) => ({
      x: c.body.pos.x, z: c.body.pos.z,
      visible: this.ais[i].sees || this.ais[i].dist < 25,
      alert: this.ais[i].state === S.CHASE || this.ais[i].state === S.ATTACK || this.ais[i].state === S.INTERCEPT,
    })));

    return ed;
  }

  throwBottle() {
    const p = this.player;
    p.bottles--;
    const origin = p.handPosition(TMP);
    const dir = this.cam.aimDirection(TMP2);
    // مساعدة تصويب خفيفة: اختيار أقرب مطارد ضمن مخروط أمام الكاميرا
    let best = null, bestScore = Math.cos(this.input.touchMode ? 0.42 : 0.2);
    for (const c of this.chasers) {
      const tx = c.body.pos.x - origin.x, tz = c.body.pos.z - origin.z;
      const d = Math.hypot(tx, tz);
      if (d > 24 || d < 0.5) continue;
      const fl = Math.hypot(dir.x, dir.z) || 1;
      const score = (tx * dir.x + tz * dir.z) / (d * fl); // زاوية أفقية فقط
      if (score > bestScore && this.world.lineOfSight(origin, c.body.pos.clone().setY(1.1))) { bestScore = score; best = { c, d }; }
    }
    // على الجوال: إن لم يوجد هدف أمامك، استهدف أقرب مطارد يلاحقك (رمية فوق الكتف)
    if (!best && this.input.touchMode) {
      for (let i = 0; i < this.chasers.length; i++) {
        const c = this.chasers[i], a = this.ais[i];
        if (a.state !== S.CHASE && a.state !== S.ATTACK) continue;
        const d = Math.hypot(c.body.pos.x - origin.x, c.body.pos.z - origin.z);
        if (d < 12 && (!best || d < best.d) && this.world.lineOfSight(origin, c.body.pos.clone().setY(1.1))) best = { c, d };
      }
    }
    const speed = 19;
    let target;
    if (best) {
      // توقع موقع المطارد عند وصول القارورة
      const c = best.c.body, tf = best.d / speed;
      target = new THREE.Vector3(c.pos.x + c.vel.x * tf, 1.0, c.pos.z + c.vel.z * tf);
    } else {
      // النقطة التي يشير إليها مركز الشاشة (المنظار)
      const cp = this.renderer.camera.position;
      let dist = this.world.raycast(cp.x, cp.y, cp.z, dir.x, dir.y, dir.z, 40);
      if (dir.y < -0.01) dist = Math.min(dist, -cp.y / dir.y);
      if (!Number.isFinite(dist)) dist = 40;
      target = cp.clone().addScaledVector(dir, dist);
    }
    // حل المقذوف: زمن الطيران من المسافة الأفقية ثم السرعة العمودية اللازمة
    const T = target.sub(origin);
    const horiz = Math.max(0.5, Math.hypot(T.x, T.z));
    const tf = horiz / speed;
    const vy = THREE.MathUtils.clamp((T.y + 0.5 * 18 * tf * tf) / tf - 3.2, -12, 14);
    dir.set(T.x / horiz, vy / speed, T.z / horiz);
    this.bottles.throw(origin, dir, speed);
    p.facing = Math.atan2(dir.x, dir.z);
  }

  menuCamera(dt) {
    // كاميرا تدور ببطء حول المدينة خلف القائمة الرئيسية
    if (!this.map) {
      this.loadLevel(1);
      this.player.model.visible = false;
      this.player.body.pos.set(-999, 0, -999);
    }
    this.menuOrbit += dt * 0.05;
    const s = this.map.size;
    const c = this.renderer.camera;
    this.menuFocus = this.menuFocus || new THREE.Vector3(s / 2, 0, s / 2);
    c.position.set(s / 2 + Math.cos(this.menuOrbit) * s * 0.55, 32, s / 2 + Math.sin(this.menuOrbit) * s * 0.55);
    c.lookAt(s / 2, 0, s / 2);
    for (const ai of this.ais) { if (ai.state !== S.PATROL && ai.state !== S.GUARD) ai.state = S.PATROL; ai.update(dt); }
    this.ais.forEach((ai) => { ai.sees = false; });
    for (const ch of this.chasers) ch.integrate(dt, this.world, this.chasers, this.particles);
  }
}
