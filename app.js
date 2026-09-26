'use strict';

const SETTINGS = [
  'fio',
  'branch',
  'assignment',
  'office',
  'rate',
  'orderType',
  'segment',
  'projectCode',
  'org',
  'inn',
  'kmMarkup'
];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const $ = (id) => document.getElementById(id);

const state = {
  sheets: [],  // [{ name, rows: [[значения ячеек]] }]
  sheet: 0,
  headerRow: -1,
  map: {},     // поле -> индекс колонки (-1 — нет)
  tasks: [],   // [{ addr, num, execs, dt }]
  days: [],    // [{ key: 'YYYY-MM-DD', rows: [{ kind: 'base'|'task'|'return', addr, num, time, km, src }] }]
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

const kmMemory = load('ml.km', {});       // "адрес→адрес": км, введённые вручную
const geoCache = load('ml.geo', {});      // адрес: { p: [lon, lat], exact: bool }
const routeCache = load('ml.route', {});  // "lon,lat;lon,lat": км
const geoMissSession = new Set();         // не найденные в этой сессии адреса

function normAddr(a) {
  return String(a || '').toLowerCase().replace(/ё/g, 'е').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}
function pairKey(a, b) { return normAddr(a) + '→' + normAddr(b); }
function rememberKm(a, b, km) {
  if (km === '') { delete kmMemory[pairKey(a, b)]; delete kmMemory[pairKey(b, a)]; }
  else { kmMemory[pairKey(a, b)] = km; kmMemory[pairKey(b, a)] = km; }
  save('ml.km', kmMemory);
}
function recallKm(a, b) {
  const v = kmMemory[pairKey(a, b)];
  return v == null ? '' : v;
}

/* ---------- настройки ---------- */

function initSettings() {
  const saved = load('ml.settings', {});

  for (const k of SETTINGS) {
    if (saved[k] != null && saved[k] !== '') {
      $(k).value = saved[k];
    }

    $(k).addEventListener('change', () => {
      saveSettings();

      if (k === 'fio') {
        rebuildMonths();
        rebuildDays();
      } else if (k === 'office') {
        onOfficeChange();
      } else if (k === 'kmMarkup') {
        recalcKmMarkup();
      } else {
        renderTotals();
      }

      markRequired();
    });
  }

  markRequired();
}
function saveSettings() {
  const s = {};
  for (const k of SETTINGS) s[k] = $(k).value;
  save('ml.settings', s);
}
function settings() {
  const s = {};

  for (const k of SETTINGS) {
    s[k] = $(k).value.trim();
  }

  s.rate =
    parseFloat(
      String(s.rate)
        .replace(',', '.')
        .replace(/\s/g, '')
    ) || 0;

  s.kmMarkup =
    parseFloat(
      String(s.kmMarkup)
        .replace(',', '.')
        .replace(/\s/g, '')
    ) || 0;

  s.kmMarkup = Math.max(0, s.kmMarkup);

  return s;
}
function markRequired() {
  $('office').classList.toggle('missing', !$('office').value.trim());
  $('rate').classList.toggle('missing', !settings().rate);
}

/* ---------- чтение выгрузки ---------- */

async function readFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { text = new TextDecoder('windows-1251').decode(buf); }
    wb = XLSX.read(text.replace(/^﻿/, ''), { type: 'string', raw: true, cellNF: true });
  } else {
    wb = XLSX.read(buf, { type: 'array', cellNF: true });
  }
  return wb.SheetNames.map((name) => ({ name, rows: sheetMatrix(wb.Sheets[name]) }));
}

function sheetMatrix(ws) {
  if (!ws || !ws['!ref']) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const out = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) row.push(cellValue(ws[XLSX.utils.encode_cell({ r, c })]));
    out.push(row);
  }
  return out;
}

function cellValue(cell) {
  if (!cell || cell.v == null) return '';
  if (cell.v instanceof Date) return cell.v;
  if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) {
    const p = XLSX.SSF.parse_date_code(cell.v);
    return new Date(p.y, p.m - 1, p.d, p.H, p.M, Math.floor(p.S));
  }
  if (cell.t === 'n') return cell.v;
  return String(cell.v).trim();
}

function parseDate(v) {
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v);
  let m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?:\D+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null;
    return new Date(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  m = s.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return null;
}
function parseTime(v) {
  if (v instanceof Date) return [v.getHours(), v.getMinutes()];
  if (typeof v === 'number' && v >= 0 && v < 1) { const min = Math.round(v * 1440); return [Math.floor(min / 60), min % 60]; }
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? [+m[1], +m[2]] : null;
}

