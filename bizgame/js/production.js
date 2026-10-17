// Виртуальные предприятия: заводы, фермы, шахты, склады, лаборатории, магазины, рестораны, салоны.
// На карте их нет — кроме тех, кто продаёт горожанам: они занимают коммерческое помещение жилого дома.
// У каждого предприятия есть подразделения (цеха, залы, теплицы…): свой уровень, рабочие, продукт и износ.
import {
  GOODS, RECIPES, ENTERPRISES, MARKET_SALARY, BUY_RATE, SELL_RATE, NPC_QUALITY, MARKET_QUALITY, retailMul,
  SHOP_TURNOVER_PER_WORKER, TRANSPORT_RATE, POP_SCALE, depotOf, hqLimit, PROFESSIONS, SPEC_NAMES, SPEC_FACES, specSalary,
  EQUIP, GAME_YEAR, FEATURES, AUTO_SUPPLY_ENT_LEVEL, TENANT_PROFILE, RIVALS,
} from './data.js';
import { entDef, canMake, recipesFor, sellsList, accepts } from './catalog.js';
import { pay as ledgerPay, flow } from './ledger.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 10) / 10;
const round2 = v => Math.round(v * 100) / 100;
export const MAX_DIVS = 4;
export const MAX_DIV_LEVEL = 100;
// Опыт и уровень предприятия: опыт идёт за производство, продажи, поставки, исследования и стройку.
// Уровни подразделений расходуют уровни предприятия: новое подразделение или улучшение — только при свободном уровне.
export const ENT_MAX_LEVEL = 100;
export const XP_FREE_CAP = 5;
export const xpNeed = lvl => Math.round(2000000 * Math.pow(lvl, 1.6));

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
  s.contracts = [];   // старый формат поставок — теперь поставщик выбирается в снабжении (e.supply)
  s.lastShopRevenue = 0;
  ensureGoods(s);
}
// Новые товары в старом сохранении: цены, технологии, запасы складов
export function ensureGoods(s) {
  s.techVol ||= {}; s.techMat ||= {};
  s.cityQual ||= 5;
  for (const g in GOODS) {
    s.prices[g] ??= GOODS[g].price;
    s.tech[g] ??= 0;
    s.depot[g] ??= depotStart(g);
  }
  s.npc ||= {};
  for (const g in GOODS) if (inDepot(g)) s.npc[g] ||= RIVALS.map((_, i) => (npcSells(g, i) ? npcStart(g) : 0));
}

// Универсальные склады: стартовый запас (блюд и услуг там нет)
export const depotStart = g => depotOf(g)?.start || 0;
export const inDepot = g => !!depotOf(g);

