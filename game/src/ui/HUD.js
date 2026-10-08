// واجهة اللعب: الصحة، القوارير، الوقت، الهدف، رقم المرحلة، الطاقة، مؤشر الخطر، خريطة مصغّرة.

export class HUD {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="pill level">المرحلة <b data-k="level">1</b></div>
        <div class="pill timer">⏱️ <b data-k="time">0:00</b></div>
        <div class="pill bottles">💧 <b data-k="bottles">0</b></div>
      </div>
      <div class="hud-left">
        <div class="bar health"><span>❤️</span><div class="track"><div class="fill" data-k="hp"></div></div></div>
        <div class="bar stamina"><span>⚡</span><div class="track"><div class="fill" data-k="st"></div></div></div>
        <div class="objective">🎯 <span data-k="obj"></span></div>
      </div>
      <canvas class="minimap" width="160" height="160"></canvas>
      <div class="exit-arrow" data-k="arrow"><div class="arrow-shape"></div><small data-k="dist"></small></div>
      <div class="danger" data-k="danger">⚠️ مطاردة!</div>
      <div class="crosshair"></div>
      <div class="toast" data-k="toast"></div>
      <button class="pause-btn" aria-label="إيقاف مؤقت">II</button>
      <div class="lock-hint" data-k="lock">🖱️ انقر على الشاشة للتحكم بالكاميرا</div>
      <div class="hit-flash" data-k="flash"></div>`;
    root.appendChild(this.el);
    this.q = {};
    this.el.querySelectorAll('[data-k]').forEach((e) => { this.q[e.dataset.k] = e; });
    this.mini = this.el.querySelector('.minimap');
    this.miniCtx = this.mini.getContext('2d');
    this.pauseBtn = this.el.querySelector('.pause-btn');
    this.toastT = 0;
    this.last = {};
  }

  show(on) { this.el.style.display = on ? '' : 'none'; }

  set(k, v) {
    if (this.last[k] === v) return;
    this.last[k] = v;
    this.q[k].textContent = v;
  }

  update(s, dt) {
    this.set('level', String(s.level));
    const t = Math.max(0, Math.ceil(s.time));
    this.set('time', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    this.q.time.parentElement.classList.toggle('low', s.time < 20);
    this.set('bottles', String(s.bottles));
    this.q.hp.style.width = `${s.hp * 100}%`;
    this.q.hp.classList.toggle('low', s.hp < 0.3);
    this.q.st.style.width = `${s.stamina * 100}%`;
    this.q.st.classList.toggle('ex', s.exhausted);
    this.set('obj', s.objective);
    this.q.danger.classList.toggle('on', s.danger);
    this.q.lock.classList.toggle('on', !!s.needLock);
    this.set('dist', `${Math.round(s.exitDist)}م`);
    this.q.arrow.firstElementChild.style.transform = `rotate(${s.exitAngle}rad)`;
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.q.toast.classList.remove('on'); }
  }

  toast(msg, t = 2) {
    this.q.toast.textContent = msg;
    this.q.toast.classList.add('on');
    this.toastT = t;
  }

  flash() {
    const f = this.q.flash;
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  /** يرسم الخريطة الثابتة مرة واحدة. */
  setMap(minimap, exits) {
    const c = document.createElement('canvas');
    c.width = c.height = 320;
    const g = c.getContext('2d');
    const k = 320 / minimap.size;
    g.fillStyle = '#3b3e44'; g.fillRect(0, 0, 320, 320);
    if (minimap.pitch) {
      const [x, z, w, d] = minimap.pitch;
      g.fillStyle = '#3f8f3a'; g.fillRect(x * k, z * k, w * k, d * k);
    }
    g.fillStyle = '#b9ad95';
    for (const [x, z, w, d] of minimap.buildings) g.fillRect(x * k, z * k, w * k, d * k);
    g.fillStyle = '#8a8f98';
    for (const [x, z, w, d] of minimap.props) g.fillRect(x * k, z * k, Math.max(1, w * k), Math.max(1, d * k));
    g.fillStyle = '#2cff9a';
    for (const e of exits) { g.beginPath(); g.arc(e.x * k, e.z * k, 7, 0, Math.PI * 2); g.fill(); }
    this.mapImg = c;
    this.mapScale = k;
  }

  drawMinimap(player, yaw, chasers) {
    const g = this.miniCtx, S = 160, k = this.mapScale;
    g.save();
    g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#22252a'; g.fillRect(0, 0, S, S);
    // خريطة تدور مع الكاميرا، اللاعب في المنتصف
    g.translate(S / 2, S / 2);
    g.rotate(yaw);
    g.scale(1.4, 1.4);
    g.translate(-player.x * k, -player.z * k);
    g.drawImage(this.mapImg, 0, 0);
    for (const c of chasers) {
      if (!c.visible) continue;
      g.fillStyle = c.alert ? '#ff3b3b' : '#ffb347';
      g.beginPath(); g.arc(c.x * k, c.z * k, 5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    g.fillStyle = '#4fc3ff';
    g.beginPath(); g.moveTo(S / 2, S / 2 - 8); g.lineTo(S / 2 - 6, S / 2 + 6); g.lineTo(S / 2 + 6, S / 2 + 6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.stroke();
  }
}
