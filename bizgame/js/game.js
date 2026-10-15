// Экономическая модель: состояние игры и расчёт одного игрового дня.
// Модуль не знает ни про DOM, ни про 3D — только данные.
import {
  GOODS, RECIPES, BUILDINGS, MARKET_SALARY, IMPORT_MARKUP, WHOLESALE_RATE, NPC_QUALITY,
  SHOP_UNITS_PER_WORKER, TRANSPORT_PER_UNIT, START_MONEY, GRID, isRoad, RIVALS, EVENTS,
} from './data.js';

const SAVE_KEY = 'bizgame-save-v1';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 10) / 10;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export const QUESTS = [
  { id: 'farm',     text: 'Постройте ферму, лесхоз или шахту', reward: 10000, check: s => has(s, b => ['farm', 'forestry', 'mine'].includes(b.type)) },
  { id: 'factory',  text: 'Постройте завод',                   reward: 15000, check: s => has(s, b => b.type === 'factory') },
  { id: 'contract', text: 'Настройте поставку между зданиями', reward: 10000, check: s => s.contracts.length > 0 },
  { id: 'shop',     text: 'Откройте магазин',                   reward: 15000, check: s => has(s, b => b.type === 'shop') },
  { id: 'sale',     text: 'Продайте товаров в магазине на 5 000 ₽ за день', reward: 20000, check: s => s.lastShopRevenue >= 5000 },
  { id: 'lab',      text: 'Доведите любую технологию до 3-го уровня', reward: 40000, check: s => Object.values(s.tech).some(v => v >= 3) },
  { id: 'worth',    text: 'Капитал компании 500 000 ₽',          reward: 50000, check: s => netWorth(s) >= 500000 },
  { id: 'top',      text: 'Займите 1-е место в рейтинге',        reward: 100000, check: s => rating(s)[0].player },
];
const has = (s, fn) => Object.values(s.buildings).some(fn);

export function newGame() {
  const s = {
    version: 1, day: 1, money: START_MONEY, loan: 0, nextId: 1,
    marketSalary: MARKET_SALARY, debtDays: 0, bankrupt: false,
    prices: {}, priceMods: {}, demandMods: {}, tech: {},
    plots: {}, buildings: {}, contracts: [],
    history: [], news: [], quests: {}, lastShopRevenue: 0,
    rivals: RIVALS.map(r => ({ ...r, worth: 180000 + Math.random() * 220000 })),
    company: 'Моя компания',
  };
  for (const g in GOODS) { s.prices[g] = GOODS[g].price; s.tech[g] = 0; }
  const c = (GRID - 1) / 2;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (isRoad(i, j)) continue;
    const d = Math.hypot(i - c, j - c) / Math.hypot(c, c); // 0 в центре, 1 в углу
    const central = 1 - d;
    const r = Math.random();
    let kind = null;
    if (r < 0.15 + central * 0.45) kind = 'npc';
    else if (r < 0.22 + central * 0.45) kind = 'park';
    s.plots[key(i, j)] = {
      i, j, kind,
      price: Math.round((6000 + central * central * 60000) / 500) * 500,
      loc: round1(0.6 + central * 1.1),
      height: kind === 'npc' ? 6 + Math.random() * (8 + central * 40) : 0,
      owner: kind === 'npc' ? Math.floor(Math.random() * RIVALS.length) : null,
    };
  }
  // стартовые свободные участки рядом с центром, чтобы было где строиться
  for (const [i, j] of [[5, 5], [6, 7], [10, 11], [3, 9]]) {
    const p = s.plots[key(i, j)]; p.kind = null; p.height = 0; p.owner = null;
  }
  addNews(s, `Добро пожаловать в город! Стартовый капитал — ${fmt(START_MONEY)}.`);
  pushHistory(s, 0, 0);
  return s;
}

export const key = (i, j) => `${i},${j}`;

export function save(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.version === 1 ? s : null;
  } catch { return null; }
}
export function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* нет доступа */ } }

