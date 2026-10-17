// Каталог: товары, рецепты, оборудование и виды предприятий с подвидами (как «Создание предприятия» в Бизмании).
// Цены — реальные рублёвые: price — оптовая цена на рынке города за единицу (unit), розничная — выше на наценку группы.

// Зарплата и рыночные коэффициенты нужны уже здесь — по ним рассчитывается производительность цехов
export const MARKET_SALARY = 2500;   // средняя зарплата рабочего, ₽ в день
export const BUY_RATE = 1.05;        // закупка на складах города: +5% к оптовой цене
export const SELL_RATE = 0.85;       // продажа на склады города: 85% оптовой цены

// kind: raw — сырьё, mid — полуфабрикаты, build — стройматериалы, equip — оборудование и техника,
// retail — товары, dish — блюда, service — услуги. demand — сколько единиц покупают 100 жителей в день.
const G = (name, icon, price, kind, group, unit, demand = 0) => ({ name, icon, price, kind, group, unit, demand });

export const GOODS = {
  // земледелие и теплицы
  grain: G('Зерно', '🌾', 12, 'raw', 'agro', 'кг'),
  potato: G('Картофель', '🥔', 18, 'raw', 'agro', 'кг', 15),
  sunflower: G('Подсолнечник', '🌻', 25, 'raw', 'agro', 'кг'),
  sugarbeet: G('Сахарная свёкла', '🍠', 4, 'raw', 'agro', 'кг'),
  hay: G('Сено', '🌿', 5, 'raw', 'agro', 'кг'),
  cotton: G('Хлопок', '☁️', 90, 'raw', 'agro', 'кг'),
  apple: G('Яблоки', '🍏', 40, 'raw', 'agro', 'кг', 8),
  grapes: G('Виноград', '🍇', 120, 'raw', 'agro', 'кг', 1),
  tomato: G('Помидоры', '🍅', 120, 'raw', 'agro', 'кг', 4),
  cucumber: G('Огурцы', '🥒', 90, 'raw', 'agro', 'кг', 4),
  carrot: G('Морковь', '🥕', 25, 'raw', 'agro', 'кг', 5),
  pepper: G('Перец', '🫑', 180, 'raw', 'agro', 'кг', 1.5),
  greens: G('Зелень', '🥬', 40, 'raw', 'agro', 'пучок', 3),
  // животноводство
  milk: G('Молоко', '🥛', 35, 'raw', 'animal', 'л', 20),
  beef: G('Говядина', '🥩', 400, 'raw', 'animal', 'кг', 2),
  pork: G('Свинина', '🍖', 250, 'raw', 'animal', 'кг', 3),
  chicken: G('Курица', '🍗', 180, 'raw', 'animal', 'кг', 4),
  eggs: G('Яйца', '🥚', 70, 'raw', 'animal', 'дес.', 8),
  fish: G('Рыба', '🐟', 250, 'raw', 'animal', 'кг', 2),
  hide: G('Шкуры', '🟫', 1500, 'raw', 'animal', 'шт'),
  wool: G('Шерсть', '🧶', 250, 'raw', 'animal', 'кг'),
  fur: G('Мех', '🦊', 10000, 'raw', 'animal', 'шкурка'),
  young: G('Молодняк', '🐣', 25000, 'equip', 'animal', 'гол.'),
  // лес, недра, нефть
  wood: G('Древесина', '🪵', 3000, 'raw', 'wood', 'м³'),
  ore: G('Железная руда', '⛰️', 4000, 'raw', 'mineral', 'т'),
  coal: G('Уголь', '⚫', 3500, 'raw', 'mineral', 'т'),
  stone: G('Камень', '🪨', 1200, 'raw', 'mineral', 'т'),
  sand: G('Песок', '⏳', 600, 'raw', 'mineral', 'т'),
  clay: G('Глина', '🟤', 700, 'raw', 'mineral', 'т'),
  gold: G('Золото', '🪙', 5000, 'raw', 'mineral', 'г'),
  oil: G('Нефть', '🛢️', 25000, 'raw', 'chem', 'т'),
  // полуфабрикаты
  flour: G('Мука', '🥡', 30, 'mid', 'food', 'кг'),
  sugar: G('Сахар', '🧂', 50, 'mid', 'food', 'кг', 3),
  fodder: G('Комбикорм', '🌰', 20, 'mid', 'agro', 'кг'),
  lumber: G('Доски', '🪚', 12000, 'mid', 'wood', 'м³'),
  paper: G('Бумага', '📄', 70, 'mid', 'wood', 'кг'),
  cardboard: G('Картон', '📦', 40, 'mid', 'wood', 'кг'),
  steel: G('Сталь', '🔩', 60000, 'mid', 'metal', 'т'),
  fabric: G('Ткань', '🧵', 200, 'mid', 'clothes', 'м'),
  leather: G('Кожа', '👜', 800, 'mid', 'clothes', 'м²'),
  plastic: G('Пластик', '🧪', 100, 'mid', 'chem', 'кг'),
  rubber: G('Резина', '⚫', 180, 'mid', 'chem', 'кг'),
  silicon: G('Кремний', '💎', 600, 'mid', 'chem', 'кг'),
  diesel: G('Дизельное топливо', '⛽', 55, 'mid', 'chem', 'л'),
  fertilizer: G('Удобрения', '🧫', 30, 'mid', 'chem', 'кг'),
  explosives: G('Взрывчатка', '🧨', 200, 'mid', 'chem', 'кг'),
  vetmed: G('Ветпрепараты', '💉', 300, 'mid', 'pharma', 'уп.'),
  chips: G('Микросхемы', '🔌', 800, 'mid', 'electronics', 'шт'),
  engine: G('Двигатель', '⚙️', 80000, 'mid', 'auto', 'шт'),
  tires: G('Шины', '🛞', 4000, 'mid', 'auto', 'шт', 0.03),
  // стройматериалы
  cement: G('Цемент', '🧱', 280, 'build', 'build', 'мешок', 0.6),
  concrete: G('Бетон', '🏗️', 5500, 'build', 'build', 'м³'),
  bricks: G('Кирпич', '🟥', 20, 'build', 'build', 'шт'),
  glass: G('Стекло', '🪟', 700, 'build', 'build', 'м²'),
  tiles: G('Плитка', '🔲', 600, 'build', 'build', 'м²', 0.4),
  paint: G('Краска', '🎨', 300, 'build', 'chem', 'л', 0.3),
  // оборудование и техника (покупается предприятиями, делается на машиностроительном и электронном заводах)
  prodline: G('Производственная линия', '🏭', 250000, 'equip', 'equip', 'шт'),
  tractor: G('Трактор', '🚜', 400000, 'equip', 'equip', 'шт'),
  harvester: G('Лесозаготовительная техника', '🌲', 350000, 'equip', 'equip', 'шт'),
  minegear: G('Горное оборудование', '⛏️', 500000, 'equip', 'equip', 'шт'),
  drillrig: G('Буровая установка', '🛢️', 1000000, 'equip', 'equip', 'шт'),
  forklift: G('Автопогрузчик', '🚛', 300000, 'equip', 'equip', 'шт'),
  crane: G('Башенный кран', '🏗️', 1900000, 'equip', 'equip', 'шт'),
  machtools: G('Станки', '🛠️', 150000, 'equip', 'equip', 'шт'),
  salonkit: G('Оборудование салона', '💺', 50000, 'equip', 'equip', 'шт'),
  labkit: G('Лабораторный прибор', '🔬', 300000, 'equip', 'equip', 'шт'),
  fridge: G('Холодильное оборудование', '🧊', 60000, 'equip', 'equip', 'шт'),
  // продукты питания
  bread: G('Хлеб', '🍞', 35, 'retail', 'food', 'бул.', 25),
  cheese: G('Сыр', '🧀', 560, 'retail', 'food', 'кг', 1.5),
  butter: G('Сливочное масло', '🧈', 900, 'retail', 'food', 'кг', 1),
  sausage: G('Колбаса', '🌭', 520, 'retail', 'food', 'кг', 2),
  juice: G('Сок', '🧃', 105, 'retail', 'food', 'л', 4),
  canned: G('Консервы', '🥫', 115, 'retail', 'food', 'банка', 3),
  chocolate: G('Шоколад', '🍫', 60, 'retail', 'food', 'плитка', 6),
  wine: G('Вино', '🍷', 300, 'retail', 'food', 'бут.', 1),
  beer: G('Пиво', '🍺', 60, 'retail', 'food', 'л', 5),
  pasta: G('Макароны', '🍝', 60, 'retail', 'food', 'кг', 4),
  vegoil: G('Подсолнечное масло', '🫗', 100, 'retail', 'food', 'л', 1.5),
  // одежда
  tshirt: G('Футболка', '👕', 500, 'retail', 'clothes', 'шт', 0.4),
  jeans: G('Джинсы', '👖', 1800, 'retail', 'clothes', 'шт', 0.15),
  dress: G('Платье', '👗', 2200, 'retail', 'clothes', 'шт', 0.1),
  shoes: G('Обувь', '👞', 2500, 'retail', 'clothes', 'пара', 0.12),
  coat: G('Пальто', '🧥', 6000, 'retail', 'clothes', 'шт', 0.04),
  scarf: G('Шарф', '🧣', 700, 'retail', 'clothes', 'шт', 0.15),
  // для дома
  furniture: G('Диван', '🛋️', 25000, 'retail', 'home', 'шт', 0.01),
  chair: G('Стул', '🪑', 1800, 'retail', 'home', 'шт', 0.05),
  dishes: G('Посуда', '🍽️', 1200, 'retail', 'home', 'набор', 0.08),
  lamp: G('Лампа', '💡', 1000, 'retail', 'home', 'шт', 0.06),
  detergent: G('Моющее средство', '🧴', 150, 'retail', 'home', 'шт', 1),
  doors: G('Двери', '🚪', 7000, 'retail', 'build', 'шт', 0.02),
  tools: G('Инструменты', '🔨', 2500, 'retail', 'build', 'набор', 0.06),
  // электроника
  tv: G('Телевизор', '📺', 25000, 'retail', 'electronics', 'шт', 0.012),
  phone: G('Смартфон', '📱', 18000, 'retail', 'electronics', 'шт', 0.03),
  laptop: G('Ноутбук', '💻', 40000, 'retail', 'electronics', 'шт', 0.008),
  headphones: G('Наушники', '🎧', 2500, 'retail', 'electronics', 'шт', 0.06),
  // ювелирные изделия
  ring: G('Кольцо', '💍', 25000, 'retail', 'jewelry', 'шт', 0.006),
  watch: G('Часы', '⌚', 12000, 'retail', 'jewelry', 'шт', 0.01),
  perfume: G('Духи', '🌸', 3500, 'retail', 'jewelry', 'флакон', 0.06),
  sunglasses: G('Очки', '🕶️', 2000, 'retail', 'jewelry', 'шт', 0.05),
  // авто
  car: G('Автомобиль', '🚗', 1200000, 'retail', 'auto', 'шт', 0.0015),
  moto: G('Мотоцикл', '🏍️', 350000, 'retail', 'auto', 'шт', 0.0008),
  motoroil: G('Моторное масло', '🫙', 1800, 'retail', 'auto', 'канистра', 0.05),
  fuel: G('Бензин', '⛽', 50, 'retail', 'chem', 'л', 50),
  // аптека
  pills: G('Таблетки', '💊', 250, 'retail', 'pharma', 'уп.', 3),
  bandage: G('Бинты', '🩹', 50, 'retail', 'pharma', 'шт', 1),
  thermometer: G('Градусник', '🌡️', 250, 'retail', 'pharma', 'шт', 0.15),
  mask: G('Маски', '😷', 10, 'retail', 'pharma', 'шт', 5),
  // спорт и дети
  ball: G('Мяч', '⚽', 1200, 'retail', 'sport', 'шт', 0.05),
  bicycle: G('Велосипед', '🚲', 18000, 'retail', 'sport', 'шт', 0.02),
  skis: G('Лыжи', '🎿', 6000, 'retail', 'sport', 'пара', 0.01),
  racket: G('Ракетка', '🎾', 2500, 'retail', 'sport', 'шт', 0.02),
  toys: G('Игрушки', '🧸', 900, 'retail', 'kids', 'шт', 0.3),
  puzzle: G('Пазл', '🧩', 500, 'retail', 'kids', 'шт', 0.15),
  balloon: G('Шарики', '🎈', 15, 'retail', 'kids', 'шт', 1),
  kite: G('Воздушный змей', '🪁', 700, 'retail', 'kids', 'шт', 0.03),
  // блюда (ресторан): оптовая цена ≈ себестоимость кухни, в меню — с наценкой
  soup: G('Суп', '🍲', 230, 'dish', 'dish', 'порция', 3.2),
  pizza: G('Пицца', '🍕', 470, 'dish', 'dish', 'шт', 3.2),
  burger: G('Бургер', '🍔', 300, 'dish', 'dish', 'шт', 4.0),
  salad: G('Салат', '🥗', 270, 'dish', 'dish', 'порция', 3.2),
  cake: G('Торт', '🍰', 230, 'dish', 'dish', 'кусок', 2.4),
  // услуги
  haircut: G('Стрижка', '💇', 800, 'service', 'service', 'усл.', 0.96),
  manicure: G('Маникюр', '💅', 1200, 'service', 'service', 'усл.', 0.64),
  shave: G('Барбершоп', '🪒', 670, 'service', 'service', 'усл.', 0.8),
  carwash: G('Мойка', '🧽', 530, 'service', 'service', 'усл.', 1.28),
  repair: G('Ремонт авто', '🔧', 4000, 'service', 'service', 'усл.', 0.24),
  tirefit: G('Шиномонтаж', '🛠️', 1700, 'service', 'service', 'усл.', 0.32),
  carservice: G('Техобслуживание', '🧰', 3300, 'service', 'service', 'усл.', 0.32),
};

