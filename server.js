// server.js — IT-Ребус Челлендж
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { pool, init } = require('./db');
const { STAGES, WORDLE_LIST, publicStages, getStage } = require('./content');
const { checkWinner, botMove, ACHIEVEMENTS } = require('./game-logic');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const PTS_CORRECT = 100;
const PTS_STAGE_BONUS = 50;
const TOTAL_STAGES = STAGES.length;

// ---------- утилиты ----------
function newToken() { return crypto.randomBytes(24).toString('hex'); }

async function addPoints(userId, delta) {
  if (delta) await pool.query('UPDATE users SET points = points + ? WHERE id=?', [delta, userId]);
}

async function getUserById(id) {
  const [rows] = await pool.query('SELECT id, login, role, points FROM users WHERE id=?', [id]);
  return rows[0] || null;
}

// middleware авторизации (+ обновляем «онлайн»)
async function auth(req, res, next) {
  try {
    const token = req.cookies.sid;
    if (token) {
      const [rows] = await pool.query(
        'SELECT u.id, u.login, u.role, u.points FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?',
        [token]
      );
      if (rows[0]) {
        req.user = rows[0];
        pool.query('UPDATE users SET last_seen=NOW() WHERE id=?', [rows[0].id]).catch(() => {});
      }
    }
  } catch (e) { /* игнор */ }
  next();
}
app.use(auth);

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Нужно войти' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Только для администратора' });
  next();
}

// ---------- достижения ----------
async function grant(userId, code, out) {
  const [r] = await pool.query('INSERT IGNORE INTO achievements (user_id, code) VALUES (?,?)', [userId, code]);
  if (r.affectedRows === 1) out.push({ code, ...ACHIEVEMENTS[code] });
}

async function evalAchievements(userId) {
  const out = [];
  // пройденные этапы
  const [[doneRow]] = await pool.query('SELECT COUNT(*) c FROM stage_progress WHERE user_id=? AND done=1', [userId]);
  const stagesDone = doneRow.c;
  if (stagesDone >= 1) await grant(userId, 'first_step', out);
  if (stagesDone >= 3) await grant(userId, 'on_fire', out);
  if (stagesDone >= TOTAL_STAGES) await grant(userId, 'champion', out);

  // статистика по ответам
  const [stats] = await pool.query(
    'SELECT stage, COUNT(*) c, COALESCE(SUM(correct),0) corr FROM answers WHERE user_id=? GROUP BY stage', [userId]
  );
  for (const s of stats) {
    const def = getStage(s.stage);
    if (!def || def.type !== 'quiz') continue;
    const total = def.questions.length;
    if (s.c >= total && s.corr >= total) await grant(userId, 'sniper', out);
    if (s.stage === 'games' && s.c >= total && s.corr >= total) await grant(userId, 'gamer', out);
  }

  // wordle решён?
  const [[wrow]] = await pool.query('SELECT state FROM stage_progress WHERE user_id=? AND stage=?', [userId, 'wordle']);
  if (wrow && wrow.state) {
    try { if (JSON.parse(wrow.state).win) await grant(userId, 'word_master', out); } catch (e) {}
  }

  // крестики-нолики
  const [twins] = await pool.query(
    "SELECT vs_bot FROM ttt_games WHERE status='finished' AND ((x_user=? AND winner='X') OR (o_user=? AND winner='O'))",
    [userId, userId]
  );
  if (twins.length) {
    await grant(userId, 'ttt_win', out);
    if (twins.some((g) => g.vs_bot === 1)) await grant(userId, 'beat_bot', out);
  }

  // лидер рейтинга
  const [[top]] = await pool.query("SELECT id, points FROM users WHERE role='user' ORDER BY points DESC, id ASC LIMIT 1");
  if (top && top.id === userId && top.points > 0) await grant(userId, 'leader', out);

  return out;
}

