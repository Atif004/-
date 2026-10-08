// القوائم: الرئيسية، اختيار المرحلة، الإعدادات، الإيقاف المؤقت، شاشة الفوز/الخسارة.
import { LEVELS } from '../config/levels.js';

const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export class Menus {
  constructor(root, save, handlers) {
    this.save = save;
    this.h = handlers; // { start(levelId), resume(), retry(), next(), menu(), click() }
    this.el = document.createElement('div');
    this.el.className = 'menus';
    root.appendChild(this.el);
    this.screen = null;
  }

  hide() { this.el.innerHTML = ''; this.el.className = 'menus'; this.screen = null; }

  render(html, cls) {
    this.el.className = `menus on ${cls}`;
    this.el.innerHTML = html;
    this.el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
      this.h.click();
      const act = b.dataset.act, arg = b.dataset.arg;
      e.stopPropagation();
      this.act(act, arg);
    }));
  }

  act(act, arg) {
    switch (act) {
      case 'play': this.h.start(Math.min(this.save.unlocked, LEVELS.length)); break;
      case 'levels': this.levels(); break;
      case 'settings': this.settings(this.screen); break;
      case 'main': this.main(); break;
      case 'level': this.h.start(Number(arg)); break;
      case 'resume': this.h.resume(); break;
      case 'retry': this.h.retry(); break;
      case 'next': this.h.next(); break;
      case 'menu': this.h.menu(); break;
      case 'back': this.backTo === 'pause' ? this.pause() : this.main(); break;
      case 'reset':
        // تأكيد داخل الصفحة: الضغطة الأولى تطلب التأكيد والثانية تمسح
        if (this.resetArmed) { this.resetArmed = false; this.save.reset(); this.settings(this.backTo); }
        else {
          this.resetArmed = true;
          const b = this.el.querySelector('[data-act="reset"]');
          if (b) b.textContent = 'اضغط مرة أخرى لتأكيد المسح';
        }
        break;
      default: break;
    }
  }

  main() {
    this.screen = 'main';
    this.render(`
      <div class="panel title-panel">
        <div class="logo">💧</div>
        <h1>هروب القوارير</h1>
        <p class="sub">اهرب من المطاردين، استخدم قوارير الماء بحكمة، واوصل إلى نقطة الهروب قبل انتهاء الوقت!</p>
        <button class="btn primary" data-act="play">ابدأ اللعبة</button>
        <button class="btn" data-act="levels">اختيار المرحلة</button>
        <button class="btn" data-act="settings">الإعدادات</button>
        <p class="hint">لعبة أوفلاين بالكامل • التقدم محفوظ على جهازك</p>
      </div>`, 'main');
  }

  levels() {
    this.screen = 'levels';
    const cards = LEVELS.map((L) => {
      const locked = L.id > this.save.unlocked;
      const best = this.save.data.best[L.id];
      const stars = this.save.data.stars[L.id] || 0;
      return `<button class="lvl ${locked ? 'locked' : ''}" ${locked ? 'disabled' : ''} data-act="level" data-arg="${L.id}">
        <div class="num">${locked ? '🔒' : L.id}</div>
        <div class="lname">${L.name}</div>
        <div class="meta">👥 ${L.chasers} • ⏱️ ${fmt(L.time)}${L.exits > 1 ? ` • 🚪 ${L.exits}` : ''}</div>
        <div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        ${best !== undefined ? `<div class="best">أفضل: ${fmt(best)}</div>` : ''}
      </button>`;
    }).join('');
    this.render(`
      <div class="panel wide">
        <h2>اختيار المرحلة</h2>
        <div class="lvl-grid">${cards}</div>
        <button class="btn" data-act="main">رجوع</button>
      </div>`, 'levels');
  }

  settings(from) {
    this.resetArmed = false;
    this.backTo = from === 'pause' ? 'pause' : 'main';
    this.screen = 'settings';
    const s = this.save;
    const q = s.get('quality');
    const tc = s.get('touchControls');
    const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
    this.render(`
      <div class="panel">
        <h2>الإعدادات</h2>
        <h3>الصوت</h3>
        <label class="row">مستوى الصوت <input type="range" min="0" max="1" step="0.05" data-set="master" value="${s.get('master')}"></label>
        <label class="row">الموسيقى <input type="range" min="0" max="1" step="0.05" data-set="music" value="${s.get('music')}"></label>
        <label class="row">المؤثرات <input type="range" min="0" max="1" step="0.05" data-set="sfx" value="${s.get('sfx')}"></label>
        <h3>الرسومات</h3>
        <label class="row">جودة الرسومات
          <select data-set="quality">${opt('auto', q, 'تلقائي')}${opt('low', q, 'منخفضة')}${opt('medium', q, 'متوسطة')}${opt('high', q, 'عالية')}</select>
        </label>
        <h3>التحكم</h3>
        <label class="row">حساسية الكاميرا <input type="range" min="0.3" max="2.5" step="0.1" data-set="sensitivity" value="${s.get('sensitivity')}"></label>
        <label class="row">عكس المحور العمودي <input type="checkbox" data-set="invertY" ${s.get('invertY') ? 'checked' : ''}></label>
        <label class="row">جري تلقائي بدفع العصا (جوال) <input type="checkbox" data-set="autoSprint" ${s.get('autoSprint') ? 'checked' : ''}></label>
        <label class="row">أزرار اللمس
          <select data-set="touchControls">${opt('auto', tc, 'تلقائي')}${opt('on', tc, 'إظهار')}${opt('off', tc, 'إخفاء')}</select>
        </label>
        <div class="controls-help">
          <b>الكمبيوتر:</b> WASD حركة • Shift جري • Space قفز • زر الفأرة الأيسر رمي • الأيمن تصويب • الفأرة للكاميرا (أو اسحب بالفأرة) • Esc إيقاف<br>
          <b>الجوال:</b> العصا للحركة • ⚡ جري • ⤒ قفز • 💧 رمي • اسحب بإصبعك للكاميرا
        </div>
        <button class="btn" data-act="back">رجوع</button>
        <button class="btn danger-btn small" data-act="reset">مسح التقدم</button>
      </div>`, 'settings');
    this.el.querySelectorAll('[data-set]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.set;
        const v = inp.type === 'checkbox' ? inp.checked : inp.type === 'range' ? Number(inp.value) : inp.value;
        s.set(k, v);
      });
    });
  }

  pause() {
    this.screen = 'pause';
    this.render(`
      <div class="panel">
        <h2>إيقاف مؤقت</h2>
        <button class="btn primary" data-act="resume">متابعة</button>
        <button class="btn" data-act="retry">إعادة المحاولة</button>
        <button class="btn" data-act="settings">الإعدادات</button>
        <button class="btn" data-act="menu">القائمة الرئيسية</button>
      </div>`, 'pause');
  }

  result(win, info) {
    this.screen = 'result';
    const hasNext = info.levelId < LEVELS.length && info.levelId < this.save.unlocked;
    const title = win ? 'نجحت في الهروب!' : 'تم الإمساك بك!';
    const sub = win
      ? `الوقت: ${fmt(info.time)}${info.record ? ' • 🏆 رقم قياسي جديد!' : ''}`
      : info.reason === 'time' ? '⏱️ انتهى الوقت قبل الوصول إلى نقطة الهروب' : 'حاول المراوغة واستخدام القوارير لإبطائهم';
    const stars = win ? `<div class="big-stars">${'★'.repeat(info.stars)}${'☆'.repeat(3 - info.stars)}</div>` : '';
    const lastWin = win && info.levelId === LEVELS.length;
    this.render(`
      <div class="panel result ${win ? 'win' : 'lose'}">
        <div class="result-icon">${win ? '🏁' : '✋'}</div>
        <h1>${title}</h1>
        ${stars}
        <p class="sub">${sub}</p>
        ${lastWin ? '<p class="sub">🎉 أنهيت جميع المراحل! أنت بطل الهروب.</p>' : ''}
        <button class="btn ${win ? '' : 'primary'}" data-act="retry">إعادة المحاولة</button>
        <button class="btn ${win ? 'primary' : ''}" data-act="next" ${hasNext ? '' : 'disabled'}>المرحلة التالية</button>
        <button class="btn" data-act="menu">العودة للقائمة الرئيسية</button>
      </div>`, win ? 'result-win' : 'result-lose');
  }

  intro(level) {
    this.screen = 'intro';
    this.render(`
      <div class="intro">
        <div class="intro-num">المرحلة ${level.id}</div>
        <div class="intro-name">${level.name}</div>
        <div class="intro-goal">🎯 اوصل إلى نقطة الهروب الخضراء • 👥 ${level.chasers} مطاردين</div>
      </div>`, 'intro-screen');
  }
}
