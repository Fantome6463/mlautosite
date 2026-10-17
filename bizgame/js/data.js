// Справочники игры: товары и виртуальные предприятия, здания в городе, подрядчики, события.

// Товары, рецепты, оборудование и виды предприятий — в catalog.js
import { GOODS, RECIPES } from './catalog.js';
export { GOODS, RECIPES, ENTERPRISES, GROUPS, EQUIP, MARKET_SALARY, BUY_RATE, SELL_RATE, retailMul, unitOf } from './catalog.js';

export const IMPORT_MARKUP = 1.05;      // закупка на складах города (= BUY_RATE)
export const WHOLESALE_RATE = 0.85;     // склады города покупают по 85% оптовой цены (= SELL_RATE)
export const NPC_QUALITY = 3;           // качество товаров у конкурентов в рознице
export const MARKET_QUALITY = 2.5;      // качество товаров на универсальных складах
export const SHOP_TURNOVER_PER_WORKER = 30000; // продавец обслуживает покупок на 30 000 ₽ в день
export const TRANSPORT_RATE = 0.01;     // доставка между предприятиями — 1% оптовой цены груза
export const POP_SCALE = 25;            // один житель на карте = 25 покупателей района (соседи, прохожие, приезжие)

// Универсальные склады города: запас и подвоз в день считаются от выпуска одного цеха (блюд и услуг там нет)
const DEPOT_KINDS = new Set(['raw', 'mid', 'build', 'equip', 'retail']);
export const depotOf = g => (DEPOT_KINDS.has(GOODS[g].kind) && RECIPES[g]
  ? { start: Math.max(6, Math.round(RECIPES[g].rate * 60)), restock: Math.max(0.5, RECIPES[g].rate * 10) } : null);

// ---------- Город ----------

// Помещения внутри зданий. Квартиры и офисы — штуками, аренда за помещение в день;
// коммерция — площадью: total/occ в м², аренда — ₽ за м² в день.
export const UNITS = {
  apt:    { name: 'Квартиры',      one: 'квартира',   icon: '🏠', rent: 1500, upkeep: 300 },
  office: { name: 'Офисы',         one: 'офис',       icon: '💼', rent: 3200, upkeep: 500 },
  comm:   { name: 'Коммерция',     one: 'м²',         icon: '🛍️', rent: 45, upkeep: 6, area: true },
};
export const isArea = t => !!UNITS[t]?.area;

// Участки разной площади: от размера зависят цена земли, площадь здания и стоимость стройки
export const PLOT_SIZES = {
  s: { name: 'Малый', area: '0,12 га', k: 0.7 },
  m: { name: 'Средний', area: '0,18 га', k: 1 },
  l: { name: 'Крупный', area: '0,27 га', k: 1.5 },
};
export const plotK = p => PLOT_SIZES[p?.size || 'm'].k;

// Типы зданий: офисные, жилые (с коммерцией на первых этажах), коммерческие и социальные.
export const CATEGORIES = {
  office:      { name: 'Офисные',  desc: 'Офисы сдаются компаниям. Дают рабочие места.' },
  residential: { name: 'Жилые',    desc: 'Квартиры для горожан, на первых этажах — площади под магазины и кафе.' },
  commercial:  { name: 'Коммерческие', desc: 'Торговые площади под магазины, рестораны, салоны. Аренда за м².' },
  social:      { name: 'Социальные', desc: 'Больница, полиция и школа. Город платит за содержание, район становится привлекательнее.' },
};