// ====================== АВТОРИЗАЦИЯ ======================
app.post('/api/register', async (req, res) => {
  let { login, password } = req.body || {};
  login = String(login || '').trim();
  password = String(password || '');
  if (login.length < 2 || login.length > 20) return res.status(400).json({ error: 'Имя: от 2 до 20 символов' });
  if (password.length < 4) return res.status(400).json({ error: 'Пароль: минимум 4 символа' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query('INSERT INTO users (login, pass_hash) VALUES (?,?)', [login, hash]);
    const token = newToken();
    await pool.query('INSERT INTO sessions (token, user_id) VALUES (?,?)', [token, r.insertId]);
    res.cookie('sid', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 });
    res.json({ id: r.insertId, login, role: 'user', points: 0 });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Такое имя уже занято' });
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/login', async (req, res) => {
  let { login, password } = req.body || {};
  login = String(login || '').trim();
  password = String(password || '');
  const [rows] = await pool.query('SELECT * FROM users WHERE login=?', [login]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.pass_hash))) {
    return res.status(401).json({ error: 'Неверное имя или пароль' });
  }
  const token = newToken();
  await pool.query('INSERT INTO sessions (token, user_id) VALUES (?,?)', [token, user.id]);
  res.cookie('sid', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 });
  res.json({ id: user.id, login: user.login, role: user.role, points: user.points });
});

app.post('/api/logout', async (req, res) => {
  if (req.cookies.sid) await pool.query('DELETE FROM sessions WHERE token=?', [req.cookies.sid]);
  res.clearCookie('sid');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

// ====================== КОНТЕНТ / ПРОГРЕСС ======================
app.get('/api/content', (req, res) => res.json({ stages: publicStages() }));

app.get('/api/progress', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const [answers] = await pool.query('SELECT stage, qid, correct FROM answers WHERE user_id=?', [uid]);
  const [stages] = await pool.query('SELECT stage, done FROM stage_progress WHERE user_id=?', [uid]);
  const [achs] = await pool.query('SELECT code FROM achievements WHERE user_id=?', [uid]);
  const [[me]] = await pool.query('SELECT points FROM users WHERE id=?', [uid]);
  // wordle (без ответа, если не закончено)
  const [[wrow]] = await pool.query('SELECT state FROM stage_progress WHERE user_id=? AND stage=?', [uid, 'wordle']);
  let wordle = null;
  if (wrow && wrow.state) {
    try {
      const st = JSON.parse(wrow.state);
      wordle = { guesses: st.guesses, done: st.done, win: st.win, answer: st.done ? st.target : null };
    } catch (e) {}
  }
  res.json({
    points: me.points,
    answers,
    stagesDone: stages.filter((s) => s.done).map((s) => s.stage),
    achievements: achs.map((a) => ({ code: a.code, ...ACHIEVEMENTS[a.code] })),
    wordle,
  });
});

// ---------- ответ в викторине ----------
app.post('/api/answer', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const { stage, qid, answer } = req.body || {};
  const def = getStage(stage);
  if (!def || (def.type !== 'quiz' && def.type !== 'neural')) return res.status(400).json({ error: 'Этап не найден' });
  const q = def.questions.find((x) => x.id === qid);
  if (!q) return res.status(400).json({ error: 'Вопрос не найден' });

  const correct = Number(answer) === q.correct;
  const pts = correct ? PTS_CORRECT : 0;
  const [ins] = await pool.query(
    'INSERT IGNORE INTO answers (user_id, stage, qid, correct, points) VALUES (?,?,?,?,?)',
    [uid, stage, qid, correct ? 1 : 0, pts]
  );

  let newAch = [];
  const firstTime = ins.affectedRows === 1;
  if (firstTime && pts) await addPoints(uid, pts);

  if (firstTime) {
    // проверка завершения этапа
    const [[agg]] = await pool.query('SELECT COUNT(*) c FROM answers WHERE user_id=? AND stage=?', [uid, stage]);
    const total = def.questions.length;
    if (agg.c >= total) {
      const [[sp]] = await pool.query('SELECT done FROM stage_progress WHERE user_id=? AND stage=?', [uid, stage]);
      if (!sp || !sp.done) {
        await addPoints(uid, PTS_STAGE_BONUS);
        await pool.query(
          `INSERT INTO stage_progress (user_id, stage, done, points, finished_at) VALUES (?,?,1,?,NOW())
           ON DUPLICATE KEY UPDATE done=1, finished_at=NOW()`,
          [uid, stage, PTS_STAGE_BONUS]
        );
      }
    }
    newAch = await evalAchievements(uid);
  }

  const [[me]] = await pool.query('SELECT points FROM users WHERE id=?', [uid]);
  res.json({ correct, correctIndex: q.correct, awarded: firstTime ? pts : 0, points: me.points, newAchievements: newAch });
});

