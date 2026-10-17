// Экономическая модель: недвижимость, стройки, аренда, спрос горожан.
// Модуль не знает ни про DOM, ни про 3D — только данные.
import {
  UNITS, BUILDINGS, CONTRACTORS, ADVANCE, START_MONEY, PLOT_SIZES, plotK, isArea, GRID, isRoad, RIVALS, EVENTS, TENANTS, CATEGORIES, OWN,
  HQ, HQ_MAX, hqLimit, hqUpgradeCost, FINANCE_PENALTY, cityLevelOf, COMPANY_MAX_LEVEL, companyXpNeed, LEVEL_BONUS,
} from './data.js';
import {
  initProduction, productionTick, enterprisesValue, goodsEvent, shopsIn, shopArea, stockQty, takeStock, maxWorkers, salaryEff, specBonus, refreshCandidates,
  workersOf, levelOf, migrateEnterprises,
} from './production.js';
import { initLedger, pay, closeDay, flow } from './ledger.js';

const SAVE_KEY = 'bizgame-save-v4'; // v4 — коммерция в м², участки разной площади
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 10) / 10;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const key = (i, j) => `${i},${j}`;
export const isPlayer = b => b.owner === 'player';
const mine = s => Object.values(s.buildings).filter(isPlayer);

export const QUESTS = [
  { id: 'order',  text: 'Закажите строительство первого здания',  reward: 200000,  check: s => mine(s).length > 0 },
  { id: 'built',  text: 'Дождитесь окончания стройки',             reward: 300000,  check: s => mine(s).some(b => b.state === 'done') },
  { id: 'apt',    text: 'Заселите 20 квартир',                     reward: 400000,  check: s => occTotal(mine(s), 'apt') >= 20 },
  { id: 'office', text: 'Сдайте 15 офисов',                        reward: 500000,  check: s => occTotal(mine(s), 'office') >= 15 },
  { id: 'ent',    text: 'Создайте предприятие (ферму, завод…)',    reward: 200000,  check: s => Object.keys(s.enterprises).length > 0 },
  { id: 'chain',  text: 'Выберите своё предприятие поставщиком',   reward: 200000,  check: s => Object.values(s.enterprises).some(e => Object.values(e.supply || {}).some(v => v.srcs?.some(x => typeof x === 'number'))) },
  { id: 'shop',   text: 'Откройте магазин в жилом доме',          reward: 300000,  check: s => Object.values(s.enterprises).some(e => e.type === 'shop') },
  { id: 'sale',   text: 'Продайте товаров на 100 000 ₽ за день',    reward: 400000,  check: s => s.lastShopRevenue >= 100000 },
  { id: 'social', text: 'Постройте больницу, полицию или школу',   reward: 600000,  check: s => mine(s).some(b => b.state === 'done' && BUILDINGS[b.type].category === 'social') },
  { id: 'worth',  text: 'Капитал компании 30 000 000 ₽',            reward: 1000000, check: s => netWorth(s) >= 30000000 },
  { id: 'top',    text: 'Займите 1-е место в рейтинге',             reward: 2000000, check: s => rating(s)[0].player },
];
const occTotal = (list, t) => list.reduce((a, b) => a + (b.units[t]?.occ || 0), 0);

