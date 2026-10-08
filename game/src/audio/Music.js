// موسيقى إجرائية بمقام الحجاز: إيقاع مقسوم (دُم/تك) + باص + لحن.
// أوضاع: menu، chase (حماسية وتشتد مع المطاردة)، win، lose.

const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
// مقسوم: دُم تك - تك دُم - تك -
const MAQSUM = ['D', 'T', '', 'T', 'D', '', 'T', ''];

export class MusicPlayer {
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.out = out;
    this.noise = noise;
    this.mode = 'off';
    this.intensity = 0;
    this.step = 0;
    this.nextTime = 0;
    this.seed = 1;
    this.melody = [];
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    if (mode === 'win') this.stinger([62, 66, 69, 74, 78, 81, 86], 0.11, 'triangle');
    if (mode === 'lose') this.stinger([74, 73, 70, 69, 66, 63, 62], 0.2, 'sawtooth');
    this.makeMelody();
  }

  setIntensity(v) { this.intensity += (v - this.intensity) * 0.05; }

  makeMelody() {
    let s = this.seed++ * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    let idx = 4;
    this.melody = [];
    for (let i = 0; i < 32; i++) {
      if (rnd() < 0.3) { this.melody.push(null); continue; }
      idx = Math.max(0, Math.min(HIJAZ.length - 1, idx + Math.floor(rnd() * 5) - 2));
      this.melody.push(HIJAZ[idx]);
    }
  }

  tone(t, freq, dur, type, vol, cutoff = 3000) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = cutoff;
    o.connect(f).connect(g).connect(this.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  doum(t, vol = 0.9) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    o.connect(g).connect(this.out);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.start(t); o.stop(t + 0.32);
  }

  tek(t, vol = 0.35) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise;
    f.type = 'highpass'; f.frequency.value = 3000;
    s.connect(f).connect(g).connect(this.out);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.start(t, Math.random() * 0.5, 0.08);
  }

  stinger(notes, gap, type) {
    const t = this.ctx.currentTime + 0.05;
    notes.forEach((n, i) => this.tone(t + i * gap, mtof(n), gap * 2.2, type, 0.22, 2500));
    this.tone(t + notes.length * gap, mtof(notes[notes.length - 1] - 12), 1.4, 'triangle', 0.25, 1500);
  }

  /** مُجدول بنظرة مسبقة (lookahead) — يُستدعى كل إطار. */
  schedule() {
    if (this.mode !== 'chase' && this.mode !== 'menu') return;
    const c = this.ctx;
    const chase = this.mode === 'chase';
    const bpm = chase ? 118 + this.intensity * 22 : 84;
    const stepDur = 60 / bpm / 2; // ثُمن
    if (this.nextTime < c.currentTime - 0.3) this.nextTime = c.currentTime + 0.02;
    while (this.nextTime < c.currentTime + 0.15) {
      const t = this.nextTime, i = this.step;
      const beat = MAQSUM[i % 8];
      const I = this.intensity;
      if (chase) {
        if (beat === 'D') this.doum(t, 0.8);
        if (beat === 'T') this.tek(t, 0.3 + I * 0.15);
        if (I > 0.4 && i % 2 === 1) this.tek(t + stepDur / 2, 0.12);
        // باص
        if (i % 2 === 0) this.tone(t, mtof(38 + (Math.floor(i / 16) % 2 ? 7 : 0)), stepDur * 1.6, 'sawtooth', 0.16, 500 + I * 700);
        // لحن (يظهر مع ارتفاع الحماس)
        const m = this.melody[i % 32];
        if (m !== null && m !== undefined && (I > 0.25 || i % 4 === 0)) {
          this.tone(t, mtof(62 + m), stepDur * 0.9, 'square', 0.05 + I * 0.05, 1200 + I * 2500);
        }
        if (i % 64 === 63) this.makeMelody();
      } else {
        if (i % 8 === 0) this.doum(t, 0.35);
        if (beat === 'T' && i % 16 > 7) this.tek(t, 0.1);
        if (i % 8 === 0) this.tone(t, mtof(50), stepDur * 7, 'triangle', 0.08, 800);
        const m = this.melody[i % 32];
        if (m !== null && m !== undefined && i % 2 === 0) this.tone(t, mtof(62 + m), stepDur * 2.5, 'triangle', 0.09, 1800);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
}
