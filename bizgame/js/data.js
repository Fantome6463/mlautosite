// Справочники игры: товары, рецепты, здания, события.

export const GOODS = {
  grain:      { name: 'Зерно',       icon: '🌾', price: 8,   kind: 'raw' },
  milk:       { name: 'Молоко',      icon: '🥛', price: 12,  kind: 'raw' },
  cotton:     { name: 'Хлопок',      icon: '☁️', price: 9,   kind: 'raw' },
  wood:       { name: 'Древесина',   icon: '🪵', price: 10,  kind: 'raw' },
  ore:        { name: 'Руда',        icon: '🪨', price: 14,  kind: 'raw' },
  oil:        { name: 'Нефть',       icon: '🛢️', price: 20,  kind: 'raw' },
  flour:      { name: 'Мука',        icon: '🥡', price: 22,  kind: 'mid' },
  lumber:     { name: 'Доски',       icon: '🪚', price: 25,  kind: 'mid' },
  steel:      { name: 'Сталь',       icon: '🔩', price: 55,  kind: 'mid' },
  fabric:     { name: 'Ткань',       icon: '🧵', price: 28,  kind: 'mid' },
  plastic:    { name: 'Пластик',     icon: '🧪', price: 50,  kind: 'mid' },
  bread:      { name: 'Хлеб',        icon: '🍞', price: 40,  kind: 'retail', demand: 150 },
  cheese:     { name: 'Сыр',         icon: '🧀', price: 70,  kind: 'retail', demand: 60 },
  furniture:  { name: 'Мебель',      icon: '🛋️', price: 220, kind: 'retail', demand: 12 },
  clothes:    { name: 'Одежда',      icon: '👕', price: 120, kind: 'retail', demand: 30 },
  appliances: { name: 'Техника',     icon: '📺', price: 480, kind: 'retail', demand: 8 },
  toys:       { name: 'Игрушки',     icon: '🧸', price: 90,  kind: 'retail', demand: 25 },
};

// rate — выпуск в день при полном штате на 1-м уровне здания.
export const RECIPES = {
  grain:      { building: 'farm',     rate: 360, inputs: {} },
  milk:       { building: 'farm',     rate: 240, inputs: {} },
  cotton:     { building: 'farm',     rate: 270, inputs: {} },
  wood:       { building: 'forestry', rate: 300, inputs: {} },
  ore:        { building: 'mine',     rate: 225, inputs: {} },
  oil:        { building: 'mine',     rate: 180, inputs: {} },
  flour:      { building: 'factory',  rate: 180, inputs: { grain: 2 } },
  bread:      { building: 'factory',  rate: 180, inputs: { flour: 1 } },
  cheese:     { building: 'factory',  rate: 75,  inputs: { milk: 3 } },
  lumber:     { building: 'factory',  rate: 150, inputs: { wood: 2 } },
  steel:      { building: 'factory',  rate: 75,  inputs: { ore: 3 } },
  fabric:     { building: 'factory',  rate: 135,  inputs: { cotton: 2 } },
  plastic:    { building: 'factory',  rate: 90,  inputs: { oil: 2 } },
  furniture:  { building: 'factory',  rate: 38,  inputs: { lumber: 4, steel: 1 } },
  clothes:    { building: 'factory',  rate: 68,  inputs: { fabric: 2 } },
  appliances: { building: 'factory',  rate: 22,  inputs: { steel: 2, plastic: 2 } },
  toys:       { building: 'factory',  rate: 90,  inputs: { plastic: 0.5, fabric: 0.5 } },
};

export const BUILDINGS = {
  farm:      { name: 'Ферма',       icon: '🚜', cost: 30000, workers: 20, upkeep: 80, storage: 3000,
               desc: 'Выращивает зерно, хлопок, даёт молоко.' },
  forestry:  { name: 'Лесхоз',      icon: '🌲', cost: 25000, workers: 15, upkeep: 60, storage: 3000,
               desc: 'Заготавливает древесину.' },
  mine:      { name: 'Шахта',       icon: '⛏️', cost: 60000, workers: 25, upkeep: 150, storage: 3000,
               desc: 'Добывает руду и нефть.' },
  factory:   { name: 'Завод',       icon: '🏭', cost: 50000, workers: 30, upkeep: 200, storage: 4000,
               desc: 'Перерабатывает сырьё в полуфабрикаты и товары.' },
  warehouse: { name: 'Склад',       icon: '📦', cost: 20000, workers: 5,  upkeep: 50, storage: 20000,
               desc: 'Хранит товары, перевалочный пункт для поставок.' },
  shop:      { name: 'Магазин',     icon: '🏬', cost: 40000, workers: 10, upkeep: 150, storage: 2000,
               desc: 'Продаёт товары горожанам. Выгоднее всего в центре.' },
  lab:       { name: 'НИИ',         icon: '🔬', cost: 70000, workers: 12, upkeep: 200, storage: 0,
               desc: 'Исследует технологии — растёт качество товаров.' },
};

export const MARKET_SALARY = 20;      // средняя зарплата по городу, ₽ в день
export const IMPORT_MARKUP = 1.15;    // закупка на оптовом рынке дороже базовой цены
export const WHOLESALE_RATE = 0.6;   // оптовый рынок покупает дешевле
export const NPC_QUALITY = 3;         // качество у конкурентов в магазинах
export const SHOP_UNITS_PER_WORKER = 30;
export const TRANSPORT_PER_UNIT = 0.05; // за клетку расстояния
export const START_MONEY = 250000;

// Город: сетка GRID×GRID, дороги на каждой 4-й линии.
export const GRID = 17;
export const isRoad = (i, j) => i % 4 === 0 || j % 4 === 0;

export const RIVALS = [
  { name: 'ООО «Колос»',       color: '#e8a33d' },
  { name: 'АО «СтальПром»',    color: '#7d8a99' },
  { name: 'ГК «Северный лес»', color: '#4f9d69' },
  { name: 'Холдинг «Меридиан»',color: '#b05cc7' },
];

export const EVENTS = [
  { type: 'price', text: g => `Неурожай! Цены на ${g} выросли`, goods: ['grain', 'cotton', 'milk'], mult: 1.35 },
  { type: 'price', text: g => `Перепроизводство: ${g} подешевели`, goods: ['wood', 'ore', 'oil', 'grain'], mult: 0.7 },
  { type: 'price', text: g => `Дефицит на рынке: ${g} подорожали`, goods: ['steel', 'plastic', 'fabric', 'lumber', 'flour'], mult: 1.3 },
  { type: 'demand', text: g => `Горожане скупают ${g} — спрос вырос`, goods: ['bread', 'cheese', 'clothes', 'toys', 'furniture', 'appliances'], mult: 1.6 },
  { type: 'demand', text: g => `Мода прошла: спрос на ${g} упал`, goods: ['clothes', 'toys', 'furniture'], mult: 0.6 },
  { type: 'salary', text: () => 'Профсоюзы добились роста зарплат по городу', mult: 1.1 },
];