export function newGame() {
  const s = {
    version: 4, day: 1, money: START_MONEY, loan: 0, nextId: 1, debtDays: 0, bankrupt: false,
    mods: {}, plots: {}, buildings: {}, history: [], news: [], quests: {},
    city: { households: 0, jobs: 0, demand: { apt: 0, office: 0, comm: 0 } },
    rivals: RIVALS.map(r => ({ ...r, cash: START_MONEY })), // конкуренты стартуют на равных с игроком
    company: 'Моя компания', cityName: 'Новоград',
    hq: { staff: 1, manage: 1, prod: 1, build: 1, finance: 1, mining: 1 },
    accNo: 100000 + Math.floor(Math.random() * 900000), compLvl: 1, compXp: 0,
  };
  const c = (GRID - 1) / 2;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (isRoad(i, j)) continue;
    const central = 1 - Math.hypot(i - c, j - c) / Math.hypot(c, c); // 1 в центре, 0 в углу
    const r = Math.random(), size = r < 0.3 ? 's' : r < 0.75 ? 'm' : 'l';
    s.plots[key(i, j)] = {
      i, j, size,
      price: Math.round(((160000 + central * central * 1400000) * PLOT_SIZES[size].k) / 10000) * 10000,
      loc: round1(0.6 + central * 1.1),
    };
  }
  initProduction(s);
  initLedger(s);
  s.specs = [];
  refreshCandidates(s);
  addNews(s, `Город только основан — участки пустые. Стартовый капитал ${fmt(START_MONEY)}.`);
  pushHistory(s);
  return s;
}

export function save(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 4) return null;
    s.hq ||= { staff: 1, manage: 1, prod: 1, build: 1 };
    s.cityName ||= 'Новоград';
    s.accNo ||= 100000 + Math.floor(Math.random() * 900000);
    s.hq.finance ||= 1; s.hq.mining ||= 1;
    // раньше уровень компании считался по капиталу — переносим его как стартовый
    initLedger(s);
    s.specs ||= []; s.candidates ||= [];
    for (const r of s.rivals) { r.cash ??= START_MONEY; delete r.worth; }
    migrateEnterprises(s);
    return s;
  } catch { return null; }
}
export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('bizgame-save-v2'); localStorage.removeItem('bizgame-save-v3'); localStorage.removeItem('bizgame-save-v1'); } catch { /* нет доступа */ }
}

// ---------- стройка ----------
export const buildingAt = (s, i, j) => Object.values(s.buildings).find(b => b.i === i && b.j === j);
const mod = (s, k) => s.mods[k]?.mult || 1;

export const materialsFor = (type, floors, k = 1) => Object.fromEntries(Object.entries(BUILDINGS[type].materials).map(([g, n]) => [g, Math.round(n * floors * k * 10) / 10]));
// Уровень компании растёт с капиталом: открывает новые виды предприятий
// Уровень компании (= уровень персонажа в Бизмании) растёт с опытом и открывает новые виды предприятий
export const companyLevel = s => s.compLvl || 1;
function companyXp(s, v) {
  if (!(v > 0) || s.compLvl >= COMPANY_MAX_LEVEL) return;
  s.compXp += v;
  s.lastCompXp = Math.round(v);
  while (s.compLvl < COMPANY_MAX_LEVEL && s.compXp >= companyXpNeed(s.compLvl)) {
    s.compXp -= companyXpNeed(s.compLvl);
    s.compLvl++;
    const bonus = LEVEL_BONUS[s.compLvl] || 0;
    if (bonus) pay(s, bonus, 'other', { party: 'Администрация игры', type: `Бонус за ${s.compLvl}-й уровень компании` });
    addNews(s, `🎖️ Компания достигла ${s.compLvl}-го уровня!${bonus ? ' Бонус ' + fmt(bonus) + '.' : ''} Открылись новые возможности.`);
  }
}
export const builders = s => Object.values(s.enterprises).filter(e => e.type === 'construction');

// k — размер участка: на крупном здание шире, дороже и вмещает больше помещений
export function quote(s, type, floors, contractor, k = 1) {
  const d = BUILDINGS[type];
  if (BUILDINGS[type].category === 'social') k = 1;
  if (contractor === 'own') {
    const materials = materialsFor(type, floors, k);
    const cost = Object.entries(materials).reduce((a, [g, n]) => a + n * s.prices[g], 0);
    return { cost: Math.round(cost / 1000) * 1000, days: Math.max(3, Math.round(d.days(floors))), quality: OWN.quality, own: true, materials };
  }
  const c = CONTRACTORS[contractor];
  return {
    cost: Math.round(d.cost(floors) * k * c.price * mod(s, 'build') / 10000) * 10000,
    days: Math.max(3, Math.round(d.days(floors) * c.speed)),
    quality: c.quality,
  };
}

