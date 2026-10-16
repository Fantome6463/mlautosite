// Единый набор линейных иконок (24×24, обводка currentColor) вместо разнородных эмодзи.
// Типы предприятий и зданий показываются цветной плиткой с белым значком.

const P = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  city: '<path d="M3 21h18M5 21V9l5-3v15M10 21V10h9v11M13 13.5h3M13 17h3M7.5 11v.01M7.5 14.5v.01M7.5 18v.01"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18M11 13v2h2v-2"/>',
  factory: '<path d="M2 21h20M3 21V11l5 3v-3l5 3v-3l5 3V4h3v17"/><path d="M7 17.5h1.5M11.5 17.5H13M16 17.5h1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  crane: '<path d="M7 21V3M3.5 21h7M7 3l13 3.5H7M7 7.5l4.5 4.5M18 6.5V12M16.3 12h3.4v3h-3.4z"/>',
  wallet: '<path d="M19 7V5.5A2.5 2.5 0 0 0 16.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M3 6.5A2.5 2.5 0 0 0 5.5 9H19a2 2 0 0 1 2 2v2h-4.5a2 2 0 0 0 0 4H21"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  trendDown: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  truck: '<path d="M13 16V6H3v10h1.5M8.5 16H15M13 9h4.5l3.5 3.5V16h-1.5"/><circle cx="6.5" cy="16.5" r="2"/><circle cx="17.5" cy="16.5" r="2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v5M8 21h8M9 18h6"/>',
  tasks: '<path d="M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>',
  report: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 17v-3M12 17v-6M16 17v-4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.4M12 17.2v.01"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  play: '<path d="M7 4.5l12.5 7.5L7 19.5z" fill="currentColor"/>',
  ff: '<path d="M3.5 6l8 6-8 6zM12.5 6l8 6-8 6z" fill="currentColor"/>',
  fff: '<path d="M2 6l6.5 6L2 18zM9 6l6.5 6L9 18z" fill="currentColor"/><path d="M19.5 6v12"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9M10 20.5a2 2 0 0 0 4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  pencil: '<path d="M16.5 3.5l4 4L8 20H4v-4z"/><path d="M14 6l4 4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  alert: '<path d="M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17v.01"/>',
  stop: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19.5 7"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  coins: '<circle cx="9" cy="9" r="6"/><path d="M15.4 9.3a6 6 0 1 1-6.1 6.1M9 6.5v5M7 8h3.2a1.2 1.2 0 0 1 0 2.4H7"/>',
  bars: '<path d="M3 21h18M6 17v-5M10.5 17V7M15 17v-8M19.5 17v-3"/>',
  pie: '<path d="M21 12.5A9 9 0 1 1 11.5 3v9.5z"/><path d="M15 3.4A9 9 0 0 1 20.6 9H15z"/>',
  box: '<path d="M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  map: '<path d="M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3z"/><path d="M9 3.5v14M15 6.5v14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h4M14 12h3v4h-3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  hardhat: '<path d="M3 18h18M4 18v-2a8 8 0 0 1 16 0v2M10 8.3V5h4v3.3M9.5 9a6.5 6.5 0 0 0-3 5.5M14.5 9a6.5 6.5 0 0 1 3 5.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
  store: '<path d="M3 9l1.5-5h15L21 9c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3S3 10.7 3 9zM5 12v9h14v-9M10 21v-5h4v5"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.5L22 8H6.1"/>',
  shirt: '<path d="M8 3L3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>',
  sofa: '<path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2"/>',
  tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M9 2l3 4 3-4"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21L8 9l4-6 4 6z"/>',
  car: '<path d="M5 17H3v-5l2.2-5h13.6L21 12v5h-2M3 12h18M9.5 17h5"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
  brick: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M9 14.3V19"/>',
  pill: '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z"/><path d="M8.5 8.5l5 5"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l4 2.9-1.5 4.6h-5L8 10.4zM12 3v4.5M21 10.5l-5 0M17.5 19.5l-3-4.5M6.5 19.5l3-4.5M3 10.5h5"/>',
  balloon: '<path d="M12 2.5c3 0 5.5 2.8 5.5 6.3S15 15.5 12 15.5 6.5 12.3 6.5 8.8 9 2.5 12 2.5zM12 15.5l-1 2h2zM12 17.5c0 2-2 2-2 4"/>',
  warehouse: '<path d="M3 21V8.5l9-5 9 5V21"/><path d="M7 21v-9h10v9M7 15h10M7 18h10"/>',
  tree: '<path d="M12 2.5l6 8h-3l4 6H5l4-6H6zM12 16.5V22"/>',
  log: '<ellipse cx="6.5" cy="12" rx="3" ry="5"/><ellipse cx="6.5" cy="12" rx="1" ry="1.8"/><path d="M6.5 7H18a3 5 0 0 1 0 10H6.5"/>',
  paw: '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="5.8" r="1.8"/><circle cx="14.5" cy="5.8" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12 11.5c-2.6 0-5 3.2-5 5.7 0 1.6 1.2 2.3 2.4 2.3 1.2 0 1.6-.6 2.6-.6s1.4.6 2.6.6c1.2 0 2.4-.7 2.4-2.3 0-2.5-2.4-5.7-5-5.7z"/>',
  wheat: '<path d="M12 22V7M12 7c-1.8 0-3-1.4-3-3.5 1.8 0 3 1.4 3 3.5zm0 0c1.8 0 3-1.4 3-3.5-1.8 0-3 1.4-3 3.5zM12 12c-2 0-3.5-1.5-3.5-3.5 2 0 3.5 1.5 3.5 3.5zm0 0c2 0 3.5-1.5 3.5-3.5-2 0-3.5 1.5-3.5 3.5zM12 17c-2 0-3.5-1.5-3.5-3.5 2 0 3.5 1.5 3.5 3.5zm0 0c2 0 3.5-1.5 3.5-3.5-2 0-3.5 1.5-3.5 3.5z"/>',
  sprout: '<path d="M12 21v-9M12 12C12 8 9 6 5 6c0 4 3 6 7 6zM12 10c0-3 2.5-6 7-6 0 4-3 6-7 6zM6 21h12"/>',
  utensils: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18M17 21V3c-2.2 1-3.5 4-3.5 8h3.5"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6L20 18M8.6 16.4L20 6"/>',
  bed: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11.5" r="1.8"/>',
  pickaxe: '<path d="M13.5 10.5L4 20M3.5 7.5c4.5-4 11-5 16.5-2-3.5-.5-7 .5-9.5 2.5M16.5 20.5c4-4.5 5-11 2-16.5.5 3.5-.5 7-2.5 9.5"/>',
  drop: '<path d="M12 3s6.5 6.6 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 9.6 12 3 12 3z"/>',
  flask: '<path d="M9 3h6M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.4-2.6L14 9.2V3M7.2 15h9.6"/>',
  nut: '<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><circle cx="12" cy="12" r="3"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
  bread: '<path d="M5 11a3 3 0 0 1 0-6h14a3 3 0 0 1 0 6v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M9 9v.01M12 8v.01M15 9v.01"/>',
  home: '<path d="M3 11l9-8 9 8M5 9.3V21h14V9.3M10 21v-6h4v6"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15M10.5 21v-2.5h3V21"/>',
  hospital: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 7.5v9M7.5 12h9"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8l1.2 2.5 2.8.4-2 2 .5 2.7L12 14.3l-2.5 1.3.5-2.7-2-2 2.8-.4z"/>',
  school: '<path d="M2 9.5l10-5 10 5-10 5z"/><path d="M6 11.5v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9.5V15"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  pin: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8.5M21 3.5v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 15.5M3 20.5v-5h5"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/>',
  star: '<path d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/>',
  bank: '<path d="M3 21h18M4 10h16M12 3l9 5H3zM6 10v8M10 10v8M14 10v8M18 10v8"/>',
  handshake: '<path d="M2 12l4-4 4 2 3-3 4 1 5 4M6 8v6l5 5 2-2M13 17l2 2 2-2-2-2M17 15l2-2-4-4"/>',
  people: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><circle cx="4.5" cy="10" r="2"/><circle cx="19.5" cy="10" r="2"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  power: '<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};