// ---------- запасы ----------
export const stockQty = (b, g) => b.stock[g]?.qty || 0;
export const stockTotal = b => Object.values(b.stock).reduce((a, x) => a + x.qty, 0);
export const capacity = b => BUILDINGS[b.type].storage * b.level;
export const maxWorkers = b => BUILDINGS[b.type].workers * b.level;
export const freeSpace = b => Math.max(0, capacity(b) - stockTotal(b));

function addStock(b, g, qty, qual) {
  if (qty <= 0) return;
  const cur = b.stock[g] || (b.stock[g] = { qty: 0, q: qual });
  cur.q = round1((cur.q * cur.qty + qual * qty) / (cur.qty + qty));
  cur.qty += qty;
}
function takeStock(b, g, qty) {
  const cur = b.stock[g];
  if (!cur) return 0;
  cur.qty -= qty;
  const q = cur.q;
  if (cur.qty <= 0.001) delete b.stock[g];
  return q;
}

// ---------- строительство ----------
export function plotCost(s, i, j) { return s.plots[key(i, j)]?.price || 0; }
export function buildingAt(s, i, j) { return Object.values(s.buildings).find(b => b.i === i && b.j === j); }

export function canBuild(s, type, i, j) {
  const p = s.plots[key(i, j)];
  if (!p) return 'Здесь дорога';
  if (p.kind === 'npc') return 'Участок занят другой компанией';
  if (buildingAt(s, i, j)) return 'Участок уже застроен';
  const cost = BUILDINGS[type].cost + (p.kind === 'park' ? p.price * 1.5 : p.price);
  if (s.money < cost) return `Не хватает денег: нужно ${fmt(cost)}`;
  return null;
}
export function buildCost(s, type, i, j) {
  const p = s.plots[key(i, j)];
  return BUILDINGS[type].cost + (p.kind === 'park' ? p.price * 1.5 : p.price);
}

export function build(s, type, i, j) {
  const err = canBuild(s, type, i, j);
  if (err) return { error: err };
  const cost = buildCost(s, type, i, j);
  s.money -= cost;
  const p = s.plots[key(i, j)];
  p.kind = 'player';
  const def = BUILDINGS[type];
  const b = {
    id: s.nextId++, type, i, j, level: 1, invested: cost,
    workers: 0, target: def.workers, salary: s.marketSalary,
    recipe: Object.keys(RECIPES).find(r => RECIPES[r].building === type) || null,
    stock: {}, buy: {}, autoSell: {}, prices: {}, research: null, progress: 0,
    last: { revenue: 0, expense: 0, produced: {}, sold: {} }, built: s.day,
  };
  s.buildings[b.id] = b;
  addNews(s, `Построено: ${def.name} (${fmt(cost)})`);
  return { building: b };
}

export const upgradeCost = b => Math.round(BUILDINGS[b.type].cost * 0.8 * b.level);
export function upgrade(s, id) {
  const b = s.buildings[id];
  if (!b || b.level >= 3) return { error: 'Максимальный уровень' };
  const cost = upgradeCost(b);
  if (s.money < cost) return { error: `Нужно ${fmt(cost)}` };
  s.money -= cost; b.invested += cost; b.level++;
  b.target = maxWorkers(b);
  addNews(s, `${BUILDINGS[b.type].name} расширен до ${b.level}-го уровня`);
  return { ok: true };
}

export function demolish(s, id) {
  const b = s.buildings[id];
  if (!b) return;
  const refund = Math.round(b.invested * 0.4);
  s.money += refund;
  s.contracts = s.contracts.filter(c => c.from !== id && c.to !== id);
  s.plots[key(b.i, b.j)].kind = null;
  delete s.buildings[id];
  addNews(s, `${BUILDINGS[b.type].name} продан, получено ${fmt(refund)}`);
}

