// Справочники игры: товары и виртуальные предприятия, здания в городе, подрядчики, события.

// ---------- Производство (виртуальные предприятия — без места на карте) ----------
export const GOODS = {
  grain:      { name: 'Зерно',       icon: '🌾', price: 8,   kind: 'raw' },
  milk:       { name: 'Молоко',      icon: '🥛', price: 12,  kind: 'raw' },
  cotton:     { name: 'Хлопок',      icon: '☁️', price: 9,   kind: 'raw' },
  wood:       { name: 'Древесина',   icon: '🪵', price: 10,  kind: 'raw' },
  ore:        { name: 'Руда',        icon: '⛰️', price: 14,  kind: 'raw' },
  oil:        { name: 'Нефть',       icon: '🛢️', price: 20,  kind: 'raw' },
  stone:      { name: 'Камень',      icon: '🪨', price: 6,   kind: 'raw' },
  sand:       { name: 'Песок',       icon: '⏳', price: 4,   kind: 'raw' },
  flour:      { name: 'Мука',        icon: '🥡', price: 22,  kind: 'mid' },
  lumber:     { name: 'Доски',       icon: '🪚', price: 25,  kind: 'mid' },
  steel:      { name: 'Сталь',       icon: '🔩', price: 55,  kind: 'mid' },
  fabric:     { name: 'Ткань',       icon: '🧵', price: 28,  kind: 'mid' },
  plastic:    { name: 'Пластик',     icon: '🧪', price: 50,  kind: 'mid' },
  cement:     { name: 'Цемент',      icon: '🧱', price: 20,  kind: 'mid' },
  concrete:   { name: 'Бетон',       icon: '🏗️', price: 18,  kind: 'build' },
  bricks:     { name: 'Кирпич',      icon: '🟥', price: 15,  kind: 'build' },
  glass:      { name: 'Стекло',      icon: '🪟', price: 30,  kind: 'build' },
  bread:      { name: 'Хлеб',        icon: '🍞', price: 40,  kind: 'retail', demand: 150 },
  cheese:     { name: 'Сыр',         icon: '🧀', price: 70,  kind: 'retail', demand: 60 },
  furniture:  { name: 'Мебель',      icon: '🛋️', price: 220, kind: 'retail', demand: 12 },
  clothes:    { name: 'Одежда',      icon: '👕', price: 120, kind: 'retail', demand: 30 },
  appliances: { name: 'Техника',     icon: '📺', price: 480, kind: 'retail', demand: 8 },
  toys:       { name: 'Игрушки',     icon: '🧸', price: 90,  kind: 'retail', demand: 25 },
};

// rate — выпуск в день при полном штате на 1-м уровне предприятия.
export const RECIPES = {
  grain:      { ent: 'farm',     rate: 360, inputs: {} },
  milk:       { ent: 'farm',     rate: 240, inputs: {} },
  cotton:     { ent: 'farm',     rate: 270, inputs: {} },
  wood:       { ent: 'forestry', rate: 300, inputs: {} },
  ore:        { ent: 'mine',     rate: 225, inputs: {} },
  oil:        { ent: 'mine',     rate: 180, inputs: {} },
  stone:      { ent: 'mine',     rate: 300, inputs: {} },
  sand:       { ent: 'mine',     rate: 360, inputs: {} },
  cement:     { ent: 'factory',  rate: 150, inputs: { stone: 2 } },
  concrete:   { ent: 'factory',  rate: 240, inputs: { cement: 0.5, sand: 1 } },
  bricks:     { ent: 'factory',  rate: 200, inputs: { stone: 1, sand: 0.5 } },
  glass:      { ent: 'factory',  rate: 120, inputs: { sand: 2 } },
  flour:      { ent: 'factory',  rate: 180, inputs: { grain: 2 } },
  bread:      { ent: 'factory',  rate: 180, inputs: { flour: 1 } },
  cheese:     { ent: 'factory',  rate: 75,  inputs: { milk: 3 } },
  lumber:     { ent: 'factory',  rate: 150, inputs: { wood: 2 } },
  steel:      { ent: 'factory',  rate: 75,  inputs: { ore: 3 } },
  fabric:     { ent: 'factory',  rate: 135,  inputs: { cotton: 2 } },
  plastic:    { ent: 'factory',  rate: 90,  inputs: { oil: 2 } },
  furniture:  { ent: 'factory',  rate: 38,  inputs: { lumber: 4, steel: 1 } },
  clothes:    { ent: 'factory',  rate: 68,  inputs: { fabric: 2 } },
  appliances: { ent: 'factory',  rate: 22,  inputs: { steel: 2, plastic: 2 } },
  toys:       { ent: 'factory',  rate: 90,  inputs: { plastic: 0.5, fabric: 0.5 } },
};

