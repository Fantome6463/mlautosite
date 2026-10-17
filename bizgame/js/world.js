// 3D-мир: пустой город, стройплощадки с кранами, офисы, жилые дома, больницы, полиция.
import * as THREE from 'three';
import { OrbitControls } from './../vendor/OrbitControls.js';
import { GRID, isRoad, BUILDINGS, contractorInfo, RIVALS, PLAYER_COLOR } from './data.js';
import { shopRadius } from './production.js';

const CELL = 10;
const OFF = (GRID - 1) / 2;
const HALF = (GRID * CELL) / 2;
const FLOOR = 2.6;
const ROAD_LINES = [];
for (let k = 0; k < GRID; k++) if (k % 4 === 0) ROAD_LINES.push(k);

export const toWorld = (i, j) => new THREE.Vector3((i - OFF) * CELL, 0, (j - OFF) * CELL);
const ownerColor = b => (b.owner === 'player' ? PLAYER_COLOR : RIVALS[b.owner]?.color || '#9ca3af');

const matCache = new Map();
function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...opts }));
  return matCache.get(k);
}
function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
const M = c => (typeof c === 'string' ? mat(c) : c);
const box = (w, h, d, color, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), M(color), x, y + h / 2, z);
const cyl = (rt, rb, h, color, x = 0, y = 0, z = 0, seg = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(color), x, y + h / 2, z);
function tree(x, z, s = 1, pine = Math.random() < 0.5) {
  const g = new THREE.Group();
  g.add(cyl(0.18 * s, 0.25 * s, 1.2 * s, '#6b4a2b', 0, 0, 0, 6));
  const c = ['#3f8f4a', '#4e9f3d', '#2f7a43', '#5aa65a'][Math.floor(Math.random() * 4)];
  if (pine) {
    g.add(mesh(new THREE.ConeGeometry(1.2 * s, 2.2 * s, 7), mat(c), 0, 2 * s, 0));
    g.add(mesh(new THREE.ConeGeometry(0.9 * s, 1.8 * s, 7), mat(c), 0, 2.9 * s, 0));
  } else g.add(mesh(new THREE.IcosahedronGeometry(1.2 * s, 0), mat(c), 0, 2.2 * s, 0));
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI;
  return g;
}

// Текстуры фасадов: 4 окна в ширину × 4 этажа. map — днём, emissive — горящие окна ночью.
function facade(wall, glass, lit, frame) {
  const make = night => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = night ? '#000' : wall; x.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      if (night) { if (Math.random() < 0.6) { x.fillStyle = lit[Math.floor(Math.random() * lit.length)]; x.fillRect(k * 16 + 3, r * 16 + 3, 10, 10); } continue; }
      if (frame) { x.fillStyle = frame; x.fillRect(k * 16 + 2, r * 16 + 2, 12, 12); }
      x.fillStyle = glass[Math.floor(Math.random() * glass.length)];
      x.fillRect(k * 16 + 3, r * 16 + 3, 10, 10);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    return t;
  };
  return { map: make(false), emi: make(true) };
}

function windowMat(tex, w, floors, opts = {}) {
  const map = tex.map.clone(), emi = tex.emi.clone();
  for (const t of [map, emi]) { t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w / 1.8)) / 4, floors / 4); }
  return new THREE.MeshStandardMaterial({ map, emissiveMap: emi, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.55, ...opts });
}

function flag(color, x, z, h) {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.07, h, '#e5e7eb', 0, 0, 0, 6));
  const f = box(1.5, 0.9, 0.05, color, 0.75, h - 1, 0); f.castShadow = false;
  g.add(f);
  g.position.set(x, 0, z);
  return g;
}

const signMat = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 });

// ---------- готовые здания ----------
// Вариант облика здания: стабильно зависит от номера здания (форма, фасад, крыша)
const vr = (b, n, salt = 0) => (Math.imul((b.id || 1) * 31 + salt * 977 + 7, 2654435761) >>> 0) % n;
const pickTex = (b, tex, salt) => (Array.isArray(tex) ? tex[vr(b, tex.length, salt)] : tex);
const ACCENTS = ['#e2e8f0', '#fdba74', '#93c5fd', '#bef264', '#fda4af', '#c4b5fd', '#fde68a', '#99f6e4'];
const ROOFS = ['#475569', '#64748b', '#78716c', '#334155', '#57534e'];
// крыша нейтральная, цвет владельца — тонкой полосой под ней
const cap = (g, b, w, d, x, y, z) => { g.add(box(w, 0.16, d, ownerColor(b), x, y, z), box(w, 0.32, d, ROOFS[vr(b, ROOFS.length, 9)], x, y + 0.16, z)); };

// Палитры фасадов: у офисов — разное стекло и камень, у жилых — кирпич, панель, пастель
export const FACADES = {
  office: [
    ['#1e3a5f', ['#3b6a9a', '#4a7fb5', '#2f5d8a'], ['#e0f2fe', '#fef3c7'], '#0f2744'],
    ['#0f172a', ['#1e293b', '#334155', '#475569'], ['#e0f2fe', '#fef3c7'], '#020617'],
    ['#134e4a', ['#2dd4bf', '#14b8a6', '#0d9488'], ['#ccfbf1', '#fef3c7'], '#042f2e'],
    ['#d6cfc4', ['#475569', '#64748b'], ['#fef3c7', '#ffffff'], '#a8a29e'],
    ['#7c2d12', ['#c2410c', '#ea580c', '#9a3412'], ['#ffedd5', '#fef3c7'], '#431407'],
  ],
  residential: [
    ['#e7d8c3', ['#5b6b7d', '#6b7f95'], ['#ffd27a', '#ffe9b0', '#ffc35c'], '#f8f1e7'],
    ['#b45343', ['#4b5563', '#5b6b7d'], ['#ffd27a', '#ffe9b0'], '#e7d8c3'],
    ['#f1f5f9', ['#64748b', '#475569'], ['#ffd27a', '#ffe9b0'], '#cbd5e1'],
    ['#9ca3af', ['#374151', '#4b5563'], ['#ffd27a', '#ffc35c'], '#d1d5db'],
    ['#fde68a', ['#64748b', '#57534e'], ['#ffd27a', '#ffe9b0'], '#fef3c7'],
    ['#a7f3d0', ['#475569', '#334155'], ['#ffd27a', '#ffe9b0'], '#ecfdf5'],
  ],
};

