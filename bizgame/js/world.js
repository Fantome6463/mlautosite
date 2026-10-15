// 3D-мир: город, здания, машины, грузовики, дым, день и ночь.
import * as THREE from 'three';
import { OrbitControls } from './../vendor/OrbitControls.js';
import { GRID, isRoad, GOODS } from './data.js';

const CELL = 10;
const OFF = (GRID - 1) / 2;
const HALF = (GRID * CELL) / 2;
const ROAD_LINES = [];
for (let k = 0; k < GRID; k++) if (k % 4 === 0) ROAD_LINES.push(k);

export const toWorld = (i, j) => new THREE.Vector3((i - OFF) * CELL, 0, (j - OFF) * CELL);

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
const box = (w, h, d, color, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color, x, y + h / 2, z);
const cyl = (rt, rb, h, color, x = 0, y = 0, z = 0, seg = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color), x, y + h / 2, z);
function prism(len, r, color, x, y, z, alongX = true) {
  const g = new THREE.CylinderGeometry(r, r, len, 3);
  g.rotateX(-Math.PI / 2);
  if (alongX) g.rotateY(Math.PI / 2);
  return mesh(g, mat(color), x, y + r / 2, z);
}
function tree(x, z, s = 1, pine = Math.random() < 0.5) {
  const g = new THREE.Group();
  g.add(cyl(0.18 * s, 0.25 * s, 1.2 * s, '#6b4a2b', 0, 0, 0, 6));
  const greens = ['#3f8f4a', '#4e9f3d', '#2f7a43', '#5aa65a'];
  const c = greens[Math.floor(Math.random() * greens.length)];
  if (pine) {
    g.add(mesh(new THREE.ConeGeometry(1.2 * s, 2.2 * s, 7), mat(c), 0, 2 * s, 0));
    g.add(mesh(new THREE.ConeGeometry(0.9 * s, 1.8 * s, 7), mat(c), 0, 2.9 * s, 0));
  } else {
    g.add(mesh(new THREE.IcosahedronGeometry(1.2 * s, 0), mat(c), 0, 2.2 * s, 0));
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI;
  return g;
}

// Текстура окон для небоскрёбов: днём — стекло, ночью — горящие окна.
function windowTextures() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const e = document.createElement('canvas'); e.width = 64; e.height = 64;
  const x = c.getContext('2d'), y = e.getContext('2d');
  x.fillStyle = '#d9dee6'; x.fillRect(0, 0, 64, 64);
  y.fillStyle = '#000'; y.fillRect(0, 0, 64, 64);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    x.fillStyle = Math.random() < 0.5 ? '#5d7898' : '#6f8fb3';
    x.fillRect(k * 16 + 3, r * 16 + 4, 10, 9);
    if (Math.random() < 0.55) { y.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#fff1c4'; y.fillRect(k * 16 + 3, r * 16 + 4, 10, 9); }
  }
  const map = new THREE.CanvasTexture(c), emi = new THREE.CanvasTexture(e);
  for (const t of [map, emi]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; }
  return { map, emi };
}

function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function flag(color, x, z, h = 7) {
  const g = new THREE.Group();
  g.add(cyl(0.08, 0.08, h, '#e5e7eb', 0, 0, 0, 6));
  const f = box(1.6, 1, 0.05, color, 0.8, h - 1.1, 0);
  f.castShadow = false;
  g.add(f);
  g.userData.flag = f;
  g.position.set(x, 0, z);
  return g;
}

const PLAYER = '#3b82f6';