// Товарные группы — названия для отчётов
export const GROUPS = {
  agro: 'Сельскохозяйственная продукция', animal: 'Животные и продукция', wood: 'Лес и древесина', mineral: 'Полезные ископаемые',
  metal: 'Металлы', chem: 'Химия и нефтепродукты', build: 'Строительные материалы', equip: 'Оборудование и техника', food: 'Продукты питания',
  clothes: 'Одежда и обувь', home: 'Товары для дома', electronics: 'Электроника', jewelry: 'Предметы роскоши', auto: 'Автомобильные товары',
  pharma: 'Фармацевтика', sport: 'Спорттовары', kids: 'Детские товары', dish: 'Блюда', service: 'Услуги',
};
// Розничная наценка по группам: в магазине товар стоит оптовая цена × наценка
const MARKUP = { food: 1.4, agro: 1.5, animal: 1.5, clothes: 2.0, home: 1.7, electronics: 1.45, jewelry: 2.2, auto: 1.25, build: 1.5, chem: 1.35,
  pharma: 1.6, sport: 1.7, kids: 1.8, dish: 1.5, service: 1.5 };
export const retailMul = g => MARKUP[GOODS[g].group] || 1.5;
export const unitOf = g => GOODS[g].unit || 'шт';

// by — кто производит: 'вид' или 'вид:подвид'; inputs — сырьё на единицу продукции.
// Выпуск в день (rate) рассчитывается ниже из цен: цех должен окупать зарплату, содержание и вложения.
const R = (by, inputs = {}, k = 1) => ({ by: [].concat(by), inputs, k });
const FARM = { fertilizer: 0.03, diesel: 0.02 }, GREEN = { fertilizer: 0.05 };
export const RECIPES = {
  // поле: удобрения и солярка для тракторов
  grain: R('cropfarm', FARM), potato: R('cropfarm', FARM), sunflower: R('cropfarm', FARM), cotton: R('cropfarm', { fertilizer: 0.1, diesel: 0.05 }),
  apple: R('cropfarm', FARM), grapes: R('cropfarm', { fertilizer: 0.05, diesel: 0.03 }), sugarbeet: R('cropfarm', { fertilizer: 0.01, diesel: 0.01 }),
  hay: R('cropfarm', { diesel: 0.01 }),
  tomato: R('greenhouse', GREEN), cucumber: R('greenhouse', GREEN), carrot: R('greenhouse', { fertilizer: 0.02 }), pepper: R('greenhouse', GREEN), greens: R('greenhouse', { fertilizer: 0.02 }),
  // животноводство: сено, комбикорм, ветпрепараты
  milk: R('livestock:cows', { hay: 1.5, fodder: 0.4, vetmed: 0.002 }), beef: R('livestock:cows', { hay: 8, fodder: 6, vetmed: 0.02 }),
  hide: R(['livestock:cows', 'livestock:pigs'], { fodder: 15, vetmed: 0.05 }),
  pork: R('livestock:pigs', { fodder: 4, vetmed: 0.01 }), eggs: R('livestock:chickens', { fodder: 1.3, vetmed: 0.001 }), chicken: R('livestock:chickens', { fodder: 2.5, vetmed: 0.005 }),
  wool: R('livestock:sheep', { hay: 15, vetmed: 0.01 }), fur: R('livestock:fur', { fodder: 40, fish: 2, vetmed: 0.1 }), fish: R('livestock:fish', { fodder: 1.5 }),
  young: R(['livestock:cows', 'livestock:pigs', 'livestock:chickens', 'livestock:sheep', 'livestock:fur', 'livestock:fish'], { fodder: 300, hay: 200, vetmed: 1 }),
  // лес и недра: солярка, взрывчатка
  wood: R('sawmill', { diesel: 5 }),
  ore: R('mine:ore', { diesel: 3, explosives: 0.5 }), coal: R('mine:coal', { diesel: 3, explosives: 0.3 }), stone: R('mine:stone', { diesel: 2, explosives: 0.3 }),
  sand: R('mine:sand', { diesel: 1 }), clay: R('mine:clay', { diesel: 1 }), gold: R('mine:gold', { diesel: 2, explosives: 1 }),
  oil: R('oilwell', { diesel: 10 }),
  // пищевой завод
  flour: R('factory:food', { grain: 1.3 }), sugar: R('factory:food', { sugarbeet: 7 }), fodder: R('factory:food', { grain: 0.7, sunflower: 0.15 }),
  bread: R('factory:food', { flour: 0.6 }), pasta: R('factory:food', { flour: 1, eggs: 0.02 }), cheese: R('factory:food', { milk: 10 }),
  butter: R('factory:food', { milk: 16 }), sausage: R('factory:food', { pork: 0.6, beef: 0.4 }), juice: R('factory:food', { apple: 1.4, sugar: 0.05, cardboard: 0.03 }),
  canned: R('factory:food', { tomato: 0.3, cucumber: 0.3, steel: 0.00008 }), chocolate: R('factory:food', { milk: 0.03, sugar: 0.04 }),
  wine: R('factory:food', { grapes: 1.2, glass: 0.05 }), beer: R('factory:food', { grain: 0.25, glass: 0.02 }), vegoil: R('factory:food', { sunflower: 2.3 }),
  // деревообработка
  lumber: R('factory:wood', { wood: 1.6 }), paper: R('factory:wood', { wood: 0.003 }), cardboard: R('factory:wood', { wood: 0.002, paper: 0.2 }),
  furniture: R('factory:wood', { lumber: 0.3, fabric: 8, steel: 0.01 }), chair: R('factory:wood', { lumber: 0.05 }),
  doors: R('factory:wood', { lumber: 0.08, glass: 0.5, steel: 0.005 }), puzzle: R('factory:wood', { cardboard: 0.3, paper: 0.1 }),
  skis: R(['factory:wood', 'factory:sport'], { lumber: 0.01, plastic: 2 }),
  // стройматериалы
  cement: R('factory:build', { stone: 0.06, coal: 0.01 }), concrete: R('factory:build', { cement: 6, sand: 0.8, stone: 0.9 }), bricks: R('factory:build', { clay: 0.003, coal: 0.0003 }),
  glass: R('factory:build', { sand: 0.015, coal: 0.002 }), tiles: R('factory:build', { clay: 0.02, glass: 0.05 }), dishes: R('factory:build', { clay: 0.01, glass: 0.3 }),
  tools: R('factory:build', { steel: 0.01, lumber: 0.005, plastic: 0.2 }),
  // фабрика (одежда)
  fabric: R('factory:apparel', { cotton: 0.4 }), leather: R('factory:apparel', { hide: 0.25 }), tshirt: R('factory:apparel', { fabric: 1.5 }),
  jeans: R('factory:apparel', { fabric: 2 }), dress: R('factory:apparel', { fabric: 3 }), shoes: R('factory:apparel', { leather: 1, rubber: 0.3 }),
  coat: R('factory:apparel', { wool: 1.5, fabric: 2 }), scarf: R('factory:apparel', { wool: 0.3 }),
  toys: R(['factory:sport', 'factory:apparel'], { plastic: 0.4, fabric: 0.5 }),
  // электроника
  chips: R('factory:electronic', { silicon: 0.1, plastic: 0.05, gold: 0.01 }), tv: R('factory:electronic', { chips: 8, plastic: 3, glass: 1 }),
  phone: R('factory:electronic', { chips: 6, glass: 0.05, plastic: 0.1 }), laptop: R('factory:electronic', { chips: 15, plastic: 1, glass: 0.2 }),
  headphones: R('factory:electronic', { chips: 1, plastic: 0.2 }), lamp: R('factory:electronic', { glass: 0.2, plastic: 0.3 }),
  labkit: R('factory:electronic', { chips: 100, glass: 10, steel: 0.5 }), fridge: R('factory:electronic', { steel: 0.3, chips: 5, plastic: 20 }),
  // ювелирный
  ring: R('factory:jewelry', { gold: 3 }), watch: R('factory:jewelry', { gold: 1, steel: 0.0005, glass: 0.01 }),
  sunglasses: R('factory:jewelry', { plastic: 0.05, glass: 0.02 }),
  // фармацевтика
  pills: R('factory:pharma', { plastic: 0.02, sugar: 0.01 }), bandage: R('factory:pharma', { fabric: 0.1 }), thermometer: R('factory:pharma', { glass: 0.01, chips: 0.1 }),
  mask: R('factory:pharma', { fabric: 0.02 }), detergent: R('factory:pharma', { oil: 0.0003, plastic: 0.05 }), vetmed: R('factory:pharma', { plastic: 0.05, grain: 0.5 }),
  // спорттовары
  ball: R('factory:sport', { leather: 0.2, rubber: 0.3 }), bicycle: R('factory:sport', { steel: 0.015, rubber: 1.5, plastic: 1 }), racket: R('factory:sport', { plastic: 0.5 }),
  balloon: R('factory:sport', { rubber: 0.01 }), kite: R('factory:sport', { fabric: 1, lumber: 0.0005 }),
  // автомобильный
  tires: R('factory:auto', { rubber: 9, steel: 0.002 }),
  car: R('factory:auto', { engine: 1, steel: 1, tires: 4, glass: 4, plastic: 100, chips: 50, paint: 10, fabric: 10 }),
  moto: R('factory:auto', { engine: 0.5, steel: 0.15, tires: 2 }),
  // машиностроительный: двигатели и оборудование для других предприятий
  engine: R('factory:machine', { steel: 0.3, chips: 20 }),
  prodline: R('factory:machine', { steel: 1.5, engine: 0.5, chips: 20 }), tractor: R('factory:machine', { engine: 1, steel: 2, tires: 4 }),
  harvester: R('factory:machine', { engine: 1, steel: 2 }), minegear: R('factory:machine', { steel: 3, engine: 1 }), drillrig: R('factory:machine', { steel: 8, engine: 1 }),
  forklift: R('factory:machine', { engine: 1, steel: 1, tires: 4 }), crane: R('factory:machine', { steel: 15, engine: 1 }),
  machtools: R('factory:machine', { steel: 1, chips: 10, engine: 0.3 }), salonkit: R('factory:machine', { steel: 0.2, leather: 5, plastic: 20 }),
  // металлургия и химия
  steel: R('factory:metal', { ore: 1.6, coal: 0.8 }),
  plastic: R('factory:chem', { oil: 0.002 }), rubber: R('factory:chem', { oil: 0.002 }), silicon: R('factory:chem', { sand: 0.005, coal: 0.002 }),
  fuel: R('factory:chem', { oil: 0.0012 }), diesel: R('factory:chem', { oil: 0.0012 }), fertilizer: R('factory:chem', { oil: 0.0004, coal: 0.001 }),
  explosives: R('factory:chem', { oil: 0.001, coal: 0.005 }), paint: R('factory:chem', { oil: 0.0006, clay: 0.0005 }),
  motoroil: R('factory:chem', { oil: 0.004 }), perfume: R('factory:chem', { oil: 0.0001, greens: 1, glass: 0.02 }),
  // ресторан
  soup: R('restaurant', { potato: 0.1, carrot: 0.05, beef: 0.08 }), pizza: R('restaurant', { flour: 0.25, cheese: 0.12, tomato: 0.1 }),
  burger: R('restaurant', { bread: 0.5, beef: 0.15, greens: 0.1 }), salad: R('restaurant', { tomato: 0.1, cucumber: 0.1, greens: 0.2, vegoil: 0.02 }),
  cake: R('restaurant', { flour: 0.05, eggs: 0.1, milk: 0.05, sugar: 0.05, butter: 0.03 }),
  // салон красоты, автосервис
  haircut: R('salon'), manicure: R('salon', { paint: 0.01 }), shave: R('salon'),
  carwash: R('autoservice', { detergent: 0.2 }), repair: R('autoservice', { tools: 0.02, motoroil: 0.5 }),
  tirefit: R('autoservice', { rubber: 0.1 }), carservice: R('autoservice', { motoroil: 1 }),
};

