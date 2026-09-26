'use strict';

const SETTINGS = ['fio', 'branch', 'assignment', 'office', 'rate', 'orderType', 'segment', 'projectCode', 'org', 'inn'];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const $ = (id) => document.getElementById(id);

const state = {
  tasks: [],   // все задания из выгрузки
  days: [],    // [{ key: 'YYYY-MM-DD', rows: [{ kind: 'base'|'task'|'return', addr, num, time, km }] }]
};

/* ---------- localStorage (может быть недоступен) ---------- */

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

const kmMemory = load('ml.km', {});      // "адрес→адрес": км
const geoCache = load('ml.geo', {});     // адрес: [lon, lat] | null

function normAddr(a) {
  return String(a || '').toLowerCase().replace(/ё/g, 'е').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}
function pairKey(a, b) { return normAddr(a) + '→' + normAddr(b); }
function rememberKm(a, b, km) {
  if (km === '' || km == null || isNaN(km)) return;
  kmMemory[pairKey(a, b)] = km;
  kmMemory[pairKey(b, a)] = km;
  save('ml.km', kmMemory);
}
function recallKm(a, b) {
  if (normAddr(a) === normAddr(b)) return 0;
  const v = kmMemory[pairKey(a, b)];
  return v == null ? '' : v;
}

/* ---------- настройки ---------- */

function initSettings() {
  const saved = load('ml.settings', {});
  for (const k of SETTINGS) {
    if (saved[k] != null && saved[k] !== '') $(k).value = saved[k];
    $(k).addEventListener('change', () => {
      saveSettings();
      if (k === 'fio') { rebuildMonths(); rebuildDays(); }
      else if (k === 'office') rebuildDays();
      else renderTotals();
    });
  }
}
function saveSettings() {
  const s = {};
  for (const k of SETTINGS) s[k] = $(k).value;
  save('ml.settings', s);
}
function settings() {
  const s = {};
  for (const k of SETTINGS) s[k] = $(k).value.trim();
  s.rate = parseFloat(String(s.rate).replace(',', '.')) || 0;
  return s;
}

/* ---------- чтение выгрузки ---------- */

function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return cellText(v.result);
    if (v.text) return v.text;
    return '';
  }
  return String(v).trim();
}

function parseDate(v) {
  if (v instanceof Date) {
    return new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), v.getUTCHours(), v.getUTCMinutes(), v.getUTCSeconds());
  }
  if (typeof v === 'number') { // серийная дата Excel
    return parseDate(new Date(Math.round((v - 25569) * 86400000)));
  }
  const m = String(v).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\D+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const iso = String(v).match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] || 0), +(iso[5] || 0));
  return null;
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthKey(d) { return dayKey(d).slice(0, 7); }

async function readExport(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  for (const ws of wb.worksheets) {
    const found = findColumns(ws);
    if (!found) continue;
    const { headerRow, cols } = found;
    const tasks = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (c) => (c ? cellText(row.getCell(c).value) : '');
      const addr = get(cols.addr);
      const dt = parseDate(get(cols.date));
      if (!addr || !dt) continue;
      tasks.push({
        addr: String(addr),
        num: String(get(cols.num) || ''),
        execs: String(get(cols.exec) || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean),
        dt,
      });
    }
    if (tasks.length) return tasks;
  }
  throw new Error('Не нашёл таблицу с колонками «Адрес задания» и «Дата выполнения».');
}

function findColumns(ws) {
  for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
    const cols = {};
    ws.getRow(r).eachCell((cell, c) => {
      const t = String(cellText(cell.value)).toLowerCase();
      if (!cols.addr && t.includes('адрес')) cols.addr = c;
      else if (!cols.num && /номер (задания|наряда)|№ (задания|наряда)/.test(t)) cols.num = c;
      else if (!cols.exec && /исполнител|фио/.test(t)) cols.exec = c;
      else if (!cols.date && t.includes('дата')) cols.date = c;
    });
    if (cols.addr && cols.date) return { headerRow: r, cols };
  }
  return null;
}

/* ---------- построение маршрута ---------- */

function selectedTasks() {
  const fio = normAddr($('fio').value);
  const month = $('month').value;
  return state.tasks.filter((t) =>
    (!fio || t.execs.some((e) => normAddr(e) === fio)) && (!month || monthKey(t.dt) === month));
}