// ---------- модели зданий ----------
function makeBuilding(type, level) {
  const g = new THREE.Group();
  const smoke = [];
  const H = 1 + 0.35 * (level - 1);
  switch (type) {
    case 'farm': {
      for (let r = 0; r < 5; r++) g.add(box(3.6, 0.25 + r % 2 * 0.1, 0.6, r % 2 ? '#d9b44a' : '#c99a2e', -1.8, 0, -3.4 + r * 0.9));
      g.add(box(4, 2.4 * H, 3, '#b8432f', 1.6, 0, 0.6));
      g.add(prism(3.3, 1.9, '#7b2d22', 1.6, 2.4 * H, 0.6, false));
      g.add(box(1, 1.4, 0.1, '#f5f0e6', 1.6, 0, 2.12));
      for (let k = 0; k < level; k++) {
        g.add(cyl(0.8, 0.8, 4 * H, '#cfd6dc', 3.6 - k * 1.8, 0, -2.4));
        g.add(mesh(new THREE.SphereGeometry(0.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#9aa6b1'), 3.6 - k * 1.8, 4 * H, -2.4));
      }
      g.add(box(1.4, 0.9, 0.9, '#2f9e44', -1.6, 0, 2.6));
      break;
    }
    case 'forestry': {
      g.add(box(3, 2 * H, 2.4, '#8b5e34', -2, 0, 2));
      g.add(prism(3.2, 1.6, '#5b3a1e', -2, 2 * H, 2));
      for (let k = 0; k < 5; k++) g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 8).rotateZ(Math.PI / 2), mat('#a0703f'), 2, 0.3 + (k % 3) * 0.55, 2.2 + Math.floor(k / 3) * 0.6 - (k % 2) * 0.3));
      for (let k = 0; k < 6 + level * 2; k++) g.add(tree(-3.5 + Math.random() * 7.5, -3.8 + Math.random() * 4, 0.9 + Math.random() * 0.5, true));
      break;
    }
    case 'mine': {
      g.add(box(8.5, 0.1, 8.5, '#5d5348', 0, 0, 0));
      const legs = 4 * H + 3;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.25, legs, 0.25, '#7f1d1d', x - 1.5, 0, z - 1.5));
      g.add(box(2.5, 0.25, 2.5, '#7f1d1d', -1.5, legs, -1.5));
      const wheel = mesh(new THREE.TorusGeometry(1, 0.15, 6, 16), mat('#374151'), -1.5, legs + 1, -1.5);
      g.add(wheel); g.userData.spin = wheel;
      g.add(box(3, 2.2 * H, 2.4, '#9ca3af', 2, 0, -2));
      g.add(mesh(new THREE.ConeGeometry(1.6, 1.8, 7), mat('#57534e'), 2, 0.9, 2.2));
      g.add(mesh(new THREE.ConeGeometry(1.2, 1.4, 7), mat('#292524'), -1.8, 0.7, 2.5));
      g.add(cyl(0.3, 0.3, 3 * H, '#57534e', 3.2, 2.2 * H, -2.6, 8));
      smoke.push(new THREE.Vector3(3.2, 5.4 * H, -2.6));
      break;
    }
    case 'factory': {
      g.add(box(7.5, 3.4 * H, 5.5, '#cbd5e1', -0.5, 0, 0.8));
      for (let k = 0; k < 4; k++) g.add(prism(5.5, 1.2, k % 2 ? '#64748b' : '#94a3b8', -3.4 + k * 1.9, 3.4 * H, 0.8, false));
      g.add(box(2, 2.2, 0.1, '#475569', -0.5, 0, 3.6));
      for (let k = 0; k < Math.min(level + 1, 3); k++) {
        const x = 3.6, z = -2.6 + k * 2.2, h = 6 * H + 2;
        g.add(cyl(0.45, 0.6, h, '#b91c1c', x, 0, z, 10));
        g.add(cyl(0.47, 0.47, 0.5, '#f8fafc', x, h * 0.6, z, 10));
        smoke.push(new THREE.Vector3(x, h + 0.3, z));
      }
      g.add(cyl(1, 1, 2.5, '#e2e8f0', -3.2, 0, -3.3, 12));
      break;
    }
    case 'warehouse': {
      g.add(box(8, 2.6 * H, 5, '#d6c7a1', 0, 0, 0));
      const roof = mesh(new THREE.CylinderGeometry(2.5, 2.5, 8, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), mat('#8d99ae'), 0, 2.6 * H, 0);
      g.add(roof);
      for (let k = 0; k < 3; k++) g.add(box(1.6, 1.8, 0.1, '#4b5563', -2.6 + k * 2.6, 0, 2.52));
      for (let k = 0; k < 2 + level; k++) g.add(box(1, 0.8, 1, '#c08a4a', -3.5 + k * 1.3, 0, 3.6));
      break;
    }
    case 'shop': {
      g.add(box(7, 3.4 * H, 5.5, '#f1f5f9', 0, 0, -0.5));
      g.add(box(6.2, 2.2, 0.15, new THREE.MeshStandardMaterial({ color: '#7dd3fc', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }), 0, 0.2, 2.3));
      for (let k = 0; k < 7; k++) {
        const a = box(1, 0.12, 1.5, k % 2 ? '#ef4444' : '#fefefe', -3 + k, 2.6, 3);
        a.rotation.x = 0.35;
        g.add(a);
      }
      const sign = box(4.2, 0.9, 0.2, new THREE.MeshStandardMaterial({ color: PLAYER, emissive: PLAYER, emissiveIntensity: 0.6 }), 0, 3.4 * H, 2.25);
      g.add(sign); g.userData.glow = sign;
      g.add(box(1.4, 0.5, 1.4, '#94a3b8', 2, 3.4 * H, -1.5));
      break;
    }
    case 'lab': {
      g.add(box(6, 3 * H, 5, '#f8fafc', -0.8, 0, 0.5));
      g.add(box(6.2, 0.4, 5.2, '#38bdf8', -0.8, 3 * H, 0.5));
      g.add(mesh(new THREE.SphereGeometry(1.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e2e8f0', { metalness: 0.4, roughness: 0.3 }), -0.8, 3 * H + 0.4, 0.5));
      g.add(cyl(0.1, 0.1, 2.5, '#64748b', 3.2, 0, -3, 6));
      const dish = mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), mat('#cbd5e1', { side: THREE.DoubleSide }), 3.2, 2.8, -3);
      dish.rotation.x = Math.PI * 0.7;
      g.add(dish); g.userData.spin = dish;
      break;
    }
  }
  g.add(flag(PLAYER, -4.2, -4.2, 6 + 2 * H));
  g.userData.smoke = smoke;
  return g;
}