export const BUILDINGS = {
  office: {
    category: 'office', name: 'Бизнес-центр', icon: '🏢', floors: [4, 9, 16],
    cost: f => 600000 + f * 220000, days: f => Math.round(4 + f * 1.3),
    units: (f, k = 1) => ({ office: Math.round(f * 4 * k), ...(f >= 9 ? { comm: Math.round(160 * k) } : {}) }),
    materials: { concrete: 0.5, steel: 0.25, glass: 0.25 },
  },
  residential: {
    category: 'residential', name: 'Жилой дом', icon: '🏘️', floors: [5, 9, 16],
    cost: f => 500000 + f * 180000, days: f => Math.round(4 + f * 1.1),
    units: (f, k = 1) => ({ apt: Math.round((f - 1) * 4 * k), comm: Math.round((f >= 16 ? 480 : 360) * k) }),
    materials: { bricks: 0.45, concrete: 0.3, lumber: 0.12, glass: 0.13 },
  },
  mixed: {
    category: 'residential', name: 'ЖК с торговой галереей', icon: '🏙️', floors: [12, 20], commFloors: 2,
    cost: f => 700000 + f * 220000, days: f => Math.round(6 + f * 1.1),
    units: (f, k = 1) => ({ apt: Math.round((f - 2) * 4 * k), comm: Math.round(800 * k) }),
    materials: { concrete: 0.4, bricks: 0.3, glass: 0.2, steel: 0.1 },
  },
  mall: {
    category: 'commercial', name: 'Торговый центр', icon: '🏬', floors: [2, 3, 5],
    cost: f => 600000 + f * 1200000, days: f => Math.round(6 + f * 2.5),
    units: (f, k = 1) => ({ comm: Math.round(f * 900 * k) }),
    materials: { concrete: 0.45, steel: 0.3, glass: 0.25 },
  },
  hospital: {
    category: 'social', name: 'Больница', icon: '🏥', floors: [4],
    cost: () => 3000000, days: () => 20, units: () => ({}),
    upkeep: 50000, subsidy: 56000, radius: 4, service: 'health',
    materials: { concrete: 0.45, bricks: 0.2, steel: 0.2, glass: 0.15 },
  },
  police: {
    category: 'social', name: 'Полиция', icon: '🚓', floors: [3],
    cost: () => 1800000, days: () => 14, units: () => ({}),
    upkeep: 30000, subsidy: 34000, radius: 4, service: 'safety',
    materials: { concrete: 0.45, bricks: 0.3, steel: 0.15, glass: 0.1 },
  },
  school: {
    category: 'social', name: 'Школа', icon: '🏫', floors: [3],
    cost: () => 2400000, days: () => 18, units: () => ({}),
    upkeep: 40000, subsidy: 46000, radius: 4, service: 'edu',
    materials: { concrete: 0.4, bricks: 0.35, steel: 0.1, glass: 0.15 },
  },
};

// Стройматериалы на этаж: доли по стоимости → количество. Своими силами материалы стоят ~55% цены подрядчика.
for (const d of Object.values(BUILDINGS)) {
  const f = d.floors[Math.floor(d.floors.length / 2)], perFloor = d.cost(f) / f * 0.55;
  d.materials = Object.fromEntries(Object.entries(d.materials).map(([g, share]) => [g, Math.max(1, Math.round(share * perFloor / GOODS[g].price * 10) / 10)]));
}

// Уровень города: на каждый следующий уровень нужно по 2 полиции, поликлиники (больницы) и школы (вики «Уровни городов»)
export const CITY_MAX_LEVEL = 5;
export const cityLevelOf = counts => Math.min(CITY_MAX_LEVEL, 1 + Math.floor(Math.min(counts.police || 0, counts.hospital || 0, counts.school || 0) / 2));

export const GAME_YEAR = 365;

// Уровень компании (= уровень персонажа в Бизмании): опыт за работу предприятий и недвижимости
export const COMPANY_MAX_LEVEL = 100;
export const companyXpNeed = l => Math.round(800000 * Math.pow(l, 1.8));
// Денежный бонус за новый уровень (вики «Развитие компании», в масштабе нашей экономики)
export const LEVEL_BONUS = { 2: 1000000, 3: 1500000, 4: 2000000, 5: 2500000, 6: 2500000, 7: 3000000, 8: 3000000, 9: 3500000, 10: 4000000, 11: 4500000, 12: 5000000, 13: 5500000, 14: 6000000, 15: 6500000 };
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

export const START_MONEY = 6000000;

// Штаб-квартира: отделы задают лимиты компании, уровень повышается за деньги.
export const HQ = {
  staff:  { name: 'Отдел персонала',        label: 'Сотрудников',            limit: l => 250 * 2 ** (l - 1) },
  manage: { name: 'Управляющий отдел',      label: 'Предприятий',            limit: l => 6 + 3 * (l - 1) },
  prod:   { name: 'Производственный отдел', label: 'Производимые продукты',  limit: l => 6 + 3 * (l - 1) },
  build:  { name: 'Строительный отдел',     label: 'Одновременных строек',   limit: l => 2 + (l - 1) },
  finance: { name: 'Финансовый отдел',      label: 'Предел средств на счету', limit: l => 25000000 * 2 ** (l - 1), money: true },
  mining: { name: 'Шахтёрский отдел',       label: 'Добываемые ископаемые',  limit: l => l },
};
// Сверх предела финансового отдела каждую неделю списывается 10% излишка (как в Бизмании)
export const FINANCE_PENALTY = 0.1;
export const HQ_MAX = 10;
export const hqLimit = (s, k) => HQ[k].limit(s.hq?.[k] || 1);
export const hqUpgradeCost = l => 500000 * l * l;

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
export const specSalary = level => 2000 + 900 * level * level;

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