// ---------- поставщики: склады города, конкуренты, свои предприятия ----------
// У каждого конкурента свой ассортимент, качество и цена (лучше качество — дороже)
const hash = (g, i) => { let h = i * 7919; for (const c of g) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const npcSells = (g, i) => hash(g, i) % 3 !== 0;
export const npcQuality = (g, i) => 2 + (hash(g, i + 11) % 50) / 10;          // 2.0 … 6.9
const npcStart = g => Math.round((RECIPES[g]?.rate || 1) * 8);
const npcRestock = g => Math.max(0.2, (RECIPES[g]?.rate || 1) * 0.8);
export const npcPrice = (s, g, i) => round1(s.prices[g] * BUY_RATE * (0.82 + 0.08 * npcQuality(g, i)));
// Все предложения товара g для предприятия e: { src, name, price, q, avail, own }
export function offers(s, g, e = null) {
  const list = [];
  if (inDepot(g)) {
    list.push({ src: 'depot', name: 'Склады города', price: buyPrice(s, g), q: MARKET_QUALITY, avail: Math.floor(s.depot[g] || 0) });
    RIVALS.forEach((r, i) => { if (npcSells(g, i)) list.push({ src: 'npc' + i, name: r.name, price: npcPrice(s, g, i), q: npcQuality(g, i), avail: Math.floor(s.npc?.[g]?.[i] || 0) }); });
  }
  for (const x of Object.values(s.enterprises)) {
    if (x === e || !(stockQty(x, g) > 0 || x.divs.some(d => d.recipe === g))) continue;
    const st = x.stock[g];
    list.push({ src: x.id, name: x.name, price: round1((st?.c || s.prices[g] * 0.6) + s.prices[g] * TRANSPORT_RATE), q: st?.q || 0, avail: Math.floor(stockQty(x, g)), own: true });
  }
  return list;
}
export const offerOf = (s, g, src, e) => offers(s, g, e).find(o => String(o.src) === String(src)) || null;
// Поставщик по умолчанию: своё предприятие, если оно делает этот товар, иначе склады города
export function defaultSrc(s, g, e) {
  const own = Object.values(s.enterprises).find(x => x !== e && x.divs.some(d => d.recipe === g));
  return own ? own.id : inDepot(g) ? 'depot' : null;
}
export function setSupply(s, e, g, src, qty) {
  if (!GOODS[g] || !accepts(e, g)) return { error: `${entDef(e).name} не принимает «${GOODS[g]?.name}»` };
  if (src == null || src === '') src = defaultSrc(s, g, e);
  if (src == null) return { error: 'Этот товар негде взять — его нужно производить' };
  if (typeof src === 'string' && /^\d+$/.test(src)) src = +src;
  if (src === e.id) return { error: 'Нельзя поставлять самому себе' };
  e.supply[g] = { src, qty: Math.max(0, Math.round(qty ?? e.supply[g]?.qty ?? 0)) };
  return { ok: true };
}
export function removeSupply(s, e, g) { delete e.supply[g]; }
// Кому предприятие поставляет (по снабжению получателей)
export const consumersOf = (s, e) => Object.values(s.enterprises).flatMap(x => Object.entries(x.supply || {}).filter(([, v]) => v.src === e.id).map(([g, v]) => ({ to: x, g, qty: v.qty })));

// ---------- подразделения и персонал ----------
export const workersOf = e => e.divs.reduce((a, d) => a + d.workers, 0);
export const targetOf = e => e.divs.reduce((a, d) => a + d.target, 0);
export const divMax = (e, d) => entDef(e).workers * d.level;
export const maxWorkers = e => e.divs.reduce((a, d) => a + divMax(e, d), 0);
export const levelOf = e => e.divs.reduce((a, d) => a + d.level, 0);
export const freeLevels = e => Math.max(0, (e.lvl || 1) - levelOf(e));
const NO_FREE = 'Нет свободного уровня: копите опыт предприятия — он идёт за производство и продажи';
// Часть опыта предприятий получает компания (как президент в Бизмании)
export const COMPANY_XP_SHARE = 0.35;
function gainXp(s, e, v, news) {
  if (v > 0) s.compXpGain = (s.compXpGain || 0) + v * COMPANY_XP_SHARE;
  if (!(v > 0) || e.lvl >= ENT_MAX_LEVEL) return;
  if (freeLevels(e) >= XP_FREE_CAP) return; // 5 неиспользованных звёзд — опыт не копится
  e.xp = (e.xp || 0) + v;
  while (e.lvl < ENT_MAX_LEVEL && e.xp >= xpNeed(e.lvl)) {
    e.xp -= xpNeed(e.lvl);
    e.lvl++;
    news(`⭐ «${e.name}» достиг ${e.lvl}-го уровня — появился свободный уровень для подразделений`);
  }
  if (e.lvl >= ENT_MAX_LEVEL) e.xp = 0;
}
// Склад: у торговли и складов — фиксированный объём, у производства — на 15 дней сырья и продукции
export function capacity(e) {
  const base = entDef(e).storage || 0;
  let v = 0;
  for (const d of e.divs) {
    const r = RECIPES[d.recipe];
    v += Math.max(base, r ? 15 * r.rate * (1 + Object.values(r.inputs).reduce((a, n) => a + n, 0)) : base) * d.level;
  }
  return Math.max(v, base);
}
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
export const minedTypes = s => new Set(Object.values(s.enterprises).filter(e => e.type === 'mine').map(e => e.sub));
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
const newDiv = (s, e, recipe) => {
  const d = { id: s.nextId++, recipe, level: 1, workers: 0, target: entDef(e).workers, on: true, wear: 0, eq: 3, train: 0, trainOn: false };
  d.eqN = eqNeed(e, d); // новое подразделение приходит с полным комплектом оборудования
  return d;
};

// ---------- оборудование в штуках: линии, тракторы, краны… — это товар, его покупают у поставщиков или делают сами ----------
export const equipOf = e => { const E = EQUIP[e.type]; return E ? { ...E, name: GOODS[E.good].name, icon: GOODS[E.good].icon } : null; };
export const eqNeed = (e, d) => (equipOf(e) ? Math.ceil(divMax(e, d) / equipOf(e).per) : 0);
export const eqFill = (e, d) => { const n = eqNeed(e, d); return n ? Math.min(1, (d.eqN ?? n) / n) : 1; };
export const wearPerDay = e => (equipOf(e) ? 1 / (equipOf(e).life * GAME_YEAR) : 0);
export const unitPrice = (s, e) => (equipOf(e) ? Math.round(s.prices[equipOf(e).good] * BUY_RATE) : 0);
// Купить оборудование у поставщика src: mode 'fill' — докупить недостающее, 'replace' — заменить весь комплект
export function buyEquipment(s, e, d, src, mode = 'fill') {
  const E = equipOf(e);
  if (!E) return { error: 'Здесь оборудование не нужно' };
  const o = offerOf(s, E.good, src, e);
  if (!o) return { error: 'Поставщик не найден' };
  const need = eqNeed(e, d), have = mode === 'replace' ? 0 : (d.eqN || 0);
  const n = Math.min(Math.max(0, need - have), o.avail);
  if (n <= 0) return { error: o.avail <= 0 ? 'У поставщика нет в наличии' : 'Оборудования достаточно' };
  const cost = Math.round(n * o.price);
  if (!o.own && s.money < cost) return { error: `Нужно ${cost.toLocaleString('ru-RU')} ₽` };
  let q = o.q;
  if (o.own) {
    const x = s.enterprises[o.src], t = takeStock(x, E.good, n);
    q = t.q; efl(x, E.good, 'shipped', n);
    ledgerPay(s, -Math.round(n * s.prices[E.good] * TRANSPORT_RATE), 'transport', { party: 'Транспортная компания', from: e.name, type: `Доставка: ${E.name} ×${n}` });
  } else {
    takeOffer(s, E.good, o.src, n);
    ledgerPay(s, -cost, 'equipment', { party: o.name, from: e.name, type: `${E.name} ×${n}` });
  }
  e.invested += Math.round(n * s.prices[E.good] * 0.6);
  if (mode === 'replace') { d.eq = round1(q); d.wear = 0; d.eqN = n; }
  else {
    const old = d.eqN || 0;
    d.eq = round1(((d.eq || 3) * old + q * n) / (old + n));
    d.wear = (old * d.wear) / (old + n); // новое без износа — износ смешивается
    d.eqN = old + n;
  }
  return { ok: true, n };
}
// Забрать товар у склада города или конкурента
function takeOffer(s, g, src, n) {
  if (src === 'depot') s.depot[g] = Math.max(0, s.depot[g] - n);
  else { const i = +String(src).slice(3); s.npc[g][i] = Math.max(0, s.npc[g][i] - n); }
}

// ---------- квалификация и оборудование (как в Бизмании) ----------
// Квалификация = городская + обучение (до +4). Оборудование качества q требует квалификации q × 1,2.
export const TRAIN_MAX = 4;
export const qualOf = (s, d) => Math.round(((s.cityQual || 5) + (d.train || 0)) * 100) / 100;
export const reqQual = d => Math.round((d.eq || 3) * 1.2 * 100) / 100;
export const qualFactor = (s, d) => Math.pow(Math.min(1, qualOf(s, d) / reqQual(d)), 1.5);
export const eqFactor = d => 0.7 + 0.1 * (d.eq || 3);
export const trainCost = (e, d) => Math.round(d.workers * e.salary * 0.5); // ₽ в день, пока квалификация растёт

// ---------- реклама и известность (для магазинов, ресторанов, салонов) ----------
export const AD_LEVELS = [0, 40, 50, 75, 100];
export const adCost = (e, pctv) => Math.round(pctv * 400 * Math.max(1, levelOf(e)));
// Известность = базовые 25% + реклама; радиус охвата: 50% → +20%, 100% → +50% к радиусу при 25% (вики «Известность и реклама»)
export const BASE_AWARE = 0.25;
export const shopRadius = e => 3 * (1 + 0.5 * clamp(((e.aware ?? BASE_AWARE) - BASE_AWARE) / (1 - BASE_AWARE), 0, 1));
export const profileOf = e => (e.type === 'shop' ? `shop:${e.sub}` : e.type);
// Покупатели вокруг дома: жители в радиусе (ближние важнее) + офисные работники по дороге домой; конкуренты того же профиля
export function catchment(s, b, R, profile, selfId = null) {
  let pop = 0, comp = 0;
  for (const x of Object.values(s.buildings)) {
    if (x.state !== 'done') continue;
    const dist = Math.hypot(x.i - b.i, x.j - b.j);
    if (dist > R) continue;
    const k = 1 - dist / (R + 1);
    if (x.units.apt) pop += x.units.apt.occ * 2.4 * k;
    if (x.units.office) pop += x.units.office.occ * 8 * 0.3 * k;
    if (profile) for (const n of x.tenants?.comm || []) if (TENANT_PROFILE[n] === profile) comp++;
  }
  if (profile) for (const e of Object.values(s.enterprises)) {
    if (e.id === selfId || !e.host || profileOf(e) !== profile) continue;
    const h = s.buildings[e.host];
    if (h && Math.hypot(h.i - b.i, h.j - b.j) <= R) comp++;
  }
  return { pop: Math.round(pop), comp };
}
// Ассортимент магазина растёт с уровнем отдела (вики «Магазин»)
export function availableGoods(e) {
  const d = entDef(e);
  if (!d.goods) return sellsList(e.type, e.sub);
  const top = Math.max(1, ...e.divs.map(x => x.level));
  return d.goods.slice(0, 6 + 3 * (top - 1));
}
export const goodUnlockLevel = (e, g) => { const i = entDef(e).goods?.indexOf(g) ?? -1; return i < 6 ? 1 : Math.ceil((i - 5) / 3) + 1; };
// Средняя розничная цена в городе: оптовая × наценка группы
export const retailRef = (s, g) => Math.round(s.prices[g] * retailMul(g) * 10) / 10;
// Рекомендованная цена с учётом качества; дороже 2 средних розничных цен по городу не покупают
export const recommendedPrice = (s, g, q) => Math.max(1, Math.round(retailRef(s, g) * (0.85 + 0.05 * (q || 3))));
export const PRICE_CAP = 2;
export const shopPrice = (s, e, g) => e.prices[g] ?? Math.round(retailRef(s, g));
export const divCost = e => Math.round(entDef(e).cost * 0.6);
export const divUpgradeCost = (e, d) => Math.round(entDef(e).cost * 0.5 * d.level);
// Ремонт бесплатный: из изношенного оборудования собирается меньше целого (вики «Оборудование»)
export const repairLoss = d => Math.floor((d.eqN || 0) * (d.wear || 0));
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
  if (type === 'mine') {
    const mined = minedTypes(s);
    if (!mined.has(sub) && mined.size >= hqLimit(s, 'mining')) return { error: `Шахтёрский отдел: не больше ${hqLimit(s, 'mining')} видов ископаемых. Повысьте уровень в штаб-квартире.` };
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
    salary: s.marketSalary, divs: [], stock: {}, supply: {}, autoSell: {}, prices: {}, autoSupply: { on: false, weeks: 1 },
    research: null, resDir: 'q', progress: 0, lvl: 1, xp: 0, ad: 0, aware: BASE_AWARE, built: s.day, host: host ? host.id : null, last: emptyLast(), hist: [], flh: [],
  };
  e.divs.push(newDiv(s, e, recipe));
  s.enterprises[e.id] = e;
  ledgerPay(s, -def.cost, 'buyEnt', { party: host ? 'Владелец дома' : 'Подрядчик', from: e.name, type: 'Создание предприятия' });
  return { enterprise: e };
}

