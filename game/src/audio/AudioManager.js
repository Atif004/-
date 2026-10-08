// الصوت: كل المؤثرات والموسيقى مولّدة برمجيًا عبر Web Audio — لا ملفات، يعمل أوفلاين.
import { MusicPlayer } from './Music.js';

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.listener = { x: 0, z: 0 };
    settings.onChange(() => this.applyVolumes());
  }

  /** يجب استدعاؤه بعد أول تفاعل للمستخدم (سياسة المتصفحات). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    // ضوضاء بيضاء مُعدة مسبقًا
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.music = new MusicPlayer(this.ctx, this.musicBus, this.noise);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    this.master.gain.value = s.get('master');
    this.sfx.gain.value = s.get('sfx');
    this.musicBus.gain.value = s.get('music') * 0.55;
  }

  /** مستوى الصوت حسب البعد عن اللاعب. */
  atten(pos) {
    if (!pos) return 1;
    const d = Math.hypot(pos.x - this.listener.x, pos.z - this.listener.z);
    return Math.max(0, 1 - d / 35);
  }

  noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 0.5, dur + 0.05);
    return s;
  }

  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  play(name, pos) {
    if (!this.ctx) return;
    const v = this.atten(pos);
    if (v <= 0.01) return;
    const c = this.ctx, t = c.currentTime;
    const out = c.createGain();
    out.gain.value = v;
    out.connect(this.sfx);
    const g = c.createGain();
    g.connect(out);

    switch (name) {
      case 'walk':
      case 'run': {
        const n = this.noiseSrc(t, 0.12);
        const f = c.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = name === 'run' ? 900 : 650 + Math.random() * 200; f.Q.value = 1.2;
        n.connect(f).connect(g);
        this.env(g, t, 0.005, name === 'run' ? 0.5 : 0.28, 0.09);
        break;
      }
      case 'throw': {
        const n = this.noiseSrc(t, 0.3);
        const f = c.createBiquadFilter();
        f.type = 'bandpass'; f.Q.value = 3;
        f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
        n.connect(f).connect(g);
        this.env(g, t, 0.04, 0.5, 0.25);
        break;
      }
      case 'splash': {
        const n = this.noiseSrc(t, 0.5);
        const f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.45);
        n.connect(f).connect(g);
        this.env(g, t, 0.005, 0.8, 0.45);
        // فقاعات
        for (let k = 0; k < 4; k++) {
          const o = c.createOscillator(), og = c.createGain();
          const st = t + 0.03 + k * 0.05;
          o.frequency.setValueAtTime(500 + Math.random() * 500, st);
          o.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 600, st + 0.06);
          o.connect(og).connect(out);
          this.env(og, st, 0.005, 0.12, 0.06);
          o.start(st); o.stop(st + 0.1);
        }
        break;
      }
      case 'bounce': {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
        o.connect(g);
        this.env(g, t, 0.003, 0.35, 0.08);
        o.start(t); o.stop(t + 0.12);
        break;
      }
      case 'hit': {
        // صوت ارتطام مكتوم (غير عنيف)
        const o = c.createOscillator();
        o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
        o.connect(g);
        this.env(g, t, 0.003, 0.9, 0.18);
        o.start(t); o.stop(t + 0.25);
        const n = this.noiseSrc(t, 0.08), ng = c.createGain(), f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 1200;
        n.connect(f).connect(ng).connect(out);
        this.env(ng, t, 0.002, 0.5, 0.07);
        break;
      }
      case 'whiff': {
        const n = this.noiseSrc(t, 0.2), f = c.createBiquadFilter();
        f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.18);
        n.connect(f).connect(g);
        this.env(g, t, 0.02, 0.25, 0.15);
        break;
      }
      case 'alert': {
        const o = c.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + 0.08);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
        o.connect(f).connect(g);
        this.env(g, t, 0.005, 0.18, 0.18);
        o.start(t); o.stop(t + 0.22);
        break;
      }
      case 'pickup': {
        [880, 1175, 1568].forEach((fr, k) => {
          const o = c.createOscillator(), og = c.createGain();
          o.type = 'sine'; o.frequency.value = fr;
          o.connect(og).connect(out);
          this.env(og, t + k * 0.06, 0.005, 0.25, 0.18);
          o.start(t + k * 0.06); o.stop(t + k * 0.06 + 0.25);
        });
        break;
      }
      case 'jump': {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.1);
        o.connect(g);
        this.env(g, t, 0.005, 0.12, 0.1);
        o.start(t); o.stop(t + 0.15);
        break;
      }
      case 'empty': {
        const o = c.createOscillator();
        o.type = 'square'; o.frequency.value = 140;
        o.connect(g);
        this.env(g, t, 0.003, 0.1, 0.08);
        o.start(t); o.stop(t + 0.1);
        break;
      }
      case 'click': {
        const o = c.createOscillator();
        o.frequency.value = 1200;
        o.connect(g);
        this.env(g, t, 0.002, 0.12, 0.04);
        o.start(t); o.stop(t + 0.06);
        break;
      }
      default: break;
    }
  }

  setMusic(mode) { this.music?.setMode(mode); }
  setIntensity(v) { this.music?.setIntensity(v); }
  update() { this.music?.schedule(); }
}
