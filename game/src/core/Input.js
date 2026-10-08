// نظام الإدخال: لوحة المفاتيح + الفأرة + اللمس (عصا افتراضية وأزرار).

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.sprintHeld = false;
    this.jumpQueued = false;
    this.throwQueued = false;
    this.aimHeld = false;
    this.pauseQueued = false;
    this.touchMode = false;
    this.enabled = false;
    this.touch = { move: { x: 0, y: 0 }, sprint: false };

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.jumpQueued = true; e.preventDefault(); }
      if (e.code === 'Escape' || e.code === 'KeyP') this.pauseQueued = true;
      if (e.code === 'KeyF' || e.code === 'KeyE') this.throwQueued = true;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // إن لم يتوفر قفل المؤشر (داخل إطار مثلًا): السحب بالفأرة يحرك الكاميرا، والنقرة بدون سحب ترمي
    this.drag = null;
    canvas.addEventListener('mousedown', (e) => {
      if (this.touchMode || !this.enabled) return;
      if (e.button === 2) this.aimHeld = true;
      if (document.pointerLockElement !== canvas) {
        this.drag = { moved: 0, button: e.button };
        this.requestLock();
        return;
      }
      if (e.button === 0) this.throwQueued = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 2) this.aimHeld = false;
      if (this.drag && this.drag.button === 0 && this.drag.moved < 6 && this.lockFailed) this.throwQueued = true;
      this.drag = null;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.look.x += e.movementX;
        this.look.y += e.movementY;
      } else if (this.drag) {
        this.drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        this.look.x += e.movementX * 1.5;
        this.look.y += e.movementY * 1.5;
      }
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
    addEventListener('touchstart', () => this.setTouchMode(true), { passive: true, once: true });
  }

  setTouchMode(on) {
    this.touchMode = on;
    document.body.classList.toggle('touch', on);
  }

  requestLock() {
    if (this.touchMode) return;
    if (this.lockFailed || !this.canvas.requestPointerLock) { this.lockFailed = true; return; }
    try {
      const r = this.canvas.requestPointerLock();
      r?.catch?.(() => { this.lockFailed = true; });
    } catch { this.lockFailed = true; }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** يُستدعى مرة كل إطار؛ يعيد حالة الإدخال المجمّعة. */
  poll() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (this.touch.move.x || this.touch.move.y) { x = this.touch.move.x; y = this.touch.move.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const sens = this.settings.get('sensitivity');
    const inv = this.settings.get('invertY') ? -1 : 1;
    const out = {
      moveX: x, moveY: y,
      lookX: this.look.x * 0.0022 * sens,
      lookY: this.look.y * 0.0022 * sens * inv,
      sprint: k.has('ShiftLeft') || k.has('ShiftRight') || this.touch.sprint,
      jump: this.jumpQueued,
      throw: this.throwQueued,
      aim: this.aimHeld,
      pause: this.pauseQueued,
    };
    this.look.x = this.look.y = 0;
    this.jumpQueued = this.throwQueued = this.pauseQueued = false;
    return out;
  }
}
