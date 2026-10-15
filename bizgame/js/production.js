// Виртуальные предприятия: заводы, фермы, шахты, склады, лаборатории, магазины, рестораны, салоны.
// На карте их нет — кроме тех, кто продаёт горожанам: они занимают коммерческое помещение жилого дома.
// У каждого предприятия есть подразделения (цеха, залы, теплицы…): свой уровень, рабочие, продукт и износ.
import {
  GOODS, RECIPES, ENTERPRISES, MARKET_SALARY, IMPORT_MARKUP, WHOLESALE_RATE, NPC_QUALITY,
  SHOP_UNITS_PER_WORKER, TRANSPORT_PER_UNIT, DEPOT, hqLimit, PROFESSIONS, SPEC_NAMES, SPEC_FACES, specSalary,
} from './data.js';
import { entDef, canMake, recipesFor, sellsList, accepts } from './catalog.js';
import { pay as ledgerPay, flow } from './ledger.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 10) / 10;
const round2 = v => Math.round(v * 100) / 100;
export const MAX_DIVS = 4;
export const MAX_DIV_LEVEL = 5;

// Названия подразделений по видам предприятий
const DIV_NAMES = {
  shop: 'Торговый зал', warehouse: 'Складской корпус', factory: 'Цех', sawmill: 'Делянка', cropfarm: 'Поле', greenhouse: 'Теплица',
  restaurant: 'Кухня', salon: 'Кабинет', autoservice: 'Бокс', construction: 'Бригада', mine: 'Забой', oilwell: 'Скважина', lab: 'Лаборатория',
};
export const divName = (e, d) => `${e.type === 'livestock' ? entDef(e).name : DIV_NAMES[e.type] || 'Подразделение'} #${d.id}`;

export function initProduction(s) {
  s.marketSalary = MARKET_SALARY;
  s.prices = {}; s.priceMods = {}; s.demandMods = {}; s.tech = {};
  s.depot = {};
  s.enterprises = {};
  s.contracts = [];
  s.lastShopRevenue = 0;
  ensureGoods(s);
}
// Новые товары в старом сохранении: цены, технологии, запасы складов
export function ensureGoods(s) {
  for (const g in GOODS) {
    s.prices[g] ??= GOODS[g].price;
    s.tech[g] ??= 0;
    s.depot[g] ??= depotStart(g);
  }
}

// Универсальные склады: стартовый запас (блюд и услуг там нет)
export const depotStart = g => DEPOT[GOODS[g].kind]?.start || 0;
export const inDepot = g => !!DEPOT[GOODS[g].kind];

// ---------- подразделения и персонал ----------
export const workersOf = e => e.divs.reduce((a, d) => a + d.workers, 0);
export const targetOf = e => e.divs.reduce((a, d) => a + d.target, 0);
export const divMax = (e, d) => entDef(e).workers * d.level;
export const maxWorkers = e => e.divs.reduce((a, d) => a + divMax(e, d), 0);
export const levelOf = e => e.divs.reduce((a, d) => a + d.level, 0);
export const capacity = e => (entDef(e).storage || 0) * Math.max(1, levelOf(e));
export const wearOf = e => (e.divs.length ? e.divs.reduce((a, d) => a + d.wear, 0) / e.divs.length : 0);

// ---------- запасы (q — качество, c — себестоимость единицы) ----------
export const stockQty = (e, g) => e.stock[g]?.qty || 0;
export const stockTotal = e => Object.values(e.stock).reduce((a, x) => a + x.qty, 0);
export const freeSpace = e => Math.max(0, capacity(e) - stockTotal(e));