/* ---------- определение колонок ---------- */

const FIELDS = [
  { key: 'addr', label: 'Адрес', required: true },
  { key: 'addr2', label: 'Адрес, часть 2 (если адрес разбит)' },
  { key: 'addr3', label: 'Адрес, часть 3' },
  { key: 'date', label: 'Дата выполнения', required: true },
  { key: 'time', label: 'Время (если в отдельной колонке)' },
  { key: 'num', label: 'Номер наряда / задания' },
  { key: 'exec', label: 'Исполнитель (ФИО)' },
];

// оценка заголовка для поля: чем больше, тем лучше; 0 — не подходит
function headerScore(key, h) {
  const t = String(h || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 80) return 0;
  switch (key) {
    case 'addr':
      if (/почт|e-?mail|эл\.?\s*адрес|ip/.test(t)) return 0;
      if (/адрес.*(задани|назначени|клиент|абонент|подключ|объект|установ|работ|выполн)/.test(t)) return 5;
      if (/^адрес/.test(t)) return 4;
      if (/адрес|местоположение/.test(t)) return 3;
      return 0;
    case 'city': return /^(город|населенный пункт|нас\.? ?пункт)/.test(t) ? 3 : 0;
    case 'street': return /^улица|^ул\.?$/.test(t) ? 3 : 0;
    case 'house': return /^(дом|№ дома|номер дома|д\.)$/.test(t) ? 3 : 0;
    case 'date':
      if (/дата.*(выполн|закрыт|заверш|исполн|факт)/.test(t) || /(выполн|закрыт|заверш).*(дата|время)/.test(t)) return 5;
      if (/^дата$|^дата и время$/.test(t)) return 3;
      if (/дата.*(созд|регистр|рожд|план|назнач)/.test(t)) return 1;
      if (/дата/.test(t)) return 2;
      return 0;
    case 'time':
      if (/дата/.test(t)) return 0;
      if (/время.*(выполн|закрыт|заверш)/.test(t)) return 4;
      return /^время/.test(t) ? 3 : 0;
    case 'num':
      if (/(номер|№|n)\s*(задани|наряд|заявк|работ)/.test(t)) return 5;
      if (/^(наряд|задание|заявка|id задания|id наряда)$/.test(t)) return 4;
      if (/лицев|телефон|назначени|счет|договор/.test(t)) return 0;
      return /^номер|^№$/.test(t) ? 1 : 0;
    case 'exec':
      if (/исполнител/.test(t)) return 5;
      if (/^фио|монтажник|техник|сотрудник|мастер|инженер/.test(t)) return 3;
      return 0;
    default: return 0;
  }
}

const RE_ADDR = /(^|\s)(г\.|ул\.|пр-кт|пр\.|пер\.|б-р|ш\.|пл\.|наб\.|д\.\s*\d|кв\.|улица|проспект)/i;
const RE_FIO = /^[А-ЯЁ][а-яё-]+\s+[А-ЯЁ][а-яё-]+(\s+[А-ЯЁ][а-яё-]+)?(\s*[,;]\s*[А-ЯЁ].*)?$/;