export function orderCheck(s, type, floors, contractor, i, j) {
  const p = s.plots[key(i, j)];
  if (!p) return 'Здесь дорога';
  if (buildingAt(s, i, j)) return 'Участок уже занят';
  const q = quote(s, type, floors, contractor, plotK(p));
  if (q.own && !builders(s).length) return 'Сначала создайте строительную компанию (меню «Предприятия»)';
  const sites = mine(s).filter(b => b.state === 'build').length;
  if (sites >= hqLimit(s, 'build')) return `Строительный отдел: не больше ${hqLimit(s, 'build')} строек одновременно. Повысьте уровень в штаб-квартире.`;
  const need = p.price + (q.own ? 0 : Math.round(q.cost * ADVANCE));
  if (s.money < need) return `Не хватает денег: нужно ${fmt(need)} (земля + аванс)`;
  return null;
}

export function order(s, type, floors, contractor, i, j, owner = 'player') {
  if (owner === 'player') {
    const err = orderCheck(s, type, floors, contractor, i, j);
    if (err) return { error: err };
  }
  const p = s.plots[key(i, j)];
  const k = BUILDINGS[type].category === 'social' ? 1 : plotK(p);
  const q = quote(s, type, floors, contractor, k);
  const advance = q.own ? 0 : Math.round(q.cost * ADVANCE);
  const bname = `${BUILDINGS[type].name} (участок ${i}:${j})`;
  if (owner === 'player') {
    pay(s, -p.price, 'land', { party: 'Городская администрация', from: bname, type: 'Покупка земли' });
    pay(s, -advance, 'construction', { party: CONTRACTORS[contractor]?.name, from: bname, type: 'Аванс подрядчику' });
  }
  const units = {};
  for (const [t, n] of Object.entries(BUILDINGS[type].units(floors, k))) {
    units[t] = { total: n, occ: 0, rent: Math.round(refRent(p, t)) };
  }
  const b = {
    id: s.nextId++, type, i, j, owner, floors, contractor, quality: q.quality,
    state: 'build', progress: 0, buildDays: q.days, cost: q.cost, paid: advance, land: p.price,
    paused: false, units, tenants: {}, last: { income: 0, expense: 0 }, ordered: s.day, built: null,
  };
  if (q.own) { b.builder = builders(s)[0].id; b.materials = q.materials; }
  s.buildings[b.id] = b;
  if (owner === 'player') addNews(s, `🏗️ ${q.own ? 'Ваша строительная компания' : CONTRACTORS[contractor].name} начинает строить: ${BUILDINGS[type].name} (${q.days} дн.)`);
  else addNews(s, `${s.rivals[owner].name} начал стройку: ${BUILDINGS[type].name}`);
  return { building: b };
}

export const invested = b => b.land + b.paid;

export function cancelBuild(s, id) {
  const b = s.buildings[id];
  if (!b || b.state !== 'build') return;
  const refund = Math.round(b.land * 0.8 + (b.contractor === 'own' ? 0 : b.paid * 0.3));
  pay(s, refund, 'sellEstate', { party: 'Городская администрация', from: bName(b), type: 'Отмена стройки' });
  delete s.buildings[id];
  addNews(s, `Стройка отменена, возвращено ${fmt(refund)}`);
}

// Заполненность — среднее по видам помещений (квартиры считаются штуками, коммерция — м²)
export const occRate = b => {
  const all = Object.values(b.units).filter(u => u.total > 0);
  return all.length ? all.reduce((a, u) => a + u.occ / u.total, 0) / all.length : 1;
};
export const marketValue = b => Math.round(b.land + b.cost * (0.7 + 0.35 * occRate(b)));