export const ENTERPRISES = {
  farm:      { name: 'Ферма',       icon: '🚜', cost: 30000, workers: 20, upkeep: 80,  storage: 3000,  desc: 'Зерно, хлопок, молоко.' },
  forestry:  { name: 'Лесхоз',      icon: '🌲', cost: 25000, workers: 15, upkeep: 60,  storage: 3000,  desc: 'Заготовка древесины.' },
  mine:      { name: 'Карьер',      icon: '⛏️', cost: 60000, workers: 25, upkeep: 150, storage: 3000,  desc: 'Руда, нефть, камень, песок.' },
  factory:   { name: 'Завод',       icon: '🏭', cost: 50000, workers: 30, upkeep: 200, storage: 4000,  desc: 'Сырьё → полуфабрикаты → товары.' },
  warehouse: { name: 'Склад',       icon: '📦', cost: 20000, workers: 5,  upkeep: 50,  storage: 20000, desc: 'Хранение и перевалка.' },
  lab:       { name: 'НИИ',         icon: '🔬', cost: 70000, workers: 12, upkeep: 200, storage: 0,     desc: 'Технологии — качество товаров.' },
  construction: { name: 'Строительная компания', icon: '👷', cost: 60000, workers: 40, upkeep: 150, storage: 8000, desc: 'Строит ваши здания своими силами из ваших стройматериалов.' },
  shop:      { name: 'Магазин',     icon: '🏬', cost: 30000, workers: 10, upkeep: 100, storage: 2000,  desc: 'Открывается в коммерческом помещении жилого дома в городе.' },
};

export const MARKET_SALARY = 20;        // средняя зарплата, ₽ в день
export const IMPORT_MARKUP = 1.15;      // закупка на оптовом рынке дороже базовой цены
export const WHOLESALE_RATE = 0.6;      // оптовый рынок покупает дешевле
export const NPC_QUALITY = 3;           // качество товаров у конкурентов
export const SHOP_UNITS_PER_WORKER = 30;
export const TRANSPORT_PER_UNIT = 0.3;  // доставка между предприятиями, ₽ за единицу

// Универсальные склады города: стартовый запас и пополнение в день (поставки извне).
export const DEPOT = {
  raw:    { start: 3000, restock: 60 },
  mid:    { start: 1500, restock: 30 },
  build:  { start: 6000, restock: 60 },
  retail: { start: 400,  restock: 10 },
};

// ---------- Город ----------

// Помещения внутри зданий: сдаются арендаторам, цена — ₽ в день за одно помещение.
export const UNITS = {
  apt:    { name: 'Квартиры',      one: 'квартира',   icon: '🏠', rent: 70,  upkeep: 15 },
  office: { name: 'Офисы',         one: 'офис',       icon: '💼', rent: 160, upkeep: 25 },
  comm:   { name: 'Коммерция',     one: 'помещение',  icon: '🛍️', rent: 220, upkeep: 30 },
};

// Три типа зданий: офисные, жилые (с коммерцией на первом этаже) и социальные.
export const CATEGORIES = {
  office:      { name: 'Офисные',  desc: 'Офисы сдаются компаниям. Дают рабочие места.' },
  residential: { name: 'Жилые',    desc: 'Квартиры для горожан, на первом этаже — магазины и кафе.' },
  social:      { name: 'Социальные', desc: 'Больница и полиция. Город платит за содержание, район становится привлекательнее.' },
};

export const BUILDINGS = {
  office: {
    category: 'office', name: 'Бизнес-центр', icon: '🏢', floors: [4, 9, 16],
    cost: f => 30000 + f * 11000, days: f => Math.round(4 + f * 1.3),
    units: f => ({ office: f * 4 }),
    materials: { concrete: 180, steel: 40, glass: 90 },
  },
  residential: {
    category: 'residential', name: 'Жилой дом', icon: '🏘️', floors: [5, 9, 16],
    cost: f => 25000 + f * 9000, days: f => Math.round(4 + f * 1.1),
    units: f => ({ apt: (f - 1) * 4, comm: f >= 16 ? 4 : 3 }),
    materials: { bricks: 220, concrete: 80, lumber: 40, glass: 30 },
  },
  hospital: {
    category: 'social', name: 'Больница', icon: '🏥', floors: [4],
    cost: () => 150000, days: () => 20, units: () => ({}),
    upkeep: 2500, subsidy: 2800, radius: 4, service: 'health',
    materials: { concrete: 240, bricks: 120, steel: 50, glass: 80 },
  },
  police: {
    category: 'social', name: 'Полиция', icon: '🚓', floors: [3],
    cost: () => 90000, days: () => 14, units: () => ({}),
    upkeep: 1500, subsidy: 1700, radius: 4, service: 'safety',
    materials: { concrete: 200, bricks: 160, steel: 40, glass: 50 },
  },
};