// ---------- виды предприятий ----------
// sells — продаёт горожанам (нужно помещение в городе); later — «откроется позднее»; reach — откуда идут покупатели (×охват).
// cost — вложения при создании (помещение + первый комплект оборудования), upkeep — содержание в день.
const sub = (name, icon, desc, extra = {}) => ({ name, icon, desc, ...extra });
export const ENTERPRISES = {
  shop: {
    name: 'Магазин', icon: '🏬', desc: 'Магазин осуществляет розничную торговлю товарами для населения', cost: 1200000, workers: 6, upkeep: 3000, storage: 100000, sells: true,
    subs: {
      grocery: sub('Продуктовый магазин', '🛒', 'Продажа продуктов питания и напитков',
        { goods: ['bread', 'milk', 'eggs', 'potato', 'sausage', 'cheese', 'chicken', 'pasta', 'apple', 'juice', 'butter', 'beer', 'sugar', 'canned', 'chocolate', 'pork', 'beef', 'vegoil', 'tomato', 'cucumber', 'carrot', 'greens', 'fish', 'wine', 'pepper', 'grapes'], reach: 1.5 }),
      clothes: sub('Магазин одежды', '👠', 'Торговля одеждой и обувью, а также аксессуарами', { goods: ['tshirt', 'jeans', 'scarf', 'shoes', 'dress', 'coat'], cost: 1400000, reach: 4 }),
      department: sub('Универмаг', '🛋️', 'Товары для дома, мебель и другие промышленные товары', { goods: ['detergent', 'dishes', 'chair', 'lamp', 'furniture'], cost: 1600000, reach: 4 }),
      electronics: sub('Магазин электроники', '📺', 'Бытовая техника и электроника, компьютерные товары', { goods: ['headphones', 'phone', 'lamp', 'tv', 'laptop'], cost: 2200000, reach: 5 }),
      jewelry: sub('Ювелирный магазин', '💍', 'Парфюмерия, часы, ювелирные изделия', { goods: ['perfume', 'sunglasses', 'watch', 'ring'], cost: 4000000, reach: 7 }),
      auto: sub('Автомагазин', '🚗', 'От автозапчастей до автомобилей', { goods: ['fuel', 'motoroil', 'tires', 'moto', 'car'], cost: 2600000, reach: 6 }),
      buildshop: sub('Магазин стройматериалов', '🧱', 'Строительные и отделочные материалы', { goods: ['cement', 'paint', 'tiles', 'tools', 'doors'], cost: 1600000, reach: 5 }),
      pharmacy: sub('Аптека', '💊', 'Лекарства, витамины, здоровый образ жизни', { goods: ['pills', 'mask', 'bandage', 'thermometer'], cost: 1500000, reach: 1.5 }),
      sport: sub('Спортивный магазин', '⚽', 'Спортивное оборудование, инвентарь и многое другое для спорта', { goods: ['ball', 'racket', 'bicycle', 'skis'], cost: 1600000, reach: 5 }),
      kids: sub('Детский магазин', '🧸', 'Всё для детей: одежда, досуг, игрушки', { goods: ['toys', 'balloon', 'puzzle', 'kite'], cost: 1500000, reach: 4 }),
    },
  },
  warehouse: {
    name: 'Склад', icon: '📦', desc: 'Склад используется для организации логистических цепочек и дистрибуции товаров', cost: 800000, workers: 5, upkeep: 2000, storage: 2000000,
    subs: {
      materials: sub('Склад материалов', '🧱', 'Склад руды и материалов', { groups: ['wood', 'mineral', 'metal', 'build'] }),
      goods: sub('Склад товаров', '🧺', 'Склад промышленных товаров народного потребления', { groups: ['clothes', 'home', 'electronics', 'jewelry', 'pharma', 'sport', 'kids'] }),
      food: sub('Склад продуктов', '🍎', 'Склад продуктов питания и сельскохозяйственной продукции', { groups: ['agro', 'animal', 'food'] }),
      tech: sub('Склад техники', '🚜', 'Склад техники, оборудования, автомобилей', { groups: ['auto', 'electronics', 'metal', 'equip'], cost: 1600000 }),
      chem: sub('Склад химикатов', '🧪', 'Склад химических и нефтепродуктов', { groups: ['chem'], cost: 2400000 }),
      universal: sub('Универсальный склад', '🏬', 'Склад всех товаров', { groups: null, cost: 3200000 }),
    },
  },
  factory: {
    name: 'Завод', icon: '🏭', desc: 'Завод производит продукцию, перерабатывая сырьё', cost: 2000000, workers: 30, upkeep: 8000, storage: 0,
    subs: {
      wood: sub('Деревообрабатывающий завод', '🪚', 'Доски, бумага, картон, мебель, двери'),
      auto: sub('Автомобильный завод', '🚗', 'Автомобили, мотоциклы и шины', { cost: 4800000 }),
      build: sub('Завод стройматериалов', '🧱', 'Цемент, бетон, кирпич, стекло, плитка', { cost: 2400000 }),
      food: sub('Пищевой завод', '🍞', 'Мука, сахар, комбикорм, хлеб, молочные продукты, напитки'),
      apparel: sub('Фабрика', '👕', 'Ткань, кожа, одежда и обувь'),
      electronic: sub('Электронный завод', '📱', 'Микросхемы, электроника, холодильное и лабораторное оборудование', { cost: 2800000 }),
      jewelry: sub('Ювелирный завод', '💍', 'Ювелирные украшения, часы, очки', { cost: 1800000 }),
      pharma: sub('Фармацевтический завод', '💊', 'Лекарства, ветпрепараты, бытовая химия', { cost: 2400000 }),
      sport: sub('Завод спортивных товаров', '⚽', 'Спортивные товары и игрушки', { cost: 1800000 }),
      machine: sub('Машиностроительный завод', '⚙️', 'Двигатели, станки, тракторы, горное и производственное оборудование', { cost: 6000000 }),
      metal: sub('Металлургический завод', '🔩', 'Сталь из руды и угля', { cost: 7200000 }),
      chem: sub('Химический завод', '🧪', 'Пластик, резина, топливо, удобрения, взрывчатка, краска', { cost: 6800000 }),
    },
  },
  sawmill: { name: 'Лесопилка', icon: '🌲', desc: 'Заготовка древесины', cost: 1000000, workers: 15, upkeep: 2500, storage: 0 },
  livestock: {
    name: 'Животноводческая ферма', icon: '🐄', desc: 'Молоко, мясо, яйца, шкуры, шерсть. Животным нужны сено, комбикорм и ветпрепараты', cost: 1400000, workers: 20, upkeep: 3500, storage: 0,
    subsTitle: 'Выберите тип первого подразделения',
    subs: {
      cows: sub('Коровник', '🐄', 'Коровы: молоко, говядина, шкуры'), pigs: sub('Свинарник', '🐖', 'Свиньи: свинина, шкуры'), chickens: sub('Курятник', '🐔', 'Куры: яйца и мясо'),
      sheep: sub('Овчарня', '🐑', 'Овцы: шерсть'), fur: sub('Меховая ферма', '🦊', 'Соболи: мех'), fish: sub('Рыбное хозяйство', '🎣', 'Разведение рыбы'),
    },
  },
  cropfarm: { name: 'Земледельческая ферма', icon: '🚜', desc: 'Зерно, картофель, подсолнечник, свёкла, сено, фрукты. Нужны удобрения и солярка', cost: 1200000, workers: 20, upkeep: 3000, storage: 0 },
  greenhouse: { name: 'Тепличное хозяйство', icon: '🪴', desc: 'Овощи и зелень круглый год', cost: 900000, workers: 12, upkeep: 2800, storage: 0 },
  restaurant: { name: 'Ресторан', icon: '🍽️', desc: 'Предприятие общественного питания с блюдами собственного приготовления', cost: 1400000, workers: 8, upkeep: 6000, storage: 50000, sells: true, reach: 2 },
  salon: { name: 'Салон красоты', icon: '💇', desc: 'Салон красоты делает людей красивыми и опрятными', cost: 1000000, workers: 8, upkeep: 4000, storage: 5000, sells: true, reach: 2 },
  autoservice: { name: 'Автосервис', icon: '🚘', desc: 'Ремонтируем автомобили, чтобы были как новые', cost: 1600000, workers: 10, upkeep: 4800, storage: 20000, sells: true, reach: 4 },
  hotel: { name: 'Отель', icon: '🏨', desc: 'Отель принимает путешественников со всего мира', cost: 5000000, later: true },
  construction: { name: 'Строительное предприятие', icon: '👷', desc: 'Строит ваши жилые, коммерческие и офисные здания своими силами', cost: 2400000, workers: 40, upkeep: 6000, storage: 400000 },
  mine: {
    name: 'Шахта', icon: '⛏️', desc: 'Добыча полезных ископаемых. Нужны горняки, горное оборудование, солярка и взрывчатка', cost: 2400000, workers: 25, upkeep: 6000, storage: 0,
    subs: {
      gold: sub('Золотой рудник', '🪙', 'Добыча золота', { cost: 4800000 }), sand: sub('Песчаный карьер', '⏳', 'Добыча песка'),
      clay: sub('Глиняный карьер', '🟤', 'Добыча глины'), ore: sub('Железнорудная шахта', '⛰️', 'Добыча железной руды'),
      coal: sub('Угольная шахта', '⚫', 'Добыча угля'), stone: sub('Каменный карьер', '🪨', 'Добыча камня'),
    },
  },
  transport: { name: 'Транспортное предприятие', icon: '🚛', desc: 'Транспортное предприятие осуществляет перевозку грузов', cost: 8000000, later: true },
  oilwell: { name: 'Нефтяная скважина', icon: '🛢️', desc: 'Добыча нефти. Нужны буровые установки и солярка', cost: 3600000, workers: 15, upkeep: 8000, storage: 0 },
  lab: { name: 'Лаборатория', icon: '🔬', desc: 'Все исследования: технологии повышают качество товаров', cost: 2800000, workers: 12, upkeep: 8000, storage: 0 },
  power: { name: 'Электростанция', icon: '⚡', desc: 'Электростанция осуществляет производство электричества', cost: 120000000, later: true },
};

