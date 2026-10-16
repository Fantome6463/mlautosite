// Каталог: товары, рецепты и виды предприятий с подвидами (как «Создание предприятия» в Бизмании).

// kind: raw — сырьё, mid — полуфабрикаты, build — стройматериалы, retail — товары, dish — блюда, service — услуги.
// group — товарная группа (для складов и отчётов). demand — спрос в одном магазине в день (район 1.0).
const G = (name, icon, price, kind, group, demand = 0) => ({ name, icon, price, kind, group, demand });

export const GOODS = {
  // земледелие и теплицы
  grain: G('Зерно', '🌾', 8, 'raw', 'agro'),
  potato: G('Картофель', '🥔', 7, 'raw', 'agro', 60),
  sunflower: G('Подсолнечник', '🌻', 9, 'raw', 'agro'),
  cotton: G('Хлопок', '☁️', 9, 'raw', 'agro'),
  apple: G('Яблоки', '🍏', 12, 'raw', 'agro', 50),
  grapes: G('Виноград', '🍇', 14, 'raw', 'agro', 20),
  tomato: G('Помидоры', '🍅', 15, 'raw', 'agro', 50),
  cucumber: G('Огурцы', '🥒', 12, 'raw', 'agro', 45),
  carrot: G('Морковь', '🥕', 8, 'raw', 'agro', 40),
  pepper: G('Перец', '🫑', 16, 'raw', 'agro', 25),
  greens: G('Зелень', '🥬', 10, 'raw', 'agro', 30),
  // животноводство
  milk: G('Молоко', '🥛', 12, 'raw', 'animal', 80),
  beef: G('Говядина', '🥩', 45, 'raw', 'animal', 30),
  pork: G('Свинина', '🍖', 38, 'raw', 'animal', 30),
  chicken: G('Курица', '🍗', 30, 'raw', 'animal', 40),
  eggs: G('Яйца', '🥚', 6, 'raw', 'animal', 120),
  fish: G('Рыба', '🐟', 35, 'raw', 'animal', 30),
  hide: G('Шкуры', '🟫', 30, 'raw', 'animal'),
  wool: G('Шерсть', '🧶', 20, 'raw', 'animal'),
  fur: G('Мех', '🦊', 90, 'raw', 'animal'),
  // лес, недра, нефть
  wood: G('Древесина', '🪵', 10, 'raw', 'wood'),
  ore: G('Руда', '⛰️', 14, 'raw', 'mineral'),
  coal: G('Уголь', '⚫', 12, 'raw', 'mineral'),
  stone: G('Камень', '🪨', 6, 'raw', 'mineral'),
  sand: G('Песок', '⏳', 4, 'raw', 'mineral'),
  clay: G('Глина', '🟤', 5, 'raw', 'mineral'),
  gold: G('Золото', '🪙', 300, 'raw', 'mineral'),
  oil: G('Нефть', '🛢️', 20, 'raw', 'chem'),
  // полуфабрикаты
  flour: G('Мука', '🥡', 22, 'mid', 'food'),
  lumber: G('Доски', '🪚', 25, 'mid', 'wood'),
  paper: G('Бумага', '📄', 18, 'mid', 'wood'),
  steel: G('Сталь', '🔩', 55, 'mid', 'metal'),
  fabric: G('Ткань', '🧵', 28, 'mid', 'clothes'),
  leather: G('Кожа', '👜', 60, 'mid', 'clothes'),
  plastic: G('Пластик', '🧪', 50, 'mid', 'chem'),
  fuel: G('Бензин', '⛽', 45, 'mid', 'chem', 40),
  cement: G('Цемент', '🧱', 20, 'mid', 'build', 10),
  chips: G('Микросхемы', '🔌', 120, 'mid', 'electronics'),
  engine: G('Двигатель', '⚙️', 400, 'mid', 'auto'),
  tires: G('Шины', '🛞', 80, 'mid', 'auto', 10),
  // стройматериалы
  concrete: G('Бетон', '🏗️', 18, 'build', 'build'),
  bricks: G('Кирпич', '🟥', 15, 'build', 'build'),
  glass: G('Стекло', '🪟', 30, 'build', 'build'),
  tiles: G('Плитка', '🔲', 50, 'build', 'build', 15),
  paint: G('Краска', '🎨', 60, 'build', 'chem', 20),
  // продукты питания
  bread: G('Хлеб', '🍞', 40, 'retail', 'food', 150),
  cheese: G('Сыр', '🧀', 70, 'retail', 'food', 60),
  sausage: G('Колбаса', '🌭', 90, 'retail', 'food', 40),
  juice: G('Сок', '🧃', 35, 'retail', 'food', 70),
  canned: G('Консервы', '🥫', 45, 'retail', 'food', 40),
  chocolate: G('Шоколад', '🍫', 60, 'retail', 'food', 50),
  wine: G('Вино', '🍷', 150, 'retail', 'food', 20),
  vegoil: G('Подсолнечное масло', '🫗', 50, 'retail', 'food', 40),
  // одежда
  tshirt: G('Футболка', '👕', 90, 'retail', 'clothes', 30),
  jeans: G('Джинсы', '👖', 150, 'retail', 'clothes', 20),
  dress: G('Платье', '👗', 200, 'retail', 'clothes', 15),
  shoes: G('Обувь', '👞', 250, 'retail', 'clothes', 15),
  coat: G('Пальто', '🧥', 400, 'retail', 'clothes', 8),
  scarf: G('Шарф', '🧣', 60, 'retail', 'clothes', 20),
  // для дома
  furniture: G('Диван', '🛋️', 220, 'retail', 'home', 12),
  chair: G('Стул', '🪑', 90, 'retail', 'home', 15),
  dishes: G('Посуда', '🍽️', 60, 'retail', 'home', 20),
  lamp: G('Лампа', '💡', 70, 'retail', 'home', 15),
  detergent: G('Моющее средство', '🧴', 40, 'retail', 'home', 40),
  doors: G('Двери', '🚪', 300, 'retail', 'build', 5),
  tools: G('Инструменты', '🔨', 120, 'retail', 'build', 15),
  // электроника
  tv: G('Телевизор', '📺', 480, 'retail', 'electronics', 8),
  phone: G('Смартфон', '📱', 600, 'retail', 'electronics', 10),
  laptop: G('Ноутбук', '💻', 900, 'retail', 'electronics', 5),
  headphones: G('Наушники', '🎧', 120, 'retail', 'electronics', 15),
  // ювелирные изделия
  ring: G('Кольцо', '💍', 900, 'retail', 'jewelry', 3),
  watch: G('Часы', '⌚', 500, 'retail', 'jewelry', 5),
  perfume: G('Духи', '🌸', 200, 'retail', 'jewelry', 10),
  sunglasses: G('Очки', '🕶️', 150, 'retail', 'jewelry', 8),
  // авто
  car: G('Автомобиль', '🚗', 9000, 'retail', 'auto', 0.6),
  moto: G('Мотоцикл', '🏍️', 4000, 'retail', 'auto', 0.8),
  motoroil: G('Моторное масло', '🫙', 70, 'retail', 'auto', 15),
  // аптека
  pills: G('Таблетки', '💊', 80, 'retail', 'pharma', 40),
  bandage: G('Бинты', '🩹', 30, 'retail', 'pharma', 30),
  thermometer: G('Градусник', '🌡️', 90, 'retail', 'pharma', 10),
  mask: G('Маски', '😷', 15, 'retail', 'pharma', 50),
  // спорт и дети
  ball: G('Мяч', '⚽', 70, 'retail', 'sport', 15),
  bicycle: G('Велосипед', '🚲', 600, 'retail', 'sport', 4),
  skis: G('Лыжи', '🎿', 350, 'retail', 'sport', 3),
  racket: G('Ракетка', '🎾', 120, 'retail', 'sport', 6),
  toys: G('Игрушки', '🧸', 90, 'retail', 'kids', 25),
  puzzle: G('Пазл', '🧩', 50, 'retail', 'kids', 15),
  balloon: G('Шарики', '🎈', 10, 'retail', 'kids', 40),
  kite: G('Воздушный змей', '🪁', 60, 'retail', 'kids', 8),
  // блюда (ресторан)
  soup: G('Суп', '🍲', 150, 'dish', 'dish', 40),
  pizza: G('Пицца', '🍕', 300, 'dish', 'dish', 30),
  burger: G('Бургер', '🍔', 250, 'dish', 'dish', 35),
  salad: G('Салат', '🥗', 180, 'dish', 'dish', 30),
  cake: G('Торт', '🍰', 220, 'dish', 'dish', 20),
  // услуги
  haircut: G('Стрижка', '💇', 400, 'service', 'service', 25),
  manicure: G('Маникюр', '💅', 500, 'service', 'service', 15),
  shave: G('Барбершоп', '🪒', 300, 'service', 'service', 20),
  carwash: G('Мойка', '🧽', 200, 'service', 'service', 30),
  repair: G('Ремонт авто', '🔧', 800, 'service', 'service', 10),
  tirefit: G('Шиномонтаж', '🛠️', 300, 'service', 'service', 15),
  carservice: G('Техобслуживание', '🧰', 600, 'service', 'service', 10),
};