export const ic = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.circle}</svg>`;

// Цвет и значок вида предприятия; у подвидов — свой значок, если есть
const ENT = {
  shop: ['store', '#e11d48'], warehouse: ['warehouse', '#b45309'], factory: ['factory', '#4f46e5'], sawmill: ['tree', '#15803d'],
  livestock: ['paw', '#a16207'], cropfarm: ['wheat', '#65a30d'], greenhouse: ['sprout', '#16a34a'], restaurant: ['utensils', '#ea580c'],
  salon: ['scissors', '#db2777'], autoservice: ['wrench', '#0e7490'], hotel: ['bed', '#7c3aed'], construction: ['hardhat', '#d97706'],
  mine: ['pickaxe', '#57534e'], transport: ['truck', '#0369a1'], oilwell: ['drop', '#1f2937'], lab: ['flask', '#0891b2'], power: ['zap', '#ca8a04'],
};
const SUB = {
  'shop:grocery': 'cart', 'shop:clothes': 'shirt', 'shop:department': 'sofa', 'shop:electronics': 'tv', 'shop:jewelry': 'gem', 'shop:auto': 'car',
  'shop:buildshop': 'brick', 'shop:pharmacy': 'pill', 'shop:sport': 'ball', 'shop:kids': 'balloon',
  'warehouse:materials': 'brick', 'warehouse:goods': 'box', 'warehouse:food': 'wheat', 'warehouse:tech': 'car', 'warehouse:chem': 'flask',
  'factory:wood': 'log', 'factory:auto': 'car', 'factory:build': 'brick', 'factory:food': 'bread', 'factory:apparel': 'shirt', 'factory:electronic': 'chip',
  'factory:jewelry': 'gem', 'factory:pharma': 'pill', 'factory:sport': 'ball', 'factory:machine': 'gear', 'factory:metal': 'nut', 'factory:chem': 'flask',
  'mine:gold': 'coins', 'mine:sand': 'pickaxe', 'mine:clay': 'pickaxe', 'mine:ore': 'pickaxe', 'mine:coal': 'pickaxe', 'mine:stone': 'pickaxe',
};
export const entColor = type => (ENT[type] || ['box', '#64748b'])[1];
export const entGlyph = (type, sub) => SUB[`${type}:${sub}`] || (ENT[type] || ['box'])[0];
// Плитка-значок предприятия. size: '' (32px), 'sm' (24px), 'lg' (48px), 'xl' (64px)
export const entTile = (type, sub = null, size = '', title = '') =>
  `<span class="ti ${size}" style="--c:${entColor(type)}"${title ? ` title="${title}"` : ''}>${ic(entGlyph(type, sub))}</span>`;
export const eTile = (e, size = '', title = '') => entTile(e.type, e.sub, size, title);

const BLD = { office: ['building', '#2563eb'], residential: ['home', '#0d9488'], hospital: ['hospital', '#dc2626'], police: ['shield', '#1d4ed8'], school: ['school', '#d97706'], site: ['crane', '#f59e0b'] };
export const bGlyph = type => (BLD[type] || BLD.office)[0];
export const bTile = (type, size = '', title = '') => `<span class="ti ${size}" style="--c:${(BLD[type] || BLD.office)[1]}"${title ? ` title="${title}"` : ''}>${ic(bGlyph(type))}</span>`;
export const unitIc = t => ic({ apt: 'home', office: 'briefcase', comm: 'bag' }[t] || 'box');

// Убрать эмодзи в начале строки (новости, тосты), чтобы не смешивать стили
export const stripEmoji = t => String(t).replace(/^(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}][️‍\p{Extended_Pictographic}]*\s*)+/u, '');