// ====================== WORDLE ======================
function scoreWordle(target, guess) {
  const marks = Array(5).fill('b');
  const t = target.split('');
  const used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (guess[i] === t[i]) { marks[i] = 'g'; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (marks[i] === 'g') continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guess[i] === t[j]) { marks[i] = 'y'; used[j] = true; break; }
    }
  }
  return marks.join('');
}

async function loadWordle(uid) {
  const [[row]] = await pool.query('SELECT state FROM stage_progress WHERE user_id=? AND stage=?', [uid, 'wordle']);
  if (row && row.state) { try { return JSON.parse(row.state); } catch (e) {} }
  return null;
}
async function saveWordle(uid, st) {
  await pool.query(
    `INSERT INTO stage_progress (user_id, stage, done, state, finished_at)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE done=VALUES(done), state=VALUES(state), finished_at=VALUES(finished_at)`,
    [uid, 'wordle', st.done ? 1 : 0, JSON.stringify(st), st.done ? new Date() : null]
  );
}

app.post('/api/wordle/start', requireAuth, async (req, res) => {
  const uid = req.user.id;
  let st = await loadWordle(uid);
  if (!st) {
    const target = WORDLE_LIST[Math.floor(Math.random() * WORDLE_LIST.length)];
    st = { target, guesses: [], done: false, win: false };
    await saveWordle(uid, st);
  }
  res.json({ len: 5, max: 6, guesses: st.guesses, done: st.done, win: st.win, answer: st.done ? st.target : null });
});

app.post('/api/wordle/guess', requireAuth, async (req, res) => {
  const uid = req.user.id;
  let word = String(req.body.word || '').toUpperCase().replace(/Ё/g, 'Е').trim();
  let st = await loadWordle(uid);
  if (!st) return res.status(400).json({ error: 'Сначала начни игру' });
  if (st.done) return res.json({ done: true, win: st.win, guesses: st.guesses, answer: st.target });
  if (!/^[А-Я]{5}$/.test(word)) return res.status(400).json({ error: 'Введи слово из 5 русских букв' });

  const marks = scoreWordle(st.target, word);
  st.guesses.push({ word, marks });
  let awarded = 0;
  let newAch = [];
  if (word === st.target) {
    st.win = true; st.done = true;
    awarded = Math.max(1, 7 - st.guesses.length) * 100; // быстрее угадал — больше очков
    await addPoints(uid, awarded);
  } else if (st.guesses.length >= 6) {
    st.done = true; // попытки кончились, но этап «пройден» (попытка засчитана)
  }
  await saveWordle(uid, st);
  if (st.done) newAch = await evalAchievements(uid);

  const [[me]] = await pool.query('SELECT points FROM users WHERE id=?', [uid]);
  res.json({
    marks, win: st.win, done: st.done, guesses: st.guesses,
    answer: st.done ? st.target : null, awarded, points: me.points, newAchievements: newAch,
  });
});