function addStock(e, g, qty, q, c) {
  if (qty <= 0) return;
  const cur = e.stock[g] || (e.stock[g] = { qty: 0, q, c });
  const n = cur.qty + qty;
  cur.q = round1((cur.q * cur.qty + q * qty) / n);
  cur.c = round2(((cur.c || 0) * cur.qty + (c || 0) * qty) / n);
  cur.qty = n;
}
// Забрать со склада: возвращает качество и себестоимость
export function takeStock(e, g, qty) {
  const cur = e.stock[g];
  if (!cur) return { q: 0, c: 0 };
  cur.qty -= qty;
  const r = { q: cur.q, c: cur.c || 0 };
  if (cur.qty <= 0.001) delete e.stock[g];
  return r;
}
// Учёт по предприятию за день: произведено, потреблено, продано, выручка, закуплено
function efl(e, g, field, v) {
  const f = ((e.fl ||= {})[g] ||= {});
  f[field] = (f[field] || 0) + v;
}

// ---------- точки продаж в городе ----------
export const shopsIn = (s, b) => Object.values(s.enterprises).filter(e => e.host === b.id);
export function shopSlots(s, b) {
  const u = b.units?.comm;
  if (!u || b.state !== 'done') return 0;
  return u.total - u.occ - shopsIn(s, b).length + (b.owner === 'player' ? u.occ : 0);
}
export const shopHosts = s => Object.values(s.buildings).filter(b => shopSlots(s, b) > 0);
export const hostRent = (s, e) => {
  const b = s.buildings[e.host];
  return b && b.owner !== 'player' ? b.units.comm.rent : 0;
};

// ---------- лимиты штаб-квартиры ----------
export const products = s => new Set(Object.values(s.enterprises).flatMap(e => e.divs.filter(d => d.recipe && canMake(e, d.recipe)).map(d => d.recipe)));
export const staffTotal = s => Object.values(s.enterprises).reduce((a, e) => a + workersOf(e), 0);
// Можно ли начать выпуск продукта (с учётом того, что подразделение перестанет делать старый)
export function canProduce(s, recipe, leaving = null) {
  const set = products(s);
  if (set.has(recipe)) return true;
  if (leaving) {
    const still = Object.values(s.enterprises).flatMap(e => e.divs).filter(d => d.recipe === leaving).length;
    if (still === 1) set.delete(leaving);
  }
  return set.size < hqLimit(s, 'prod');
}

// ---------- создание и управление ----------
const newDiv = (s, e, recipe) => ({ id: s.nextId++, recipe, level: 1, workers: 0, target: entDef(e).workers, on: true, wear: 0 });
export const divCost = e => Math.round(entDef(e).cost * 0.6);
export const divUpgradeCost = (e, d) => Math.round(entDef(e).cost * 0.5 * d.level);
export const repairCost = (e, d) => Math.round(entDef(e).cost * 0.25 * d.wear * d.level);
const emptyLast = () => ({ revenue: 0, expense: 0, produced: {}, sold: {} });

// opts: { hostId, recipe, level (уровень компании), name }
export function createEnterprise(s, type, sub, opts = {}) {
  if (!ENTERPRISES[type]) return { error: 'Неизвестный вид предприятия' };
  const def = entDef({ type, sub });
  if (def.later) return { error: 'Эта сфера бизнеса будет открыта позднее' };
  if (ENTERPRISES[type].subs && !sub) return { error: 'Выберите вид предприятия' };
  if (def.minLevel && (opts.level || 1) < def.minLevel) return { error: `Нужен ${def.minLevel}-й уровень компании` };
  if (Object.keys(s.enterprises).length >= hqLimit(s, 'manage')) return { error: `Управляющий отдел: лимит ${hqLimit(s, 'manage')} предприятий. Повысьте уровень в штаб-квартире.` };
  if (s.money < def.cost) return { error: `Не хватает денег: нужно ${def.cost.toLocaleString('ru-RU')} ₽` };
  let host = null;
  if (def.sells) {
    host = s.buildings[opts.hostId];
    if (!host || shopSlots(s, host) <= 0) return { error: 'Нужно свободное коммерческое помещение в жилом доме' };
  }
  const options = recipesFor(type, sub);
  let recipe = null;
  if (options.length && !def.goods) {
    recipe = opts.recipe && options.includes(opts.recipe) ? opts.recipe : options.find(r => products(s).has(r)) || options[0];
    if (!canProduce(s, recipe)) return { error: `Производственный отдел: не больше ${hqLimit(s, 'prod')} разных продуктов. Повысьте уровень в штаб-квартире.` };
  }
  if (host) {
    const u = host.units.comm;
    if (host.owner === 'player' && u.total - u.occ - shopsIn(s, host).length <= 0) { u.occ--; host.tenants.comm?.pop(); }
  }
  const count = Object.values(s.enterprises).filter(e => e.type === type && e.sub === (sub || null)).length + 1;
  const e = {
    id: s.nextId++, type, sub: sub || null, name: opts.name?.trim() || `${def.name} №${count}`, invested: def.cost,
    salary: s.marketSalary, divs: [], stock: {}, buy: {}, autoSell: {}, prices: {}, autoSupply: { on: false, days: 3 },
    research: null, progress: 0, built: s.day, host: host ? host.id : null, last: emptyLast(), hist: [], flh: [],
  };
  e.divs.push(newDiv(s, e, recipe));
  s.enterprises[e.id] = e;
  ledgerPay(s, -def.cost, 'buyEnt', { party: host ? 'Владелец дома' : 'Универсальные склады', from: e.name, type: 'Создание предприятия' });
  return { enterprise: e };
}