export function sell(s, id) {
  const b = s.buildings[id];
  if (!b || b.state !== 'done') return;
  if (shopsIn(s, b).length) return { error: 'В доме работает ваш магазин — сначала закройте его' };
  const v = Math.round(marketValue(b) * 0.9);
  pay(s, v, 'sellEstate', { party: 'Покупатель недвижимости', from: bName(b), type: 'Продажа здания' });
  delete s.buildings[id];
  addNews(s, `${BUILDINGS[b.type].name} продан за ${fmt(v)}`);
  return { ok: true };
}

// Арендаторы коммерческих площадей: у каждого своя площадь; занятая площадь округляется до их суммы
export function syncAreaTenants(b, t = 'comm') {
  const u = b.units[t], list = (b.tenants[t] ||= []).map(x => (typeof x === 'string' ? { n: x, a: 60 } : x));
  b.tenants[t] = list;
  let sumA = list.reduce((a, x) => a + x.a, 0);
  while (sumA > u.occ && list.length) sumA -= list.pop().a;
  while (u.occ - sumA >= 40) { const a = Math.min(u.occ - sumA, 40 + 10 * Math.floor(Math.random() * 12)); list.push({ n: pick(TENANTS[t]), a }); sumA += a; }
  u.occ = sumA;
}

// ---------- привлекательность ----------
export const refRent = (p, t) => UNITS[t].rent * (0.6 + 0.4 * p.loc);

export function coverage(s, i, j) {
  const res = { health: null, safety: null, edu: null };
  for (const x of Object.values(s.buildings)) {
    const d = BUILDINGS[x.type];
    if (!d.service || x.state !== 'done') continue;
    const dist = Math.hypot(x.i - i, x.j - j);
    if (dist <= d.radius && (!res[d.service] || dist < res[d.service].dist)) res[d.service] = { id: x.id, dist };
  }
  return res;
}
export function serviceFactor(s, i, j) {
  const c = coverage(s, i, j);
  return 0.85 + (c.health ? 0.15 : 0) + (c.safety ? 0.15 : 0) + (c.edu ? 0.1 : 0);
}
const acceptance = (rent, ref) => clamp(1.5 - 0.5 * Math.pow(rent / ref, 2), 0, 1);

export function attract(s, b, t) {
  const p = s.plots[key(b.i, b.j)], u = b.units[t];
  const ref = refRent(p, t);
  return Math.sqrt(p.loc) * (0.8 + 0.1 * b.quality) * serviceFactor(s, b.i, b.j) * Math.pow(ref / u.rent, 2.2);
}

// ---------- финансы ----------
export const maxLoan = s => Math.max(0, Math.round((netWorth(s) * 0.5 - s.loan) / 100000) * 100000);
export function takeLoan(s, amount) {
  amount = Math.min(amount, maxLoan(s));
  if (amount <= 0) return { error: 'Банк отказал: недостаточно капитала' };
  s.loan += amount;
  pay(s, amount, 'loan', { party: 'Городской банк', type: 'Получение кредита' });
  s.loanLog.unshift({ day: s.day, kind: 'Получен кредит', amount, loan: s.loan });
  addNews(s, `Взят кредит ${fmt(amount)} под 0,1% в день`);
  return { ok: true };
}
export function repayLoan(s, amount) {
  amount = Math.min(amount, s.loan, Math.max(0, s.money));
  if (amount <= 0) return;
  s.loan -= amount;
  pay(s, -amount, 'repay', { party: 'Городской банк', type: 'Погашение кредита' });
  s.loanLog.unshift({ day: s.day, kind: 'Погашение', amount, loan: s.loan });
}

export function netWorth(s) {
  let w = s.money - s.loan;
  for (const b of mine(s)) w += b.state === 'done' ? marketValue(b) : invested(b);
  w += enterprisesValue(s);
  return Math.round(w);
}

