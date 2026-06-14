// content.js — весь контент квеста. Лёгкий и развлекательный, для школьников после 9 класса.
// Для викторин ответ хранится на сервере (correct), клиенту отдаётся без ответов.

const STAGES = [
  {
    key: 'rebus',
    title: 'Эмодзи-ребус',
    icon: '🧩',
    tagline: 'Расшифруй IT-словечко по эмодзи',
    type: 'quiz',
    questions: [
      { id: 'r1', prompt: '🪟 + 💻', hint: 'Самая популярная операционная система', options: ['Windows', 'Linux', 'Стекло', 'Калькулятор'], correct: 0 },
      { id: 'r2', prompt: '☁️ + 💾', hint: 'Файлы хранятся «не на компьютере, а где-то там»', options: ['Дождь', 'Облако', 'Туман', 'Дискета'], correct: 1 },
      { id: 'r3', prompt: '🐛 + 💻', hint: 'Когда программа работает не так, как надо', options: ['Жук', 'Гусеница', 'Баг', 'Антивирус'], correct: 2 },
      { id: 'r4', prompt: '🤖 + 💬', hint: 'Отвечает в чате вместо человека', options: ['Робот-пылесос', 'Игрушка', 'Чат-бот', 'Телефон'], correct: 2 },
      { id: 'r5', prompt: '🐍 + ⌨️', hint: 'Язык программирования, назван в честь шоу, а не змеи', options: ['Кобра', 'Python', 'Удав', 'Змейка'], correct: 1 },
    ],
  },
  {
    key: 'code',
    title: 'Допиши код',
    icon: '💻',
    tagline: 'Подставь нужный кусочек — с подсказками',
    type: 'quiz',
    questions: [
      { id: 'c1', prompt: 'print("Привет, ___!")  → должно вывести: Привет, мир!', hint: 'Вставь слово, которое выведется', options: ['мир', 'world', 'print', '2024'], correct: 0 },
      { id: 'c2', prompt: 'for i in ___(5):   # повторить 5 раз', hint: 'Англ. слово «диапазон»', options: ['loop', 'range', 'repeat', 'count'], correct: 1 },
      { id: 'c3', prompt: 'x = 10\ny = ___\nprint(x + y)   → должно вывести 15', hint: '10 + ? = 15', options: ['10', '5', '15', '"5"'], correct: 1 },
      { id: 'c4', prompt: 'if age ___ 18:   # если возраст больше 18', hint: 'Знак «больше»', options: ['<', '=', '>', '!'], correct: 2 },
    ],
  },
  {
    key: 'games',
    title: 'Угадай игру',
    icon: '🎮',
    tagline: 'Какая игра спряталась в описании?',
    type: 'quiz',
    questions: [
      { id: 'g1', prompt: 'Кубический мир: ломаешь блоки, строишь дома, крафтишь и боишься криперов', hint: 'Самая продаваемая игра в мире', options: ['Roblox', 'Minecraft', 'Terraria', 'Fortnite'], correct: 1 },
      { id: 'g2', prompt: 'Космический корабль, выполняешь задания, но среди экипажа есть предатель', hint: '«Кто здесь импостер?»', options: ['Among Us', 'Fall Guys', 'PUBG', 'CS'], correct: 0 },
      { id: 'g3', prompt: 'Платформа, где сами игроки создают мини-игры и аватары', hint: 'Любимо у младших школьников', options: ['Steam', 'Roblox', 'Discord', 'Minecraft'], correct: 1 },
      { id: 'g4', prompt: 'Матчи 3 на 3, куча разных бойцов, короткие весёлые бои', hint: 'От создателей Clash Royale', options: ['Dota 2', 'PUBG', 'Brawl Stars', 'Valorant'], correct: 2 },
      { id: 'g5', prompt: 'Шутер: спецназ против террористов, нужно заложить или разминировать бомбу', hint: 'Классика киберспорта, есть «ножи» и «скины»', options: ['Counter-Strike', 'Overwatch', 'Apex', 'Halo'], correct: 0 },
    ],
  },
  {
    key: 'ttt',
    title: 'Крестики-нолики',
    icon: '⭕',
    tagline: 'Сразись с другим игроком, а если никого нет — с компьютером',
    type: 'ttt',
    requires: 2, // открывается после 2 пройденных этапов
    questions: [],
  },
  {
    key: 'output',
    title: 'Что выведет код?',
    icon: '🔮',
    tagline: 'Прочитай строчку и угадай результат',
    type: 'quiz',
    questions: [
      { id: 'o1', prompt: 'print(2 + 2)', hint: 'Обычная математика', options: ['4', '22', '2 + 2', '0'], correct: 0 },
      { id: 'o2', prompt: 'print("5" + "5")', hint: 'Это текст в кавычках, а не числа', options: ['10', '55', '25', 'Ошибка'], correct: 1 },
      { id: 'o3', prompt: 'print(10 - 3)', hint: 'Тоже математика', options: ['13', '103', '7', '30'], correct: 2 },
      { id: 'o4', prompt: 'print("кот".upper())', hint: '.upper() делает БОЛЬШИЕ буквы', options: ['кот', 'КОТ', 'Кот', 'KOT'], correct: 1 },
      { id: 'o5', prompt: 'print(len("hello"))', hint: 'len() считает количество букв', options: ['1', 'hello', '5', '4'], correct: 2 },
    ],
  },
  {
    key: 'wordle',
    title: 'IT-Wordle',
    icon: '🟩',
    tagline: 'Угадай IT-слово из 5 букв за 6 попыток',
    type: 'wordle',
    questions: [],
  },
  {
    key: 'facts',
    title: 'Правда или миф',
    icon: '⚡',
    tagline: 'Блиц по фактам из мира технологий',
    type: 'quiz',
    questions: [
      { id: 'f1', prompt: 'Первая компьютерная мышь была сделана из дерева', hint: 'Изобретена в 1964 году', options: ['Правда', 'Миф'], correct: 0 },
      { id: 'f2', prompt: 'Игру «Тетрис» придумали в России (СССР)', hint: 'Автор — Алексей Пажитнов', options: ['Правда', 'Миф'], correct: 0 },
      { id: 'f3', prompt: 'Значок @ во всех странах называют «собакой»', hint: 'А в Италии — «улитка», в Греции — «утёнок»', options: ['Правда', 'Миф'], correct: 1 },
      { id: 'f4', prompt: 'Первый компьютерный вирус назывался Creeper', hint: 'Он показывал надпись «Поймай меня, если сможешь»', options: ['Правда', 'Миф'], correct: 0 },
      { id: 'f5', prompt: 'Wi-Fi официально расшифровывается как «Wireless Fidelity»', hint: 'На самом деле это просто красивое название', options: ['Правда', 'Миф'], correct: 1 },
      { id: 'f6', prompt: 'Компания Google сначала называлась BackRub', hint: 'Так звали их первый поисковый проект', options: ['Правда', 'Миф'], correct: 0 },
    ],
  },
];