export function addDivision(s, e, recipe) {
  if (e.divs.length >= MAX_DIVS) return { error: `Не больше ${MAX_DIVS} подразделений` };
  if (freeLevels(e) < 1) return { error: NO_FREE };
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
  if (freeLevels(e) < 1) return { error: NO_FREE };
  const cost = divUpgradeCost(e, d);
  if (s.money < cost) return { error: `Нужно ${cost.toLocaleString('ru-RU')} ₽` };
  ledgerPay(s, -cost, 'equipment', { party: 'Универсальные склады', from: e.name, type: 'Расширение подразделения' });
  const before = eqNeed(e, d);
  e.invested += cost; d.level++; d.target = divMax(e, d);
  d.eqN = (d.eqN ?? before) + (eqNeed(e, d) - before); // оборудование для расширения входит в цену
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
  d.eqN = Math.max(0, (d.eqN || 0) - repairLoss(d));
  d.wear = 0;
  return { ok: true };
}
export function setDivRecipe(s, e, d, recipe) {
  if (!canMake(e, recipe)) return { error: 'Это подразделение такое не выпускает' };
  if (!canProduce(s, recipe, d.recipe)) return { error: `Производственный отдел: не больше ${hqLimit(s, 'prod')} разных продуктов. Повысьте уровень в штаб-квартире.` };
  d.recipe = recipe;
  return { ok: true };
}

