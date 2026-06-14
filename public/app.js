// app.js — клиентская логика IT-Ребус Челлендж
const App = document.getElementById('app');
const TopRight = document.getElementById('topRight');
const Toasts = document.getElementById('toasts');

let ME = null;          // {id, login, role, points}
let STAGES = [];        // публичный контент
let PROGRESS = null;    // {points, answers[], stagesDone[], achievements[], wordle}
let route = 'landing';
let routeArg = null;

const $ = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

function go(r, arg) { route = r; routeArg = arg || null; render(); }

function toast(ach) {
  if (!ach || !ach.length) return;
  ach.forEach((a) => {
    const el = $(`<div class="toast"><div class="e">${a.icon || '🏅'}</div><div><div class="t">${esc(a.title)}</div><div class="d">${esc(a.desc)}</div></div></div>`);
    Toasts.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  });
}

// ---------- загрузка ----------
async function boot() {
  try { const r = await api('GET', '/me'); ME = r.user; } catch (e) { ME = null; }
  try { const r = await api('GET', '/content'); STAGES = r.stages; } catch (e) {}
  if (ME) { await loadProgress(); go('hub'); } else { go('landing'); }
}
async function loadProgress() {
  if (!ME) return;
  PROGRESS = await api('GET', '/progress');
  ME.points = PROGRESS.points;
}

function renderTop() {
  if (ME && ME.role !== 'admin') {
    TopRight.innerHTML = '';
    TopRight.appendChild($(`<span class="pill">👤 ${esc(ME.login)}</span>`));
    TopRight.appendChild($(`<span class="pill">⭐ <span class="pts">${ME.points}</span></span>`));
    const lb = $(`<button class="btn sm ghost">🏆 Рейтинг</button>`); lb.onclick = () => go('leaderboard');
    const out = $(`<button class="btn sm ghost">Выход</button>`); out.onclick = logout;
    TopRight.appendChild(lb); TopRight.appendChild(out);
  } else {
    TopRight.innerHTML = '';
    const adm = $(`<a class="btn sm ghost" href="/admin">🖥 Экран ведущего</a>`);
    TopRight.appendChild(adm);
  }
}

async function logout() { await api('POST', '/logout'); ME = null; PROGRESS = null; go('landing'); }

// ====================== ЭКРАНЫ ======================
function render() {
  renderTop();
  if (route === 'landing') return renderLanding();
  if (route === 'demo') return renderDemo();
  if (route === 'auth') return renderAuth();
  if (route === 'hub') return renderHub();
  if (route === 'stage') return renderStage(routeArg);
  if (route === 'leaderboard') return renderLeaderboard();
}

// ---------- LANDING ----------
function renderLanding() {
  App.innerHTML = '';
  const hero = $(`
  <div class="hero">
    <span class="eyebrow">Проф-ориентация · Разработка и управление ПО</span>
    <h1>Стань <span class="grad">IT-героем</span><br>за 20 минут</h1>
    <p class="lead">Соревновательный квест из 7 этапов: ребусы, код, игры и крестики-нолики вживую.
    Зарабатывай очки, открывай достижения и поднимайся в живом рейтинге.</p>
    <div class="cta">
      <button class="btn primary big" id="bStart">🚀 Войти и начать</button>
      <button class="btn big" id="bDemo">👀 Демо для проектора</button>
    </div>
  </div>`);
  App.appendChild(hero);
  hero.querySelector('#bStart').onclick = () => go('auth');
  hero.querySelector('#bDemo').onclick = () => go('demo');

  const grid = $(`<div class="quest" style="margin-top:30px"></div>`);
  STAGES.forEach((s, i) => {
    grid.appendChild($(`<div class="node" style="cursor:default"><div class="ic">${s.icon}</div>
      <h3>${esc(s.title)}</h3><div class="tag">${esc(s.tagline)}</div>
      <div class="state muted">Этап ${i + 1}</div></div>`));
  });
  App.appendChild($(`<div class="section-title">Что внутри</div>`));
  App.appendChild(grid);
}

