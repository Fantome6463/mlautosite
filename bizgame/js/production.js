// Виртуальные предприятия: фермы, шахты, заводы, склады, НИИ и магазины.
// На карте их нет — кроме магазинов, которые занимают коммерческое помещение жилого дома.
import {
  GOODS, RECIPES, ENTERPRISES, MARKET_SALARY, IMPORT_MARKUP, WHOLESALE_RATE, NPC_QUALITY,
  SHOP_UNITS_PER_WORKER, TRANSPORT_PER_UNIT, DEPOT,
} from './data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 10) / 10;

export function initProduction(s) {
  s.marketSalary = MARKET_SALARY;
  s.prices = {}; s.priceMods = {}; s.demandMods = {}; s.tech = {};
  s.depot = {};
  for (const g in GOODS) { s.prices[g] = GOODS[g].price; s.tech[g] = 0; s.depot[g] = depotStart(g); }
  s.enterprises = {};
  s.contracts = [];
  s.lastShopRevenue = 0;
}

// Универсальные склады: стартовый запас товара
export const depotStart = g => DEPOT[GOODS[g].kind].start;

// ---------- запасы ----------
export const stockQty = (e, g) => e.stock[g]?.qty || 0;
export const stockTotal = e => Object.values(e.stock).reduce((a, x) => a + x.qty, 0);
export const capacity = e => ENTERPRISES[e.type].storage * e.level;
export const maxWorkers = e => ENTERPRISES[e.type].workers * e.level;
export const freeSpace = e => Math.max(0, capacity(e) - stockTotal(e));

function addStock(e, g, qty, q) {
  if (qty <= 0) return;
  const cur = e.stock[g] || (e.stock[g] = { qty: 0, q });
  cur.q = round1((cur.q * cur.qty + q * qty) / (cur.qty + qty));
  cur.qty += qty;
}
export function takeStock(e, g, qty) {
  const cur = e.stock[g];
  if (!cur) return 0;
  cur.qty -= qty;
  const q = cur.q;
  if (cur.qty <= 0.001) delete e.stock[g];
  return q;
}

// ---------- магазины в городе ----------
export const shopsIn = (s, b) => Object.values(s.enterprises).filter(e => e.host === b.id);
export function shopSlots(s, b) {
  const u = b.units?.comm;
  if (!u || b.state !== 'done') return 0;
  return u.total - u.occ - shopsIn(s, b).length + (b.owner === 'player' ? u.occ : 0);
}
// Здания, где можно открыть магазин: свободное помещение у кого угодно,
// а в своём доме — даже занятое (арендатора попросят съехать).
export function shopHosts(s) {
  return Object.values(s.buildings).filter(b => shopSlots(s, b) > 0);
}
export const hostRent = (s, e) => {
  const b = s.buildings[e.host];
  return b && b.owner !== 'player' ? b.units.comm.rent : 0;
};

// ---------- создание и управление ----------
export function createEnterprise(s, type, hostId) {
  const def = ENTERPRISES[type];
  if (s.money < def.cost) return { error: `Не хватает денег: нужно ${def.cost.toLocaleString('ru-RU')} ₽` };
  let host = null;
  if (type === 'shop') {
    host = s.buildings[hostId];
    if (!host || shopSlots(s, host) <= 0) return { error: 'Нет свободного коммерческого помещения' };
    const u = host.units.comm;
    if (host.owner === 'player' && u.total - u.occ - shopsIn(s, host).length <= 0) {
      u.occ--; host.tenants.comm?.pop();
    }
  }
  s.money -= def.cost;
  const count = Object.values(s.enterprises).filter(e => e.type === type).length + 1;
  const e = {
    id: s.nextId++, type, name: `${def.name} №${count}`, level: 1, invested: def.cost,
    workers: 0, target: def.workers, salary: s.marketSalary,
    recipe: Object.keys(RECIPES).find(r => RECIPES[r].ent === type) || null,
    stock: {}, buy: {}, autoSell: {}, prices: {}, research: null, progress: 0,
    last: { revenue: 0, expense: 0, produced: {}, sold: {} }, built: s.day, host: host ? host.id : null,
  };
  s.enterprises[e.id] = e;
  return { enterprise: e };
}

export const upgradeCost = e => Math.round(ENTERPRISES[e.type].cost * 0.8 * e.level);
export function upgradeEnterprise(s, id) {
  const e = s.enterprises[id];
  if (!e || e.level >= 3) return { error: 'Максимальный уровень' };
  const cost = upgradeCost(e);
  if (s.money < cost) return { error: `Нужно ${cost.toLocaleString('ru-RU')} ₽` };
  s.money -= cost; e.invested += cost; e.level++;
  e.target = maxWorkers(e);
  return { ok: true };
}

export function closeEnterprise(s, id) {
  const e = s.enterprises[id];
  if (!e) return 0;
  const refund = Math.round(e.invested * 0.4);
  s.money += refund;
  s.contracts = s.contracts.filter(c => c.from !== id && c.to !== id);
  delete s.enterprises[id];
  return refund;
}

