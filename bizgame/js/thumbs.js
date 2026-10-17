// 3D-миниатюры зданий и предприятий: те же low-poly модели, что и в городе, отрисованные в картинку.
// Рендерятся по запросу одним небольшим WebGL-холстом и кэшируются как data-URL.
import * as THREE from 'three';
import { BUILDINGS } from './data.js';
import { BUILDING_MODELS, facade, tree, box, cyl, mat, mesh, signMat } from './world.js';
import { entColor } from './icons.js';

const SIZE = 192;
const TEX = {};
const texFor = type => (TEX[type] ||= {
  office: () => facade('#1e3a5f', ['#3b6a9a', '#4a7fb5', '#2f5d8a'], ['#e0f2fe'], '#0f2744'),
  residential: () => facade('#e7d8c3', ['#5b6b7d', '#6b7f95'], ['#ffd27a'], '#f8f1e7'),
  hospital: () => facade('#f8fafc', ['#93c5fd', '#a5d8ff'], ['#e0f2fe'], null),
  police: () => facade('#e2e8f0', ['#475569', '#64748b'], ['#fef3c7'], null),
  school: () => facade('#fde68a', ['#92400e', '#a16207'], ['#fef3c7'], null),
}[{ mixed: 'residential', mall: 'office' }[type] || type]?.() || facade('#e5e7eb', ['#94a3b8'], ['#fff'], null));

const ground = (w = 9, d = 9, c = '#a3c585') => box(w, 0.4, d, c, 0, -0.4, 0);
const roofGable = (w, d, h, color, x = 0, y = 0, z = 0) => {
  const g = new THREE.CylinderGeometry(0.01, w / 2 * 1.15, h, 4, 1);
  const m = mesh(g, mat(color), x, y + h / 2, z);
  m.rotation.y = Math.PI / 4; m.scale.set(1, 1, d / w);
  return m;
};