export function addDivision(s, e, recipe) {
  if (e.divs.length >= MAX_DIVS) return { error: `Не больше ${MAX_DIVS} подразделений` };
  const options = recipesFor(e.type, e.sub);
  if (options.length && !entDef(e).goods) {
    if (!options.includes(recipe)) recipe = options[0];
    if (!canProduce(s, recipe)) return { error: `Производственный отдел: не больше ${hqLimit(s, 'prod')} разных продуктов` };
  } else recipe = null;
  const cost = divCost(e);
  if (s.money < cost) return { error: `Нужно ${cost.toLocaleString('ru-RU')} ₽` };
  const d = newDiv(s, e, recipe);
  e.divs.push(d);
  e.invested += cost;
  ledgerPay(s, -cost, 'equipment', { party: 'Универсальные склады', from: e.name, type: 'Новое подразделение' });
  return { div: d };
}
export function upgradeDiv(s, e, d) {
  if (d.level >= MAX_DIV_LEVEL) return { error: 'Максимальный уровень' };
  const cost = divUpgradeCost(e, d);
  if (s.money < cost) return { error: `Нужно ${cost.toLocaleString('ru-RU')} ₽` };
  ledgerPay(s, -cost, 'equipment', { party: 'Универсальные склады', from: e.name, type: 'Расширение подразделения' });
  e.invested += cost; d.level++; d.target = divMax(e, d);
  return { ok: true };
}
export function removeDiv(s, e, d) {
  if (e.divs.length <= 1) return { error: 'Последнее подразделение не удалить — закройте предприятие' };
  e.divs = e.divs.filter(x => x !== d);
  const refund = Math.round(divCost(e) * 0.3 * d.level);
  e.invested = Math.max(0, e.invested - refund);
  ledgerPay(s, refund, 'sellEnt', { party: 'Покупатель', from: e.name, type: 'Продажа оборудования' });
  return { ok: true };
}
export function repairDiv(s, e, d) {
  const cost = repairCost(e, d);
  if (!cost) return { ok: true };
  if (s.money < cost) return { error: `Нужно ${cost.toLocaleString('ru-RU')} ₽` };
  ledgerPay(s, -cost, 'equipment', { party: 'Сервисная служба', from: e.name, type: 'Ремонт оборудования' });
  d.wear = 0;
  return { ok: true };
}
export function setDivRecipe(s, e, d, recipe) {
  if (!canMake(e, recipe)) return { error: 'Это подразделение такое не выпускает' };
  if (!canProduce(s, recipe, d.recipe)) return { error: `Производственный отдел: не больше ${hqLimit(s, 'prod')} разных продуктов. Повысьте уровень в штаб-квартире.` };
  d.recipe = recipe;
  return { ok: true };
}