// Оборудование по видам предприятий — это товар: его делают заводы и продают склады и конкуренты.
// per — сколько рабочих обслуживает единицу, life — срок службы в игровых годах (вики «Износ оборудования»)
export const EQUIP = {
  factory: { good: 'prodline', per: 10, life: 1.15 },
  cropfarm: { good: 'tractor', per: 10, life: 2.5 },
  greenhouse: { good: 'machtools', per: 6, life: 3 },
  livestock: { good: 'young', per: 1, life: 3.5 },
  sawmill: { good: 'harvester', per: 8, life: 2 },
  mine: { good: 'minegear', per: 10, life: 2 },
  oilwell: { good: 'drillrig', per: 8, life: 2 },
  warehouse: { good: 'forklift', per: 5, life: 2 },
  construction: { good: 'crane', per: 40, life: 2 },
  lab: { good: 'labkit', per: 4, life: 1.6 },
  restaurant: { good: 'fridge', per: 3, life: 3 },
  salon: { good: 'salonkit', per: 2, life: 1.5 },
  autoservice: { good: 'machtools', per: 2, life: 1.2 },
  // магазинам оборудование не нужно
};

// ---------- производительность цехов из реальных цен ----------
// Цех 1-го уровня, продавая выпуск на склады города и покупая там же сырьё, покрывает зарплату и содержание вдвое
// и окупает вложения примерно за 45 дней. Так любая цепочка выгодна, а свои поставки — ещё выгоднее.
const direct = g => ['dish', 'service'].includes(GOODS[g].kind);
for (const g in RECIPES) {
  const r = RECIPES[g];
  const [t, sb] = r.by[0].split(':');
  const d = { ...ENTERPRISES[t], ...(ENTERPRISES[t].subs?.[sb] || {}) };
  const P = GOODS[g].price * (direct(g) ? retailMul(g) : SELL_RATE);
  const inCost = Object.entries(r.inputs).reduce((a, [x, n]) => a + n * GOODS[x].price * BUY_RATE, 0);
  const margin = Math.max(P * 0.15, P - inCost);
  const need = (MARKET_SALARY * d.workers + d.upkeep) * 2 + d.cost / 45;
  const v = (need / margin) * r.k;
  r.rate = v >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
}