function detectColumns(rows) {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  // строка заголовков — та, где лучше всего узнаются нужные поля
  let headerRow = -1, best = 0;
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    let score = 0;
    const found = {};
    for (const key of ['addr', 'date', 'num', 'exec', 'time']) {
      const s = Math.max(0, ...rows[r].map((h) => (h instanceof Date ? 0 : headerScore(key, h))));
      if (s) { score += s; found[key] = true; }
    }
    if (found.date && (found.addr || rows[r].some((h) => headerScore('street', h))) && score > best) { best = score; headerRow = r; }
  }

  const map = {};
  const used = new Set();
  const pick = (key, scoreFn) => {
    let bestC = -1, bestS = 0;
    for (let c = 0; c < width; c++) {
      if (used.has(c)) continue;
      const s = scoreFn(c);
      if (s > bestS) { bestS = s; bestC = c; }
    }
    if (bestC >= 0) used.add(bestC);
    map[key] = bestC;
    return bestC;
  };
  const header = headerRow >= 0 ? rows[headerRow] : [];
  const data = rows.slice(headerRow + 1, headerRow + 301).filter((r) => r.some((v) => v !== ''));
  const ratio = (c, test) => {
    let n = 0, ok = 0;
    for (const r of data) { const v = r[c]; if (v === '' || v == null) continue; n++; if (test(v)) ok++; }
    return n ? ok / n : 0;
  };
  const isDate = (v) => parseDate(v) != null;
  const isAddr = (v) => typeof v === 'string' && RE_ADDR.test(v);
  const isFio = (v) => typeof v === 'string' && RE_FIO.test(v);

  // заголовок + подтверждение содержимым; если заголовков нет — только по содержимому
  pick('addr', (c) => headerScore('addr', header[c]) * 10 + ratio(c, isAddr) * 5 || 0);
  if (map.addr >= 0 && headerScore('addr', header[map.addr]) === 0 && ratio(map.addr, isAddr) < 0.5) { used.delete(map.addr); map.addr = -1; }
  if (map.addr < 0) {
    // адрес разбит на колонки: город / улица / дом
    const parts = ['city', 'street', 'house'].map((k) => pick(k, (c) => headerScore(k, header[c]))).filter((c) => c >= 0);
    [map.addr, map.addr2, map.addr3] = [parts[0] ?? -1, parts[1] ?? -1, parts[2] ?? -1];
    delete map.city; delete map.street; delete map.house;
  } else { map.addr2 = -1; map.addr3 = -1; }
  pick('date', (c) => { const r = ratio(c, isDate); return r < 0.5 ? 0 : headerScore('date', header[c]) * 10 + r * 5; });
  pick('time', (c) => { const s = headerScore('time', header[c]); return s && ratio(c, (v) => parseTime(v) != null) > 0.5 ? s : 0; });
  pick('num', (c) => headerScore('num', header[c]));
  pick('exec', (c) => headerScore('exec', header[c]) * 10 + ratio(c, isFio) * (headerRow < 0 ? 5 : 1) || 0);
  if (map.exec >= 0 && ratio(map.exec, isFio) < 0.3 && headerScore('exec', header[map.exec]) === 0) map.exec = -1;
  return { headerRow, map };
}

function colName(c) { return XLSX.utils.encode_col(c); }

function renderMapping() {
  const sh = state.sheets[state.sheet];
  const width = sh.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const header = state.headerRow >= 0 ? sh.rows[state.headerRow] : [];
  const sample = sh.rows[state.headerRow + 1] || [];
  const opts = ['<option value="-1">— нет —</option>'];
  for (let c = 0; c < width; c++) {
    let title = header[c] instanceof Date ? '' : String(header[c] ?? '');
    if (!title) { const v = sample[c]; title = v instanceof Date ? v.toLocaleString('ru-RU') : String(v ?? ''); }
    opts.push(`<option value="${c}">${colName(c)}: ${esc(title.slice(0, 50))}</option>`);
  }
  let html = '';
  if (state.sheets.length > 1) {
    html += `<label>Лист<select id="mapSheet">${state.sheets.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('')}</select></label>`;
  }
  for (const f of FIELDS) {
    html += `<label${f.required ? ' class="req"' : ''}>${f.label}<select data-map="${f.key}">${opts.join('')}</select></label>`;
  }
  $('mapGrid').innerHTML = html;
  if ($('mapSheet')) $('mapSheet').value = String(state.sheet);
  for (const f of FIELDS) document.querySelector(`[data-map="${f.key}"]`).value = String(state.map[f.key] ?? -1);
  $('mapping').hidden = false;
}

function onMappingChange(e) {
  if (e.target.id === 'mapSheet') {
    selectSheet(+e.target.value);
  } else if (e.target.dataset.map) {
    state.map[e.target.dataset.map] = +e.target.value;
  } else return;
  applyMapping();
}

function selectSheet(i) {
  state.sheet = i;
  const d = detectColumns(state.sheets[i].rows);
  state.headerRow = d.headerRow;
  state.map = d.map;
  renderMapping();
}