// ---------- DEMO (для показа с проектора) ----------
function renderDemo() {
  const demo = [
    { icon: '🧩', title: 'Эмодзи-ребус', tag: 'Расшифруй IT-слово по эмодзи', prompt: '🪟 + 💻', options: ['Windows', 'Стекло', 'Окно', 'Linux'], correct: 0 },
    { icon: '💻', title: 'Допиши код', tag: 'Подставь нужный кусочек (с подсказками)', prompt: 'print("Привет, ___!")  →  Привет, мир!', options: ['мир', 'print', '2024', 'world'], correct: 0 },
    { icon: '🎮', title: 'Угадай игру', tag: 'Какая игра спряталась в описании?', prompt: 'Кубический мир: блоки, крафт, криперы', options: ['Minecraft', 'Roblox', 'PUBG', 'CS'], correct: 0 },
    { icon: '🔮', title: 'Что выведет код?', tag: 'Угадай результат строчки', prompt: 'print("5" + "5")', options: ['55', '10', '25', 'Ошибка'], correct: 0 },
    { icon: '⚡', title: 'Правда или миф', tag: 'Блиц по фактам из мира IT', prompt: '«Тетрис» придумали в России (СССР)', options: ['Правда', 'Миф'], correct: 0 },
  ];
  App.innerHTML = '';
  const head = $(`<div class="row"><button class="btn sm ghost" id="back">← Назад</button>
    <div class="spacer"></div><div class="muted">Демо без сохранения — нажми любой вариант</div></div>`);
  App.appendChild(head);
  head.querySelector('#back').onclick = () => go('landing');
  App.appendChild($(`<div class="hero" style="padding:18px 0 0"><h1 style="font-size:34px">Как это работает 👇</h1>
    <p class="lead">Покажи примеры на проекторе, чтобы ребята поняли формат. Зелёный — правильный ответ.</p></div>`));

  const grid = $(`<div class="demo-grid"></div>`);
  demo.forEach((d) => {
    const card = $(`<div class="card demo-card"><h3>${d.icon} ${esc(d.title)}</h3><div class="tag">${esc(d.tag)}</div>
      <div class="prompt mono">${esc(d.prompt)}</div></div>`);
    d.options.forEach((o, idx) => {
      const b = $(`<button class="opt">${esc(o)}</button>`);
      b.onclick = () => {
        card.querySelectorAll('.opt').forEach((x) => x.classList.add('disabled'));
        card.querySelectorAll('.opt')[d.correct].classList.add('correct');
        if (idx !== d.correct) b.classList.add('wrong');
      };
      card.appendChild(b);
    });
    grid.appendChild(card);
  });

  // wordle demo
  const w = $(`<div class="card demo-card"><h3>🟩 IT-Wordle</h3><div class="tag">Угадай слово из 5 букв за 6 попыток</div>
    <div class="wrow" style="max-width:280px;margin:6px 0 12px">
      <div class="wcell g">В</div><div class="wcell b">И</div><div class="wcell y">Р</div><div class="wcell b">У</div><div class="wcell b">С</div>
    </div>
    <div class="muted" style="font-size:13px">🟩 буква на месте · 🟨 есть в слове, но не там · ⬛ нет в слове</div></div>`);
  grid.appendChild(w);

  // ttt demo
  const tt = $(`<div class="card demo-card"><h3>⭕ Крестики-нолики</h3><div class="tag">Играешь с другим студентом вживую. Если соперников онлайн нет — с компьютером 🤖. Откроется после 2 этапов.</div>
    <div class="ttt" style="grid-template-columns:repeat(3,56px);grid-template-rows:repeat(3,56px)">
      <div class="tcell x taken" style="font-size:30px">X</div><div class="tcell o taken" style="font-size:30px">O</div><div class="tcell taken"></div>
      <div class="tcell taken"></div><div class="tcell x taken" style="font-size:30px">X</div><div class="tcell taken"></div>
      <div class="tcell o taken" style="font-size:30px">O</div><div class="tcell taken"></div><div class="tcell x taken" style="font-size:30px">X</div>
    </div></div>`);
  grid.appendChild(tt);
  App.appendChild(grid);

  App.appendChild($(`<div class="card" style="margin-top:18px"><h3 style="margin-top:0">🏆 Очки и достижения</h3>
    <div class="muted">За правильный ответ +100, за пройденный этап +50 бонусом. В крестиках-ноликах: победа +300, ничья +150.
    Бейджи открываются за прохождение этапов, идеальные ответы и победы. Всё видно в живом рейтинге.</div></div>`));
}

