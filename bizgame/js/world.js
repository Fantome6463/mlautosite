// 3D-мир: пустой город, стройплощадки с кранами, офисы, жилые дома, больницы, полиция.
import * as THREE from 'three';
import { OrbitControls } from './../vendor/OrbitControls.js';
import { GRID, isRoad, BUILDINGS, contractorInfo, RIVALS, PLAYER_COLOR } from './data.js';

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
function makeOffice(b, tex) {
  const g = new THREE.Group(), wins = [];
  const h = b.floors * FLOOR, col = ownerColor(b);
  const w = 7, d = 6.4;
  const low = b.floors > 9 ? Math.round(b.floors * 0.65) : b.floors;
  const m1 = windowMat(tex, w, low, { metalness: 0.35 });
  g.add(box(w, low * FLOOR, d, m1, 0, 0.3, 0)); wins.push(m1);
  if (low < b.floors) {
    const m2 = windowMat(tex, w - 2, b.floors - low, { metalness: 0.35 });
    g.add(box(w - 2, (b.floors - low) * FLOOR, d - 1.6, m2, 0, 0.3 + low * FLOOR, 0)); wins.push(m2);
    g.add(box(w + 0.2, 0.35, d + 0.2, col, 0, 0.3 + low * FLOOR, 0));
  }
  g.add(box(w - (low < b.floors ? 1.8 : -0.2), 0.45, d - (low < b.floors ? 1.4 : -0.2), col, 0, 0.3 + h, 0));
  g.add(box(2, 1.2, 1.4, '#94a3b8', 0.8, 0.75 + h, 0));
  g.add(box(w + 0.6, 0.3, d + 0.6, '#64748b', 0, 0, 0));
  g.add(box(3, 0.2, 1.4, '#cbd5e1', 0, 3, d / 2 + 0.6));
  if (b.floors >= 16) g.add(cyl(0.06, 0.1, 4, '#9ca3af', -1, 0.75 + h, 0, 5));
  return { g, wins };
}

function makeResidential(b, tex) {
  const g = new THREE.Group(), wins = [];
  const col = ownerColor(b);
  const w = 7.6, d = 6, ground = 3.2;
  const upper = b.floors - 1, h = ground + upper * FLOOR;
  // первый этаж — коммерция: витрины, маркизы, вывески
  g.add(box(w, ground, d, '#e2e8f0', 0, 0, 0));
  const shopColors = ['#ef4444', '#22c55e', '#f59e0b', '#06b6d4'];
  const n = b.units.comm?.total || 3;
  const sw = w / n;
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + sw * (k + 0.5);
    g.add(box(sw - 0.5, 2, 0.12, mat('#7dd3fc', { roughness: 0.15, metalness: 0.3 }), x, 0.3, d / 2 + 0.02));
    const aw = box(sw - 0.3, 0.12, 1.1, shopColors[k % 4], x, 2.45, d / 2 + 0.55); aw.rotation.x = 0.3; g.add(aw);
    g.add(box(sw - 0.8, 0.45, 0.1, signMat(shopColors[k % 4]), x, 2.7, d / 2 + 0.06));
  }
  const m = windowMat(tex, w, upper);
  g.add(box(w, upper * FLOOR, d, m, 0, ground, 0)); wins.push(m);
  for (let f = 0; f < upper; f += 2) g.add(box(w * 0.7, 0.18, 0.7, '#cbd5e1', 0, ground + f * FLOOR + 0.1, d / 2 + 0.35));
  g.add(box(w + 0.3, 0.4, d + 0.3, col, 0, h, 0));
  g.add(box(1.4, 1.6, 1.4, '#a8a29e', -2, h + 0.4, -1));
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

// ---------- стройплощадка ----------
function totalHeight(b) {
  return b.type === 'residential' ? 3.2 + (b.floors - 1) * FLOOR : b.floors * FLOOR;
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
      office: facade('#1e3a5f', ['#3b6a9a', '#4a7fb5', '#2f5d8a'], ['#e0f2fe', '#fef3c7'], '#0f2744'),
      residential: facade('#e7d8c3', ['#5b6b7d', '#6b7f95'], ['#ffd27a', '#ffe9b0', '#ffc35c'], '#f8f1e7'),
      hospital: facade('#f8fafc', ['#93c5fd', '#a5d8ff'], ['#e0f2fe', '#ffffff'], null),
      police: facade('#e2e8f0', ['#475569', '#64748b'], ['#fef3c7', '#e0f2fe'], null),
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
    s.fog = new THREE.Fog('#9fd3f0', 260, 520);

    const cam = this.camera = new THREE.PerspectiveCamera(42, 1, 1, 1200);
    cam.position.set(85, 95, 115);
    const c = this.controls = new OrbitControls(cam, r.domElement);
    c.enableDamping = true; c.dampingFactor = 0.08;
    c.maxPolarAngle = 1.2; c.minDistance = 25; c.maxDistance = 300;
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
        const make = { office: makeOffice, residential: makeResidential, hospital: makeHospital, police: makePolice }[b.type];
        const r = make(b, this.tex[b.type]);
        g = r.g; extra = { wins: r.wins, blink: r.blink };
        if (b.owner === 'player' && b.type !== 'police') g.add(flag(PLAYER_COLOR, -4.2, 4.2, 5));
      }
      const pos = toWorld(b.i, b.j);
      g.position.set(pos.x, 0.4, pos.z);
      const fresh = !cur || cur.userData.state !== b.state;
      g.userData = { ...g.userData, ...extra, sig, occ, state: b.state, born: fresh ? performance.now() : 0, id: b.id };
      if (fresh) g.scale.setScalar(0.01);
      this.scene.add(g);
      this.bObjs.set(b.id, g);
    }
    for (const [id, g] of this.bObjs) if (!alive.has(id)) { this.scene.remove(g); this.bObjs.delete(id); }
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
        if (age < 1) { const k = 1 - Math.pow(1 - age, 3); g.scale.set(k, k * (1 + Math.sin(age * Math.PI) * 0.15), k); }
        else { g.scale.setScalar(1); u.born = 0; }
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
