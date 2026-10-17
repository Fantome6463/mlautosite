// Точка входа: игровой цикл связывает экономику, 3D-мир и интерфейс.
import * as G from './game.js';
import * as P from './production.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { Thumbs } from './thumbs.js';
import { GOODS, BUILDINGS } from './data.js';

const CYCLE_DAYS = 3; // полный цикл день/ночь в 3D
const DEFAULTS = { dayLengthSeconds: 60 };

const app = {
  state: G.load() || G.newGame(),
  settings: { ...DEFAULTS, fromServer: false },
  speed: 1,
  acc: 0,
  get dayMs() { return Math.max(5, this.settings.dayLengthSeconds) * 1000; },
  act(fn) { const r = fn(); world.syncPlots(app.state); world.syncBuildings(app.state); renderTop(); return r; },
  select(i, j, focus = false) {
    const b = i == null ? null : G.buildingAt(app.state, i, j);
    if (i != null) ui.showCity();
    world.setSelected(i, j, b && b.state === 'done' ? BUILDINGS[b.type].radius || 0 : 0);
    ui.selectPlot(i, j);
    if (focus && i != null) world.focus(i, j);
  },
  selectEnt(id) {
    const e = app.state.enterprises[id], h = e?.host && app.state.buildings[e.host];
    world.setSelected(h ? h.i : null, h ? h.j : null);
    ui.selectEnt(id);
  },
  newGame() {
    G.wipeSave();
    location.reload();
  },
};

// Настройки сервера: settings.json рядом с игрой (его пишет BizCity.exe).
// Перечитываем раз в 20 секунд, чтобы изменения применялись без перезагрузки.
async function loadSettings() {
  try {
    const r = await fetch('settings.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const sec = Number(j.dayLengthSeconds);
    const next = { ...DEFAULTS, ...j, dayLengthSeconds: sec >= 5 ? sec : DEFAULTS.dayLengthSeconds, fromServer: true };
    if (next.dayLengthSeconds !== app.settings.dayLengthSeconds) {
      app.acc *= next.dayLengthSeconds / app.settings.dayLengthSeconds; // сохраняем долю прошедшего дня
      if (app.settings.fromServer) ui.toast(`⚙️ Сервер: длина дня теперь ${next.dayLengthSeconds} сек.`);
    }
    app.settings = next;
  } catch {
    app.settings = { ...app.settings, fromServer: false };
  }
}

const world = new World(document.getElementById('scene'), {
  onPick: (i, j) => app.select(i, j),
});
app.world = world;
app.thumbs = new Thumbs();
const ui = new UI(app);
const renderTop = () => ui.renderTop(app.dayMs - app.acc, app.speed);

world.syncPlots(app.state);
world.syncBuildings(app.state);
setSpeed(1);
await loadSettings();
setInterval(loadSettings, 20000);
ui.openPage('company', 'main');
renderTop();

document.getElementById('loading').style.opacity = 0;
setTimeout(() => document.getElementById('loading').remove(), 600);
if (app.state.day === 1 && !Object.values(app.state.buildings).some(G.isPlayer) && !Object.keys(app.state.enterprises).length) ui.openPage('help');

function setSpeed(v) {
  app.speed = v;
  document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === v));
}
document.querySelectorAll('#speed button').forEach(b => b.onclick = () => setSpeed(+b.dataset.speed));
let lastSpeed = 1;
addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); if (app.speed) { lastSpeed = app.speed; setSpeed(0); } else setSpeed(lastSpeed); }
  if (e.key === 'Escape') app.select(null);
});
document.addEventListener('click', e => { if (e.target.closest('a[data-act]')) e.preventDefault(); }, true);

function runDay() {
  const s = app.state;
  const fx = G.tick(s);
  for (const f of fx) {
    if (f.type === 'money') {
      const b = f.id ? s.buildings[f.id] : null;
      world.floatText(b ? b.i : f.i, b ? b.j : f.j, (f.amount >= 0 ? '+' : '') + G.fmt(f.amount), f.amount < 0 ? 'neg' : '');
    } else if (f.type === 'built') {
      const b = s.buildings[f.id];
      if (b && b.owner === 'player') { world.floatText(b.i, b.j, 'Достроено!', 'info'); ui.toast(`🎉 ${BUILDINGS[b.type].name} №${b.id} достроен!`); }
    } else if (f.type === 'quest') ui.toast(`🏆 Задание выполнено! +${G.fmt(f.quest.reward)}`);
    else if (f.type === 'bankrupt') {
      setSpeed(0);
      alert(`Банкротство! Компания «${s.company}» 15 дней не могла расплатиться по счетам. Начнём заново.`);
      app.newGame();
      return;
    }
  }
  world.syncPlots(s);
  world.syncBuildings(s);
  ui.renderSide();
  ui.refreshWin();
  G.save(s);
}

let prev = performance.now();
function loop(now) {
  const dt = Math.min(now - prev, 250);
  prev = now;
  if (app.speed > 0 && !app.state.bankrupt) {
    app.acc += dt * app.speed;
    if (app.acc >= app.dayMs) { app.acc = 0; runDay(); }
  }
  const frac = app.acc / app.dayMs;
  world.setDayPhase((((app.state.day - 1) % CYCLE_DAYS + frac) / CYCLE_DAYS + 0.02) % 1);
  renderTop();
  if (!world.paused) ui.renderBadges();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('beforeunload', () => G.save(app.state));
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(app.state); });

// для отладки из консоли
window.biz = { app, G, P, GOODS };