// Капитал конкурента: деньги + его здания (готовые — по рыночной цене, стройки — по вложениям)
export function rivalWorth(s, n) {
  let w = s.rivals[n].cash;
  for (const b of Object.values(s.buildings)) if (b.owner === n) w += b.state === 'done' ? marketValue(b) : b.land + b.cost;
  return Math.round(w);
}
export function rating(s) {
  const list = s.rivals.map((r, n) => ({ name: r.name, color: r.color, worth: rivalWorth(s, n), player: false, count: rivalCount(s, n) }));
  list.push({ name: s.company, color: '#3b82f6', worth: netWorth(s), player: true, count: mine(s).length });
  return list.sort((a, b) => b.worth - a.worth);
}
const rivalCount = (s, n) => Object.values(s.buildings).filter(b => b.owner === n).length;

export function upkeep(s, b) {
  const d = BUILDINGS[b.type];
  let v = Math.round(b.land * 0.0005) + (d.upkeep || 0);
  for (const t in b.units) v += b.units[t].total * UNITS[t].upkeep;
  return v;
}

// ---------- игровой день ----------
export function tick(s) {
  const fx = [];
  const all = Object.values(s.buildings);

  // 1. Стройки
  const sites = {};
  for (const b of all) if (b.state === 'build' && b.contractor === 'own') sites[b.builder] = (sites[b.builder] || 0) + 1;
  for (const b of all) {
    if (b.state !== 'build') continue;
    if (b.contractor === 'own') { ownBuildStep(s, b, sites[b.builder]); finishIfDone(s, b, fx); continue; }
    const c = CONTRACTORS[b.contractor];
    const due = Math.round((b.cost * (1 - ADVANCE)) / b.buildDays);
    if (isPlayer(b)) {
      if (s.money < due) {
        if (!b.paused) addNews(s, `⛔ Стройка №${b.id} остановлена: нечем платить подрядчику`);
        b.paused = true;
        continue;
      }
      b.paused = false;
    }
    if (Math.random() < c.delay) { b.delayed = true; continue; }
    b.delayed = false;
    if (isPlayer(b)) pay(s, -due, 'construction', { party: c.name, from: bName(b), type: 'Оплата строительства' });
    b.paid += due;
    b.progress++;
    finishIfDone(s, b, fx);
  }

  // 2. Спрос горожан
  const done = all.filter(b => b.state === 'done');
  const households = occTotal(done, 'apt');
  const jobs = occTotal(done, 'office') * 8 + Math.round(occTotal(done, 'comm') / 15);
  const count = t => done.filter(b => b.type === t).length;
  const hosp = count('hospital'), pol = count('police'), sch = count('school');
  const cityLevel = cityLevelOf({ police: pol, hospital: hosp, school: sch });
  const cityBonus = (1 + 0.1 * Math.min(hosp, 3) + 0.1 * Math.min(pol, 3) + 0.1 * Math.min(sch, 3)) * (1 + 0.1 * (cityLevel - 1));
  const demand = {
    apt: (150 + 4 * s.day + 0.5 * jobs) * cityBonus * mod(s, 'apt'),
    office: (20 + 0.4 * s.day + 0.07 * households) * mod(s, 'office'),
    comm: (10 + 0.1 * s.day + 0.05 * households) * 60 * mod(s, 'comm'), // м²
  };
  s.city = { households, jobs, population: Math.round(households * 2.4), demand, level: cityLevel, social: { police: pol, hospital: hosp, school: sch } };

  // 3. Заселение: спрос делится между зданиями по привлекательности
  for (const t in UNITS) {
    const list = done.filter(b => b.units[t]);
    const w = list.map(b => b.units[t].total * attract(s, b, t));
    const sum = w.reduce((a, v) => a + v, 0) || 1;
    list.forEach((b, n) => {
      const u = b.units[t];
      const p = s.plots[key(b.i, b.j)];
      const free = isArea(t) ? u.total - shopArea(s, b) : u.total;
      const target = Math.min(free * acceptance(u.rent, refRent(p, t)), (demand[t] * w[n]) / sum);
      const step = target - u.occ;
      const max = Math.max(1, Math.ceil(u.total * (step > 0 ? 0.2 : 0.15)));
      u.occ = clamp(u.occ + clamp(Math.round(step), -max, max), 0, free);
      if (isArea(t)) syncAreaTenants(b, t);
      else if (TENANTS[t]) {
        const names = b.tenants[t] || (b.tenants[t] = []);
        while (names.length < u.occ) names.push(pick(TENANTS[t]));
        names.length = u.occ;
      }
    });
  }

  // 4. Доходы и расходы
  for (const b of done) {
    const d = BUILDINGS[b.type];
    let income = d.subsidy || 0;
    for (const t in b.units) income += b.units[t].occ * b.units[t].rent;
    const expense = upkeep(s, b), tax = Math.round(b.land * 0.0005);
    b.last = { income, expense };
    if (isPlayer(b)) {
      const from = bName(b);
      if (d.subsidy) pay(s, d.subsidy, 'subsidy', { party: 'Городская администрация', from, type: 'Госзаказ' });
      const rent = income - (d.subsidy || 0);
      if (rent) pay(s, rent, 'rent', { party: 'Арендаторы', from, type: 'Арендная плата' });
      pay(s, -(expense - tax), 'estate', { party: 'Коммунальные службы', from, type: 'Содержание здания' });
      pay(s, -tax, 'tax', { party: 'Налоговая служба', from, type: 'Налог на землю' });
      (b.hist ||= []).push({ rev: income, exp: expense });
      s.compXpGain = (s.compXpGain || 0) + income; // недвижимость тоже даёт компании опыт
      if (b.hist.length > 60) b.hist.shift();
      if (income > 0) fx.push({ type: 'money', id: b.id, amount: income - expense });
    } else {
      s.rivals[b.owner].cash += income - expense;
    }
  }
  for (const b of all) if (b.state === 'build') b.last = { income: 0, expense: 0 };

  // 5. Виртуальные предприятия
  productionTick(s, {
    spend: (v, cat, from, party) => pay(s, -v, cat, { from, party }),
    earn: (v, cat, from, party) => pay(s, v, cat, { from, party }),
    fx, news: t => addNews(s, t),
  });
  if (s.loan > 0) pay(s, -s.loan * 0.001, 'interest', { party: 'Городской банк', type: 'Проценты по кредиту' });

  // 6. События, конкуренты
  for (const k in s.mods) if (--s.mods[k].days <= 0) delete s.mods[k];
  if (Math.random() < 0.06) {
    const e = pick(EVENTS);
    if (e.key) {
      s.mods[e.key] = { mult: e.mult, days: 10 + Math.floor(Math.random() * 15) };
      addNews(s, `📰 ${e.text}`);
    } else addNews(s, `📰 ${goodsEvent(s, e)}`);
    fx.push({ type: 'event' });
  }
  rivalsBuild(s);

  // 7. Неделя: налог на прибыль и предел финансового отдела (вики «Налоги», «Штаб-квартира»)
  if (s.day % 7 === 0) weekly(s);
  companyXp(s, s.compXpGain || 0);
  s.compXpGain = 0;

  // 8. Итоги дня
  s.day++;
  s.debtDays = s.money < 0 ? s.debtDays + 1 : 0;
  if (s.debtDays >= 15) { s.bankrupt = true; fx.push({ type: 'bankrupt' }); }
  else if (s.debtDays === 1) addNews(s, '⚠️ Счёт ушёл в минус! 15 дней в минусе — банкротство.');
  for (const q of QUESTS) {
    if (!s.quests[q.id] && q.check(s)) {
      s.quests[q.id] = true;
      pay(s, q.reward, 'other', { party: 'Городская администрация', type: 'Награда за задание' });
      addNews(s, `🏆 Задание выполнено: «${q.text}» +${fmt(q.reward)}`);
      fx.push({ type: 'quest', quest: q });
    }
  }
  pushHistory(s);
  return fx;
}

