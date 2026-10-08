// كاميرا الشخص الثالث: تتبع ناعم خلف اللاعب، وتصحيح تلقائي عند وجود جدران/عوائق.
import * as THREE from 'three';

const PITCH_MIN = -0.45, PITCH_MAX = 1.1;

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI + Math.PI / 4;
    this.pitch = 0.32;
    this.distance = 5.2;
    this.curDist = 5.2;
    this.focus = new THREE.Vector3();
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.fovBase = 62;
  }

  snap(target, facing) {
    this.yaw = facing + Math.PI;
    this.focus.set(target.x, target.y + 1.55, target.z);
    this.curDist = this.distance;
  }

  shake(amp = 0.25, t = 0.3) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, t); }

  update(dt, target, look, world, opts = {}) {
    this.yaw -= look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.y, PITCH_MIN, PITCH_MAX);

    // متابعة ناعمة لنقطة التركيز
    const fy = target.y + 1.55;
    const k = 1 - Math.exp(-14 * dt);
    this.focus.x += (target.x - this.focus.x) * k;
    this.focus.z += (target.z - this.focus.z) * k;
    this.focus.y += (fy - this.focus.y) * (1 - Math.exp(-8 * dt));

    // إزاحة خفيفة فوق الكتف (أوضح عند التصويب)
    const aim = opts.aim || 0;
    const want = this.distance * (1 - aim * 0.35);
    const side = 0.45 + aim * 0.25;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const pivot = new THREE.Vector3(this.focus.x - cy * side * 0, this.focus.y, this.focus.z);
    const shoulder = new THREE.Vector3(this.focus.x + cy * side, this.focus.y, this.focus.z - sy * side);
    // لا تضع الكتف داخل جدار
    const sd = world.raycast(pivot.x, pivot.y, pivot.z, cy, 0, -sy, side + 0.25);
    if (sd !== Infinity) shoulder.set(pivot.x + cy * Math.max(0, sd - 0.25), pivot.y, pivot.z - sy * Math.max(0, sd - 0.25));

    const cp = Math.cos(this.pitch), spt = Math.sin(this.pitch);
    const dir = new THREE.Vector3(sy * cp, spt, cy * cp); // من الكتف نحو الكاميرا
    // تصحيح موقع الكاميرا: شعاع من الكتف للخلف، والتوقف قبل أول عائق
    let maxD = want;
    const hit = world.raycast(shoulder.x, shoulder.y, shoulder.z, dir.x, dir.y, dir.z, want + 0.3);
    if (hit !== Infinity) maxD = Math.max(0.6, hit - 0.3);
    // الاقتراب فوري لتجنب اختراق الجدار، والابتعاد تدريجي لسلاسة الحركة
    if (maxD < this.curDist) this.curDist = maxD;
    else this.curDist += (maxD - this.curDist) * (1 - Math.exp(-4 * dt));

    const pos = shoulder.clone().addScaledVector(dir, this.curDist);
    if (pos.y < 0.3) pos.y = 0.3;

    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT) * 3;
      pos.x += (Math.random() - 0.5) * a; pos.y += (Math.random() - 0.5) * a; pos.z += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(shoulder.x - dir.x * 10, shoulder.y - dir.y * 10 + 0.15, shoulder.z - dir.z * 10);

    // تكبير بسيط لمجال الرؤية عند الجري
    const fov = this.fovBase + (opts.sprint ? 7 : 0) - aim * 8;
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-6 * dt));
    this.camera.updateProjectionMatrix();
  }

  /** اتجاه التصويب الأفقي/العمودي من الكاميرا. */
  aimDirection(out) {
    this.camera.getWorldDirection(out);
    return out;
  }
}