function rebuildFio() {
  const counts = new Map();
  for (const t of state.tasks) for (const e of t.execs) counts.set(e, (counts.get(e) || 0) + 1);
  const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  $('fioList').innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
  const cur = normAddr($('fio').value);
  if (!names.some((n) => normAddr(n) === cur) && names.length) {
    $('fio').value = names[0];
    saveSettings();
  }
}

function rebuildMonths() {
  const fio = normAddr($('fio').value);
  const counts = new Map();
  for (const t of state.tasks) {
    if (fio && !t.execs.some((e) => normAddr(e) === fio)) continue;
    const k = monthKey(t.dt);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const keys = [...counts.keys()].sort();
  const prev = $('month').value;
  $('month').innerHTML = keys.map((k) => {
    const [y, m] = k.split('-');
    return `<option value="${k}">${MONTHS[+m - 1]} ${y} — заданий: ${counts.get(k)}</option>`;
  }).join('');
  if (keys.includes(prev)) $('month').value = prev;
  else if (keys.length) $('month').value = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function rebuildDays() {
  const office = $('office').value.trim();
  const byDay = new Map();
  for (const t of selectedTasks().sort((a, b) => a.dt - b.dt)) {
    const k = dayKey(t.dt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(t);
  }
  state.days = [...byDay.keys()].sort().map((k) => {
    const rows = [{ kind: 'base', addr: office, num: '', time: '', km: 0 }];
    for (const t of byDay.get(k)) {
      rows.push({ kind: 'task', addr: t.addr, num: t.num, time: fmtTime(t.dt), km: '' });
    }
    rows.push({ kind: 'return', addr: office, num: '', time: '', km: '' });
    return { key: k, rows };
  });
  recalcFromMemory();
  render();
}

// подставить запомненные расстояния туда, где пусто
function recalcFromMemory() {
  for (const day of state.days) {
    day.rows[0].km = 0;
    for (let i = 1; i < day.rows.length; i++) {
      if (day.rows[i].km === '') day.rows[i].km = recallKm(day.rows[i - 1].addr, day.rows[i].addr);
    }
  }
}

/* ---------- отрисовка ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtTime(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function fmtDay(k) {
  const [y, m, d] = k.split('-').map(Number);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}, ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`;
}
function money(x) { return x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'; }
function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }

function render() {
  const has = state.days.length > 0;
  $('routeCard').hidden = !has;
  $('exportCard').hidden = !has;
  $('days').innerHTML = state.days.map((day, di) => `
    <div class="day">
      <h3>${fmtDay(day.key)} <span class="dsum" data-dsum="${di}"></span></h3>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Адрес</th><th>Время</th><th>Номер наряда</th><th>Км</th><th></th></tr></thead>
        <tbody>${day.rows.map((r, ri) => rowHtml(r, di, ri, day.rows.length)).join('')}</tbody>
      </table></div>
    </div>`).join('');
  renderTotals();
}

function rowHtml(r, di, ri, n) {
  const label = r.kind === 'base' ? 'Выезд с базы' : r.kind === 'return' ? 'Возврат на базу' : '';
  const isTask = r.kind === 'task';
  return `<tr class="${isTask ? '' : 'base'}">
    <td>${ri + 1}</td>
    <td class="addr">${esc(r.addr)}${label ? ` <small>· ${label}</small>` : ''}</td>
    <td class="time">${esc(r.time)}</td>
    <td>${esc(r.num)}</td>
    <td class="num"><input type="number" min="0" step="1" value="${esc(r.km)}" data-km="${di}:${ri}" ${ri === 0 ? 'disabled' : ''}></td>
    <td class="act">${isTask ? `
      <button class="icon" title="Выше" data-move="${di}:${ri}:-1" ${ri <= 1 ? 'disabled' : ''}>↑</button>
      <button class="icon" title="Ниже" data-move="${di}:${ri}:1" ${ri >= n - 2 ? 'disabled' : ''}>↓</button>
      <button class="icon" title="Убрать из отчёта" data-del="${di}:${ri}">✕</button>` : ''}</td>
  </tr>`;
}

function renderTotals() {
  const rate = settings().rate;
  let km = 0, missing = 0;
  state.days.forEach((day, di) => {
    let dkm = 0;
    day.rows.forEach((r, ri) => { if (ri > 0 && r.km === '') missing++; dkm += num(r.km); });
    km += dkm;
    const el = document.querySelector(`[data-dsum="${di}"]`);
    if (el) el.textContent = `${dkm} км · ${money(dkm * rate)}`;
  });
  const tasks = state.days.reduce((s, d) => s + d.rows.filter((r) => r.kind === 'task').length, 0);
  $('totals').innerHTML = `<span>Дней: <b>${state.days.length}</b></span><span>Заданий: <b>${tasks}</b></span>
    <span>Пробег: <b>${km} км</b></span><span>Сумма: <b>${money(km * rate)}</b></span>`;
  $('warn').textContent = missing ? `Не заполнено км: ${missing}` : '';
}

/* ---------- события таблицы ---------- */

function onDaysInput(e) {
  const k = e.target.dataset.km;
  if (!k) return;
  const [di, ri] = k.split(':').map(Number);
  const rows = state.days[di].rows;
  const v = e.target.value === '' ? '' : num(e.target.value);
  rows[ri].km = v;
  if (e.type === 'change') rememberKm(rows[ri - 1].addr, rows[ri].addr, v);
  renderTotals();
}

function onDaysClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.move) {
    const [di, ri, dir] = b.dataset.move.split(':').map(Number);
    const rows = state.days[di].rows;
    [rows[ri], rows[ri + dir]] = [rows[ri + dir], rows[ri]];
    resetKmAround(rows, [ri, ri + dir]);
  } else if (b.dataset.del) {
    const [di, ri] = b.dataset.del.split(':').map(Number);
    const rows = state.days[di].rows;
    rows.splice(ri, 1);
    resetKmAround(rows, [ri - 1]);
    if (!rows.some((r) => r.kind === 'task')) state.days.splice(di, 1);
  } else return;
  recalcFromMemory();
  render();
}

// после перестановки/удаления расстояния у соседних строк меняются — сбрасываем
function resetKmAround(rows, idxs) {
  for (const i of idxs) for (const j of [i, i + 1]) if (j > 0 && rows[j]) rows[j].km = '';
}

/* ---------- автоподсчёт километров (OpenStreetMap: Nominatim + OSRM) ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastNominatim = 0;

function parseRuAddress(addr) {
  let s = ' ' + addr.replace(/\s+/g, ' ') + ' ';
  s = s.replace(/\s(кв|оф|пом|комн)\.?\s*\S+/gi, ' ');
  const city = (s.match(/\sг\.\s*([^,]+?)\s(?=(ул|пр-кт|пр|пер|б-р|бул|ш|пл|наб|проезд|мкр|тракт|туп)\.?\s)/i) || [])[1] || 'Воронеж';
  const streetM = s.match(/\s(ул|пр-кт|пр|пер|б-р|бул|ш|пл|наб|проезд|мкр|тракт|туп)\.?\s(.+?)(?=\sд\.|\s\d|\s*$)/i);
  const houseM = s.match(/\sд\.\s*([^\s,]+)/i) || s.match(/\s(\d+[А-Яа-я]?(?:\/\d+)?)\s*$/);
  const korpM = s.match(/\s(?:корп|стр|к)(?:\.\s*|\s+)([^\s,]+)/i);
  const types = { 'ул': 'улица', 'пр-кт': 'проспект', 'пр': 'проспект', 'пер': 'переулок', 'б-р': 'бульвар', 'бул': 'бульвар', 'ш': 'шоссе', 'пл': 'площадь', 'наб': 'набережная', 'проезд': 'проезд', 'мкр': 'микрорайон', 'тракт': 'тракт', 'туп': 'тупик' };
  const title = (w) => w.toLowerCase().replace(/(^|[\s-])([а-яёa-z])/g, (m, a, b) => a + b.toUpperCase());
  return {
    city: title(city.trim()),
    type: streetM ? types[streetM[1].toLowerCase()] : '',
    street: streetM ? title(streetM[2].trim()) : '',
    house: houseM ? houseM[1] : '',
    korp: korpM ? korpM[1] : '',
  };
}

async function nominatim(params) {
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastNominatim = Date.now();
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'ru', 'accept-language': 'ru', ...params });
  const res = await fetch(url);
  if (!res.ok) throw new Error('Nominatim: ' + res.status);
  const data = await res.json();
  return data.length ? [+data[0].lon, +data[0].lat] : null;
}

async function geocode(addr) {
  const key = normAddr(addr);
  if (key in geoCache && geoCache[key]) return geoCache[key];
  const p = parseRuAddress(addr);
  const houses = [];
  if (p.house && p.korp) houses.push(/^\d+$/.test(p.korp) ? `${p.house}к${p.korp}` : `${p.house}${p.korp}`);
  if (p.house) houses.push(p.house);
  let pt = null;
  for (const h of houses) {
    pt = await nominatim({ street: `${h} ${p.street} ${p.type}`.trim(), city: p.city });
    if (pt) break;
  }
  if (!pt && p.street) pt = await nominatim({ q: `${p.city}, ${p.street} ${p.type} ${p.house}`.trim() });
  if (!pt && p.street) pt = await nominatim({ q: `${p.city}, ${p.type} ${p.street}` });
  geoCache[key] = pt;
  save('ml.geo', geoCache);
  return pt;
}

async function routeLegs(points) {
  const coords = points.map((p) => p.join(',')).join(';');
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
  if (!res.ok) throw new Error('OSRM: ' + res.status);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('OSRM: ' + data.code);
  return data.routes[0].legs.map((l) => l.distance / 1000);
}

async function autoKm() {
  const btn = $('autoKm');
  const status = $('autoStatus');
  btn.disabled = true;
  const failed = new Set();
  try {
    const addrs = [...new Set(state.days.flatMap((d) => d.rows.map((r) => r.addr)))];
    let i = 0;
    for (const a of addrs) {
      status.textContent = `Ищу адреса на карте: ${++i} из ${addrs.length}…`;
      try { if (!(await geocode(a))) failed.add(a); } catch { failed.add(a); }
    }
    let filled = 0;
    for (const [di, day] of state.days.entries()) {
      status.textContent = `Строю маршруты: день ${di + 1} из ${state.days.length}…`;
      // считаем по отрезкам, где обе точки найдены на карте
      for (let r = 1; r < day.rows.length; r++) {
        const row = day.rows[r];
        if (row.km !== '') continue;
        const a = geoCache[normAddr(day.rows[r - 1].addr)];
        const b = geoCache[normAddr(row.addr)];
        if (!a || !b) continue;
        try {
          const [d] = await routeLegs([a, b]);
          row.km = normAddr(day.rows[r - 1].addr) === normAddr(row.addr) ? 0 : Math.max(1, Math.round(d));
          filled++;
        } catch { /* оставляем пустым */ }
      }
    }
    render();
    status.textContent = `Готово: заполнено ${filled}.` +
      (failed.size ? ` Не найдены на карте (${failed.size}): ${[...failed].join('; ')} — введите км вручную.` : '');
  } catch (e) {
    status.textContent = 'Ошибка автоподсчёта: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

/* ---------- выгрузка в Excel ---------- */

const THIN = { style: 'thin' };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const RUB = '#,##0.00" ₽"';

function styleRange(ws, r, c1, c2, st) {
  for (let c = c1; c <= c2; c++) Object.assign(ws.getCell(r, c), st);
}

function utcDate(k) { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }

async function buildWorkbook() {
  const s = settings();
  const month = $('month').value;
  const wb = new ExcelJS.Workbook();
  const font = { name: 'Calibri', size: 12 };

  // Раздел 1
  const ws = wb.addWorksheet('Отчет о служебных поездках');
  ws.columns = [44.7, 19.9, 37, 13, 6.3, 63, 19.6, 23.4, 15.7, 13.4, 13, 14, 16].map((width) => ({ width }));
  ws.getCell('A1').value = 'ИНН организации';
  ws.getCell('B1').value = s.inn;
  ws.getCell('A2').value = 'Организация:';
  ws.getCell('B2').value = s.org;
  ws.getCell('A3').value = 'Дата составления отчета:';
  const now = new Date();
  ws.getCell('B3').value = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  ws.getCell('B3').numFmt = 'dd.mm.yyyy';
  ws.getCell('A6').value = 'Отчет о служебных поездках за';
  ws.getCell('B6').value = utcDate(month + '-01');
  ws.getCell('B6').numFmt = '[$-419]mmmm yyyy;@';
  ws.getCell('B7').value = 'месяц и год';
  ws.getCell('M8').value = 'Раздел 1';
  ws.getCell('A9').value = 'Детализация маршрута:';
  for (const a of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'A6', 'B6', 'A9', 'M8']) ws.getCell(a).font = { ...font, bold: a === 'A6' || a === 'B6' };
  ws.getCell('B1').alignment = { horizontal: 'left' };

  const headers = ['Филиал', 'Номер назначения', 'ФИО', 'Дата', '№', 'Адрес назначения', 'Код проекта', 'Тип наряда', 'Сегмент', 'Расстояние, км', 'Затраты на 1 км., руб.', 'Сумма, руб.', 'Номер наряда'];
  const hr = ws.getRow(10);
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { ...font, bold: true };
    c.border = BOX;
    c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });
  hr.height = 34;

  let r = 11;
  const first = r;
  const assignment = /^\d+$/.test(s.assignment) ? Number(s.assignment) : s.assignment;
  for (const day of state.days) {
    day.rows.forEach((row, i) => {
      const x = ws.getRow(r);
      x.values = [s.branch, assignment, s.fio, utcDate(day.key), i + 1, row.addr, s.projectCode, s.orderType, s.segment,
        row.km === '' ? null : num(row.km), s.rate, null, row.num || null];
      x.getCell(12).value = { formula: `J${r}*K${r}` };
      x.eachCell({ includeEmpty: true }, (c, col) => {
        if (col > 13) return;
        c.font = font;
        c.border = BOX;
      });
      x.getCell(4).numFmt = 'dd.mm.yyyy';
      x.getCell(6).alignment = { wrapText: true };
      x.getCell(11).numFmt = RUB;
      x.getCell(12).numFmt = RUB;
      r++;
    });
  }
  const last = r - 1;
  const tot = ws.getRow(r);
  tot.getCell(1).value = 'ИТОГО';
  tot.getCell(10).value = { formula: `SUM(J${first}:J${last})` };
  tot.getCell(12).value = { formula: `SUM(L${first}:L${last})` };
  tot.getCell(12).numFmt = RUB;
  styleRange(ws, r, 1, 13, { font: { ...font, bold: true }, border: BOX });
  const totalRow = r;

  r += 2;
  ws.getCell(`A${r}`).value = 'Оплата топливной картой';
  ws.getCell(`B${r}`).value = { formula: "'Топливная карта'!G4" };
  ws.getCell(`B${r}`).border = BOX;
  ws.getCell(`C${r}`).value = 'руб.';
  r += 2;
  ws.getCell(`A${r}`).value = 'Предельная сумма для возмещения расходов работника, понесенных в связи с разъездным характером работы составляет';
  ws.getCell(`F${r}`).value = { formula: `L${totalRow}` };
  ws.getCell(`F${r}`).numFmt = RUB;
  ws.getCell(`F${r}`).border = BOX;
  ws.getCell(`G${r}`).value = 'руб.';
  r += 2;
  ws.getCell(`A${r}`).value = 'Документы, подтверждающие понесенные затраты, прикладываю к отчету. ';
  for (let i = totalRow + 1; i <= r; i++) ws.getRow(i).eachCell((c) => { c.font = font; });
  ws.views = [{ state: 'frozen', ySplit: 10 }];

  // Раздел 2
  const fuel = wb.addWorksheet('Топливная карта');
  fuel.columns = [34, 24, 14, 18, 18, 22, 24, 18].map((width) => ({ width }));
  fuel.getCell('A1').value = 'Расход топлива:';
  fuel.getCell('H1').value = 'Раздел 2';
  ['Название процессинговой компании:', 'Номер топливной карты:', 'Вид топлива', 'Лимит топлива, руб.', 'Получено топливо, л.',
    'Фактический расход топлива, л', 'Фактический расход топлива, руб.', 'Остаток топлива, л.*'].forEach((h, i) => {
    const c = fuel.getCell(3, i + 1);
    c.value = h; c.font = { bold: true }; c.border = BOX; c.alignment = { wrapText: true, vertical: 'middle' };
    fuel.getCell(4, i + 1).border = BOX;
  });

  // Раздел 3
  const pay = wb.addWorksheet('Реестр выплат');
  pay.columns = [16, 18, 30, 16, 16, 18, 14, 22, 14, 14, 14, 16].map((width) => ({ width }));
  pay.getCell('A1').value = 'Реестр выплат';
  pay.getCell('L1').value = 'Раздел 3';
  pay.getCell('A2').value = 'Заполняется, если распределение затрат отличается от указанного на назначении работника. Если распределение затрат, заданное на назначении работника, подходит, то заполнять данный реестр не требуется.';
  ['Филиал', 'Номер назначения', 'ФИО', 'Отчетный месяц', 'Статья затрат', 'Бизнес-процесс', 'Код проекта', 'Наименование проекта',
    'Код задачи', 'ШПП', 'Вид работ', '% распределения'].forEach((h, i) => {
    const c = pay.getCell(4, i + 1);
    c.value = h; c.font = { bold: true }; c.border = BOX; c.alignment = { wrapText: true, vertical: 'middle' };
  });
  for (let i = 5; i <= 10; i++) {
    pay.getCell(`D${i}`).value = { formula: "'Отчет о служебных поездках'!$B$6" };
    pay.getCell(`D${i}`).numFmt = '[$-419]mmmm yyyy;@';
    for (let c = 1; c <= 12; c++) pay.getCell(i, c).border = BOX;
  }
  pay.getCell('A11').value = 'ИТОГ';
  pay.getCell('L11').value = { formula: 'SUM(L5:L10)' };

  // Раздел 4
  const chk = wb.addWorksheet('Реестр чеков');
  chk.columns = [14, 30, 16, 12, 10, 24, 16, 36, 12, 12, 16, 12, 14, 18].map((width) => ({ width }));
  chk.getCell('A1').value = 'Реестр чеков, подтверждающих затраты';
  chk.getCell('N1').value = 'Раздел 4';
  chk.getCell('A2').value = 'Не заполнять! Заполнится автоматически!';
  ['Номер заявки', 'ФИО работника', 'Номер назначения', 'Дата чека', '№ чека', 'Поставщик', 'ИНН Поставщика',
    'Закупленная номенклатура товаров и услуг', 'Единица измерения', 'Количество', 'Цена, без НДС, руб.коп.', 'Ставка НДС',
    'НДС, руб.коп.', 'Стоимость с НДС, руб.коп.'].forEach((h, i) => {
    const c = chk.getCell(4, i + 1);
    c.value = h; c.font = { bold: true }; c.border = BOX; c.alignment = { wrapText: true, vertical: 'middle' };
  });
  chk.getCell('B12').value = 'ИТОГО';
  chk.getCell('M12').value = { formula: 'SUM(M5:M11)' };
  chk.getCell('N12').value = { formula: 'SUM(N5:N11)' };

  wb.calcProperties = { fullCalcOnLoad: true };
  return wb;
}