// ---------- поставки ----------
export const dist = (a, b) => Math.max(1, Math.abs(a.i - b.i) + Math.abs(a.j - b.j));
export function addContract(s, from, to, good, qty) {
  if (from === to) return { error: 'Нельзя возить в то же здание' };
  const A = s.buildings[from], B = s.buildings[to];
  if (!A || !B) return { error: 'Здание не найдено' };
  if (B.type === 'lab') return { error: 'НИИ не принимает товары' };
  if (B.type === 'shop' && GOODS[good].kind !== 'retail') return { error: 'Магазин продаёт только потребительские товары' };
  s.contracts.push({ id: s.nextId++, from, to, good, qty: Math.max(1, Math.round(qty)) });
  return { ok: true };
}
export function removeContract(s, id) { s.contracts = s.contracts.filter(c => c.id !== id); }

// ---------- рынок и финансы ----------
export const buyPrice = (s, g) => round1(s.prices[g] * IMPORT_MARKUP);
export const sellPrice = (s, g, q = NPC_QUALITY) => round1(s.prices[g] * WHOLESALE_RATE * (0.8 + 0.067 * q));

export function sellToMarket(s, b, g, qty) {
  qty = Math.min(qty, stockQty(b, g));
  if (qty <= 0) return 0;
  const q = b.stock[g].q;
  const sum = Math.round(qty * sellPrice(s, g, q));
  takeStock(b, g, qty);
  s.money += sum;
  return sum;
}

export const maxLoan = s => Math.max(0, Math.round((netWorth(s) * 0.5) / 1000) * 1000);
export function takeLoan(s, amount) {
  amount = Math.min(amount, maxLoan(s));
  if (amount <= 0) return { error: 'Банк отказал: недостаточно капитала' };
  s.loan += amount; s.money += amount;
  addNews(s, `Взят кредит ${fmt(amount)} под 0,1% в день`);
  return { ok: true };
}
export function repayLoan(s, amount) {
  amount = Math.min(amount, s.loan, Math.max(0, s.money));
  if (amount <= 0) return;
  s.loan -= amount; s.money -= amount;
}

export function netWorth(s) {
  let w = s.money - s.loan;
  for (const b of Object.values(s.buildings)) {
    w += b.invested * 0.6;
    for (const g in b.stock) w += b.stock[g].qty * s.prices[g] * 0.6;
  }
  return Math.round(w);
}

export function rating(s) {
  const list = s.rivals.map(r => ({ name: r.name, color: r.color, worth: Math.round(r.worth), player: false }));
  list.push({ name: s.company, color: '#3b82f6', worth: netWorth(s), player: true });
  return list.sort((a, b) => b.worth - a.worth);
}

// ---------- расчёт эффективности ----------
export const salaryEff = (s, b) => clamp(0.5 + 0.5 * b.salary / s.marketSalary, 0.6, 1.3);
export function techQuality(s, g) { return 2 + s.tech[g] * 0.8; }

// Прогноз выпуска для подсказки в интерфейсе
export function productionInfo(s, b) {
  const r = RECIPES[b.recipe];
  if (!r) return null;
  const staff = b.workers / maxWorkers(b);
  const maxOut = r.rate * b.level * staff * salaryEff(s, b);
  let limit = maxOut, limitBy = null;
  for (const g in r.inputs) {
    const can = stockQty(b, g) / r.inputs[g];
    if (can < limit) { limit = can; limitBy = g; }
  }
  return { maxOut: Math.floor(maxOut), out: Math.floor(limit), limitBy };
}