export const PROFIT_TAX = 0.25;
// Налог на прибыль платит каждое предприятие и здание отдельно, с учётом убытков прошлых недель (не больше 2× активов)
function weekly(s) {
  const units = [
    ...Object.values(s.enterprises).map(e => ({ o: e, name: e.name, assets: e.invested * 0.6 })),
    ...mine(s).filter(b => b.state === 'done').map(b => ({ o: b, name: `${BUILDINGS[b.type].name} №${b.id}`, assets: marketValue(b) })),
  ];
  let total = 0;
  for (const { o, name, assets } of units) {
    const w = (o.hist || []).slice(-7).reduce((a, d) => a + d.rev - d.exp, 0);
    o.loss = o.loss || 0;
    if (w <= 0) { o.loss = Math.min(o.loss - w, assets * 2); o.lastTax = 0; continue; }
    const base = Math.max(0, w - o.loss);
    o.loss = Math.max(0, o.loss - w);
    const tax = Math.round(base * PROFIT_TAX);
    o.lastTax = tax;
    if (tax) { pay(s, -tax, 'tax', { party: 'Налоговая служба', from: name, type: 'Налог на прибыль 25%' }); total += tax; }
  }
  if (total) addNews(s, `🧾 Уплачен налог на прибыль за неделю: ${fmt(total)}`);
  const cap = hqLimit(s, 'finance');
  if (s.money > cap) {
    const fine = Math.round((s.money - cap) * FINANCE_PENALTY);
    pay(s, -fine, 'tax', { party: 'Налоговая служба', type: 'Штраф: средства сверх лимита финансового отдела' });
    addNews(s, `⚠️ Деньги сверх лимита финансового отдела (${fmt(cap)}): списано 10% излишка — ${fmt(fine)}. Повысьте отдел или вкладывайте деньги.`);
  }
}

