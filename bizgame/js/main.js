// Точка входа: игровой цикл связывает экономику, 3D-мир и интерфейс.
import * as G from './game.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { GOODS } from './data.js';

const DAY_MS = 5000; // длина дня при скорости ×1
const CYCLE_DAYS = 3; // полный цикл день/ночь

const app = {
  state: G.load() || G.newGame(),
  speed: 1,
  acc: 0,
  act(fn) { const r = fn(); world.syncPlots(app.state); world.syncBuildings(app.state); ui.renderTop(app.acc / DAY_MS); return r; },
  select(i, j, focus = false) {
    world.setSelected(i, j);
    ui.select(i, j);
    if (focus && i != null) world.focus(i, j);
  },
  newGame() {
    G.wipeSave();
    location.reload();
  },
};

const world = new World(document.getElementById('scene'), {
  onPick: (i, j) => app.select(i, j),
});
app.world = world;
const ui = new UI(app);

world.syncPlots(app.state);
world.syncBuildings(app.state);
setSpeed(1);
ui.renderTop(0);

document.getElementById('loading').style.opacity = 0;
setTimeout(() => document.getElementById('loading').remove(), 600);
if (app.state.day === 1 && !Object.keys(app.state.buildings).length) ui.openWin('help');

function setSpeed(v) {
  app.speed = v;
  document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === v));
}
document.querySelectorAll('#speed button').forEach(b => b.onclick = () => setSpeed(+b.dataset.speed));
let lastSpeed = 1;
addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); if (app.speed) { lastSpeed = app.speed; setSpeed(0); } else setSpeed(lastSpeed); }
  if (e.key === 'Escape') { if (ui.win) ui.closeWin(); else app.select(null); }
  if (['1', '2', '3'].includes(e.key)) setSpeed([1, 2, 4][+e.key - 1]);
});
document.addEventListener('click', e => { if (e.target.closest('a[data-act]')) e.preventDefault(); }, true);

function runDay() {
  const s = app.state;
  const fx = G.tick(s);
  for (const f of fx) {
    if (f.type === 'truck') world.spawnTruck(s.buildings[f.from], s.buildings[f.to], f.good);
    else if (f.type === 'money') { const b = s.buildings[f.id]; world.floatText(b.i, b.j, '+' + G.fmt(f.amount)); }
    else if (f.type === 'research') { const b = s.buildings[f.id]; world.floatText(b.i, b.j, '🔬 Открытие!', 'info'); }
    else if (f.type === 'quest') ui.toast(`🏆 Задание выполнено! +${G.fmt(f.quest.reward)}`);
    else if (f.type === 'bankrupt') {
      setSpeed(0);
      alert(`Банкротство! Компания «${s.company}» 15 дней не могла расплатиться по счетам. Начнём заново.`);
      app.newGame();
      return;
    }
  }
  // сводные расходы — красной подписью над зданием, если оно ушло в минус
  for (const b of Object.values(s.buildings)) {
    const p = b.last.revenue - b.last.expense;
    if (b.last.revenue === 0 && p < -500 && Math.random() < 0.3) world.floatText(b.i, b.j, G.fmt(p), 'neg');
  }
  world.syncBuildings(s);
  ui.renderSide();
  ui.refreshWin();
  if (s.day % 5 === 0) G.save(s);
}

let prev = performance.now();
function loop(now) {
  const dt = Math.min(now - prev, 250);
  prev = now;
  if (app.speed > 0 && !app.state.bankrupt) {
    app.acc += dt * app.speed;
    if (app.acc >= DAY_MS) { app.acc -= DAY_MS; runDay(); }
  }
  const frac = app.acc / DAY_MS;
  world.setDayPhase((((app.state.day - 1) % CYCLE_DAYS + frac) / CYCLE_DAYS + 0.02) % 1);
  ui.renderTop(frac);
  ui.renderBadges();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('beforeunload', () => G.save(app.state));
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(app.state); });

// для отладки из консоли
window.biz = { app, G, GOODS };