// ---------- игровой день ----------
export function tick(s) {
  const fx = [];
  const day = { income: 0, expense: 0 };
  const list = Object.values(s.buildings);
  for (const b of list) b.last = { revenue: 0, expense: 0, produced: {}, sold: {} };
  const spend = (b, v) => { s.money -= v; day.expense += v; if (b) b.last.expense += v; };
  const earn = (b, v) => { s.money += v; day.income += v; if (b) b.last.revenue += v; };

  // 1. Найм и увольнения
  for (const b of list) {
    const max = maxWorkers(b);
    b.target = clamp(b.target, 0, max);
    if (b.salary < s.marketSalary * 0.7) {
      b.workers = Math.floor(b.workers * 0.9);
    } else if (b.workers < b.target) {
      b.workers = Math.min(b.target, b.workers + Math.ceil(max * 0.25));
    }
    if (b.workers > b.target) b.workers = b.target;
  }

  // 2. Закупки на оптовом рынке
  for (const b of list) {
    for (const g in b.buy) {
      const want = Math.min(b.buy[g], freeSpace(b));
      if (want <= 0) continue;
      const price = buyPrice(s, g);
      const qty = Math.floor(Math.min(want, Math.max(0, s.money) / price));
      if (qty <= 0) continue;
      addStock(b, g, qty, 2);
      spend(b, qty * price);
    }
  }

  // 3. Поставки между своими зданиями
  for (const c of s.contracts) {
    const A = s.buildings[c.from], B = s.buildings[c.to];
    if (!A || !B) continue;
    const qty = Math.floor(Math.min(c.qty, stockQty(A, c.good), freeSpace(B)));
    if (qty <= 0) continue;
    const q = takeStock(A, c.good, qty);
    addStock(B, c.good, qty, q);
    spend(A, Math.round(qty * TRANSPORT_PER_UNIT * dist(A, B)));
    fx.push({ type: 'truck', from: A.id, to: B.id, good: c.good });
  }

  // 4. Производство
  for (const b of list) {
    const r = RECIPES[b.recipe];
    if (!r || BUILDINGS[b.type].storage === 0) continue;
    const info = productionInfo(s, b);
    let n = info.out;
    const inSum = Object.values(r.inputs).reduce((a, v) => a + v, 0);
    const netGrow = 1 - inSum;
    if (netGrow > 0) n = Math.min(n, freeSpace(b) / netGrow);
    n = Math.floor(n);
    if (n <= 0) continue;
    let inQ = 0, inW = 0;
    for (const g in r.inputs) {
      const need = n * r.inputs[g];
      inQ += takeStock(b, g, need) * r.inputs[g];
      inW += r.inputs[g];
    }
    const staffBonus = (salaryEff(s, b) - 1) * 3;
    const tq = techQuality(s, b.recipe);
    const q = inW ? 0.6 * (inQ / inW) + 0.4 * tq + 0.5 + staffBonus : tq + staffBonus;
    addStock(b, b.recipe, n, round1(clamp(q, 1, 10)));
    b.last.produced[b.recipe] = n;
    fx.push({ type: 'produce', id: b.id });
  }

  // 5. Продажи в магазинах
  let shopRevenue = 0;
  for (const b of list) {
    if (b.type !== 'shop') continue;
    const p = s.plots[key(b.i, b.j)];
    const cap = b.workers * SHOP_UNITS_PER_WORKER * salaryEff(s, b);
    const wants = {};
    let total = 0;
    for (const g in b.stock) {
      const def = GOODS[g];
      if (def.kind !== 'retail') continue;
      const price = b.prices[g] ?? def.price;
      const ref = s.prices[g];
      const attr = Math.pow(b.stock[g].q / NPC_QUALITY, 0.6) * Math.pow(ref / price, 2.5);
      const share = attr / (attr + 1);
      const demand = def.demand * p.loc * (s.demandMods[g]?.mult || 1) * (1 + 0.5 * (b.level - 1));
      wants[g] = Math.min(stockQty(b, g), demand * share * 2 * (0.9 + Math.random() * 0.2));
      total += wants[g];
    }
    const k = total > cap ? cap / total : 1;
    for (const g in wants) {
      const qty = Math.floor(wants[g] * k);
      if (qty <= 0) continue;
      const price = b.prices[g] ?? GOODS[g].price;
      takeStock(b, g, qty);
      earn(b, Math.round(qty * price));
      b.last.sold[g] = qty;
    }
    shopRevenue += b.last.revenue;
    if (b.last.revenue > 0) fx.push({ type: 'money', id: b.id, amount: b.last.revenue });
  }
  s.lastShopRevenue = shopRevenue;

  // 6. Автопродажа на оптовый рынок
  for (const b of list) {
    let sum = 0;
    for (const g in b.autoSell) {
      if (!b.autoSell[g]) continue;
      const qty = stockQty(b, g);
      if (qty <= 0) continue;
      const v = Math.round(qty * sellPrice(s, g, b.stock[g].q));
      takeStock(b, g, qty);
      earn(b, v); sum += v;
      b.last.sold[g] = (b.last.sold[g] || 0) + qty;
    }
    if (sum > 0) fx.push({ type: 'money', id: b.id, amount: sum });
  }

  // 7. Исследования
  for (const b of list) {
    if (b.type !== 'lab' || !b.research) continue;
    const lvl = s.tech[b.research];
    if (lvl >= 10) continue;
    b.progress += b.workers * salaryEff(s, b) * b.level;
    const need = researchCost(lvl);
    if (b.progress >= need) {
      b.progress -= need;
      s.tech[b.research] = lvl + 1;
      addNews(s, `🔬 Открытие! Технология «${GOODS[b.research].name}» — уровень ${lvl + 1}`);
      fx.push({ type: 'research', id: b.id });
    }
  }

  // 8. Расходы
  for (const b of list) {
    spend(b, b.workers * b.salary);
    spend(b, BUILDINGS[b.type].upkeep * b.level);
    spend(b, Math.round(s.plots[key(b.i, b.j)].price * 0.0005));
  }
  if (s.loan > 0) spend(null, Math.round(s.loan * 0.001));

  // 9. Рынок, события, конкуренты
  for (const g in s.prices) {
    const mod = s.priceMods[g];
    const target = GOODS[g].price * (mod ? mod.mult : 1);
    s.prices[g] = round1(Math.max(1, s.prices[g] * (1 + (Math.random() - 0.5) * 0.04) + (target - s.prices[g]) * 0.12));
  }
  for (const m of [s.priceMods, s.demandMods]) for (const g in m) if (--m[g].days <= 0) delete m[g];
  if (Math.random() < 0.07) fx.push(...randomEvent(s));
  for (const r of s.rivals) r.worth *= 1 + 0.002 + Math.random() * 0.008;

  // 10. Итоги дня
  s.day++;
  s.debtDays = s.money < 0 ? s.debtDays + 1 : 0;
  if (s.debtDays >= 15) { s.bankrupt = true; fx.push({ type: 'bankrupt' }); }
  else if (s.debtDays === 1) addNews(s, '⚠️ Счёт ушёл в минус! 15 дней в минусе — банкротство.');
  pushHistory(s, day.income, day.expense);
  for (const q of QUESTS) {
    if (!s.quests[q.id] && q.check(s)) {
      s.quests[q.id] = true;
      s.money += q.reward;
      addNews(s, `🏆 Задание выполнено: «${q.text}» +${fmt(q.reward)}`);
      fx.push({ type: 'quest', quest: q });
    }
  }
  return fx;
}