export function addContract(s, from, to, good, qty) {
  if (from === to) return { error: 'Нельзя возить в то же предприятие' };
  const A = s.enterprises[from], B = s.enterprises[to];
  if (!A || !B) return { error: 'Предприятие не найдено' };
  if (B.type === 'lab') return { error: 'НИИ не принимает товары' };
  if (B.type === 'shop' && GOODS[good].kind !== 'retail') return { error: 'Магазин продаёт только потребительские товары' };
  s.contracts.push({ id: s.nextId++, from, to, good, qty: Math.max(1, Math.round(qty)) });
  return { ok: true };
}
export function removeContract(s, id) { s.contracts = s.contracts.filter(c => c.id !== id); }

// ---------- рынок товаров ----------
export const buyPrice = (s, g) => round1(s.prices[g] * IMPORT_MARKUP);
export const sellPrice = (s, g, q = NPC_QUALITY) => round1(s.prices[g] * WHOLESALE_RATE * (0.8 + 0.067 * q));

export function sellToMarket(s, e, g, qty) {
  qty = Math.min(qty, stockQty(e, g));
  if (qty <= 0) return 0;
  const sum = Math.round(qty * sellPrice(s, g, e.stock[g].q));
  takeStock(e, g, qty);
  s.depot[g] += qty;
  s.money += sum;
  return sum;
}

export const salaryEff = (s, e) => clamp(0.5 + 0.5 * e.salary / s.marketSalary, 0.6, 1.3);
export const techQuality = (s, g) => 2 + s.tech[g] * 0.8;
export const researchCost = lvl => Math.round(100 * Math.pow(lvl + 1, 1.3));

export function productionInfo(s, e) {
  const r = RECIPES[e.recipe];
  if (!r || r.ent !== e.type) return null;
  const maxOut = r.rate * e.level * (e.workers / maxWorkers(e)) * salaryEff(s, e);
  let out = maxOut, limitBy = null;
  for (const g in r.inputs) {
    const can = stockQty(e, g) / r.inputs[g];
    if (can < out) { out = can; limitBy = g; }
  }
  return { maxOut: Math.floor(maxOut), out: Math.floor(out), limitBy };
}

export function enterprisesValue(s) {
  let w = 0;
  for (const e of Object.values(s.enterprises)) {
    w += e.invested * 0.6;
    for (const g in e.stock) w += e.stock[g].qty * s.prices[g] * 0.6;
  }
  return w;
}