async function download() {
  const s = settings();
  if (!s.fio) { alert('Укажите ФИО'); return; }
  const wb = await buildWorkbook();
  const buf = await wb.xlsx.writeBuffer();
  const [y, m] = $('month').value.split('-');
  const surname = s.fio.split(/\s+/)[0] || 'отчет';
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Маршрутный лист ${surname} ${m}.${y}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- старт ---------- */

async function onFile(file) {
  if (!file) return;
  $('loadInfo').textContent = 'Читаю файл…';
  try {
    state.tasks = await readExport(file);
    $('loadInfo').textContent = `${file.name}: заданий — ${state.tasks.length}.`;
    $('filters').hidden = false;
    rebuildFio();
    rebuildMonths();
    rebuildDays();
  } catch (e) {
    $('loadInfo').textContent = 'Не удалось прочитать файл: ' + e.message;
  }
}

function init() {
  initSettings();
  $('file').addEventListener('change', (e) => onFile(e.target.files[0]));
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); onFile(e.dataTransfer.files[0]); });
  $('month').addEventListener('change', rebuildDays);
  $('days').addEventListener('input', onDaysInput);
  $('days').addEventListener('change', onDaysInput);
  $('days').addEventListener('click', onDaysClick);
  $('autoKm').addEventListener('click', autoKm);
  $('clearKm').addEventListener('click', () => {
    for (const d of state.days) d.rows.forEach((r, i) => { r.km = i === 0 ? 0 : ''; });
    render();
  });
  $('download').addEventListener('click', download);
}

init();