// Модели предприятий: по виду, с акцентным цветом вида
const ENT_MODELS = {
  shop(c) {
    const g = new THREE.Group();
    g.add(ground(9, 9, '#cbd5e1'));
    g.add(box(7, 3.6, 5, '#f8fafc', 0, 0, -0.5));
    g.add(box(6, 2.2, 0.15, mat('#7dd3fc', { metalness: 0.3, roughness: 0.15 }), 0, 0.3, 2.05));
    const aw = box(7.4, 0.2, 1.6, c, 0, 2.8, 2.6); aw.rotation.x = 0.35; g.add(aw);
    g.add(box(4, 0.9, 0.2, signMat(c), 0, 3.7, 2));
    g.add(box(7.2, 0.3, 5.2, c, 0, 3.6, -0.5));
    g.add(box(1, 0.8, 0.8, '#f59e0b', -2.6, 0, 3.4), box(1, 0.8, 0.8, '#22c55e', -1.4, 0, 3.6));
    return g;
  },
  warehouse(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9, '#cbd5e1'));
    g.add(box(8, 3.4, 6, '#d6d3d1', 0, 0, -0.8));
    const r = mesh(new THREE.CylinderGeometry(3.05, 3.05, 8, 16, 1, false, 0, Math.PI), mat(c), 0, 3.4, -0.8);
    r.rotation.z = Math.PI / 2; r.rotation.y = Math.PI / 2; r.scale.set(1, 1, 0.45); g.add(r);
    for (const x of [-2.4, 0, 2.4]) g.add(box(1.8, 2.4, 0.1, '#78716c', x, 0, 2.25));
    for (let k = 0; k < 4; k++) g.add(box(0.9, 0.9, 0.9, '#b45309', -3.5 + (k % 2) * 1, Math.floor(k / 2) * 0.9, 3.4));
    g.add(box(1.2, 1, 0.8, '#f59e0b', 2.8, 0, 3.4), box(0.1, 1.8, 0.6, '#334155', 3.5, 0, 3.4));
    return g;
  },
  factory(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9, '#cbd5e1'));
    g.add(box(8, 3.2, 5.5, '#e5e7eb', -0.5, 0, 0));
    for (let k = 0; k < 4; k++) { const t = box(2, 1.4, 5.5, k % 2 ? '#94a3b8' : c, -3.5 + k * 2, 3.2, 0); t.rotation.z = -0.5; g.add(t); }
    g.add(cyl(0.55, 0.7, 7.5, '#9ca3af', 3.4, 0, -1.6), cyl(0.45, 0.6, 6, '#9ca3af', 3.4, 0, 1.4));
    g.add(box(1.2, 0.4, 1.2, '#ef4444', 3.4, 7.3, -1.6));
    const smoke = mat('#e5e7eb', { transparent: true, opacity: 0.8 });
    for (const [x, y, s] of [[3.6, 8.6, 0.9], [4.2, 9.6, 1.2], [4.9, 10.7, 1.4]]) g.add(mesh(new THREE.IcosahedronGeometry(s, 0), smoke, x, y, -1.6));
    return g;
  },
  sawmill(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9));
    g.add(box(5, 2.6, 4, '#a16207', -1.5, 0, -1));
    g.add(roofGable(5.6, 4.6, 1.6, '#57534e', -1.5, 2.6, -1));
    for (let k = 0; k < 6; k++) { const l = cyl(0.35, 0.35, 4, '#92400e', 2.2 + (k % 3) * 0.75, 0.35 + Math.floor(k / 3) * 0.65, 1.6, 8); l.rotation.x = Math.PI / 2; g.add(l); }
    for (const [x, z] of [[-3.8, 3], [3.5, -3.2], [-0.5, 3.6]]) g.add(tree(x, z, 0.9, true));
    return g;
  },
  livestock(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9));
    g.add(box(5.5, 3, 4.2, '#b91c1c', -1, 0, -0.8));
    g.add(roofGable(6, 4.8, 2, '#f8fafc', -1, 3, -0.8));
    g.add(box(1.6, 2, 0.1, '#f8fafc', -1, 0, 1.36));
    g.add(cyl(1.1, 1.1, 5.5, '#cbd5e1', 3, 0, -1.6, 14), mesh(new THREE.SphereGeometry(1.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#94a3b8'), 3, 5.5, -1.6));
    for (let k = 0; k < 7; k++) g.add(box(0.12, 0.8, 0.12, '#a16207', -4 + k * 1.3, 0, 3.6));
    g.add(box(8, 0.1, 0.1, '#a16207', 0, 0.6, 3.6));
    for (const [x, z] of [[1.3, 2.4], [2.6, 2.9]]) { g.add(box(1.1, 0.6, 0.5, '#f8fafc', x, 0.35, z), box(0.4, 0.35, 0.35, '#1f2937', x + 0.7, 0.6, z)); }
    return g;
  },
  cropfarm(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9, '#a16207'));
    for (let k = 0; k < 7; k++) g.add(box(9.6, 0.25, 0.7, k % 2 ? '#eab308' : '#65a30d', 0, 0, -3.8 + k * 1.2));
    g.add(box(1.8, 1.1, 1.2, c, -1, 0.3, 1), box(0.9, 0.8, 1, '#f8fafc', -0.7, 1.4, 1));
    for (const [x, z, r] of [[-1.8, 0.3, 0.5], [-1.8, 1.7, 0.5], [0, 0.3, 0.35], [0, 1.7, 0.35]]) { const w = cyl(r, r, 0.3, '#1f2937', x, r, z, 10); w.rotation.x = Math.PI / 2; g.add(w); }
    g.add(box(2.4, 2, 2.2, '#b91c1c', 3, 0.2, -3), roofGable(2.6, 2.4, 1, '#57534e', 3, 2.2, -3));
    return g;
  },
  greenhouse(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9));
    const glass = mat('#bae6fd', { transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 });
    for (const z of [-2.2, 1.4]) {
      const h = mesh(new THREE.CylinderGeometry(1.6, 1.6, 8, 14, 1, false, 0, Math.PI), glass, 0, 0.3, z);
      h.rotation.z = Math.PI / 2; h.rotation.y = Math.PI / 2; g.add(h);
      for (let k = 0; k < 6; k++) g.add(box(1.1, 0.5, 0.8, '#16a34a', -3.2 + k * 1.3, 0, z));
    }
    return g;
  },
  restaurant(c) {
    const g = new THREE.Group();
    g.add(ground(9, 9, '#e7e5e4'));
    g.add(box(6.4, 3.4, 4.6, '#fff7ed', 0, 0, -1.2));
    for (let k = 0; k < 6; k++) { const a = box(1.07, 0.18, 1.6, k % 2 ? '#f8fafc' : c, -2.68 + k * 1.07, 2.6, 1.6); a.rotation.x = 0.35; g.add(a); }
    g.add(box(3.6, 0.8, 0.2, signMat(c), 0, 3.6, 1.1), box(6.6, 0.3, 4.8, '#7c2d12', 0, 3.4, -1.2));
    for (const x of [-2.3, 0.3, 2.6]) { g.add(cyl(0.5, 0.5, 0.08, '#f8fafc', x, 0.75, 3.2, 10), cyl(0.05, 0.05, 0.75, '#334155', x, 0, 3.2, 5)); g.add(mesh(new THREE.ConeGeometry(1, 0.6, 8), mat(c), x, 2.2, 3.2), cyl(0.04, 0.04, 2, '#334155', x, 0, 3.2, 4)); }
    return g;
  },
  salon(c) {
    const g = new THREE.Group();
    g.add(ground(9, 9, '#e7e5e4'));
    g.add(box(6, 3.6, 4.6, '#fdf2f8', 0, 0, -0.8));
    g.add(box(4.6, 2.2, 0.12, mat('#fbcfe8', { metalness: 0.2, roughness: 0.2 }), 0, 0.4, 1.5));
    g.add(box(6.2, 0.6, 4.8, c, 0, 3.6, -0.8), box(3, 0.7, 0.15, signMat(c), 0, 2.8, 1.6));
    g.add(cyl(0.25, 0.25, 1.8, '#f8fafc', 2.6, 0, 2, 10), cyl(0.27, 0.27, 0.3, c, 2.6, 1.8, 2, 10));
    g.add(tree(-3.4, 2.6, 0.5, false));
    return g;
  },
  autoservice(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9, '#9ca3af'));
    g.add(box(8, 3.4, 5, '#e2e8f0', 0, 0, -1));
    for (const x of [-2.6, 0, 2.6]) g.add(box(2.1, 2.6, 0.1, x === 0 ? '#1f2937' : '#64748b', x, 0, 1.55));
    g.add(box(8.2, 0.7, 0.2, signMat(c), 0, 2.9, 1.65), box(8.2, 0.3, 5.2, c, 0, 3.4, -1));
    g.add(box(2, 0.7, 1, '#ef4444', 0, 0.2, 3), box(1.1, 0.5, 0.9, '#cbd5e1', -0.1, 0.9, 3));
    return g;
  },
  hotel(c) {
    const g = new THREE.Group();
    g.add(ground(9, 9, '#e7e5e4'));
    const tex = texFor('office');
    const m = new THREE.MeshStandardMaterial({ map: tex.map, roughness: 0.6 });
    m.map.repeat.set(1, 3);
    g.add(box(5, 11, 4, m, 0, 0, -1), box(5.4, 0.5, 4.4, c, 0, 11, -1), box(3, 1, 0.2, signMat(c), 0, 9.5, 1.1));
    g.add(box(6, 1.6, 2.4, '#f8fafc', 0, 0, 1.6), box(6.4, 0.2, 3, c, 0, 1.6, 1.8));
    return g;
  },
  construction(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9, '#d6d3d1'));
    g.add(box(5, 0.4, 5, '#9ca3af', -1, 0, 0));
    for (const [x, z] of [[-3, -2], [1, -2], [-3, 2], [1, 2]]) g.add(box(0.4, 4, 0.4, '#b8bcc2', x, 0.4, z));
    g.add(box(4.6, 0.3, 4.6, '#b8bcc2', -1, 4.4, 0));
    g.add(box(0.5, 10, 0.5, '#facc15', 3.4, 0, -2.6), box(9, 0.4, 0.5, '#facc15', 1.8, 10, -2.6), box(1.4, 0.9, 1.2, '#334155', 0, 9.4, -2.6));
    g.add(box(0.05, 4, 0.05, '#1f2937', 5.6, 6, -2.6), box(1, 0.7, 1, '#78716c', 5.6, 5.4, -2.6));
    return g;
  },
  mine(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9, '#a8a29e'));
    for (const x of [-1.6, 1.6]) { const l = box(0.4, 8.5, 0.4, '#475569', x, 0, 0); l.rotation.z = x < 0 ? -0.15 : 0.15; g.add(l); }
    g.add(box(4, 0.5, 0.8, '#475569', 0, 7.8, 0));
    const wheel = mesh(new THREE.TorusGeometry(1, 0.15, 6, 14), mat('#ef4444'), 0, 8.6, 0); g.add(wheel);
    g.add(box(3.6, 2.8, 3, '#78716c', 0, 0, -2.6), box(3.8, 0.3, 3.2, c, 0, 2.8, -2.6));
    g.add(mesh(new THREE.ConeGeometry(2, 1.8, 7), mat('#57534e'), 3, 0.9, 2.6), mesh(new THREE.ConeGeometry(1.4, 1.2, 7), mat('#44403c'), -3, 0.6, 2.8));
    g.add(box(1.8, 0.8, 1, '#f59e0b', 0, 0.2, 2.8));
    return g;
  },
  transport(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9, '#9ca3af'));
    g.add(box(4.4, 2.4, 2, '#f8fafc', -0.6, 0.6, 0), box(1.6, 1.8, 2, c, 2.4, 0.6, 0));
    for (const x of [-2, 0.5, 2.4]) for (const z of [-1, 1]) { const w = cyl(0.45, 0.45, 0.35, '#1f2937', x, 0.45, z, 10); w.rotation.x = Math.PI / 2; g.add(w); }
    g.add(box(3, 0.6, 0.1, signMat(c), -0.6, 1.6, 1.06));
    return g;
  },
  oilwell(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9, '#d6d3d1'));
    g.add(box(4, 0.5, 1.6, '#334155', -1, 0, 0));
    for (const x of [-1.6, -0.4]) { const l = box(0.25, 3.6, 0.25, '#475569', x, 0.5, 0); l.rotation.z = x < -1 ? 0.2 : -0.2; g.add(l); }
    const beam = box(5.4, 0.45, 0.45, c, -1, 4, 0); beam.rotation.z = 0.15; g.add(beam);
    g.add(box(1.2, 1.4, 0.6, '#1f2937', -3.6, 3.4, 0), box(0.12, 3.2, 0.12, '#64748b', 1.5, 0.5, 0));
    g.add(cyl(1.3, 1.3, 2.6, '#e2e8f0', 3, 0, -2.4, 14), cyl(1.3, 1.3, 2.6, '#e2e8f0', 3, 0, 1, 14));
    return g;
  },
  lab(c) {
    const g = new THREE.Group();
    g.add(ground(9, 9, '#e7e5e4'));
    g.add(box(7, 3.4, 4.6, '#f8fafc', 0, 0, -0.6), box(7.2, 0.3, 4.8, c, 0, 3.4, -0.6));
    g.add(mesh(new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#cbd5e1', { metalness: 0.5, roughness: 0.3 }), 1.6, 3.7, -0.8));
    g.add(box(5.6, 1.2, 0.1, mat('#7dd3fc', { metalness: 0.3, roughness: 0.15 }), 0, 1.5, 1.72));
    g.add(cyl(0.06, 0.06, 2.4, '#64748b', -2.4, 3.7, -1.6, 5), box(1, 0.06, 1, '#94a3b8', -2.4, 6, -1.6));
    return g;
  },
  power(c) {
    const g = new THREE.Group();
    g.add(ground(10, 9, '#d6d3d1'));
    g.add(mesh(new THREE.CylinderGeometry(1.8, 2.6, 7, 16, 1, true), mat('#e5e7eb', { side: THREE.DoubleSide }), -1.6, 3.5, -1));
    g.add(box(3.6, 3, 3, '#cbd5e1', 2.4, 0, 1.4), cyl(0.4, 0.5, 8, '#9ca3af', 3.2, 0, -2.2));
    g.add(mesh(new THREE.IcosahedronGeometry(1.4, 0), mat('#f8fafc', { transparent: true, opacity: 0.85 }), -1.4, 8, -1));
    return g;
  },
};

export class Thumbs {
  constructor() {
    this.cache = new Map();
    try {
      const r = this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setSize(SIZE, SIZE);
      r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
      r.shadowMap.enabled = true;
    } catch { this.r = null; }
    const s = this.scene = new THREE.Scene();
    s.add(new THREE.HemisphereLight('#ffffff', '#8aa0b4', 1.1));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
    sun.position.set(12, 20, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    s.add(sun);
    this.holder = new THREE.Group(); s.add(this.holder);
  }
  get(kind, type, sub) {
    if (!this.r) return null;
    const k = `${kind}:${type}`;
    if (this.cache.has(k)) return this.cache.get(k);
    let g = null;
    try {
      if (kind === 'ent' && ENT_MODELS[type]) g = ENT_MODELS[type](entColor(type));
      else if (kind === 'b' && BUILDING_MODELS[type]) {
        const d = BUILDINGS[type], f = d.floors[Math.floor((d.floors.length - 1) / 2)];
        const b = { id: 1, type, floors: f, owner: 'player', units: d.units(f, 1), tenants: {} };
        g = new THREE.Group(); g.add(ground(10, 10, '#cbd5e1')); g.add(BUILDING_MODELS[type](b, texFor(type)).g);
      }
    } catch (err) { console.warn('thumb', k, err); }
    const url = g ? this.render(g) : null;
    this.cache.set(k, url);
    return url;
  }
  render(g) {
    this.holder.clear(); this.holder.add(g);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const bb = new THREE.Box3().setFromObject(g), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const half = Math.max(size.x, size.z) * 0.5 + size.y * 0.22;
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200);
    cam.position.set(c.x + 22, c.y + 18, c.z + 22); cam.lookAt(c);
    this.r.render(this.scene, cam);
    return this.r.domElement.toDataURL('image/png');
  }
}