// Слова для Wordle (5 букв, из мира IT). Одно выбирается случайно на игрока.
const WORDLE_WORDS = ['ВИРУС', 'ЛОГИН', 'ХАКЕР', 'КОДЕР', 'МЫШКА', 'ЭКРАН', 'РОБОТ', 'ИГРОК', 'КЛАВА', 'ПИКСЕ'];
// (ПИКСЕ исключим — оставим валидные слова из 5 букв)
const WORDLE_LIST = ['ВИРУС', 'ЛОГИН', 'ХАКЕР', 'КОДЕР', 'МЫШКА', 'ЭКРАН', 'РОБОТ', 'ИГРОК', 'КЛАВА', 'БАЙТЫ', 'ЛАЙКИ'];

// Версия без правильных ответов — для клиента
function publicStages() {
  return STAGES.map((s) => ({
    key: s.key,
    title: s.title,
    icon: s.icon,
    tagline: s.tagline,
    type: s.type,
    requires: s.requires || 0,
    total: s.questions.length,
    questions: s.questions.map((q) => ({ id: q.id, prompt: q.prompt, hint: q.hint, options: q.options })),
  }));
}

function getStage(key) {
  return STAGES.find((s) => s.key === key);
}

module.exports = { STAGES, WORDLE_LIST, publicStages, getStage };