// Конкуренты тоже заказывают стройки — город постепенно застраивается
function rivalsBuild(s) {
  const free = Object.values(s.plots).filter(p => !buildingAt(s, p.i, p.j));
  const rivalTotal = Object.values(s.buildings).filter(b => !isPlayer(b)).length;
  if (!free.length || rivalTotal > Object.keys(s.plots).length * 0.45) return;
  if (Math.random() > Math.min(0.3, 0.08 + s.day * 0.002)) return;
  const done = Object.values(s.buildings);
  const hasSocial = t => done.some(b => b.type === t);
  const rr = Math.random();
  let type = rr < 0.45 ? 'residential' : rr < 0.75 ? 'office' : rr < 0.88 ? 'mixed' : 'mall';
  if (s.day > 15 && Math.random() < 0.15) type = !hasSocial('hospital') ? 'hospital' : !hasSocial('school') ? 'school' : ['hospital', 'police', 'school'][Math.floor(Math.random() * 3)];
  // участки получше выбираются чаще
  const weights = free.map(p => p.loc * p.loc);
  let r = Math.random() * weights.reduce((a, v) => a + v, 0), p = free[0];
  for (let n = 0; n < free.length; n++) { r -= weights[n]; if (r <= 0) { p = free[n]; break; } }
  const floors = pick(BUILDINGS[type].floors), contractor = pick(Object.keys(CONTRACTORS));
  // строит тот конкурент, кому хватает денег на землю и стройку — как и игроку
  const cost = p.price + quote(s, type, floors, contractor, BUILDINGS[type].category === 'social' ? 1 : plotK(p)).cost;
  const able = s.rivals.map((r, n) => n).filter(n => s.rivals[n].cash >= cost);
  if (!able.length) return;
  const n = pick(able);
  s.rivals[n].cash -= cost;
  order(s, type, floors, contractor, p.i, p.j, n);
}

function finishIfDone(s, b, fx) {
  if (b.progress < b.buildDays - 1e-6) return;
  b.state = 'done';
  b.progress = b.buildDays;
  if (b.contractor !== 'own') b.paid = b.cost;
  b.built = s.day;
  fx.push({ type: 'built', id: b.id });
  if (isPlayer(b)) addNews(s, `🎉 ${BUILDINGS[b.type].name} №${b.id} достроен! ${BUILDINGS[b.type].category === 'social' ? 'Район стал безопаснее.' : 'Ждём арендаторов.'}`);
}

