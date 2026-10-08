// نقطة الدخول: ربط الأنظمة ببعضها وتشغيل حلقة اللعب.
import './style.css';
import { SaveSystem } from './save/SaveSystem.js';
import { Renderer } from './core/Renderer.js';
import { Input } from './core/Input.js';
import { AudioManager } from './audio/AudioManager.js';
import { HUD } from './ui/HUD.js';
import { Menus } from './ui/Menus.js';
import { TouchControls } from './ui/TouchControls.js';
import { Game } from './core/Game.js';

const app = document.getElementById('app');
const save = new SaveSystem();
const renderer = new Renderer(app, save);
const input = new Input(renderer.renderer.domElement, save);
const audio = new AudioManager(save);
const ui = document.getElementById('ui');
const hud = new HUD(ui);
hud.show(false);
const touch = new TouchControls(ui, input);
touch.show(false);

let game;
const menus = new Menus(ui, save, {
  start: (id) => game.start(id),
  resume: () => game.resume(),
  retry: () => game.retry(),
  next: () => game.next(),
  menu: () => game.toMenu(),
  click: () => { audio.unlock(); audio.play('click'); },
});
game = new Game({ renderer, input, audio, hud, menus, save, touch });
window.__game = game; // للتصحيح

hud.pauseBtn.addEventListener('click', () => game.pause());
hud.pauseBtn.addEventListener('touchstart', (e) => { e.preventDefault(); game.pause(); }, { passive: false });

// فقدان قفل المؤشر (Esc في المتصفح) أو تبديل التطبيق = إيقاف مؤقت
let wasLocked = false;
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.renderer.domElement;
  if (wasLocked && !locked && game.state === 'playing') game.pause();
  wasLocked = locked;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });
save.onChange((k) => { if (k === 'touchControls') game.updateTouchVisibility(); });
addEventListener('touchstart', () => game.updateTouchVisibility(), { passive: true, once: true });
addEventListener('pointerdown', () => audio.unlock(), { once: true });

// تقليل إمكانية التكبير/التمرير على الجوال
document.addEventListener('gesturestart', (e) => e.preventDefault());

game.toMenu();
document.getElementById('loading')?.remove();

function loop() {
  requestAnimationFrame(loop);
  game.frame();
}
loop();

// عامل خدمة للعمل أوفلاين عند التشغيل عبر خادم/تثبيت كتطبيق (PWA)
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !import.meta.env.DEV) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