// ====================== КРЕСТИКИ-НОЛИКИ ======================
async function stagesDoneCount(uid) {
  const [[r]] = await pool.query('SELECT COUNT(*) c FROM stage_progress WHERE user_id=? AND done=1', [uid]);
  return r.c;
}
async function getGame(id) {
  const [[g]] = await pool.query('SELECT * FROM ttt_games WHERE id=?', [id]);
  return g || null;
}
async function gameView(g, uid) {
  let you = null;
  if (g.x_user === uid) you = 'X';
  else if (g.o_user === uid) you = 'O';
  // имена игроков
  const ids = [g.x_user, g.o_user].filter(Boolean);
  let names = {};
  if (ids.length) {
    const [rows] = await pool.query(`SELECT id, login FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    rows.forEach((r) => { names[r.id] = r.login; });
  }
  return {
    gameId: g.id, board: g.board, turn: g.turn, status: g.status, winner: g.winner,
    you, vsBot: g.vs_bot === 1,
    xName: g.x_user ? names[g.x_user] : null,
    oName: g.vs_bot ? 'Компьютер 🤖' : (g.o_user ? names[g.o_user] : null),
  };
}

// награды за завершённую партию (только победа игрока X засчитывает этап)
async function awardTtt(g) {
  const out = {};
  // Если игрок (X) победил — +100 очков и этап пройден
  if (g.winner === 'X' && g.x_user) {
    await addPoints(g.x_user, 100);
    await pool.query(
      `INSERT INTO stage_progress (user_id, stage, done, points, finished_at)
       VALUES (?, 'ttt', 1, ?, NOW())
       ON DUPLICATE KEY UPDATE done=1, finished_at=NOW()`,
      [g.x_user, 100]
    );
    out.x = await evalAchievements(g.x_user);
  }
  // Поражение или ничья — ничего не даём
  return out;
}

app.post('/api/ttt/find', requireAuth, async (req, res) => {
  const uid = req.user.id;
  if ((await stagesDoneCount(uid)) < 6) {
    return res.status(403).json({ error: 'Этап откроется после 6 пройденных этапов' });
  }
  // уже в активной игре?
  const [[active]] = await pool.query(
    "SELECT * FROM ttt_games WHERE (x_user=? OR o_user=?) AND status IN ('waiting','playing') ORDER BY id DESC LIMIT 1",
    [uid, uid]
  );
  if (active) return res.json(await gameView(active, uid));

  // ищем чужую ожидающую игру
  const [[wait]] = await pool.query(
    "SELECT * FROM ttt_games WHERE status='waiting' AND vs_bot=0 AND x_user IS NOT NULL AND x_user<>? AND o_user IS NULL ORDER BY id ASC LIMIT 1",
    [uid]
  );
  if (wait) {
    const [upd] = await pool.query(
      "UPDATE ttt_games SET o_user=?, status='playing' WHERE id=? AND status='waiting' AND o_user IS NULL",
      [uid, wait.id]
    );
    if (upd.affectedRows === 1) return res.json(await gameView(await getGame(wait.id), uid));
  }
  // создаём свою ожидающую игру
  const [r] = await pool.query(
    "INSERT INTO ttt_games (x_user, board, turn, status) VALUES (?, '.........','X','waiting')", [uid]
  );
  return res.json(await gameView(await getGame(r.insertId), uid));
});

app.post('/api/ttt/bot', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const id = Number(req.body.gameId);
  const [upd] = await pool.query(
    "UPDATE ttt_games SET vs_bot=1, status='playing' WHERE id=? AND x_user=? AND status='waiting'",
    [id, uid]
  );
  const g = await getGame(id);
  if (!g) return res.status(404).json({ error: 'Игра не найдена' });
  res.json(await gameView(g, uid));
});

app.get('/api/ttt/state', requireAuth, async (req, res) => {
  const g = await getGame(Number(req.query.gameId));
  if (!g) return res.status(404).json({ error: 'Игра не найдена' });
  res.json(await gameView(g, req.user.id));
});

app.post('/api/ttt/move', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const id = Number(req.body.gameId);
  const cell = Number(req.body.cell);
  let g = await getGame(id);
  if (!g) return res.status(404).json({ error: 'Игра не найдена' });
  if (g.status !== 'playing') return res.status(400).json({ error: 'Игра не идёт' });
  const you = g.x_user === uid ? 'X' : (g.o_user === uid ? 'O' : null);
  if (!you) return res.status(403).json({ error: 'Ты не в этой игре' });
  if (g.turn !== you) return res.status(400).json({ error: 'Сейчас не твой ход' });
  if (!(cell >= 0 && cell < 9) || g.board[cell] !== '.') return res.status(400).json({ error: 'Клетка занята' });

  let board = g.board.substring(0, cell) + you + g.board.substring(cell + 1);
  let turn = you === 'X' ? 'O' : 'X';
  let winner = checkWinner(board);

  // ход бота
  if (!winner && g.vs_bot === 1 && turn === 'O') {
    board = botMove(board, 'O');
    winner = checkWinner(board);
    turn = 'X';
  }

  const status = winner ? 'finished' : 'playing';
  await pool.query('UPDATE ttt_games SET board=?, turn=?, status=?, winner=? WHERE id=?',
    [board, turn, status, winner || null, id]);

  let achievements = {};
  if (status === 'finished') {
    const fg = await getGame(id);
    achievements = await awardTtt(fg);
  }
  const view = await gameView(await getGame(id), uid);
  view.newAchievements = (you === 'X' ? achievements.x : achievements.o) || [];
  const [[me]] = await pool.query('SELECT points FROM users WHERE id=?', [uid]);
  view.points = me.points;
  res.json(view);
});

// ====================== РЕЙТИНГ ======================
app.get('/api/leaderboard', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.login, u.points,
            (SELECT COUNT(*) FROM stage_progress sp WHERE sp.user_id=u.id AND sp.done=1) AS done
     FROM users u WHERE u.role='user'
     ORDER BY u.points DESC, u.id ASC LIMIT 50`
  );
  res.json({ leaderboard: rows, totalStages: TOTAL_STAGES });
});

