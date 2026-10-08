// حفظ التقدم والإعدادات محليًا على الجهاز (localStorage) — بدون خادم أو حساب.

const KEY = 'harib-escape-save-v1';

const DEFAULTS = {
  unlocked: 1,
  best: {},          // levelId -> أفضل وقت (ثوانٍ)
  stars: {},         // levelId -> 1..3
  settings: {
    master: 0.8,
    music: 0.6,
    sfx: 0.9,
    quality: 'auto',  // low | medium | high | auto
    sensitivity: 1,
    invertY: false,
    autoSprint: true,
    touchControls: 'auto', // auto | on | off
  },
};

export class SaveSystem {
  constructor() {
    this.data = structuredClone(DEFAULTS);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.data = { ...this.data, ...d, settings: { ...DEFAULTS.settings, ...(d.settings || {}) } };
      }
    } catch { /* تخزين غير متاح — نستمر بالقيم الافتراضية */ }
    this.listeners = [];
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* تجاهل */ }
  }

  get(name) { return this.data.settings[name]; }
  set(name, value) {
    this.data.settings[name] = value;
    this.save();
    this.listeners.forEach((f) => f(name, value));
  }
  onChange(f) { this.listeners.push(f); }

  get unlocked() { return this.data.unlocked; }

  /** يسجل فوزًا ويفتح المرحلة التالية. يعيد true إذا كان رقمًا قياسيًا. */
  recordWin(levelId, time, stars, totalLevels) {
    const prev = this.data.best[levelId];
    const record = prev === undefined || time < prev;
    if (record) this.data.best[levelId] = time;
    this.data.stars[levelId] = Math.max(this.data.stars[levelId] || 0, stars);
    this.data.unlocked = Math.min(totalLevels, Math.max(this.data.unlocked, levelId + 1));
    this.save();
    return record;
  }

  reset() {
    const settings = this.data.settings;
    this.data = structuredClone(DEFAULTS);
    this.data.settings = settings;
    this.save();
  }
}
