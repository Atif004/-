// إعدادات المراحل. كل مرحلة تحدد حجم الخريطة وعدد المطاردين وسرعتهم ومستوى ذكائهم.
// ai: قيم من 0 (بسيط) إلى 1 (متقدم) تُستخدم لاشتقاق معاملات الإدراك والتكتيك.

// map: 'stadium' (الملعب) أو 'city' (المدينة). stadium: أبعاد أرض الملعب [طول، عرض]، عرض المضمار،
// عمق المدرجات، عرض الممشى الخارجي، عدد الأنفاق [جهة طويلة، جهة قصيرة]، الأكشاك، مجموعات المشجعين.
export const LEVELS = [
  {
    id: 1, name: 'ملعب الحي', seed: 11, map: 'stadium',
    stadium: { pitch: [64, 40], track: 7, stand: 12, concourse: 13, tunnels: [2, 1], kiosks: 4, fanGroups: 4 },
    blocks: 3, exits: 1, chasers: 2, chaserSpeed: 5.0, time: 150,
    ai: 0.0, startBottles: 6, pickups: 3, barriers: 6, cars: 14,
  },
  {
    id: 2, name: 'ملعب النادي', seed: 23, map: 'stadium',
    stadium: { pitch: [70, 44], track: 7, stand: 13, concourse: 14, tunnels: [2, 1], kiosks: 6, fanGroups: 6 },
    blocks: 3, exits: 1, chasers: 3, chaserSpeed: 5.6, time: 130,
    ai: 0.2, startBottles: 6, pickups: 4, barriers: 9, cars: 20,
  },
  {
    id: 3, name: 'استاد المدينة', seed: 37, map: 'stadium',
    stadium: { pitch: [80, 50], track: 7, stand: 14, concourse: 15, tunnels: [2, 1], kiosks: 7, fanGroups: 8 },
    blocks: 4, exits: 1, chasers: 4, chaserSpeed: 6.1, time: 120,
    ai: 0.5, startBottles: 7, pickups: 5, barriers: 12, cars: 28,
  },
  {
    id: 4, name: 'نصف النهائي', seed: 41, map: 'stadium',
    stadium: { pitch: [86, 54], track: 8, stand: 15, concourse: 15, tunnels: [4, 2], kiosks: 8, fanGroups: 9 },
    blocks: 4, exits: 2, chasers: 5, chaserSpeed: 6.5, time: 80,
    ai: 0.7, startBottles: 7, pickups: 6, barriers: 14, cars: 30,
  },
  {
    id: 5, name: 'النهائي الكبير', seed: 59, map: 'stadium',
    stadium: { pitch: [96, 60], track: 8, stand: 16, concourse: 16, tunnels: [4, 2], kiosks: 10, fanGroups: 12 },
    blocks: 5, exits: 3, chasers: 6, chaserSpeed: 7.0, time: 85,
    ai: 1.0, startBottles: 8, pickups: 7, barriers: 18, cars: 40,
  },
];

const lerp = (a, b, t) => a + (b - a) * t;

/** يحوّل مستوى الذكاء (0..1) إلى معاملات تفصيلية لنظام AI. */
export function aiParams(level) {
  const t = level.ai;
  return {
    viewRange: lerp(18, 32, t),
    fov: lerp(100, 160, t) * Math.PI / 180,
    hearWalk: lerp(3.5, 7, t),
    hearSprint: lerp(7, 14, t),
    memory: lerp(2.5, 7, t),          // ثوانٍ قبل فقدان اللاعب بعد اختفائه
    loseRange: lerp(30, 48, t),       // مسافة يفقد بعدها المطارد اللاعب
    reaction: lerp(0.8, 0.15, t),     // تأخير قبل بدء المطاردة
    repath: lerp(0.8, 0.25, t),
    lead: lerp(0, 0.9, t),            // توقع حركة اللاعب (ثوانٍ)
    interceptShare: lerp(0, 0.5, t),  // نسبة المطاردين الذين يقطعون طريق الهروب
    guardExit: t >= 0.5,              // مطارد يحرس منطقة المخرج
    alertRadius: lerp(0, 120, t),     // تنبيه بقية المطاردين
    attackCooldown: lerp(1.6, 0.95, t),
    attackWindup: lerp(0.45, 0.28, t),
    damage: lerp(12, 20, t),
    searchTime: lerp(5, 10, t),
  };
}