// ---------- открытие видов предприятий по уровню компании (вики Бизмании, «Развитие компании») ----------
export const UNLOCKS = {
  'shop:grocery': 1, 'shop:clothes': 1, 'factory:food': 1, 'factory:apparel': 1,
  'shop:department': 2, livestock: 2, 'shop:pharmacy': 3, greenhouse: 3, 'shop:electronics': 4, 'shop:kids': 4,
  restaurant: 5, salon: 5, 'shop:sport': 6, 'warehouse:food': 7, 'warehouse:goods': 7, 'shop:buildshop': 8, 'shop:jewelry': 9,
  'factory:pharma': 10, hotel: 11, autoservice: 11, 'factory:sport': 12, 'shop:auto': 13, 'factory:wood': 14, cropfarm: 15,
  'warehouse:materials': 16, 'factory:jewelry': 17, 'factory:auto': 18, 'factory:electronic': 19, 'warehouse:tech': 20,
  'factory:build': 21, sawmill: 22, construction: 23, 'factory:machine': 24, 'warehouse:chem': 25, 'mine:gold': 26,
  'factory:metal': 27, 'mine:sand': 28, 'mine:clay': 29, 'factory:chem': 30, 'mine:ore': 31, 'mine:coal': 32, transport: 34,
  'mine:stone': 36, oilwell: 37, lab: 38, 'warehouse:universal': 80, power: 100,
};
// Минимальный уровень компании для вида (и подвида) предприятия
export function unlockLevel(type, sb) {
  if (sb && UNLOCKS[`${type}:${sb}`] != null) return UNLOCKS[`${type}:${sb}`];
  if (UNLOCKS[type] != null) return UNLOCKS[type];
  const subs = ENTERPRISES[type]?.subs;
  return subs ? Math.min(...Object.keys(subs).map(k => unlockLevel(type, k))) : 1;
}

