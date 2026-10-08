// أدوات التحكم باللمس: عصا افتراضية يسارًا، أزرار يمينًا، وسحب الإصبع لتحريك الكاميرا.

export class TouchControls {
  constructor(root, input) {
    this.input = input;
    this.el = document.createElement('div');
    this.el.className = 'touch-layer';
    this.el.innerHTML = `
      <div class="look-zone"></div>
      <div class="stick"><div class="knob"></div></div>
      <div class="tbtns">
        <button class="tbtn throw" data-a="throw">💧<small>رمي</small></button>
        <button class="tbtn jump" data-a="jump">⤒<small>قفز</small></button>
        <button class="tbtn sprint" data-a="sprint">⚡<small>جري</small></button>
      </div>`;
    root.appendChild(this.el);
    this.stick = this.el.querySelector('.stick');
    this.knob = this.el.querySelector('.knob');
    this.lookZone = this.el.querySelector('.look-zone');
    this.stickId = null;
    this.lookId = null;
    this.bind();
  }

  bind() {
    const S = this.stick, R = 55;
    let cx = 0, cy = 0;
    const setKnob = (dx, dy) => {
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.touch.move.x = dx / R;
      this.input.touch.move.y = -dy / R;
    };
    S.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.stickId = t.identifier;
      const r = S.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      e.preventDefault();
    }, { passive: false });
    const moveStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) {
          let dx = t.clientX - cx, dy = t.clientY - cy;
          const l = Math.hypot(dx, dy);
          if (l > R) { dx *= R / l; dy *= R / l; }
          setKnob(dx, dy);
          // الدفع الكامل للعصا يفعّل الجري تلقائيًا إذا اختار اللاعب ذلك
          this.autoSprint = l > R * 0.95 && this.input.settings.get('autoSprint');
        }
        if (t.identifier === this.lookId) {
          this.input.look.x += (t.clientX - this.lx) * 1.6;
          this.input.look.y += (t.clientY - this.ly) * 1.6;
          this.lx = t.clientX; this.ly = t.clientY;
        }
      }
      this.input.touch.sprint = this.sprintBtn || this.autoSprint;
    };
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) { this.stickId = null; setKnob(0, 0); this.autoSprint = false; }
        if (t.identifier === this.lookId) this.lookId = null;
      }
      this.input.touch.sprint = this.sprintBtn || this.autoSprint;
    };
    addEventListener('touchmove', moveStick, { passive: true });
    addEventListener('touchend', endTouch);
    addEventListener('touchcancel', endTouch);

    this.lookZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY;
    }, { passive: true });

    for (const b of this.el.querySelectorAll('.tbtn')) {
      const a = b.dataset.a;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        b.classList.add('down');
        if (a === 'throw') this.input.throwQueued = true;
        if (a === 'jump') this.input.jumpQueued = true;
        if (a === 'sprint') { this.sprintBtn = !this.sprintBtn; b.classList.toggle('on', this.sprintBtn); }
        this.input.touch.sprint = this.sprintBtn || this.autoSprint;
        // السماح بتحريك الكاميرا من نفس الإصبع بعد الضغط
        if (this.lookId === null && a !== 'sprint') {
          const t = e.changedTouches[0];
          this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY;
        }
      }, { passive: false });
      b.addEventListener('touchend', () => b.classList.remove('down'));
    }
  }

  show(on) { this.el.style.display = on ? '' : 'none'; }
}