function applyMapping() {
  const { rows } = state.sheets[state.sheet];
  const m = state.map;
  const get = (row, key) => (m[key] >= 0 ? row[m[key]] ?? '' : '');
  const tasks = [];
  let skipped = 0;
  for (let r = state.headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.some((v) => v !== '')) continue;
    const addr = ['addr', 'addr2', 'addr3'].map((k) => get(row, k)).filter((v) => v !== '').join(', ').trim();
    const dt = parseDate(get(row, 'date'));
    if (!addr || !dt) { if (addr || get(row, 'date') !== '') skipped++; continue; }
    const t = parseTime(get(row, 'time'));
    if (t) dt.setHours(t[0], t[1], 0, 0);
    tasks.push({
      addr,
      num: String(get(row, 'num')),
      execs: String(get(row, 'exec')).split(/[,;]/).map((s) => s.trim()).filter(Boolean),
      dt,
    });
  }
  state.tasks = tasks;
  const bad = m.addr < 0 || m.date < 0;
  $('loadInfo').textContent = bad
    ? 'Не удалось определить колонки с адресом и датой — выберите их ниже.'
    : `Заданий найдено: ${tasks.length}` + (skipped ? ` (пропущено строк без адреса или даты: ${skipped})` : '') + '.';
  $('filters').hidden = !tasks.length;
  rebuildFio();
  rebuildMonths();
  rebuildDays();
}

/* ---------- построение маршрута ---------- */

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthKey(d) { return dayKey(d).slice(0, 7); }
function sameName(a, b) { return normAddr(a) === normAddr(b); }

function selectedTasks() {
  const fio = $('fio').value;
  const month = $('month').value;
  const hasExec = state.tasks.some((t) => t.execs.length);
  return state.tasks.filter((t) =>
    (!hasExec || !fio.trim() || t.execs.some((e) => sameName(e, fio))) && (!month || monthKey(t.dt) === month));
}

function rebuildFio() {
  const counts = new Map();
  for (const t of state.tasks) for (const e of t.execs) counts.set(e, (counts.get(e) || 0) + 1);
  const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  $('fioList').innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
  if (names.length && !names.some((n) => sameName(n, $('fio').value))) {
    $('fio').value = names[0];
    saveSettings();
  }
}

function rebuildMonths() {
  const fio = $('fio').value;
  const counts = new Map();
  for (const t of state.tasks) {
    if (t.execs.length && fio.trim() && !t.execs.some((e) => sameName(e, fio))) continue;
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
    const rows = [{ kind: 'base', addr: office, num: '', time: '', km: 0, src: 'fixed' }];
    for (const t of byDay.get(k)) {
      rows.push({ kind: 'task', addr: t.addr, num: t.num, time: fmtTime(t.dt), km: '', src: '' });
    }
    rows.push({ kind: 'return', addr: office, num: '', time: '', km: '', src: '' });
    return { key: k, rows };
  });
  render();
  scheduleKm();
}

function onOfficeChange() {
  const office = $('office').value.trim();
  for (const day of state.days) {
    const rows = day.rows;
    rows[0].addr = office;
    rows[rows.length - 1].addr = office;
    resetKm(rows[1]);
    resetKm(rows[rows.length - 1]);
  }
  render();
  scheduleKm();
}

function resetKm(row) {
  if (!row || row.kind === 'base') return;
  row.km = '';
  row.src = '';
}