// Продажа государству — за половину стоимости активов (оборудование + товары)
export function stateBuyout(s, e) {
  let stock = 0;
  for (const g in e.stock) stock += e.stock[g].qty * s.prices[g] * 0.6;
  return Math.round((e.invested * 0.6 + stock) * 0.5);
}
export function closeEnterprise(s, id) {
  const e = s.enterprises[id];
  if (!e) return 0;
  const refund = stateBuyout(s, e);
  ledgerPay(s, refund, 'sellEnt', { party: 'Государство', from: e.name, type: 'Продажа предприятия государству' });
  for (const x of s.specs || []) if (x.job === id) x.job = null;
  delete s.enterprises[id];
  // получатели переходят на склады города
  for (const x of Object.values(s.enterprises)) for (const g in x.supply || {}) if (x.supply[g].src === id) x.supply[g].src = inDepot(g) ? 'depot' : null;
  return refund;
}

// ---------- рынок товаров ----------
export const buyPrice = (s, g) => round1(s.prices[g] * BUY_RATE);
export const sellPrice = (s, g, q = NPC_QUALITY) => round1(s.prices[g] * SELL_RATE * (0.8 + 0.067 * q));

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
export const RES_DIRS = { q: 'Качество', vol: 'Объём производства', mat: 'Экономия материалов' };
const techMap = (s, dir) => (dir === 'vol' ? s.techVol : dir === 'mat' ? s.techMat : s.tech);
export const techLevel = (s, g, dir = 'q') => techMap(s, dir)?.[g] || 0;
export const volFactor = (s, g) => 1 + 0.05 * techLevel(s, g, 'vol');
export const matFactor = (s, g) => Math.max(0.6, 1 - 0.04 * techLevel(s, g, 'mat'));
export const wearFactor = d => 1 - d.wear * 0.5;
// Всё, что даёт оборудование: комплектность, износ, качество и соответствие квалификации
export const equipFactor = (s, e, d) => (equipOf(e) ? eqFill(e, d) * wearFactor(d) * qualFactor(s, d) * eqFactor(d) : 1);