// ====================== АДМИН-ДАШБОРД ======================
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [[players]] = await pool.query("SELECT COUNT(*) c FROM users WHERE role='user'");
  const [[online]] = await pool.query("SELECT COUNT(*) c FROM users WHERE role='user' AND last_seen > (NOW() - INTERVAL 35 SECOND)");
  const [board] = await pool.query(
    `SELECT u.login, u.points,
            (SELECT COUNT(*) FROM stage_progress sp WHERE sp.user_id=u.id AND sp.done=1) AS done
     FROM users u WHERE u.role='user' ORDER BY u.points DESC, u.id ASC LIMIT 12`
  );
  // по этапам: сколько прошли, сколько начали
  const [doneByStage] = await pool.query("SELECT stage, COUNT(*) c FROM stage_progress WHERE done=1 GROUP BY stage");
  const [startByStage] = await pool.query("SELECT stage, COUNT(DISTINCT user_id) c FROM answers GROUP BY stage");
  const doneMap = Object.fromEntries(doneByStage.map((r) => [r.stage, r.c]));
  const startMap = Object.fromEntries(startByStage.map((r) => [r.stage, r.c]));
  const perStage = STAGES.map((s) => ({
    key: s.key, title: s.title, icon: s.icon,
    done: doneMap[s.key] || 0, started: startMap[s.key] || 0,
  }));
  const [recent] = await pool.query(
    `SELECT a.code, u.login, a.created_at FROM achievements a JOIN users u ON u.id=a.user_id
     ORDER BY a.created_at DESC LIMIT 14`
  );
  const recentAch = recent.map((r) => ({ login: r.login, ...ACHIEVEMENTS[r.code] }));
  const [[ach]] = await pool.query('SELECT COUNT(*) c FROM achievements');
  res.json({
    players: players.c, online: online.c, totalStages: TOTAL_STAGES,
    leaderboard: board, perStage, recentAch, totalAchievements: ach.c,
  });
});

// ---------- страницы ----------
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
init()
  .then(() => app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`)))
  .catch((e) => { console.error('Не удалось запустить:', e); process.exit(1); });