/* ---------- отрисовка ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtTime(d) {
  return d.getHours() || d.getMinutes() ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
}
function fmtDay(k) {
  const [y, m, d] = k.split('-').map(Number);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}, ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`;
}
function money(x) { return x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'; }
function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }

const SRC_LABEL = {
  fixed: '', manual: 'вручную', memory: 'из памяти', auto: 'авто',
  approx: '≈ примерно', none: 'нет на карте', pending: '…',
};

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

function srcTag(r) {
  const s = r.src || (r.km === '' ? 'pending' : '');
  return SRC_LABEL[s] ? `<span class="src ${s}" title="${s === 'approx' ? 'Адрес найден неточно (только улица) или маршрут недоступен — проверьте' : ''}">${SRC_LABEL[s]}</span>` : '';
}

function rowHtml(r, di, ri, n) {
  const label = r.kind === 'base' ? 'Выезд с базы' : r.kind === 'return' ? 'Возврат на базу' : '';
  const isTask = r.kind === 'task';
  const addr = r.addr || '<i>введите адрес базы</i>';
  return `<tr class="${isTask ? '' : 'base'}">
    <td>${ri + 1}</td>
    <td class="addr">${r.addr ? esc(r.addr) : addr}${label ? ` <small>· ${label}</small>` : ''}</td>
    <td class="time">${esc(r.time)}</td>
    <td>${esc(r.num)}</td>
    <td class="num"><input type="number" min="0" step="0.1" value="${esc(r.km)}" data-km="${di}:${ri}" ${ri === 0 ? 'disabled' : ''}><span data-src="${di}:${ri}">${srcTag(r)}</span></td>
    <td class="act">${isTask ? `
      <button class="icon" title="Выше" data-move="${di}:${ri}:-1" ${ri <= 1 ? 'disabled' : ''}>↑</button>
      <button class="icon" title="Ниже" data-move="${di}:${ri}:1" ${ri >= n - 2 ? 'disabled' : ''}>↓</button>
      <button class="icon" title="Убрать из отчёта" data-del="${di}:${ri}">✕</button>` : ''}</td>
  </tr>`;
}

// обновить одну ячейку км, не перерисовывая таблицу (чтобы не сбивать ввод)
function updateKmCell(di, ri) {
  const r = state.days[di]?.rows[ri];
  const input = document.querySelector(`[data-km="${di}:${ri}"]`);
  const tag = document.querySelector(`[data-src="${di}:${ri}"]`);
  if (!r || !input) return;
  if (document.activeElement !== input) input.value = r.km;
  tag.innerHTML = srcTag(r);
}

function renderTotals() {
  const rate = settings().rate;
  let km = 0, missing = 0;
  state.days.forEach((day, di) => {
    let dkm = 0;
    day.rows.forEach((r, ri) => { if (ri > 0 && r.km === '') missing++; dkm += num(r.km); });
    km += dkm;
    const el = document.querySelector(`[data-dsum="${di}"]`);
    if (el) el.textContent = `${round1(dkm)} км` + (rate ? ` · ${money(dkm * rate)}` : '');
  });
  const tasks = state.days.reduce((s, d) => s + d.rows.filter((r) => r.kind === 'task').length, 0);
  $('totals').innerHTML = `<span>Дней: <b>${state.days.length}</b></span><span>Заданий: <b>${tasks}</b></span>
    <span>Пробег: <b>${round1(km)} км</b></span><span>Сумма: <b>${rate ? money(km * rate) : 'укажите стоимость 1 км'}</b></span>`;
  const warns = [];
  if (!$('office').value.trim()) warns.push('не указан адрес базы');
  if (!rate) warns.push('не указана стоимость 1 км');
  if (missing) warns.push(`не заполнено км: ${missing}`);
  $('warn').textContent = warns.length ? 'Внимание: ' + warns.join(', ') + '.' : '';
}
function round1(x) { return Math.round(x * 10) / 10; }

/* ---------- события таблицы ---------- */

function onKmInput(e) {
  const k = e.target.dataset.km;
  if (!k) return;
  const [di, ri] = k.split(':').map(Number);
  const rows = state.days[di].rows;
  const row = rows[ri];
  if (e.type === 'input') {
    row.km = e.target.value === '' ? '' : num(e.target.value);
    renderTotals();
    return;
  }
  // change: зафиксировать ручное значение, пустое — вернуть автоподсчёт
  if (e.target.value === '') {
    rememberKm(rows[ri - 1].addr, row.addr, '');
    resetKm(row);
    scheduleKm();
  } else {
    row.km = num(e.target.value);
    row.src = 'manual';
    rememberKm(rows[ri - 1].addr, row.addr, row.km);
  }
  updateKmCell(di, ri);
  renderTotals();
}

function onDaysClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.move) {
    const [di, ri, dir] = b.dataset.move.split(':').map(Number);
    const rows = state.days[di].rows;
    [rows[ri], rows[ri + dir]] = [rows[ri + dir], rows[ri]];
    const lo = Math.min(ri, ri + dir);
    [lo, lo + 1, lo + 2].forEach((i) => resetKm(rows[i]));
  } else if (b.dataset.del) {
    const [di, ri] = b.dataset.del.split(':').map(Number);
    const rows = state.days[di].rows;
    rows.splice(ri, 1);
    resetKm(rows[ri]);
    if (!rows.some((r) => r.kind === 'task')) state.days.splice(di, 1);
  } else return;
  render();
  scheduleKm();
}

