// Интерфейс: панели участков, зданий и предприятий, окна, новости, значки над зданиями.
import {
  GOODS, RECIPES, ENTERPRISES, BUILDINGS, UNITS, CATEGORIES, CONTRACTORS, OWN, contractorInfo, RIVALS,
  NPC_QUALITY, IMPORT_MARKUP, WHOLESALE_RATE, SHOP_UNITS_PER_WORKER, TRANSPORT_PER_UNIT, ADVANCE,
} from './data.js';
import * as G from './game.js';
import * as P from './production.js';

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

export class UI {
  constructor(app) {
    this.app = app;           // { state, world, act(fn), select(i,j), selectEnt(id), newGame() }
    this.sel = null;          // {kind:'plot', i, j} | {kind:'ent', id}
    this.tab = 'main';
    this.form = { type: 'residential', floors: 5, contractor: 'trest' };
    this.win = null;
    this.winTab = 'goods';
    this.lastNews = null;

    for (const el of [$('#side'), $('#modalBody')]) {
      el.addEventListener('click', e => this.onClick(e));
      el.addEventListener('change', e => this.onChange(e));
    }
    $('#modalClose').onclick = () => this.closeWin();
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') this.closeWin(); });
    document.querySelectorAll('#menu button').forEach(b => b.onclick = () => (b.dataset.win === 'reset' ? this.reset() : this.openWin(b.dataset.win)));
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
  renderTop(frac) {
    const s = this.s;
    const last = s.history[s.history.length - 1] || { income: 0, expense: 0 };
    const profit = last.income - last.expense;
    $('#money').textContent = fmt(s.money);
    $('#money').className = s.money < 0 ? 'neg' : '';
    $('#worth').textContent = fmt(G.netWorth(s));
    $('#profit').textContent = (profit > 0 ? '+' : '') + fmt(profit);
    $('#profit').className = profit >= 0 ? 'pos' : 'neg';
    $('#pop').textContent = num(s.city.population || 0);
    $('#day').textContent = s.day;
    $('#dayBar').style.width = (frac * 100).toFixed(1) + '%';
    $('#questDot').classList.toggle('on', G.QUESTS.some(q => !s.quests[q.id]) && this.win !== 'quests');
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
      case 'cdel': this.app.act(() => P.removeContract(s, +t.dataset.id)); this.renderSide(true); if (this.win) this.openWin(this.win); break;
      case 'create': {
        const type = t.dataset.type;
        const host = type === 'shop' ? +$('#shopHost')?.value : null;
        const r = run(() => P.createEnterprise(s, type, host));
        if (r?.enterprise) { this.toast(`${ENTERPRISES[type].icon} ${r.enterprise.name} создано`); this.closeWin(); this.app.selectEnt(r.enterprise.id); }
        break;
      }
      case 'wtab': this.winTab = t.dataset.tab; this.openWin(this.win); break;
      case 'loan': run(() => G.takeLoan(s, +$('#loanAmt').value)); this.openWin('bank'); break;
      case 'repay': this.app.act(() => G.repayLoan(s, +$('#loanAmt').value)); this.openWin('bank'); break;
      case 'reset': this.reset(); break;
      case 'rename': {
        const n = prompt('Название компании', s.company);
        if (n && n.trim()) { this.app.act(() => { s.company = n.trim().slice(0, 40); }); this.openWin('company'); }
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
        case 'recipe': e.recipe = t.value; break;
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
  }

  // ---------- окна ----------
  openWin(name) {
    this.win = name;
    const titles = { company: '📊 Компания', enterprises: '🏭 Предприятия', contracts: '🚚 Поставки', market: '💹 Рынок', rating: '🏆 Рейтинг',
      quests: '🎯 Задания', bank: '🏦 Банк', help: '❔ Как играть' };
    $('#modalTitle').textContent = titles[name];
    $('#modalBody').innerHTML = this[`win_${name}`](this.s);
    $('#modal').hidden = false;
    if (name === 'company') this.drawChart();
  }
  closeWin() { this.win = null; $('#modal').hidden = true; }
  refreshWin() {
    if (!this.win || $('#modalBody').contains(document.activeElement)) return;
    const top = $('.win').scrollTop;
    this.openWin(this.win);
    $('.win').scrollTop = top;
  }

  win_company(s) {
    const blds = Object.values(s.buildings).filter(G.isPlayer);
    const ents = Object.values(s.enterprises);
    const last = s.history[s.history.length - 1];
    let h = `<div class="row"><b style="font-size:18px">${esc(s.company)}</b><button class="btn small" data-act="rename">✎ Переименовать</button></div>
      <div class="kv"><span>Деньги</span><span>${fmt(s.money)}</span><span>Кредит</span><span>${fmt(s.loan)}</span>
      <span>Капитал</span><span>${fmt(G.netWorth(s))}</span><span>Вчера: доход / расход</span><span>${fmt(last.income)} / ${fmt(last.expense)}</span></div>
      <canvas class="chart" id="chart"></canvas><p class="hint">Синяя линия — капитал, зелёная — деньги на счету.</p>
      <h3>Недвижимость</h3>`;
    h += blds.length ? `<table><tr><th>Здание</th><th class="r">Состояние</th><th class="r">Доход</th><th class="r">Прибыль</th></tr>
      ${blds.map(b => `<tr><td><a href="#" data-act="goplot" data-i="${b.i}" data-j="${b.j}">${bTitle(b)}</a></td>
        <td class="r">${b.state === 'build' ? '🏗️ ' + pct(b.progress / b.buildDays) : BUILDINGS[b.type].category === 'social' ? 'работает' : 'занято ' + pct(G.occRate(b))}</td>
        <td class="r">${fmt(b.last.income)}</td><td class="r ${b.last.income - b.last.expense >= 0 ? 'pos' : 'neg'}">${fmt(b.last.income - b.last.expense)}</td></tr>`).join('')}</table>`
      : '<p class="hint">Зданий пока нет — кликните по пустому участку на карте.</p>';
    h += '<h3>Предприятия</h3>' + (ents.length ? this.entTable(ents) : '<p class="hint">Предприятий пока нет — меню «Предприятия».</p>');
    return h;
  }

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

  win_enterprises(s) {
    const ents = Object.values(s.enterprises);
    let h = ents.length ? this.entTable(ents) : '<p class="hint">У вас пока нет предприятий.</p>';
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

  drawChart() {
    const c = $('#chart'); if (!c) return;
    const s = this.s, dpr = devicePixelRatio || 1;
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const W = c.clientWidth, H = c.clientHeight, pad = 8, h = s.history;
    if (h.length < 2) { x.fillStyle = '#94a3b8'; x.fillText('Данные появятся через пару дней', 10, 20); return; }
    const vals = h.flatMap(p => [p.worth, p.money]);
    const lo = Math.min(0, ...vals), hi = Math.max(...vals) * 1.05;
    const X = n => pad + (n / (h.length - 1)) * (W - pad * 2), Y = v => H - pad - ((v - lo) / (hi - lo || 1)) * (H - pad * 2);
    x.strokeStyle = 'rgba(148,163,184,.2)';
    x.beginPath(); x.moveTo(pad, Y(0)); x.lineTo(W - pad, Y(0)); x.stroke();
    for (const [k, col] of [['worth', '#3b82f6'], ['money', '#22c55e']]) {
      x.strokeStyle = col; x.lineWidth = 2.5; x.beginPath();
      h.forEach((p, n) => (n ? x.lineTo(X(n), Y(p[k])) : x.moveTo(X(n), Y(p[k]))));
      x.stroke();
    }
    x.fillStyle = '#94a3b8'; x.font = '12px system-ui';
    x.fillText(fmt(hi), pad + 2, 14); x.fillText(`день ${h[0].day}–${h[h.length - 1].day}`, W - 110, H - 12);
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
      <h3>Управление</h3><p>Мышь: левая кнопка — двигать карту, правая — вращать, колесо — масштаб. Телефон: один палец — двигать, два — масштаб и поворот. Пробел — пауза.</p>
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