// Строительные компании-подрядчики
export const CONTRACTORS = {
  trest: { name: 'СтройТрест',         price: 1.0,  speed: 1.0, quality: 3, delay: 0.05, color: '#f59e0b', desc: 'Надёжно, средняя цена' },
  fast:  { name: 'БыстроСтрой',        price: 1.35, speed: 0.6, quality: 3, delay: 0.02, color: '#ef4444', desc: 'Быстро, но дорого' },
  econ:  { name: 'ЭконоДом',           price: 0.8,  speed: 1.4, quality: 2, delay: 0.18, color: '#84cc16', desc: 'Дёшево, медленно, бывают простои' },
  grand: { name: 'Гранд Девелопмент',  price: 1.5,  speed: 1.1, quality: 5, delay: 0.03, color: '#a855f7', desc: 'Премиум-качество — жильцы платят охотнее' },
};
// «Своими силами» — строит ваша строительная компания (см. ENTERPRISES.construction)
export const OWN = { name: 'Своими силами', quality: 3, color: '#3b82f6', desc: 'Платите только за стройматериалы и зарплату строителей' };
export const contractorInfo = id => (id === 'own' ? OWN : CONTRACTORS[id]);
export const ADVANCE = 0.2; // аванс подрядчику при заказе

export const START_MONEY = 250000;

// Город: сетка GRID×GRID, дороги на каждой 4-й линии.
export const GRID = 17;
export const isRoad = (i, j) => i % 4 === 0 || j % 4 === 0;

export const RIVALS = [
  { name: 'ООО «Колос-Девелопмент»', color: '#e8a33d' },
  { name: 'АО «СтальИнвест»',        color: '#7d8a99' },
  { name: 'ГК «Северный квартал»',   color: '#4f9d69' },
  { name: 'Холдинг «Меридиан»',      color: '#d946ef' },
];

export const PLAYER_COLOR = '#3b82f6';

export const EVENTS = [
  { key: 'apt',    mult: 1.35, text: 'Приток переселенцев: спрос на жильё вырос' },
  { key: 'apt',    mult: 0.75, text: 'Горожане уезжают в пригород: спрос на жильё упал' },
  { key: 'office', mult: 1.4,  text: 'Деловой бум: компании ищут офисы' },
  { key: 'office', mult: 0.7,  text: 'Кризис: компании сокращают офисы' },
  { key: 'comm',   mult: 1.4,  text: 'Сезон распродаж: магазинам нужны помещения' },
  { key: 'build',  mult: 1.2,  text: 'Подорожали стройматериалы: новые стройки дороже на 20%' },
  { key: 'build',  mult: 0.85, text: 'Стройматериалы подешевели: новые стройки дешевле на 15%' },
  { goods: ['grain', 'cotton', 'milk'], kind: 'price', mult: 1.35, text: g => `Неурожай! ${g} дорожает` },
  { goods: ['wood', 'ore', 'oil', 'grain'], kind: 'price', mult: 0.7, text: g => `Перепроизводство: ${g} дешевеет` },
  { goods: ['steel', 'plastic', 'fabric', 'lumber', 'flour'], kind: 'price', mult: 1.3, text: g => `Дефицит на рынке: ${g} дорожает` },
  { goods: ['bread', 'cheese', 'clothes', 'toys', 'furniture', 'appliances'], kind: 'demand', mult: 1.6, text: g => `Горожане скупают товар «${g}»` },
  { salary: 1.1, text: 'Профсоюзы добились роста зарплат' },
];

// Названия арендаторов для коммерции и офисов
export const TENANTS = {
  comm: ['Кафе «Ромашка»', 'Пекарня «Колосок»', 'Аптека «Здоровье»', 'Цветы', 'Продукты 24', 'Барбершоп «Борода»', 'Пиццерия «Тесто»',
    'Магазин «Обувь»', 'Кофейня «Зерно»', 'Салон связи', 'Книжный «Буква»', 'Зоомагазин «Лапа»', 'Ремонт телефонов', 'Суши «Васаби»', 'Химчистка'],
  office: ['ООО «Вектор»', 'ИТ «Код»', 'Юрфирма «Право»', 'Агентство «Идея»', 'Логистика «Путь»', 'Банк «Опора»', 'Страхование «Щит»',
    'Студия «Пиксель»', 'Аудит «Баланс»', 'Турфирма «Компас»', 'Риелторы «Ключ»', 'Колл-центр «Связь»'],
};
