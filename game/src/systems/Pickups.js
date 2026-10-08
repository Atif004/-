// نقاط التقاط قوارير إضافية: صندوق قوارير متوهج، يعود بعد فترة.
import * as THREE from 'three';
import { makeBottleMesh } from '../entities/CharacterModel.js';

const RESPAWN = 25;

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  setup(spots, count, rng) {
    this.clear();
    const pool = spots.slice();
    for (let i = 0; i < count && pool.length; i++) {
      const p = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      const g = new THREE.Group();
      g.position.set(p.x, 0.15, p.z);
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: '#1f6fb2', roughness: 0.6 }));
      crate.position.y = 0.175; crate.castShadow = true;
      g.add(crate);
      const bottles = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const b = makeBottleMesh(1.6);
        b.position.set(-0.2 + k * 0.2, 0.3, 0);
        bottles.add(b);
      }
      g.add(bottles);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      ring.position.y = 0.03;
      g.add(ring);
      this.group.add(g);
      this.items.push({ g, bottles, ring, x: p.x, z: p.z, timer: 0, amount: 3 });
    }
  }

  /** يعيد عدد القوارير الملتقطة هذا الإطار. */
  update(dt, player, t) {
    let got = 0;
    for (const it of this.items) {
      if (it.timer > 0) {
        it.timer -= dt;
        if (it.timer <= 0) it.g.visible = true;
        continue;
      }
      it.bottles.rotation.y = t * 1.5;
      it.bottles.position.y = Math.sin(t * 3) * 0.08;
      it.ring.material.opacity = 0.45 + Math.sin(t * 4) * 0.25;
      const p = player.body.pos;
      if ((p.x - it.x) ** 2 + (p.z - it.z) ** 2 < 1.3 && p.y < 1.5 && player.bottles < player.maxBottles) {
        const add = Math.min(it.amount, player.maxBottles - player.bottles);
        player.bottles += add;
        got += add;
        it.timer = RESPAWN;
        it.g.visible = false;
      }
    }
    return got;
  }

  clear() {
    for (const it of this.items) this.group.remove(it.g);
    this.items.length = 0;
  }
}
