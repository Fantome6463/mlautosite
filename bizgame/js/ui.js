// Интерфейс: панель участка/здания, окна, новости, значки над зданиями.
import { GOODS, RECIPES, BUILDINGS, NPC_QUALITY, RIVALS, TRANSPORT_PER_UNIT, WHOLESALE_RATE, IMPORT_MARKUP, SHOP_UNITS_PER_WORKER } from './data.js';
import * as G from './game.js';

const $ = s => document.querySelector(s);
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = G.fmt;
const num = v => Math.round(v).toLocaleString('ru-RU');
const qBadge = q => {
  const c = q < 3 ? '#f43f5e' : q < 5 ? '#f59e0b' : q < 7 ? '#22c55e' : '#a855f7';
  return `<span class="q" style="background:${c}33;color:${c}">${q.toFixed(1)}</span>`;
};
const goodName = g => `${GOODS[g].icon} ${GOODS[g].name}`;
const bName = b => `${BUILDINGS[b.type].icon} ${BUILDINGS[b.type].name} №${b.id}`;

export class UI {
  constructor(app) {
    this.app = app;            // { state, world, act(fn), select(i,j) }
    this.sel = null;           // {i,j}
    this.tab = 'main';
    this.win = null;
    this.lastNews = null;

    $('#side').addEventListener('click', e => this.onClick(e));
    $('#side').addEventListener('change', e => this.onChange(e));
    $('#modalBody').addEventListener('click', e => this.onClick(e));
    $('#modalBody').addEventListener('change', e => this.onChange(e));
    $('#modalClose').onclick = () => this.closeWin();
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') this.closeWin(); });
    document.querySelectorAll('#menu button').forEach(b => b.onclick = () => this.openWin(b.dataset.win));
  }

  get s() { return this.app.state; }