// Товарные группы — названия для отчётов
export const GROUPS = {
  agro: 'Сельскохозяйственная продукция', animal: 'Животные и продукция', wood: 'Лес и древесина', mineral: 'Полезные ископаемые',
  metal: 'Металлы', chem: 'Химия и нефтепродукты', build: 'Строительные материалы', food: 'Продукты питания', clothes: 'Одежда и обувь',
  home: 'Товары для дома', electronics: 'Электроника', jewelry: 'Предметы роскоши', auto: 'Автомобильные товары', pharma: 'Фармацевтика',
  sport: 'Спорттовары', kids: 'Детские товары', dish: 'Блюда', service: 'Услуги',
};

// by — кто производит: 'вид' или 'вид:подвид'. rate — выпуск в день при полном штате на 1-м уровне.
const R = (by, rate, inputs = {}) => ({ by: [].concat(by), rate, inputs });
export const RECIPES = {
  grain: R('cropfarm', 360), potato: R('cropfarm', 300), sunflower: R('cropfarm', 280), cotton: R('cropfarm', 270),
  apple: R('cropfarm', 240), grapes: R('cropfarm', 200),
  tomato: R('greenhouse', 200), cucumber: R('greenhouse', 220), carrot: R('greenhouse', 260), pepper: R('greenhouse', 160), greens: R('greenhouse', 240),
  milk: R('livestock:cows', 240), beef: R('livestock:cows', 80), hide: R(['livestock:cows', 'livestock:pigs'], 60),
  pork: R('livestock:pigs', 100), eggs: R('livestock:chickens', 600), chicken: R('livestock:chickens', 120),
  wool: R('livestock:sheep', 150), fur: R('livestock:fur', 40), fish: R('livestock:fish', 150),
  wood: R('sawmill', 300),
  ore: R('mine:ore', 225), coal: R('mine:coal', 250), stone: R('mine:stone', 300), sand: R('mine:sand', 360), clay: R('mine:clay', 300), gold: R('mine:gold', 6),
  oil: R('oilwell', 180),
  // пищевой завод
  flour: R('factory:food', 180, { grain: 2 }), bread: R('factory:food', 180, { flour: 1 }), cheese: R('factory:food', 75, { milk: 3 }),
  sausage: R('factory:food', 60, { pork: 1, beef: 0.5 }), juice: R('factory:food', 150, { apple: 2 }), canned: R('factory:food', 120, { tomato: 1, cucumber: 1 }),
  chocolate: R('factory:food', 90, { milk: 1, grain: 1 }), wine: R('factory:food', 50, { grapes: 3 }), vegoil: R('factory:food', 80, { sunflower: 3 }),
  // деревообработка
  lumber: R('factory:wood', 150, { wood: 2 }), paper: R('factory:wood', 160, { wood: 1.5 }), furniture: R('factory:wood', 38, { lumber: 4, fabric: 1 }),
  chair: R('factory:wood', 60, { lumber: 2 }), doors: R('factory:wood', 30, { lumber: 4, glass: 1 }), puzzle: R('factory:wood', 120, { paper: 0.5 }),
  skis: R(['factory:wood', 'factory:sport'], 30, { lumber: 2, plastic: 1 }),
  // стройматериалы
  cement: R('factory:build', 150, { stone: 2 }), concrete: R('factory:build', 240, { cement: 0.5, sand: 1 }), bricks: R('factory:build', 200, { clay: 1, sand: 0.5 }),
  glass: R('factory:build', 120, { sand: 2 }), tiles: R('factory:build', 100, { clay: 1, glass: 0.2 }), tools: R('factory:build', 50, { steel: 1, lumber: 0.5 }),
  // фабрика (одежда)
  fabric: R('factory:apparel', 135, { cotton: 2 }), leather: R('factory:apparel', 60, { hide: 1.5 }), tshirt: R('factory:apparel', 90, { fabric: 1 }),
  jeans: R('factory:apparel', 60, { fabric: 1.5 }), dress: R('factory:apparel', 45, { fabric: 2 }), shoes: R('factory:apparel', 40, { leather: 1 }),
  coat: R('factory:apparel', 25, { wool: 2, fabric: 1 }), scarf: R('factory:apparel', 90, { wool: 1 }),
  // электроника
  chips: R('factory:electronic', 40, { plastic: 1, gold: 0.05 }), tv: R('factory:electronic', 15, { chips: 2, plastic: 2, glass: 1 }),
  phone: R('factory:electronic', 15, { chips: 2, glass: 0.5, plastic: 0.5 }), laptop: R('factory:electronic', 10, { chips: 3, plastic: 1, glass: 1 }),
  headphones: R('factory:electronic', 50, { plastic: 0.5, chips: 0.2 }), lamp: R('factory:electronic', 60, { glass: 0.5, plastic: 0.3 }),
  dishes: R('factory:build', 80, { clay: 1, glass: 0.3 }),
  // ювелирный
  ring: R('factory:jewelry', 10, { gold: 0.5 }), watch: R('factory:jewelry', 15, { steel: 0.5, gold: 0.2, glass: 0.2 }),
  sunglasses: R('factory:jewelry', 40, { plastic: 0.3, glass: 0.3 }),
  // фармацевтика
  pills: R('factory:pharma', 120, { plastic: 0.1, grain: 0.5 }), bandage: R('factory:pharma', 150, { fabric: 0.3 }),
  thermometer: R('factory:pharma', 60, { glass: 0.5 }), mask: R('factory:pharma', 300, { fabric: 0.1 }), detergent: R('factory:pharma', 150, { oil: 0.3, plastic: 0.1 }),
  // спорттовары
  ball: R('factory:sport', 60, { leather: 0.5, plastic: 0.3 }), bicycle: R('factory:sport', 15, { steel: 3, tires: 2 }), racket: R('factory:sport', 40, { plastic: 1 }),
  toys: R(['factory:sport', 'factory:apparel'], 90, { plastic: 0.5, fabric: 0.5 }), balloon: R('factory:sport', 300, { plastic: 0.05 }), kite: R('factory:sport', 60, { fabric: 0.5, lumber: 0.3 }),
  // автомобильный, машиностроительный, металлургический, химический
  tires: R('factory:auto', 80, { plastic: 2 }), car: R('factory:auto', 4, { engine: 1, steel: 10, tires: 4, glass: 2 }), moto: R('factory:auto', 6, { engine: 0.5, steel: 4, tires: 2 }),
  engine: R('factory:machine', 15, { steel: 5 }),
  steel: R('factory:metal', 75, { ore: 3, coal: 1 }),
  plastic: R('factory:chem', 90, { oil: 2 }), fuel: R('factory:chem', 120, { oil: 1.5 }), paint: R('factory:chem', 100, { oil: 0.5, clay: 0.5 }),
  motoroil: R('factory:chem', 120, { oil: 1 }), perfume: R('factory:chem', 40, { oil: 0.2, greens: 0.5 }),
  // ресторан
  soup: R('restaurant', 80, { potato: 1, carrot: 0.5, beef: 0.3 }), pizza: R('restaurant', 60, { flour: 0.5, cheese: 0.3, tomato: 0.5 }),
  burger: R('restaurant', 70, { bread: 0.5, beef: 0.3, greens: 0.2 }), salad: R('restaurant', 90, { tomato: 0.5, cucumber: 0.5, greens: 0.3 }),
  cake: R('restaurant', 40, { flour: 0.5, eggs: 2, milk: 0.5 }),
  // салон красоты, автосервис
  haircut: R('salon', 40), manicure: R('salon', 30, { paint: 0.05 }), shave: R('salon', 40),
  carwash: R('autoservice', 60, { detergent: 0.3 }), repair: R('autoservice', 15, { tools: 0.1, motoroil: 0.5 }),
  tirefit: R('autoservice', 30, { tires: 0.5 }), carservice: R('autoservice', 20, { motoroil: 1 }),
};