// Стройка своими силами: бригада строительной компании + стройматериалы с её склада.
// Если площадок несколько, бригада делится между ними.
export function ownBuildStep(s, b, siteCount) {
  const e = s.enterprises[b.builder] || builders(s)[0];
  if (!e) { b.paused = true; b.waiting = 'company'; return; }
  b.builder = e.id;
  const crew = (workersOf(e) / Math.max(1, maxWorkers(e))) * salaryEff(s, e) * (1 + 0.5 * (levelOf(e) - 1)) * specBonus(s, e);
  let step = Math.min(crew / Math.max(1, siteCount), b.buildDays - b.progress);
  if (step <= 0.01) { b.paused = true; b.waiting = 'crew'; return; }
  let lack = null;
  for (const g in b.materials) {
    const need = (b.materials[g] / b.buildDays) * step;
    const have = stockQty(e, g);
    if (have < need) { step *= have / need; lack = g; }
  }
  if (step <= 0.01) { b.paused = true; b.waiting = lack; return; }
  b.paused = false; b.waiting = lack;
  for (const g in b.materials) {
    const use = (b.materials[g] / b.buildDays) * step;
    takeStock(e, g, use);
    flow(s, g, 'used', use);
    b.paid += Math.round(use * s.prices[g]);
    e.xpExtra = (e.xpExtra || 0) + use * s.prices[g];
  }
  b.progress += step;
}

const bName = b => `${BUILDINGS[b.type].name} №${b.id}`;
const sum = o => Object.values(o).reduce((a, v) => a + v, 0);

// Структура активов — для отчёта «Активы, обязательства»
export function assets(s) {
  const a = { buildings: 0, wip: 0, equipment: 0, stock: 0, hq: 0, cash: Math.max(0, s.money), loan: s.loan };
  for (const b of mine(s)) if (b.state === 'done') a.buildings += marketValue(b); else a.wip += invested(b);
  for (const e of Object.values(s.enterprises)) {
    a.equipment += e.invested * 0.6;
    for (const g in e.stock) a.stock += e.stock[g].qty * s.prices[g] * 0.6;
  }
  for (const k in s.hq) for (let l = 1; l < s.hq[k]; l++) a.hq += hqUpgradeCost(l) * 0.5;
  for (const k in a) a[k] = Math.round(a[k]);
  return a;
}

// Итоги дня: всё, что накопилось в s.today (и от действий игрока, и от расчёта дня)
function pushHistory(s) {
  const { day, flow: fl } = closeDay(s);
  s.history.push({ day: s.day, money: Math.round(s.money), worth: netWorth(s), income: Math.round(sum(day.inc)), expense: Math.round(sum(day.exp)),
    inc: day.inc, exp: day.exp, flow: fl, assets: assets(s) });
  if (s.history.length > 400) s.history.shift();
}
export function addNews(s, text) {
  s.news.unshift({ day: s.day, text });
  if (s.news.length > 60) s.news.pop();
}

// ---------- штаб-квартира ----------
export function upgradeHQ(s, k) {
  const l = s.hq[k];
  if (l >= HQ_MAX) return { error: 'Максимальный уровень' };
  const cost = hqUpgradeCost(l);
  if (s.money < cost) return { error: `Нужно ${fmt(cost)}` };
  pay(s, -cost, 'hq', { party: 'Подрядчик штаб-квартиры', from: 'Штаб-квартира', type: `${HQ[k].name}: уровень ${l + 1}` });
  s.hq[k] = l + 1;
  addNews(s, `🏛️ ${HQ[k].name} — уровень ${l + 1}`);
  return { ok: true };
}

export function fmt(v) {
  const sign = v < 0 ? '−' : '', a = Math.abs(v);
  // мелкие цены — с копейками (яйца, кирпич, маски)
  return sign + (a > 0 && a < 100 ? (Math.round(a * 10) / 10).toLocaleString('ru-RU') : Math.round(a).toLocaleString('ru-RU')) + ' ₽';
}

export { CATEGORIES };