// Четырёхскатная крыша точно по контуру здания (пирамида повёрнута в геометрии, потом растянута по сторонам)
export function hipRoof(w, d, hgt, color, x, y, z) {
  const geo = new THREE.CylinderGeometry(0.02, Math.SQRT1_2, hgt, 4, 1);
  geo.rotateY(Math.PI / 4);
  const m = mesh(geo, mat(color), x, y + hgt / 2, z);
  m.scale.set(w, 1, d);
  return m;
}

// Крыши: вертолётная площадка, сад, техника с антенной, солнечные панели, бак с водой
function roofKit(g, b, kind, w, d, y, salt = 3) {
  const v = vr(b, kind === 'office' ? 3 : 3, salt);
  if (kind === 'office' && v === 0 && b.floors >= 9) {
    g.add(cyl(Math.min(w, d) * 0.32, Math.min(w, d) * 0.32, 0.15, '#334155', 0, y, 0, 18));
    g.add(box(0.25, 0.05, 1.2, '#f8fafc', -0.35, y + 0.15, 0), box(0.25, 0.05, 1.2, '#f8fafc', 0.35, y + 0.15, 0), box(0.7, 0.05, 0.22, '#f8fafc', 0, y + 0.15, 0));
  } else if (v === 1) {
    g.add(box(w * 0.8, 0.25, d * 0.8, '#65a30d', 0, y, 0));
    for (const [x, z] of [[-w * 0.25, -d * 0.2], [w * 0.22, d * 0.18]]) g.add(tree(x, z, 0.35, false).translateY(y + 0.25));
  } else if (kind === 'residential' && v === 2) {
    for (let k = 0; k < 3; k++) { const pnl = box(w * 0.22, 0.08, d * 0.5, mat('#1e3a8a', { metalness: 0.6, roughness: 0.3 }), -w * 0.28 + k * w * 0.28, y + 0.4, 0); pnl.rotation.x = -0.4; g.add(pnl); }
  } else {
    g.add(box(Math.min(2, w * 0.3), 1.2, Math.min(1.6, d * 0.3), '#94a3b8', w * 0.18, y, -d * 0.15));
    if (kind === 'residential') g.add(cyl(0.6, 0.6, 1.2, '#a8a29e', -w * 0.25, y + 0.6, d * 0.1, 10), box(0.1, 0.6, 0.1, '#78716c', -w * 0.25, y, d * 0.1));
    else if (b.floors >= 9) g.add(cyl(0.06, 0.1, 4, '#9ca3af', -w * 0.2, y, 0, 5));
  }
}

function makeOffice(b, tex) {
  const g = new THREE.Group(), wins = [];
  const T = pickTex(b, tex, 1), h = b.floors * FLOOR, col = ownerColor(b), shape = vr(b, 4, 2);
  const W = (w, fl, o = {}) => { const m = windowMat(T, w, fl, { metalness: 0.35, ...o }); wins.push(m); return m; };
  g.add(box(7.6, 0.3, 7, '#64748b', 0, 0, 0)); // площадка
  if (shape === 1) {
    // восьмигранная башня с короной
    const r = 3.4, m = W(r * 6.2, b.floors);
    g.add(mesh(new THREE.CylinderGeometry(r, r, h, 8), m, 0, 0.3 + h / 2, 0));
    g.add(cyl(r + 0.2, r + 0.2, 0.16, col, 0, 0.3 + h, 0, 8), cyl(r + 0.2, r + 0.2, 0.3, ROOFS[vr(b, ROOFS.length, 9)], 0, 0.46 + h, 0, 8));
    g.add(cyl(r * 0.6, r * 0.8, 1.2, '#cbd5e1', 0, 0.7 + h, 0, 8));
    if (b.floors >= 9) g.add(cyl(0.05, 0.12, 3.5, '#e5e7eb', 0, 1.9 + h, 0, 6));
  } else if (shape === 2) {
    // два корпуса с переходом
    const h2 = Math.max(3, Math.round(b.floors * 0.75)) * FLOOR;
    g.add(box(3, h, 4.2, W(3, b.floors), -1.9, 0.3, 0), box(3, h2, 4.2, W(3, Math.round(h2 / FLOOR)), 1.9, 0.3, 0));
    g.add(box(1, 1.6, 2, mat('#7dd3fc', { metalness: 0.4, roughness: 0.15 }), 0, 0.3 + h2 * 0.6, 0));
    cap(g, b, 3.2, 4.4, -1.9, 0.3 + h, 0); cap(g, b, 3.2, 4.4, 1.9, 0.3 + h2, 0);
    const rk = new THREE.Group(); rk.position.x = 1.9; g.add(rk);
    roofKit(rk, b, 'office', 3, 4, 0.65 + h2, 4);
  } else if (shape === 3) {
    // ступенчатый — три яруса
    const f1 = Math.max(2, Math.round(b.floors * 0.5)), f2 = Math.max(1, Math.round(b.floors * 0.3)), f3 = Math.max(1, b.floors - f1 - f2);
    let y = 0.3;
    for (const [w, d, f] of [[7, 6.2, f1], [5.4, 4.8, f2], [3.8, 3.4, f3]]) {
      g.add(box(w, f * FLOOR, d, W(w, f), 0, y, 0)); y += f * FLOOR;
      cap(g, b, w + 0.2, d + 0.2, 0, y, 0);
    }
    roofKit(g, b, 'office', 3.8, 3.4, y + 0.3);
  } else {
    // классика: стилобат и башня со сдвигом
    const w = 7, d = 6.4, low = b.floors > 9 ? Math.round(b.floors * 0.65) : b.floors;
    g.add(box(w, low * FLOOR, d, W(w, low), 0, 0.3, 0));
    if (low < b.floors) {
      g.add(box(w - 2, (b.floors - low) * FLOOR, d - 1.6, W(w - 2, b.floors - low), 0, 0.3 + low * FLOOR, 0));
      g.add(box(w + 0.2, 0.35, d + 0.2, '#94a3b8', 0, 0.3 + low * FLOOR, 0));
    }
    const tw = low < b.floors ? w - 1.8 : w + 0.2, td = low < b.floors ? d - 1.4 : d + 0.2;
    cap(g, b, tw, td, 0, 0.3 + h, 0);
    roofKit(g, b, 'office', tw, td, 0.75 + h);
  }
  if (shape === 1) roofKit(g, b, 'office', 4, 4, 1.9 + h, 5);
  g.add(box(3, 0.2, 1.4, '#cbd5e1', 0, 3, 3.9)); // козырёк входа
  return { g, wins };
}