// ---------- AUTH ----------
function renderAuth() {
  App.innerHTML = '';
  let mode = 'register';
  const box = $(`<div class="card form" style="margin-top:30px"></div>`);
  function draw() {
    box.innerHTML = '';
    const tabs = $(`<div class="tabs">
      <button class="btn ${mode === 'register' ? 'primary' : 'ghost'}" id="tReg">Регистрация</button>
      <button class="btn ${mode === 'login' ? 'primary' : 'ghost'}" id="tLog">Вход</button></div>`);
    box.appendChild(tabs);
    tabs.querySelector('#tReg').onclick = () => { mode = 'register'; draw(); };
    tabs.querySelector('#tLog').onclick = () => { mode = 'login'; draw(); };
    box.appendChild($(`<label>Имя (его увидят в рейтинге)</label>`));
    const login = $(`<input id="login" maxlength="20" placeholder="например, Артём_9Б" autocomplete="username">`);
    box.appendChild(login);
    box.appendChild($(`<label>Пароль</label>`));
    const pass = $(`<input id="pass" type="password" placeholder="минимум 4 символа" autocomplete="current-password">`);
    box.appendChild(pass);
    const err = $(`<div class="err"></div>`);
    const btn = $(`<button class="btn primary big" style="width:100%;margin-top:18px">${mode === 'register' ? 'Создать и начать' : 'Войти'}</button>`);
    box.appendChild(btn); box.appendChild(err);
    box.appendChild($(`<div class="center muted" style="margin-top:14px;font-size:13px"><a id="b2">← на главную</a></div>`));
    box.querySelector('#b2').onclick = () => go('landing');
    const submit = async () => {
      err.textContent = '';
      try {
        const r = await api('POST', '/' + mode, { login: login.value, password: pass.value });
        ME = r; await loadProgress(); go('hub');
      } catch (e) { err.textContent = e.message; }
    };
    btn.onclick = submit;
    pass.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  }
  draw();
  App.appendChild($(`<div class="hero center" style="padding:24px 0 0"><h1 style="font-size:36px">Поехали 🚀</h1>
    <p class="lead" style="margin-inline:auto">Придумай имя и пароль — и сразу в игру. Регистрация за 5 секунд.</p></div>`));
  App.appendChild(box);
}

// ---------- HUB (карта этапов) ----------
function renderHub() {
  if (!ME) return go('landing');
  App.innerHTML = '';
  const doneSet = new Set(PROGRESS.stagesDone);
  const ansByStage = {};
  PROGRESS.answers.forEach((a) => { (ansByStage[a.stage] = ansByStage[a.stage] || []).push(a); });
  const doneCount = doneSet.size;

  App.appendChild($(`<div class="hero" style="padding:18px 0 6px"><h1 style="font-size:34px">Привет, ${esc(ME.login)}! 👋</h1>
    <p class="lead">Пройдено этапов: <b>${doneCount} из ${STAGES.length}</b> · Очков: <b style="color:var(--amber)">${ME.points}</b></p></div>`));
  const pct = Math.round((doneCount / STAGES.length) * 100);
  App.appendChild($(`<div class="bar" style="margin-bottom:8px"><i style="width:${pct}%"></i></div>`));

  const grid = $(`<div class="quest"></div>`);
  STAGES.forEach((s) => {
    const isDone = doneSet.has(s.key);
    const answered = (ansByStage[s.key] || []).length;
    const inProgress = answered > 0 && !isDone;
    const locked = s.requires && doneCount < s.requires;
    let cls = 'node', state = 'Начать →';
    if (isDone) { cls += ' done'; state = '✓ Пройдено'; }
    else if (inProgress) { cls += ' progress'; state = `В процессе (${answered}/${s.total})`; }
    if (locked) { cls += ' locked'; state = `🔒 После ${s.requires} этапов`; }
    const node = $(`<div class="${cls}"><div class="ring">${isDone ? '✅' : ''}</div>
      <div class="ic">${s.icon}</div><h3>${esc(s.title)}</h3>
      <div class="tag">${esc(s.tagline)}</div><div class="state">${state}</div></div>`);
    if (!locked) node.onclick = () => go('stage', s.key);
    grid.appendChild(node);
  });
  App.appendChild(grid);

  // достижения
  App.appendChild($(`<div class="section-title">Достижения</div>`));
  const have = new Set(PROGRESS.achievements.map((a) => a.code));
  const ALL = {
    first_step: ['🚀', 'Первый шаг', 'Завершил первый этап'],
    on_fire: ['🔥', 'В деле', 'Завершил 3 этапа'],
    champion: ['👑', 'Покоритель', 'Завершил все этапы'],
    sniper: ['🎯', 'Снайпер', 'Этап без ошибок'],
    gamer: ['🎮', 'Геймер', '5 из 5 в «Угадай игру»'],
    word_master: ['🟩', 'Угадал слово', 'Разгадал IT-Wordle'],
    ttt_win: ['⭕', 'Крестики: победа', 'Выиграл партию'],
    beat_bot: ['🤖', 'Обыграл компьютер', 'Победил бота'],
    leader: ['🏆', 'Лидер', 'Был №1 в рейтинге'],
  };
  const badges = $(`<div class="badges"></div>`);
  Object.entries(ALL).forEach(([code, [e, t, d]]) => {
    const got = have.has(code);
    badges.appendChild($(`<div class="badge ${got ? '' : 'locked'}"><div class="e">${e}</div><div class="t">${t}</div><div class="d">${d}</div></div>`));
  });
  App.appendChild(badges);
}