export const researchCost = lvl => Math.round(100 * Math.pow(lvl + 1, 1.3));

function randomEvent(s) {
  const e = pick(EVENTS);
  if (e.type === 'salary') {
    s.marketSalary = round1(s.marketSalary * e.mult);
    addNews(s, `📰 ${e.text()} (до ${s.marketSalary} ₽/день)`);
    return [{ type: 'event' }];
  }
  const g = pick(e.goods);
  const name = GOODS[g].name.toLowerCase();
  const days = 10 + Math.floor(Math.random() * 15);
  if (e.type === 'price') s.priceMods[g] = { mult: e.mult, days };
  else s.demandMods[g] = { mult: e.mult, days };
  addNews(s, `📰 ${e.text(name)}`);
  return [{ type: 'event' }];
}

function pushHistory(s, income, expense) {
  s.history.push({ day: s.day, money: Math.round(s.money), worth: netWorth(s), income: Math.round(income), expense: Math.round(expense) });
  if (s.history.length > 120) s.history.shift();
}
export function addNews(s, text) {
  s.news.unshift({ day: s.day, text });
  if (s.news.length > 60) s.news.pop();
}

export function fmt(v) {
  const sign = v < 0 ? '−' : '';
  return sign + Math.round(Math.abs(v)).toLocaleString('ru-RU') + ' ₽';
}