function npcTower(h, color, winTex) {
  const g = new THREE.Group();
  const w = 5 + Math.random() * 3, d = 5 + Math.random() * 3;
  const map = winTex.map.clone(), emi = winTex.emi.clone();
  for (const t of [map, emi]) { t.needsUpdate = true; t.repeat.set(Math.round(w / 2.5), Math.round(h / 3)); }
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap: emi, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.6, metalness: 0.1 });
  m.userData.windows = true;
  g.add(box(w, h, d, m, 0, 0, 0));
  g.add(box(w + 0.3, 0.6, d + 0.3, color, 0, h, 0));
  if (h > 25 && Math.random() < 0.6) g.add(cyl(0.08, 0.12, 4, '#9ca3af', 0, h + 0.6, 0, 5));
  if (h < 12) g.add(box(w * 0.4, 1.2, d * 0.4, '#9ca3af', w * 0.15, h, 0));
  return g;
}

function saleSign() {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.07, 1.6, '#78716c', 0, 0, 0, 5));
  g.add(box(1.6, 0.8, 0.08, '#fbbf24', 0, 1.3, 0));
  g.position.set(3, 0, 3.3);
  return g;
}

// ---------- мир ----------
export class World {
  constructor(container, { onPick, onHover }) {
    this.container = container;
    this.onPick = onPick; this.onHover = onHover;
    this.plotObjs = new Map();   // "i,j" → { tile, deco }
    this.bObjs = new Map();      // id → group
    this.trucks = []; this.cars = []; this.smokes = []; this.labels = [];
    this.windowMats = [];
    this.winTex = windowTextures();
    this.smokeTex = smokeTexture();
    this.clock = new THREE.Clock();
    this.dayFactor = 1;

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
    cam.position.set(95, 105, 125);
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
    const ring = new THREE.EdgesGeometry(new THREE.BoxGeometry(CELL * 0.98, 0.6, CELL * 0.98));
    this.select = new THREE.LineSegments(ring, new THREE.LineBasicMaterial({ color: '#facc15' }));
    this.select.visible = false; s.add(this.select);

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
    // деревья за городом
    for (let k = 0; k < 260; k++) {
      const a = Math.random() * Math.PI * 2, d = HALF + 12 + Math.random() * 160;
      s.add(tree(Math.cos(a) * d, Math.sin(a) * d, 1.2 + Math.random() * 1.4));
    }
    // река
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
    const dg = new THREE.BoxGeometry(1.8, 0.02, 0.25);
    const dm = new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ color: '#f5f5f4' }), dashes.length);
    const o = new THREE.Object3D();
    dashes.forEach(([x, z, horiz], n) => { o.position.set(x, 0.12, z); o.rotation.y = horiz ? 0 : Math.PI / 2; o.updateMatrix(); dm.setMatrixAt(n, o.matrix); });
    s.add(dm);
    this.tiles = [];
  }

  // Полная перестройка участков по состоянию игры
  syncPlots(state) {
    for (const p of Object.values(state.plots)) this.syncPlot(state, p);
  }

  syncPlot(state, p) {
    const k = `${p.i},${p.j}`;
    const sig = p.kind + '|' + (p.kind === 'npc' ? p.height.toFixed(1) : '');
    const prev = this.plotObjs.get(k);
    if (prev && prev.sig === sig) return;
    if (prev) { this.scene.remove(prev.tile, prev.deco); this.tiles.splice(this.tiles.indexOf(prev.tile), 1); }
    const pos = toWorld(p.i, p.j);
    const grassy = p.kind === null || p.kind === 'park';
    const tile = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.94, 0.4, CELL * 0.94), mat(grassy ? (p.kind === 'park' ? '#6fbf5a' : '#93c572') : '#c9ccd1'));
    tile.position.set(pos.x, 0.2, pos.z); tile.receiveShadow = true;
    tile.userData = { i: p.i, j: p.j };
    const deco = new THREE.Group();
    deco.position.set(pos.x, 0.4, pos.z);
    if (p.kind === 'npc') {
      const rivalColors = ['#e8a33d', '#7d8a99', '#4f9d69', '#b05cc7'];
      const t = npcTower(p.height, rivalColors[p.owner] || '#9ca3af', this.winTex);
      t.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
      deco.add(t);
      t.traverse(o => { if (o.material?.userData?.windows) this.windowMats.push(o.material); });
    } else if (p.kind === 'park') {
      for (let n = 0; n < 5; n++) deco.add(tree(-3.5 + Math.random() * 7, -3.5 + Math.random() * 7, 0.8 + Math.random() * 0.6));
      const pond = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.1 }));
      pond.rotation.x = -Math.PI / 2; pond.position.set(Math.random() * 2 - 1, 0.02, Math.random() * 2 - 1);
      deco.add(pond);
    } else if (p.kind === null) {
      deco.add(saleSign());
      if (Math.random() < 0.5) deco.add(tree(-3, -3, 0.7));
    }
    this.scene.add(tile, deco);
    this.tiles.push(tile);
    this.plotObjs.set(k, { tile, deco, sig });
  }

  syncBuildings(state) {
    const alive = new Set();
    for (const b of Object.values(state.buildings)) {
      alive.add(b.id);
      const cur = this.bObjs.get(b.id);
      if (cur && cur.userData.level === b.level) { cur.userData.active = Object.keys(b.last.produced).length > 0; continue; }
      if (cur) this.scene.remove(cur);
      const g = makeBuilding(b.type, b.level);
      const pos = toWorld(b.i, b.j);
      g.position.set(pos.x, 0.4, pos.z);
      g.userData = { ...g.userData, level: b.level, born: performance.now(), active: false, id: b.id };
      g.scale.setScalar(0.01);
      this.scene.add(g);
      this.bObjs.set(b.id, g);
    }
    for (const [id, g] of this.bObjs) if (!alive.has(id)) { this.scene.remove(g); this.bObjs.delete(id); }
  }

  buildCars() {
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#e5e7eb', '#111827', '#8b5cf6', '#f97316'];
    for (let n = 0; n < 36; n++) {
      const g = new THREE.Group();
      const c = colors[n % colors.length];
      g.add(box(2, 0.7, 1, c, 0, 0.25, 0));
      g.add(box(1.1, 0.55, 0.9, '#cbd5e1', -0.1, 0.95, 0));
      const line = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
      const horiz = Math.random() < 0.5, dir = Math.random() < 0.5 ? 1 : -1;
      g.userData = { horiz, dir, lane: (line - OFF) * CELL + dir * 2.2, t: -HALF + Math.random() * HALF * 2, speed: 8 + Math.random() * 8 };
      g.rotation.y = horiz ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.scene.add(g);
      this.cars.push(g);
    }
  }

  spawnTruck(A, B, good) {
    if (this.trucks.length > 40) return;
    const nearestRoad = v => ROAD_LINES.reduce((a, k) => Math.abs(k - v) < Math.abs(a - v) ? k : a, ROAD_LINES[0]);
    const pa = toWorld(A.i, A.j), pb = toWorld(B.i, B.j);
    const rj = (nearestRoad(A.j) - OFF) * CELL, ri = (nearestRoad(B.i) - OFF) * CELL;
    const pts = [pa, new THREE.Vector3(pa.x, 0, rj), new THREE.Vector3(ri, 0, rj), new THREE.Vector3(ri, 0, pb.z), pb];
    const g = new THREE.Group();
    const kindColor = { raw: '#a16207', mid: '#0e7490', retail: '#be185d' }[GOODS[good].kind];
    g.add(box(1.1, 1, 1.2, '#f8fafc', 1.1, 0.25, 0));
    g.add(box(2.2, 1.5, 1.3, kindColor, -0.6, 0.25, 0));
    this.scene.add(g);
    this.trucks.push({ g, pts, seg: 0, t: 0 });
  }

  floatText(i, j, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = text;
    document.getElementById('labels').appendChild(el);
    const p = toWorld(i, j); p.y = 9;
    this.labels.push({ el, p, life: 0 });
  }

  emitSmoke(pos) {
    if (this.smokes.length > 260) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: '#e5e7eb', transparent: true, opacity: 0.7, depthWrite: false }));
    sp.position.copy(pos);
    sp.scale.setScalar(1);
    this.scene.add(sp);
    this.smokes.push({ sp, life: 0, vx: (Math.random() - 0.3) * 0.8, vz: (Math.random() - 0.5) * 0.6 });
  }

  setSelected(i, j) {
    if (i == null) { this.select.visible = false; return; }
    const p = toWorld(i, j);
    this.select.position.set(p.x, 0.5, p.z);
    this.select.visible = true;
  }

  focus(i, j) {
    const p = toWorld(i, j);
    this.camGoal = p;
  }

  // фаза суток 0..1
  setDayPhase(t) {
    const f = Math.min(1, Math.max(0, 0.75 + 0.7 * Math.sin(Math.PI * 2 * t)));
    this.dayFactor = f;
    const a = Math.PI * 2 * t;
    this.sun.position.set(Math.cos(a) * 160, 60 + Math.sin(a) * 140, 90);
    this.sun.intensity = 0.15 + 2.3 * f;
    this.hemi.intensity = 0.25 + 0.75 * f;
    const day = new THREE.Color('#9fd3f0'), dusk = new THREE.Color('#f4a261'), night = new THREE.Color('#0b1730');
    const col = f > 0.5 ? dusk.clone().lerp(day, (f - 0.5) * 2) : night.clone().lerp(dusk, f * 2);
    this.scene.background.copy(col);
    this.scene.fog.color.copy(col);
    const glow = Math.max(0, 1 - f * 1.6);
    for (const m of this.windowMats) m.emissiveIntensity = glow * 1.4;
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
      this.onHover?.(hit);
    });
  }

  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // кликнуть можно и по зданию — ищем ближайший участок под точкой попадания
    const objs = [...this.tiles, ...this.bObjs.values(), ...[...this.plotObjs.values()].map(o => o.deco)];
    const hit = this.raycaster.intersectObjects(objs, true)[0];
    if (!hit) return null;
    const i = Math.round(hit.point.x / CELL + OFF), j = Math.round(hit.point.z / CELL + OFF);
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
    const t = this.controls.target;
    const lim = HALF + 30;
    const cx = Math.max(-lim, Math.min(lim, t.x)) - t.x, cz = Math.max(-lim, Math.min(lim, t.z)) - t.z;
    if (cx || cz) { t.x += cx; t.z += cz; this.camera.position.x += cx; this.camera.position.z += cz; }
    this.controls.update();

    // появление зданий
    for (const g of this.bObjs.values()) {
      const age = (now - g.userData.born) / 700;
      if (age < 1) { const k = 1 - Math.pow(1 - age, 3); g.scale.set(k, k * (1 + Math.sin(age * Math.PI) * 0.15), k); }
      else if (g.scale.x !== 1) g.scale.setScalar(1);
      if (g.userData.spin) g.userData.spin.rotation[g.userData.spin.geometry.type === 'TorusGeometry' ? 'z' : 'y'] += dt * (g.userData.active ? 2 : 0.2);
      if (g.userData.active) for (const p of g.userData.smoke) if (Math.random() < dt * 5) this.emitSmoke(g.localToWorld(p.clone()));
    }
    for (let n = this.smokes.length - 1; n >= 0; n--) {
      const s = this.smokes[n];
      s.life += dt;
      s.sp.position.x += s.vx * dt; s.sp.position.z += s.vz * dt; s.sp.position.y += dt * 2.2;
      s.sp.scale.setScalar(1 + s.life * 1.6);
      s.sp.material.opacity = Math.max(0, 0.6 - s.life * 0.2);
      if (s.life > 3) { this.scene.remove(s.sp); s.sp.material.dispose(); this.smokes.splice(n, 1); }
    }
    for (const c of this.cars) {
      const u = c.userData;
      u.t += u.speed * u.dir * dt;
      if (u.t > HALF) u.t = -HALF; if (u.t < -HALF) u.t = HALF;
      if (u.horiz) c.position.set(u.t, 0.1, u.lane); else c.position.set(u.lane, 0.1, u.t);
    }
    for (let n = this.trucks.length - 1; n >= 0; n--) {
      const tr = this.trucks[n];
      const a = tr.pts[tr.seg], b = tr.pts[tr.seg + 1];
      const len = a.distanceTo(b) || 0.001;
      tr.t += (dt * 22) / len;
      if (tr.t >= 1) { tr.seg++; tr.t = 0; if (tr.seg >= tr.pts.length - 1) { this.scene.remove(tr.g); this.trucks.splice(n, 1); continue; } }
      const A = tr.pts[tr.seg], B = tr.pts[tr.seg + 1];
      tr.g.position.lerpVectors(A, B, tr.t); tr.g.position.y = 0.1;
      if (B.distanceTo(A) > 0.01) tr.g.rotation.y = Math.atan2(-(B.z - A.z), B.x - A.x);
    }
    // плавающие подписи
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

  // экранные координаты здания — для значков над зданиями
  screenPos(i, j, y = 10) {
    const v = toWorld(i, j); v.y = y;
    v.project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-v.y * 0.5 + 0.5) * this.container.clientHeight };
  }
}
