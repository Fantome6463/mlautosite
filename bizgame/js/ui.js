// Интерфейс: панели участков, зданий и предприятий, окна, новости, значки над зданиями.
import {
  GOODS, RECIPES, ENTERPRISES, BUILDINGS, UNITS, CATEGORIES, CONTRACTORS, OWN, contractorInfo, RIVALS,
  NPC_QUALITY, IMPORT_MARKUP, WHOLESALE_RATE, SHOP_UNITS_PER_WORKER, TRANSPORT_PER_UNIT, ADVANCE,
  HQ, HQ_MAX, hqLimit, hqUpgradeCost, specSalary,
} from './data.js';
import * as G from './game.js';
import * as P from './production.js';
import { CATS } from './ledger.js';

const $ = s => document.querySelector(s);
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = G.fmt;
const num = v => Math.round(v).toLocaleString('ru-RU');
const pct = v => Math.round(v * 100) + '%';
const qBadge = q => {
  const c = q < 3 ? '#f43f5e' : q < 5 ? '#f59e0b' : q < 7 ? '#22c55e' : '#a855f7';
  return `<span class="q" style="background:${c}33;color:${c}">${q.toFixed(1)}</span>`;
};
const stars = q => '★'.repeat(q) + '☆'.repeat(5 - q);
const goodName = g => `${GOODS[g].icon} ${GOODS[g].name}`;
const entName = e => `${ENTERPRISES[e.type].icon} ${esc(e.name)}`;
const bTitle = b => `${BUILDINGS[b.type].icon} ${BUILDINGS[b.type].name} №${b.id}`;
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
  const g = { 'Сельскохозяйственная продукция': ['grain', 'milk', 'cotton'], 'Полезные ископаемые': ['wood', 'ore', 'oil', 'stone', 'sand'],
    'Материалы': ['flour', 'lumber', 'steel', 'fabric', 'plastic', 'cement'], 'Строительные материалы': ['concrete', 'bricks', 'glass'],
    'Продукты питания': ['bread', 'cheese'], 'Товары народного потребления': ['furniture', 'clothes', 'appliances', 'toys'] };
  return g;
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
    document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); this.openPage(b.dataset.page, b.dataset.tab); }));
  }

  get s() { return this.app.state; }

  toast(text, err = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = text;
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
    $('#worth').textContent = fmtShort(G.netWorth(s));
    $('#pop').textContent = num(s.city.population || 0);
    $('#hdrCompany').textContent = s.company;
    $('#date').textContent = gameDate(s.day);
    const sec = Math.ceil(msLeft / 1000);
    $('#dayLeft').textContent = speed ? `${Math.floor(sec / 60)} мин. ${sec % 60} сек.${speed > 1 ? ` (×${speed})` : ''}` : 'пауза';
    $('#questDot').classList.toggle('on', G.QUESTS.some(q => !s.quests[q.id]) && this.page !== 'quests');
    const n = s.news[0];
    if (n && n !== this.lastNews) {
      this.lastNews = n;
      $('#news').innerHTML = `<div class="item"><span class="d">День ${n.day}</span>${esc(n.text)}</div>`;
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
      if (b.state === 'build') { bad = b.paused; html = `${b.paused ? '⛔' : '🏗️'} ${pct(b.progress / b.buildDays)}`; }
      else if (b.owner === 'player') html = `${BUILDINGS[b.type].icon}${BUILDINGS[b.type].category === 'social' ? '' : ' ' + pct(G.occRate(b))}`;
      else html = '';
      if (shopHosts.has(b.id)) html += ' 🏬';
      if (el._h !== html) { el.innerHTML = html.trim(); el._h = html; }
      el.className = 'badge' + (bad ? ' bad' : '');
      el.style.display = '';
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    });
  }

  entProblem(e) {
    const s = this.s;
    if (e.target === 0) return 'Нет сотрудников';
    if (e.salary < s.marketSalary * 0.7) return 'Низкая зарплата — люди увольняются';
    if (e.type === 'shop' && !Object.keys(e.stock).some(g => GOODS[g].kind === 'retail')) return 'Нечего продавать — настройте поставку или закупку';
    if (e.type === 'lab' && !e.research) return 'Не выбрано исследование';
    if (e.type === 'construction' && !Object.values(s.buildings).some(b => b.builder === e.id && b.state === 'build')) return 'Нет строек — закажите здание «своими силами»';
    if (ENTERPRISES[e.type].storage && P.freeSpace(e) <= 0) return 'Склад переполнен';
    const info = P.productionInfo(s, e);
    if (info && info.limitBy && (e.last.produced[e.recipe] || 0) < info.maxOut * 0.3 && s.day > e.built + 1) return `Не хватает сырья: ${GOODS[info.limitBy].name}`;
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
    if (this.sel?.kind !== 'ent' || this.sel.id !== id) this.tab = 'main';
    this.sel = { kind: 'ent', id };
    $('#side').hidden = false;
    this.renderSide(true);
  }

  renderSide(force = false) {
    if (!this.sel) return;
    const side = $('#side');
    if (!force && side.contains(document.activeElement) && document.activeElement.matches('input,select')) return;
    const top = side.scrollTop;
    const s = this.s;
    let html = '<button class="x" data-act="close">✕</button>';
    if (this.sel.kind === 'ent') {
      const e = s.enterprises[this.sel.id];
      if (!e) { this.app.select(null); return; }
      html += this.entHtml(e);
    } else {
      const { i, j } = this.sel;
      const b = G.buildingAt(s, i, j);
      if (!b) html += this.orderHtml(s.plots[G.key(i, j)]);
      else if (b.state === 'build') html += this.siteHtml(b);
      else if (b.owner === 'player') html += this.myBuildingHtml(b);
      else html += this.rivalBuildingHtml(b);
    }
    side.innerHTML = html;
    side.scrollTop = top;
  }

  coverageHtml(i, j) {
    const c = G.coverage(this.s, i, j);
    return `<span>Больница рядом</span><span>${c.health ? '✅ да' : '— нет'}</span><span>Полиция рядом</span><span>${c.safety ? '✅ да' : '— нет'}</span>`;
  }

  // ---------- заказ стройки ----------
  orderHtml(p) {
    const s = this.s, f = this.form;
    if (!BUILDINGS[f.type].floors.includes(f.floors)) f.floors = BUILDINGS[f.type].floors[0];
    const locWord = p.loc >= 1.4 ? 'отличный' : p.loc >= 1.05 ? 'хороший' : p.loc >= 0.8 ? 'средний' : 'окраина';
    let h = `<h2>🪧 Свободный участок</h2><div class="sub">Участок ${p.i}:${p.j}</div>
      <div class="kv"><span>Цена земли</span><span>${fmt(p.price)}</span><span>Район</span><span>${p.loc.toFixed(2)} — ${locWord}</span>${this.coverageHtml(p.i, p.j)}</div>
      <p class="hint">В центре дороже земля, но выше аренда и больше покупателей. Больница и полиция рядом делают дом привлекательнее.</p>
      <div class="box"><h4>1. Что строим</h4>`;
    for (const cat in CATEGORIES) {
      const types = Object.keys(BUILDINGS).filter(t => BUILDINGS[t].category === cat);
      h += `<div class="cat"><b>${CATEGORIES[cat].name}</b><small>${CATEGORIES[cat].desc}</small><div class="chips">
        ${types.map(t => `<button class="chip ${f.type === t ? 'on' : ''}" data-act="ftype" data-v="${t}">${BUILDINGS[t].icon} ${BUILDINGS[t].name}</button>`).join('')}</div></div>`;
    }
    const d = BUILDINGS[f.type];
    h += `</div>`;
    if (d.floors.length > 1) {
      h += `<div class="box"><h4>2. Этажность</h4><div class="chips">${d.floors.map(n => `<button class="chip ${f.floors === n ? 'on' : ''}" data-act="ffloors" data-v="${n}">${n} эт.</button>`).join('')}</div>
        <div class="kv">${Object.entries(d.units(f.floors)).map(([t, n]) => `<span>${UNITS[t].icon} ${UNITS[t].name}</span><span>${n} шт. по ~${Math.round(G.refRent(p, t))} ₽/день</span>`).join('')}</div></div>`;
    } else {
      h += `<div class="box"><h4>2. Как работает</h4><div class="kv"><span>Город платит</span><span>${fmt(d.subsidy)}/день</span><span>Содержание</span><span>${fmt(d.upkeep)}/день</span>
        <span>Радиус</span><span>${d.radius} участка</span></div><p class="hint">Дома в радиусе охотнее снимают и платят за аренду больше. Город растёт быстрее.</p></div>`;
    }
    h += `<div class="box"><h4>3. Кто строит</h4>`;
    for (const c of [...Object.keys(CONTRACTORS), 'own']) {
      const info = contractorInfo(c), q = G.quote(s, f.type, f.floors, c);
      let extra = '';
      if (c === 'own') {
        const co = G.builders(s)[0];
        extra = co
          ? `<div class="mats">${Object.entries(q.materials).map(([g, n]) => { const have = P.stockQty(co, g); return `<span class="${have >= n ? 'pos' : 'warn'}">${goodName(g)} ${num(have)}/${num(n)}</span>`; }).join('')}</div>
             <small>Материалы берутся со склада «${esc(co.name)}» по ходу стройки. Не хватит — стройка встанет.</small>`
          : `<small class="warn">Нужна своя строительная компания — создайте её в меню «Предприятия».</small>`;
      }
      h += `<label class="contractor ${f.contractor === c ? 'on' : ''}"><input type="radio" name="contractor" data-act="fcontr" value="${c}" ${f.contractor === c ? 'checked' : ''}>
        <div><b style="color:${info.color}">${info.name}</b> <span class="stars">${stars(q.quality)}</span><small>${info.desc}</small>${extra}</div>
        <div class="r"><b>${c === 'own' ? '~' : ''}${fmt(q.cost)}</b><small>${q.days} дн.</small></div></label>`;
    }
    const q = G.quote(s, f.type, f.floors, f.contractor);
    const now = p.price + (q.own ? 0 : Math.round(q.cost * ADVANCE));
    const err = G.orderCheck(s, f.type, f.floors, f.contractor, p.i, p.j);
    h += `</div><div class="kv"><span>Земля</span><span>${fmt(p.price)}</span>
      <span>${q.own ? 'Материалы (по ходу стройки)' : `Аванс ${ADVANCE * 100}% сейчас`}</span><span>${fmt(q.own ? q.cost : q.cost * ADVANCE)}</span>
      ${q.own ? '' : `<span>Остальное — по ходу стройки</span><span>${fmt(q.cost * (1 - ADVANCE))}</span>`}
      <span><b>Платите сейчас</b></span><span><b>${fmt(now)}</b></span></div>
      ${err ? `<div class="warn">${esc(err)}</div>` : ''}
      <div class="actions"><button class="btn primary" data-act="order" ${err ? 'disabled' : ''}>🏗️ Заказать строительство</button></div>`;
    return h;
  }

  siteHtml(b) {
    const s = this.s, c = contractorInfo(b.contractor), mine = b.owner === 'player';
    const left = Math.max(0, b.buildDays - b.progress);
    let h = `<h2>🏗️ Стройка</h2><div class="sub">${bTitle(b)} · ${b.floors} эт. · участок ${b.i}:${b.j}</div>
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
      h += `<div class="warn">⛔ Стройка стоит: ${why}</div>`;
    } else if (b.delayed) h += '<div class="warn">Сегодня простой у подрядчика</div>';
    if (b.contractor === 'own') {
      const co = s.enterprises[b.builder];
      h += `<div class="box"><h4>Материалы (нужно всего / на складе компании)</h4><div class="kv">
        ${Object.entries(b.materials).map(([g, n]) => `<span>${goodName(g)}</span><span>${num(n)} / ${co ? num(P.stockQty(co, g)) : 0}</span>`).join('')}</div>
        ${co ? `<button class="btn small" data-act="openent" data-id="${co.id}">👷 Открыть «${esc(co.name)}»</button>` : ''}</div>`;
    }
    h += `<div class="actions"><button class="btn danger" data-act="cancel">Отменить стройку (вернут ${fmt(b.land * 0.8 + (b.contractor === 'own' ? 0 : b.paid * 0.3))})</button></div>`;
    return h;
  }

  unitsTable(b, editable) {
    const s = this.s, p = s.plots[G.key(b.i, b.j)];
    let h = `<table><tr><th>Помещения</th><th class="r">Занято</th><th>Аренда, ₽/день</th><th class="r">Рынок</th></tr>`;
    for (const t in b.units) {
      const u = b.units[t];
      const shops = t === 'comm' ? P.shopsIn(s, b).length : 0;
      h += `<tr><td>${UNITS[t].icon} ${UNITS[t].name}</td><td class="r">${u.occ + shops}/${u.total}</td>
        <td>${editable ? `<input type="number" min="1" value="${u.rent}" data-act="rent" data-t="${t}" style="width:80px">` : u.rent}</td>
        <td class="r">${Math.round(G.refRent(p, t))}</td></tr>`;
    }
    return h + '</table>';
  }

  myBuildingHtml(b) {
    const s = this.s, d = BUILDINGS[b.type];
    const tabs = [['main', 'Обзор']];
    if (Object.keys(b.units).length) tabs.push(['tenants', 'Арендаторы']);
    if (!tabs.some(t => t[0] === this.tab)) this.tab = 'main';
    let h = `<h2>${d.icon} ${d.name}</h2><div class="sub">№${b.id} · ${b.floors} эт. · участок ${b.i}:${b.j} · построил ${contractorInfo(b.contractor).name}</div>
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
    if (b.units.apt) h += `<div class="box"><h4>🏠 Квартиры</h4>Живёт семей: <b>${b.units.apt.occ}</b> из ${b.units.apt.total} (≈${Math.round(b.units.apt.occ * 2.4)} чел.)</div>`;
    for (const t of ['comm', 'office']) {
      if (!b.units[t]) continue;
      const names = b.tenants[t] || [];
      h += `<div class="box"><h4>${UNITS[t].icon} ${UNITS[t].name}</h4>
        ${t === 'comm' ? shops.map(e => `<div class="row">🏬 <a href="#" data-act="openent" data-id="${e.id}">${esc(e.name)}</a> <span class="hint">${e.host && s.buildings[e.host].owner === 'player' ? 'ваш, без аренды' : 'ваш'}</span></div>`).join('') : ''}
        ${names.length ? names.map(n => `<div class="row">${esc(n)}</div>`).join('') : (t === 'comm' && shops.length ? '' : '<span class="hint">Пусто</span>')}</div>`;
    }
    h += this.openShopHtml(b);
    return h;
  }

  openShopHtml(b) {
    const s = this.s;
    if (!b.units.comm || P.shopSlots(s, b) <= 0) return '';
    const own = b.owner === 'player';
    const free = b.units.comm.total - b.units.comm.occ - P.shopsIn(s, b).length;
    return `<div class="box"><h4>Свой магазин здесь</h4>
      <p class="hint">${own ? (free > 0 ? 'Есть свободное помещение — аренду платить не нужно.' : 'Свободных помещений нет: один арендатор съедет.') : `Аренда ${fmt(b.units.comm.rent)}/день владельцу дома.`}
      Открытие: ${fmt(ENTERPRISES.shop.cost)}.</p>
      <button class="btn primary" data-act="openshop" ${s.money < ENTERPRISES.shop.cost ? 'disabled' : ''}>🏬 Открыть магазин</button></div>`;
  }

  rivalBuildingHtml(b) {
    const s = this.s, d = BUILDINGS[b.type];
    let h = `<h2>${d.icon} ${d.name}</h2><div class="sub">№${b.id} · ${b.floors} эт. · участок ${b.i}:${b.j}</div>
      <div class="kv"><span>Владелец</span><span style="color:${ownerColor(b)}">${ownerName(s, b)}</span><span>Заполненность</span><span>${pct(G.occRate(b))}</span>${this.coverageHtml(b.i, b.j)}</div>`;
    if (Object.keys(b.units).length) h += this.unitsTable(b, false);
    return h + this.openShopHtml(b);
  }

  // ---------- предприятие ----------
  entHtml(e) {
    const s = this.s, d = ENTERPRISES[e.type];
    const tabs = [['main', 'Обзор']];
    if (d.storage) tabs.push(['stock', 'Склад']);
    if (e.type === 'shop') tabs.push(['prices', 'Цены']);
    if (e.type === 'lab') tabs.push(['lab', 'Исследования']);
    else tabs.push(['supply', 'Поставки']);
    if (e.type === 'construction') tabs.push(['sites', 'Стройки']);
    if (!tabs.some(t => t[0] === this.tab)) this.tab = 'main';
    const host = e.host && s.buildings[e.host];
    let h = `<h2>${d.icon} ${esc(e.name)} <span class="lvl">ур. ${e.level}</span></h2>
      <div class="sub">${d.name}${host ? ` · в доме №${host.id} (участок ${host.i}:${host.j})` : ' · виртуальное предприятие'} · с ${e.built}-го дня</div>
      <div class="tabs">${tabs.map(([k, n]) => `<button data-act="tab" data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const prob = this.entProblem(e);
    if (prob) h += `<div class="warn">⚠️ ${esc(prob)}</div>`;
    return h + this[`et_${this.tab}`](e);
  }

  et_main(e) {
    const s = this.s, d = ENTERPRISES[e.type];
    const max = P.maxWorkers(e), eff = P.salaryEff(s, e), profit = e.last.revenue - e.last.expense;
    let h = `<div class="box"><h4>Вчера</h4><div class="kv"><span>Выручка</span><span class="pos">${fmt(e.last.revenue)}</span>
      <span>Расходы</span><span class="neg">${fmt(e.last.expense)}</span><span>Прибыль</span><span class="${profit >= 0 ? 'pos' : 'neg'}">${fmt(profit)}</span></div></div>`;
    const recipes = Object.keys(RECIPES).filter(r => RECIPES[r].ent === e.type);
    if (recipes.length) {
      const r = RECIPES[e.recipe], info = P.productionInfo(s, e);
      const inputs = Object.entries(r.inputs).map(([g, k]) => `${k} × ${goodName(g)} (есть ${num(P.stockQty(e, g))})`).join('<br>') || 'не нужно';
      h += `<div class="box"><h4>Производство</h4>
        <div class="row"><select data-act="recipe">${recipes.map(x => `<option value="${x}" ${x === e.recipe ? 'selected' : ''}>${goodName(x)} — ${fmt(s.prices[x])}</option>`).join('')}</select></div>
        <div class="kv"><span>Сырьё на 1 шт.</span><span>${inputs}</span><span>Мощность</span><span>${num(info.maxOut)} шт./день</span>
        <span>Выпущено вчера</span><span>${num(e.last.produced[e.recipe] || 0)} шт.</span>
        <span>Технология</span><span>ур. ${s.tech[e.recipe]} → качество ${qBadge(P.techQuality(s, e.recipe))}</span></div></div>`;
    }
    if (e.type === 'construction') {
      const crew = (e.workers / max) * eff * (1 + 0.5 * (e.level - 1));
      h += `<div class="box"><h4>Бригада</h4><div class="kv"><span>Скорость</span><span>${crew.toFixed(2)} дня стройки за день</span></div>
        <p class="hint">Закупайте стройматериалы на вкладке «Склад» или везите со своих заводов. Несколько строек делят бригаду.</p></div>`;
    }
    h += `<div class="box"><h4>Персонал</h4>
      <div class="row"><label>Штат</label><input type="range" min="0" max="${max}" value="${e.target}" data-act="target"><b>${e.workers}/${e.target}</b></div>
      <div class="row"><label>Зарплата</label><input type="number" min="1" value="${e.salary}" data-act="salary"> ₽/день <span class="hint">средняя ${s.marketSalary}</span></div>
      <div class="kv"><span>Эффективность</span><span>${pct(eff)}</span><span>Фонд оплаты</span><span>${fmt(e.workers * e.salary)}/день</span>
      <span>Содержание</span><span>${fmt(d.upkeep * e.level)}/день</span>
      ${e.type === 'shop' && P.hostRent(s, e) ? `<span>Аренда помещения</span><span>${fmt(P.hostRent(s, e))}/день</span>` : ''}
      ${d.storage ? `<span>Склад</span><span>${num(P.stockTotal(e))} / ${num(P.capacity(e))}</span>` : ''}</div></div>
      <div class="row"><label>Название</label><input type="text" value="${esc(e.name)}" data-act="ename" maxlength="40" style="flex:1"></div>
      <div class="actions">
        ${e.level < 3 ? `<button class="btn primary" data-act="eupgrade" ${s.money < P.upgradeCost(e) ? 'disabled' : ''}>⬆ Расширить (${fmt(P.upgradeCost(e))})</button>` : ''}
        ${e.host ? `<button class="btn" data-act="gohost">📍 Показать дом</button>` : ''}
        <button class="btn danger" data-act="eclose">Закрыть (${fmt(e.invested * 0.4)})</button></div>`;
    return h;
  }

  et_stock(e) {
    const s = this.s;
    const goods = Object.keys(e.stock);
    let h = `<div class="kv"><span>Заполнено</span><span>${num(P.stockTotal(e))} / ${num(P.capacity(e))}</span></div>
      <div class="bar"><i style="width:${Math.min(100, (P.stockTotal(e) / P.capacity(e)) * 100)}%"></i></div>`;
    if (!goods.length) h += '<p class="hint">Склад пуст.</p>';
    else {
      h += `<table><tr><th>Товар</th><th class="r">Кол-во</th><th>Кач.</th><th class="r">Опт</th><th></th></tr>`;
      for (const g of goods) {
        const st = e.stock[g];
        h += `<tr><td>${goodName(g)}</td><td class="r">${num(st.qty)}</td><td>${qBadge(st.q)}</td><td class="r">${P.sellPrice(s, g, st.q)}</td>
          <td><button class="btn small" data-act="sell" data-good="${g}">Продать</button></td></tr>`;
      }
      h += '</table>';
    }
    if (e.type !== 'shop') {
      const sellable = new Set([...goods, ...(e.recipe && RECIPES[e.recipe].ent === e.type ? [e.recipe] : [])]);
      h += `<div class="box"><h4>Автопродажа на склады города</h4>
        ${[...sellable].map(g => `<label class="row"><input type="checkbox" data-act="autosell" data-good="${g}" ${e.autoSell[g] ? 'checked' : ''}> ${goodName(g)} — продавать всё в конце дня</label>`).join('') || '<span class="hint">Нечего продавать</span>'}</div>`;
    }
    const allowed = g => (e.type === 'shop' ? GOODS[g].kind === 'retail' : e.type === 'construction' ? ['build', 'mid'].includes(GOODS[g].kind) : true);
    h += `<div class="box"><h4>Закупка на универсальных складах (каждый день)</h4>
      ${Object.keys(e.buy).map(g => `<div class="row">${goodName(g)} <input type="number" min="0" value="${e.buy[g]}" data-act="buyqty" data-good="${g}"> шт. по ${P.buyPrice(s, g)} ₽ <span class="hint">(на складах ${num(s.depot[g])})</span>
        <button class="btn small" data-act="buydel" data-good="${g}">✕</button></div>`).join('')}
      <div class="row"><select id="buyGood">${Object.keys(GOODS).filter(g => !e.buy[g] && allowed(g)).sort((a, b) => (GOODS[b].kind === 'build') - (GOODS[a].kind === 'build')).map(g => `<option value="${g}">${goodName(g)} — ${P.buyPrice(s, g)} ₽, есть ${num(s.depot[g])}</option>`).join('')}</select>
      <input type="number" id="buyQty" min="1" value="100"><button class="btn small primary" data-act="buyadd">Добавить</button></div>
      <p class="hint">Запасы складов ограничены и пополняются медленно; при дефиците цены растут. Качество — 2.0.</p></div>`;
    return h;
  }

  et_supply(e) {
    const s = this.s;
    const out = s.contracts.filter(c => c.from === e.id), inc = s.contracts.filter(c => c.to === e.id);
    const others = Object.values(s.enterprises).filter(x => x.id !== e.id && x.type !== 'lab');
    const goods = [...new Set([...(e.recipe && RECIPES[e.recipe].ent === e.type ? [e.recipe] : []), ...Object.keys(e.stock)])];
    const line = (c, other) => `<div class="row">${goodName(c.good)} · ${num(c.qty)} шт./день ${other}<button class="btn small" data-act="cdel" data-id="${c.id}">✕</button></div>`;
    let h = `<div class="box"><h4>Отправляем</h4>${out.map(c => line(c, `→ ${entName(s.enterprises[c.to])}`)).join('') || '<span class="hint">Нет</span>'}</div>
      <div class="box"><h4>Получаем</h4>${inc.map(c => line(c, `← ${entName(s.enterprises[c.from])}`)).join('') || '<span class="hint">Нет</span>'}</div>`;
    if (!others.length) return h + '<p class="hint">Создайте ещё одно предприятие, чтобы возить товары между ними.</p>';
    if (!goods.length) return h + '<p class="hint">Здесь пока нечего отправлять.</p>';
    const info = P.productionInfo(s, e);
    h += `<div class="box"><h4>Новая поставка</h4>
      <div class="row"><label>Товар</label><select id="cGood">${goods.map(g => `<option value="${g}">${goodName(g)}</option>`).join('')}</select></div>
      <div class="row"><label>Куда</label><select id="cTo">${others.map(x => `<option value="${x.id}">${ENTERPRISES[x.type].icon} ${esc(x.name)}</option>`).join('')}</select></div>
      <div class="row"><label>Сколько</label><input type="number" id="cQty" min="1" value="${info?.maxOut || 100}"> шт./день</div>
      <button class="btn primary" data-act="cadd">Создать поставку</button>
      <p class="hint">Доставка: ${String(TRANSPORT_PER_UNIT).replace('.', ',')} ₽ за единицу. Поставки выполняются каждое утро.</p></div>`;
    return h;
  }

  et_prices(e) {
    const s = this.s, host = s.buildings[e.host];
    const loc = host ? s.plots[G.key(host.i, host.j)].loc : 1;
    let h = `<div class="kv"><span>Район дома</span><span>${loc.toFixed(2)}</span><span>Жителей в городе</span><span>${num(s.city.population || 0)}</span>
      <span>Пропускная способность</span><span>${num(e.workers * SHOP_UNITS_PER_WORKER * P.salaryEff(s, e))} покупок/день</span></div>
      <table><tr><th>Товар</th><th class="r">Есть</th><th>Кач.</th><th class="r">Продано</th><th>Цена</th></tr>`;
    for (const g of Object.keys(GOODS).filter(g => GOODS[g].kind === 'retail')) {
      const st = e.stock[g];
      h += `<tr><td>${goodName(g)}</td><td class="r">${num(st?.qty || 0)}</td><td>${st ? qBadge(st.q) : '—'}</td><td class="r">${num(e.last.sold[g] || 0)}</td>
        <td><input type="number" min="1" value="${e.prices[g] ?? GOODS[g].price}" data-act="price" data-good="${g}" style="width:76px"></td></tr>`;
    }
    return h + `</table><p class="hint">У конкурентов цена ≈ рыночной, качество ${NPC_QUALITY}. Чем больше жителей в городе, тем больше покупателей.</p>`;
  }

  et_lab(e) {
    const s = this.s, cur = e.research;
    let h = `<div class="box"><h4>Текущее исследование</h4>
      <select data-act="research"><option value="">— выберите —</option>${Object.keys(GOODS).map(g => `<option value="${g}" ${g === cur ? 'selected' : ''}>${goodName(g)} (ур. ${s.tech[g]})</option>`).join('')}</select>`;
    if (cur) {
      const need = P.researchCost(s.tech[cur]), speed = e.workers * P.salaryEff(s, e) * e.level;
      h += `<div class="kv"><span>Прогресс</span><span>${num(e.progress)} / ${num(need)}</span><span>Скорость</span><span>${speed.toFixed(1)} очков/день</span>
        <span>Осталось</span><span>${speed > 0 ? Math.ceil((need - e.progress) / speed) + ' дн.' : '∞'}</span></div>
        <div class="bar"><i style="width:${(e.progress / need) * 100}%"></i></div>`;
    }
    return h + `</div><p class="hint">Каждый уровень технологии повышает качество товара на 0,8.</p>
      <table><tr><th>Технология</th><th class="r">Уровень</th></tr>${Object.keys(GOODS).filter(g => s.tech[g] > 0).map(g => `<tr><td>${goodName(g)}</td><td class="r">${s.tech[g]}</td></tr>`).join('') || '<tr><td colspan="2" class="hint">Пока ничего не изучено</td></tr>'}</table>`;
  }

  et_sites(e) {
    const s = this.s;
    const list = Object.values(s.buildings).filter(b => b.builder === e.id);
    if (!list.length) return '<p class="hint">Строек нет. Выберите свободный участок на карте и в пункте «Кто строит» отметьте «Своими силами».</p>';
    return list.map(b => `<div class="box"><div class="row"><a href="#" data-act="goplot" data-i="${b.i}" data-j="${b.j}">${bTitle(b)}</a>
      <span class="hint">${b.state === 'done' ? 'достроен' : pct(b.progress / b.buildDays) + (b.paused ? ' · ⛔ стоит' : '')}</span></div>
      ${b.state === 'build' ? `<div class="bar"><i style="width:${(b.progress / b.buildDays) * 100}%"></i></div>` : ''}</div>`).join('');
  }

  // ---------- действия ----------
  curEnt() { return this.sel?.kind === 'ent' ? this.s.enterprises[this.sel.id] : null; }
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
        if (r?.building) { this.toast('🏗️ Стройка началась!'); this.app.world.floatText(this.sel.i, this.sel.j, '🏗️ Стройка', 'info'); }
        this.renderSide(true); break;
      }
      case 'cancel': if (confirm('Отменить стройку? Деньги за выполненные работы не вернутся.')) { run(() => G.cancelBuild(s, b.id)); this.renderSide(true); } break;
      case 'sellb': if (confirm('Продать здание?')) { run(() => G.sell(s, b.id)); this.renderSide(true); } break;
      case 'openshop': {
        const host = b || G.buildingAt(s, this.sel.i, this.sel.j);
        const r = run(() => P.createEnterprise(s, 'shop', host.id));
        if (r?.enterprise) { this.toast('🏬 Магазин открыт! Настройте поставки или закупку товаров.'); this.app.selectEnt(r.enterprise.id); }
        break;
      }
      case 'openent': ev.preventDefault(); this.closeWin(); this.app.selectEnt(+t.dataset.id); break;
      case 'goplot': ev.preventDefault(); this.closeWin(); this.app.select(+t.dataset.i, +t.dataset.j, true); break;
      case 'gohost': { const h = s.buildings[e.host]; this.app.select(h.i, h.j, true); break; }
      case 'eupgrade': run(() => P.upgradeEnterprise(s, e.id)); this.renderSide(true); break;
      case 'eclose':
        if (confirm('Закрыть предприятие? Вернётся 40% вложений, товары на складе пропадут.')) {
          const v = this.app.act(() => P.closeEnterprise(s, e.id));
          this.toast(`Предприятие закрыто, получено ${fmt(v)}`);
          this.app.select(null);
        }
        break;
      case 'sell': {
        const sum = this.app.act(() => P.sellToMarket(s, e, t.dataset.good, Infinity));
        if (sum) this.toast(`Продано на ${fmt(sum)}`);
        this.renderSide(true); break;
      }
      case 'buyadd': {
        const g = $('#buyGood')?.value, q = +$('#buyQty').value;
        if (g && q > 0) this.app.act(() => { e.buy[g] = q; });
        this.renderSide(true); break;
      }
      case 'buydel': this.app.act(() => { delete e.buy[t.dataset.good]; }); this.renderSide(true); break;
      case 'cadd': {
        const r = run(() => P.addContract(s, e.id, +$('#cTo').value, $('#cGood').value, +$('#cQty').value));
        if (r?.ok) this.toast('🚚 Поставка создана');
        this.renderSide(true); break;
      }
      case 'cdel': this.app.act(() => P.removeContract(s, +t.dataset.id)); this.renderSide(true); this.refreshWin(); break;
      case 'create': {
        const type = t.dataset.type;
        const host = type === 'shop' ? +$('#shopHost')?.value : null;
        const r = run(() => P.createEnterprise(s, type, host));
        if (r?.enterprise) { this.toast(`${ENTERPRISES[type].icon} ${r.enterprise.name} создано`); this.closeWin(); this.app.selectEnt(r.enterprise.id); }
        break;
      }
      case 'wtab': this.winTab = t.dataset.tab; this.renderPage(); break;
      case 'cotab': this.coTab = t.dataset.tab; this.renderPage(); this.markNav(); break;
      case 'tocity': this.showCity(); break;
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
        case 'recipe':
          if (P.canProduce(this.s, e, t.value)) e.recipe = t.value;
          else this.toast(`Производственный отдел: не больше ${hqLimit(this.s, 'prod')} разных продуктов. Повысьте уровень в штаб-квартире.`, true);
          break;
        case 'assign': { const r = P.assignSpec(this.s, +t.dataset.id, +t.value || null); if (r.error) this.toast(r.error, true); break; }
        case 'cover': this.app.world.setCoverage(t.dataset.k, t.checked, this.s); break;
        case 'esalary': { const x = this.s.enterprises[t.dataset.id]; x.salary = Math.max(1, Math.round(+t.value || 1)); break; }
        case 'target': e.target = +t.value; break;
        case 'salary': e.salary = Math.max(1, Math.round(+t.value || 1)); break;
        case 'ename': if (t.value.trim()) e.name = t.value.trim().slice(0, 40); break;
        case 'autosell': e.autoSell[t.dataset.good] = t.checked; break;
        case 'buyqty': e.buy[t.dataset.good] = Math.max(0, +t.value || 0); break;
        case 'price': e.prices[t.dataset.good] = Math.max(1, +t.value || 1); break;
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
  markNav() {
    document.querySelectorAll('#toolbar button').forEach(b => {
      const on = b.dataset.page === this.page && (this.page !== 'company' || b.dataset.tab === this.coTab);
      b.classList.toggle('on', on);
    });
  }

  renderPage() {
    // 3D-карту не пересоздаём: убираем в запас и возвращаем в рамку на вкладке «Карта»
    const view = $('#cityView');
    $('#cityHolder').appendChild(view);
    const fn = this[`page_${this.page}`] || (() => this.titled(this.page));
    $('#pageBody').innerHTML = fn.call(this, this.s);
    const slot = $('#mapSlot');
    this.app.world.paused = !slot;
    if (slot) { slot.appendChild(view); this.app.world.resize(); }
    if (this.page === 'company' && this.coTab === 'main') this.drawChart();
    if (this.page === 'company' && this.coTab === 'reports' && this.rep === 'charts') this.drawReportCharts();
  }
  refreshWin() {
    if (this.page === 'city' && this.cityTab === 'map') return;
    if ($('#page').contains(document.activeElement) && document.activeElement.matches('input,select')) return;
    const top = $('#page').scrollTop;
    this.renderPage();
    $('#page').scrollTop = top;
  }

  titled(name) {
    const t = { market: ['💹', 'Рынок'], contracts: ['🚚', 'Поставки'], rating: ['🏆', 'Рейтинг компаний'], quests: ['📝', 'Задания'], help: ['❔', 'Как играть'] }[name];
    return `<div class="page-title"><span class="big">${t[0]}</span><h1>${t[1]}</h1></div>${this[`win_${name}`](this.s)}`;
  }

  // ---------- страница компании ----------
  page_company(s) {
    const tabs = [['main', 'Компания'], ['ent', 'Предприятия'], ['staff', 'Специалисты'], ['finance', 'Финансы'], ['reports', 'Отчёты']];
    return `<div class="page-title"><span class="big">🏢</span><h1>Компания ${esc(s.company)}</h1>
        <div class="acts"><button class="btn small" data-act="rename">✎ Переименовать</button></div></div>
      <div class="ftabs">${tabs.map(([k, n]) => `<button data-act="cotab" data-tab="${k}" class="${this.coTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${this[`co_${this.coTab}`](s)}`;
  }

  // сумма доходов/расходов за последние n дней
  period(n = 7) {
    const h = this.s.history.slice(-n);
    const sum = (side, cat) => h.reduce((a, d) => a + (cat ? d[side]?.[cat] || 0 : side === 'inc' ? d.income : d.expense), 0);
    return { days: h.length, sum };
  }

  companyLevel() { return Math.max(1, Math.floor(Math.log2(Math.max(1, G.netWorth(this.s)) / 125000)) + 1); }
  efficiency() {
    const s = this.s, ents = Object.values(s.enterprises), blds = Object.values(s.buildings).filter(b => G.isPlayer(b) && b.state === 'done' && Object.keys(b.units).length);
    const vals = [...ents.map(e => Math.min(1, (e.workers / Math.max(1, e.target || 1)) * P.salaryEff(s, e))), ...blds.map(G.occRate)];
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 1;
  }

  co_main(s) {
    const p = this.period(7), rev = p.sum('inc'), exp = p.sum('exp'), profit = rev - exp;
    const salary = Object.values(s.enterprises).reduce((a, e) => a + e.workers * e.salary, 0);
    const supply = p.sum('exp', 'purchase'), assets = G.netWorth(s) + s.loan;
    const blds = Object.values(s.buildings).filter(G.isPlayer), ents = Object.values(s.enterprises);
    const place = G.rating(s).findIndex(r => r.player) + 1;
    const eff = this.efficiency();
    const tiles = [
      ...blds.map(b => `<button class="tile" data-act="goplot" data-i="${b.i}" data-j="${b.j}" title="${bTitle(b)}${b.state === 'build' ? ' — стройка ' + pct(b.progress / b.buildDays) : ''}">
        ${b.state === 'build' ? '🏗️' : BUILDINGS[b.type].icon}<span class="n">${b.floors}</span>${b.state === 'build' && b.paused ? '<span class="w">⛔</span>' : ''}</button>`),
      ...ents.map(e => `<button class="tile" data-act="openent" data-id="${e.id}" title="${esc(e.name)}">${ENTERPRISES[e.type].icon}
        ${e.level > 1 ? `<span class="n">${e.level}</span>` : ''}${this.entProblem(e) ? '<span class="w">⚠️</span>' : ''}</button>`),
    ].join('');
    const hq = Object.keys(HQ).map(k => {
      const l = s.hq[k], used = { staff: P.staffTotal(s), manage: ents.length, prod: P.products(s).size, build: blds.filter(b => b.state === 'build').length }[k];
      return `<div class="dept"><span class="star">${l}</span><div><div class="nm">${HQ[k].name}</div><div class="lim">${HQ[k].label}: ${num(used)} / ${num(hqLimit(s, k))}</div></div>
        ${l < HQ_MAX ? `<button class="btn small" data-act="hq" data-k="${k}" ${s.money < hqUpgradeCost(l) ? 'disabled' : ''} title="Повысить уровень">⬆ ${fmtShort(hqUpgradeCost(l))}</button>` : ''}</div>`;
    }).join('');
    return `<div class="co-grid">
      <div class="statlist">
        <span>Наличные:</span><span>${fmt(s.money)}</span>
        <span>Выручка<small>за ${p.days} дн.</small>:</span><span>${fmt(rev)}</span>
        <span>Расходы:</span><span>${fmt(exp)}</span>
        <span>Прибыль:</span><span class="${profit >= 0 ? 'pos' : 'neg'}">${fmt(profit)}</span>
        <span>Рентабельность:</span><span>${rev ? ((profit / rev) * 100).toFixed(1) : '0.0'}%</span>
      </div>
      <div class="co-center">
        <div class="chart-box"><canvas class="chart" id="chart"></canvas></div>
        <div class="statlist">
          <span>Активы:</span><span><b>${fmt(assets)}</b></span>
          <span>Зарплата персонала:</span><span>${fmt(salary)}/день</span>
          <span>Недельное снабжение:</span><span>${fmt(supply)}</span>
          <span>Кредит:</span><span>${fmt(s.loan)}</span>
        </div>
      </div>
      <div class="profile">Компания видна в рейтинге всем конкурентам
        <div class="ava">🧑‍💼</div>${esc(s.company)}
        <div style="margin-top:6px">Эффективность: <span class="eff"><i style="width:${Math.round(eff * 100)}%"></i></span> ${pct(eff)}</div>
        <div style="margin-top:6px"><span class="star" title="Уровень компании">${this.companyLevel()}</span></div>
      </div>

      <div class="hq"><h2>Штаб-квартира</h2>${hq}
        <p class="hint">Отделы задают лимиты: сколько можно нанять людей, держать предприятий, выпускать разных продуктов и вести строек одновременно.</p></div>
      <div>
        <div class="city-row"><span class="nm">🏙️ ${esc(s.cityName)}</span>
          <span title="Выручка за неделю">💵 ${fmtShort(rev)}</span><span title="Прибыль за неделю">📈 ${fmtShort(profit)}</span><span title="Активы">💰 ${fmtShort(assets)}</span>
          <button class="btn small" data-act="tocity">🌐 В город</button></div>
        <div class="icons">${tiles || '<span class="hint">Пока пусто. Откройте город 🌐 и закажите стройку на свободном участке или создайте предприятие во вкладке «Предприятия».</span>'}</div>
      </div>
      <div class="medals">
        <div class="medal" title="Место в рейтинге">${place}<small>место</small></div>
        <div class="medal v" title="Выполнено заданий">${Object.keys(s.quests).length}<small>заданий</small></div>
        <div class="medal v" title="Зданий">${blds.length}<small>зданий</small></div>
        <div class="medal c" title="Предприятий">${ents.length}<small>предпр.</small></div>
      </div>
    </div>`;
  }

  // ---------- вкладка «Предприятия» (как в Бизмании) ----------
  // Все объекты компании одним списком: здания в городе + виртуальные предприятия
  companyUnits() {
    const s = this.s, rows = [];
    for (const b of Object.values(s.buildings).filter(G.isPlayer)) {
      const w = weekOf(b.hist);
      rows.push({ key: 'b:' + b.type, icon: b.state === 'build' ? '🏗️' : BUILDINGS[b.type].icon, kind: BUILDINGS[b.type].name, name: bTitle(b).replace(/^\S+ /, ''),
        link: `data-act="goplot" data-i="${b.i}" data-j="${b.j}"`, level: b.floors,
        eff: b.state === 'build' ? b.progress / b.buildDays : BUILDINGS[b.type].category === 'social' ? 1 : G.occRate(b),
        products: b.state === 'build' ? `<span class="hint">стройка ${pct(b.progress / b.buildDays)}</span>` : Object.keys(b.units).map(t => `<span title="${UNITS[t].name}">${UNITS[t].icon}</span>`).join('') || '🛡️',
        rev: w.rev, exp: w.exp, assets: b.state === 'done' ? G.marketValue(b) : G.invested(b),
        problem: b.state === 'build' && b.paused ? '⛔ Стройка стоит' : b.state === 'done' && Object.keys(b.units).length && G.occRate(b) < 0.5 ? '% Мало арендаторов — снизьте аренду' : null });
    }
    for (const e of Object.values(s.enterprises)) {
      const w = weekOf(e.hist);
      const goods = e.type === 'shop' ? Object.keys(e.stock).filter(g => GOODS[g].kind === 'retail') : e.type === 'lab' ? (e.research ? [e.research] : [])
        : e.type === 'construction' || e.type === 'warehouse' ? Object.keys(e.stock) : e.recipe ? [e.recipe] : [];
      let stock = 0;
      for (const g in e.stock) stock += e.stock[g].qty * s.prices[g] * 0.6;
      rows.push({ key: 'e:' + e.type, icon: ENTERPRISES[e.type].icon, kind: ENTERPRISES[e.type].name, name: esc(e.name), link: `data-act="openent" data-id="${e.id}"`,
        level: e.level, eff: Math.min(1, (e.workers / Math.max(1, P.maxWorkers(e))) * P.salaryEff(this.s, e) * P.specBonus(this.s, e)),
        products: goods.map(g => `<span title="${GOODS[g].name}">${GOODS[g].icon}</span>`).join(''), rev: w.rev, exp: w.exp,
        assets: Math.round(e.invested * 0.6 + stock), problem: this.entProblem(e), contracts: s.contracts.some(c => c.from === e.id || c.to === e.id) });
    }
    return rows;
  }

  co_ent(s) {
    const rows = this.companyUnits();
    const kinds = [...new Map(rows.map(r => [r.key, r])).values()];
    const list = this.entFilter ? rows.filter(r => r.key === this.entFilter) : rows;
    let h = `<div class="filters"><button class="tile ${!this.entFilter ? 'on' : ''}" data-act="entfilter" data-k="" title="Все">🗂️</button>
      ${kinds.map(r => `<button class="tile ${this.entFilter === r.key ? 'on' : ''}" data-act="entfilter" data-k="${r.key}" title="${r.kind}">${r.icon}</button>`).join('')}</div>`;
    if (!rows.length) h += '<p class="hint">У компании пока нет предприятий и зданий.</p>';
    else h += `<table class="grid"><tr><th>Город</th><th>Предприятие</th><th>Уровень</th><th>Эффект.</th><th>Продукты</th><th class="r">Прибыль (7 дн.)</th><th class="r">Активы</th><th>Проблемы</th></tr>
      ${list.map(r => `<tr><td>🏙️ ${esc(s.cityName)}</td><td><span class="ico">${r.icon}</span> <a href="#" ${r.link}>${r.name}</a></td>
        <td><span class="star sm">${r.level}</span></td><td><span class="effbar"><i style="width:${Math.round(r.eff * 100)}%"></i></span></td>
        <td class="prods">${r.products}</td><td class="r ${r.rev - r.exp >= 0 ? '' : 'neg'}">${fmt(r.rev - r.exp)}</td><td class="r">${fmt(r.assets)}</td>
        <td>${r.problem ? `<span title="${esc(r.problem)}">${r.problem.startsWith('⛔') ? '⛔' : r.problem.startsWith('%') ? '📉' : '⚠️'}</span>` : ''}${r.contracts ? ' <span title="Есть поставки">🚚</span>' : ''}</td></tr>`).join('')}</table>`;
    return h + `<h3>Создать предприятие <small class="hint">${Object.keys(s.enterprises).length} / ${hqLimit(s, 'manage')}</small></h3>` + this.win_enterprises(s, true);
  }

  // ---------- вкладка «Специалисты» ----------
  co_staff(s) {
    const specs = s.specs || [];
    const ents = Object.values(s.enterprises);
    let h = `<h3>Специалисты компании</h3>`;
    h += specs.length ? `<table class="grid"><tr><th>Работник</th><th>Уровень</th><th class="r">Зарплата</th><th>Место работы</th><th>Профессия</th><th>Характеристики</th><th></th></tr>
      ${specs.map(x => {
        const opts = ents.filter(e => e.type === x.type);
        return `<tr><td><span class="face">${x.face}</span> <b>${esc(x.name)}</b></td>
          <td><span class="star sm">${x.level}</span> <span class="xp" title="Опыт до следующего уровня"><i style="width:${Math.round((x.xp / (x.level * 15)) * 100)}%"></i></span></td>
          <td class="r">${fmt(specSalary(x.level))}/день</td>
          <td><select data-act="assign" data-id="${x.id}"><option value="">— не назначен —</option>${opts.map(e => `<option value="${e.id}" ${x.job === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></td>
          <td>${x.prof}</td><td><span title="Производительность">⚡ +${x.level * 3}%</span> · <span title="Качество продукции">✨ +${(x.level * 0.08).toFixed(2)}</span></td>
          <td><button class="btn small danger" data-act="fire" data-id="${x.id}">Уволить</button></td></tr>`;
      }).join('')}
      <tr><td></td><td><b>Итого:</b></td><td class="r"><b>${fmt(specs.reduce((a, x) => a + specSalary(x.level), 0))}/день</b></td><td colspan="4"></td></tr></table>`
      : '<p class="hint">Специалистов пока нет. Наймите их на бирже ниже — каждый ускоряет и улучшает своё предприятие.</p>';
    h += `<h3>Биржа специалистов <small class="hint">обновляется каждые 7 дней</small></h3>
      <table class="grid"><tr><th>Кандидат</th><th>Уровень</th><th>Профессия</th><th class="r">Зарплата</th><th class="r">Подбор</th><th></th></tr>
      ${(s.candidates || []).map(c => `<tr><td><span class="face">${c.face}</span> ${esc(c.name)}</td><td><span class="star sm">${c.level}</span></td><td>${c.prof} <span class="hint">(${ENTERPRISES[c.type].name})</span></td>
        <td class="r">${fmt(specSalary(c.level))}/день</td><td class="r">${fmt(P.hireFee(c))}</td>
        <td><button class="btn small primary" data-act="hire" data-id="${c.id}" ${s.money < P.hireFee(c) ? 'disabled' : ''}>Нанять</button></td></tr>`).join('')}</table>
      <p class="hint">Специалист работает на одном предприятии своей профессии: +3% производительности и +0,08 к качеству за уровень. Опыт растёт каждый день работы.</p>`;
    if (ents.length) {
      h += `<h3>Рабочие <small class="hint">${num(P.staffTotal(s))} / ${num(hqLimit(s, 'staff'))} · средняя зарплата в городе ${s.marketSalary} ₽</small></h3>
        <table class="grid"><tr><th>Предприятие</th><th class="r">Работают</th><th class="r">Нужно</th><th>Зарплата, ₽/день</th><th class="r">Эффективность</th></tr>
        ${ents.map(e => `<tr><td><a href="#" data-act="openent" data-id="${e.id}">${entName(e)}</a></td><td class="r">${e.workers}</td><td class="r">${e.target} / ${P.maxWorkers(e)}</td>
          <td><input type="number" min="1" value="${e.salary}" data-act="esalary" data-id="${e.id}" style="width:80px"></td><td class="r">${pct(P.salaryEff(s, e))}</td></tr>`).join('')}</table>`;
    }
    return h;
  }

  // ---------- вкладка «Финансы» ----------
  co_finance(s) {
    const subs = [['accounts', 'счета'], ['credits', 'кредиты'], ['credhist', 'кредитная история'], ['weekly', 'еженедельные платежи'], ['statement', 'выписка по счетам'], ['parties', 'контрагенты компании']];
    this.finSub ||= 'accounts';
    let h = `<div class="sublinks">${subs.map(([k, n]) => `<a href="#" data-act="finsub" data-k="${k}" class="${this.finSub === k ? 'on' : ''}">${n}</a>`).join(' | ')}</div>`;
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
    const reps = [['income', '💲', 'Доходы, расходы'], ['assets', '🪙', 'Активы, обязательства'], ['charts', '📊', 'Графические отчёты'], ['byEnt', '🏭', 'По предприятиям'],
      ['byInd', '🛠️', 'По отраслям'], ['goods', '📦', 'Товарооборот компании'], ['statement', '🧾', 'Выписка по счёту'], ['geo', '🗺️', 'География компании'],
      ['eod', '📅', 'Остаток по счёту на конец дня'], ['news', '📰', 'Новости компании']];
    this.rep ||= 'income';
    const cur = reps.find(r => r[0] === this.rep);
    return `<div class="repicons">${reps.map(([k, i, n]) => `<button class="${this.rep === k ? 'on' : ''}" data-act="rep" data-k="${k}" title="${n}">${i}</button>`).join('')}</div>
      <h2 class="reptitle">${cur[2]}</h2>${this[`rep_${this.rep}`](s)}`;
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
      ${rows.map(r => `<tr><td>🏙️ ${esc(s.cityName)}</td><td><span class="star sm">${r.level}</span> <span class="ico">${r.icon}</span> <a href="#" ${r.link}>${r.name}</a></td>
        <td class="r">${fmt(r.rev)}</td><td class="r">${fmt(r.exp)}</td><td class="r ${r.rev - r.exp < 0 ? 'neg' : ''}">${fmt(r.rev - r.exp)}</td><td class="r">${fmt(r.assets)}</td><td class="r">—</td></tr>`).join('')}
      <tr><td>🏙️ ${esc(s.cityName)}</td><td><span class="star sm">${Math.max(...Object.values(s.hq))}</span> <span class="ico">🏛️</span> Штаб-квартира</td><td class="r">${fmt(0)}</td><td class="r">${fmt(hqCost)}</td>
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
      ${[...m.values()].sort((a, b) => b.assets - a.assets).map(x => `<tr><td><span class="ico">${x.icon}</span> ${x.kind} <span class="hint">(${x.n})</span></td><td class="r">${fmt(x.rev)}</td><td class="r">${fmt(x.exp)}</td>
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
        return `<tr><td>${goodName(g)}</td><td class="r">${num(stock(g))}</td><td class="r">${num(b)}</td><td class="r">${num(m)}</td><td class="r">${num(u)}</td><td class="r">${num(w)}</td><td class="r">${num(r)}</td>
          <td class="r ${bal > 0 ? 'pos' : bal < 0 ? 'neg' : ''}">${bal > 0 ? '+' : ''}${num(bal)}</td></tr>`;
      }).join('')}</table></div><p class="hint">За последние 7 дней. Перевозки между своими предприятиями не учитываются.</p>`;
  }

  rep_statement() { return this.statementHtml(); }

  rep_geo(s) {
    const a = G.assets(s), total = Object.entries(a).filter(([k]) => k !== 'loan').reduce((x, [, v]) => x + v, 0);
    const rev = this.histSum('inc', null, 0, 7), exp = this.histSum('exp', null, 0, 7);
    return `<div class="twocol"><div><h3>Финансы</h3><table class="grid"><tr><th>Город</th><th class="r">Активы</th><th class="r">Выручка (7 дн.)</th><th class="r">Прибыль</th></tr>
      <tr><td>🏙️ ${esc(s.cityName)}</td><td class="r">${fmt(total)} <small class="hint">100%</small></td><td class="r">${fmt(rev)} <small class="hint">100%</small></td><td class="r">${fmt(rev - exp)}</td></tr></table></div>
      <div><h3>Рабочие</h3><table class="grid"><tr><th>Город</th><th class="r">Доля</th><th class="r">Рабочие</th></tr>
      <tr><td>🏙️ ${esc(s.cityName)}</td><td class="r">100%</td><td class="r">${num(P.staffTotal(s) + (s.specs || []).length)}</td></tr></table></div></div>
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
    const tabs = [['info', 'Город'], ['map', 'Карта'], ['projects', 'Проекты'], ['ents', 'Предприятия'], ['analytics', 'Аналитика']];
    const level = Math.min(5, 1 + Math.floor((s.city.population || 0) / 2000));
    return `<div class="page-title"><span class="big">🏙️</span><h1>Город ${esc(s.cityName)}</h1>
        <div class="acts mayor"><div><span>❔</span><small>Мэр<br>нет мэра</small></div><div><span>❔</span><small>Зам<br>нет зама</small></div>
        <span class="star" title="Уровень города">${level}</span></div></div>
      <div class="ftabs">${tabs.map(([k, n]) => `<button data-act="citytab" data-k="${k}" class="${this.cityTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${this[`city_${this.cityTab}`](s)}`;
  }

  city_map() {
    const c = this.app.world.coverage || {};
    return `<div class="mapframe" id="mapSlot"></div>
      <p class="hint">Клик по участку — информация и стройка. Мышь: левая кнопка — двигать, правая — вращать, колесо — масштаб.
        Круги показывают зоны охвата: зелёные — ваши здания, красные — конкурентов.</p>
      <label class="chk"><input type="checkbox" data-act="cover" data-k="hospital" ${c.hospital ? 'checked' : ''}> 🏥 Больница</label>
      <label class="chk"><input type="checkbox" data-act="cover" data-k="police" ${c.police ? 'checked' : ''}> 🚓 Полиция</label>`;
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
        <span>Больниц / полиции</span><span>${count('hospital')} / ${count('police')}</span></div>
      <div><h3>Компании города</h3>${this.win_rating(s)}</div></div>`;
  }

  city_projects(s) {
    const list = Object.values(s.buildings).filter(b => b.state === 'build');
    return list.length ? `<table class="grid"><tr><th>Объект</th><th>Заказчик</th><th>Подрядчик</th><th class="r">Готовность</th><th class="r">Осталось</th></tr>
      ${list.map(b => `<tr><td><a href="#" data-act="goplot" data-i="${b.i}" data-j="${b.j}">${bTitle(b)}</a> · ${b.floors} эт.</td><td style="color:${ownerColor(b)}">${ownerName(s, b)}</td>
        <td>${contractorInfo(b.contractor).name}</td><td class="r">${pct(b.progress / b.buildDays)}</td><td class="r">~${Math.ceil(b.buildDays - b.progress)} дн.</td></tr>`).join('')}</table>`
      : '<p class="hint">Сейчас в городе ничего не строится.</p>';
  }

  city_ents(s) {
    const list = Object.values(s.buildings).filter(b => b.state === 'done');
    return list.length ? `<table class="grid"><tr><th>Здание</th><th>Владелец</th><th class="r">Этажей</th><th class="r">Заполненность</th><th>Район</th></tr>
      ${list.map(b => `<tr><td><a href="#" data-act="goplot" data-i="${b.i}" data-j="${b.j}">${bTitle(b)}</a></td><td style="color:${ownerColor(b)}">${ownerName(s, b)}</td>
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

  page_builds(s) {
    const blds = Object.values(s.buildings).filter(b => G.isPlayer(b) && b.state === 'build');
    return `<div class="page-title"><span class="big">🏗️</span><h1>Стройки</h1><div class="acts"><button class="btn primary" data-act="tocity">🌐 Выбрать участок в городе</button></div></div>
      <div class="kv" style="max-width:480px"><span>Строек сейчас</span><span>${blds.length} / ${hqLimit(s, 'build')}</span>
      <span>Своих строительных компаний</span><span>${G.builders(s).length}</span></div>
      ${blds.length ? `<table><tr><th>Здание</th><th>Строит</th><th class="r">Готовность</th><th class="r">Осталось</th><th>Статус</th></tr>
      ${blds.map(b => `<tr><td><a href="#" data-act="goplot" data-i="${b.i}" data-j="${b.j}">${bTitle(b)}</a> · ${b.floors} эт.</td><td>${contractorInfo(b.contractor).name}</td>
        <td class="r">${pct(b.progress / b.buildDays)}</td><td class="r">~${Math.ceil(b.buildDays - b.progress)} дн.</td>
        <td>${b.paused ? '<span class="warn">⛔ стоит</span>' : b.delayed ? 'простой' : 'идёт'}</td></tr>`).join('')}</table>`
      : '<p class="hint">Строек нет. Откройте город, кликните по свободному участку и выберите, что и кто строит.</p>'}
      <h3>Подрядчики</h3><table><tr><th>Компания</th><th class="r">Цена</th><th class="r">Срок</th><th>Качество</th><th></th></tr>
      ${Object.values(CONTRACTORS).map(c => `<tr><td><b style="color:${c.color}">${c.name}</b></td><td class="r">×${c.price}</td><td class="r">×${c.speed}</td><td class="stars">${stars(c.quality)}</td><td class="hint">${c.desc}</td></tr>`).join('')}
      <tr><td><b style="color:${OWN.color}">${OWN.name}</b></td><td class="r">материалы</td><td class="r">бригада</td><td class="stars">${stars(OWN.quality)}</td><td class="hint">${OWN.desc}</td></tr></table>`;
  }

  page_settings(s) {
    const st = this.app.settings;
    return `<div class="page-title"><span class="big">⚙️</span><h1>Настройки</h1></div>
      <div class="box" style="max-width:640px"><h4>Сервер</h4><div class="kv">
        <span>Длина игрового дня</span><span><b>${st.dayLengthSeconds} сек.</b></span>
        <span>Источник</span><span>${st.fromServer ? 'настройки сервера (settings.json)' : 'по умолчанию — файл настроек не найден'}</span></div>
        <p class="hint">Длина дня задаётся на сервере: в окне программы BizCity.exe или в файле <code>bizgame/settings.json</code>
        (<code>{"dayLengthSeconds": 60}</code>). Игра подхватывает изменения сама в течение 20 секунд.
        Кнопки ⏩ внизу ускоряют время только у вас.</p></div>
      <div class="box" style="max-width:640px"><h4>Компания и город</h4>
        <div class="row"><button class="btn" data-act="rename">✎ Название компании</button><button class="btn" data-act="renamecity">✎ Название города</button></div></div>
      <div class="box" style="max-width:640px"><h4>Прогресс</h4><p class="hint">Сброс удалит сохранение и начнёт игру с пустого города.</p>
        <button class="btn danger" data-act="reset">🔄 Сбросить прогресс</button></div>`;
  }

  page_market(s) { return this.titled('market'); }
  page_contracts(s) { return this.titled('contracts'); }
  page_rating(s) { return this.titled('rating'); }
  page_quests(s) { return this.titled('quests'); }
  page_help(s) { return this.titled('help'); }

  entTable(ents) {
    return `<table><tr><th>Предприятие</th><th>Что делает</th><th class="r">Штат</th><th class="r">Прибыль</th></tr>
      ${ents.map(e => {
        const what = e.type === 'lab' ? (e.research ? 'изучает ' + GOODS[e.research].name : '—') : e.type === 'shop' ? 'торговля' : e.type === 'warehouse' ? 'хранение'
          : e.type === 'construction' ? 'стройка' : goodName(e.recipe);
        const p = e.last.revenue - e.last.expense, prob = this.entProblem(e);
        return `<tr><td><a href="#" data-act="openent" data-id="${e.id}">${entName(e)}</a>${prob ? ` <span title="${esc(prob)}">⚠️</span>` : ''}</td><td>${what}</td>
          <td class="r">${e.workers}</td><td class="r ${p >= 0 ? 'pos' : 'neg'}">${fmt(p)}</td></tr>`;
      }).join('')}</table>`;
  }

  win_enterprises(s, cardsOnly = false) {
    const ents = Object.values(s.enterprises);
    let h = cardsOnly ? '' : ents.length ? this.entTable(ents) : '<p class="hint">У вас пока нет предприятий.</p>';
    const hosts = P.shopHosts(s);
    h += `<h3>Создать предприятие</h3><p class="hint">Фермы, карьеры, заводы, склады, НИИ и строительная компания работают виртуально — участок в городе им не нужен.
      Магазин открывается в коммерческом помещении жилого дома.</p><div class="cards">`;
    for (const t in ENTERPRISES) {
      const d = ENTERPRISES[t];
      const shopBlock = t === 'shop'
        ? (hosts.length ? `<select id="shopHost">${hosts.map(b => `<option value="${b.id}">Дом №${b.id} (${b.owner === 'player' ? 'ваш' : 'аренда ' + b.units.comm.rent + ' ₽'})</option>`).join('')}</select>`
          : '<small class="warn">Нет домов со свободными помещениями — постройте жилой дом.</small>')
        : '';
      h += `<div class="card"><div class="ic">${d.icon}</div><b>${d.name}</b><small>${d.desc}</small>${shopBlock}
        <div class="price">${fmt(d.cost)}</div>
        <button class="btn small primary" data-act="create" data-type="${t}" ${s.money < d.cost || (t === 'shop' && !hosts.length) ? 'disabled' : ''}>Создать</button></div>`;
    }
    return h + '</div>';
  }

  win_contracts(s) {
    if (!s.contracts.length) return '<p>Поставок пока нет. Откройте предприятие → вкладка «Поставки», чтобы возить сырьё на завод, стройматериалы в строительную компанию, а товары — в магазин.</p>';
    return `<table><tr><th>Откуда</th><th>Куда</th><th>Товар</th><th class="r">В день</th><th></th></tr>
      ${s.contracts.map(c => `<tr><td>${entName(s.enterprises[c.from])}</td><td>${entName(s.enterprises[c.to])}</td><td>${goodName(c.good)}</td>
        <td class="r">${num(c.qty)}</td><td><button class="btn small" data-act="cdel" data-id="${c.id}">✕</button></td></tr>`).join('')}</table>`;
  }

  win_market(s) {
    const tabs = [['goods', 'Товары и склады'], ['estate', 'Недвижимость'], ['chains', 'Цепочки']];
    let h = `<div class="tabs">${tabs.map(([k, n]) => `<button data-act="wtab" data-tab="${k}" class="${this.winTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (this.winTab === 'estate') {
      const done = Object.values(s.buildings).filter(b => b.state === 'done');
      h += `<div class="kv"><span>Население</span><span>${num(s.city.population || 0)}</span><span>Рабочих мест</span><span>${num(s.city.jobs || 0)}</span></div>
        <table><tr><th>Помещения</th><th class="r">Спрос</th><th class="r">Всего в городе</th><th class="r">Занято</th><th class="r">Аренда в центре / на окраине</th></tr>`;
      for (const t in UNITS) {
        const tot = done.reduce((a, b) => a + (b.units[t]?.total || 0), 0), occ = done.reduce((a, b) => a + (b.units[t]?.occ || 0), 0);
        h += `<tr><td>${UNITS[t].icon} ${UNITS[t].name}</td><td class="r">${num(s.city.demand?.[t] || 0)}</td><td class="r">${num(tot)}</td><td class="r">${num(occ)}</td>
          <td class="r">${Math.round(UNITS[t].rent * (0.6 + 0.4 * 1.7))} / ${Math.round(UNITS[t].rent * (0.6 + 0.4 * 0.6))} ₽</td></tr>`;
      }
      const mods = Object.entries(s.mods).map(([k, m]) => `${{ apt: 'жильё', office: 'офисы', comm: 'коммерция', build: 'стоимость стройки' }[k]} ×${m.mult} (${m.days} дн.)`);
      return h + `</table>${mods.length ? `<p class="warn">События: ${mods.join(', ')}</p>` : ''}
        <p class="hint">Спрос на жильё растёт с каждым днём и с числом рабочих мест; спрос на офисы и коммерцию — с населением.</p>`;
    }
    if (this.winTab === 'chains') {
      h += '<table><tr><th>Товар</th><th>Где</th><th>Из чего</th><th class="r">Мощн./день</th></tr>';
      for (const r in RECIPES) {
        const R = RECIPES[r];
        h += `<tr><td>${goodName(r)}</td><td>${ENTERPRISES[R.ent].name}</td><td>${Object.entries(R.inputs).map(([g, k]) => `${k}×${GOODS[g].icon}`).join(' + ') || '—'}</td><td class="r">${R.rate}</td></tr>`;
      }
      h += '</table><h3>Стройматериалы на один этаж</h3><table>';
      for (const t in BUILDINGS) h += `<tr><td>${BUILDINGS[t].icon} ${BUILDINGS[t].name}</td><td>${Object.entries(BUILDINGS[t].materials).map(([g, n]) => `${n} ${GOODS[g].icon}`).join(' · ')}</td></tr>`;
      return h + '</table>';
    }
    h += `<p class="hint">Универсальные склады города: запасы ограничены и пополняются медленно. Закупка — с наценкой ${Math.round((IMPORT_MARKUP - 1) * 100)}%,
      продажа — ${Math.round(WHOLESALE_RATE * 100)}% цены (с поправкой на качество, указано для качества 3). Ваши продажи пополняют склады.</p>`;
    const kinds = { raw: 'Сырьё', mid: 'Полуфабрикаты', build: 'Стройматериалы', retail: 'Потребительские товары' };
    for (const k in kinds) {
      h += `<h3>${kinds[k]}</h3><table><tr><th>Товар</th><th class="r">На складах</th><th class="r">Цена</th><th class="r">Изм.</th><th class="r">Купить</th><th class="r">Продать</th></tr>`;
      for (const g in GOODS) {
        if (GOODS[g].kind !== k) continue;
        const ch = (s.prices[g] / GOODS[g].price - 1) * 100;
        const low = s.depot[g] < P.depotStart(g) * 0.25;
        h += `<tr><td>${goodName(g)}</td><td class="r ${low ? 'neg' : ''}">${num(s.depot[g])}</td><td class="r">${s.prices[g].toFixed(1)}</td>
          <td class="r ${ch >= 0 ? 'pos' : 'neg'}">${ch >= 0 ? '+' : ''}${ch.toFixed(0)}%</td><td class="r">${P.buyPrice(s, g)}</td><td class="r">${P.sellPrice(s, g)}</td></tr>`;
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
    return `<table><tr><th>#</th><th>Компания</th><th class="r">Зданий</th><th class="r">Капитал</th></tr>
      ${G.rating(s).map((r, n) => `<tr class="${r.player ? 'me' : ''}"><td>${n + 1}</td><td><span style="color:${r.color}">■</span> ${esc(r.name)}</td><td class="r">${r.count}</td><td class="r">${fmt(r.worth)}</td></tr>`).join('')}</table>
      <p class="hint">Конкуренты тоже заказывают стройки — город постепенно застраивается. Обгоните всех!</p>`;
  }

  win_quests(s) {
    return G.QUESTS.map(q => `<div class="quest ${s.quests[q.id] ? 'done' : ''}"><span class="ic">${s.quests[q.id] ? '✅' : '⬜'}</span>
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
      <h3>Управление</h3><p>Разделы — иконки вверху: 🌐 город (3D-карта), 🏢 компания, 🏭 предприятия, 🧑‍💼 специалисты, 🏗️ стройки, 💲 финансы, 📋 отчёты. На карте: левая кнопка мыши — двигать, правая — вращать, колесо — масштаб; на телефоне — один палец двигает, два — масштаб и поворот. Пробел — пауза, ⏩ — ускорить время.</p><h3>Время</h3><p>Игровой день длится минуту (настраивается на сервере). До нового дня — в шапке. Каждый день начисляются аренда, зарплаты, идут стройки и производство.</p><h3>Штаб-квартира и специалисты</h3><p>Отделы штаб-квартиры ограничивают число рабочих, предприятий, продуктов и строек — повышайте их уровень. Специалисты с биржи ускоряют предприятие своей профессии и повышают качество.</p>
      <h3>Здания в городе</h3><p>Кликните по пустому участку и закажите стройку. Три типа зданий:<br>
      🏢 <b>офисные</b> — офисы сдаются компаниям;<br>🏘️ <b>жилые</b> — квартиры для горожан, на первом этаже — коммерческие помещения (магазины, кафе);<br>
      🏥🚓 <b>социальные</b> — больница и полиция: город платит за содержание, а дома вокруг становятся привлекательнее.</p>
      <h3>Кто строит</h3><p>Строительная компания-подрядчик: дороже или дешевле, быстрее или медленнее, с разным качеством.
      Или <b>своими силами</b>: создайте «Строительную компанию» в меню «Предприятия», закупите стройматериалы на складах или производите их сами — тогда здание обойдётся намного дешевле.</p>
      <h3>Производство</h3><p>Фермы, карьеры, заводы, склады и НИИ — виртуальные предприятия, они не занимают места в городе. Настраивайте поставки между ними:
      карьер → камень и песок → завод → цемент → бетон → ваша стройка; ферма → зерно → мука → хлеб → ваш магазин в жилом доме.</p>
      <h3>Универсальные склады</h3><p>В начале игры в городе есть склады с запасами всех товаров. Запасы ограничены и пополняются медленно, при дефиците цены растут — со временем выгоднее производить самому.</p>
      <h3>Деньги</h3><p>Аренда идёт каждый день. Платятся содержание зданий, зарплаты и налог на землю. Нужны деньги — банк даст кредит. Начать заново — кнопка «Сброс».</p></div>`;
  }
}