/* ---------- автоподсчёт километров (OpenStreetMap: Nominatim, Photon, OSRM) ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastNominatim = 0;
let kmRun = 0;
let kmTimer = null;

function scheduleKm() {
  clearTimeout(kmTimer);
  kmTimer = setTimeout(computeKm, 300);
}

const STREET_TYPES = {
  'ул': 'улица', 'пр-кт': 'проспект', 'просп': 'проспект', 'пр': 'проспект', 'пер': 'переулок', 'б-р': 'бульвар', 'бул': 'бульвар',
  'ш': 'шоссе', 'пл': 'площадь', 'наб': 'набережная', 'проезд': 'проезд', 'мкр': 'микрорайон', 'тракт': 'тракт', 'туп': 'тупик',
};
const TYPE_RE = '(ул|пр-кт|просп|пр|пер|б-р|бул|ш|пл|наб|проезд|мкр|тракт|туп)';

function parseRuAddress(addr) {
  let s = ' ' + String(addr).replace(/,/g, ' ').replace(/\s+/g, ' ') + ' ';
  s = s.replace(/\s(кв|оф|пом|комн|под|эт)\.?\s*\S+/gi, ' ');
  const title = (w) => w.toLowerCase().replace(/(^|[\s-])([а-яёa-z])/g, (m, a, b) => a + b.toUpperCase());
  const city = (s.match(new RegExp(`\\s(?:г|город)\\.?\\s+(.+?)(?=\\s${TYPE_RE}\\.?\\s|\\s(?:улица|проспект)\\s)`, 'i')) || [])[1] || '';
  const streetM = s.match(new RegExp(`\\s${TYPE_RE}\\.?\\s(.+?)(?=\\sд\\.|\\sдом\\s|\\s\\d[^\\s]*\\s*$|\\s\\d[^\\s]*\\s(?:корп|к|стр)|\\s*$)`, 'i'));
  const houseM = s.match(/\s(?:д\.|дом)\s*([^\s]+)/i) || s.match(/\s(\d+[А-Яа-я]?(?:\/\d+)?)(?=\s*$|\s(?:корп|к|стр)[.\s])/i);
  const korpM = s.match(/\s(?:корп|стр|к)(?:\.\s*|\s+)([^\s]+)/i);
  return {
    city: city ? title(city.trim()) : '',
    type: streetM ? STREET_TYPES[streetM[1].toLowerCase()] : '',
    street: streetM ? title(streetM[2].trim()) : '',
    house: houseM ? houseM[1] : '',
    korp: korpM ? korpM[1] : '',
  };
}

function cleanAddr(addr) {
  return String(addr).replace(/,?\s*(кв|оф|пом|комн|под|эт)\.?\s*[^\s,]+/gi, '').replace(/\s+/g, ' ').trim();
}

async function nominatim(params) {
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastNominatim = Date.now();
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'ru', 'accept-language': 'ru', ...params });
  const res = await fetch(url);
  if (!res.ok) throw new Error('Nominatim ' + res.status);
  const data = await res.json();
  return data.length ? [+data[0].lon, +data[0].lat] : null;
}

async function photon(q, near) {
  const params = new URLSearchParams({ q, limit: '1' });
  if (near) { params.set('lon', near[0]); params.set('lat', near[1]); }
  const res = await fetch('https://photon.komoot.io/api/?' + params);
  if (!res.ok) throw new Error('Photon ' + res.status);
  const data = await res.json();
  const f = data.features && data.features[0];
  return f ? f.geometry.coordinates : null;
}

function haversine(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// найти координаты адреса; near — координаты базы, чтобы не уехать в другой город
async function geocode(addr, near, defaultCity) {
  const key = normAddr(addr);
  if (geoCache[key]) return geoCache[key];
  if (geoMissSession.has(key)) return null;
  const p = parseRuAddress(addr);
  const city = p.city || defaultCity;
  const plausible = (pt) => pt && (!near || haversine(pt, near) < 80);
  const attempts = [];
  if (p.street && p.house) {
    if (p.korp) attempts.push(() => nominatim({ street: `${/^\d+$/.test(p.korp) ? `${p.house}к${p.korp}` : p.house + p.korp} ${p.street} ${p.type}`, city }));
    attempts.push(() => nominatim({ street: `${p.house} ${p.street} ${p.type}`, city }));
  }
  attempts.push(() => nominatim({ q: cleanAddr(addr) }));
  attempts.push(() => photon(cleanAddr(addr), near));
  let result = null;
  for (const a of attempts) {
    try { const pt = await a(); if (plausible(pt)) { result = { p: pt, exact: true }; break; } } catch { /* следующий способ */ }
  }
  if (!result && p.street) {
    try {
      const pt = await nominatim({ street: `${p.street} ${p.type}`.trim(), city });
      if (plausible(pt)) result = { p: pt, exact: false };
    } catch { /* нет */ }
  }
  if (result) { geoCache[key] = result; save('ml.geo', geoCache); }
  else geoMissSession.add(key);
  return result;
}

