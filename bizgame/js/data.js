// Справочники игры: товары и виртуальные предприятия, здания в городе, подрядчики, события.

// Товары, рецепты и виды предприятий — в catalog.js
export { GOODS, RECIPES, ENTERPRISES, GROUPS } from './catalog.js';


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
// Блюда и услуги на складах не продаются — их делают на месте

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
  school: {
    category: 'social', name: 'Школа', icon: '🏫', floors: [3],
    cost: () => 120000, days: () => 18, units: () => ({}),
    upkeep: 2000, subsidy: 2300, radius: 4, service: 'edu',
    materials: { concrete: 220, bricks: 200, steel: 30, glass: 70 },
  },
};

// Уровень города: на каждый следующий уровень нужно по 2 полиции, поликлиники (больницы) и школы (вики «Уровни городов»)
export const CITY_MAX_LEVEL = 5;
export const cityLevelOf = counts => Math.min(CITY_MAX_LEVEL, 1 + Math.floor(Math.min(counts.police || 0, counts.hospital || 0, counts.school || 0) / 2));

// Оборудование по видам предприятий: сколько рабочих обслуживает единицу и срок службы в игровых годах (вики «Износ оборудования»)
export const EQUIP = {
  factory: { name: 'Производственная линия', icon: '🏭', per: 10, life: 1.15 },
  cropfarm: { name: 'Трактор', icon: '🚜', per: 2, life: 2.5 },
  livestock: { name: 'Стадо', icon: '🐄', per: 1, life: 3.5 },
  sawmill: { name: 'Тяжёлое оборудование', icon: '🪚', per: 10, life: 2 },
  mine: { name: 'Горное оборудование', icon: '⛏️', per: 10, life: 2 },
  oilwell: { name: 'Горное оборудование', icon: '⛏️', per: 10, life: 2 },
  warehouse: { name: 'Автопогрузчик', icon: '🚜', per: 1, life: 2 },
  construction: { name: 'Кран', icon: '🏗️', per: 50, life: 2 },
  lab: { name: 'Прибор', icon: '🔬', per: 4, life: 1.6 },
  restaurant: { name: 'Холодильник', icon: '🧊', per: 2, life: 3 },
  salon: { name: 'Оборудование салона', icon: '💺', per: 2, life: 1.5 },
  autoservice: { name: 'Станки', icon: '🔧', per: 1, life: 1.2 },
  // магазинам и теплицам оборудование не нужно
};
export const GAME_YEAR = 365;

// Уровень компании (= уровень персонажа в Бизмании): опыт за работу предприятий и недвижимости
export const COMPANY_MAX_LEVEL = 100;
export const companyXpNeed = l => Math.round(8000 * Math.pow(l, 1.8));
// Денежный бонус за новый уровень (вики «Развитие компании», в масштабе нашей экономики)
export const LEVEL_BONUS = { 2: 50000, 3: 75000, 4: 100000, 5: 125000, 6: 125000, 7: 150000, 8: 150000, 9: 175000, 10: 200000, 11: 225000, 12: 250000, 13: 275000, 14: 300000, 15: 325000 };
// Возможности, открывающиеся с уровнем компании
export const FEATURES = { specialists: 5, autoSupply: 7, loans: 11 };
export const AUTO_SUPPLY_ENT_LEVEL = 8;

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

// Штаб-квартира: отделы задают лимиты компании, уровень повышается за деньги.
export const HQ = {
  staff:  { name: 'Отдел персонала',        label: 'Сотрудников',            limit: l => 250 * 2 ** (l - 1) },
  manage: { name: 'Управляющий отдел',      label: 'Предприятий',            limit: l => 6 + 3 * (l - 1) },
  prod:   { name: 'Производственный отдел', label: 'Производимые продукты',  limit: l => 6 + 3 * (l - 1) },
  build:  { name: 'Строительный отдел',     label: 'Одновременных строек',   limit: l => 2 + (l - 1) },
  finance: { name: 'Финансовый отдел',      label: 'Предел средств на счету', limit: l => 1000000 * 2 ** (l - 1), money: true },
  mining: { name: 'Шахтёрский отдел',       label: 'Добываемые ископаемые',  limit: l => l },
};
// Сверх предела финансового отдела каждую неделю списывается 10% излишка (как в Бизмании)
export const FINANCE_PENALTY = 0.1;
export const HQ_MAX = 10;
export const hqLimit = (s, k) => HQ[k].limit(s.hq?.[k] || 1);
export const hqUpgradeCost = l => 25000 * l * l;

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