// ---------- виды предприятий ----------
// sells — продаёт горожанам (нужно помещение в городе); later — «откроется позднее»; minLevel — уровень компании.
const sub = (name, icon, desc, extra = {}) => ({ name, icon, desc, ...extra });
export const ENTERPRISES = {
  shop: {
    name: 'Магазин', icon: '🏬', desc: 'Магазин осуществляет розничную торговлю товарами для населения', cost: 30000, workers: 10, upkeep: 100, storage: 2000, sells: true,
    subs: {
      grocery: sub('Продуктовый магазин', '🛒', 'Продажа продуктов питания и напитков',
        { goods: ['bread', 'cheese', 'sausage', 'juice', 'canned', 'chocolate', 'wine', 'vegoil', 'milk', 'eggs', 'potato', 'apple', 'tomato', 'cucumber', 'carrot', 'pepper', 'greens', 'beef', 'pork', 'chicken', 'fish', 'grapes'] }),
      clothes: sub('Магазин одежды', '👠', 'Торговля одеждой и обувью, а также аксессуарами', { goods: ['tshirt', 'jeans', 'dress', 'shoes', 'coat', 'scarf'], cost: 35000 }),
      department: sub('Универмаг', '🛋️', 'Товары для дома, мебель и другие промышленные товары', { goods: ['furniture', 'chair', 'dishes', 'lamp', 'detergent'], cost: 40000 }),
      electronics: sub('Магазин электроники', '📺', 'Бытовая техника и электроника, компьютерные товары', { goods: ['tv', 'phone', 'laptop', 'headphones', 'lamp'], cost: 55000 }),
      jewelry: sub('Ювелирный магазин', '💍', 'Парфюмерия, часы, ювелирные изделия', { goods: ['ring', 'watch', 'perfume', 'sunglasses'], cost: 100000 }),
      auto: sub('Автомагазин', '🚗', 'От автозапчастей до автомобилей', { goods: ['car', 'moto', 'tires', 'motoroil', 'fuel'], cost: 65000 }),
      buildshop: sub('Магазин стройматериалов', '🧱', 'Строительные и отделочные материалы', { goods: ['paint', 'tiles', 'tools', 'doors', 'cement'], cost: 40000 }),
      pharmacy: sub('Аптека', '💊', 'Лекарства, витамины, здоровый образ жизни', { goods: ['pills', 'bandage', 'thermometer', 'mask'], cost: 37000 }),
      sport: sub('Спортивный магазин', '⚽', 'Спортивное оборудование, инвентарь и многое другое для спорта', { goods: ['ball', 'bicycle', 'skis', 'racket'], cost: 40000 }),
      kids: sub('Детский магазин', '🧸', 'Всё для детей: одежда, досуг, игрушки', { goods: ['toys', 'puzzle', 'balloon', 'kite'], cost: 37000 }),
    },
  },
  warehouse: {
    name: 'Склад', icon: '📦', desc: 'Склад используется для организации логистических цепочек и дистрибуции товаров', cost: 20000, workers: 5, upkeep: 50, storage: 20000,
    subs: {
      materials: sub('Склад материалов', '🧱', 'Склад руды и материалов', { groups: ['wood', 'mineral', 'metal', 'build'] }),
      goods: sub('Склад товаров', '🧺', 'Склад промышленных товаров народного потребления', { groups: ['clothes', 'home', 'electronics', 'jewelry', 'pharma', 'sport', 'kids'] }),
      food: sub('Склад продуктов', '🍎', 'Склад продуктов питания и сельскохозяйственной продукции', { groups: ['agro', 'animal', 'food'] }),
      tech: sub('Склад техники', '🚜', 'Склад техники, оборудования, автомобилей', { groups: ['auto', 'electronics', 'metal'], cost: 40000 }),
      chem: sub('Склад химикатов', '🧪', 'Склад химических и нефтепродуктов', { groups: ['chem'], cost: 60000 }),
      universal: sub('Универсальный склад', '🏬', 'Склад всех товаров', { groups: null, cost: 80000 }),
    },
  },
  factory: {
    name: 'Завод', icon: '🏭', desc: 'Завод производит продукцию, перерабатывая сырьё', cost: 50000, workers: 30, upkeep: 200, storage: 4000,
    subs: {
      wood: sub('Деревообрабатывающий завод', '🪚', 'Производство продукции из древесины: мебель, бумага, стройматериалы'),
      auto: sub('Автомобильный завод', '🚗', 'Производство автомобилей, мотоциклов, шин и комплектующих', { cost: 120000 }),
      build: sub('Завод стройматериалов', '🧱', 'Производство строительных и отделочных материалов', { cost: 60000 }),
      food: sub('Пищевой завод', '🍞', 'Производство продуктов питания и напитков'),
      apparel: sub('Фабрика', '👕', 'Производство одежды, обуви и аксессуаров'),
      electronic: sub('Электронный завод', '📱', 'Производство электроники и бытовой техники', { cost: 70000 }),
      jewelry: sub('Ювелирный завод', '💍', 'Производство ювелирных украшений и часов', { cost: 45000 }),
      pharma: sub('Фармацевтический завод', '💊', 'Производство фармацевтической продукции', { cost: 60000 }),
      sport: sub('Завод спортивных товаров', '⚽', 'Производство спортивной продукции', { cost: 45000 }),
      machine: sub('Машиностроительный завод', '⚙️', 'Производство оборудования и техники', { cost: 150000 }),
      metal: sub('Металлургический завод', '🔩', 'Производство стали и изделий из неё', { cost: 180000 }),
      chem: sub('Химический завод', '🧪', 'Химическое, нефтеперерабатывающее и нефтехимическое производство', { cost: 170000 }),
    },
  },
  sawmill: { name: 'Лесопилка', icon: '🌲', desc: 'Производство древесины', cost: 25000, workers: 15, upkeep: 60, storage: 3000 },
  livestock: {
    name: 'Животноводческая ферма', icon: '🐄', desc: 'Производство продукции животноводства: молока, мяса, кожи, меха', cost: 35000, workers: 20, upkeep: 90, storage: 3000,
    subsTitle: 'Выберите тип первого подразделения',
    subs: {
      cows: sub('Коровник', '🐄', 'Разведение коров'), pigs: sub('Свинарник', '🐖', 'Разведение свиней'), chickens: sub('Курятник', '🐔', 'Разведение кур'),
      sheep: sub('Овчарня', '🐑', 'Разведение овец'), fur: sub('Меховая ферма', '🦊', 'Разведение соболей'), fish: sub('Рыболовецкая бригада', '🎣', 'Разведение рыбы'),
    },
  },
  cropfarm: { name: 'Земледельческая ферма', icon: '🚜', desc: 'На земледельческой ферме выращивают зерно, фрукты и овощи', cost: 30000, workers: 20, upkeep: 80, storage: 3000 },
  greenhouse: { name: 'Тепличное хозяйство', icon: '🪴', desc: 'В теплице выращивают овощи круглый год', cost: 22000, workers: 12, upkeep: 70, storage: 2000 },
  restaurant: { name: 'Ресторан', icon: '🍽️', desc: 'Предприятие общественного питания с блюдами собственного приготовления', cost: 35000, workers: 12, upkeep: 150, storage: 1000, sells: true },
  salon: { name: 'Салон красоты', icon: '💇', desc: 'Салон красоты делает людей красивыми и опрятными', cost: 25000, workers: 8, upkeep: 100, storage: 500, sells: true },
  autoservice: { name: 'Автосервис', icon: '🚘', desc: 'Ремонтируем автомобили, чтобы были как новые', cost: 40000, workers: 10, upkeep: 120, storage: 1000, sells: true },
  hotel: { name: 'Отель', icon: '🏨', desc: 'Отель принимает путешественников со всего мира', cost: 120000, later: true },
  construction: { name: 'Строительное предприятие', icon: '👷', desc: 'Строит ваши жилые, коммерческие и офисные здания своими силами', cost: 60000, workers: 40, upkeep: 150, storage: 8000 },
  mine: {
    name: 'Шахта', icon: '⛏️', desc: 'В шахте добываются полезные ископаемые', cost: 60000, workers: 25, upkeep: 150, storage: 3000,
    subs: {
      gold: sub('Золотая шахта', '🪙', 'Добыча золота', { cost: 120000 }), sand: sub('Песчаный карьер', '⏳', 'Добыча песка'),
      clay: sub('Глиняный карьер', '🟤', 'Добыча глины'), ore: sub('Железнорудная шахта', '⛰️', 'Добыча железной руды'),
      coal: sub('Угольная шахта', '⚫', 'Добыча угля'), stone: sub('Шахта минералов', '🪨', 'Добыча камня и минералов'),
    },
  },
  transport: { name: 'Транспортное предприятие', icon: '🚛', desc: 'Транспортное предприятие осуществляет перевозку грузов', cost: 200000, later: true },
  oilwell: { name: 'Нефтяная скважина', icon: '🛢️', desc: 'Добыча нефти', cost: 90000, workers: 15, upkeep: 200, storage: 3000 },
  lab: { name: 'Лаборатория', icon: '🔬', desc: 'Все исследования: технологии повышают качество товаров', cost: 70000, workers: 12, upkeep: 200, storage: 0 },
  power: { name: 'Электростанция', icon: '⚡', desc: 'Электростанция осуществляет производство электричества', cost: 3000000, later: true },
};

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