export function closeEnterprise(s, id) {
  const e = s.enterprises[id];
  if (!e) return 0;
  const refund = Math.round(e.invested * 0.4);
  ledgerPay(s, refund, 'sellEnt', { party: 'Покупатель', from: e.name, type: 'Продажа предприятия' });
  for (const x of s.specs || []) if (x.job === id) x.job = null;
  s.contracts = s.contracts.filter(c => c.from !== id && c.to !== id);
  delete s.enterprises[id];
  return refund;
}

export function addContract(s, from, to, good, qty) {
  if (from === to) return { error: 'Нельзя возить в то же предприятие' };
  const A = s.enterprises[from], B = s.enterprises[to];
  if (!A || !B) return { error: 'Предприятие не найдено' };
  if (!accepts(B, good)) return { error: `${entDef(B).name} не принимает «${GOODS[good].name}»` };
  s.contracts.push({ id: s.nextId++, from, to, good, qty: Math.max(1, Math.round(qty)) });
  return { ok: true };
}
export function removeContract(s, id) { s.contracts = s.contracts.filter(c => c.id !== id); }

// ---------- рынок товаров ----------
export const buyPrice = (s, g) => round1(s.prices[g] * IMPORT_MARKUP);
export const sellPrice = (s, g, q = NPC_QUALITY) => round1(s.prices[g] * WHOLESALE_RATE * (0.8 + 0.067 * q));

export function sellToMarket(s, e, g, qty) {
  if (!inDepot(g)) return 0;
  qty = Math.min(qty, stockQty(e, g));
  if (qty <= 0) return 0;
  const sum = Math.round(qty * sellPrice(s, g, e.stock[g].q));
  takeStock(e, g, qty);
  s.depot[g] += qty;
  flow(s, g, 'whole', qty);
  efl(e, g, 'sold', qty); efl(e, g, 'rev', sum);
  ledgerPay(s, sum, 'wholesale', { party: 'Универсальные склады', from: e.name, type: 'Продажа товаров' });
  return sum;
}

export const salaryEff = (s, e) => clamp(0.5 + 0.5 * e.salary / s.marketSalary, 0.6, 1.3);
export const techQuality = (s, g) => 2 + s.tech[g] * 0.8;
export const researchCost = lvl => Math.round(100 * Math.pow(lvl + 1, 1.3));
export const wearFactor = d => 1 - d.wear * 0.5;

