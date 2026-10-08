// قوام (Textures) مولّدة برمجيًا عبر Canvas — لا ملفات خارجية، كل شيء أوفلاين.
import * as THREE from 'three';
import { makeRng } from '../core/Random.js';

const cache = new Map();
let maxAniso = 4;
export function setMaxAnisotropy(v) { maxAniso = v; }

function canvasTex(key, size, draw, repeat = true) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  const [w, h] = Array.isArray(size) ? size : [size, size];
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  cache.set(key, t);
  return t;
}

function noise(g, s, alpha, seed) {
  const rng = makeRng(seed);
  for (let i = 0; i < s * s * 0.08; i++) {
    const v = Math.floor(rng() * 255);
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(rng() * s, rng() * s, 2, 2);
  }
}

/** واجهة برج زجاجي: نوافذ بشبكة 4×4 لكل بلاطة. */
export function facadeTexture(base, glass, frame, seed = 1) {
  return canvasTex(`facade-${base}-${glass}-${seed}`, 256, (g, s) => {
    const rng = makeRng(seed);
    g.fillStyle = frame; g.fillRect(0, 0, s, s);
    const n = 4, cw = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = new THREE.Color(glass);
      c.offsetHSL(0, 0, (rng() - 0.5) * 0.12);
      const grad = g.createLinearGradient(0, y * cw, 0, (y + 1) * cw);
      grad.addColorStop(0, c.clone().offsetHSL(0, 0, 0.12).getStyle());
      grad.addColorStop(1, c.getStyle());
      g.fillStyle = grad;
      g.fillRect(x * cw + 5, y * cw + 6, cw - 10, cw - 14);
      if (rng() < 0.25) { g.fillStyle = 'rgba(255,220,150,0.35)'; g.fillRect(x * cw + 5, y * cw + 6, cw - 10, cw - 14); }
    }
    g.fillStyle = base; g.fillRect(0, s - 6, s, 6);
  });
}

/** واجهة فيلا/مبنى منخفض بلون رملي مع نوافذ صغيرة. */
export function villaTexture(base, seed = 2) {
  return canvasTex(`villa-${base}-${seed}`, 256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    noise(g, s, 0.05, seed);
    const cw = s / 2;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const px = x * cw + cw * 0.3, py = y * cw + cw * 0.25, w = cw * 0.4, h = cw * 0.5;
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(px - 4, py - 4, w + 8, h + 8);
      g.fillStyle = '#3e5566'; g.fillRect(px, py, w, h);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(px, py, w, h * 0.3);
      // قوس مشربية بسيط
      g.strokeStyle = 'rgba(120,90,60,0.8)'; g.lineWidth = 3;
      g.beginPath(); g.arc(px + w / 2, py, w / 2, Math.PI, 0); g.stroke();
    }
  });
}

export function asphaltTexture() {
  return canvasTex('asphalt', 256, (g, s) => {
    g.fillStyle = '#3a3c40'; g.fillRect(0, 0, s, s);
    noise(g, s, 0.12, 7);
  });
}

export function sidewalkTexture() {
  return canvasTex('sidewalk', 256, (g, s) => {
    g.fillStyle = '#cfc3ad'; g.fillRect(0, 0, s, s);
    noise(g, s, 0.06, 9);
    g.strokeStyle = 'rgba(90,75,55,0.35)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke();
    }
  });
}

export function sandTexture() {
  return canvasTex('sand', 256, (g, s) => {
    g.fillStyle = '#d8bf8f'; g.fillRect(0, 0, s, s);
    noise(g, s, 0.08, 13);
  });
}

/** شماغ أحمر وأبيض بنقش مربعات. */
export function shemaghTexture() {
  return canvasTex('shemagh', 128, (g, s) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#b3242c';
    const n = 8, c = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if ((x + y) % 2 === 0) g.fillRect(x * c + c * 0.2, y * c + c * 0.2, c * 0.6, c * 0.6);
    }
  });
}

/** لافتة نصية (عربية) على Canvas. */
export function labelTexture(text, bg = '#0c7a4a', fg = '#ffffff') {
  return canvasTex(`label-${text}-${bg}`, 512, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = bg;
    const r = 40;
    g.beginPath();
    g.roundRect(10, s * 0.3, s - 20, s * 0.4, r);
    g.fill();
    g.fillStyle = fg;
    g.font = 'bold 96px system-ui, Tahoma, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.fillText(text, s / 2, s / 2 + 4);
  }, false);
}

export function disposeTextureCache() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

/** عشب الملعب بخطوط متناوبة. */
export function grassTexture() {
  return canvasTex('grass-stripes', 256, (g, s) => {
    g.fillStyle = '#3f8f3a'; g.fillRect(0, 0, s / 2, s);
    g.fillStyle = '#4a9c42'; g.fillRect(s / 2, 0, s / 2, s);
    noise(g, s, 0.05, 21);
  });
}

export function trackTexture() {
  return canvasTex('track', 256, (g, s) => {
    g.fillStyle = '#a5523a'; g.fillRect(0, 0, s, s);
    noise(g, s, 0.08, 23);
  });
}

/** علم الإمارات: شريط أحمر عمودي ثم أخضر/أبيض/أسود. */
export function uaeFlagTexture() {
  return canvasTex('uae-flag', 128, (g, s) => {
    const h = s * 0.5, y0 = (s - h) / 2;
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#00843d'; g.fillRect(0, y0, s, h / 3);
    g.fillStyle = '#ffffff'; g.fillRect(0, y0 + h / 3, s, h / 3);
    g.fillStyle = '#000000'; g.fillRect(0, y0 + (2 * h) / 3, s, h / 3);
    g.fillStyle = '#ef3340'; g.fillRect(0, y0, s / 4, h);
  }, false);
}

/** لوحة إعلانات حول الملعب (نصوص خيالية). */
export function adBoardTexture(text, bg, fg) {
  const key = `ad-${text}-${bg}`;
  // النسبة 1024×96 تقارب أبعاد اللوحة (10م × 0.9م)
  return canvasTex(key, [1024, 96], (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = 'bold 64px system-ui, Tahoma, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.fillText(text, w / 2, h / 2 + 3, w * 0.9);
  }, false);
}

/** شاشة النتائج. */
export function scoreboardTexture() {
  return canvasTex('scoreboard', 512, (g, s) => {
    g.fillStyle = '#0b0f14'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#f2c14e';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.font = 'bold 64px system-ui, Tahoma, sans-serif';
    g.fillText('نهائي كأس الصيف', s / 2, s * 0.28);
    g.fillStyle = '#ffffff';
    g.font = 'bold 110px system-ui, Tahoma, sans-serif';
    g.fillText('الصقور 2 - 2 النجوم', s / 2, s * 0.62, s * 0.94);
    g.fillStyle = '#2cff9a';
    g.font = 'bold 44px system-ui, Tahoma, sans-serif';
    g.fillText('الدقيقة 90+3', s / 2, s * 0.86);
  }, false);
}