// Мощность подразделения (без учёта сырья)
export function divOutput(s, e, d) {
  const r = RECIPES[d.recipe];
  if (!r || !d.on || !canMake(e, d.recipe)) return 0;
  return r.rate * d.level * (d.workers / divMax(e, d)) * salaryEff(s, e) * specBonus(s, e) * equipFactor(s, e, d) * volFactor(s, d.recipe);
}
// Прогноз по подразделению: мощность, выпуск с учётом сырья на складе, что ограничивает
export function divInfo(s, e, d) {
  const r = RECIPES[d.recipe];
  if (!r) return null;
  const maxOut = divOutput(s, e, d);
  let out = maxOut, limitBy = null;
  for (const g in r.inputs) {
    const can = stockQty(e, g) / (r.inputs[g] * matFactor(s, d.recipe));
    if (can < out) { out = can; limitBy = g; }
  }
  return { maxOut: round2(maxOut), out: round2(out), limitBy };
}
// Потребность в сырье в день при полной загрузке всех подразделений
// Авторегулирование снабжения (вики): с 7-го уровня компании для предприятий 8-го уровня и выше
export const canAutoSupply = (s, e) => (s.compLvl || 1) >= FEATURES.autoSupply && (e.lvl || 1) >= AUTO_SUPPLY_ENT_LEVEL;
export function inputNeeds(s, e) {
  const need = {};
  for (const d of e.divs) {
    const r = RECIPES[d.recipe];
    if (!r || !d.on) continue;
    const full = r.rate * d.level * salaryEff(s, e) * specBonus(s, e) * equipFactor(s, e, d) * volFactor(s, d.recipe) * (d.target / divMax(e, d));
    for (const g in r.inputs) need[g] = (need[g] || 0) + full * r.inputs[g] * matFactor(s, d.recipe);
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

  // авторегулирование снабжения: держать сырьё на N недель работы
  for (const e of list) {
    if (!e.autoSupply?.on || !canAutoSupply(s, e)) continue;
    const days = (e.autoSupply.weeks || 1) * 7;
    const need = inputNeeds(s, e);
    for (const g in need) {
      const want = need[g] * days - stockQty(e, g);
      const qty = Math.max(0, Math.ceil(Math.min(Math.max(want / 3, need[g]), need[g] * 2)));
      if (e.supply[g]) e.supply[g].qty = want > 0 ? qty : 0;
      else setSupply(s, e, g, null, want > 0 ? qty : 0);
    }
  }
  // снабжение: каждое утро привозят товар от выбранного поставщика
  const idle = e => e.type === 'construction' && !Object.values(s.buildings).some(b => b.builder === e.id && b.state === 'build');
  for (const e of list) for (const g in e.supply) {
    const sp = e.supply[g];
    if (!sp || !(sp.qty > 0) || sp.src == null || idle(e) || !accepts(e, g)) continue;
    const want = Math.min(sp.qty, freeSpace(e));
    if (want <= 0) continue;
    if (typeof sp.src === 'number') {
      // своё предприятие: себестоимость едет вместе с товаром
      const A = s.enterprises[sp.src];
      if (!A) continue;
      const qty = Math.floor(Math.min(want, stockQty(A, g)) * 1000) / 1000;
      if (qty <= 0) continue;
      const { q, c } = takeStock(A, g, qty);
      const tr = s.prices[g] * TRANSPORT_RATE;
      addStock(e, g, qty, q, c + tr);
      efl(A, g, 'shipped', qty); efl(e, g, 'received', qty);
      pay(A, Math.round(qty * tr), 'transport', 'Транспортная компания');
      continue;
    }
    const o = offerOf(s, g, sp.src, e);
    if (!o) continue;
    const qty = Math.floor(Math.min(want, o.avail, Math.max(0, s.money) / o.price));
    if (qty <= 0) continue;
    addStock(e, g, qty, o.q, o.price);
    takeOffer(s, g, sp.src, qty);
    flow(s, g, 'bought', qty);
    efl(e, g, 'bought', qty); efl(e, g, 'spent', qty * o.price);
    pay(e, qty * o.price, 'purchase', o.name);
  }
  // производство по подразделениям (дробный выпуск копится: 0,3 автомобиля в день — машина за 3–4 дня)
  for (const e of list) {
    const def = entDef(e);
    for (const d of e.divs) {
      const r = RECIPES[d.recipe];
      if (!r || !d.on || !canMake(e, d.recipe)) continue;
      d.wear = Math.min(1, d.wear + wearPerDay(e));
      let n = divInfo(s, e, d).out;
      const netGrow = 1 - Object.values(r.inputs).reduce((a, v) => a + v, 0);
      if (netGrow > 0) n = Math.min(n, freeSpace(e) / netGrow);
      if (n <= 0) continue;
      let inQ = 0, inW = 0, inCost = 0;
      for (const g in r.inputs) {
        const use = n * r.inputs[g] * matFactor(s, d.recipe);
        const t = takeStock(e, g, use);
        inQ += t.q * r.inputs[g]; inW += r.inputs[g]; inCost += t.c * use;
        flow(s, g, 'used', use); efl(e, g, 'used', use);
      }
      d.acc = (d.acc || 0) + n;
      const made = Math.floor(d.acc + 1e-9);
      d.acc -= made;
      const bonus = (salaryEff(s, e) - 1) * 3 + specQuality(s, e) + ((d.eq || 3) - 3) * 0.3, tq = techQuality(s, d.recipe);
      const q = inW ? 0.6 * (inQ / inW) + 0.4 * tq + 0.5 + bonus : tq + bonus;
      // себестоимость: сырьё + зарплата подразделения + доля содержания (копится до готовой единицы)
      d.accCost = (d.accCost || 0) + inCost + d.workers * e.salary + def.upkeep * d.level;
      if (made <= 0) continue;
      const unitCost = d.accCost / (made + d.acc);
      d.accCost -= unitCost * made;
      addStock(e, d.recipe, made, round1(clamp(q, 1, 10)), unitCost);
      e.last.produced[d.recipe] = (e.last.produced[d.recipe] || 0) + made;
      flow(s, d.recipe, 'made', made); efl(e, d.recipe, 'made', made);
    }
  }
  // продажи горожанам: магазины, рестораны, салоны, автосервисы
  let shopRevenue = 0;
  const cityBonus = 1 + 0.1 * ((s.city?.level || 1) - 1);
  for (const e of list) {
    const def = entDef(e);
    if (!def.sells) continue;
    const host = s.buildings[e.host];
    if (!host) continue;
    const area = catchment(s, host, shopRadius(e), profileOf(e), e.id);
    e.area = area;
    const cap = workersOf(e) * SHOP_TURNOVER_PER_WORKER * salaryEff(s, e) * specBonus(s, e); // ₽ в день
    const wants = {};
    let total = 0;
    for (const g of availableGoods(e)) {
      if (!e.stock[g]) continue;
      const gd = GOODS[g];
      const price = shopPrice(s, e, g), ref = retailRef(s, g);
      if (price > ref * PRICE_CAP) continue; // слишком дорого — не берут
      const attr = Math.pow(e.stock[g].q / NPC_QUALITY, 0.6) * Math.pow(ref / price, 2.5);
      // спрос покупателей в охвате (demand — на 100 человек в день); делится с конкурентами того же профиля
      const people = area.pop * POP_SCALE * (def.reach || 1);
      const demand = ((gd.demand || 0.05) / 100) * people * cityBonus * (s.demandMods[g]?.mult || 1) * (1 + 0.1 * (levelOf(e) - 1));
      wants[g] = Math.min(stockQty(e, g), demand * (attr / (attr + area.comp + 0.5)) * 1.5 * (0.9 + Math.random() * 0.2));
      total += wants[g] * price;
    }
    // у магазина пропускная способность — продавцы (оборот в ₽); у ресторанов и салонов — само производство
    const k = def.goods && total > cap ? cap / total : 1;
    for (const g in wants) {
      let qty = wants[g] * k;
      qty = qty >= 1 ? Math.floor(qty) : Math.random() < qty ? 1 : 0; // дорогие товары покупают не каждый день
      if (qty <= 0 || qty > stockQty(e, g)) continue;
      takeStock(e, g, qty);
      const sum = Math.round(qty * shopPrice(s, e, g));
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
    const dir = e.resDir || 'q', map = techMap(s, dir), lvl = map[e.research] || 0;
    if (lvl >= 10) continue;
    const pts = e.divs.reduce((a, d) => a + d.workers * d.level, 0) / 1.5 * salaryEff(s, e) * specBonus(s, e);
    e.progress += pts;
    e.xpExtra = (e.xpExtra || 0) + pts * 6000;
    if (e.progress >= researchCost(lvl)) {
      e.progress -= researchCost(lvl);
      map[e.research] = lvl + 1;
      news(`🔬 Открытие! «${GOODS[e.research].name}», ${RES_DIRS[dir].toLowerCase()} — уровень ${lvl + 1}`);
    }
  }
  // обучение персонала, реклама
  for (const e of list) {
    for (const d of e.divs) {
      // обучение: пока включено и не достигнут максимум; после отмены квалификация не падает
      if (d.trainOn && d.workers > 0 && (d.train || 0) < TRAIN_MAX) {
        pay(e, trainCost(e, d), 'salary', 'Учебный центр');
        d.train = Math.min(TRAIN_MAX, (d.train || 0) + 0.04);
      }
      // износ у работающего оборудования, которое не производит (склады, лаборатории, бригады)
      if (equipOf(e) && d.on && d.workers > 0 && !RECIPES[d.recipe]) d.wear = Math.min(1, d.wear + wearPerDay(e));
    }
    if (entDef(e).sells) {
      const target = (e.ad || 0) / 100;
      if (e.ad) pay(e, adCost(e, e.ad), 'upkeep', 'Рекламное агентство');
      e.aware = target > (e.aware ?? 0.2) ? Math.min(target, (e.aware ?? 0.2) + 0.08) : Math.max(target, (e.aware ?? 0.2) - 0.02);
    }
  }
  // зарплаты и содержание, история
  for (const e of list) {
    // в остановленном цехе рабочим платят четверть зарплаты (вики «Завод»)
    const wages = e.divs.reduce((a, d) => a + d.workers * e.salary * (d.on ? 1 : 0.25), 0);
    pay(e, wages, 'salary', 'Сотрудники');
    pay(e, entDef(e).upkeep * levelOf(e), 'upkeep', 'Коммунальные службы');
    e.hist.push({ rev: e.last.revenue, exp: e.last.expense });
    if (e.hist.length > 60) e.hist.shift();
    e.flh.push(e.fl);
    if (e.flh.length > 14) e.flh.shift();
  }
  // опыт: стоимость произведённого, выручка, поставки своим (вполовину), исследования и стройка
  for (const e of list) {
    let v = e.xpExtra || 0;
    for (const g in e.fl) {
      const f = e.fl[g];
      v += (f.made || 0) * s.prices[g] + (f.rev || 0) + (f.shipped || 0) * s.prices[g] * 0.5;
    }
    e.xpExtra = 0;
    e.lastXp = Math.round(v);
    gainXp(s, e, v, news);
  }
  specsTick(s, { spend, news });
  // склады города: подвоз извне и покупки остальных горожан; цена растёт при дефиците
  for (const g in s.prices) {
    const d = depotOf(g);
    let scarcity = 1;
    if (d) {
      s.depot[g] = Math.max(0, Math.round((s.depot[g] * (1 - d.restock / d.start) + d.restock) * 100) / 100);
      scarcity = clamp(Math.pow(d.start / (s.depot[g] + d.start * 0.05), 0.35), 0.75, 2.5);
      // конкуренты тоже производят и пополняют свои склады
      const cap = npcStart(g) * 1.5;
      if (s.npc?.[g]) s.npc[g] = s.npc[g].map((v, i) => (npcSells(g, i) ? Math.min(cap, v + npcRestock(g)) : 0));
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
  if ((s.compLvl || 1) < FEATURES.specialists) return { error: `Нанимать специалистов можно с ${FEATURES.specialists}-го уровня компании` };
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
    e.lvl = Math.max(1, levelOf(e)); e.xp = 0;
    e.hist ||= []; e.flh ||= [];
    delete e.recipe; delete e.level; delete e.workers; delete e.target;
  }
  for (const e of Object.values(s.enterprises)) {
    if (!e.lvl) { e.lvl = Math.max(1, levelOf(e)); e.xp = 0; }
    e.aware ??= 0.5; e.ad ??= 0; e.resDir ||= 'q';
    for (const d of e.divs) { d.eq ??= 3; d.train ??= 0; d.trainOn ??= false; d.eqN ??= eqNeed(e, d); }
    if (e.autoSupply && e.autoSupply.weeks == null) e.autoSupply.weeks = clamp(Math.round((e.autoSupply.days || 7) / 7), 1, 5);
    if (e.type === 'mine' && !e.sub) e.sub = { ore: 'ore', coal: 'coal', stone: 'stone', sand: 'sand', clay: 'clay', gold: 'gold' }[e.divs[0]?.recipe] || 'stone';
  }
  // закупки и поставки старого формата → снабжение с выбором поставщика
  for (const e of Object.values(s.enterprises)) {
    e.supply ||= {};
    for (const g in e.buy || {}) if (GOODS[g] && !e.supply[g]) e.supply[g] = { src: 'depot', qty: e.buy[g] };
    delete e.buy;
  }
  for (const c of s.contracts || []) { const B = s.enterprises[c.to]; if (B && GOODS[ren(c.good)] && s.enterprises[c.from]) B.supply[ren(c.good)] = { src: c.from, qty: c.qty }; }
  s.contracts = [];
}