// ---------- справочные функции ----------
export const subOf = e => ENTERPRISES[e.type]?.subs?.[e.sub] || null;
// Описание предприятия с учётом подвида: имя, иконка, стоимость и т. п.
export function entDef(e) {
  const t = ENTERPRISES[e.type], s = t.subs?.[e.sub];
  const minLevel = unlockLevel(e.type, e.sub);
  return s ? { ...t, ...s, typeName: t.name, minLevel } : { ...t, typeName: t.name, minLevel };
}
export const defOf = (type, sb) => entDef({ type, sub: sb });
const keyOf = (type, sb) => (sb ? `${type}:${sb}` : type);
export const recipesFor = (type, sb) => Object.keys(RECIPES).filter(g => RECIPES[g].by.includes(keyOf(type, sb)) || RECIPES[g].by.includes(type));
export const canMake = (e, g) => !!RECIPES[g] && (RECIPES[g].by.includes(keyOf(e.type, e.sub)) || RECIPES[g].by.includes(e.type));
// Что предприятие продаёт горожанам
export function sellsList(type, sb) {
  const d = defOf(type, sb);
  if (!d.sells) return [];
  return d.goods || recipesFor(type, sb);
}
export const sells = (e, g) => sellsList(e.type, e.sub).includes(g);
// Что предприятие может принять на склад (поставки, закупки)
export function accepts(e, g) {
  const d = entDef(e), k = GOODS[g].kind;
  if (e.type === 'lab') return false;
  if (k === 'service') return false;
  if (e.type === 'warehouse') return !d.groups || d.groups.includes(GOODS[g].group);
  if (d.goods) return d.goods.includes(g);
  return true;
}
// Товары, которые производятся где-то (для подсказок «где взять»)
export const producers = g => (RECIPES[g]?.by || []).map(k => { const [t, sb] = k.split(':'); return defOf(t, sb).name; });
