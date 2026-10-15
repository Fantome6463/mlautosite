// Учёт денег и товаров: все движения по счёту компании проходят через pay(),
// чтобы были отчёты по статьям, выписка по счёту и контрагенты.

export const COMPANY = 'company';

// Статьи доходов и расходов. side: inc — доход, exp — расход; group — раздел отчёта.
export const CATS = {
  wholesale:  { side: 'inc', group: 'op',  name: 'Выручка от продажи товаров (опт)' },
  retail:     { side: 'inc', group: 'op',  name: 'Розничные продажи' },
  rent:       { side: 'inc', group: 'op',  name: 'Рента (аренда помещений)' },
  subsidy:    { side: 'inc', group: 'op',  name: 'Госзаказ (больница, полиция)' },
  other:      { side: 'inc', group: 'op',  name: 'Прочие доходы' },
  purchase:   { side: 'exp', group: 'op',  name: 'Покупка сырья, товаров' },
  transport:  { side: 'exp', group: 'op',  name: 'Транспортные расходы' },
  salary:     { side: 'exp', group: 'op',  name: 'Расходы на персонал' },
  specSalary: { side: 'exp', group: 'op',  name: 'Зарплата специалистов' },
  shopRent:   { side: 'exp', group: 'op',  name: 'Аренда' },
  upkeep:     { side: 'exp', group: 'op',  name: 'Содержание предприятий' },
  estate:     { side: 'exp', group: 'op',  name: 'Содержание зданий' },
  tax:        { side: 'exp', group: 'op',  name: 'Налоговые отчисления (земля)' },
  sellEnt:    { side: 'inc', group: 'inv', name: 'Продажа предприятий' },
  sellEstate: { side: 'inc', group: 'inv', name: 'Продажа недвижимости' },
  buyEnt:     { side: 'exp', group: 'inv', name: 'Покупка предприятий' },
  land:       { side: 'exp', group: 'inv', name: 'Покупка недвижимости (земля)' },
  construction:{ side: 'exp', group: 'inv', name: 'Строительство' },
  equipment:  { side: 'exp', group: 'inv', name: 'Покупка оборудования (расширение)' },
  hire:       { side: 'exp', group: 'inv', name: 'Найм специалистов' },
  loan:       { side: 'inc', group: 'fin', name: 'Кредиты полученные' },
  interest:   { side: 'exp', group: 'fin', name: 'Проценты по кредитам' },
  repay:      { side: 'exp', group: 'fin', name: 'Погашение кредитов' },
  hq:         { side: 'exp', group: 'fin', name: 'Штаб-квартира' },
};

export function initLedger(s) {
  s.today ||= { inc: {}, exp: {} };
  s.flowToday ||= {};
  s.totals ||= { all: { inc: {}, exp: {} }, years: {} };
  s.tx ||= [];
  s.txId ||= 1;
  s.loanLog ||= [];
}

export const gameYear = day => Math.floor((day - 1) / 365) + 1;

// amount > 0 — деньги пришли, < 0 — ушли. party — контрагент, from — кто в компании (предприятие или здание).
export function pay(s, amount, cat, { party = '—', from = null, type = CATS[cat]?.name || cat } = {}) {
  amount = Math.round(amount);
  if (!amount) return;
  s.money += amount;
  const side = CATS[cat]?.side || (amount > 0 ? 'inc' : 'exp');
  const v = Math.abs(amount);
  s.today[side][cat] = (s.today[side][cat] || 0) + v;
  const y = (s.totals.years[gameYear(s.day)] ||= { inc: {}, exp: {} });
  for (const t of [s.totals.all, y]) t[side][cat] = (t[side][cat] || 0) + v;
  s.tx.unshift({ id: s.txId++, day: s.day, from, party, type, amount, balance: Math.round(s.money) });
  if (s.tx.length > 800) s.tx.length = 800;
}

// Товарооборот: bought — куплено, made — произведено, used — потреблено, whole — продано оптом, retail — в розницу
export function flow(s, g, field, qty) {
  if (!qty) return;
  const f = (s.flowToday[g] ||= {});
  f[field] = (f[field] || 0) + qty;
}

// Закрыть день: вернуть накопленное и обнулить
export function closeDay(s) {
  const day = s.today, fl = s.flowToday;
  s.today = { inc: {}, exp: {} };
  s.flowToday = {};
  return { day, flow: fl };
}