function ptKey(p) { return p.map((x) => x.toFixed(5)).join(','); }

async function osrm(points) {
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${points.map(ptKey).join(';')}?overview=false`);
  if (!res.ok) throw new Error('OSRM ' + res.status);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('OSRM ' + data.code);
  return data.routes[0].legs.map((l) => l.distance / 1000);
}

function kmValue(d) {
  const percent = settings().kmMarkup;

  return Math.round(
    d * (1 + percent / 100) * 10
  ) / 10;
}

async function computeKm() {
  const run = ++kmRun;
  const status = $('kmStatus');
  const office = $('office').value.trim();
  const alive = () => run === kmRun;
  const touched = [];

  // 1) одинаковые адреса подряд — 0; введённые ранее вручную — из памяти
  state.days.forEach((day, di) => day.rows.forEach((r, ri) => {
    if (ri === 0 || r.src === 'manual' || r.src === 'memory') return;
    const prev = day.rows[ri - 1];
    if (!prev.addr || !r.addr) return;
    const mem = recallKm(prev.addr, r.addr);
    if (normAddr(prev.addr) === normAddr(r.addr)) { r.km = 0; r.src = 'auto'; }
    else if (mem !== '') { r.km = mem; r.src = 'memory'; }
    else if (r.km === '') r.src = 'pending';
    else return;
    touched.push([di, ri]);
  }));
  touched.forEach(([di, ri]) => updateKmCell(di, ri));
  renderTotals();

  if (!office) { status.textContent = 'Введите адрес базы — после этого километры посчитаются автоматически.'; return; }
  const todo = [];
  state.days.forEach((day, di) => day.rows.forEach((r, ri) => { if (r.src === 'pending' || r.src === 'none') todo.push([di, ri]); }));
  if (!todo.length) { status.textContent = 'Километры посчитаны.'; return; }

  try {
    // 2) координаты базы и нужных адресов
    status.textContent = 'Ищу базу на карте…';
    const base = await geocode(office, null, '');
    if (!alive()) return;
    if (!base) {
      status.textContent = 'Адрес базы не найден на карте. Уточните его, например: «Воронеж, ул. Космонавта Комарова, 8».';
      todo.forEach(([di, ri]) => { state.days[di].rows[ri].src = 'none'; updateKmCell(di, ri); });
      return;
    }
    const defaultCity = parseRuAddress(office).city;
    const need = new Set();
    for (const [di, ri] of todo) { need.add(state.days[di].rows[ri - 1].addr); need.add(state.days[di].rows[ri].addr); }
    const addrs = [...need].filter((a) => !geoCache[normAddr(a)]);
    let i = 0;
    for (const a of addrs) {
      status.textContent = `Ищу адреса на карте: ${++i} из ${addrs.length}…`;
      await geocode(a, base.p, defaultCity);
      if (!alive()) return;
    }

    // 3) расстояния по дорогам: по одному запросу на день, где все точки найдены
    const geo = (a) => geoCache[normAddr(a)];
    const byDay = new Map();
    for (const [di, ri] of todo) { if (!byDay.has(di)) byDay.set(di, []); byDay.get(di).push(ri); }
    let d = 0, notFound = new Set();
    for (const [di, ris] of byDay) {
      status.textContent = `Считаю маршруты: день ${++d} из ${byDay.size}…`;
      const rows = state.days[di].rows;
      const set = (ri, km, exact) => {
        rows[ri].km = kmValue(km);
        rows[ri].src = exact ? 'auto' : 'approx';
        updateKmCell(di, ri);
      };
      const pending = ris.filter((ri) => {
        const a = geo(rows[ri - 1].addr), b = geo(rows[ri].addr);
        if (a && b) {
          const c = routeCache[ptKey(a.p) + ';' + ptKey(b.p)];
          if (c != null) { set(ri, c, a.exact && b.exact); return false; }
          return true;
        }
        if (!a) notFound.add(rows[ri - 1].addr);
        if (!b) notFound.add(rows[ri].addr);
        rows[ri].src = 'none';
        updateKmCell(di, ri);
        return false;
      });
      if (!pending.length) continue;
      const pts = rows.map((r) => geo(r.addr));
      let legs = null;
      try {
        if (pts.every(Boolean)) legs = await osrm(pts.map((g) => g.p));
      } catch { legs = null; }
      if (!alive()) return;
      for (const ri of pending) {
        const a = pts[ri - 1] || geo(rows[ri - 1].addr), b = pts[ri] || geo(rows[ri].addr);
        let km = legs ? legs[ri - 1] : null;
        let exact = a.exact && b.exact;
        if (km == null) {
          try { [km] = await osrm([a.p, b.p]); } catch { km = haversine(a.p, b.p) * 1.4; exact = false; }
          if (!alive()) return;
        }
        if (exact) { routeCache[ptKey(a.p) + ';' + ptKey(b.p)] = km; }
        set(ri, km, exact);
      }
      save('ml.route', routeCache);
      renderTotals();
    }
    renderTotals();
    status.textContent = notFound.size
      ? `Не найдены на карте (${notFound.size}): ${[...notFound].join('; ')}. Введите км для этих строк вручную.`
      : 'Километры посчитаны. Строки с пометкой «≈» лучше проверить.';
  } catch (e) {
    if (alive()) status.textContent = 'Не удалось посчитать км: ' + e.message + '. Можно ввести вручную или нажать «Пересчитать км».';
  }
}

function recalcAll() {
  geoMissSession.clear();
  for (const day of state.days) day.rows.forEach((r) => { if (r.src !== 'manual' && r.src !== 'memory') resetKm(r); });
  render();
  computeKm();
}

// накрутка изменилась — пересчитать только авто-км (из кэша маршрутов это быстро)
function recalcKmMarkup() {
  for (const day of state.days) day.rows.forEach((r) => { if (r.src === 'auto' || r.src === 'approx') resetKm(r); });
  render();
  computeKm();
}

/* ---------- окно настроек ---------- */

function openSettings() {
  $('settingsPanel').hidden = false;
  document.body.classList.add('settings-open');
  $('kmMarkup').focus();
}
function closeSettings() {
  if ($('settingsPanel').hidden) return;
  $('kmMarkup').blur(); // закрытие по Esc: blur вызовет change, если значение менялось
  $('settingsPanel').hidden = true;
  document.body.classList.remove('settings-open');
  $('settingsBtn').focus();
}
function initSettingsPanel() {
  $('settingsBtn').addEventListener('click', openSettings);
  $('settingsClose').addEventListener('click', closeSettings);
  $('settingsPanel').addEventListener('click', (e) => { if (e.target.hasAttribute('data-settings-close')) closeSettings(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });
}

/* ---------- выгрузка в Excel ---------- */

const THIN = { style: 'thin' };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const RUB = '#,##0.00" ₽"';

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
        row.km === '' ? null : num(row.km), s.rate || null, null, row.num || null];
      x.getCell(12).value = { formula: `J${r}*K${r}` };
      for (let col = 1; col <= 13; col++) {
        const c = x.getCell(col);
        c.font = font;
        c.border = BOX;
      }
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
  for (let col = 1; col <= 13; col++) Object.assign(tot.getCell(col), { font: { ...font, bold: true }, border: BOX });
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
  const problems = [];
  if (!s.office) problems.push('адрес базы');
  if (!s.rate) problems.push('стоимость 1 км');
  if (problems.length) { alert('Заполните: ' + problems.join(', ')); markRequired(); return; }
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
    state.sheets = (await readFile(file)).filter((s) => s.rows.length);
    if (!state.sheets.length) throw new Error('файл пустой');
    // лист, где лучше всего находятся адрес и дата
    let bestSheet = 0, bestScore = -1;
    state.sheets.forEach((s, i) => {
      const d = detectColumns(s.rows);
      const score = (d.map.addr >= 0) + (d.map.date >= 0) + (d.headerRow >= 0) * 0.5;
      if (score > bestScore) { bestScore = score; bestSheet = i; }
    });
    selectSheet(bestSheet);
    applyMapping();
  } catch (e) {
    $('loadInfo').textContent = 'Не удалось прочитать файл: ' + e.message;
  }
}

function init() {
  initSettings();
  initSettingsPanel();
  $('file').addEventListener('change', (e) => onFile(e.target.files[0]));
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); onFile(e.dataTransfer.files[0]); });
  $('mapGrid').addEventListener('change', onMappingChange);
  $('month').addEventListener('change', rebuildDays);
  $('days').addEventListener('input', onKmInput);
  $('days').addEventListener('change', onKmInput);
  $('days').addEventListener('click', onDaysClick);
  $('recalc').addEventListener('click', recalcAll);
  $('download').addEventListener('click', download);
}

init();
