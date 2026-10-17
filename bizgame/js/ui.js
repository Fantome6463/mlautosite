// Интерфейс: панели участков, зданий и предприятий, окна, новости, значки над зданиями.
import {
  GOODS, RECIPES, ENTERPRISES, BUILDINGS, UNITS, CATEGORIES, CONTRACTORS, OWN, contractorInfo, RIVALS,
  NPC_QUALITY, BUY_RATE, SELL_RATE, SHOP_TURNOVER_PER_WORKER, TRANSPORT_RATE, POP_SCALE, ADVANCE, unitOf,
  PLOT_SIZES, plotK, isArea, HQ, HQ_MAX, hqLimit, hqUpgradeCost, specSalary, companyXpNeed, FEATURES, AUTO_SUPPLY_ENT_LEVEL,
} from './data.js';
import * as G from './game.js';
import * as P from './production.js';
import { CATS } from './ledger.js';
import { entDef, defOf, recipesFor, sellsList, accepts, producers, GROUPS, UNLOCKS } from './catalog.js';
import { ic, eTile, entTile, bTile, bGlyph, unitIc, stripEmoji } from './icons.js';

const $ = s => document.querySelector(s);
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = G.fmt;
const num = v => Math.round(v).toLocaleString('ru-RU');
const pct = v => Math.round(v * 100) + '%';
// количество: дробное для штучных дорогих товаров (0,24 автомобиля в день)
const qty = v => (Math.abs(v) >= 100 || Number.isInteger(v) ? num(v) : (Math.round(v * 100) / 100).toLocaleString('ru-RU'));
const qu = (v, g) => `${qty(v)} <small class="hint">${unitOf(g)}</small>`;
const srcName = (s, src) => (src === 'depot' ? 'Склады города' : /^npc\d$/.test(src) ? RIVALS[+src.slice(3)].name : s.enterprises[src]?.name || '—');
const qBadge = q => {
  const c = q < 3 ? '#f43f5e' : q < 5 ? '#f59e0b' : q < 7 ? '#22c55e' : '#a855f7';
  return `<span class="q" style="background:${c}33;color:${c}">${q.toFixed(1)}</span>`;
};
const stars = q => '★'.repeat(q) + '☆'.repeat(5 - q);
const goodName = g => `${GOODS[g].icon} ${GOODS[g].name}`;               // для <option>
const gn = g => `<span class="gn"><span class="ge">${GOODS[g].icon}</span>${GOODS[g].name}</span>`; // для разметки
const initials = n => String(n).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const ava = (name, cls = '') => `<span class="avatar ${cls}">${esc(initials(name))}</span>`;
// Звезда уровня предприятия: уровень и сколько свободных уровней (как «8+4» в Бизмании)
const lvlStar = (e, cls = '') => {
  const free = P.freeLevels(e);
  return `<span class="lvlwrap" title="Уровень предприятия ${e.lvl || 1}, свободных уровней: ${free}"><span class="star ${cls}">${e.lvl || 1}</span>${free ? `<b class="free">+${free}</b>` : ''}</span>`;
};
const entName = e => esc(e.name);
const entHtml = e => `<span class="nm">${eTile(e, 'sm')}${esc(e.name)}</span>`;
const bTitle = b => `${BUILDINGS[b.type].name} №${b.id}`;
const bHtml = b => `${bTile(b.state === 'build' ? 'site' : b.type, 'sm')}${bTitle(b)}`;
const ownerName = (s, b) => (b.owner === 'player' ? esc(s.company) : esc(RIVALS[b.owner].name));
const ownerColor = b => (b.owner === 'player' ? '#3b82f6' : RIVALS[b.owner].color);
const fmtShort = v => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(Math.abs(v) >= 1e8 ? 0 : 1).replace('.', ',') + ' млн ₽' : fmt(v));
const WEEK = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
// День игры → календарная дата: 1-й день — понедельник, 1 января 1-го года
// Короткая дата как в Бизмании: 28.10.0001
function shortDate(day) {
  const d = new Date(Date.UTC(2001, 0, day));
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCFullYear() - 2000).padStart(4, '0')}`;
}
const weekOf = (hist = []) => hist.slice(-7).reduce((a, d) => ({ rev: a.rev + d.rev, exp: a.exp + d.exp }), { rev: 0, exp: 0 });
const accountNo = s => `P${s.accNo}RUB${String((s.accNo * 7919) % 1000000).padStart(6, '0')}`;
function canvas2d(c) {
  const dpr = devicePixelRatio || 1;
  c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  x.font = '11px system-ui';
  return { x, W: c.clientWidth, H: c.clientHeight };
}
// Группы товаров для «Товарооборота»
function goodGroups() {
  const out = {};
  for (const g in GOODS) (out[GROUPS[GOODS[g].group]] ||= []).push(g);
  return out;
}
// Что откроется на ближайших уровнях компании
function nextUnlocks(s) {
  const L = G.companyLevel(s), list = [];
  for (const [k, l] of Object.entries(UNLOCKS)) if (l > L && l <= L + 3) { const [t, sb] = k.split(':'); list.push([l, defOf(t, sb)]); }
  list.sort((a, b) => a[0] - b[0]);
  return list.length ? `<div class="hint" style="margin-top:6px">Скоро: ${list.slice(0, 4).map(([l, d]) => `${d.name} (${l})`).join(', ')}</div>` : '';
}
function gameDate(day) {
  const d = new Date(Date.UTC(2001, 0, day));
  return `${WEEK[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() - 2000}-го года`;
}

export class UI {
  constructor(app) {
    this.app = app;           // { state, world, act(fn), select(i,j), selectEnt(id), newGame() }
    this.sel = null;          // {kind:'plot', i, j} | {kind:'ent', id}
    this.tab = 'main';
    this.form = { type: 'residential', floors: 5, contractor: 'trest' };
    this.page = 'company';
    this.coTab = 'main';
    this.winTab = 'goods';
    this.lastNews = null;

    for (const el of [$('#side'), $('#pageBody')]) {
      el.addEventListener('click', e => this.onClick(e));
      el.addEventListener('change', e => this.onChange(e));
    }
    document.querySelectorAll('[data-ic]').forEach(el => el.insertAdjacentHTML('afterbegin', ic(el.dataset.ic)));
    document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); if (b.dataset.rep) this.rep = b.dataset.rep; this.openPage(b.dataset.page, b.dataset.tab); }));
  }

  get s() { return this.app.state; }

  toast(text, err = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = stripEmoji(text);
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  reset() {
    if (!confirm('Сбросить весь прогресс и начать с пустого города?')) return;
    this.app.newGame();
  }

  // ---------- верхняя панель ----------
  renderTop(msLeft, speed) {
    const s = this.s;
    $('#money').textContent = fmtShort(s.money);
    $('#compLvl').textContent = G.companyLevel(s);
    $('#worth').textContent = fmtShort(G.netWorth(s));
    $('#pop').textContent = num(s.city.population || 0);
    $('#hdrCompany').textContent = s.company;
    $('#date').textContent = gameDate(s.day);
    const sec = Math.ceil(msLeft / 1000);
    $('#dayLeft').textContent = speed ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}${speed > 1 ? ` ×${speed}` : ''}` : 'пауза';
    $('#dayBar').style.width = `${Math.max(0, Math.min(100, 100 - (msLeft / (this.app.dayMs || 60000)) * 100))}%`;
    $('#questDot').classList.toggle('on', G.QUESTS.some(q => !s.quests[q.id]) && this.page !== 'quests');
    const n = s.news[0];
    if (n && n !== this.lastNews) {
      this.lastNews = n;
      $('#news').innerHTML = `<span class="item"><span class="d">День ${n.day}</span>${esc(stripEmoji(n.text))}</span>`;
    }
  }

  // ---------- значки над зданиями ----------
  renderBadges() {
    const s = this.s, world = this.app.world, root = $('#badges');
    const shopHosts = new Set(Object.values(s.enterprises).filter(e => e.host).map(e => e.host));
    const list = Object.values(s.buildings).filter(b => b.owner === 'player' || shopHosts.has(b.id));
    while (root.children.length < list.length) root.appendChild(document.createElement('div'));
    while (root.children.length > list.length) root.lastChild.remove();
    list.forEach((b, n) => {
      const el = root.children[n];
      const p = world.screenPos(b.i, b.j, world.heightOf(b));
      if (!p) { el.style.display = 'none'; return; }
      let html, bad = false;
      if (b.state === 'build') { bad = b.paused; html = `${ic(b.paused ? 'stop' : 'crane')}${pct(b.progress / b.buildDays)}`; }
      else if (b.owner === 'player') html = `${ic(bGlyph(b.type))}${BUILDINGS[b.type].category === 'social' ? '' : pct(G.occRate(b))}`;
      else html = '';
      if (shopHosts.has(b.id)) html += ic('store');
      if (el._h !== html) { el.innerHTML = html.trim(); el._h = html; }
      el.className = 'badge' + (bad ? ' bad' : '');
      el.style.display = '';
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    });
  }

  entProblem(e) {
    const s = this.s, d = entDef(e);
    if (P.targetOf(e) === 0) return 'Нет сотрудников';
    if (e.salary < s.marketSalary * 0.7) return 'Низкая зарплата — люди увольняются';
    if (d.sells && !e.host) return 'Нет помещения';
    if (d.goods && !d.goods.some(g => e.stock[g])) return 'Нечего продавать — настройте снабжение';
    if (e.type === 'lab' && !e.research) return 'Не выбрано исследование';
    if (e.type === 'construction' && !Object.values(s.buildings).some(b => b.builder === e.id && b.state === 'build')) return 'Нет строек — закажите здание «своими силами»';
    if (d.storage && P.freeSpace(e) <= 0) return 'Склад переполнен';
    if (P.wearOf(e) > 0.6) return 'Оборудование изношено — нужен ремонт';
    if (P.equipOf(e) && e.divs.some(d => (d.eqN || 0) < P.eqNeed(e, d) * 0.5)) return `Не хватает оборудования (${P.equipOf(e).name}) — купите на вкладке «Подразделения»`;
    if (s.day > e.built + 1) for (const x of e.divs) {
      const info = P.divInfo(s, e, x);
      if (info && info.limitBy && (e.last.produced[x.recipe] || 0) < info.maxOut * 0.3) return `Производство остановлено из-за недостатка сырья: ${GOODS[info.limitBy].name}`;
    }
    return null;
  }

  // ---------- выбор ----------
  selectPlot(i, j) {
    if (i == null) { this.sel = null; $('#side').hidden = true; return; }
    if (this.sel?.kind !== 'plot' || this.sel.i !== i || this.sel.j !== j) this.tab = 'main';
    this.sel = { kind: 'plot', i, j };
    $('#side').hidden = false;
    this.renderSide(true);
  }
  selectEnt(id) {
    if (this.entId !== id) this.entTab = 'main';
    this.entId = id;
    this.openPage('ent');
  }

  renderSide(force = false) {
    if (!this.sel) return;
    const side = $('#side');
    if (!force && side.contains(document.activeElement) && document.activeElement.matches('input,select')) return;
    const top = side.scrollTop;
    const s = this.s;
    let html = `<button class="x" data-act="close" title="Закрыть">${ic('x')}</button>`;
    {
      const { i, j } = this.sel;
      const b = G.buildingAt(s, i, j);
      if (!b) html += this.orderHtml(s.plots[G.key(i, j)]);
      else if (b.state === 'build') html += this.siteHtml(b);
      else if (b.owner === 'player') html += this.myBuildingHtml(b);
      else html += this.rivalBuildingHtml(b);
    }
    side.innerHTML = html;
    this.foldHints(side);
    side.scrollTop = top;
  }

  coverageHtml(i, j) {
    const c = G.coverage(this.s, i, j);
    return `<span>Больница рядом</span><span class="${c.health ? 'pos' : ''}">${c.health ? 'да' : 'нет'}</span><span>Полиция рядом</span><span class="${c.safety ? 'pos' : ''}">${c.safety ? 'да' : 'нет'}</span>`;
  }

  // ---------- заказ стройки ----------
  orderHtml(p) {
    const s = this.s, f = this.form;
    if (!BUILDINGS[f.type].floors.includes(f.floors)) f.floors = BUILDINGS[f.type].floors[0];
    const locWord = p.loc >= 1.4 ? 'отличный' : p.loc >= 1.05 ? 'хороший' : p.loc >= 0.8 ? 'средний' : 'окраина';
    let h = `<h2>${ic('pin')} Свободный участок</h2><div class="sub">Участок ${p.i}:${p.j}</div>
      <div class="kv"><span>Площадь участка</span><span>${PLOT_SIZES[p.size || 'm'].name}, ${PLOT_SIZES[p.size || 'm'].area}</span><span>Цена земли</span><span>${fmt(p.price)}</span>
        <span>Район</span><span>${p.loc.toFixed(2)} — ${locWord}</span>${this.coverageHtml(p.i, p.j)}</div>
      <p class="hint">В центре дороже земля, но выше аренда и больше покупателей. На крупном участке здание шире: больше квартир, офисов и торговых площадей, но и стройка дороже.</p>
      <div class="box"><h4>1. Что строим</h4>`;
    for (const cat in CATEGORIES) {
      const types = Object.keys(BUILDINGS).filter(t => BUILDINGS[t].category === cat);
      h += `<div class="cat"><b>${CATEGORIES[cat].name}</b><small>${CATEGORIES[cat].desc}</small><div class="chips">
        ${types.map(t => `<button class="bcard ${f.type === t ? 'on' : ''}" data-act="ftype" data-v="${t}">${this.thumb('b', t, null, 'sm')}<span>${BUILDINGS[t].name}</span></button>`).join('')}</div></div>`;
    }
    const d = BUILDINGS[f.type];
    h += `</div>`;
    if (d.floors.length > 1) {
      h += `<div class="box"><h4>2. Этажность</h4><div class="chips">${d.floors.map(n => `<button class="chip ${f.floors === n ? 'on' : ''}" data-act="ffloors" data-v="${n}">${n} эт.</button>`).join('')}</div>
        <div class="kv">${Object.entries(d.units(f.floors, plotK(p))).map(([t, n]) => `<span>${unitIc(t)} ${UNITS[t].name}</span><span>${isArea(t) ? `${num(n)} м² по ~${Math.round(G.refRent(p, t))} ₽/м²` : `${n} шт. по ~${num(G.refRent(p, t))} ₽`} в день</span>`).join('')}</div></div>`;
    } else {
      h += `<div class="box"><h4>2. Как работает</h4><div class="kv"><span>Город платит</span><span>${fmt(d.subsidy)}/день</span><span>Содержание</span><span>${fmt(d.upkeep)}/день</span>
        <span>Радиус</span><span>${d.radius} участка</span></div><p class="hint">Дома в радиусе охотнее снимают и платят за аренду больше. Город растёт быстрее.</p></div>`;
    }
    h += `<div class="box"><h4>3. Кто строит</h4>`;
    for (const c of [...Object.keys(CONTRACTORS), 'own']) {
      const info = contractorInfo(c), q = G.quote(s, f.type, f.floors, c, plotK(p));
      let extra = '';
      if (c === 'own') {
        const co = G.builders(s)[0];
        extra = co
          ? `<div class="mats">${Object.entries(q.materials).map(([g, n]) => { const have = P.stockQty(co, g); return `<span class="${have >= n ? 'pos' : 'warn'}">${gn(g)} ${num(have)}/${num(n)}</span>`; }).join('')}</div>
             <small>Материалы берутся со склада «${esc(co.name)}» по ходу стройки. Не хватит — стройка встанет.</small>`
          : `<small class="warn">Нужна своя строительная компания — создайте её в меню «Предприятия».</small>`;
      }
      h += `<label class="contractor ${f.contractor === c ? 'on' : ''}"><input type="radio" name="contractor" data-act="fcontr" value="${c}" ${f.contractor === c ? 'checked' : ''}>
        <div><b style="color:${info.color}">${info.name}</b> <span class="stars">${stars(q.quality)}</span><small>${info.desc}</small>${extra}</div>
        <div class="r"><b>${c === 'own' ? '~' : ''}${fmt(q.cost)}</b><small>${q.days} дн.</small></div></label>`;
    }
    const q = G.quote(s, f.type, f.floors, f.contractor, plotK(p));
    const now = p.price + (q.own ? 0 : Math.round(q.cost * ADVANCE));
    const err = G.orderCheck(s, f.type, f.floors, f.contractor, p.i, p.j);
    h += `</div><div class="kv"><span>Земля</span><span>${fmt(p.price)}</span>
      <span>${q.own ? 'Материалы (по ходу стройки)' : `Аванс ${ADVANCE * 100}% сейчас`}</span><span>${fmt(q.own ? q.cost : q.cost * ADVANCE)}</span>
      ${q.own ? '' : `<span>Остальное — по ходу стройки</span><span>${fmt(q.cost * (1 - ADVANCE))}</span>`}
      <span><b>Платите сейчас</b></span><span><b>${fmt(now)}</b></span></div>
      ${err ? `<div class="warn">${esc(err)}</div>` : ''}
      <div class="actions"><button class="btn primary" data-act="order" ${err ? 'disabled' : ''}>${ic('crane')} Заказать строительство</button></div>`;
    return h;
  }

  siteHtml(b) {
    const s = this.s, c = contractorInfo(b.contractor), mine = b.owner === 'player';
    const left = Math.max(0, b.buildDays - b.progress);
    let h = `<h2>${bTile('site')} Стройка</h2><div class="sub">${bTitle(b)} · ${b.floors} эт. · участок ${b.i}:${b.j}</div>
      <div class="kv"><span>Владелец</span><span style="color:${ownerColor(b)}">${ownerName(s, b)}</span>
      <span>Строит</span><span style="color:${c.color}">${c.name}</span>
      <span>Готовность</span><span>${pct(b.progress / b.buildDays)}</span></div>
      <div class="bar"><i style="width:${(b.progress / b.buildDays) * 100}%"></i></div>`;
    if (!mine) return h + '<p class="hint">Стройка конкурента.</p>';
    h += `<div class="kv"><span>Осталось</span><span>~${Math.ceil(left)} дн.</span>
      <span>${b.contractor === 'own' ? 'Потрачено на материалы' : 'Оплачено'}</span><span>${fmt(b.paid)}${b.contractor === 'own' ? '' : ' из ' + fmt(b.cost)}</span></div>`;
    if (b.paused) {
      const why = b.waiting === 'company' ? 'нет строительной компании' : b.waiting === 'crew' ? 'нет рабочих в строительной компании'
        : b.waiting && GOODS[b.waiting] ? `не хватает материала «${GOODS[b.waiting].name}»` : 'нечем платить подрядчику';
      h += `<div class="warn">Стройка стоит: ${why}</div>`;
    } else if (b.delayed) h += '<div class="warn">Сегодня простой у подрядчика</div>';
    if (b.contractor === 'own') {
      const co = s.enterprises[b.builder];
      h += `<div class="box"><h4>Материалы (нужно всего / на складе компании)</h4><div class="kv">
        ${Object.entries(b.materials).map(([g, n]) => `<span>${gn(g)}</span><span>${num(n)} / ${co ? num(P.stockQty(co, g)) : 0}</span>`).join('')}</div>
        ${co ? `<button class="btn small" data-act="openent" data-id="${co.id}">${ic('hardhat')} Открыть «${esc(co.name)}»</button>` : ''}</div>`;
    }
    h += `<div class="actions"><button class="btn danger" data-act="cancel">Отменить стройку (вернут ${fmt(b.land * 0.8 + (b.contractor === 'own' ? 0 : b.paid * 0.3))})</button></div>`;
    return h;
  }

  unitsTable(b, editable) {
    const s = this.s, p = s.plots[G.key(b.i, b.j)];
    let h = `<table><tr><th>Помещения</th><th class="r">Занято</th><th>Аренда в день</th><th class="r">Рынок</th></tr>`;
    for (const t in b.units) {
      const u = b.units[t], area = isArea(t);
      const shops = area ? P.shopArea(s, b) : 0;
      h += `<tr><td><span class="nm">${unitIc(t)}${UNITS[t].name}</span></td><td class="r nw">${num(u.occ + shops)} / ${num(u.total)}${area ? ' м²' : ''}</td>
        <td class="nw">${editable ? `<input type="number" min="1" value="${u.rent}" data-act="rent" data-t="${t}" style="width:72px">` : num(u.rent)} <span class="hint">₽${area ? '/м²' : ''}</span></td>
        <td class="r">${Math.round(G.refRent(p, t))}</td></tr>`;
    }
    return h + '</table>';
  }

  myBuildingHtml(b) {
    const s = this.s, d = BUILDINGS[b.type];
    const tabs = [['main', 'Обзор']];
    if (Object.keys(b.units).length) tabs.push(['tenants', 'Арендаторы']);
    if (!tabs.some(t => t[0] === this.tab)) this.tab = 'main';
    let h = `${this.thumb('b', b.type, null, 'side')}<h2>${d.name}</h2><div class="sub">№${b.id} · ${b.floors} эт. · участок ${b.i}:${b.j} · построил ${contractorInfo(b.contractor).name}</div>
      <div class="tabs">${tabs.map(([k, n]) => `<button data-act="tab" data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const profit = b.last.income - b.last.expense;
    if (this.tab === 'main') {
      h += `<div class="box"><h4>Вчера</h4><div class="kv"><span>${d.subsidy ? 'Оплата от города' : 'Аренда'}</span><span class="pos">${fmt(b.last.income)}</span>
        <span>Содержание и налог</span><span class="neg">${fmt(b.last.expense)}</span><span>Прибыль</span><span class="${profit >= 0 ? 'pos' : 'neg'}">${fmt(profit)}</span></div></div>`;
      if (d.service) {
        const covered = Object.values(s.buildings).filter(x => x.id !== b.id && Math.hypot(x.i - b.i, x.j - b.j) <= d.radius && Object.keys(x.units).length).length;
        h += `<div class="box"><div class="kv"><span>Радиус действия</span><span>${d.radius} участка</span><span>Домов в зоне</span><span>${covered}</span></div>
          <p class="hint">Здания в зелёном круге получают бонус к привлекательности. Каждая больница и отделение полиции ускоряют рост города.</p></div>`;
      } else {
        h += `<div class="box"><h4>Аренда</h4>${this.unitsTable(b, true)}
          <p class="hint">Дороже рынка — арендаторы съезжают, дешевле — заселяются быстрее. Рыночная цена зависит от района.</p></div>`;
      }
      h += `<div class="kv"><span>Качество постройки</span><span>${stars(b.quality)}</span>${this.coverageHtml(b.i, b.j)}
        <span>Рыночная стоимость</span><span>${fmt(G.marketValue(b))}</span></div>
        <div class="actions"><button class="btn danger" data-act="sellb">Продать (${fmt(G.marketValue(b) * 0.9)})</button></div>`;
    } else h += this.tenantsHtml(b);
    return h;
  }

  tenantsHtml(b) {
    const s = this.s;
    const shops = P.shopsIn(s, b);
    let h = '';
    if (b.units.apt) h += `<div class="box"><h4>${unitIc('apt')} Квартиры</h4>Живёт семей: <b>${b.units.apt.occ}</b> из ${b.units.apt.total} (≈${Math.round(b.units.apt.occ * 2.4)} чел.)</div>`;
    for (const t of ['comm', 'office']) {
      if (!b.units[t]) continue;
      const names = b.tenants[t] || [], area = isArea(t);
      h += `<div class="box"><h4>${unitIc(t)} ${UNITS[t].name}${area ? ` · ${num(b.units[t].total)} м², свободно ${num(Math.max(0, b.units[t].total - b.units[t].occ - P.shopArea(s, b)))} м²` : ''}</h4>
        ${area ? shops.map(e => `<div class="row">${eTile(e, 'sm')} <a href="#" data-act="openent" data-id="${e.id}">${esc(e.name)}</a> <span class="hint">${P.entArea(e)} м² · ${s.buildings[e.host].owner === 'player' ? 'ваш, без аренды' : 'ваш'}</span></div>`).join('') : ''}
        ${names.length ? names.map(n => `<div class="row">${esc(n.n || n)}${n.a ? ` <span class="hint">${n.a} м²</span>` : ''}</div>`).join('') : (area && shops.length ? '' : '<span class="hint">Пусто</span>')}</div>`;
    }
    h += this.openShopHtml(b);
    return h;
  }

  openShopHtml(b) {
    const s = this.s;
    if (!b.units.comm || P.freeArea(s, b) < P.AREA_BY_LEVEL[1]) return '';
    const own = b.owner === 'player';
    const free = b.units.comm.total - b.units.comm.occ - P.shopArea(s, b);
    return `<div class="box"><h4>Своя точка продаж здесь</h4>
      <p class="hint">Отдел 1-го уровня занимает ${P.AREA_BY_LEVEL[1]} м², 7-го — ${P.AREA_BY_LEVEL[7]} м². ${own ? (free >= P.AREA_BY_LEVEL[1] ? `Свободно ${num(free)} м² — аренду платить не нужно.` : 'Свободной площади мало: часть арендаторов съедет.') : `Свободно ${num(free)} м², аренда ${fmt(b.units.comm.rent)} за м² в день владельцу дома.`}
      Открытие: от ${fmt(ENTERPRISES.shop.cost)}.</p>
      <button class="btn primary" data-act="openshop">${ic('store')} Открыть здесь магазин, ресторан, салон…</button></div>`;
  }

  rivalBuildingHtml(b) {
    const s = this.s, d = BUILDINGS[b.type];
    let h = `${this.thumb('b', b.type, null, 'side')}<h2>${d.name}</h2><div class="sub">№${b.id} · ${b.floors} эт. · участок ${b.i}:${b.j}</div>
      <div class="kv"><span>Владелец</span><span style="color:${ownerColor(b)}">${ownerName(s, b)}</span><span>Заполненность</span><span>${pct(G.occRate(b))}</span>${this.coverageHtml(b.i, b.j)}</div>`;
    if (Object.keys(b.units).length) h += this.unitsTable(b, false);
    return h + this.openShopHtml(b);
  }

  // ---------- страница предприятия (как «Пищевой завод» в Бизмании) ----------
  entTabs(e) {
    const d = entDef(e), makes = recipesFor(e.type, e.sub).length && !d.goods;
    const tabs = [['main', d.typeName]];
    if (makes) tabs.push(['prod', 'Производство']);
    if (e.type !== 'lab') tabs.push(['supply', 'Снабжение']);
    if (!['lab', 'construction'].includes(e.type)) tabs.push(['sales', d.sells ? 'Сбыт и цены' : 'Сбыт']);
    if (e.type === 'lab') tabs.push(['lab', 'Исследования']);
    if (e.type === 'construction') tabs.push(['sites', 'Стройки']);
    tabs.push(['divs', 'Подразделения'], ['reports', 'Отчёты']);
    return tabs;
  }

  page_ent(s) {
    const e = s.enterprises[this.entId];
    if (!e) return this.page_company(s);
    const d = entDef(e), tabs = this.entTabs(e);
    if (!tabs.some(t => t[0] === this.entTab)) this.entTab = 'main';
    const host = e.host && s.buildings[e.host];
    const prob = this.entProblem(e);
    return `<div class="page-title">${this.thumb('ent', e.type, e.sub, 'hd')}
        <div><div class="enav"><button class="btn icon" data-act="entnav" data-dir="-1" title="Предыдущее">${ic('left')}</button><button class="btn icon" data-act="entnav" data-dir="1" title="Следующее">${ic('right')}</button>
          <h1>${esc(e.name)}</h1></div>
          <div class="hint">Компания: <a href="#" data-act="cotabgo" data-k="main">${esc(s.company)}</a> · ${d.name}${host ? ` · <a href="#" data-act="goplot" data-i="${host.i}" data-j="${host.j}">дом №${host.id}</a>` : ' · виртуальное предприятие'}</div></div>
        <div class="acts"><span class="hint">${ic('city')} ${esc(s.cityName)}</span>
          <span class="xpwrap" title="Опыт: ${num(e.xp || 0)} из ${num(P.xpNeed(e.lvl || 1))}">Опыт: <span class="effbar"><i style="width:${Math.round(((e.xp || 0) / P.xpNeed(e.lvl || 1)) * 100)}%"></i></span></span>
          Уровень: ${lvlStar(e)}</div></div>
      <div class="ftabs">${tabs.map(([k, n]) => `<button data-act="enttab" data-k="${k}" class="${this.entTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${prob ? `<div class="warn box">${esc(prob)}</div>` : ''}${this[`ep_${this.entTab}`](e, s)}`;
  }

  ep_main(e, s) {
    const d = entDef(e), w = weekOf(e.hist), wear = P.wearOf(e);
    const fill = P.capacity(e) ? P.stockTotal(e) / P.capacity(e) : 0;
    const sp = P.specOf(s, e), eff = Math.min(1, (P.workersOf(e) / Math.max(1, P.maxWorkers(e))) * P.salaryEff(s, e) * P.specBonus(s, e) * (1 - wear / 2));
    const slots = [...e.divs, null];
    return `${this.kpis([
        ['Выручка за неделю', fmtShort(w.rev)],
        ['Прибыль за неделю', fmtShort(w.rev - w.exp), w.rev - w.exp >= 0 ? 'pos' : 'neg'],
        ['Рабочие', `${num(P.workersOf(e))} / ${num(P.maxWorkers(e))}`],
        ['Эффективность', pct(eff), '', eff],
        ['Склад', pct(fill), '', fill],
        ...(P.equipOf(e) ? [['Износ', pct(wear), wear > 0.6 ? 'neg' : '', wear, 'red']] : []),
      ])}
      <div class="split">
        <div><h3>Подразделения</h3>
          <div class="iso">${slots.map(x => x
            ? `<button class="isotile" data-act="enttab-go" data-k="divs" title="${esc(P.divName(e, x))}">${this.thumb('ent', e.type, e.sub, 'sm')}<span class="star sm">${x.level}</span>${x.recipe ? `<b class="ge">${GOODS[x.recipe].icon}</b><span class="slot">${GOODS[x.recipe].name}</span>` : ''}${x.on ? '' : '<em>выкл.</em>'}</button>`
            : `<button class="isotile empty ${P.freeLevels(e) < 1 ? 'nofree' : ''}" data-act="adddiv" title="${P.freeLevels(e) < 1 ? 'Нужен свободный уровень предприятия' : 'Новое подразделение — ' + fmt(P.divCost(e))}"><span>${ic(P.freeLevels(e) < 1 ? 'lock' : 'plus')}${P.freeLevels(e) < 1 ? 'нужен свободный уровень' : 'новое · ' + fmtShort(P.divCost(e))}</span></button>`).join('')}</div>
          ${P.freeLevels(e) >= P.XP_FREE_CAP ? `<p class="warn">Опыт не копится: ${P.XP_FREE_CAP} свободных уровней не использованы — постройте или улучшите подразделение.</p>` : ''}
        </div>
        <div><h3>Прибыль по дням</h3><div class="chart-box"><canvas class="chart" id="echart"></canvas></div>
          <div class="boss-line">${sp ? `${ava(sp.name)} <span><b>${esc(sp.name)}</b><br><span class="hint">${sp.prof} · ${sp.level}-й уровень</span></span>`
            : `<span class="avatar empty">${ic('user')}</span> <span class="hint">Начальник не назначен · <a href="#" data-act="cotabgo" data-k="staff">нанять</a></span>`}</div></div>
      </div>
      <details class="manage" data-k="manage"><summary>${ic('settings')} Управление: название, переезд, объединение, продажа</summary>
        <div class="row"><label>Название</label><input type="text" value="${esc(e.name)}" data-act="ename" maxlength="40" style="width:280px"></div>
        ${this.moveMergeHtml(e, s)}
        <div class="actions"><button class="btn" data-act="gopage" data-k="exchange" data-ex="sell">${ic('handshake')} Продать на бирже · оценка ${fmtShort(P.entValue(s, e))}</button>
          <button class="btn danger" data-act="eclose">Продать государству · ${fmtShort(P.stateBuyout(s, e))}</button></div>
      </details>`;
  }

  // Картинка-миниатюра (3D): здание или предприятие; пока нет картинки — цветная плитка
  thumb(kind, type, sub = null, size = '') {
    const src = this.app.thumbs?.get(kind, type, sub);
    if (src) return `<img class="thumb ${size}" src="${src}" alt="">`;
    return kind === 'ent' ? entTile(type, sub, size === 'sm' ? 'lg' : 'xl') : bTile(type, size === 'sm' ? 'lg' : 'xl');
  }

  // Ряд ключевых показателей: [подпись, значение, класс, доля для полоски, цвет полоски]
  kpis(list) {
    return `<div class="kpis">${list.map(([label, value, cls = '', bar = null, col = '']) => `<div class="kpi"><small>${label}</small><b class="${cls}">${value}</b>${bar != null ? `<span class="effbar ${col}"><i style="width:${Math.round(Math.min(1, Math.max(0, bar)) * 100)}%"></i></span>` : ''}</div>`).join('')}</div>`;
  }

  // Переезд (для торговли) и объединение с предприятием того же вида
  moveMergeHtml(e, s) {
    const d = entDef(e), cands = P.mergeCandidates(s, e);
    let h = '<div class="twocol">';
    if (d.sells) {
      const hosts = P.relocateHosts(s, e), cur = s.buildings[e.host];
      h += `<div class="box"><h4>${ic('truck')} Переезд</h4>
        <p class="hint">Сейчас: ${cur ? `${BUILDINGS[cur.type].name} №${cur.id}` : '—'}, отделы занимают ${P.entArea(e)} м². Нужно помещение, где свободно не меньше. Известность на новом месте упадёт на 30%.</p>
        ${hosts.length ? `<div class="row"><select id="mvHost">${hosts.map(b => { const a = P.catchment(s, b, P.shopRadius(e), P.profileOf(e), e.id);
          return `<option value="${b.id}">${BUILDINGS[b.type].name} №${b.id} (${b.i}:${b.j}) — свободно ${num(P.freeArea(s, b))} м², жителей ~${a.pop}, конкурентов ${a.comp}, ${b.owner === 'player' ? 'ваш, без аренды' : `аренда ${b.units.comm.rent} ₽/м²`}</option>`; }).join('')}</select>
          <button class="btn small primary" data-act="relocate">Переехать за ${fmtShort(P.relocateFee(e))}</button></div>`
          : '<p class="warn">Нет помещений с нужной свободной площадью. Постройте торговый центр или ЖК с галереей.</p>'}</div>`;
    }
    h += `<div class="box"><h4>${ic('layers')} Объединение</h4>
      <p class="hint">Можно объединить только с предприятием того же вида (${esc(d.name.toLowerCase())}). Подразделения, склад, снабжение, уровни и опыт переходят сюда,
        место в управляющем отделе освобождается.${d.sells ? ' Отделам второго предприятия нужна свободная площадь в этом помещении.' : ''}</p>
      ${cands.length ? `<div class="row"><select id="mgSrc">${cands.map(x => `<option value="${x.id}">${esc(x.name)} — ур. ${x.lvl || 1}, отделов ${x.divs.length}${d.sells ? `, ${P.entArea(x)} м²` : ''}, взнос ${fmtShort(P.mergeFee(x))}</option>`).join('')}</select>
        <button class="btn small primary" data-act="merge">Присоединить</button></div>` : `<p class="hint">Других предприятий вида «${esc(d.name)}» у вас нет.</p>`}</div>`;
    return h + '</div>';
  }

  ep_prod(e, s) {
    const options = recipesFor(e.type, e.sub);
    return `<table class="grid"><tr><th>Подразделение</th><th>Уровень</th><th>Оборудование</th><th>Технологии</th><th>Продукция</th><th class="r">Качество</th><th>Сырьё</th><th>Эффективность</th><th class="r">Себест.</th><th>Работает</th></tr>
      ${e.divs.map(x => {
        const r = RECIPES[x.recipe], info = P.divInfo(s, e, x), st = e.stock[x.recipe];
        const eff = info?.maxOut ? Math.min(1, (e.last.produced[x.recipe] || 0) / Math.max(1, info.maxOut)) : 0;
        return `<tr><td><span class="nm">${eTile(e, 'sm')}${esc(P.divName(e, x))}</span></td><td><span class="star sm">${x.level}</span></td>
          <td title="Качество оборудования ${x.eq || 3}, требует квалификацию ${P.reqQual(x)}">${ic('gear')} ${x.eqN || 0} <span class="hint">кач. ${(x.eq || 3).toFixed(1)}</span> &nbsp; ${ic('hardhat')} ${x.workers}</td><td><span class="tech">${x.recipe ? s.tech[x.recipe] : '—'}</span></td>
          <td><select data-act="divrecipe" data-d="${x.id}">${options.map(g => `<option value="${g}" ${g === x.recipe ? 'selected' : ''}>${GOODS[g].icon} ${GOODS[g].name}</option>`).join('')}</select>
            <span class="hint">${qty(e.last.produced[x.recipe] || 0)} / ${qty(info?.maxOut || 0)} ${unitOf(x.recipe)}</span></td>
          <td class="r">${st ? st.q.toFixed(2) : '—'}</td>
          <td class="prods sm">${r ? Object.entries(r.inputs).map(([g, k]) => `<span title="${GOODS[g].name}: нужно ${k} на 1 шт., на складе ${num(P.stockQty(e, g))}" class="${info?.limitBy === g ? 'neg' : ''}">${GOODS[g].icon}<small>${num(P.stockQty(e, g))}</small></span>`).join('') || '—' : '—'}</td>
          <td><span class="effbar"><i style="width:${Math.round(eff * 100)}%"></i></span></td><td class="r">${st ? fmt(st.c) : '—'}</td>
          <td><label class="switch"><input type="checkbox" data-act="divon" data-d="${x.id}" ${x.on ? 'checked' : ''}><i></i></label></td></tr>`;
      }).join('')}</table>
      <p class="hint">Подразделений: ${e.divs.length}, свободных уровней: ${P.freeLevels(e)}. Новые подразделения — на вкладке «Подразделения». Технологии повышает лаборатория.</p>`;
  }

  // Снабжение: для каждого товара — поставщик (склады города, конкуренты, свои предприятия) и объём в день
  ep_supply(e, s) {
    const d = entDef(e), need = P.inputNeeds(s, e), fl = P.entFlow(e);
    const shopNeed = d.sells ? Object.fromEntries(Object.entries(fl).map(([g, x]) => [g, (x.sold || 0) / 7])) : {};
    const goods = [...new Set([...Object.keys(need), ...Object.keys(e.supply), ...Object.keys(shopNeed)])].filter(g => GOODS[g]);
    let total = 0;
    const rows = goods.map(g => {
      const sp = e.supply[g], st = e.stock[g], list = P.offers(s, g, e);
      const cur = sp ? list.find(o => String(o.src) === String(sp.src)) : null;
      const sum = sp && cur ? sp.qty * cur.price : 0;
      total += sum;
      const sel = `<select data-act="supsrc" data-good="${g}">${sp ? '' : '<option value="">— выберите поставщика —</option>'}${list.map(o => `<option value="${o.src}" ${sp && String(sp.src) === String(o.src) ? 'selected' : ''}>${esc(o.name)}${o.own ? ' (своё)' : ''} — ${fmt(o.price)}, кач. ${o.q ? o.q.toFixed(1) : '—'}, есть ${qty(o.avail)}</option>`).join('')}${!list.length ? '<option value="">нигде не продаётся — производите сами</option>' : ''}</select>`;
      return `<tr><td>${gn(g)}</td><td class="r">${qu(need[g] || shopNeed[g] || 0, g)}</td><td class="r">${qu(st?.qty || 0, g)}${st ? ` <span class="hint">кач. ${st.q.toFixed(1)}</span>` : ''}</td>
        <td>${sel}</td><td><input type="number" min="0" value="${Math.round(sp?.qty || 0)}" data-act="supqty" data-good="${g}" ${!sp || (e.autoSupply?.on && need[g]) ? 'disabled' : ''} style="width:100px"></td>
        <td class="r">${cur ? fmt(cur.price) : '—'}</td><td class="r">${sum ? fmt(sum) : '—'}</td>
        <td>${sp ? `<button class="btn small" data-act="supdel" data-good="${g}" title="Не закупать">${ic('x')}</button>` : ''}</td></tr>`;
    }).join('');
    // что ещё можно завозить: сырьё для любых продуктов предприятия, товары магазина, товары складской группы
    const inputs = new Set(recipesFor(e.type, e.sub).flatMap(r => Object.keys(RECIPES[r].inputs)));
    const can = Object.keys(GOODS).filter(g => !goods.includes(g) && accepts(e, g) && (d.goods ? d.goods.includes(g) : e.type === 'warehouse' || e.type === 'construction' || inputs.has(g)) && (P.inDepot(g) || P.offers(s, g, e).length));
    return `<table class="grid"><tr><th>Продукт</th><th class="r">Нужно в день</th><th class="r">На складе</th><th>Поставщик</th><th>Заказ в день</th><th class="r">Цена</th><th class="r">Сумма в день</th><th></th></tr>
      ${rows || '<tr><td colspan="8" class="hint">Сырьё не требуется. Добавьте закупку ниже.</td></tr>'}
      <tr><td colspan="6" class="r"><b>Итого закупок в день:</b></td><td class="r"><b>${fmt(total)}</b></td><td></td></tr></table>
      ${can.length ? `<div class="row"><select id="supGood">${can.map(g => `<option value="${g}">${goodName(g)} — ${fmt(P.buyPrice(s, g))} за ${unitOf(g)}</option>`).join('')}</select>
        <button class="btn small primary" data-act="supadd">${ic('plus')} Добавить товар</button></div>` : ''}
      ${Object.keys(need).length ? (P.canAutoSupply(s, e) ? `<label class="row"><input type="checkbox" data-act="autosupply" ${e.autoSupply?.on ? 'checked' : ''}> Авторегулирование снабжения — запас на
        <input type="range" min="1" max="5" value="${e.autoSupply?.weeks || 1}" data-act="autodays" style="max-width:140px"> <b>${e.autoSupply?.weeks || 1} нед.</b></label>`
        : `<p class="hint">${ic('lock')} Авторегулирование снабжения — с ${FEATURES.autoSupply}-го уровня компании для предприятий ${AUTO_SUPPLY_ENT_LEVEL}-го уровня и выше.</p>`) : ''}
      <p class="hint">Поставщики: склады города (качество ${2.5}, запас ограничен), компании-конкуренты (у каждой своя цена и качество — лучше качество, дороже) и ваши предприятия
        (по себестоимости + доставка ${Math.round(TRANSPORT_RATE * 100)}% цены). Качество сырья влияет на качество продукции.</p>`;
  }

  ep_sales(e, s) {
    const d = entDef(e), fl = P.entFlow(e), sellers = d.sells ? sellsList(e.type, e.sub) : [];
    const goods = [...new Set([...e.divs.map(x => x.recipe).filter(Boolean), ...Object.keys(e.stock), ...(d.goods ? sellers : sellers.filter(g => fl[g]))])].filter(g => GOODS[g]);
    const consumers = P.consumersOf(s, e);
    const totRev = goods.reduce((a, g) => a + (fl[g]?.rev || 0), 0);
    let h = `<table class="grid"><tr><th>Товар</th><th class="r">Продано (7 дн.)</th><th class="r">Выручка</th><th class="r">Произведено</th><th class="r">Отгружено своим</th>
        <th class="r">На складе</th><th class="r">Кач-во</th><th class="r">Себест.</th><th>${d.sells ? 'Цена в рознице' : 'Продажа на склады города'}</th></tr>
      ${goods.map(g => {
        const st = e.stock[g], f = fl[g] || {};
        const locked = d.goods && sellers.includes(g) && !P.availableGoods(e).includes(g);
        const ref = P.retailRef(s, g), price = P.shopPrice(s, e, g);
        const priceCell = locked ? `<span class="hint">${ic('lock')} с ${P.goodUnlockLevel(e, g)}-го уровня отдела</span>` : d.sells && sellers.includes(g)
          ? `<input type="number" min="1" value="${price}" data-act="price" data-good="${g}" style="width:100px"> <span class="hint">в городе ${fmt(ref)}</span>
            ${price > ref * P.PRICE_CAP ? `<span class="neg" title="Слишком дорого — не покупают">${ic('stop')}</span>` : ''}`
          : P.inDepot(g) ? `${fmt(P.sellPrice(s, g, st?.q))} <label><input type="checkbox" data-act="autosell" data-good="${g}" ${e.autoSell[g] ? 'checked' : ''}> авто</label>
            ${st ? `<button class="btn small" data-act="sell" data-good="${g}">Продать</button>` : ''}` : '—';
        return `<tr><td>${gn(g)}</td><td class="r">${qty(f.sold || 0)}</td><td class="r">${fmt(f.rev || 0)}</td><td class="r">${qty(f.made || 0)}</td><td class="r">${qty(f.shipped || 0)}</td>
          <td class="r">${qu(st?.qty || 0, g)}</td><td class="r">${st ? st.q.toFixed(2) : '—'}</td><td class="r">${st ? fmt(st.c) : '—'}</td><td>${priceCell}</td></tr>`;
      }).join('') || '<tr><td colspan="9" class="hint">Пока нечего продавать.</td></tr>'}
      <tr><td><b>Итого (7 дн.):</b></td><td></td><td class="r"><b>${fmt(totRev)}</b></td><td colspan="6"></td></tr></table>`;
    if (d.sells) h = `<div class="box"><h4>Реклама и известность</h4>
        <div class="row"><label>Известность</label><span class="effbar wide"><i style="width:${Math.round((e.aware ?? 0.2) * 100)}%"></i></span> <b>${pct(e.aware ?? 0.2)}</b>
          <span class="hint">радиус охвата ${P.shopRadius(e).toFixed(1)} кл.</span></div>
        ${e.area ? `<div class="kv"><span>Покупателей в охвате</span><span>${num(e.area.pop * POP_SCALE * (d.reach || 1))}</span><span>Конкурентов того же профиля</span><span>${e.area.comp}</span></div>` : ''}
        <div class="row"><label>Бюджет</label>${P.AD_LEVELS.map(v => `<button class="chip ${(e.ad || 0) === v ? 'on' : ''}" data-act="adset" data-v="${v}">${v ? v + '% · ' + fmtShort(P.adCost(e, v)) + '/день' : 'без рекламы'}</button>`).join('')}</div>
        <p class="hint">Реклама поднимает известность до выбранного уровня, без рекламы известность понемногу падает.</p></div>
      <div class="actions"><button class="btn" data-act="recprice">${ic('bulb')} Рекомендованные цены</button><span class="hint">с учётом качества; дороже ${P.PRICE_CAP}× средней розничной цены по городу товар не покупают</span></div>` + h
      + `<p class="hint">Покупателей больше в центре и когда в городе больше жителей. Дешевле рынка и качественнее конкурентов (качество ${NPC_QUALITY}) — больше продаж.
      ${d.goods ? `Пропускная способность продавцов: ${fmt(P.workersOf(e) * SHOP_TURNOVER_PER_WORKER * P.salaryEff(s, e))} выручки в день.` : 'Услуги не хранятся, блюда портятся за ночь наполовину.'}</p>`;
    h += `<h3>Получатели — ваши предприятия</h3>${consumers.length ? `<table class="grid"><tr><th>Кому</th><th>Товар</th><th class="r">В день</th><th></th></tr>
      ${consumers.map(c => `<tr><td><a href="#" data-act="openent" data-id="${c.to.id}">${entHtml(c.to)}</a></td><td>${gn(c.g)}</td><td class="r">${qu(c.qty, c.g)}</td>
        <td><button class="btn small" data-act="consdel" data-to="${c.to.id}" data-good="${c.g}" title="Перестать отгружать">${ic('x')}</button></td></tr>`).join('')}</table>` : '<p class="hint">Пока никому. Своё предприятие можно выбрать поставщиком в снабжении получателя или здесь.</p>'}`;
    const sendable = goods.filter(g => GOODS[g].kind !== 'service');
    const others = Object.values(s.enterprises).filter(x => x.id !== e.id && sendable.some(g => accepts(x, g)));
    if (others.length && sendable.length) {
      h += `<div class="row"><select id="cGood">${sendable.map(g => `<option value="${g}">${goodName(g)}</option>`).join('')}</select> →
        <select id="cTo">${others.map(x => `<option value="${x.id}">${entName(x)}</option>`).join('')}</select>
        <input type="number" id="cQty" min="1" value="${Math.max(1, Math.round(RECIPES[sendable[0]]?.rate || 100))}"> в день <button class="btn small primary" data-act="cadd">Отгружать</button></div>
        <p class="hint">Отгрузка каждое утро по себестоимости, доставка — ${Math.round(TRANSPORT_RATE * 100)}% оптовой цены груза.</p>`;
    }
    return h;
  }

  ep_divs(e, s) {
    const d = entDef(e), sp = P.specOf(s, e);
    return `<div class="row"><label>Зарплата персонала</label><input type="number" min="1" value="${e.salary}" data-act="salary"> ₽/день на человека
        <span class="hint">средняя в городе ${s.marketSalary} ₽ · эффективность ${pct(P.salaryEff(s, e))}</span></div>
      ${e.divs.map((x, n) => {
        const max = P.divMax(e, x);
        return `<div class="divcard"><div class="dleft"><b>${esc(P.divName(e, x))}</b><div class="dtile">${eTile(e, 'xl')}</div>
            ${d.sells ? `<div class="hint">Площадь ${P.divArea(e, x)} м²${x.level < P.SHOP_DIV_MAX ? ` → ${P.divArea(e, x, x.level + 1)} м²` : ''}</div>` : ''}
            <div>Уровень ${x.level}${d.sells ? ` из ${P.SHOP_DIV_MAX}` : ''} ${x.level < P.maxDivLevel(e) ? `<button class="btn small" data-act="updiv" data-d="${x.id}" ${P.freeLevels(e) < 1 ? 'disabled' : ''} title="${P.freeLevels(e) < 1 ? 'Нужен свободный уровень предприятия' : 'Расширить: ' + fmt(P.divUpgradeCost(e, x))}">${ic('up')} ${fmtShort(P.divUpgradeCost(e, x))}</button>` : ''}
            ${e.divs.length > 1 ? `<button class="btn small danger" data-act="rmdiv" data-d="${x.id}" title="Продать подразделение">${ic('trash')}</button>` : ''}</div></div>
          <div><div class="row"><label>Сотрудники</label><input type="range" min="0" max="${max}" value="${x.target}" data-act="divtarget" data-d="${x.id}"> <b>${x.target}</b></div>
            <div class="kv"><span>Работают</span><span>${x.workers} из ${max}</span><span>Фонд оплаты</span><span>${fmt(x.workers * e.salary)}/день</span>
              <span>Квалиф. персонала</span><span class="${P.qualOf(s, x) < P.reqQual(x) ? 'neg' : ''}">${P.qualOf(s, x).toFixed(2)}${P.qualOf(s, x) < P.reqQual(x) ? ' ' + ic('alert') : ''}</span>
              <span>Треб. квалификация</span><span>${P.reqQual(x).toFixed(2)}</span></div>
            <label class="row"><input type="checkbox" data-act="trainon" data-d="${x.id}" ${x.trainOn ? 'checked' : ''}> Обучение
              <span class="effbar"><i style="width:${Math.round(((x.train || 0) / P.TRAIN_MAX) * 100)}%"></i></span> <span class="hint">+${(x.train || 0).toFixed(2)} из ${P.TRAIN_MAX}${(x.train || 0) < P.TRAIN_MAX ? ' · ' + fmt(P.trainCost(e, x)) + '/день' : ' · максимум'}</span></label>
            ${P.equipOf(e) ? this.equipHtml(e, x, s) : ''}</div>
          <div><div class="row"><label>Загрузка</label><span class="effbar wide pink"><i style="width:${Math.round((x.workers / max) * 100)}%"></i></span></div>
            <div class="row"><label>Эффективность</label><span class="effbar wide"><i style="width:${Math.round(Math.min(1, (x.workers / max) * P.salaryEff(s, e) * P.wearFactor(x)) * 100)}%"></i></span></div>
            <div class="row"><label>Износ</label><span class="effbar wide red"><i style="width:${Math.round(x.wear * 100)}%"></i></span>
              ${x.wear > 0.05 ? `<button class="btn small" data-act="repair" data-d="${x.id}" title="Бесплатно: из изношенного соберут меньше целого">${ic('wrench')} Ремонт (−${P.repairLoss(x)} шт.)</button>` : ''}</div>
            ${P.equipOf(e) ? '' : '<p class="hint">Оборудование не требуется.</p>'}
            ${!x.on && x.workers ? '<p class="warn">Подразделение остановлено: рабочие получают 25% зарплаты.</p>' : ''}</div>
          <div class="dprod">${x.recipe ? `<span class="big3 ge">${GOODS[x.recipe].icon}</span><div class="hint">${GOODS[x.recipe].name}</div>` : ''}${n === 0 ? `<div class="boss">${sp ? `${ava(sp.name)}<br>${esc(sp.name)}<br><span class="star sm">${sp.level}</span>` : '<span class="hint">без начальника</span>'}</div>` : ''}</div></div>`;
      }).join('')}
      <div class="actions"><button class="btn primary" data-act="adddiv" ${P.freeLevels(e) < 1 ? 'disabled' : ''}>${ic('plus')} Новое подразделение (${fmt(P.divCost(e))}${d.sells ? `, ${P.AREA_BY_LEVEL[1]} м²` : ''})</button>
        <span class="hint">Свободных уровней: <b>${P.freeLevels(e)}</b>${P.freeLevels(e) < 1 ? ' — копите опыт: он идёт за производство и продажи' : ''}</span></div>
      <p class="hint">Уровень подразделения увеличивает штат, выпуск и склад. Оборудование изнашивается только в работе — износ снижает выработку, ремонт его обнуляет.
      Чем выше качество оборудования, тем больше выпуск и лучше продукция, но нужна квалификация персонала: квалификация города ${(s.cityQual || 5).toFixed(2)} плюс обучение (до +${P.TRAIN_MAX}).
      Если квалификации не хватает, эффективность падает.</p>`;
  }

  // Оборудование подразделения: сколько есть, качество и покупка у поставщиков
  equipHtml(e, x, s) {
    const E = P.equipOf(e), need = P.eqNeed(e, x), miss = Math.max(0, need - (x.eqN || 0)), list = P.offers(s, E.good, e);
    return `<div class="row"><label>${E.name}</label><b class="${miss ? 'neg' : ''}">${x.eqN || 0} / ${need} шт.</b> <span class="hint">качество ${(x.eq || 3).toFixed(1)} · 1 шт. на ${E.per} раб., служит ${E.life} г.</span></div>
      <div class="row"><label>Купить у</label><select id="eqsrc${x.id}">${list.map(o => `<option value="${o.src}">${esc(o.name)}${o.own ? ' (своё)' : ''} — ${fmt(o.price)}, кач. ${o.q ? o.q.toFixed(1) : '—'}, есть ${qty(o.avail)}</option>`).join('') || '<option value="">нигде нет</option>'}</select>
        ${miss ? `<button class="btn small primary" data-act="eqfill" data-d="${x.id}">Докупить ${miss} шт.</button>` : ''}
        <button class="btn small" data-act="eqset" data-d="${x.id}" title="Заменить весь комплект оборудованием выбранного поставщика">Заменить всё (${need} шт.)</button></div>`;
  }

  ep_reports(e) {
    const h = e.hist.slice(-14), fl = P.entFlow(e, 14);
    return `<div class="twocol"><div><h3>По дням</h3><table class="grid"><tr><th>День</th><th class="r">Выручка</th><th class="r">Расходы</th><th class="r">Прибыль</th></tr>
      ${h.map((x, n) => ({ x, day: this.s.day - h.length + n })).reverse().map(({ x, day }) => `<tr><td>${shortDate(day)}</td><td class="r">${fmt(x.rev)}</td><td class="r">${fmt(x.exp)}</td>
        <td class="r ${x.rev - x.exp < 0 ? 'neg' : ''}">${fmt(x.rev - x.exp)}</td></tr>`).join('') || '<tr><td colspan="4" class="hint">Нет данных</td></tr>'}</table></div>
      <div><h3>Товары за 14 дней</h3><table class="grid"><tr><th>Товар</th><th class="r">Куплено</th><th class="r">Получено</th><th class="r">Произведено</th><th class="r">Потреблено</th><th class="r">Отгружено</th><th class="r">Продано</th></tr>
      ${Object.entries(fl).map(([g, x]) => `<tr><td>${gn(g)}</td><td class="r">${num(x.bought || 0)}</td><td class="r">${num(x.received || 0)}</td><td class="r">${num(x.made || 0)}</td>
        <td class="r">${num(x.used || 0)}</td><td class="r">${num(x.shipped || 0)}</td><td class="r">${num(x.sold || 0)}</td></tr>`).join('') || '<tr><td colspan="7" class="hint">Нет данных</td></tr>'}</table></div></div>`;
  }

  ep_lab(e, s) {
    const cur = e.research;
    let h = `<div class="box"><h4>Текущее исследование</h4>
      <select data-act="research"><option value="">— технология —</option>${Object.keys(GOODS).map(g => `<option value="${g}" ${g === cur ? 'selected' : ''}>${goodName(g)}</option>`).join('')}</select>
      <select data-act="resdir">${Object.entries(P.RES_DIRS).map(([k, n]) => `<option value="${k}" ${k === (e.resDir || 'q') ? 'selected' : ''}>${n}${cur ? ' (ур. ' + P.techLevel(s, cur, k) + ')' : ''}</option>`).join('')}</select>`;
    if (cur) {
      const need = P.researchCost(P.techLevel(s, cur, e.resDir || 'q')), speed = e.divs.reduce((a, x) => a + x.workers * x.level, 0) / 1.5 * P.salaryEff(s, e) * P.specBonus(s, e);
      h += `<div class="kv"><span>Прогресс</span><span>${num(e.progress)} / ${num(need)}</span><span>Скорость</span><span>${speed.toFixed(1)} очков/день</span>
        <span>Осталось</span><span>${speed > 0 ? Math.ceil((need - e.progress) / speed) + ' дн.' : '∞'}</span></div>
        <div class="bar"><i style="width:${(e.progress / need) * 100}%"></i></div>`;
    }
    return h + `</div><p class="hint">Направления: качество (+0,8 к качеству за уровень), объём производства (+5% выпуска), экономия материалов (−4% сырья, до −40%).</p>
      <table class="grid"><tr><th>Технология</th><th class="r">Качество</th><th class="r">Объём</th><th class="r">Экономия материалов</th></tr>
      ${Object.keys(GOODS).filter(g => P.techLevel(s, g, 'q') + P.techLevel(s, g, 'vol') + P.techLevel(s, g, 'mat') > 0).map(g => `<tr><td>${gn(g)}</td><td class="r">${P.techLevel(s, g, 'q')}</td><td class="r">${P.techLevel(s, g, 'vol')}</td><td class="r">${P.techLevel(s, g, 'mat')}</td></tr>`).join('') || '<tr><td colspan="4" class="hint">Пока ничего не изучено</td></tr>'}</table>`;
  }

  ep_sites(e, s) {
    const list = Object.values(s.buildings).filter(b => b.builder === e.id);
    const crew = (P.workersOf(e) / Math.max(1, P.maxWorkers(e))) * P.salaryEff(s, e) * (1 + 0.5 * (P.levelOf(e) - 1)) * P.specBonus(s, e);
    return `<div class="kv" style="max-width:480px"><span>Скорость бригады</span><span>${crew.toFixed(2)} дня стройки за день</span></div>` + (list.length
      ? `<table class="grid"><tr><th>Объект</th><th class="r">Готовность</th><th>Статус</th></tr>${list.map(b => `<tr><td><a href="#" data-act="goplot" data-i="${b.i}" data-j="${b.j}" class="nm">${bHtml(b)}</a></td>
        <td class="r">${b.state === 'done' ? 'достроен' : pct(b.progress / b.buildDays)}</td><td>${b.state === 'build' ? (b.paused ? '<span class="neg">стоит</span>' : 'идёт') : ic('check', 'pos')}</td></tr>`).join('')}</table>`
      : '<p class="hint">Строек нет. Выберите свободный участок в городе и в пункте «Кто строит» отметьте «Своими силами».</p>')
      + '<p class="hint">Закупайте стройматериалы на вкладке «Снабжение» или везите со своих заводов. Несколько строек делят бригаду.</p>';
  }

  drawEntChart() {
    const c = $('#echart'), e = this.s.enterprises[this.entId];
    if (!c || !e) return;
    const { x, W, H } = canvas2d(c), h = e.hist.slice(-40);
    x.fillStyle = '#f8f9fb'; x.fillRect(0, 0, W, H);
    if (h.length < 2) { x.fillStyle = '#6b7280'; x.fillText('График появится через пару дней', 10, 20); return; }
    const hi = Math.max(1, ...h.map(d => Math.max(d.rev, d.exp))), X = n => 4 + (n / (h.length - 1)) * (W - 8), Y = v => H - 16 - (v / hi) * (H - 26);
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#6d6ee8'); gr.addColorStop(1, '#b9bdf3');
    x.fillStyle = gr; x.beginPath(); x.moveTo(X(0), Y(0)); h.forEach((d, n) => x.lineTo(X(n), Y(d.rev))); x.lineTo(X(h.length - 1), Y(0)); x.fill();
    x.strokeStyle = '#4ade80'; x.lineWidth = 2; x.beginPath(); h.forEach((d, n) => (n ? x.lineTo(X(n), Y(d.exp)) : x.moveTo(X(n), Y(d.exp)))); x.stroke();
    x.fillStyle = '#ef4444'; h.forEach((d, n) => { const p = d.rev - d.exp; if (p < 0) x.fillRect(X(n) - 1.5, Y(0), 3, Math.min(14, (-p / hi) * 40)); });
  }

  // ---------- создание предприятия ----------
  page_create(s) {
    const cr = this.cr ||= { step: 1 };
    const L = G.companyLevel(s);
    const lock = d => (d.later ? '<div class="later">Эта сфера бизнеса в игре будет открыта позднее</div>'
      : d.minLevel && L < d.minLevel ? `<div class="req">Для постройки предприятия требуется ${d.minLevel}-й уровень компании (у вас ${L})</div>` : '');
    const locked = d => d.later || (d.minLevel && L < d.minLevel);
    const icons = list => `<div class="ccicons">${list.map(g => `<span class="ge" title="${GOODS[g].name}">${GOODS[g].icon}</span>`).join('')}</div>`;
    const typeGoods = t => { const T = ENTERPRISES[t]; return [...new Set(T.subs ? Object.keys(T.subs).flatMap(sb => sellsList(t, sb).length ? sellsList(t, sb) : recipesFor(t, sb)) : (sellsList(t).length ? sellsList(t) : recipesFor(t)))]; };
    let h = `<div class="page-title"><span class="pt-ic">${ic('plus')}</span><h1>Создание предприятия</h1>
      <div class="acts"><span class="hint">Уровень компании: <span class="star sm">${L}</span> · предприятий ${Object.keys(s.enterprises).length} / ${hqLimit(s, 'manage')}</span></div></div>`;
    if (cr.step === 1) {
      h += `<div class="req2">Выберите тип предприятия</div><div class="ccards">`;
      for (const t in ENTERPRISES) {
        const T = ENTERPRISES[t];
        const minCost = T.subs ? Math.min(...Object.values(T.subs).map(x => x.cost || T.cost)) : T.cost;
        h += `<button class="ccard ${locked(T) ? 'locked' : ''}" data-act="crtype" data-k="${t}" ${T.later ? 'disabled' : ''}><span class="cicon">${this.thumb('ent', t)}</span>
          <div><b>${T.name}</b><small>${T.desc}</small><i>Инвестиции: от ${fmtShort(minCost)}</i>${lock(T)}${icons(typeGoods(t).slice(0, 26))}</div></button>`;
      }
      return h + '</div>';
    }
    const T = ENTERPRISES[cr.type];
    if (cr.step === 2) {
      h += `<div class="req2">${T.subsTitle || 'Выберите тип предприятия'}: ${T.name}</div><div class="ccards">`;
      for (const sb in T.subs) {
        const D = defOf(cr.type, sb);
        const list = sellsList(cr.type, sb).length ? sellsList(cr.type, sb) : D.groups !== undefined ? Object.keys(GOODS).filter(g => P.inDepot(g) && (!D.groups || D.groups.includes(GOODS[g].group))) : recipesFor(cr.type, sb);
        h += `<button class="ccard ${locked(D) ? 'locked' : ''}" data-act="crsub" data-k="${sb}"><span class="cicon">${this.thumb('ent', cr.type, sb)}${entTile(cr.type, sb, 'sm')}</span>
          <div><b>${D.name}</b><small>${D.desc}</small><i>Инвестиции: от ${fmtShort(D.cost)}</i>${lock(D)}${icons(list.slice(0, 40))}</div></button>`;
      }
      return h + `</div><div class="actions"><button class="btn" data-act="crback">${ic('left')} Назад</button></div>`;
    }
    // шаг 3: подтверждение
    const D = defOf(cr.type, cr.sub);
    const options = recipesFor(cr.type, cr.sub);
    const hosts = D.sells ? P.shopHosts(s) : [];
    const err = locked(D) ? 'Недостаточный уровень компании' : s.money < D.cost ? `Не хватает денег: нужно ${fmt(D.cost)}` : D.sells && !hosts.length ? 'Нет свободных коммерческих помещений' : null;
    h += `<div class="ccard wide static"><span class="cicon">${this.thumb('ent', cr.type, cr.sub)}${cr.sub ? entTile(cr.type, cr.sub, 'sm') : ''}</span><div><b>${D.name}</b><small>${D.desc}</small>
        <div class="kv" style="max-width:520px"><span>Инвестиции</span><span>${fmt(D.cost)}</span><span>Рабочих в подразделении</span><span>${D.workers}</span>
        <span>Склад</span><span>${num(D.storage || 0)} ед.</span><span>Содержание</span><span>${fmt(D.upkeep)}/день</span></div>
        <div class="row"><label>Название</label><input type="text" id="crName" maxlength="40" value="${esc(D.name)}" style="flex:1;max-width:320px"></div>
        ${options.length && !D.goods ? `<div class="row"><label>Первый продукт</label><select id="crRecipe">${options.map(g => `<option value="${g}">${goodName(g)}${RECIPES[g].inputs && Object.keys(RECIPES[g].inputs).length ? ' ← ' + Object.keys(RECIPES[g].inputs).map(x => GOODS[x].icon).join('') : ''}</option>`).join('')}</select></div>` : ''}
        ${D.sells ? (hosts.length ? `<div class="row"><label>Помещение</label><select id="crHost">${hosts.map(b => { const a = P.catchment(s, b, 3, cr.type === 'shop' ? 'shop:' + cr.sub : cr.type); return `<option value="${b.id}" ${b.id === cr.hostId ? 'selected' : ''}>${BUILDINGS[b.type].name} №${b.id} (${b.i}:${b.j}) — свободно ${num(P.freeArea(s, b))} м², жителей ~${a.pop}, конкурентов ${a.comp}, ${b.owner === 'player' ? 'ваш, без аренды' : 'аренда ' + b.units.comm.rent + ' ₽/м²'}</option>`; }).join('')}</select></div>
            <p class="hint">Отдел 1-го уровня займёт ${P.AREA_BY_LEVEL[1]} м². Чем выше уровень отдела, тем больше площади: до ${P.AREA_BY_LEVEL[7]} м² на 7-м уровне — выбирайте помещение с запасом.</p>`
          : '<p class="warn">Нужна свободная коммерческая площадь: первые этажи жилых домов, ЖК с галереей, торговые центры. Постройте или дождитесь конкурентов.</p>') : ''}
        ${err ? `<p class="warn">${err}</p>` : ''}
        <div class="actions"><button class="btn" data-act="crback">${ic('left')} Назад</button><button class="btn primary" data-act="crcreate" ${err ? 'disabled' : ''}>Создать предприятие</button></div></div></div>`;
    return h;
  }

  // ---------- действия ----------
  curEnt() { return this.page === 'ent' ? this.s.enterprises[this.entId] : null; }
  curB() { return this.sel?.kind === 'plot' ? G.buildingAt(this.s, this.sel.i, this.sel.j) : null; }

  onClick(ev) {
    const t = ev.target.closest('[data-act]');
    if (!t || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'radio')) return;
    const act = t.dataset.act, s = this.s, e = this.curEnt(), b = this.curB();
    const run = fn => { const r = this.app.act(fn); if (r?.error) this.toast(r.error, true); return r; };
    switch (act) {
      case 'close': this.app.select(null); break;
      case 'tab': this.tab = t.dataset.tab; this.renderSide(true); break;
      case 'ftype': this.form.type = t.dataset.v; this.renderSide(true); break;
      case 'ffloors': this.form.floors = +t.dataset.v; this.renderSide(true); break;
      case 'order': {
        const f = this.form, r = run(() => G.order(s, f.type, f.floors, f.contractor, this.sel.i, this.sel.j));
        if (r?.building) { this.toast('🏗️ Стройка началась!'); this.app.world.floatText(this.sel.i, this.sel.j, 'Стройка началась', 'info'); }
        this.renderSide(true); break;
      }
      case 'cancel': if (confirm('Отменить стройку? Деньги за выполненные работы не вернутся.')) { run(() => G.cancelBuild(s, b.id)); this.renderSide(true); } break;
      case 'sellb': if (confirm('Продать здание?')) { run(() => G.sell(s, b.id)); this.renderSide(true); } break;
      case 'openshop': {
        const host = b || G.buildingAt(s, this.sel.i, this.sel.j);
        this.cr = { step: 1, hostId: host.id };
        this.app.select(null);
        this.openPage('create');
        break;
      }
      case 'newent': this.cr = { step: 1 }; this.openPage('create'); break;
      case 'crtype': {
        const T = ENTERPRISES[t.dataset.k];
        this.cr = { ...this.cr, type: t.dataset.k, sub: null, step: T.subs ? 2 : 3 };
        this.renderPage(); $('#page').scrollTop = 0; break;
      }
      case 'crsub': this.cr = { ...this.cr, sub: t.dataset.k, step: 3 }; this.renderPage(); $('#page').scrollTop = 0; break;
      case 'crback': this.cr.step = this.cr.step === 3 && ENTERPRISES[this.cr.type].subs ? 2 : 1; this.renderPage(); break;
      case 'crcreate': {
        const r = run(() => P.createEnterprise(s, this.cr.type, this.cr.sub, { level: G.companyLevel(s), name: $('#crName')?.value, recipe: $('#crRecipe')?.value, hostId: +$('#crHost')?.value }));
        if (r?.enterprise) { this.toast(`${entDef(r.enterprise).icon} «${r.enterprise.name}» создано`); this.cr = { step: 1 }; this.app.selectEnt(r.enterprise.id); }
        break;
      }
      case 'entnav': {
        const ids = Object.keys(s.enterprises).map(Number);
        if (ids.length) { const n = (ids.indexOf(this.entId) + +t.dataset.dir + ids.length) % ids.length; this.selectEnt(ids[n]); }
        break;
      }
      case 'enttab': case 'enttab-go': this.entTab = t.dataset.k; this.renderPage(); break;
      case 'cotabgo': ev.preventDefault(); this.openPage('company', t.dataset.k); break;
      case 'adddiv': {
        const r = run(() => P.addDivision(s, e));
        if (r?.div) this.toast('➕ Новое подразделение');
        this.renderPage(); break;
      }
      case 'updiv': run(() => P.upgradeDiv(s, e, e.divs.find(x => x.id === +t.dataset.d))); this.renderPage(); break;
      case 'rmdiv': if (confirm('Продать подразделение? Вернётся 30% стоимости оборудования.')) { run(() => P.removeDiv(s, e, e.divs.find(x => x.id === +t.dataset.d))); this.renderPage(); } break;
      case 'eqfill': case 'eqset': {
        const d = e.divs.find(x => x.id === +t.dataset.d), src = $('#eqsrc' + d.id)?.value;
        if (act === 'eqset' && !confirm('Заменить всё оборудование подразделения? Старое списывается.')) break;
        const r = run(() => P.buyEquipment(s, e, d, src, act === 'eqset' ? 'replace' : 'fill'));
        if (r?.ok) this.toast(`Куплено: ${P.equipOf(e).name} ×${r.n}`);
        this.renderPage(); break;
      }
      case 'adset': this.app.act(() => { e.ad = +t.dataset.v; }); this.renderPage(); break;
      case 'relocate': {
        const b = s.buildings[+$('#mvHost').value];
        if (b && confirm(`Переехать в ${BUILDINGS[b.type].name} №${b.id} за ${fmt(P.relocateFee(e))}?`)) {
          const r = run(() => P.relocate(s, e, b.id));
          if (r?.ok) this.toast(`«${e.name}» переехал`);
        }
        this.renderPage(); break;
      }
      case 'merge': {
        const src = s.enterprises[+$('#mgSrc').value];
        if (src && confirm(`Присоединить «${src.name}» к «${e.name}»? «${src.name}» перестанет существовать как отдельное предприятие.`)) {
          const r = run(() => P.mergeEnterprises(s, e, src));
          if (r?.ok) this.toast(`«${src.name}» присоединён к «${e.name}»`);
        }
        this.renderPage(); break;
      }
      case 'recprice':
        this.app.act(() => { for (const g of sellsList(e.type, e.sub)) if (e.stock[g] || e.prices[g] != null) e.prices[g] = P.recommendedPrice(s, g, e.stock[g]?.q); });
        this.toast('💡 Цены выставлены с учётом качества'); this.renderPage(); break;
      case 'repair': run(() => P.repairDiv(s, e, e.divs.find(x => x.id === +t.dataset.d))); this.renderPage(); break;
      case 'openent': ev.preventDefault(); this.closeWin(); this.app.selectEnt(+t.dataset.id); break;
      case 'goplot': ev.preventDefault(); this.closeWin(); this.app.select(+t.dataset.i, +t.dataset.j, true); break;
      case 'eclose':
        if (confirm('Продать предприятие государству за половину стоимости активов?')) {
          const v = this.app.act(() => P.closeEnterprise(s, e.id));
          this.toast(`Предприятие закрыто, получено ${fmt(v)}`);
          this.openPage('company', 'ent');
        }
        break;
      case 'sell': {
        const sum = this.app.act(() => P.sellToMarket(s, e, t.dataset.good, Infinity));
        if (sum) this.toast(`Продано на ${fmt(sum)}`);
        this.renderPage(); break;
      }
      case 'supadd': {
        const g = $('#supGood')?.value;
        if (g) run(() => P.setSupply(s, e, g, null, Math.ceil(P.inputNeeds(s, e)[g] || 0)));
        this.renderPage(); break;
      }
      case 'supdel': this.app.act(() => P.removeSupply(s, e, t.dataset.good)); this.renderPage(); break;
      case 'cadd': {
        const to = s.enterprises[+$('#cTo').value];
        const r = run(() => P.setSupply(s, to, $('#cGood').value, e.id, +$('#cQty').value));
        if (r?.ok) this.toast(`Отгрузка в «${to.name}» настроена`);
        this.renderPage(); break;
      }
      case 'consdel': this.app.act(() => P.removeSupply(s, s.enterprises[+t.dataset.to], t.dataset.good)); this.renderPage(); break;
      case 'wtab': this.winTab = t.dataset.tab; this.renderPage(); break;
      case 'extab': this.exTab = t.dataset.k; this.renderPage(); break;
      case 'exbuy': {
        const r = run(() => P.buyListing(s, +t.dataset.id));
        if (r?.enterprise) { this.toast(`«${r.enterprise.name}» теперь ваше`); this.app.selectEnt(r.enterprise.id); } else this.renderPage();
        break;
      }
      case 'exsell': {
        const x = s.enterprises[+t.dataset.id];
        if (confirm(`Продать «${x.name}» за ${fmt(+t.dataset.p)}?`)) { run(() => P.sellEnterprise(s, x.id, +t.dataset.r, +t.dataset.p)); this.toast(`Продано за ${fmt(+t.dataset.p)}`); }
        this.renderPage(); break;
      }
      case 'exlist': run(() => P.listEnterprise(s, +t.dataset.id, +$('#exp' + t.dataset.id).value)); this.renderPage(); break;
      case 'exunlist': run(() => P.listEnterprise(s, +t.dataset.id, 0)); this.renderPage(); break;
      case 'cotab': this.coTab = t.dataset.tab; this.renderPage(); this.markNav(); break;
      case 'tocity': ev.preventDefault(); this.showCity(); break;
      case 'gopage': ev.preventDefault(); if (t.dataset.ex) this.exTab = t.dataset.ex; if (t.dataset.k === 'market' && t.dataset.tab) this.winTab = t.dataset.tab; this.openPage(t.dataset.k, t.dataset.tab); break;
      case 'entfilter': this.entFilter = t.dataset.k || null; this.renderPage(); break;
      case 'finsub': ev.preventDefault(); this.finSub = t.dataset.k; this.txPage = 0; this.renderPage(); break;
      case 'txpage': this.txPage = +t.dataset.p; this.renderPage(); break;
      case 'rep': this.rep = t.dataset.k; this.txPage = 0; this.renderPage(); break;
      case 'ggroup': ev.preventDefault(); this.goodsGroup = t.dataset.k; this.renderPage(); break;
      case 'hire': { const r = run(() => P.hireSpec(s, +t.dataset.id)); if (r?.spec) this.toast(`🤝 ${r.spec.name} нанят${r.spec.job ? ' и назначен на ' + s.enterprises[r.spec.job].name : ''}`); this.renderPage(); break; }
      case 'fire': if (confirm('Уволить специалиста?')) { this.app.act(() => P.fireSpec(s, +t.dataset.id)); this.renderPage(); } break;
      case 'citytab': this.cityTab = t.dataset.k; this.renderPage(); this.markNav(); break;
      case 'hq': run(() => G.upgradeHQ(s, t.dataset.k)); this.renderPage(); break;
      case 'renamecity': {
        const n = prompt('Название города', s.cityName);
        if (n && n.trim()) { this.app.act(() => { s.cityName = n.trim().slice(0, 30); }); this.renderPage(); }
        break;
      }
      case 'loan': run(() => G.takeLoan(s, +$('#loanAmt').value)); this.openWin('bank'); break;
      case 'repay': this.app.act(() => G.repayLoan(s, +$('#loanAmt').value)); this.openWin('bank'); break;
      case 'reset': this.reset(); break;
      case 'rename': {
        const n = prompt('Название компании', s.company);
        if (n && n.trim()) { this.app.act(() => { s.company = n.trim().slice(0, 40); }); this.renderPage(); }
        break;
      }
    }
  }

  onChange(ev) {
    const t = ev.target, act = t.dataset.act, e = this.curEnt(), b = this.curB();
    if (!act) return;
    this.app.act(() => {
      switch (act) {
        case 'fcontr': this.form.contractor = t.value; break;
        case 'rent': b.units[t.dataset.t].rent = Math.max(1, Math.round(+t.value || 1)); break;
        case 'divrecipe': { const r = P.setDivRecipe(this.s, e, e.divs.find(x => x.id === +t.dataset.d), t.value); if (r.error) this.toast(r.error, true); break; }
        case 'trainon': e.divs.find(x => x.id === +t.dataset.d).trainOn = t.checked; break;
        case 'resdir': e.resDir = t.value; e.progress = 0; break;
        case 'divon': e.divs.find(x => x.id === +t.dataset.d).on = t.checked; break;
        case 'divtarget': e.divs.find(x => x.id === +t.dataset.d).target = +t.value; break;
        case 'autosupply': e.autoSupply = { ...(e.autoSupply || { days: 3 }), on: t.checked }; break;
        case 'autodays': e.autoSupply = { ...(e.autoSupply || {}), weeks: +t.value }; break;
        case 'assign': { const r = P.assignSpec(this.s, +t.dataset.id, +t.value || null); if (r.error) this.toast(r.error, true); break; }
        case 'cover': this.app.world.setCoverage(t.dataset.k, t.checked, this.s); break;
        case 'esalary': { const x = this.s.enterprises[t.dataset.id]; x.salary = Math.max(1, Math.round(+t.value || 1)); break; }
        case 'salary': e.salary = Math.max(1, Math.round(+t.value || 1)); break;
        case 'ename': if (t.value.trim()) e.name = t.value.trim().slice(0, 40); break;
        case 'autosell': e.autoSell[t.dataset.good] = t.checked; break;
        case 'supqty': if (e.supply[t.dataset.good]) e.supply[t.dataset.good].qty = Math.max(0, +t.value || 0); break;
        case 'supsrc': if (t.value !== '') {
          const g = t.dataset.good, r = P.setSupply(this.s, e, g, t.value, e.supply[g] ? undefined : Math.ceil(P.inputNeeds(this.s, e)[g] || 0));
          if (r.error) this.toast(r.error, true);
        } break;
        case 'price': e.prices[t.dataset.good] = Math.max(1, Math.round(+t.value || 1)); break;
        case 'research': e.research = t.value || null; e.progress = 0; break;
      }
    });
    if (t.type !== 'radio') t.blur();
    this.renderSide(true);
    if ($('#page').contains(t)) this.renderPage();
  }

  // ---------- страницы (как в Бизмании: шапка, иконки разделов, страница) ----------
  openWin(name) {
    if (name === 'bank') return this.openPage('company', 'finance');
    if (name === 'enterprises') return this.openPage('company', 'ent');
    this.openPage(name);
  }
  closeWin() { /* окна заменены страницами */ }

  openPage(name, tab) {
    this.page = name;
    if (name !== 'city' && this.sel) { this.sel = null; $('#side').hidden = true; this.app.world.setSelected(null); }
    if (name === 'company' && tab) this.coTab = tab;
    if (name === 'city' && tab) this.cityTab = tab;
    this.renderPage();
    $('#page').scrollTop = 0;
    this.markNav();
  }
  // Город: страница города на вкладке «Карта»
  showCity() {
    if (this.page === 'city' && this.cityTab === 'map') return;
    this.openPage('city', 'map');
  }
  // Раздел меню для текущей страницы: подстраницы подсвечивают свой раздел
  navGroup() {
    const p = this.page;
    if (p === 'company') return { main: 'company', ent: 'ent', staff: 'ent', finance: 'fin', reports: 'fin' }[this.coTab];
    return { builds: 'city', ent: 'ent', create: 'ent', exchange: 'market' }[p] || p;
  }
  markNav() {
    const g = this.navGroup();
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.toggle('on', b.dataset.nav === g));
  }
  // Подразделы внутри раздела меню — вкладки под заголовком
  subnav(items) {
    return `<div class="ftabs">${items.map(([page, tab, n, on]) => `<button data-act="gopage" data-k="${page}" ${tab ? `data-tab="${tab}"` : ''} class="${on ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  }

  renderPage() {
    // 3D-карту не пересоздаём: убираем в запас и возвращаем в рамку на вкладке «Карта»
    const view = $('#cityView');
    $('#cityHolder').appendChild(view);
    const fn = this[`page_${this.page}`] || (() => this.titled(this.page));
    $('#pageBody').innerHTML = fn.call(this, this.s);
    this.foldHints($('#pageBody'));
    const slot = $('#mapSlot');
    this.app.world.paused = !slot;
    if (slot) { slot.appendChild(view); this.app.world.resize(); }
    if (this.page === 'company' && this.coTab === 'main') this.drawChart();
    if (this.page === 'ent' && this.entTab === 'main') this.drawEntChart();
    if (this.page === 'company' && this.coTab === 'reports' && this.rep === 'charts') this.drawReportCharts();
  }
  // Длинные пояснения сворачиваются в «Подробнее», чтобы страница была чище
  foldHints(root) {
    this.moreOpen ||= new Set();
    for (const d of root.querySelectorAll('details[data-k]')) {
      d.open = this.moreOpen.has(d.dataset.k);
      d.addEventListener('toggle', () => (d.open ? this.moreOpen.add(d.dataset.k) : this.moreOpen.delete(d.dataset.k)));
    }
    for (const p of root.querySelectorAll('p.hint')) {
      if (p.textContent.trim().length < 110 || p.closest('td, details, .ccard, .contractor')) continue;
      const d = document.createElement('details'), key = p.textContent.trim().slice(0, 50);
      d.className = 'more';
      this.moreOpen ||= new Set();
      d.open = this.moreOpen.has(key);
      d.addEventListener('toggle', () => (d.open ? this.moreOpen.add(key) : this.moreOpen.delete(key)));
      d.innerHTML = `<summary>${ic('help')} Подробнее</summary>`;
      p.replaceWith(d);
      d.appendChild(p);
    }
  }
  refreshWin() {
    if (this.page === 'city' && this.cityTab === 'map') return;
    if ($('#page').contains(document.activeElement) && document.activeElement.matches('input,select')) return;
    const top = $('#page').scrollTop;
    this.renderPage();
    $('#page').scrollTop = top;
  }

  titled(name) {
    const t = { market: ['trend', 'Рынок'], exchange: ['trend', 'Рынок'], rating: ['trophy', 'Рейтинг компаний'], quests: ['tasks', 'Задания'], help: ['help', 'Как играть'] }[name];
    const sub = name === 'market' || name === 'exchange'
      ? this.subnav([['market', 'goods', 'Товары и склады', name === 'market' && this.winTab !== 'chains'], ['market', 'chains', 'Цепочки производства', name === 'market' && this.winTab === 'chains'], ['exchange', '', 'Биржа предприятий', name === 'exchange']]) : '';
    return `<div class="page-title"><span class="pt-ic">${ic(t[0])}</span><h1>${t[1]}</h1></div>${sub}${this[`win_${name}`](this.s)}`;
  }

  // ---------- страница компании ----------
  page_company(s) {
    // Разделы компании выбираются в верхнем меню — отдельных вкладок на странице нет
    const t = { main: ['briefcase', esc(s.company)], ent: ['factory', 'Предприятия'], staff: ['users', 'Специалисты'], finance: ['wallet', 'Финансы'], reports: ['report', 'Отчёты'] }[this.coTab];
    const acts = this.coTab === 'main' ? `<button class="btn icon" data-act="rename" title="Переименовать компанию">${ic('pencil')}</button>`
      : this.coTab === 'ent' ? `<button class="btn primary" data-act="newent">${ic('plus')} Создать предприятие</button>` : '';
    const sub = ['ent', 'staff'].includes(this.coTab) ? this.subnav([['company', 'ent', 'Предприятия', this.coTab === 'ent'], ['company', 'staff', 'Специалисты', this.coTab === 'staff']])
      : ['finance', 'reports'].includes(this.coTab) ? this.subnav([['company', 'finance', 'Счета и платежи', this.coTab === 'finance'], ['company', 'reports', 'Отчёты', this.coTab === 'reports']]) : '';
    return `<div class="page-title"><span class="pt-ic">${ic(t[0])}</span><h1>${t[1]}</h1>${acts ? `<div class="acts">${acts}</div>` : ''}</div>
      ${sub}${this[`co_${this.coTab}`](s)}`;
  }

  // сумма доходов/расходов за последние n дней
  period(n = 7) {
    const h = this.s.history.slice(-n);
    const sum = (side, cat) => h.reduce((a, d) => a + (cat ? d[side]?.[cat] || 0 : side === 'inc' ? d.income : d.expense), 0);
    return { days: h.length, sum };
  }

  companyLevel() { return G.companyLevel(this.s); }
  efficiency() {
    const s = this.s, ents = Object.values(s.enterprises), blds = Object.values(s.buildings).filter(b => G.isPlayer(b) && b.state === 'done' && Object.keys(b.units).length);
    const vals = [...ents.map(e => Math.min(1, (P.workersOf(e) / Math.max(1, P.targetOf(e) || 1)) * P.salaryEff(s, e))), ...blds.map(G.occRate)];
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 1;
  }

  co_main(s) {
    const p = this.period(7), rev = p.sum('inc'), exp = p.sum('exp'), profit = rev - exp;
    const assets = G.netWorth(s) + s.loan;
    const blds = Object.values(s.buildings).filter(G.isPlayer), ents = Object.values(s.enterprises);
    const place = G.rating(s).findIndex(r => r.player) + 1;
    const eff = this.efficiency();
    const tiles = [
      ...blds.map(b => `<button class="tile" data-act="goplot" data-i="${b.i}" data-j="${b.j}" title="${bTitle(b)}${b.state === 'build' ? ' — стройка ' + pct(b.progress / b.buildDays) : ''}">
        ${bTile(b.state === 'build' ? 'site' : b.type, 'lg')}<span class="n">${b.floors}</span>${b.state === 'build' && b.paused ? `<span class="w">${ic('stop')}</span>` : ''}</button>`),
      ...ents.map(e => `<button class="tile" data-act="openent" data-id="${e.id}" title="${esc(e.name)}">${eTile(e, 'lg')}
        <span class="n">${e.lvl || 1}${P.freeLevels(e) ? '+' + P.freeLevels(e) : ''}</span>${this.entProblem(e) ? `<span class="w">${ic('alert')}</span>` : ''}</button>`),
    ].join('');
    const hq = Object.keys(HQ).map(k => {
      const l = s.hq[k] || 1, used = { staff: P.staffTotal(s), manage: ents.length, prod: P.products(s).size, build: blds.filter(b => b.state === 'build').length, finance: s.money, mining: P.minedTypes(s).size }[k];
      const lim = hqLimit(s, k), full = used >= lim;
      return `<div class="dept"><span class="star sm">${l}</span><div><div class="nm">${HQ[k].name}</div><div class="lim ${full ? 'neg' : ''}">${HQ[k].label}: ${HQ[k].money ? fmtShort(used) + ' / ' + fmtShort(lim) : num(used) + ' / ' + num(lim)}</div>
        <span class="effbar ${full ? 'red' : ''}"><i style="width:${Math.round(Math.min(1, used / lim) * 100)}%"></i></span></div>
        ${l < HQ_MAX ? `<button class="btn small" data-act="hq" data-k="${k}" ${s.money < hqUpgradeCost(l) ? 'disabled' : ''} title="Повысить уровень">${ic('up')} ${fmtShort(hqUpgradeCost(l))}</button>` : ''}</div>`;
    }).join('');
    const xpNeed = companyXpNeed(s.compLvl || 1);
    return `${this.kpis([
        ['Деньги', fmtShort(s.money)],
        ['Выручка за неделю', fmtShort(rev)],
        ['Прибыль за неделю', fmtShort(profit), profit >= 0 ? 'pos' : 'neg'],
        ['Активы', fmtShort(assets)],
        ['Эффективность', pct(eff), '', eff],
        ['Место в рейтинге', `${place} из ${s.rivals.length + 1}`],
      ])}
      <div class="split">
        <div>
          <h3>Здания и предприятия <a href="#" class="hint" data-act="tocity">${ic('city')} ${esc(s.cityName)}</a></h3>
          <div class="icons">${tiles || '<span class="hint">Пока пусто. Откройте город и закажите стройку на свободном участке или создайте предприятие в разделе «Предприятия».</span>'}</div>
          <h3>Капитал за 60 дней</h3><div class="chart-box"><canvas class="chart" id="chart"></canvas></div>
        </div>
        <div>
          <div class="lvlcard"><span class="star">${this.companyLevel()}</span><div><b>Уровень компании</b>
            <div class="xpwrap" title="Опыт: ${num(s.compXp || 0)} из ${num(xpNeed)}"><span class="effbar wide"><i style="width:${Math.round(((s.compXp || 0) / xpNeed) * 100)}%"></i></span> ${pct((s.compXp || 0) / xpNeed)}</div>
            ${nextUnlocks(s)}</div></div>
          <div class="hq"><h3>Штаб-квартира</h3>${hq}</div>
        </div>
      </div>`;
  }

  // ---------- вкладка «Предприятия» (как в Бизмании) ----------
  // Все объекты компании одним списком: здания в городе + виртуальные предприятия
  companyUnits() {
    const s = this.s, rows = [];
    for (const b of Object.values(s.buildings).filter(G.isPlayer)) {
      const w = weekOf(b.hist);
      rows.push({ key: 'b:' + b.type, icon: bTile(b.state === 'build' ? 'site' : b.type, 'sm'), kind: BUILDINGS[b.type].name, name: bTitle(b),
        link: `data-act="goplot" data-i="${b.i}" data-j="${b.j}"`, level: b.floors,
        eff: b.state === 'build' ? b.progress / b.buildDays : BUILDINGS[b.type].category === 'social' ? 1 : G.occRate(b),
        products: b.state === 'build' ? `<span class="hint">стройка ${pct(b.progress / b.buildDays)}</span>` : Object.keys(b.units).map(t => `<span title="${UNITS[t].name}">${unitIc(t)}</span>`).join('') || `<span title="Социальное здание">${ic('shield')}</span>`,
        rev: w.rev, exp: w.exp, assets: b.state === 'done' ? G.marketValue(b) : G.invested(b),
        problem: b.state === 'build' && b.paused ? 'Стройка стоит' : b.state === 'done' && Object.keys(b.units).length && G.occRate(b) < 0.5 ? 'Мало арендаторов — снизьте аренду' : null });
    }
    for (const e of Object.values(s.enterprises)) {
      const w = weekOf(e.hist);
      const d = entDef(e);
      const goods = d.goods ? d.goods.filter(g => e.stock[g]) : e.type === 'lab' ? (e.research ? [e.research] : [])
        : e.type === 'construction' || e.type === 'warehouse' ? Object.keys(e.stock) : [...new Set(e.divs.map(x => x.recipe).filter(Boolean))];
      let stock = 0;
      for (const g in e.stock) stock += e.stock[g].qty * s.prices[g] * 0.6;
      rows.push({ key: 'e:' + e.type + ':' + e.sub, icon: eTile(e, 'sm'), kind: d.name, name: esc(e.name), link: `data-act="openent" data-id="${e.id}"`,
        level: e.lvl || 1, free: P.freeLevels(e), eff: Math.min(1, (P.workersOf(e) / Math.max(1, P.maxWorkers(e))) * P.salaryEff(this.s, e) * P.specBonus(this.s, e)),
        products: goods.map(g => `<span class="ge" title="${GOODS[g].name}">${GOODS[g].icon}</span>`).join(''), rev: w.rev, exp: w.exp,
        assets: Math.round(e.invested * 0.6 + stock), problem: this.entProblem(e), contracts: P.consumersOf(s, e).length > 0 || Object.values(e.supply || {}).some(v => typeof v.src === 'number') });
    }
    return rows;
  }

  co_ent(s) {
    const rows = this.companyUnits();
    const kinds = [...new Map(rows.map(r => [r.key, r])).values()];
    const list = this.entFilter ? rows.filter(r => r.key === this.entFilter) : rows;
    let h = rows.length ? `<div class="filters"><button class="fchip ${!this.entFilter ? 'on' : ''}" data-act="entfilter" data-k="">${ic('layers')} Все <b>${rows.length}</b></button>
      ${kinds.map(r => `<button class="fchip ${this.entFilter === r.key ? 'on' : ''}" data-act="entfilter" data-k="${r.key}">${r.icon} ${r.kind} <b>${rows.filter(x => x.key === r.key).length}</b></button>`).join('')}</div>` : '';
    if (!rows.length) h += '<p class="hint">У компании пока нет предприятий и зданий.</p>';
    else h += `<table class="grid"><tr><th>Город</th><th>Предприятие</th><th>Уровень</th><th>Эффект.</th><th>Продукты</th><th class="r">Прибыль (7 дн.)</th><th class="r">Активы</th><th>Проблемы</th></tr>
      ${list.map(r => `<tr><td>${esc(s.cityName)}</td><td><a href="#" ${r.link} class="nm">${r.icon}${r.name}</a></td>
        <td><span class="lvlwrap"><span class="star sm">${r.level}</span>${r.free ? `<b class="free">+${r.free}</b>` : ""}</span></td><td><span class="effbar"><i style="width:${Math.round(r.eff * 100)}%"></i></span></td>
        <td class="prods">${r.products}</td><td class="r ${r.rev - r.exp >= 0 ? '' : 'neg'}">${fmt(r.rev - r.exp)}</td><td class="r">${fmt(r.assets)}</td>
        <td>${r.problem ? `<span class="warnic" title="${esc(r.problem)}">${ic('alert')}</span>` : ''}${r.contracts ? `<span class="hint" title="Есть поставки между своими предприятиями">${ic('truck')}</span>` : ''}</td></tr>`).join('')}</table>`;
    return h + `<p class="hint">Предприятий ${Object.keys(s.enterprises).length} / ${hqLimit(s, 'manage')} (лимит управляющего отдела штаб-квартиры).</p>`;
  }

  // ---------- вкладка «Специалисты» ----------
  co_staff(s) {
    const specs = s.specs || [];
    const ents = Object.values(s.enterprises);
    let h = `<h3>Специалисты компании</h3>`;
    h += specs.length ? `<table class="grid"><tr><th>Работник</th><th>Уровень</th><th class="r">Зарплата</th><th>Место работы</th><th>Профессия</th><th>Характеристики</th><th></th></tr>
      ${specs.map(x => {
        const opts = ents.filter(e => e.type === x.type);
        return `<tr><td><span class="nm">${ava(x.name)}<b>${esc(x.name)}</b></span></td>
          <td><span class="star sm">${x.level}</span> <span class="xp" title="Опыт до следующего уровня"><i style="width:${Math.round((x.xp / (x.level * 15)) * 100)}%"></i></span></td>
          <td class="r">${fmt(specSalary(x.level))}/день</td>
          <td><select data-act="assign" data-id="${x.id}"><option value="">— не назначен —</option>${opts.map(e => `<option value="${e.id}" ${x.job === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></td>
          <td>${x.prof}</td><td><span title="Производительность">${ic('zap')} +${x.level * 3}%</span> &nbsp; <span title="Качество продукции">${ic('sparkle')} +${(x.level * 0.08).toFixed(2)}</span></td>
          <td><button class="btn small danger" data-act="fire" data-id="${x.id}">Уволить</button></td></tr>`;
      }).join('')}
      <tr><td></td><td><b>Итого:</b></td><td class="r"><b>${fmt(specs.reduce((a, x) => a + specSalary(x.level), 0))}/день</b></td><td colspan="4"></td></tr></table>`
      : '<p class="hint">Специалистов пока нет. Наймите их на бирже ниже — каждый ускоряет и улучшает своё предприятие.</p>';
    h += `<h3>Биржа специалистов <small class="hint">обновляется каждые 7 дней</small></h3>
      <table class="grid"><tr><th>Кандидат</th><th>Уровень</th><th>Профессия</th><th class="r">Зарплата</th><th class="r">Подбор</th><th></th></tr>
      ${(s.candidates || []).map(c => `<tr><td><span class="nm">${ava(c.name)}${esc(c.name)}</span></td><td><span class="star sm">${c.level}</span></td><td>${c.prof} <span class="hint">(${ENTERPRISES[c.type].name})</span></td>
        <td class="r">${fmt(specSalary(c.level))}/день</td><td class="r">${fmt(P.hireFee(c))}</td>
        <td><button class="btn small primary" data-act="hire" data-id="${c.id}" ${s.money < P.hireFee(c) || G.companyLevel(s) < FEATURES.specialists ? 'disabled' : ''}>Нанять</button></td></tr>`).join('')}</table>
      ${G.companyLevel(s) < FEATURES.specialists ? `<p class="warn">${ic('lock')} Нанимать специалистов можно с ${FEATURES.specialists}-го уровня компании.</p>` : ''}
      <p class="hint">Специалист работает на одном предприятии своей профессии: +3% производительности и +0,08 к качеству за уровень. Опыт растёт каждый день работы.</p>`;
    if (ents.length) {
      h += `<h3>Рабочие <small class="hint">${num(P.staffTotal(s))} / ${num(hqLimit(s, 'staff'))} · средняя зарплата в городе ${s.marketSalary} ₽</small></h3>
        <table class="grid"><tr><th>Предприятие</th><th class="r">Работают</th><th class="r">Нужно</th><th>Зарплата, ₽/день</th><th class="r">Эффективность</th></tr>
        ${ents.map(e => `<tr><td><a href="#" data-act="openent" data-id="${e.id}">${entHtml(e)}</a></td><td class="r">${P.workersOf(e)}</td><td class="r">${P.targetOf(e)} / ${P.maxWorkers(e)}</td>
          <td><input type="number" min="1" value="${e.salary}" data-act="esalary" data-id="${e.id}" style="width:80px"></td><td class="r">${pct(P.salaryEff(s, e))}</td></tr>`).join('')}</table>`;
    }
    return h;
  }

  // ---------- вкладка «Финансы» ----------
  co_finance(s) {
    const subs = [['accounts', 'счета'], ['credits', 'кредиты'], ['credhist', 'кредитная история'], ['weekly', 'еженедельные платежи'], ['statement', 'выписка по счетам'], ['parties', 'контрагенты компании']];
    this.finSub ||= 'accounts';
    let h = `<div class="sublinks">${subs.map(([k, n]) => `<a href="#" data-act="finsub" data-k="${k}" class="${this.finSub === k ? 'on' : ''}">${n}</a>`).join('')}</div>`;
    switch (this.finSub) {
      case 'accounts':
        h += `<table class="grid"><tr><th>Тип</th><th>Номер</th><th>Валюта</th><th class="r">Сумма</th><th class="r">Предприятий</th><th>Статус</th></tr>
          <tr><td>Расчётный</td><td><a href="#" data-act="finsub" data-k="statement">${accountNo(s)}</a></td><td>Российский рубль</td><td class="r"><a href="#" data-act="finsub" data-k="statement">${fmt(s.money)}</a></td>
          <td class="r">${Object.keys(s.enterprises).length + Object.values(s.buildings).filter(G.isPlayer).length}</td><td>${s.money >= 0 ? 'активен' : '<span class="neg">в минусе</span>'}</td></tr></table>`;
        break;
      case 'credits': h += this.win_bank(s); break;
      case 'credhist':
        h += (s.loanLog || []).length ? `<table class="grid"><tr><th>Игровая дата</th><th>Операция</th><th class="r">Сумма</th><th class="r">Долг после</th></tr>
          ${s.loanLog.map(l => `<tr><td>${shortDate(l.day)}</td><td>${l.kind}</td><td class="r">${fmt(l.amount)}</td><td class="r">${fmt(l.loan)}</td></tr>`).join('')}</table>` : '<p class="hint">Кредитов ещё не было.</p>';
        break;
      case 'weekly': {
        const recurring = ['salary', 'specSalary', 'upkeep', 'estate', 'tax', 'shopRent', 'interest', 'purchase', 'transport'];
        const w = this.period(7);
        h += `<table class="grid"><tr><th>Платёж</th><th class="r">За неделю</th><th class="r">В среднем в день</th></tr>
          ${recurring.map(c => { const v = w.sum('exp', c); return v ? `<tr><td>${CATS[c].name}</td><td class="r">${fmt(v)}</td><td class="r">${fmt(v / Math.max(1, w.days))}</td></tr>` : ''; }).join('')}</table>`;
        break;
      }
      case 'statement': h += this.statementHtml(); break;
      case 'parties': {
        const m = new Map();
        for (const t of s.tx) {
          const p = m.get(t.party) || { in: 0, out: 0, n: 0 };
          if (t.amount > 0) p.in += t.amount; else p.out -= t.amount;
          p.n++; m.set(t.party, p);
        }
        h += `<table class="grid"><tr><th>Контрагент</th><th class="r">Получено от него</th><th class="r">Заплачено ему</th><th class="r">Операций</th></tr>
          ${[...m].sort((a, b) => b[1].in + b[1].out - a[1].in - a[1].out).map(([k, p]) => `<tr><td>${esc(k)}</td><td class="r pos">${p.in ? fmt(p.in) : '—'}</td><td class="r neg">${p.out ? fmt(p.out) : '—'}</td><td class="r">${p.n}</td></tr>`).join('')}</table>
          <p class="hint">По последним ${s.tx.length} операциям.</p>`;
        break;
      }
    }
    return h;
  }

  statementHtml() {
    const s = this.s, per = 25, pages = Math.max(1, Math.ceil(s.tx.length / per));
    this.txPage = Math.min(this.txPage || 0, pages - 1);
    const rows = s.tx.slice(this.txPage * per, this.txPage * per + per);
    const co = esc(s.company);
    return `<div class="acc">Счёт № ${accountNo(s)}</div><table class="grid"><tr><th>##</th><th>Игровая дата</th><th>Плательщик</th><th>Получатель</th><th>Тип</th><th class="r">Сумма</th><th class="r">Остаток по счёту</th></tr>
      ${rows.map(t => {
        const mineSide = t.from ? `${co} · ${esc(t.from)}` : co;
        const [payer, payee] = t.amount < 0 ? [mineSide, esc(t.party)] : [esc(t.party), mineSide];
        return `<tr><td>#${t.id}</td><td>${shortDate(t.day)}</td><td>${payer}</td><td>${payee}</td><td>${esc(t.type)}</td>
          <td class="r ${t.amount < 0 ? 'neg' : ''}">${fmt(t.amount)}</td><td class="r">${fmt(t.balance)}</td></tr>`;
      }).join('') || '<tr><td colspan="7" class="hint">Операций пока нет</td></tr>'}</table>
      ${pages > 1 ? `<div class="pager">${Array.from({ length: Math.min(pages, 12) }, (_, n) => `<button class="${n === this.txPage ? 'on' : ''}" data-act="txpage" data-p="${n}">${n + 1}</button>`).join('')}</div>` : ''}`;
  }

  // ---------- вкладка «Отчёты» ----------
  co_reports(s) {
    // выписка по счёту — в «Финансах», здесь её не дублируем
    const reps = [['income', 'cash', 'Доходы и расходы'], ['assets', 'coins', 'Активы'], ['charts', 'pie', 'Графики'], ['byEnt', 'factory', 'По предприятиям'],
      ['byInd', 'layers', 'По отраслям'], ['goods', 'box', 'Товарооборот'], ['geo', 'map', 'География'], ['eod', 'calendar', 'Остаток на конец дня'], ['news', 'news', 'Новости']];
    if (!reps.some(r => r[0] === this.rep)) this.rep = 'income';
    return `<div class="seg">${reps.map(([k, i, n]) => `<button class="${this.rep === k ? 'on' : ''}" data-act="rep" data-k="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div>
      ${this[`rep_${this.rep}`](s)}`;
  }

  // сумма статьи по истории: дни [from, to) от конца
  histSum(side, cat, from, to) {
    const h = this.s.history, a = Math.max(0, h.length - to), b = Math.max(0, h.length - from);
    let v = 0;
    for (let n = a; n < b; n++) v += cat ? h[n][side]?.[cat] || 0 : (side === 'inc' ? h[n].income : h[n].expense);
    return v;
  }

  rep_income(s) {
    const year = s.totals?.years?.[Math.floor((s.day - 1) / 365) + 1] || { inc: {}, exp: {} }, all = s.totals?.all || { inc: {}, exp: {} };
    const cols = (side, cats) => {
      const f = (fn) => cats.reduce((a, c) => a + fn(c), 0);
      const week = f(c => this.histSum(side, c, 0, 7)), prev = f(c => this.histSum(side, c, 7, 14));
      return { week, delta: week - prev, prev, month: f(c => this.histSum(side, c, 0, 30)), year: f(c => year[side][c] || 0), all: f(c => all[side][c] || 0) };
    };
    const td = (v, sign, good) => `<td class="r ${sign && v ? ((v > 0) === good ? 'pos' : 'neg') : ''}">${v ? (sign && v > 0 ? '+' : '') + num(v) : '—'}</td>`;
    const row = (title, side, cats, cls = '', mult = 1) => {
      const c = cols(side, cats);
      const k = mult;
      return `<tr class="${cls}"><td>${title}</td>${td(c.week * k)}${td(c.delta * k, true, side === 'inc' ? k > 0 : k < 0)}${td(c.prev * k)}${td(c.month * k)}${td(c.year * k)}${td(c.all * k)}</tr>`;
    };
    const net = (title, parts, cls) => {
      const sums = parts.map(([side, cats, k]) => { const c = cols(side, cats); return Object.fromEntries(Object.entries(c).map(([n, v]) => [n, v * k])); });
      const t = Object.fromEntries(Object.keys(sums[0]).map(n => [n, sums.reduce((a, x) => a + x[n], 0)]));
      return `<tr class="${cls}"><td>${title}</td>${td(t.week)}${td(t.delta, true, true)}${td(t.prev)}${td(t.month)}${td(t.year)}${td(t.all)}</tr>`;
    };
    const ids = (side, group) => Object.keys(CATS).filter(c => CATS[c].side === side && CATS[c].group === group);
    const block = (title, side, group) => row(title, side, ids(side, group), 'sec') + ids(side, group).map(c => row(CATS[c].name, side, [c], 'sub')).join('');
    return `<table class="grid rep"><tr><th>Название статьи</th><th class="r">Неделя</th><th class="r"></th><th class="r">Предыдущая</th><th class="r">Месяц</th><th class="r">Год</th><th class="r">Всего</th></tr>
      ${block('Доходы', 'inc', 'op')}${block('Операционные расходы', 'exp', 'op')}
      ${net('Прибыль от операционной деятельности', [['inc', ids('inc', 'op'), 1], ['exp', ids('exp', 'op'), -1]], 'tot')}
      ${block('Инвестиционные доходы', 'inc', 'inv')}${block('Инвестиционные расходы', 'exp', 'inv')}
      ${net('Инвестиции', [['inc', ids('inc', 'inv'), 1], ['exp', ids('exp', 'inv'), -1]], 'tot')}
      ${block('Финансовые доходы', 'inc', 'fin')}${block('Финансовые расходы', 'exp', 'fin')}
      ${net('Денежный поток от финансовых операций', [['inc', ids('inc', 'fin'), 1], ['exp', ids('exp', 'fin'), -1]], 'tot')}
      ${net('Чистая прибыль', [['inc', ids('inc', 'op'), 1], ['exp', [...ids('exp', 'op'), 'interest'], -1]], 'total')}
      ${net('Изменение денег на счету', [['inc', Object.keys(CATS).filter(c => CATS[c].side === 'inc'), 1], ['exp', Object.keys(CATS).filter(c => CATS[c].side === 'exp'), -1]], 'tot')}</table>`;
  }

  rep_assets(s) {
    const h = s.history, now = G.assets(s), wk = h[h.length - 8]?.assets, mo = h[h.length - 31]?.assets;
    const rows = [['Материальные активы', ['buildings', 'wip', 'equipment', 'stock', 'hq'], 'sec'], ['Здания, сооружения', ['buildings'], 'sub'], ['Незавершённое строительство', ['wip'], 'sub'],
      ['Оборудование предприятий', ['equipment'], 'sub'], ['Сырьё, товары', ['stock'], 'sub'], ['Штаб-квартира', ['hq'], 'sub'],
      ['Финансовые активы', ['cash'], 'sec'], ['Денежные средства', ['cash'], 'sub'],
      ['Всего активов', ['buildings', 'wip', 'equipment', 'stock', 'hq', 'cash'], 'tot'],
      ['Обязательства', ['loan'], 'sec'], ['Обязательства по кредитам', ['loan'], 'sub'], ['Всего обязательств', ['loan'], 'tot']];
    const v = (a, keys) => (a ? keys.reduce((x, k) => x + (a[k] || 0), 0) : null);
    const td = (x, d) => `<td class="r ${d && x ? (x > 0 ? 'pos' : 'neg') : ''}">${x == null ? '—' : x ? (d && x > 0 ? '+' : '') + num(x) : '—'}</td>`;
    const line = (t, keys, cls, k = 1) => { const a = v(now, keys) * k, b = wk ? v(wk, keys) * k : null; return `<tr class="${cls}"><td>${t}</td>${td(a)}${td(b == null ? null : a - b, true)}${td(b)}${td(mo ? v(mo, keys) * k : null)}</tr>`; };
    const netKeys = ['buildings', 'wip', 'equipment', 'stock', 'hq', 'cash'];
    const netRow = (() => { const f = a => (a ? v(a, netKeys) - a.loan : null), a = f(now), b = f(wk); return `<tr class="total"><td>Чистые активы</td>${td(a)}${td(b == null ? null : a - b, true)}${td(b)}${td(f(mo))}</tr>`; })();
    return `<table class="grid rep"><tr><th>Название статьи</th><th class="r">Сейчас</th><th class="r">За неделю</th><th class="r">Неделю назад</th><th class="r">Месяц назад</th></tr>
      ${rows.map(([t, k, c]) => line(t, k, c)).join('')}${netRow}</table>`;
  }

  rep_charts() {
    return `<div class="charts"><figure><canvas id="ch1"></canvas><figcaption><i style="background:#4ade80"></i>доходы <i style="background:#818cf8"></i>расходы <i style="background:#f87171"></i>прибыль</figcaption></figure>
      <figure><canvas id="ch2"></canvas><figcaption><i style="background:#4ade80"></i>активы <i style="background:#818cf8"></i>долги <i style="background:#f87171"></i>чистые активы</figcaption></figure>
      <figure><canvas id="ch3"></canvas><figcaption>Расходы за неделю</figcaption></figure><figure><canvas id="ch4"></canvas><figcaption>Активы</figcaption></figure></div>
      <div id="pieLegend" class="hint"></div>`;
  }

  rep_byEnt(s) {
    const rows = this.companyUnits();
    const hqCost = this.histSum('exp', 'hq', 0, 7);
    return `<table class="grid"><tr><th>Город</th><th>Предприятие</th><th class="r">Выручка</th><th class="r">Затраты</th><th class="r">Прибыль</th><th class="r">Активы</th><th class="r">Долги</th></tr>
      ${rows.map(r => `<tr><td>${esc(s.cityName)}</td><td><span class="lvlwrap"><span class="star sm">${r.level}</span>${r.free ? `<b class="free">+${r.free}</b>` : ""}</span> <a href="#" ${r.link} class="nm">${r.icon}${r.name}</a></td>
        <td class="r">${fmt(r.rev)}</td><td class="r">${fmt(r.exp)}</td><td class="r ${r.rev - r.exp < 0 ? 'neg' : ''}">${fmt(r.rev - r.exp)}</td><td class="r">${fmt(r.assets)}</td><td class="r">—</td></tr>`).join('')}
      <tr><td>${esc(s.cityName)}</td><td><span class="star sm">${Math.max(...Object.values(s.hq))}</span> <span class="nm"><span class="ti sm" style="--c:#475569">${ic('bank')}</span>Штаб-квартира</span></td><td class="r">${fmt(0)}</td><td class="r">${fmt(hqCost)}</td>
        <td class="r ${hqCost ? 'neg' : ''}">${fmt(-hqCost)}</td><td class="r">${fmt(G.assets(s).hq)}</td><td class="r">—</td></tr></table>
      <p class="hint">Выручка и затраты — за последние 7 дней.</p>`;
  }

  rep_byInd(s) {
    const m = new Map();
    for (const r of this.companyUnits()) {
      const x = m.get(r.key) || { icon: r.icon, kind: r.kind, n: 0, rev: 0, exp: 0, assets: 0 };
      x.n++; x.rev += r.rev; x.exp += r.exp; x.assets += r.assets; m.set(r.key, x);
    }
    return `<table class="grid"><tr><th>Тип предприятий</th><th class="r">Выручка</th><th class="r">Затраты</th><th class="r">Прибыль</th><th class="r">Активы</th></tr>
      ${[...m.values()].sort((a, b) => b.assets - a.assets).map(x => `<tr><td><span class="nm">${x.icon}${x.kind}</span> <span class="hint">(${x.n})</span></td><td class="r">${fmt(x.rev)}</td><td class="r">${fmt(x.exp)}</td>
        <td class="r ${x.rev - x.exp < 0 ? 'neg' : ''}">${fmt(x.rev - x.exp)}</td><td class="r">${fmt(x.assets)}</td></tr>`).join('') || '<tr><td colspan="5" class="hint">Пусто</td></tr>'}</table>`;
  }

  rep_goods(s) {
    const groups = goodGroups();
    this.goodsGroup ||= Object.keys(groups)[0];
    const h = s.history.slice(-7), sumF = (g, f) => h.reduce((a, d) => a + (d.flow?.[g]?.[f] || 0), 0);
    const stock = g => Object.values(s.enterprises).reduce((a, e) => a + P.stockQty(e, g), 0);
    return `<div class="goodsrep"><div class="gside">${Object.keys(groups).map(k => `<a href="#" data-act="ggroup" data-k="${k}" class="${this.goodsGroup === k ? 'on' : ''}">${k}</a>`).join('')}</div>
      <table class="grid"><tr><th rowspan="2">Продукт</th><th rowspan="2" class="r">Запасы</th><th colspan="2" class="c">Приход</th><th colspan="3" class="c">Расход</th><th rowspan="2" class="r">Общий баланс</th></tr>
      <tr><th class="r">Куплено</th><th class="r">Произведено</th><th class="r">Потреблено</th><th class="r">Продано оптом</th><th class="r">Продано в розницу</th></tr>
      ${groups[this.goodsGroup].map(g => {
        const b = sumF(g, 'bought'), m = sumF(g, 'made'), u = sumF(g, 'used'), w = sumF(g, 'whole'), r = sumF(g, 'retail'), bal = b + m - u - w - r;
        return `<tr><td>${gn(g)}</td><td class="r">${num(stock(g))}</td><td class="r">${num(b)}</td><td class="r">${num(m)}</td><td class="r">${num(u)}</td><td class="r">${num(w)}</td><td class="r">${num(r)}</td>
          <td class="r ${bal > 0 ? 'pos' : bal < 0 ? 'neg' : ''}">${bal > 0 ? '+' : ''}${num(bal)}</td></tr>`;
      }).join('')}</table></div><p class="hint">За последние 7 дней. Перевозки между своими предприятиями не учитываются.</p>`;
  }

  rep_statement() { return this.statementHtml(); }

  rep_geo(s) {
    const a = G.assets(s), total = Object.entries(a).filter(([k]) => k !== 'loan').reduce((x, [, v]) => x + v, 0);
    const rev = this.histSum('inc', null, 0, 7), exp = this.histSum('exp', null, 0, 7);
    return `<div class="twocol"><div><h3>Финансы</h3><table class="grid"><tr><th>Город</th><th class="r">Активы</th><th class="r">Выручка (7 дн.)</th><th class="r">Прибыль</th></tr>
      <tr><td>${esc(s.cityName)}</td><td class="r">${fmt(total)} <small class="hint">100%</small></td><td class="r">${fmt(rev)} <small class="hint">100%</small></td><td class="r">${fmt(rev - exp)}</td></tr></table></div>
      <div><h3>Рабочие</h3><table class="grid"><tr><th>Город</th><th class="r">Доля</th><th class="r">Рабочие</th></tr>
      <tr><td>${esc(s.cityName)}</td><td class="r">100%</td><td class="r">${num(P.staffTotal(s) + (s.specs || []).length)}</td></tr></table></div></div>
      <p class="hint">Сейчас компания работает в одном городе. Другие города появятся вместе с картой мира.</p>`;
  }

  rep_eod(s) {
    const h = s.history.slice(-60);
    return `<div class="acc">Счёт № ${accountNo(s)}</div><table class="grid" style="max-width:520px"><tr><th>Игровая дата</th><th class="r">Изменение</th><th class="r">Остаток по счёту</th></tr>
      ${h.map((d, n) => ({ d, ch: n ? d.money - h[n - 1].money : null })).reverse().map(({ d, ch }) => `<tr><td>${shortDate(d.day - 1)}</td>
        <td class="r ${ch < 0 ? 'neg' : ''}">${ch == null ? '—' : fmt(ch)}</td><td class="r">${fmt(d.money)}</td></tr>`).join('')}</table>`;
  }

  rep_news(s) {
    return `<div class="news-list">${s.news.map(n => `<div><b>${shortDate(n.day)}</b>${esc(n.text)}</div>`).join('')}</div>`;
  }

  // графики для «Графических отчётов»
  drawReportCharts() {
    const s = this.s, h = s.history.slice(-60);
    const line = (id, series, bars) => {
      const c = $(id); if (!c) return;
      const { x, W, H } = canvas2d(c);
      x.fillStyle = '#eef0f3'; x.fillRect(0, 0, W, H);
      if (h.length < 2) return;
      const all = series.flatMap(([f]) => h.map(f)).concat(bars ? h.map(bars) : []);
      const hi = Math.max(1, ...all), lo = Math.min(0, ...all);
      const X = n => 4 + (n / (h.length - 1)) * (W - 8), Y = v => H - 6 - ((v - lo) / (hi - lo)) * (H - 14);
      for (const [f, col, fill] of series) {
        x.beginPath(); h.forEach((d, n) => (n ? x.lineTo(X(n), Y(f(d))) : x.moveTo(X(n), Y(f(d)))));
        if (fill) { x.lineTo(X(h.length - 1), Y(0)); x.lineTo(X(0), Y(0)); x.closePath(); x.fillStyle = col; x.globalAlpha = 0.55; x.fill(); x.globalAlpha = 1; }
        else { x.strokeStyle = col; x.lineWidth = 2; x.stroke(); }
      }
      if (bars) { x.fillStyle = '#f87171'; h.forEach((d, n) => { const v = bars(d); x.fillRect(X(n) - 1.5, Math.min(Y(0), Y(v)), 3, Math.abs(Y(v) - Y(0))); }); }
    };
    line('#ch1', [[d => d.expense, '#818cf8', true], [d => d.income, '#4ade80', false]], d => d.income - d.expense);
    const net = d => (d.assets ? Object.entries(d.assets).filter(([k]) => k !== 'loan').reduce((a, [, v]) => a + v, 0) : d.worth);
    line('#ch2', [[net, '#4ade80', true], [d => d.assets?.loan || 0, '#818cf8', true]], d => net(d) - (d.assets?.loan || 0));
    const pie = (id, parts) => {
      const c = $(id); if (!c) return;
      const { x, W, H } = canvas2d(c);
      const tot = parts.reduce((a, p) => a + p[1], 0);
      if (!tot) { x.fillStyle = '#6b7280'; x.fillText('Нет данных', 10, 20); return; }
      const cx = W / 2, cy = H / 2 - 6, rx = Math.min(W, H * 1.8) / 2 - 6, ry = rx * 0.45, depth = 16;
      const colors = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#84cc16', '#f97316', '#64748b', '#ec4899'];
      for (let d = depth; d >= 0; d -= 2) {
        let a = -Math.PI / 2;
        parts.forEach(([, v], n) => {
          const a2 = a + (v / tot) * Math.PI * 2;
          x.beginPath(); x.moveTo(cx, cy + d); x.ellipse(cx, cy + d, rx, ry, 0, a, a2); x.closePath();
          x.fillStyle = colors[n % colors.length]; x.globalAlpha = d ? 0.6 : 0.95; x.fill();
          a = a2;
        });
      }
      x.globalAlpha = 1;
      return colors;
    };
    const w = this.period(7), exps = Object.keys(CATS).filter(k => CATS[k].side === 'exp').map(k => [CATS[k].name, w.sum('exp', k)]).filter(p => p[1] > 0);
    const a = G.assets(s), names = { buildings: 'Здания', wip: 'Стройки', equipment: 'Оборудование', stock: 'Товары', hq: 'Штаб-квартира', cash: 'Деньги' };
    const ass = Object.keys(names).map(k => [names[k], a[k]]).filter(p => p[1] > 0);
    const colors = pie('#ch3', exps); pie('#ch4', ass);
    const leg = (parts) => parts.map(([n, v], i) => `<span class="lg"><i style="background:${(colors || [])[i % 10]}"></i>${n} — ${fmtShort(v)}</span>`).join(' ');
    if ($('#pieLegend')) $('#pieLegend').innerHTML = `<p><b>Расходы:</b> ${leg(exps)}</p><p><b>Активы:</b> ${leg(ass)}</p>`;
  }

  // ---------- страница города (как «Город Ташкент» в Бизмании) ----------
  page_city(s) {
    this.cityTab ||= 'map';
    const tabs = [['info', 'Город'], ['map', 'Карта'], ['projects', 'Стройки'], ['ents', 'Здания'], ['analytics', 'Аналитика']];
    return `<div class="page-title"><span class="pt-ic">${ic('city')}</span><h1>Город ${esc(s.cityName)}</h1>
        <button class="btn icon" data-act="renamecity" title="Переименовать город">${ic('pencil')}</button>
        <div class="acts"><span class="hint">Уровень города</span><span class="star" title="Уровень города">${s.city.level || 1}</span></div></div>
      <div class="ftabs">${tabs.map(([k, n]) => `<button data-act="citytab" data-k="${k}" class="${this.cityTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${this[`city_${this.cityTab}`](s)}`;
  }

  city_map() {
    const c = this.app.world.coverage || {};
    return `<div class="mapframe" id="mapSlot"></div>
      <p class="hint">Клик по участку — информация и стройка. Мышь: левая кнопка — двигать, правая — вращать, колесо — масштаб.
        Круги показывают зоны охвата: зелёные — ваши здания, красные — конкурентов.</p>
      <div class="filters">${[['hospital', 'Больницы', bTile('hospital', 'sm')], ['police', 'Полиция', bTile('police', 'sm')], ['school', 'Школы', bTile('school', 'sm')], ['shops', 'Магазины', entTile('shop', null, 'sm')]]
        .map(([k, n, i]) => `<label class="fchip ${c[k] ? 'on' : ''}"><input type="checkbox" data-act="cover" data-k="${k}" ${c[k] ? 'checked' : ''}>${i} ${n}</label>`).join('')}</div>`;
  }

  city_info(s) {
    const all = Object.values(s.buildings), done = all.filter(b => b.state === 'done');
    const mine = all.filter(G.isPlayer).length;
    const plots = Object.keys(s.plots).length;
    const count = t => done.filter(b => b.type === t).length;
    return `<div class="twocol"><div class="kv">
        <span>Население</span><span>${num(s.city.population || 0)} чел.</span><span>Семей в квартирах</span><span>${num(s.city.households || 0)}</span>
        <span>Рабочих мест</span><span>${num(s.city.jobs || 0)}</span><span>Средняя зарплата</span><span>${s.marketSalary} ₽/день</span>
        <span>Застроено участков</span><span>${all.length} из ${plots}</span><span>Ваших зданий</span><span>${mine}</span>
        <span>Уровень города</span><span><span class="star sm">${s.city.level || 1}</span></span>
        <span>Полиция / больницы / школы</span><span>${count('police')} / ${count('hospital')} / ${count('school')}</span></div>
      <div><p class="hint">Для каждого следующего уровня городу нужно по 2 полиции, больницы и школы. Уровень города увеличивает спрос жителей.</p>
        <p class="hint">Место вашей компании в рейтинге: <b>${G.rating(s).findIndex(r => r.player) + 1}</b> — <a href="#" data-act="gopage" data-k="rating">рейтинг компаний</a>.</p></div></div>`;
  }

  city_projects(s) {
    const list = Object.values(s.buildings).filter(b => b.state === 'build');
    return this.buildsHtml(s) + '<h3>Все стройки города</h3>' + (list.length ? `<table class="grid"><tr><th>Объект</th><th>Заказчик</th><th>Подрядчик</th><th class="r">Готовность</th><th class="r">Осталось</th></tr>
      ${list.map(b => `<tr><td><a href="#" data-act="goplot" data-i="${b.i}" data-j="${b.j}" class="nm">${bHtml(b)}</a> · ${b.floors} эт.</td><td style="color:${ownerColor(b)}">${ownerName(s, b)}</td>
        <td>${contractorInfo(b.contractor).name}</td><td class="r">${pct(b.progress / b.buildDays)}</td><td class="r">~${Math.ceil(b.buildDays - b.progress)} дн.</td></tr>`).join('')}</table>`
      : '<p class="hint">Сейчас в городе ничего не строится.</p>');
  }

  city_ents(s) {
    const list = Object.values(s.buildings).filter(b => b.state === 'done');
    return list.length ? `<table class="grid"><tr><th>Здание</th><th>Владелец</th><th class="r">Этажей</th><th class="r">Заполненность</th><th>Район</th></tr>
      ${list.map(b => `<tr><td><a href="#" data-act="goplot" data-i="${b.i}" data-j="${b.j}" class="nm">${bHtml(b)}</a></td><td style="color:${ownerColor(b)}">${ownerName(s, b)}</td>
        <td class="r">${b.floors}</td><td class="r">${BUILDINGS[b.type].category === 'social' ? '—' : pct(G.occRate(b))}</td><td>${s.plots[G.key(b.i, b.j)].loc.toFixed(2)}</td></tr>`).join('')}</table>`
      : '<p class="hint">В городе пока нет готовых зданий.</p>';
  }

  city_analytics(s) {
    const keep = this.winTab;
    this.winTab = 'estate';
    const h = this.win_market(s).replace(/<div class="tabs">[\s\S]*?<\/div>/, '');
    this.winTab = keep;
    return h;
  }

  page_builds(s) { this.cityTab = 'projects'; this.page = 'city'; return this.page_city(s); }
  // Ваши стройки и подрядчики — вкладка «Стройки» города
  buildsHtml(s) {
    const blds = Object.values(s.buildings).filter(b => G.isPlayer(b) && b.state === 'build');
    return `<div class="actions" style="margin:0 0 12px"><button class="btn primary" data-act="tocity">${ic('pin')} Выбрать участок на карте</button></div>
      <div class="kv" style="max-width:480px"><span>Строек сейчас</span><span>${blds.length} / ${hqLimit(s, 'build')}</span>
      <span>Своих строительных компаний</span><span>${G.builders(s).length}</span></div>
      ${blds.length ? `<table class="grid"><tr><th>Здание</th><th>Строит</th><th class="r">Готовность</th><th class="r">Осталось</th><th>Статус</th></tr>
      ${blds.map(b => `<tr><td><a href="#" data-act="goplot" data-i="${b.i}" data-j="${b.j}" class="nm">${bHtml(b)}</a> · ${b.floors} эт.</td><td>${contractorInfo(b.contractor).name}</td>
        <td class="r">${pct(b.progress / b.buildDays)}</td><td class="r">~${Math.ceil(b.buildDays - b.progress)} дн.</td>
        <td>${b.paused ? '<span class="neg">стоит</span>' : b.delayed ? 'простой' : 'идёт'}</td></tr>`).join('')}</table>`
      : '<p class="hint">Строек нет. Откройте город, кликните по свободному участку и выберите, что и кто строит.</p>'}
      <h3>Подрядчики</h3><table class="grid"><tr><th>Компания</th><th class="r">Цена</th><th class="r">Срок</th><th>Качество</th><th></th></tr>
      ${Object.values(CONTRACTORS).map(c => `<tr><td><b style="color:${c.color}">${c.name}</b></td><td class="r">×${c.price}</td><td class="r">×${c.speed}</td><td class="stars">${stars(c.quality)}</td><td class="hint">${c.desc}</td></tr>`).join('')}
      <tr><td><b style="color:${OWN.color}">${OWN.name}</b></td><td class="r">материалы</td><td class="r">бригада</td><td class="stars">${stars(OWN.quality)}</td><td class="hint">${OWN.desc}</td></tr></table>`;
  }

  page_settings(s) {
    const st = this.app.settings;
    return `<div class="page-title"><span class="pt-ic">${ic('settings')}</span><h1>Настройки</h1></div>
      <div class="box" style="max-width:640px"><h4>Сервер</h4><div class="kv">
        <span>Длина игрового дня</span><span><b>${st.dayLengthSeconds} сек.</b></span>
        <span>Источник</span><span>${st.fromServer ? 'настройки сервера (settings.json)' : 'по умолчанию — файл настроек не найден'}</span></div>
        <p class="hint">Длина дня задаётся на сервере: в окне программы BizCity.exe или в файле <code>bizgame/settings.json</code>
        (<code>{"dayLengthSeconds": 60}</code>). Игра подхватывает изменения сама в течение 20 секунд.
        Кнопки ускорения внизу экрана ускоряют время только у вас.</p></div>
      <div class="box" style="max-width:640px"><h4>Прогресс</h4><p class="hint">Сброс удалит сохранение и начнёт игру с пустого города.</p>
        <button class="btn danger" data-act="reset">${ic('refresh')} Сбросить прогресс</button></div>`;
  }

  page_market(s) { return this.titled('market'); }
  page_exchange(s) { return this.titled('exchange'); }

  // Биржа предприятий: купить у конкурентов, продать им или выставить на продажу по своей цене
  win_exchange(s) {
    if (!s.entMarket) P.refreshListings(s);
    this.exTab ||= 'buy';
    const tabs = [['buy', 'Купить'], ['sell', 'Продать'], ['log', 'Сделки']];
    let h = `<div class="tabs">${tabs.map(([k, n]) => `<button data-act="extab" data-k="${k}" class="${this.exTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const divs = e => e.divs.map(d => `<span title="${esc(P.divName(e, d))}: уровень ${d.level}, оборудование кач. ${(d.eq || 3).toFixed(1)}">${d.recipe ? `<span class="ge">${GOODS[d.recipe].icon}</span>` : ''}<span class="star sm">${d.level}</span></span>`).join(' ');
    if (this.exTab === 'buy') {
      const L = G.companyLevel(s);
      h += `<p class="hint">Компании-конкуренты продают свои заводы, фермы, шахты и склады — с подразделениями, оборудованием и уровнем. Предложения обновляются раз в неделю.
        Купленное предприятие начинает работать сразу: наймите людей и настройте снабжение.</p>
        <table class="grid"><tr><th>Предприятие</th><th>Продавец</th><th>Уровень</th><th>Подразделения</th><th class="r">Оценка</th><th class="r">Цена</th><th class="r">Снимут через</th><th></th></tr>
        ${s.entMarket.listings.map(x => { const e = x.ent, d = entDef(e), lock = L < d.minLevel;
          return `<tr><td><span class="nm">${eTile(e, 'sm')}${esc(e.name)}</span><div class="hint">${d.name}</div></td><td><span class="dot" style="background:${RIVALS[x.seller].color}"></span>${esc(RIVALS[x.seller].name)}</td>
            <td>${lvlStar(e, 'sm')}</td><td class="prods sm">${divs(e)}</td><td class="r">${fmt(x.value)}</td>
            <td class="r ${x.price < x.value ? 'pos' : ''}"><b>${fmt(x.price)}</b></td><td class="r">${x.until - s.day} дн.</td>
            <td>${lock ? `<span class="hint">${ic('lock')} с ${d.minLevel}-го уровня</span>` : `<button class="btn small primary" data-act="exbuy" data-id="${x.lid}" ${s.money < x.price ? 'disabled' : ''}>Купить</button>`}</td></tr>`; }).join('') || '<tr><td colspan="8" class="hint">Предложений нет</td></tr>'}</table>`;
    } else if (this.exTab === 'sell') {
      const ents = Object.values(s.enterprises);
      h += `<p class="hint">Конкуренты делают ставки на ваши предприятия (раз в неделю — новые). Можно продать сразу по лучшей ставке или выставить своё предприятие по своей цене:
        если цена не выше оценки более чем на 20%, покупатель скоро найдётся. Государство выкупает за половину активов — на бирже обычно выгоднее.</p>
        ${ents.length ? `<table class="grid"><tr><th>Предприятие</th><th>Уровень</th><th class="r">Прибыль в день</th><th class="r">Оценка</th><th>Лучшая ставка</th><th>Своя цена</th></tr>
        ${ents.map(e => { const b = P.bidsFor(s, e)[0], w = e.hist.slice(-14), pr = w.length ? w.reduce((a, x) => a + x.rev - x.exp, 0) / w.length : 0;
          return `<tr><td><a href="#" data-act="openent" data-id="${e.id}">${entHtml(e)}</a></td><td>${lvlStar(e, 'sm')}</td><td class="r ${pr < 0 ? 'neg' : ''}">${fmt(pr)}</td><td class="r">${fmt(P.entValue(s, e))}</td>
            <td>${b ? `${fmt(b.price)} <span class="hint">${esc(b.name)}</span> <button class="btn small" data-act="exsell" data-id="${e.id}" data-r="${b.i}" data-p="${b.price}">Продать</button>` : '<span class="hint">ставок нет</span>'}</td>
            <td><input type="number" min="0" step="10000" id="exp${e.id}" value="${e.forSale || Math.round(P.entValue(s, e) / 10000) * 10000}" style="width:130px">
              ${e.forSale ? `<button class="btn small" data-act="exlist" data-id="${e.id}">Изменить</button> <button class="btn small" data-act="exunlist" data-id="${e.id}">Снять</button> <span class="pos">в продаже</span>`
                : `<button class="btn small primary" data-act="exlist" data-id="${e.id}">Выставить</button>`}</td></tr>`; }).join('')}</table>` : '<p class="hint">У вас пока нет предприятий.</p>'}`;
    } else {
      h += (s.entMarket.log || []).length ? `<div class="news-list">${s.entMarket.log.map(l => `<div><b>${shortDate(l.day)}</b>${esc(l.text)}</div>`).join('')}</div>` : '<p class="hint">Сделок пока не было.</p>';
    }
    return h;
  }
  page_rating(s) { return this.titled('rating'); }
  page_quests(s) { return this.titled('quests'); }
  page_help(s) { return this.titled('help'); }

  win_enterprises() { return this.co_ent(this.s); }

  win_market(s) {
    // недвижимость — во вкладке «Аналитика» города; вкладки рынка — в общем подменю раздела
    if (this.page === 'market' && this.winTab === 'estate') this.winTab = 'goods';
    let h = '';
    if (this.winTab === 'estate') {
      const done = Object.values(s.buildings).filter(b => b.state === 'done');
      h += `<div class="kv"><span>Население</span><span>${num(s.city.population || 0)}</span><span>Рабочих мест</span><span>${num(s.city.jobs || 0)}</span></div>
        <table class="grid"><tr><th>Помещения</th><th class="r">Спрос</th><th class="r">Всего в городе</th><th class="r">Занято</th><th class="r">Аренда в центре / на окраине</th></tr>`;
      for (const t in UNITS) {
        const tot = done.reduce((a, b) => a + (b.units[t]?.total || 0), 0), occ = done.reduce((a, b) => a + (b.units[t]?.occ || 0), 0);
        h += `<tr><td><span class="nm">${unitIc(t)}${UNITS[t].name}</span></td><td class="r">${num(s.city.demand?.[t] || 0)}${isArea(t) ? ' м²' : ''}</td><td class="r">${num(tot)}</td><td class="r">${num(occ)}</td>
          <td class="r">${num(UNITS[t].rent * (0.6 + 0.4 * 1.7))} / ${num(UNITS[t].rent * (0.6 + 0.4 * 0.6))} ₽${isArea(t) ? ' за м²' : ''}</td></tr>`;
      }
      const mods = Object.entries(s.mods).map(([k, m]) => `${{ apt: 'жильё', office: 'офисы', comm: 'коммерция', build: 'стоимость стройки' }[k]} ×${m.mult} (${m.days} дн.)`);
      return h + `</table>${mods.length ? `<p class="warn">События: ${mods.join(', ')}</p>` : ''}
        <p class="hint">Спрос на жильё растёт с каждым днём и с числом рабочих мест; спрос на офисы и коммерцию — с населением.</p>`;
    }
    if (this.winTab === 'chains') {
      h += `<p class="hint">Сколько сырья нужно на единицу продукции и сколько выпускает цех 1-го уровня с полным штатом.</p>
        <table class="grid"><tr><th>Товар</th><th>Где делают</th><th>Из чего (на 1 ед.)</th><th class="r">Цех в день</th><th class="r">Опт. цена</th></tr>`;
      for (const r in RECIPES) {
        const R = RECIPES[r];
        h += `<tr><td>${gn(r)}</td><td>${producers(r).join(', ')}</td><td>${Object.entries(R.inputs).map(([g, k]) => `<span title="${GOODS[g].name}">${qty(k)} ${unitOf(g)} ${GOODS[g].icon}</span>`).join(' + ') || '—'}</td>
          <td class="r">${qu(R.rate, r)}</td><td class="r">${fmt(GOODS[r].price)}/${unitOf(r)}</td></tr>`;
      }
      h += '</table><h3>Стройматериалы на один этаж</h3><table class="grid">';
      for (const t in BUILDINGS) h += `<tr><td><span class="nm">${bTile(t, 'sm')}${BUILDINGS[t].name}</span></td><td>${Object.entries(BUILDINGS[t].materials).map(([g, n]) => `${qty(n)} ${unitOf(g)} ${GOODS[g].icon}`).join(' · ')}</td></tr>`;
      return h + '</table>';
    }
    h += `<p class="hint">Цены — оптовые, в рублях за единицу. Склады города продают на ${Math.round((BUY_RATE - 1) * 100)}% дороже опта и покупают по ${Math.round(SELL_RATE * 100)}% опта
      (с поправкой на качество). Запасы ограничены, при дефиците цены растут. Конкуренты продают по своим ценам и с разным качеством — выбирайте поставщика в снабжении предприятия.</p>`;
    const kinds = { raw: 'Сырьё', mid: 'Полуфабрикаты', build: 'Стройматериалы', equip: 'Оборудование и техника', retail: 'Потребительские товары' };
    for (const k in kinds) {
      h += `<h3>${kinds[k]}</h3><table class="grid"><tr><th>Товар</th><th class="r">На складах</th><th class="r">Опт. цена</th><th class="r">Изм.</th><th class="r">Купить</th><th class="r">Продать</th>
        ${k === 'retail' ? '<th class="r">В рознице</th>' : ''}<th class="r">Продавцов</th></tr>`;
      for (const g in GOODS) {
        if (GOODS[g].kind !== k) continue;
        const ch = (s.prices[g] / GOODS[g].price - 1) * 100;
        const low = s.depot[g] < P.depotStart(g) * 0.25;
        h += `<tr><td>${gn(g)} <span class="hint">${unitOf(g)}</span></td><td class="r ${low ? 'neg' : ''}">${qty(s.depot[g])}</td><td class="r">${fmt(s.prices[g])}</td>
          <td class="r ${ch >= 0 ? 'pos' : 'neg'}">${ch >= 0 ? '+' : ''}${ch.toFixed(0)}%</td><td class="r">${fmt(P.buyPrice(s, g))}</td><td class="r">${fmt(P.sellPrice(s, g))}</td>
          ${k === 'retail' ? `<td class="r">${fmt(P.retailRef(s, g))}</td>` : ''}<td class="r">${P.offers(s, g).filter(o => !o.own).length}</td></tr>`;
      }
      h += '</table>';
    }
    return h;
  }

  // График как в Бизмании: заливка — активы, зелёная линия — выручка, столбики — прибыль/убыток за день
  drawChart() {
    const c = $('#chart'); if (!c) return;
    const s = this.s, dpr = devicePixelRatio || 1;
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const W = c.clientWidth, H = c.clientHeight, h = s.history.slice(-60);
    if (h.length < 2) { x.fillStyle = '#6b7280'; x.font = '12px system-ui'; x.fillText('График появится через пару дней', 10, 20); return; }
    const X = n => 4 + (n / (h.length - 1)) * (W - 8);
    const hiW = Math.max(...h.map(p => p.worth), 1), base = H - 18;
    const Yw = v => base - (Math.max(0, v) / hiW) * (H - 30);
    const grad = x.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#6d6ee8'); grad.addColorStop(1, '#b9bdf3');
    x.fillStyle = grad; x.beginPath(); x.moveTo(X(0), base);
    h.forEach((p, n) => x.lineTo(X(n), Yw(p.worth)));
    x.lineTo(X(h.length - 1), base); x.closePath(); x.fill();
    const hiI = Math.max(...h.map(p => Math.max(p.income, p.expense)), 1);
    const Yi = v => base - (v / hiI) * (H - 40) * 0.6;
    x.fillStyle = 'rgba(220,38,38,.75)';
    h.forEach((p, n) => { const pr = p.income - p.expense; if (pr < 0) x.fillRect(X(n) - 1.5, base, 3, Math.min(16, (-pr / hiI) * 30)); });
    x.strokeStyle = '#4ade80'; x.lineWidth = 2; x.beginPath();
    h.forEach((p, n) => (n ? x.lineTo(X(n), Yi(p.income)) : x.moveTo(X(n), Yi(p.income))));
    x.stroke();
    x.fillStyle = '#4ade80';
    h.forEach((p, n) => { x.beginPath(); x.arc(X(n), Yi(p.income), 1.8, 0, 7); x.fill(); });
    x.fillStyle = '#374151'; x.font = '11px system-ui';
    x.fillText(fmtShort(hiW), 6, 12);
  }

  win_rating(s) {
    return `<table class="grid"><tr><th>#</th><th>Компания</th><th class="r">Зданий</th><th class="r">Капитал</th></tr>
      ${G.rating(s).map((r, n) => `<tr class="${r.player ? 'me' : ''}"><td>${n + 1}</td><td><span class="dot" style="background:${r.color}"></span>${esc(r.name)}</td><td class="r">${r.count}</td><td class="r">${fmt(r.worth)}</td></tr>`).join('')}</table>
      <p class="hint">Конкуренты тоже заказывают стройки — город постепенно застраивается. Обгоните всех!</p>`;
  }

  win_quests(s) {
    return G.QUESTS.map(q => `<div class="quest ${s.quests[q.id] ? 'done' : ''}"><span class="ic">${ic(s.quests[q.id] ? 'checkCircle' : 'circle')}</span>
      <span>${esc(q.text)}</span><span class="rw">+${fmt(q.reward)}</span></div>`).join('');
  }

  win_bank(s) {
    const max = G.maxLoan(s);
    return `<div class="kv"><span>Текущий долг</span><span>${fmt(s.loan)}</span><span>Проценты</span><span>0,1% в день (${fmt(s.loan * 0.001)}/день)</span>
      <span>Можно взять ещё</span><span>${fmt(max)}</span></div>
      <div class="row"><input type="number" id="loanAmt" min="1000" step="1000" value="${Math.max(1000, Math.min(50000, max || 50000))}" style="width:140px"> ₽
      <button class="btn primary" data-act="loan" ${max <= 0 ? 'disabled' : ''}>Взять</button>
      <button class="btn" data-act="repay" ${s.loan <= 0 ? 'disabled' : ''}>Погасить</button></div>
      <p class="hint">Банк даёт до половины капитала. Если деньги на счету 15 дней подряд в минусе — банкротство.</p>`;
  }

  win_help() {
    return `<div class="help">
      <h3>Цель</h3><p>Застроить пустой город, построить производственную империю и обогнать конкурентов в рейтинге.</p>
      <h3>Управление</h3><p>Разделы — в меню вверху: город (карта, стройки, здания), компания, предприятия (и специалисты), рынок (товары, цепочки, биржа), финансы (и отчёты), рейтинг; справа — задания, справка и настройки. На карте: левая кнопка мыши — двигать, правая — вращать, колесо — масштаб; на телефоне — один палец двигает, два — масштаб и поворот. Пробел — пауза, кнопки внизу справа — ускорить время.</p><h3>Время</h3><p>Игровой день длится минуту (настраивается на сервере). До нового дня — в шапке. Каждый день начисляются аренда, зарплаты, идут стройки и производство.</p><h3>Опыт и уровень предприятия</h3><p>Каждое предприятие копит опыт за производство, продажи, поставки, исследования и стройку. Звезда — уровень предприятия (до 100), «+N» — свободные уровни. Новое подразделение или улучшение подразделения требует свободного уровня (и денег на оборудование).</p><h3>Квалификация и оборудование</h3><p>У подразделения есть оборудование качества 1–10: лучше оборудование — больше выпуск и выше качество, но оно требует квалификации персонала (качество × 1,2). Квалификация = городская + обучение (до +4). Не хватает квалификации — эффективность падает. Оборудование считается в штуках (линии, тракторы, краны…): нехватка снижает выпуск, кнопка «Докупить» дозаполнит. Износ растёт только в работе; ремонт бесплатный, но часть единиц списывается. Выключенный цех платит 25% зарплаты.</p><h3>Уровень компании</h3><p>Компания копит опыт: 35% опыта своих предприятий и доход от зданий. Уровень (до 100) открывает новые виды предприятий (список ближайших — в профиле компании), специалистов (с 5-го), авторегулирование снабжения (с 7-го, у предприятия от 8-го уровня). За новые уровни — денежный бонус.</p>
      <h3>Налоги</h3><p>Раз в неделю — налог 25% с прибыли каждого предприятия и здания отдельно; убытки прошлых недель уменьшают налог. Финансовый отдел штаб-квартиры ограничивает деньги на счёте: с излишка списывается штраф 10% в неделю. Шахтёрский отдел ограничивает число видов добычи.</p>
      <h3>Охват магазина</h3><p>Покупатели — жители и офисные работники в радиусе магазина (3 клетки, до 4,5 с известностью). Арендаторы того же профиля и ваши точки рядом — конкуренты. Ассортимент растёт с уровнем торгового отдела. На карте города включите флажок «Магазины», чтобы увидеть охват.</p>
      <h3>Реклама и цены</h3><p>Магазины, рестораны и салоны покупают рекламу (40–100%) — растёт известность и число покупателей. Кнопка «Рекомендованные цены» выставит цены с учётом качества. Дороже 2,5× средней цены по городу товар не покупают.</p><h3>Штаб-квартира и специалисты</h3><p>Отделы штаб-квартиры ограничивают число рабочих, предприятий, продуктов и строек — повышайте их уровень. Специалисты с биржи ускоряют предприятие своей профессии и повышают качество.</p>
      <h3>Здания в городе</h3><p>Кликните по пустому участку и закажите стройку. Три типа зданий:<br>
      <b>офисные</b> — офисы сдаются компаниям;<br><b>жилые</b> — квартиры для горожан, на первом этаже — коммерческие помещения (магазины, кафе);<br>
      <b>социальные</b> — больница, полиция и школа: город платит за содержание, а дома вокруг становятся привлекательнее. Уровень города (до 5) растёт с числом социальных зданий: каждые 2 полиции+больницы+школы дают +1 и повышают спрос.</p>
      <h3>Участки и площади</h3><p>Участки бывают малые, средние и крупные: на крупном здание шире — больше квартир, офисов и торговых площадей, но стройка дороже.
      Коммерческие площади (первые этажи жилых домов, ЖК с галереей, торговые центры) сдаются за м². Отдел магазина или ресторана занимает 60 м² на 1-м уровне
      и до 720 м² на 7-м (это максимум) — выбирайте помещение с запасом. Число отделов не ограничено.</p>
      <h3>Кто строит</h3><p>Строительная компания-подрядчик: дороже или дешевле, быстрее или медленнее, с разным качеством.
      Или <b>своими силами</b>: создайте «Строительную компанию» в меню «Предприятия», закупите стройматериалы на складах или производите их сами — тогда здание обойдётся намного дешевле.</p>
      <h3>Производство и цепочки</h3><p>Фермы, шахты, заводы, склады и лаборатории — виртуальные предприятия, они не занимают места в городе. Цепочки как в жизни:
      нефть → химзавод → солярка, удобрения, взрывчатка, пластик, резина; удобрения и солярка → поле → зерно, свёкла, сено; зерно → пищевой завод → мука, комбикорм;
      сено, комбикорм и ветпрепараты → коровник, курятник, свинарник → молоко, яйца, мясо; руда и уголь → металлургия → сталь → машиностроение → двигатели, станки, тракторы, горное оборудование.</p>
      <h3>Снабжение и поставщики</h3><p>На вкладке «Снабжение» предприятия для каждого товара выберите поставщика и объём в день: склады города, компании-конкуренты
      (у каждой своя цена и качество) или ваше собственное предприятие — тогда товар идёт по себестоимости, плюс 1% за доставку. Отгрузку можно настроить и со стороны поставщика — на вкладке «Сбыт».</p>
      <h3>Биржа предприятий</h3><p>Конкуренты продают свои предприятия — с подразделениями, уровнем и оборудованием. Свои предприятия можно продать по лучшей ставке
      конкурента или выставить по своей цене: если она не выше оценки больше чем на 20%, покупатель найдётся за несколько дней.</p>
      <h3>Оборудование</h3><p>Линии, тракторы, горное оборудование, краны, холодильники — это товары. Их покупают у поставщиков (или делают на своём машиностроительном и электронном заводе)
      на вкладке «Подразделения». Качество оборудования = качество купленного товара.</p>
      <h3>Цены</h3><p>Цены реальные, в рублях: хлеб ~35 ₽ оптом и ~50 ₽ в магазине, молоко 35 ₽/л, сталь 60 000 ₽/т, автомобиль 1,2 млн ₽, зарплата рабочего 2 500 ₽ в день.
      Здания, земля и оборудование для темпа игры дешевле реальных: вложения окупаются за 1–3 игровых месяца.</p>
      <h3>Универсальные склады</h3><p>В начале игры в городе есть склады с запасами всех товаров. Запасы ограничены и пополняются медленно, при дефиците цены растут — со временем выгоднее производить самому.</p>
      <h3>Деньги</h3><p>Аренда идёт каждый день. Платятся содержание зданий, зарплаты и налог на землю. Нужны деньги — банк даст кредит. Начать заново — кнопка «Сброс».</p></div>`;
  }
}