// ---------- день ----------
// spend/earn ведут учёт денег за день; fx — события для картинки.
export function productionTick(s, { spend, earn, fx, news }) {
  const list = Object.values(s.enterprises);
  for (const e of list) e.last = { revenue: 0, expense: 0, produced: {}, sold: {} };
  const pay = (e, v) => { spend(v); e.last.expense += v; };
  const get = (e, v) => { earn(v); e.last.revenue += v; };

  // найм
  for (const e of list) {
    const max = maxWorkers(e);
    e.target = clamp(e.target, 0, max);
    if (e.salary < s.marketSalary * 0.7) e.workers = Math.floor(e.workers * 0.9);
    else if (e.workers < e.target) e.workers = Math.min(e.target, e.workers + Math.ceil(max * 0.25));
    if (e.workers > e.target) e.workers = e.target;
  }
  // закупки на оптовом рынке
  const idle = e => e.type === 'construction' && !Object.values(s.buildings).some(b => b.builder === e.id && b.state === 'build');
  for (const e of list) for (const g in e.buy) {
    if (idle(e)) break; // без строек стройматериалы не закупаем
    const want = Math.min(e.buy[g], freeSpace(e));
    if (want <= 0) continue;
    const price = buyPrice(s, g);
    const qty = Math.floor(Math.min(want, s.depot[g], Math.max(0, s.money) / price));
    if (qty <= 0) continue;
    addStock(e, g, qty, 2);
    s.depot[g] -= qty;
    pay(e, qty * price);
  }
  // поставки
  for (const c of s.contracts) {
    const A = s.enterprises[c.from], B = s.enterprises[c.to];
    if (!A || !B) continue;
    const qty = Math.floor(Math.min(c.qty, stockQty(A, c.good), freeSpace(B)));
    if (qty <= 0) continue;
    addStock(B, c.good, qty, takeStock(A, c.good, qty));
    pay(A, Math.round(qty * TRANSPORT_PER_UNIT));
  }
  // производство
  for (const e of list) {
    const r = RECIPES[e.recipe];
    if (!r || r.ent !== e.type) continue;
    let n = productionInfo(s, e).out;
    const netGrow = 1 - Object.values(r.inputs).reduce((a, v) => a + v, 0);
    if (netGrow > 0) n = Math.min(n, freeSpace(e) / netGrow);
    n = Math.floor(n);
    if (n <= 0) continue;
    let inQ = 0, inW = 0;
    for (const g in r.inputs) { inQ += takeStock(e, g, n * r.inputs[g]) * r.inputs[g]; inW += r.inputs[g]; }
    const bonus = (salaryEff(s, e) - 1) * 3, tq = techQuality(s, e.recipe);
    const q = inW ? 0.6 * (inQ / inW) + 0.4 * tq + 0.5 + bonus : tq + bonus;
    addStock(e, e.recipe, n, round1(clamp(q, 1, 10)));
    e.last.produced[e.recipe] = n;
  }
  // магазины: продажи горожанам, проходимость — по участку дома
  let shopRevenue = 0;
  const cityPop = s.city?.population || 0;
  for (const e of list) {
    if (e.type !== 'shop') continue;
    const host = s.buildings[e.host];
    if (!host) continue;
    const loc = s.plots[`${host.i},${host.j}`].loc;
    const crowd = 0.5 + Math.min(1, cityPop / 3000); // чем больше жителей, тем больше покупателей
    const cap = e.workers * SHOP_UNITS_PER_WORKER * salaryEff(s, e);
    const wants = {};
    let total = 0;
    for (const g in e.stock) {
      const def = GOODS[g];
      if (def.kind !== 'retail') continue;
      const price = e.prices[g] ?? def.price;
      const attr = Math.pow(e.stock[g].q / NPC_QUALITY, 0.6) * Math.pow(s.prices[g] / price, 2.5);
      const demand = def.demand * loc * crowd * (s.demandMods[g]?.mult || 1) * (1 + 0.5 * (e.level - 1));
      wants[g] = Math.min(stockQty(e, g), demand * (attr / (attr + 1)) * 2 * (0.9 + Math.random() * 0.2));
      total += wants[g];
    }
    const k = total > cap ? cap / total : 1;
    for (const g in wants) {
      const qty = Math.floor(wants[g] * k);
      if (qty <= 0) continue;
      takeStock(e, g, qty);
      get(e, Math.round(qty * (e.prices[g] ?? GOODS[g].price)));
      e.last.sold[g] = qty;
    }
    const rent = hostRent(s, e);
    if (rent) { pay(e, rent); s.rivals[host.owner].worth += rent; }
    shopRevenue += e.last.revenue;
    if (e.last.revenue > 0) fx.push({ type: 'money', i: host.i, j: host.j, amount: e.last.revenue });
  }
  s.lastShopRevenue = shopRevenue;
  // автопродажа на опт
  for (const e of list) for (const g in e.autoSell) {
    if (!e.autoSell[g]) continue;
    const qty = stockQty(e, g);
    if (qty <= 0) continue;
    const v = Math.round(qty * sellPrice(s, g, e.stock[g].q));
    takeStock(e, g, qty);
    s.depot[g] += qty;
    get(e, v);
    e.last.sold[g] = (e.last.sold[g] || 0) + qty;
  }
  // исследования
  for (const e of list) {
    if (e.type !== 'lab' || !e.research) continue;
    const lvl = s.tech[e.research];
    if (lvl >= 10) continue;
    e.progress += e.workers * salaryEff(s, e) * e.level;
    if (e.progress >= researchCost(lvl)) {
      e.progress -= researchCost(lvl);
      s.tech[e.research] = lvl + 1;
      news(`🔬 Открытие! Технология «${GOODS[e.research].name}» — уровень ${lvl + 1}`);
    }
  }
  // зарплаты и содержание
  for (const e of list) {
    pay(e, e.workers * e.salary);
    pay(e, ENTERPRISES[e.type].upkeep * e.level);
  }
  // склады: подвоз извне и покупки остальных горожан; цена растёт при дефиците
  for (const g in s.prices) {
    const d = DEPOT[GOODS[g].kind];
    // без покупок запас держится у стартового уровня: остальные горожане тоже покупают
    s.depot[g] = Math.max(0, Math.round(s.depot[g] * (1 - d.restock / d.start) + d.restock));
    const scarcity = clamp(Math.pow(d.start / (s.depot[g] + d.start * 0.05), 0.35), 0.75, 2.5);
    const mod = s.priceMods[g];
    const target = GOODS[g].price * (mod ? mod.mult : 1) * scarcity;
    s.prices[g] = round1(Math.max(1, s.prices[g] * (1 + (Math.random() - 0.5) * 0.04) + (target - s.prices[g]) * 0.12));
  }
  for (const m of [s.priceMods, s.demandMods]) for (const g in m) if (--m[g].days <= 0) delete m[g];
}

export function goodsEvent(s, e) {
  if (e.salary) { s.marketSalary = round1(s.marketSalary * e.salary); return `${e.text} (до ${s.marketSalary} ₽/день)`; }
  const g = e.goods[Math.floor(Math.random() * e.goods.length)];
  const days = 10 + Math.floor(Math.random() * 15);
  (e.kind === 'price' ? s.priceMods : s.demandMods)[g] = { mult: e.mult, days };
  return e.text(GOODS[g].name.toLowerCase());
}