// Специалисты: у каждого вида предприятий — своя профессия
export const PROFESSIONS = {
  shop: 'Продавец', warehouse: 'Кладовщик', factory: 'Начальник цеха', sawmill: 'Лесоруб', livestock: 'Зоотехник',
  cropfarm: 'Агроном', greenhouse: 'Тепличник', restaurant: 'Шеф-повар', salon: 'Мастер красоты', autoservice: 'Автомеханик',
  construction: 'Прораб', mine: 'Горный мастер', oilwell: 'Буровой мастер', lab: 'Учёный',
};
export const SPEC_NAMES = {
  m: ['Николай Крутов', 'Илья Федотов', 'Георгий Трубленков', 'Вячеслав Краснов', 'Андрей Соколов', 'Павел Орлов', 'Дмитрий Зайцев',
    'Сергей Белов', 'Олег Миронов', 'Тимур Каримов', 'Артём Волков', 'Роман Кузнецов', 'Максим Лебедев', 'Игорь Гусев'],
  f: ['Анна Смирнова', 'Мария Иванова', 'Елена Попова', 'Ольга Васнецова', 'Дарья Морозова', 'Светлана Новикова', 'Ирина Козлова',
    'Наталья Егорова', 'Алина Сафина', 'Ксения Павлова'],
};
export const SPEC_FACES = { m: ['👨', '🧔', '👱‍♂️', '👨‍🦰', '👴', '👨‍🦱'], f: ['👩', '👩‍🦰', '👱‍♀️', '👩‍🦱', '👵'] };
export const specSalary = level => 15 * level * level;

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
  { goods: ['bread', 'cheese', 'tshirt', 'toys', 'furniture', 'tv', 'pizza', 'haircut'], kind: 'demand', mult: 1.6, text: g => `Горожане скупают товар «${g}»` },
  { salary: 1.1, text: 'Профсоюзы добились роста зарплат' },
];

// Названия арендаторов для коммерции и офисов
// Какому профилю торговли соответствует арендатор (для конкуренции магазинов)
export const TENANT_PROFILE = {
  'Кафе «Ромашка»': 'restaurant', 'Пекарня «Колосок»': 'shop:grocery', 'Аптека «Здоровье»': 'shop:pharmacy', 'Цветы': 'shop:jewelry',
  'Продукты 24': 'shop:grocery', 'Барбершоп «Борода»': 'salon', 'Пиццерия «Тесто»': 'restaurant', 'Магазин «Обувь»': 'shop:clothes',
  'Кофейня «Зерно»': 'restaurant', 'Салон связи': 'shop:electronics', 'Книжный «Буква»': 'shop:kids', 'Зоомагазин «Лапа»': 'shop:department',
  'Ремонт телефонов': 'shop:electronics', 'Суши «Васаби»': 'restaurant', 'Химчистка': 'shop:department',
};
export const TENANTS = {
  comm: ['Кафе «Ромашка»', 'Пекарня «Колосок»', 'Аптека «Здоровье»', 'Цветы', 'Продукты 24', 'Барбершоп «Борода»', 'Пиццерия «Тесто»',
    'Магазин «Обувь»', 'Кофейня «Зерно»', 'Салон связи', 'Книжный «Буква»', 'Зоомагазин «Лапа»', 'Ремонт телефонов', 'Суши «Васаби»', 'Химчистка'],
  office: ['ООО «Вектор»', 'ИТ «Код»', 'Юрфирма «Право»', 'Агентство «Идея»', 'Логистика «Путь»', 'Банк «Опора»', 'Страхование «Щит»',
    'Студия «Пиксель»', 'Аудит «Баланс»', 'Турфирма «Компас»', 'Риелторы «Ключ»', 'Колл-центр «Связь»'],
};