// ---------- STAGE ----------
function renderStage(key) {
  const s = STAGES.find((x) => x.key === key);
  if (!s) return go('hub');
  App.innerHTML = '';
  const head = $(`<div class="row"><button class="btn sm ghost" id="back">← К этапам</button>
    <div class="spacer"></div><span class="pill">⭐ <span class="pts">${ME.points}</span></span></div>`);
  App.appendChild(head);
  head.querySelector('#back').onclick = () => { loadProgress().then(() => go('hub')); };

  App.appendChild($(`<div class="hero" style="padding:16px 0 0"><h1 style="font-size:30px">${s.icon} ${esc(s.title)}</h1>
    <p class="lead" style="margin-bottom:10px">${esc(s.tagline)}</p></div>`));
  const mount = $(`<div></div>`);
  App.appendChild(mount);

  if (s.type === 'quiz') return renderQuiz(s, mount);
  if (s.type === 'wordle') return renderWordleStage(mount);
  if (s.type === 'ttt') return renderTtt(mount);
}

// ---------- QUIZ ----------
function renderQuiz(s, mount) {
  const answered = new Set(PROGRESS.answers.filter((a) => a.stage === s.key).map((a) => a.qid));
  let idx = s.questions.findIndex((q) => !answered.has(q.id));

  function drawQuestion() {
    mount.innerHTML = '';
    if (idx === -1) return drawDone();
    const q = s.questions[idx];
    const num = idx + 1;
    const card = $(`<div class="card"></div>`);
    card.appendChild($(`<div class="q-head"><div class="muted">Вопрос ${num} из ${s.total}</div></div>`));
    const bar = $(`<div class="bar"><i style="width:${Math.round((num - 1) / s.total * 100)}%"></i></div>`);
    card.appendChild(bar);
    card.appendChild($(`<div class="prompt-big mono">${esc(q.prompt)}</div>`));
    if (q.hint) {
      const hint = $(`<div class="hint hidden">💡 ${esc(q.hint)}</div>`);
      const hb = $(`<button class="btn sm ghost">💡 Подсказка</button>`);
      hb.onclick = () => { hint.classList.remove('hidden'); hb.remove(); };
      card.appendChild(hb); card.appendChild(hint);
    }
    const opts = $(`<div style="margin-top:14px"></div>`);
    q.options.forEach((o, i) => {
      const b = $(`<button class="opt">${esc(o)}</button>`);
      b.onclick = async () => {
        opts.querySelectorAll('.opt').forEach((x) => x.classList.add('disabled'));
        let r;
        try { r = await api('POST', '/answer', { stage: s.key, qid: q.id, answer: i }); }
        catch (e) { opts.querySelectorAll('.opt').forEach((x) => x.classList.remove('disabled')); return; }
        opts.querySelectorAll('.opt')[r.correctIndex].classList.add('correct');
        if (i !== r.correctIndex) b.classList.add('wrong');
        ME.points = r.points; renderTop();
        toast(r.newAchievements);
        const next = $(`<button class="btn primary" style="margin-top:16px">${idx + 1 >= s.total ? 'Завершить ✓' : 'Дальше →'}</button>`);
        next.onclick = () => { idx = s.questions.findIndex((qq) => !answered.has(qq.id) && qq.id !== q.id); answered.add(q.id); idx = s.questions.findIndex((qq) => !answered.has(qq.id)); drawQuestion(); };
        card.appendChild(next);
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    mount.appendChild(card);
  }
  function drawDone() {
    const correct = PROGRESS.answers.filter((a) => a.stage === s.key && a.correct).length;
    mount.innerHTML = '';
    const c = $(`<div class="card center"><div style="font-size:54px">🎉</div>
      <h2>Этап пройден!</h2><p class="muted">Правильных ответов: ${correct} из ${s.total}</p>
      <div class="row" style="justify-content:center;margin-top:16px"></div></div>`);
    const next = $(`<button class="btn primary big">К следующему этапу →</button>`);
    next.onclick = () => loadProgress().then(() => go('hub'));
    c.querySelector('.row').appendChild(next);
    mount.appendChild(c);
  }
  // обновим answered из свежего PROGRESS на всякий
  drawQuestion();
}

// ---------- WORDLE ----------
async function renderWordleStage(mount) {
  mount.innerHTML = '<div class="muted">Загружаю…</div>';
  let st;
  try { st = await api('POST', '/wordle/start'); } catch (e) { mount.innerHTML = esc(e.message); return; }
  draw();
  function draw() {
    mount.innerHTML = '';
    const card = $(`<div class="card"></div>`);
    const grid = $(`<div class="wgrid"></div>`);
    for (let r = 0; r < 6; r++) {
      const row = $(`<div class="wrow"></div>`);
      const g = st.guesses[r];
      for (let i = 0; i < 5; i++) {
        const ch = g ? g.word[i] : '';
        const mk = g ? g.marks[i] : '';
        row.appendChild($(`<div class="wcell ${mk}">${esc(ch)}</div>`));
      }
      grid.appendChild(row);
    }
    card.appendChild(grid);
    if (st.done) {
      const win = st.win;
      card.appendChild($(`<div class="tstatus" style="margin-top:6px;color:${win ? 'var(--green)' : 'var(--pink)'}">
        ${win ? '🟩 Угадал! Слово: ' : 'Попытки кончились. Слово было: '} <b>${esc(st.answer || '')}</b></div>`));
      const next = $(`<div class="center" style="margin-top:16px"></div>`);
      const b = $(`<button class="btn primary big">К этапам →</button>`);
      b.onclick = () => loadProgress().then(() => go('hub'));
      next.appendChild(b); card.appendChild(next);
    } else {
      card.appendChild($(`<div class="muted center" style="margin:10px 0">Слово из мира IT, 5 букв. Осталось попыток: ${6 - st.guesses.length}</div>`));
      const win = $(`<div class="winput"><input id="wi" maxlength="5" placeholder="СЛОВО" autocomplete="off"><button class="btn primary" id="wb">Проверить</button></div>`);
      const err = $(`<div class="err"></div>`);
      card.appendChild(win); card.appendChild(err);
      const inp = win.querySelector('#wi');
      const submit = async () => {
        err.textContent = '';
        try {
          const r = await api('POST', '/wordle/guess', { word: inp.value });
          st.guesses = r.guesses; st.done = r.done; st.win = r.win; st.answer = r.answer;
          if (r.points != null) { ME.points = r.points; renderTop(); }
          toast(r.newAchievements);
          draw();
        } catch (e) { err.textContent = e.message; }
      };
      win.querySelector('#wb').onclick = submit;
      inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
      setTimeout(() => inp.focus(), 50);
    }
    mount.appendChild(card);
  }
}

// ---------- TIC-TAC-TOE ----------
function renderTtt(mount) {
  let game = null, poll = null, botTimer = null, finishedHandled = false;
  mount.innerHTML = '<div class="card center"><div class="tstatus">Ищу соперника… 🔍</div></div>';

  const stop = () => { clearInterval(poll); clearTimeout(botTimer); };
  // покинуть страницу — остановить поллинг
  const backBtn = document.getElementById('back');
  if (backBtn) backBtn.addEventListener('click', stop, { once: true });

  async function start() {
    try { game = await api('POST', '/ttt/find'); }
    catch (e) { mount.innerHTML = `<div class="card center"><div class="tstatus">${esc(e.message)}</div></div>`; return; }
    drawGame();
    poll = setInterval(refresh, 1500);
    if (game.status === 'waiting') {
      botTimer = setTimeout(async () => {
        if (game && game.status === 'waiting') {
          try { game = await api('POST', '/ttt/bot', { gameId: game.gameId }); drawGame(); } catch (e) {}
        }
      }, 8000);
    }
  }
  async function refresh() {
    if (!game) return;
    try {
      const prev = game.status;
      game = await api('GET', '/ttt/state?gameId=' + game.gameId);
      if (prev === 'waiting' && game.status === 'playing') clearTimeout(botTimer);
      drawGame();
    } catch (e) {}
  }
  async function move(cell) {
    if (!game || game.status !== 'playing' || game.turn !== game.you) return;
    if (game.board[cell] !== '.') return;
    try {
      const r = await api('POST', '/ttt/move', { gameId: game.gameId, cell });
      game = r;
      if (r.points != null) { ME.points = r.points; renderTop(); }
      toast(r.newAchievements);
      drawGame();
    } catch (e) {}
  }
  function drawGame() {
    mount.innerHTML = '';
    const card = $(`<div class="card center"></div>`);
    let status = '';
    if (game.status === 'waiting') status = 'Ищу соперника… 🔍 (через 8 сек сыграешь с компьютером 🤖)';
    else if (game.status === 'playing') {
      status = game.turn === game.you ? 'Твой ход!' : `Ходит ${game.you === 'X' ? (game.oName || 'соперник') : (game.xName || 'соперник')}…`;
    } else if (game.status === 'finished') {
      stop();
      if (!finishedHandled) finishedHandled = true;
      if (game.winner === 'D') status = '🤝 Ничья!';
      else if (game.winner === game.you) status = '🎉 Победа!';
      else status = '😅 В этот раз не повезло';
    }
    card.appendChild($(`<div class="tstatus">${status}</div>`));
    card.appendChild($(`<div class="muted" style="font-size:13px">Ты играешь за <b style="color:${game.you === 'X' ? 'var(--cyan)' : 'var(--pink)'}">${game.you || '—'}</b>
      · X: ${esc(game.xName || '…')} · O: ${esc(game.oName || '…')}</div>`));
    const board = $(`<div class="ttt"></div>`);
    for (let i = 0; i < 9; i++) {
      const ch = game.board[i];
      const cell = $(`<div class="tcell ${ch === 'X' ? 'x' : ch === 'O' ? 'o' : ''} ${ch !== '.' ? 'taken' : ''}">${ch === '.' ? '' : ch}</div>`);
      if (game.status === 'playing' && ch === '.' && game.turn === game.you) cell.onclick = () => move(i);
      board.appendChild(cell);
    }
    card.appendChild(board);
    if (game.status === 'finished') {
      const b = $(`<button class="btn primary big" style="margin-top:8px">К этапам →</button>`);
      b.onclick = () => loadProgress().then(() => go('hub'));
      card.appendChild(b);
    }
    mount.appendChild(card);
  }
  start();
}

// ---------- LEADERBOARD ----------
let lbPoll = null;
async function renderLeaderboard() {
  clearInterval(lbPoll);
  App.innerHTML = '';
  const head = $(`<div class="row"><button class="btn sm ghost" id="back">← Назад</button>
    <div class="spacer"></div><div class="muted">Обновляется в реальном времени</div></div>`);
  App.appendChild(head);
  head.querySelector('#back').onclick = () => { clearInterval(lbPoll); go(ME ? 'hub' : 'landing'); };
  App.appendChild($(`<div class="hero" style="padding:16px 0 6px"><h1 style="font-size:34px">🏆 Рейтинг</h1></div>`));
  const card = $(`<div class="card"></div>`);
  App.appendChild(card);
  async function refresh() {
    let d;
    try { d = await api('GET', '/leaderboard'); } catch (e) { return; }
    card.innerHTML = '';
    if (!d.leaderboard.length) { card.appendChild($(`<div class="muted center">Пока никто не набрал очков — будь первым!</div>`)); return; }
    const tbl = $(`<table class="lb"><thead><tr><th>#</th><th>Имя</th><th>Этапы</th><th style="text-align:right">Очки</th></tr></thead><tbody></tbody></table>`);
    const tb = tbl.querySelector('tbody');
    d.leaderboard.forEach((u, i) => {
      const r = i + 1;
      const me = ME && u.login === ME.login;
      const medal = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r;
      tb.appendChild($(`<tr style="${me ? 'background:rgba(103,232,249,.08)' : ''}">
        <td class="rank rank-${r}">${medal}</td>
        <td>${esc(u.login)}${me ? ' <span class="muted">(ты)</span>' : ''}</td>
        <td class="muted">${u.done}/${d.totalStages}</td>
        <td class="pts">${u.points}</td></tr>`));
    });
    card.appendChild(tbl);
  }
  await refresh();
  lbPoll = setInterval(refresh, 2000);
}

boot();