function makeResidential(b, tex) {
  const g = new THREE.Group(), wins = [];
  const T = pickTex(b, tex, 1), col = ownerColor(b), shape = vr(b, 4, 2), acc = ACCENTS[vr(b, ACCENTS.length, 6)];
  const cf = b.type === 'mixed' ? 2 : 1; // этажей под торговлю
  const w = 7.6, d = 6, ground = 3.2 * cf;
  const upper = b.floors - cf, h = ground + upper * FLOOR;
  const W = (ww, fl) => { const m = windowMat(T, ww, fl); wins.push(m); return m; };
  // первые этажи — коммерция: витрины, маркизы, вывески
  g.add(box(w, ground, d, '#e2e8f0', 0, 0, 0));
  const shopColors = ['#ef4444', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7'];
  const n = Math.max(2, Math.min(5, Math.round((b.units.comm?.total || 360) / cf / 110)));
  const sw = w / n;
  for (let f = 0; f < cf; f++) for (let k = 0; k < n; k++) {
    const x = -w / 2 + sw * (k + 0.5), y = f * 3.2, sc = shopColors[(k + f + b.id) % 5];
    g.add(box(sw - 0.5, 2, 0.12, mat('#7dd3fc', { roughness: 0.15, metalness: 0.3 }), x, 0.3 + y, d / 2 + 0.02));
    const aw = box(sw - 0.3, 0.12, 1.1, sc, x, 2.45 + y, d / 2 + 0.55); aw.rotation.x = 0.3; g.add(aw);
    g.add(box(sw - 0.8, 0.45, 0.1, signMat(sc), x, 2.7 + y, d / 2 + 0.06));
  }
  const balconies = (x, ww, dd, fl, y0) => {
    if (vr(b, 2, 7)) for (let f = 0; f < fl; f += 2) g.add(box(ww * 0.75, 0.16, 0.6, acc, x, y0 + f * FLOOR + 0.1, dd / 2 + 0.3));
    else for (const dx of [-ww * 0.3, ww * 0.3]) g.add(box(0.4, fl * FLOOR - 0.3, 0.25, mat(acc, { roughness: 0.9 }), x + dx, y0 + 0.15, dd / 2 + 0.12));
  };
  if (shape === 1) {
    // Г-образный дом: длинный корпус сзади и крыло
    g.add(box(w, upper * FLOOR, 3.4, W(w, upper), 0, ground, -1.3));
    g.add(box(3, upper * FLOOR, 2.6, W(3, upper), -2.3, ground, 1.7));
    balconies(1.6, 4.2, 0.8, upper, ground);
    cap(g, b, w + 0.3, 3.7, 0, h, -1.3); cap(g, b, 3.3, 2.9, -2.3, h, 1.7);
    roofKit(g, b, 'residential', 5, 3, h + 0.4);
  } else if (shape === 2) {
    // точечная башня на стилобате
    const tw = 5, td = 4.6;
    g.add(box(tw, upper * FLOOR, td, W(tw, upper), 0, ground, -0.3));
    balconies(0, tw, td - 0.6, upper, ground);
    g.add(box(w + 0.2, 0.25, d + 0.2, '#cbd5e1', 0, ground, 0));
    cap(g, b, tw + 0.3, td + 0.3, 0, h, -0.3);
    roofKit(g, b, 'residential', tw, td, h + 0.4);
  } else if (shape === 3 && b.floors <= 9) {
    // невысокий дом со скатной крышей
    g.add(box(w, upper * FLOOR, d, W(w, upper), 0, ground, 0));
    balconies(0, w, d, upper, ground);
    g.add(hipRoof(w + 0.4, d + 0.4, 2.4, ['#7c2d12', '#334155', '#166534'][vr(b, 3, 8)], 0, h, 0));
  } else if (shape === 3) {
    // секционный дом: две секции разной высоты
    const up2 = Math.max(2, upper - 3);
    g.add(box(3.8, upper * FLOOR, d, W(3.8, upper), -1.9, ground, 0), box(3.8, up2 * FLOOR, d, W(3.8, up2), 1.9, ground, 0));
    balconies(-1.9, 3.8, d, upper, ground); balconies(1.9, 3.8, d, up2, ground);
    cap(g, b, 4, d + 0.3, -1.9, h, 0); cap(g, b, 4, d + 0.3, 1.9, ground + up2 * FLOOR, 0);
    roofKit(g, b, 'residential', 3.8, d, h + 0.4);
  } else {
    // классическая пластина
    g.add(box(w, upper * FLOOR, d, W(w, upper), 0, ground, 0));
    balconies(0, w, d, upper, ground);
    cap(g, b, w + 0.3, d + 0.3, 0, h, 0);
    roofKit(g, b, 'residential', w, d, h + 0.4);
  }
  return { g, wins };
}

// Торговый центр: широкая стеклянная коробка с вывесками и парковкой
function makeMall(b, tex) {
  const g = new THREE.Group(), wins = [];
  const col = ownerColor(b), h = b.floors * 3.6, w = 8.6, d = 7.4, shape = vr(b, 3, 2);
  const m = windowMat(pickTex(b, tex, 1), w, b.floors, { metalness: 0.5 });
  g.add(box(w, h, d - 2, m, 0, 0.3, -1)); wins.push(m);
  g.add(box(w, h, 0.15, mat('#7dd3fc', { roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 }), 0, 0.3, d / 2 - 2.05));
  for (let f = 0; f < b.floors; f++) g.add(box(w + 0.1, 0.25, d - 1.9, '#e2e8f0', 0, 0.3 + f * 3.6, -1));
  cap(g, b, w + 0.3, d - 1.7, 0, 0.3 + h, -1);
  const colors = ['#ef4444', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7'];
  for (let k = 0; k < 4; k++) g.add(box(1.5, 0.6, 0.12, signMat(colors[(k + b.id) % 5]), -3.1 + k * 2.07, 0.3 + h - 1, d / 2 - 1.9));
  g.add(box(3.2, 1.2, 0.2, signMat(col), 0, 0.3 + h + 0.8, d / 2 - 2.6));
  if (shape === 1) { // скруглённый угол-ротонда со стеклом
    const r = mesh(new THREE.CylinderGeometry(2.2, 2.2, h + 1.2, 16), mat('#7dd3fc', { roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.9 }), -w / 2 + 1.6, 0.3 + (h + 1.2) / 2, d / 2 - 2.2);
    g.add(r, cyl(2.4, 2.4, 0.3, ROOFS[vr(b, ROOFS.length, 9)], -w / 2 + 1.6, 1.5 + h, d / 2 - 2.2, 16));
  } else if (shape === 2) { // стеклянный купол атриума
    g.add(mesh(new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#bae6fd', { roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 }), 0, 0.8 + h, -1));
  } else g.add(box(1.8, 1, 1.4, '#94a3b8', 2.6, 0.8 + h, -2.2), box(1.8, 1, 1.4, '#94a3b8', -2.6, 0.8 + h, -2.2));
  // парковка
  g.add(box(w, 0.06, 2, '#475569', 0, 0, d / 2));
  for (let k = 0; k < 5; k++) g.add(box(0.08, 0.02, 1.6, '#f8fafc', -3.6 + k * 1.8, 0.07, d / 2));
  g.add(box(1.4, 0.6, 0.8, '#ef4444', -2.7, 0.06, d / 2), box(1.4, 0.6, 0.8, '#3b82f6', 0.9, 0.06, d / 2));
  return { g, wins };
}

function makeHospital(b, tex) {
  const g = new THREE.Group(), wins = [];
  const h = b.floors * FLOOR;
  const m = windowMat(tex, 8, b.floors);
  g.add(box(8.4, h, 4.6, m, 0, 0, -1)); wins.push(m);
  const m2 = windowMat(tex, 3, b.floors - 1);
  g.add(box(3, (b.floors - 1) * FLOOR, 3.4, m2, -2.7, 0, 2.6)); wins.push(m2);
  g.add(box(8.6, 0.35, 4.8, '#f1f5f9', 0, h, -1));
  // красный крест на фасаде
  const red = signMat('#ef4444');
  g.add(box(0.5, 1.8, 0.12, red, 1.6, h - 2.3, 1.36));
  g.add(box(1.8, 0.5, 0.12, red, 1.6, h - 1.65, 1.36));
  // вертолётная площадка
  g.add(cyl(1.7, 1.7, 0.12, '#334155', 1.2, h + 0.35, -1, 20));
  g.add(box(0.25, 0.05, 1.4, '#f8fafc', 0.75, h + 0.47, -1));
  g.add(box(0.25, 0.05, 1.4, '#f8fafc', 1.65, h + 0.47, -1));
  g.add(box(0.9, 0.05, 0.25, '#f8fafc', 1.2, h + 0.47, -1));
  // скорая
  g.add(box(2.2, 1.1, 1.1, '#f8fafc', 2.2, 0, 3.4));
  g.add(box(2.2, 0.2, 1.12, '#ef4444', 2.2, 0.6, 3.4));
  return { g, wins };
}

function makePolice(b, tex) {
  const g = new THREE.Group(), wins = [];
  const h = b.floors * FLOOR;
  const m = windowMat(tex, 7, b.floors);
  g.add(box(7.4, h, 5, m, 0, 0, -0.8)); wins.push(m);
  g.add(box(7.6, 0.6, 5.2, '#1d4ed8', 0, FLOOR - 0.3, -0.8));
  g.add(box(7.6, 0.35, 5.2, '#1e3a8a', 0, h, -0.8));
  g.add(box(3, 0.6, 0.12, signMat('#1d4ed8'), 0, h - 1.2, 1.76));
  const red = new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1 });
  const blue = new THREE.MeshStandardMaterial({ color: '#3b82f6', emissive: '#3b82f6', emissiveIntensity: 1 });
  g.add(box(0.5, 0.35, 0.5, red, -0.4, h + 0.35, -0.8), box(0.5, 0.35, 0.5, blue, 0.4, h + 0.35, -0.8));
  // патрульная машина
  g.add(box(2, 0.7, 1, '#f8fafc', -2, 0, 3.3), box(1.1, 0.5, 0.9, '#1e3a8a', -2.1, 0.7, 3.3));
  const r2 = box(0.3, 0.15, 0.3, red, -2.35, 1.2, 3.3), b2 = box(0.3, 0.15, 0.3, blue, -1.85, 1.2, 3.3);
  g.add(r2, b2);
  g.add(flag('#1d4ed8', 3.6, 3, 6));
  return { g, wins, blink: [red, blue] };
}

function makeSchool(b, tex) {
  const g = new THREE.Group(), wins = [];
  const h = b.floors * FLOOR;
  // П-образное здание: центральный корпус и два крыла
  const m = windowMat(tex, 8, b.floors);
  g.add(box(8, h, 3, m, 0, 0, -2.4)); wins.push(m);
  const m2 = windowMat(tex, 2, b.floors);
  g.add(box(2.2, h, 3.4, m2, -2.9, 0, 0.8), box(2.2, h, 3.4, m2, 2.9, 0, 0.8)); wins.push(m2);
  g.add(box(8.3, 0.35, 3.3, '#b45309', 0, h, -2.4));
  g.add(box(2.5, 0.35, 3.7, '#b45309', -2.9, h, 0.8), box(2.5, 0.35, 3.7, '#b45309', 2.9, h, 0.8));
  // часы на фасаде
  g.add(cyl(0.7, 0.7, 0.12, '#f8fafc', 0, h - 1.4, -0.85, 20).rotateX(Math.PI / 2));
  g.add(box(0.08, 0.5, 0.05, '#1f2937', 0, h - 1.2, -0.75), box(0.4, 0.08, 0.05, '#1f2937', 0.15, h - 1.4, -0.75));
  // спортплощадка с воротами
  g.add(box(3.4, 0.06, 2.6, '#16a34a', 0, 0, 2.6));
  g.add(box(0.1, 0.8, 0.9, '#f8fafc', -1.6, 0, 2.6), box(0.1, 0.8, 0.9, '#f8fafc', 1.6, 0, 2.6));
  g.add(flag('#facc15', 3.9, 3.9, 6));
  return { g, wins };
}

// ---------- стройплощадка ----------
function totalHeight(b) {
  if (b.type === 'residential') return 3.2 + (b.floors - 1) * FLOOR;
  if (b.type === 'mixed') return 6.4 + (b.floors - 2) * FLOOR;
  if (b.type === 'mall') return b.floors * 3.6;
  return b.floors * FLOOR;
}

function makeSite(b) {
  const g = new THREE.Group();
  const H = totalHeight(b);
  const done = Math.max(0, Math.floor((b.progress / b.buildDays) * b.floors));
  const c = contractorInfo(b.contractor);
  // забор
  for (const [w, d, x, z] of [[9, 0.1, 0, 4.4], [9, 0.1, 0, -4.4], [0.1, 9, 4.4, 0], [0.1, 9, -4.4, 0]]) {
    g.add(box(w, 1.1, d, '#f97316', x, 0, z));
  }
  g.add(box(9.6, 0.05, 9.6, '#a8a29e', 0, 0, 0));
  g.add(box(7.4, 0.4, 6.6, '#9ca3af', 0, 0, 0));
  // каркас: перекрытия и колонны
  const concrete = mat('#b8bcc2');
  const fh = H / b.floors;
  for (let f = 1; f <= done; f++) g.add(box(7.2, 0.25, 6.4, concrete, 0, 0.4 + f * fh - 0.25, 0));
  if (done > 0) {
    for (const [x, z] of [[-3.4, -3], [3.4, -3], [-3.4, 3], [3.4, 3], [0, -3], [0, 3]]) g.add(box(0.35, done * fh, 0.35, concrete, x, 0.4, z));
    // строительные леса
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7.8, done * fh, 7, 3, Math.max(1, done), 3)), new THREE.LineBasicMaterial({ color: '#65a30d' }));
    edges.position.set(0, 0.4 + (done * fh) / 2, 0);
    g.add(edges);
  }
  // башенный кран
  const mastH = H + 7;
  const crane = new THREE.Group();
  crane.position.set(3.8, 0, -3.8);
  crane.add(box(0.7, mastH, 0.7, '#facc15'));
  const top = new THREE.Group();
  top.position.y = mastH;
  top.add(box(16, 0.45, 0.6, '#facc15', 4, 0, 0));
  top.add(box(2.2, 1.3, 2, '#334155', -4.2, -0.6, 0));
  top.add(box(1.1, 1, 1, '#e5e7eb', 0, -1.1, 0.8));
  top.add(box(0.06, 5, 0.06, '#1f2937', 9, -5, 0));
  top.add(box(1.2, 0.8, 1.2, '#78716c', 9, -6, 0));
  crane.add(top);
  g.add(crane);
  g.userData.crane = top;
  // табличка подрядчика
  g.add(box(0.12, 1.6, 0.12, '#57534e', -3, 0, 4.7), box(0.12, 1.6, 0.12, '#57534e', -1, 0, 4.7));
  g.add(box(2.4, 1, 0.1, signMat(c.color), -2, 1.3, 4.75));
  g.userData.done = done;
  return g;
}