// Мощность подразделения (без учёта сырья)
export function divOutput(s, e, d) {
  const r = RECIPES[d.recipe];
  if (!r || !d.on || !canMake(e, d.recipe)) return 0;
  return r.rate * d.level * (d.workers / divMax(e, d)) * salaryEff(s, e) * specBonus(s, e) * wearFactor(d);
}
// Прогноз по подразделению: мощность, выпуск с учётом сырья на складе, что ограничивает
export function divInfo(s, e, d) {
  const r = RECIPES[d.recipe];
  if (!r) return null;
  const maxOut = divOutput(s, e, d);
  let out = maxOut, limitBy = null;
  for (const g in r.inputs) {
    const can = stockQty(e, g) / r.inputs[g];
    if (can < out) { out = can; limitBy = g; }
  }
  return { maxOut: Math.floor(maxOut), out: Math.floor(out), limitBy };
}
// Потребность в сырье в день при полной загрузке всех подразделений
export function inputNeeds(s, e) {
  const need = {};
  for (const d of e.divs) {
    const r = RECIPES[d.recipe];
    if (!r || !d.on) continue;
    const full = r.rate * d.level * salaryEff(s, e) * specBonus(s, e) * wearFactor(d) * (d.target / divMax(e, d));
    for (const g in r.inputs) need[g] = (need[g] || 0) + full * r.inputs[g];
  }
  return need;
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
export function productionTick(s, { spend, earn, fx, news }) {
  const list = Object.values(s.enterprises);
  for (const e of list) { e.last = emptyLast(); e.fl = {}; }
  const pay = (e, v, cat, party) => { spend(v, cat, e.name, party); e.last.expense += v; };
  const get = (e, v, cat, party) => { earn(v, cat, e.name, party); e.last.revenue += v; };

  // найм в подразделения (с учётом лимита отдела персонала)
  let freeStaff = hqLimit(s, 'staff') - staffTotal(s);
  for (const e of list) for (const d of e.divs) {
    const max = divMax(e, d);
    d.target = clamp(d.target, 0, max);
    if (e.salary < s.marketSalary * 0.7) d.workers = Math.floor(d.workers * 0.9);
    else if (d.workers < d.target && freeStaff > 0) {
      const hire = Math.min(d.target - d.workers, Math.ceil(max * 0.25), freeStaff);
      d.workers += hire; freeStaff -= hire;
    }
    if (d.workers > d.target) d.workers = d.target;
  }

  // авторегулирование снабжения: держать сырьё на N дней работы
  for (const e of list) {
    if (!e.autoSupply?.on) continue;
    const need = inputNeeds(s, e);
    const incoming = {};
    for (const c of s.contracts) if (c.to === e.id) incoming[c.good] = (incoming[c.good] || 0) + c.qty;
    for (const g in need) {
      const want = need[g] * e.autoSupply.days - stockQty(e, g) - (incoming[g] || 0) * e.autoSupply.days;
      e.buy[g] = Math.max(0, Math.ceil(Math.min(want, need[g] * 2)));
    }
  }
  // закупки на универсальных складах
  const idle = e => e.type === 'construction' && !Object.values(s.buildings).some(b => b.builder === e.id && b.state === 'build');
  for (const e of list) for (const g in e.buy) {
    if (idle(e)) break; // без строек стройматериалы не закупаем
    if (!inDepot(g) || !accepts(e, g)) continue;
    const want = Math.min(e.buy[g], freeSpace(e));
    if (want <= 0) continue;
    const price = buyPrice(s, g);
    const qty = Math.floor(Math.min(want, s.depot[g], Math.max(0, s.money) / price));
    if (qty <= 0) continue;
    addStock(e, g, qty, 2, price);
    s.depot[g] -= qty;
    flow(s, g, 'bought', qty);
    efl(e, g, 'bought', qty); efl(e, g, 'spent', qty * price);
    pay(e, qty * price, 'purchase', 'Универсальные склады');
  }
  // поставки между своими предприятиями (себестоимость едет вместе с товаром)
  for (const c of s.contracts) {
    const A = s.enterprises[c.from], B = s.enterprises[c.to];
    if (!A || !B || !accepts(B, c.good)) continue;
    const qty = Math.floor(Math.min(c.qty, stockQty(A, c.good), freeSpace(B)));
    if (qty <= 0) continue;
    const { q, c: cost } = takeStock(A, c.good, qty);
    addStock(B, c.good, qty, q, cost + TRANSPORT_PER_UNIT);
    efl(A, c.good, 'shipped', qty); efl(B, c.good, 'received', qty);
    pay(A, Math.round(qty * TRANSPORT_PER_UNIT), 'transport', 'Транспортная компания');
  }
  // производство по подразделениям
  for (const e of list) {
    const def = entDef(e);
    for (const d of e.divs) {
      const r = RECIPES[d.recipe];
      if (!r || !d.on || !canMake(e, d.recipe)) continue;
      d.wear = Math.min(1, d.wear + 0.004);
      let n = divInfo(s, e, d).out;
      const netGrow = 1 - Object.values(r.inputs).reduce((a, v) => a + v, 0);
      if (netGrow > 0) n = Math.min(n, freeSpace(e) / netGrow);
      n = Math.floor(n);
      if (n <= 0) continue;
      let inQ = 0, inW = 0, inCost = 0;
      for (const g in r.inputs) {
        const use = n * r.inputs[g];
        const t = takeStock(e, g, use);
        inQ += t.q * r.inputs[g]; inW += r.inputs[g]; inCost += t.c * use;
        flow(s, g, 'used', use); efl(e, g, 'used', use);
      }
      const bonus = (salaryEff(s, e) - 1) * 3 + specQuality(s, e), tq = techQuality(s, d.recipe);
      const q = inW ? 0.6 * (inQ / inW) + 0.4 * tq + 0.5 + bonus : tq + bonus;
      // себестоимость: сырьё + зарплата подразделения + доля содержания
      const unitCost = (inCost + d.workers * e.salary + def.upkeep * d.level) / n;
      addStock(e, d.recipe, n, round1(clamp(q, 1, 10)), unitCost);
      e.last.produced[d.recipe] = (e.last.produced[d.recipe] || 0) + n;
      flow(s, d.recipe, 'made', n); efl(e, d.recipe, 'made', n);
    }
  }
  // продажи горожанам: магазины, рестораны, салоны, автосервисы
  let shopRevenue = 0;
  const cityPop = s.city?.population || 0;
  for (const e of list) {
    const def = entDef(e);
    if (!def.sells) continue;
    const host = s.buildings[e.host];
    if (!host) continue;
    const loc = s.plots[`${host.i},${host.j}`].loc;
    const crowd = 0.5 + Math.min(1, cityPop / 3000);
    const cap = workersOf(e) * SHOP_UNITS_PER_WORKER * salaryEff(s, e) * specBonus(s, e);
    const wants = {};
    let total = 0;
    for (const g of sellsList(e.type, e.sub)) {
      if (!e.stock[g]) continue;
      const gd = GOODS[g];
      const price = e.prices[g] ?? gd.price;
      const attr = Math.pow(e.stock[g].q / NPC_QUALITY, 0.6) * Math.pow(s.prices[g] / price, 2.5);
      const demand = (gd.demand || 5) * loc * crowd * (s.demandMods[g]?.mult || 1) * (1 + 0.25 * (levelOf(e) - 1));
      wants[g] = Math.min(stockQty(e, g), demand * (attr / (attr + 1)) * 2 * (0.9 + Math.random() * 0.2));
      total += wants[g];
    }
    // у магазина пропускная способность — продавцы; у ресторанов и салонов — само производство
    const k = def.goods && total > cap ? cap / total : 1;
    for (const g in wants) {
      const qty = Math.floor(wants[g] * k);
      if (qty <= 0) continue;
      takeStock(e, g, qty);
      const sum = Math.round(qty * (e.prices[g] ?? GOODS[g].price));
      flow(s, g, 'retail', qty); efl(e, g, 'sold', qty); efl(e, g, 'rev', sum);
      get(e, sum, 'retail', 'Покупатели');
      e.last.sold[g] = qty;
    }
    // услуги не хранятся, блюда к утру наполовину портятся
    for (const g in e.stock) {
      if (GOODS[g].kind === 'service') delete e.stock[g];
      else if (GOODS[g].kind === 'dish') { e.stock[g].qty = Math.floor(e.stock[g].qty / 2); if (!e.stock[g].qty) delete e.stock[g]; }
    }
    const rent = hostRent(s, e);
    if (rent) { pay(e, rent, 'shopRent', s.rivals[host.owner].name); s.rivals[host.owner].worth += rent; }
    shopRevenue += e.last.revenue;
    if (e.last.revenue > 0) fx.push({ type: 'money', i: host.i, j: host.j, amount: e.last.revenue });
  }
  s.lastShopRevenue = shopRevenue;
  // автопродажа на склады города
  for (const e of list) for (const g in e.autoSell) {
    if (!e.autoSell[g] || !inDepot(g)) continue;
    const qty = stockQty(e, g);
    if (qty <= 0) continue;
    const v = Math.round(qty * sellPrice(s, g, e.stock[g].q));
    takeStock(e, g, qty);
    s.depot[g] += qty;
    flow(s, g, 'whole', qty); efl(e, g, 'sold', qty); efl(e, g, 'rev', v);
    get(e, v, 'wholesale', 'Универсальные склады');
    e.last.sold[g] = (e.last.sold[g] || 0) + qty;
  }
  // исследования
  for (const e of list) {
    if (e.type !== 'lab' || !e.research) continue;
    const lvl = s.tech[e.research];
    if (lvl >= 10) continue;
    e.progress += e.divs.reduce((a, d) => a + d.workers * d.level, 0) / 1.5 * salaryEff(s, e) * specBonus(s, e);
    if (e.progress >= researchCost(lvl)) {
      e.progress -= researchCost(lvl);
      s.tech[e.research] = lvl + 1;
      news(`🔬 Открытие! Технология «${GOODS[e.research].name}» — уровень ${lvl + 1}`);
    }
  }
  // зарплаты и содержание, история
  for (const e of list) {
    pay(e, workersOf(e) * e.salary, 'salary', 'Сотрудники');
    pay(e, entDef(e).upkeep * levelOf(e), 'upkeep', 'Коммунальные службы');
    e.hist.push({ rev: e.last.revenue, exp: e.last.expense });
    if (e.hist.length > 60) e.hist.shift();
    e.flh.push(e.fl);
    if (e.flh.length > 14) e.flh.shift();
  }
  specsTick(s, { spend, news });
  // склады города: подвоз извне и покупки остальных горожан; цена растёт при дефиците
  for (const g in s.prices) {
    const d = DEPOT[GOODS[g].kind];
    let scarcity = 1;
    if (d) {
      s.depot[g] = Math.max(0, Math.round(s.depot[g] * (1 - d.restock / d.start) + d.restock));
      scarcity = clamp(Math.pow(d.start / (s.depot[g] + d.start * 0.05), 0.35), 0.75, 2.5);
    }
    const mod = s.priceMods[g];
    const target = GOODS[g].price * (mod ? mod.mult : 1) * scarcity;
    s.prices[g] = round1(Math.max(1, s.prices[g] * (1 + (Math.random() - 0.5) * 0.04) + (target - s.prices[g]) * 0.12));
  }
  for (const m of [s.priceMods, s.demandMods]) for (const g in m) if (--m[g].days <= 0) delete m[g];
}

// Сумма по предприятию за последние n дней: { g: { made, used, sold, rev, bought, spent } }
export function entFlow(e, n = 7) {
  const out = {};
  for (const day of (e.flh || []).slice(-n)) for (const g in day) for (const k in day[g]) {
    (out[g] ||= {})[k] = (out[g][k] || 0) + day[g][k];
  }
  return out;
}

// ---------- специалисты ----------
export const specOf = (s, e) => (s.specs || []).find(x => x.job === e.id);
export const specBonus = (s, e) => { const x = specOf(s, e); return x ? 1 + 0.03 * x.level : 1; };
export const specQuality = (s, e) => { const x = specOf(s, e); return x ? 0.08 * x.level : 0; };
export const hireFee = c => specSalary(c.level) * 7;

function newCandidate(s) {
  const types = Object.keys(PROFESSIONS);
  const type = types[Math.floor(Math.random() * types.length)];
  const sex = Math.random() < 0.6 ? 'm' : 'f';
  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  const level = Math.min(10, 1 + Math.floor(Math.pow(Math.random(), 2) * 8));
  return { id: s.nextId++, name: pickOne(SPEC_NAMES[sex]), face: pickOne(SPEC_FACES[sex]), type, prof: PROFESSIONS[type], level, xp: 0, job: null };
}
export function refreshCandidates(s) { s.candidates = Array.from({ length: 6 }, () => newCandidate(s)); }
export function hireSpec(s, id) {
  const c = s.candidates.find(x => x.id === id);
  if (!c) return { error: 'Кандидат уже ушёл' };
  const fee = hireFee(c);
  if (s.money < fee) return { error: `Нужно ${fee.toLocaleString('ru-RU')} ₽ на подбор` };
  ledgerPay(s, -fee, 'hire', { party: 'Кадровое агентство', from: c.name, type: 'Найм специалиста' });
  s.candidates = s.candidates.filter(x => x !== c);
  s.specs.push(c);
  const free = Object.values(s.enterprises).find(e => e.type === c.type && !specOf(s, e));
  if (free) c.job = free.id;
  return { spec: c };
}
export function fireSpec(s, id) { s.specs = s.specs.filter(x => x.id !== id); }
export function assignSpec(s, id, entId) {
  const x = s.specs.find(y => y.id === id);
  if (!x) return { error: 'Специалист не найден' };
  if (!entId) { x.job = null; return { ok: true }; }
  const e = s.enterprises[entId];
  if (!e || e.type !== x.type) return { error: `${x.prof} может работать только: ${ENTERPRISES[x.type].name}` };
  for (const y of s.specs) if (y.job === entId) y.job = null;
  x.job = entId;
  return { ok: true };
}
function specsTick(s, { spend, news }) {
  s.specs ||= [];
  if (!s.candidates?.length || s.day % 7 === 0) refreshCandidates(s);
  for (const x of s.specs) {
    spend(specSalary(x.level), 'specSalary', x.name, x.name);
    if (!x.job) continue;
    if (++x.xp >= x.level * 15 && x.level < 20) {
      x.xp = 0; x.level++;
      news(`⭐ ${x.name} (${x.prof}) повысил квалификацию до ${x.level}-го уровня`);
    }
  }
}

export function goodsEvent(s, e) {
  if (e.salary) { s.marketSalary = round1(s.marketSalary * e.salary); return `${e.text} (до ${s.marketSalary} ₽/день)`; }
  const g = e.goods[Math.floor(Math.random() * e.goods.length)];
  const days = 10 + Math.floor(Math.random() * 15);
  (e.kind === 'price' ? s.priceMods : s.demandMods)[g] = { mult: e.mult, days };
  return e.text(GOODS[g].name.toLowerCase());
}

// ---------- перенос старых сохранений (одно предприятие = один рецепт) ----------
const OLD_TYPES = { farm: 'cropfarm', forestry: 'sawmill' };
const OLD_GOODS = { clothes: 'tshirt', appliances: 'tv' };
export function migrateEnterprises(s) {
  ensureGoods(s);
  const ren = g => OLD_GOODS[g] || g;
  for (const e of Object.values(s.enterprises)) {
    if (e.divs) continue;
    e.type = OLD_TYPES[e.type] || e.type;
    const recipe = e.recipe ? ren(e.recipe) : null;
    if (e.type === 'factory') {
      const subs = Object.keys(ENTERPRISES.factory.subs);
      e.sub = subs.find(sb => recipe && canMake({ type: 'factory', sub: sb }, recipe)) || 'food';
    } else if (e.type === 'shop') e.sub = 'grocery';
    else if (e.type === 'warehouse') e.sub = 'universal';
    else e.sub = null;
    const stock = {};
    for (const g in e.stock) if (GOODS[ren(g)]) stock[ren(g)] = { ...e.stock[g], c: e.stock[g].c ?? round2(GOODS[ren(g)].price * 0.7) };
    e.stock = stock;
    for (const k of ['buy', 'autoSell', 'prices']) e[k] = Object.fromEntries(Object.entries(e[k] || {}).map(([g, v]) => [ren(g), v]).filter(([g]) => GOODS[g]));
    if (e.research) e.research = GOODS[ren(e.research)] ? ren(e.research) : null;
    e.divs = [{ id: s.nextId++, recipe: recipe && canMake(e, recipe) ? recipe : null, level: e.level || 1, workers: e.workers || 0, target: e.target || 0, on: true, wear: 0 }];
    e.autoSupply ||= { on: false, days: 3 };
    e.hist ||= []; e.flh ||= [];
    delete e.recipe; delete e.level; delete e.workers; delete e.target;
  }
  for (const c of s.contracts) c.good = ren(c.good);
  s.contracts = s.contracts.filter(c => GOODS[c.good]);
}