  toast(text, err = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3200);
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
    $('#day').textContent = s.day;
    $('#dayBar').style.width = (frac * 100).toFixed(1) + '%';
    const open = G.QUESTS.find(q => !s.quests[q.id]);
    $('#questDot').classList.toggle('on', !!open && this.win !== 'quests');
    const n = s.news[0];
    if (n && n !== this.lastNews) {
      this.lastNews = n;
      $('#news').innerHTML = `<div class="item"><span class="d">День ${n.day}</span>${esc(n.text)}</div>`;
    }
  }

  // ---------- значки над зданиями ----------
  renderBadges() {
    const s = this.s, world = this.app.world, root = $('#badges');
    const list = Object.values(s.buildings);
    while (root.children.length < list.length) root.appendChild(document.createElement('div'));
    while (root.children.length > list.length) root.lastChild.remove();
    list.forEach((b, n) => {
      const el = root.children[n];
      const p = world.screenPos(b.i, b.j, 11 + (b.level - 1) * 2);
      if (!p) { el.style.display = 'none'; return; }
      const prob = this.problem(b);
      const icon = b.type === 'lab' && b.research ? GOODS[b.research].icon : (b.recipe && b.type !== 'warehouse' && b.type !== 'shop' ? GOODS[b.recipe].icon : BUILDINGS[b.type].icon);
      const html = prob ? `${icon} ⚠️` : icon;
      if (el._h !== html) { el.innerHTML = html; el._h = html; el.title = prob || ''; }
      el.className = 'badge' + (prob ? ' bad' : '');
      el.style.display = '';
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    });
  }

  problem(b) {
    const s = this.s;
    if (b.workers === 0 && b.target > 0 && b.salary < s.marketSalary * 0.7) return 'Низкая зарплата — никто не идёт работать';
    if (b.target === 0) return 'Нет сотрудников';
    if (b.type === 'shop' && !Object.keys(b.stock).some(g => GOODS[g].kind === 'retail')) return 'Нечего продавать — настройте поставку';
    if (b.type === 'lab' && !b.research) return 'Не выбрано исследование';
    if (BUILDINGS[b.type].storage && G.freeSpace(b) <= 0) return 'Склад переполнен';
    const info = RECIPES[b.recipe]?.building === b.type ? G.productionInfo(s, b) : null;
    const made = b.last.produced[b.recipe] || 0;
    if (info && info.limitBy && made < info.maxOut * 0.3 && s.day > b.built + 1) return `Не хватает сырья: ${GOODS[info.limitBy].name}`;
    return null;
  }

  // ---------- выбор участка ----------
  select(i, j) {
    if (i == null) { this.sel = null; $('#side').hidden = true; return; }
    if (!this.sel || this.sel.i !== i || this.sel.j !== j) this.tab = 'main';
    this.sel = { i, j };
    $('#side').hidden = false;
    this.renderSide(true);
  }

  renderSide(force = false) {
    if (!this.sel) return;
    const side = $('#side');
    if (!force && side.contains(document.activeElement) && document.activeElement.matches('input,select')) return;
    const top = side.scrollTop;
    const { i, j } = this.sel;
    const s = this.s;
    const p = s.plots[G.key(i, j)];
    const b = G.buildingAt(s, i, j);
    let html = '<button class="x" data-act="close">✕</button>';
    if (b) html += this.buildingHtml(b);
    else if (p.kind === 'npc') {
      const r = RIVALS[p.owner];
      html += `<h2>🏢 Офисное здание</h2><div class="sub">Участок ${i}:${j}</div>
        <div class="box">Принадлежит <b style="color:${r.color}">${esc(r.name)}</b>. Участок не продаётся.</div>
        <p class="hint">Ищите свободные участки с жёлтой табличкой или парки (они дороже).</p>`;
    } else html += this.plotHtml(p);
    side.innerHTML = html;
    side.scrollTop = top;
  }

  plotHtml(p) {
    const s = this.s;
    const locWord = p.loc >= 1.4 ? 'отличная' : p.loc >= 1.05 ? 'хорошая' : p.loc >= 0.8 ? 'средняя' : 'низкая';
    let h = `<h2>${p.kind === 'park' ? '🌳 Сквер' : '🪧 Свободный участок'}</h2><div class="sub">Участок ${p.i}:${p.j}</div>
      <div class="kv"><span>Стоимость земли</span><span>${fmt(p.kind === 'park' ? p.price * 1.5 : p.price)}</span>
      <span>Проходимость</span><span>${p.loc.toFixed(2)} — ${locWord}</span></div>
      <p class="hint">Проходимость влияет на продажи магазина. Производство можно ставить на окраинах — земля там дешевле.</p>
      <div class="cards">`;
    for (const t in BUILDINGS) {
      const d = BUILDINGS[t];
      const cost = G.buildCost(s, t, p.i, p.j);
      h += `<button class="card" data-act="build" data-type="${t}" ${s.money < cost ? 'disabled' : ''}>
        <div class="ic">${d.icon}</div><b>${d.name}</b><small>${d.desc}</small><div class="price">${fmt(cost)}</div></button>`;
    }
    return h + '</div>';
  }

  buildingHtml(b) {
    const s = this.s, d = BUILDINGS[b.type];
    const tabs = [['main', 'Обзор'], ['stock', 'Склад']];
    if (b.type === 'shop') tabs.push(['shop', 'Цены']);
    if (b.type === 'lab') tabs.push(['lab', 'Исследования']);
    else tabs.push(['supply', 'Поставки']);
    if (!tabs.some(t => t[0] === this.tab)) this.tab = 'main';
    let h = `<h2>${d.icon} ${d.name} <span class="lvl">ур. ${b.level}</span></h2>
      <div class="sub">№${b.id} · участок ${b.i}:${b.j} · с ${b.built}-го дня</div>
      <div class="tabs">${tabs.map(([k, n]) => `<button data-act="tab" data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const prob = this.problem(b);
    if (prob) h += `<div class="warn">⚠️ ${esc(prob)}</div>`;
    h += this[`tab_${this.tab}`](b);
    return h;
  }

  tab_main(b) {
    const s = this.s, d = BUILDINGS[b.type];
    const max = G.maxWorkers(b);
    const eff = G.salaryEff(s, b);
    const profit = b.last.revenue - b.last.expense;
    let h = `<div class="box"><h4>Вчера</h4><div class="kv">
      <span>Выручка</span><span class="pos">${fmt(b.last.revenue)}</span>
      <span>Расходы</span><span class="neg">${fmt(b.last.expense)}</span>
      <span>Прибыль</span><span class="${profit >= 0 ? 'pos' : 'neg'}">${fmt(profit)}</span></div></div>`;
    const recipes = Object.keys(RECIPES).filter(r => RECIPES[r].building === b.type);
    if (recipes.length) {
      const r = RECIPES[b.recipe], info = G.productionInfo(s, b);
      const inputs = Object.entries(r.inputs).map(([g, k]) => `${k} × ${goodName(g)} (есть ${num(G.stockQty(b, g))})`).join('<br>') || 'не нужно';
      h += `<div class="box"><h4>Производство</h4>
        <div class="row"><select data-act="recipe">${recipes.map(x => `<option value="${x}" ${x === b.recipe ? 'selected' : ''}>${goodName(x)} — ${fmt(s.prices[x])}</option>`).join('')}</select></div>
        <div class="kv"><span>Сырьё на 1 шт.</span><span>${inputs}</span>
        <span>Мощность</span><span>${num(info.maxOut)} шт./день</span>
        <span>Выпущено вчера</span><span>${num(b.last.produced[b.recipe] || 0)} шт.</span>
        <span>Технология</span><span>ур. ${s.tech[b.recipe]} → качество ${qBadge(G.techQuality(s, b.recipe))}</span></div>
        ${info.limitBy && (b.last.produced[b.recipe] || 0) < info.maxOut * 0.9 ? `<p class="hint">Ограничено сырьём «${GOODS[info.limitBy].name}». Закупите его на вкладке «Склад» или настройте поставку.</p>` : ''}</div>`;
    }
    h += `<div class="box"><h4>Персонал</h4>
      <div class="row"><label>Штат</label><input type="range" min="0" max="${max}" value="${b.target}" data-act="target"><b>${b.workers}/${b.target}</b></div>
      <div class="row"><label>Зарплата</label><input type="number" min="1" step="1" value="${b.salary}" data-act="salary"> ₽/день
        <span class="hint">средняя ${s.marketSalary}</span></div>
      <div class="kv"><span>Эффективность</span><span>${Math.round(eff * 100)}%</span>
      <span>Фонд оплаты</span><span>${fmt(b.workers * b.salary)}/день</span>
      <span>Содержание и налог</span><span>${fmt(d.upkeep * b.level + Math.round(s.plots[G.key(b.i, b.j)].price * 0.0005))}/день</span>
      ${d.storage ? `<span>Склад</span><span>${num(G.stockTotal(b))} / ${num(G.capacity(b))}</span>` : ''}</div>
      <p class="hint">Зарплата выше средней — выше производительность и качество. Ниже 70% от средней — люди увольняются.</p></div>
      <div class="actions">
        ${b.level < 3 ? `<button class="btn primary" data-act="upgrade" ${s.money < G.upgradeCost(b) ? 'disabled' : ''}>⬆ Расширить (${fmt(G.upgradeCost(b))})</button>` : ''}
        <button class="btn danger" data-act="demolish">Продать (${fmt(b.invested * 0.4)})</button>
      </div>`;
    return h;
  }

  tab_stock(b) {
    const s = this.s;
    const goods = Object.keys(b.stock);
    let h = `<div class="kv"><span>Заполнено</span><span>${num(G.stockTotal(b))} / ${num(G.capacity(b))}</span></div>
      <div class="bar"><i style="width:${Math.min(100, (G.stockTotal(b) / G.capacity(b)) * 100)}%"></i></div>`;
    if (!goods.length) h += '<p class="hint">Склад пуст.</p>';
    else {
      h += `<table><tr><th>Товар</th><th class="r">Кол-во</th><th>Кач.</th><th class="r">Опт</th><th></th></tr>`;
      for (const g of goods) {
        const st = b.stock[g];
        h += `<tr><td>${goodName(g)}</td><td class="r">${num(st.qty)}</td><td>${qBadge(st.q)}</td>
          <td class="r">${G.sellPrice(s, g, st.q)}</td>
          <td><button class="btn small" data-act="sell" data-good="${g}">Продать</button></td></tr>`;
      }
      h += '</table>';
    }
    if (b.type !== 'shop') {
      const sellable = new Set([...goods, ...(b.recipe ? [b.recipe] : [])]);
      h += `<div class="box"><h4>Автопродажа на оптовый рынок</h4>
        ${[...sellable].map(g => `<label class="row"><input type="checkbox" data-act="autosell" data-good="${g}" ${b.autoSell[g] ? 'checked' : ''}> ${goodName(g)} — продавать всё в конце дня</label>`).join('') || '<span class="hint">Нечего продавать</span>'}
        </div>`;
    }
    const buyList = Object.keys(b.buy);
    h += `<div class="box"><h4>Закупка на рынке (каждый день)</h4>
      ${buyList.map(g => `<div class="row">${goodName(g)} <input type="number" min="0" value="${b.buy[g]}" data-act="buyqty" data-good="${g}"> шт. по ${G.buyPrice(s, g)} ₽
        <button class="btn small" data-act="buydel" data-good="${g}">✕</button></div>`).join('')}
      <div class="row"><select id="buyGood">${Object.keys(GOODS).filter(g => !b.buy[g] && (b.type !== 'shop' || GOODS[g].kind === 'retail')).map(g => `<option value="${g}">${goodName(g)} — ${G.buyPrice(s, g)} ₽</option>`).join('')}</select>
      <input type="number" id="buyQty" min="1" value="100"><button class="btn small primary" data-act="buyadd">Добавить</button></div>
      <p class="hint">Рыночный товар — качества 2.0 и с наценкой ${Math.round((IMPORT_MARKUP - 1) * 100)}%. Своё производство выгоднее.</p></div>`;
    return h;
  }

  tab_supply(b) {
    const s = this.s;
    const out = s.contracts.filter(c => c.from === b.id), inc = s.contracts.filter(c => c.to === b.id);
    const others = Object.values(s.buildings).filter(x => x.id !== b.id && x.type !== 'lab');
    const goods = [...new Set([...(b.recipe && RECIPES[b.recipe].building === b.type ? [b.recipe] : []), ...Object.keys(b.stock)])];
    const line = (c, other) => `<div class="row">${goodName(c.good)} · ${num(c.qty)} шт./день ${other}
      <button class="btn small" data-act="cdel" data-id="${c.id}">✕</button></div>`;
    let h = `<div class="box"><h4>Отправляем</h4>${out.map(c => line(c, `→ ${bName(s.buildings[c.to])}`)).join('') || '<span class="hint">Нет</span>'}</div>
      <div class="box"><h4>Получаем</h4>${inc.map(c => line(c, `← ${bName(s.buildings[c.from])}`)).join('') || '<span class="hint">Нет</span>'}</div>`;
    if (!others.length) return h + '<p class="hint">Постройте ещё одно здание, чтобы возить товары между ними.</p>';
    if (!goods.length) return h + '<p class="hint">Здесь пока нечего отправлять.</p>';
    h += `<div class="box"><h4>Новая поставка</h4>
      <div class="row"><label>Товар</label><select id="cGood">${goods.map(g => `<option value="${g}">${goodName(g)}</option>`).join('')}</select></div>
      <div class="row"><label>Куда</label><select id="cTo">${others.map(x => `<option value="${x.id}">${bName(x)} (${G.dist(b, x)} кл.)</option>`).join('')}</select></div>
      <div class="row"><label>Сколько</label><input type="number" id="cQty" min="1" value="${b.recipe && RECIPES[b.recipe].building === b.type ? G.productionInfo(s, b).maxOut || 100 : 100}"> шт./день</div>
      <button class="btn primary" data-act="cadd">Создать поставку</button>
      <p class="hint">Доставка: ${String(TRANSPORT_PER_UNIT).replace('.', ',')} ₽ за единицу на клетку пути. Поставки выполняются каждое утро.</p></div>`;
    return h;
  }

  tab_shop(b) {
    const s = this.s;
    const goods = Object.keys(GOODS).filter(g => GOODS[g].kind === 'retail');
    const p = s.plots[G.key(b.i, b.j)];
    let h = `<div class="kv"><span>Проходимость</span><span>${p.loc.toFixed(2)}</span>
      <span>Пропускная способность</span><span>${num(b.workers * SHOP_UNITS_PER_WORKER * G.salaryEff(s, b))} покупок/день</span></div>
      <table><tr><th>Товар</th><th class="r">Есть</th><th>Кач.</th><th class="r">Продано</th><th>Цена</th></tr>`;
    for (const g of goods) {
      const st = b.stock[g];
      const price = b.prices[g] ?? GOODS[g].price;
      h += `<tr><td>${goodName(g)}</td><td class="r">${num(st?.qty || 0)}</td><td>${st ? qBadge(st.q) : '—'}</td>
        <td class="r">${num(b.last.sold[g] || 0)}</td>
        <td><input type="number" min="1" value="${price}" data-act="price" data-good="${g}" style="width:76px"></td></tr>`;
    }
    h += `</table><p class="hint">У конкурентов цена ≈ рыночной (${goods.map(g => `${GOODS[g].icon}${Math.round(s.prices[g])}`).join(' ')}), качество ${NPC_QUALITY}.
      Дешевле и качественнее — больше покупателей. Слишком дорого — товар не берут.</p>`;
    return h;
  }

  tab_lab(b) {
    const s = this.s;
    const cur = b.research;
    let h = `<div class="box"><h4>Текущее исследование</h4>
      <select data-act="research"><option value="">— выберите —</option>${Object.keys(GOODS).map(g => `<option value="${g}" ${g === cur ? 'selected' : ''}>${goodName(g)} (ур. ${s.tech[g]})</option>`).join('')}</select>`;
    if (cur) {
      const need = G.researchCost(s.tech[cur]);
      const speed = b.workers * G.salaryEff(s, b) * b.level;
      h += `<div class="kv"><span>Прогресс</span><span>${num(b.progress)} / ${num(need)}</span>
        <span>Скорость</span><span>${speed.toFixed(1)} очков/день</span>
        <span>Осталось</span><span>${speed > 0 ? Math.ceil((need - b.progress) / speed) + ' дн.' : '∞'}</span></div>
        <div class="bar"><i style="width:${(b.progress / need) * 100}%"></i></div>`;
    }
    h += `</div><p class="hint">Каждый уровень технологии повышает качество товара на 0,8. Качественные товары лучше продаются и дороже стоят на опте.</p>
      <table><tr><th>Технология</th><th class="r">Уровень</th></tr>${Object.keys(GOODS).filter(g => s.tech[g] > 0).map(g => `<tr><td>${goodName(g)}</td><td class="r">${s.tech[g]}</td></tr>`).join('') || '<tr><td colspan="2" class="hint">Пока ничего не изучено</td></tr>'}</table>`;
    return h;
  }

  // ---------- действия ----------
  curB() { return this.sel ? G.buildingAt(this.s, this.sel.i, this.sel.j) : null; }

  onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t || t.tagName === 'SELECT' || t.tagName === 'INPUT') return;
    const act = t.dataset.act, s = this.s, b = this.curB();
    const run = fn => { const r = this.app.act(fn); if (r?.error) this.toast(r.error, true); return r; };
    switch (act) {
      case 'close': this.app.select(null); break;
      case 'tab': this.tab = t.dataset.tab; this.renderSide(true); break;
      case 'build': {
        const r = run(() => G.build(s, t.dataset.type, this.sel.i, this.sel.j));
        if (r?.building) { this.toast(`${BUILDINGS[r.building.type].icon} ${BUILDINGS[r.building.type].name} построен!`); this.app.world.floatText(this.sel.i, this.sel.j, '−' + fmt(r.building.invested), 'neg'); }
        this.renderSide(true); break;
      }
      case 'upgrade': run(() => G.upgrade(s, b.id)); this.renderSide(true); break;
      case 'demolish':
        if (confirm('Продать здание? Вернётся 40% вложений, поставки удалятся.')) { run(() => G.demolish(s, b.id)); this.renderSide(true); }
        break;
      case 'sell': {
        const sum = this.app.act(() => G.sellToMarket(s, b, t.dataset.good, Infinity));
        if (sum) { this.toast(`Продано на ${fmt(sum)}`); this.app.world.floatText(b.i, b.j, '+' + fmt(sum)); }
        this.renderSide(true); break;
      }
      case 'buyadd': {
        const g = $('#buyGood')?.value, q = +$('#buyQty').value;
        if (g && q > 0) this.app.act(() => { b.buy[g] = q; });
        this.renderSide(true); break;
      }
      case 'buydel': this.app.act(() => { delete b.buy[t.dataset.good]; }); this.renderSide(true); break;
      case 'cadd': {
        const r = run(() => G.addContract(s, b.id, +$('#cTo').value, $('#cGood').value, +$('#cQty').value));
        if (r?.ok) this.toast('🚚 Поставка создана');
        this.renderSide(true); break;
      }
      case 'cdel': this.app.act(() => G.removeContract(s, +t.dataset.id)); this.renderSide(true); if (this.win) this.openWin(this.win); break;
      case 'goto': { this.closeWin(); const x = s.buildings[t.dataset.id]; this.app.select(x.i, x.j, true); break; }
      case 'loan': run(() => G.takeLoan(s, +$('#loanAmt').value)); this.openWin('bank'); break;
      case 'repay': this.app.act(() => G.repayLoan(s, +$('#loanAmt').value)); this.openWin('bank'); break;
      case 'newgame':
        if (confirm('Начать заново? Текущий прогресс будет удалён.')) this.app.newGame();
        break;
      case 'rename': {
        const n = prompt('Название компании', s.company);
        if (n && n.trim()) { this.app.act(() => { s.company = n.trim().slice(0, 40); }); this.openWin('company'); }
        break;
      }
    }
  }

  onChange(e) {
    const t = e.target, act = t.dataset.act, b = this.curB();
    if (!act) return;
    this.app.act(() => {
      switch (act) {
        case 'recipe': b.recipe = t.value; break;
        case 'target': b.target = +t.value; break;
        case 'salary': b.salary = Math.max(1, Math.round(+t.value || 1)); break;
        case 'autosell': b.autoSell[t.dataset.good] = t.checked; break;
        case 'buyqty': b.buy[t.dataset.good] = Math.max(0, +t.value || 0); break;
        case 'price': b.prices[t.dataset.good] = Math.max(1, +t.value || 1); break;
        case 'research': b.research = t.value || null; b.progress = 0; break;
      }
    });
    t.blur();
    this.renderSide(true);
  }

  // ---------- окна ----------
  openWin(name) {
    this.win = name;
    const s = this.s;
    const titles = { company: '📊 Компания', contracts: '🚚 Поставки', market: '💹 Оптовый рынок', rating: '🏆 Рейтинг компаний', quests: '🎯 Задания', bank: '🏦 Банк', help: '❔ Как играть' };
    $('#modalTitle').textContent = titles[name];
    $('#modalBody').innerHTML = this[`win_${name}`](s);
    $('#modal').hidden = false;
    if (name === 'company') this.drawChart();
  }
  closeWin() { this.win = null; $('#modal').hidden = true; }
  refreshWin() { if (this.win && !$('#modalBody').contains(document.activeElement)) { const top = $('.win').scrollTop; this.openWin(this.win); $('.win').scrollTop = top; } }

  win_company(s) {
    const list = Object.values(s.buildings);
    const last = s.history[s.history.length - 1];
    let h = `<div class="row"><b style="font-size:18px">${esc(s.company)}</b><button class="btn small" data-act="rename">✎ Переименовать</button></div>
      <div class="kv"><span>Деньги</span><span>${fmt(s.money)}</span><span>Кредит</span><span>${fmt(s.loan)}</span>
      <span>Капитал</span><span>${fmt(G.netWorth(s))}</span><span>Вчера: доход / расход</span><span>${fmt(last.income)} / ${fmt(last.expense)}</span></div>
      <canvas class="chart" id="chart"></canvas><p class="hint">Синяя линия — капитал, зелёная — деньги на счету.</p>`;
    if (!list.length) return h + '<p>У вас пока нет предприятий. Кликните по участку с жёлтой табличкой на карте.</p>';
    h += `<table><tr><th>Здание</th><th>Что делает</th><th class="r">Штат</th><th class="r">Выручка</th><th class="r">Прибыль</th></tr>`;
    for (const b of list) {
      const what = b.type === 'lab' ? (b.research ? 'исследует ' + GOODS[b.research].name : '—') : b.type === 'shop' ? 'торговля' : b.type === 'warehouse' ? 'хранение' : goodName(b.recipe);
      const p = b.last.revenue - b.last.expense;
      h += `<tr><td><a href="#" data-act="goto" data-id="${b.id}">${bName(b)}</a> <span class="lvl">${b.level}</span></td><td>${what}</td>
        <td class="r">${b.workers}</td><td class="r">${fmt(b.last.revenue)}</td><td class="r ${p >= 0 ? 'pos' : 'neg'}">${fmt(p)}</td></tr>`;
    }
    return h + `</table><div class="actions"><button class="btn danger" data-act="newgame">Начать новую игру</button></div>`;
  }

  drawChart() {
    const c = $('#chart'); if (!c) return;
    const s = this.s, dpr = devicePixelRatio || 1;
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const W = c.clientWidth, H = c.clientHeight, pad = 8;
    const h = s.history;
    if (h.length < 2) { x.fillStyle = '#94a3b8'; x.fillText('Данные появятся через пару дней', 10, 20); return; }
    const vals = h.flatMap(p => [p.worth, p.money]);
    const lo = Math.min(0, ...vals), hi = Math.max(...vals) * 1.05;
    const X = n => pad + (n / (h.length - 1)) * (W - pad * 2), Y = v => H - pad - ((v - lo) / (hi - lo || 1)) * (H - pad * 2);
    x.strokeStyle = 'rgba(148,163,184,.2)';
    x.beginPath(); x.moveTo(pad, Y(0)); x.lineTo(W - pad, Y(0)); x.stroke();
    for (const [k, col] of [['worth', '#3b82f6'], ['money', '#22c55e']]) {
      x.strokeStyle = col; x.lineWidth = 2.5; x.beginPath();
      h.forEach((p, n) => n ? x.lineTo(X(n), Y(p[k])) : x.moveTo(X(n), Y(p[k])));
      x.stroke();
    }
    x.fillStyle = '#94a3b8'; x.font = '12px system-ui';
    x.fillText(fmt(hi), pad + 2, 14); x.fillText(`день ${h[0].day}–${h[h.length - 1].day}`, W - 110, H - 12);
  }

  win_contracts(s) {
    if (!s.contracts.length) return '<p>Поставок пока нет. Откройте здание → вкладка «Поставки», чтобы возить сырьё на завод, а товары — в магазин.</p>';
    return `<table><tr><th>Откуда</th><th>Куда</th><th>Товар</th><th class="r">В день</th><th class="r">Доставка</th><th></th></tr>
      ${s.contracts.map(c => {
        const A = s.buildings[c.from], B = s.buildings[c.to];
        return `<tr><td>${bName(A)}</td><td>${bName(B)}</td><td>${goodName(c.good)}</td><td class="r">${num(c.qty)}</td>
          <td class="r">${fmt(c.qty * TRANSPORT_PER_UNIT * G.dist(A, B))}</td><td><button class="btn small" data-act="cdel" data-id="${c.id}">✕</button></td></tr>`;
      }).join('')}</table>`;
  }

  win_market(s) {
    const kinds = { raw: 'Сырьё', mid: 'Полуфабрикаты', retail: 'Потребительские товары' };
    let h = `<p class="hint">Покупка — с наценкой ${Math.round((IMPORT_MARKUP - 1) * 100)}%, качество 2.0. Продажа — ${Math.round(WHOLESALE_RATE * 100)}% цены, с поправкой на качество (ниже указано для качества 3).</p>`;
    for (const k in kinds) {
      h += `<h3>${kinds[k]}</h3><table><tr><th>Товар</th><th class="r">Цена</th><th class="r">Изм.</th><th class="r">Купить</th><th class="r">Продать</th><th>Событие</th></tr>`;
      for (const g in GOODS) {
        if (GOODS[g].kind !== k) continue;
        const ch = (s.prices[g] / GOODS[g].price - 1) * 100;
        const ev = s.priceMods[g] ? `цена ×${s.priceMods[g].mult} (${s.priceMods[g].days} дн.)` : s.demandMods[g] ? `спрос ×${s.demandMods[g].mult} (${s.demandMods[g].days} дн.)` : '';
        h += `<tr><td>${goodName(g)}</td><td class="r">${s.prices[g].toFixed(1)}</td><td class="r ${ch >= 0 ? 'pos' : 'neg'}">${ch >= 0 ? '+' : ''}${ch.toFixed(0)}%</td>
          <td class="r">${G.buyPrice(s, g)}</td><td class="r">${G.sellPrice(s, g)}</td><td class="hint">${ev}</td></tr>`;
      }
      h += '</table>';
    }
    h += '<h3>Цепочки производства</h3><table><tr><th>Товар</th><th>Где</th><th>Из чего</th><th class="r">Мощн./день</th></tr>';
    for (const r in RECIPES) {
      const R = RECIPES[r];
      h += `<tr><td>${goodName(r)}</td><td>${BUILDINGS[R.building].name}</td><td>${Object.entries(R.inputs).map(([g, k]) => `${k}×${GOODS[g].icon}`).join(' + ') || '—'}</td><td class="r">${R.rate}</td></tr>`;
    }
    return h + '</table>';
  }

  win_rating(s) {
    return `<table><tr><th>#</th><th>Компания</th><th class="r">Капитал</th></tr>
      ${G.rating(s).map((r, n) => `<tr class="${r.player ? 'me' : ''}"><td>${n + 1}</td><td><span style="color:${r.color}">■</span> ${esc(r.name)}</td><td class="r">${fmt(r.worth)}</td></tr>`).join('')}</table>
      <p class="hint">Конкуренты растут каждый день. Обгоните всех!</p>`;
  }

  win_quests(s) {
    return G.QUESTS.map(q => `<div class="quest ${s.quests[q.id] ? 'done' : ''}"><span class="ic">${s.quests[q.id] ? '✅' : '⬜'}</span>
      <span>${esc(q.text)}</span><span class="rw">+${fmt(q.reward)}</span></div>`).join('');
  }

  win_bank(s) {
    const max = G.maxLoan(s);
    return `<div class="kv"><span>Текущий долг</span><span>${fmt(s.loan)}</span><span>Проценты</span><span>0,1% в день (${fmt(s.loan * 0.001)}/день)</span>
      <span>Доступно к займу</span><span>${fmt(max)}</span></div>
      <div class="row"><input type="number" id="loanAmt" min="1000" step="1000" value="${Math.max(1000, Math.min(50000, max || 50000))}" style="width:140px"> ₽
      <button class="btn primary" data-act="loan" ${max <= 0 ? 'disabled' : ''}>Взять</button>
      <button class="btn" data-act="repay" ${s.loan <= 0 ? 'disabled' : ''}>Погасить</button></div>
      <p class="hint">Банк даёт до половины капитала. Если деньги на счету 15 дней подряд в минусе — банкротство.</p>`;
  }

  win_help() {
    return `<div class="help">
      <h3>Цель</h3><p>Построить самую дорогую компанию города и обогнать конкурентов в рейтинге.</p>
      <h3>Управление</h3><p>Мышь: левая кнопка — двигать карту, правая — вращать, колесо — масштаб. Телефон: один палец — двигать, два — масштаб и поворот. Клик по участку — информация и строительство. Пробел — пауза.</p>
      <h3>С чего начать</h3><p>1. Постройте ферму на окраине (земля дешевле) и выберите, что выращивать.<br>
      2. Постройте завод: например, мука из зерна, затем хлеб из муки.<br>
      3. Настройте поставки: ферма → завод → магазин (вкладка «Поставки» в здании).<br>
      4. Откройте магазин ближе к центру — там больше покупателей, и поставьте цены.<br>
      5. Лишнее продавайте на оптовом рынке (вкладка «Склад», автопродажа).</p>
      <h3>Качество</h3><p>Зависит от технологий (НИИ), качества сырья и зарплаты сотрудников. Конкуренты продают товары качества 3.</p>
      <h3>Деньги</h3><p>Каждый день платятся зарплаты, содержание зданий и налог на землю. Следите за прибылью в «Компании». Нужны деньги — банк выдаст кредит.</p></div>`;
  }
}