// ---------- мир ----------
export class World {
  constructor(container, { onPick }) {
    this.container = container;
    this.onPick = onPick;
    this.tiles = new Map();   // "i,j" → mesh
    this.bObjs = new Map();   // id → group
    this.cars = []; this.labels = [];
    this.clock = new THREE.Clock();
    this.glow = 0;
    this.tex = {
      office: FACADES.office.map(f => facade(...f)),
      residential: FACADES.residential.map(f => facade(...f)),
      hospital: facade('#f8fafc', ['#93c5fd', '#a5d8ff'], ['#e0f2fe', '#ffffff'], null),
      police: facade('#e2e8f0', ['#475569', '#64748b'], ['#fef3c7', '#e0f2fe'], null),
      school: facade('#fde68a', ['#92400e', '#a16207'], ['#fef3c7', '#ffffff'], null),
    };

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);

    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color('#9fd3f0');
    s.fog = new THREE.Fog('#9fd3f0', 420, 830);

    const cam = this.camera = new THREE.PerspectiveCamera(26, 1, 2, 2000); // узкий угол — почти изометрия, высокие дома не заваливаются
    cam.position.set(136, 152, 184);
    const c = this.controls = new OrbitControls(cam, r.domElement);
    c.enableDamping = true; c.dampingFactor = 0.08;
    c.maxPolarAngle = 1.2; c.minDistance = 40; c.maxDistance = 480;
    c.screenSpacePanning = false;
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.camGoal = null;

    this.hemi = new THREE.HemisphereLight('#dbeafe', '#4d7c0f', 0.9);
    s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff4e0', 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -HALF - 20; sc.right = sc.top = HALF + 20; sc.far = 500;
    sun.shadow.bias = -0.0005;
    s.add(sun, sun.target);

    this.buildStatic();
    this.buildCars();

    this.hover = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.98, 0.15, CELL * 0.98), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false }));
    this.hover.visible = false; s.add(this.hover);
    this.select = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(CELL * 0.98, 0.6, CELL * 0.98)), new THREE.LineBasicMaterial({ color: '#facc15' }));
    this.select.visible = false; s.add(this.select);
    // круг зоны действия больницы/полиции
    this.zone = new THREE.Mesh(new THREE.RingGeometry(0, 1, 48), new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.15, depthWrite: false }));
    this.zone.rotation.x = -Math.PI / 2; this.zone.visible = false; s.add(this.zone);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bindInput();
    this.resize();
    addEventListener('resize', () => this.resize());
    r.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildStatic() {
    const s = this.scene;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), mat('#7fb069'));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
    s.add(ground);
    for (let k = 0; k < 260; k++) {
      const a = Math.random() * Math.PI * 2, d = HALF + 12 + Math.random() * 160;
      s.add(tree(Math.cos(a) * d, Math.sin(a) * d, 1.2 + Math.random() * 1.4));
    }
    const river = new THREE.Mesh(new THREE.PlaneGeometry(40, 1400), new THREE.MeshStandardMaterial({ color: '#3b82c4', roughness: 0.15, metalness: 0.2 }));
    river.rotation.x = -Math.PI / 2; river.position.set(HALF + 70, 0.02, 0);
    s.add(river);

    const len = GRID * CELL;
    const roadMat = mat('#3a3f47', { flatShading: false });
    const dashes = [];
    for (const k of ROAD_LINES) {
      const p = (k - OFF) * CELL;
      const h = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, CELL), roadMat); h.position.set(0, 0.05, p); h.receiveShadow = true; s.add(h);
      const v = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.1, len), roadMat); v.position.set(p, 0.051, 0); v.receiveShadow = true; s.add(v);
      for (let t = -HALF + 2; t < HALF; t += 4) {
        const cellIdx = Math.round(t / CELL + OFF);
        if (cellIdx % 4 === 0 && Math.abs(t - (cellIdx - OFF) * CELL) < CELL / 2) continue;
        dashes.push([t, p, true], [p, t, false]);
      }
    }
    const dm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.02, 0.25), new THREE.MeshBasicMaterial({ color: '#f5f5f4' }), dashes.length);
    const o = new THREE.Object3D();
    dashes.forEach(([x, z, horiz], n) => { o.position.set(x, 0.12, z); o.rotation.y = horiz ? 0 : Math.PI / 2; o.updateMatrix(); dm.setMatrixAt(n, o.matrix); });
    s.add(dm);
    // фонари вдоль дорог
    const lampPos = [];
    for (const k of ROAD_LINES) for (let t = -HALF + 5; t < HALF; t += 20) lampPos.push([t, (k - OFF) * CELL + 4.7]);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 5), mat('#475569'), lampPos.length);
    this.lampMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', emissive: '#fde68a', emissiveIntensity: 0 });
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), this.lampMat, lampPos.length);
    lampPos.forEach(([x, z], n) => {
      o.rotation.set(0, 0, 0);
      o.position.set(x, 1.5, z); o.updateMatrix(); pole.setMatrixAt(n, o.matrix);
      o.position.set(x, 3.05, z); o.updateMatrix(); head.setMatrixAt(n, o.matrix);
    });
    s.add(pole, head);
  }

  // Участки: пустая трава, под своими зданиями — голубоватая плитка
  syncPlots(state) {
    const owners = new Map();
    for (const b of Object.values(state.buildings)) owners.set(`${b.i},${b.j}`, b.owner);
    for (const p of Object.values(state.plots)) {
      const k = `${p.i},${p.j}`;
      const own = owners.has(k) ? owners.get(k) : null;
      const color = own === null ? '#93c572' : own === 'player' ? '#c7d7f2' : '#c9ccd1';
      let tile = this.tiles.get(k);
      if (!tile) {
        const pos = toWorld(p.i, p.j);
        tile = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.94, 0.4, CELL * 0.94), mat(color));
        tile.position.set(pos.x, 0.2, pos.z); tile.receiveShadow = true;
        tile.userData = { i: p.i, j: p.j };
        this.scene.add(tile);
        this.tiles.set(k, tile);
      }
      if (tile.userData.color !== color) { tile.material = mat(color); tile.userData.color = color; }
    }
  }

  syncBuildings(state) {
    const alive = new Set();
    for (const b of Object.values(state.buildings)) {
      alive.add(b.id);
      const occ = b.state === 'done' ? occupancy(b) : 0;
      const stage = b.state === 'build' ? Math.floor((b.progress / b.buildDays) * b.floors) : -1;
      const sig = `${b.state}|${stage}|${b.floors}|${b.owner}`;
      const cur = this.bObjs.get(b.id);
      if (cur && cur.userData.sig === sig) { cur.userData.occ = occ; continue; }
      if (cur) this.scene.remove(cur);
      let g, extra = {};
      if (b.state === 'build') g = makeSite(b);
      else {
        const make = { office: makeOffice, residential: makeResidential, hospital: makeHospital, police: makePolice, school: makeSchool, mixed: makeResidential, mall: makeMall }[b.type];
        const r = make(b, this.tex[{ mixed: 'residential', mall: 'office' }[b.type] || b.type]);
        g = r.g; extra = { wins: r.wins, blink: r.blink };
        if (b.owner === 'player' && b.type !== 'police' && b.type !== 'school') g.add(flag(PLAYER_COLOR, -4.2, 4.2, 5));
      }
      const pos = toWorld(b.i, b.j);
      g.position.set(pos.x, 0.4, pos.z);
      // на малом участке здание уже, на крупном — шире
      const fk = b.type === 'hospital' || b.type === 'police' || b.type === 'school' ? 1 : ({ s: 0.85, m: 1, l: 1.15 }[state.plots[`${b.i},${b.j}`]?.size] || 1);
      g.userData.fk = fk;
      const fresh = !cur || cur.userData.state !== b.state;
      g.userData = { ...g.userData, ...extra, sig, occ, state: b.state, born: fresh ? performance.now() : 0, id: b.id };
      if (fresh) g.scale.setScalar(0.01); else g.scale.set(g.userData.fk, 1, g.userData.fk);
      this.scene.add(g);
      this.bObjs.set(b.id, g);
    }
    for (const [id, g] of this.bObjs) if (!alive.has(id)) { this.scene.remove(g); this.bObjs.delete(id); }
    if (this.coverage) this.updateCoverage(state);
  }

  buildCars() {
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#e5e7eb', '#111827', '#8b5cf6', '#f97316'];
    for (let n = 0; n < 30; n++) {
      const g = new THREE.Group();
      g.add(box(2, 0.7, 1, colors[n % colors.length], 0, 0.25, 0));
      g.add(box(1.1, 0.55, 0.9, '#cbd5e1', -0.1, 0.95, 0));
      const line = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
      const horiz = Math.random() < 0.5, dir = Math.random() < 0.5 ? 1 : -1;
      g.userData = { horiz, dir, lane: (line - OFF) * CELL + dir * 2.2, t: -HALF + Math.random() * HALF * 2, speed: 8 + Math.random() * 8 };
      g.rotation.y = horiz ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.scene.add(g);
      this.cars.push(g);
    }
  }

  floatText(i, j, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = text;
    document.getElementById('labels').appendChild(el);
    const p = toWorld(i, j); p.y = 9;
    this.labels.push({ el, p, life: 0 });
  }

  setSelected(i, j, radius = 0) {
    if (i == null) { this.select.visible = false; this.zone.visible = false; return; }
    const p = toWorld(i, j);
    this.select.position.set(p.x, 0.5, p.z);
    this.select.visible = true;
    this.zone.visible = radius > 0;
    if (radius) { this.zone.position.set(p.x, 0.5, p.z); this.zone.scale.setScalar(radius * CELL + CELL / 2); }
  }

  focus(i, j) { this.camGoal = toWorld(i, j); }

  // Круги охвата больниц и полиции: зелёные — свои, красные — конкурентов
  setCoverage(kind, on, state) {
    this.coverage = { ...(this.coverage || {}), [kind]: on };
    this.updateCoverage(state);
  }
  updateCoverage(state) {
    if (this.coverGroup) this.scene.remove(this.coverGroup);
    const g = this.coverGroup = new THREE.Group();
    const circles = [];
    for (const b of Object.values(state.buildings)) {
      if (b.state !== 'done' || !this.coverage?.[b.type] || !BUILDINGS[b.type].radius) continue;
      circles.push([b, BUILDINGS[b.type].radius, b.owner === 'player']);
    }
    // магазины: свои точки продаж (радиус зависит от известности) и чужие арендаторы-коммерсанты
    if (this.coverage?.shops) {
      const mine = new Set();
      for (const e of Object.values(state.enterprises)) {
        const h = e.host && state.buildings[e.host];
        if (h && !mine.has(h.id)) { mine.add(h.id); circles.push([h, shopRadius(e), true]); }
      }
      for (const b of Object.values(state.buildings))
        if (b.state === 'done' && !mine.has(b.id) && b.tenants?.comm?.length) circles.push([b, 3, false]);
    }
    for (const [b, rad, own] of circles) {
      const r = rad * CELL + CELL / 2;
      const color = own ? '#22c55e' : '#ef4444';
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, depthWrite: false }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
      const p = toWorld(b.i, b.j);
      for (const m of [disc, ring]) { m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.45, p.z); g.add(m); }
    }
    this.scene.add(g);
  }

  // фаза суток 0..1
  setDayPhase(t) {
    const f = Math.min(1, Math.max(0, 0.75 + 0.7 * Math.sin(Math.PI * 2 * t)));
    const a = Math.PI * 2 * t;
    this.sun.position.set(Math.cos(a) * 160, 60 + Math.sin(a) * 140, 90);
    this.sun.intensity = 0.15 + 2.3 * f;
    this.hemi.intensity = 0.25 + 0.75 * f;
    const day = new THREE.Color('#9fd3f0'), dusk = new THREE.Color('#f4a261'), night = new THREE.Color('#0b1730');
    const col = f > 0.5 ? dusk.clone().lerp(day, (f - 0.5) * 2) : night.clone().lerp(dusk, f * 2);
    this.scene.background.copy(col);
    this.scene.fog.color.copy(col);
    this.glow = Math.max(0, 1 - f * 1.6);
    this.lampMat.emissiveIntensity = this.glow * 2;
    // ночью горят окна — тем больше, чем больше жильцов и арендаторов
    for (const g of this.bObjs.values()) {
      if (!g.userData.wins) continue;
      const k = g.userData.state === 'done' ? 0.15 + 0.85 * g.userData.occ : 0;
      for (const m of g.userData.wins) m.emissiveIntensity = this.glow * 1.4 * k;
    }
  }

  bindInput() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
      down = null;
      const hit = this.pick(e);
      this.onPick(hit ? hit.i : null, hit ? hit.j : null);
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const hit = this.pick(e);
      if (hit) { const p = toWorld(hit.i, hit.j); this.hover.position.set(p.x, 0.45, p.z); }
      this.hover.visible = !!hit;
      el.style.cursor = hit ? 'pointer' : 'grab';
    });
  }

  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.tiles.values(), ...this.bObjs.values()], true)
      .find(h => h.object.type === 'Mesh');
    if (!hit) return null;
    // точка попадания по зданию лежит внутри его участка
    let o = hit.object;
    while (o.parent && !this.bObjs.has(o.userData.id) && !o.userData.i && o.userData.i !== 0) o = o.parent;
    const pt = o.userData.id && this.bObjs.has(o.userData.id) ? o.position : hit.point;
    const i = Math.round(pt.x / CELL + OFF), j = Math.round(pt.z / CELL + OFF);
    if (i < 0 || j < 0 || i >= GRID || j >= GRID || isRoad(i, j)) return null;
    return { i, j };
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.paused) return; // открыта страница — город не рисуем
    const now = performance.now();
    if (this.camGoal) {
      const t = this.controls.target, d = this.camGoal.clone().sub(t).multiplyScalar(Math.min(1, dt * 5));
      t.add(d); this.camera.position.add(d);
      if (d.length() < 0.01) this.camGoal = null;
    }
    const t = this.controls.target, lim = HALF + 30;
    const cx = Math.max(-lim, Math.min(lim, t.x)) - t.x, cz = Math.max(-lim, Math.min(lim, t.z)) - t.z;
    if (cx || cz) { t.x += cx; t.z += cz; this.camera.position.x += cx; this.camera.position.z += cz; }
    this.controls.update();

    for (const g of this.bObjs.values()) {
      const u = g.userData;
      if (u.born) {
        const age = (now - u.born) / 700;
        const fk = u.fk || 1;
        if (age < 1) { const k = 1 - Math.pow(1 - age, 3); g.scale.set(k * fk, k * (1 + Math.sin(age * Math.PI) * 0.15), k * fk); }
        else { g.scale.set(fk, 1, fk); u.born = 0; }
      }
      if (u.crane) u.crane.rotation.y = Math.sin(now / 2500 + u.id) * 1.4;
      if (u.blink) { const on = Math.floor(now / 350) % 2; u.blink[0].emissiveIntensity = on ? 2 : 0.1; u.blink[1].emissiveIntensity = on ? 0.1 : 2; }
    }
    for (const c of this.cars) {
      const u = c.userData;
      u.t += u.speed * u.dir * dt;
      if (u.t > HALF) u.t = -HALF; if (u.t < -HALF) u.t = HALF;
      if (u.horiz) c.position.set(u.t, 0.1, u.lane); else c.position.set(u.lane, 0.1, u.t);
    }
    const w = this.container.clientWidth, h = this.container.clientHeight;
    for (let n = this.labels.length - 1; n >= 0; n--) {
      const L = this.labels[n];
      L.life += dt;
      const v = L.p.clone(); v.y += L.life * 4;
      v.project(this.camera);
      L.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      L.el.style.opacity = String(Math.max(0, 1 - Math.max(0, L.life - 1) / 0.8));
      if (L.life > 1.8) { L.el.remove(); this.labels.splice(n, 1); }
    }
    if (this.select.visible) this.select.material.color.setHSL(0.14, 0.95, 0.5 + Math.sin(now / 200) * 0.15);
    this.renderer.render(this.scene, this.camera);
  }

  screenPos(i, j, y = 10) {
    const v = toWorld(i, j); v.y = y;
    v.project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-v.y * 0.5 + 0.5) * this.container.clientHeight };
  }

  heightOf(b) { return totalHeight(b) + 3; }
}

function occupancy(b) {
  const all = Object.values(b.units);
  const tot = all.reduce((a, u) => a + u.total, 0);
  return tot ? all.reduce((a, u) => a + u.occ, 0) / tot : 1;
}

export { BUILDINGS };

// Для 3D-миниатюр (thumbs.js): модели зданий и общие помощники
export const BUILDING_MODELS = { office: makeOffice, residential: makeResidential, mixed: makeResidential, mall: makeMall, hospital: makeHospital, police: makePolice, school: makeSchool };
export { facade, tree, box, cyl, mat, mesh, signMat };
