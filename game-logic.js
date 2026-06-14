// game-logic.js — крестики-нолики (бот) и достижения

// ---------- Крестики-нолики ----------
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // ряды
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // столбцы
  [0, 4, 8], [2, 4, 6],            // диагонали
];

// board — строка из 9 символов: '.', 'X', 'O'
function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] !== '.' && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  if (!board.includes('.')) return 'D'; // ничья
  return null;
}

function emptyCells(board) {
  const cells = [];
  for (let i = 0; i < 9; i++) if (board[i] === '.') cells.push(i);
  return cells;
}

function setCell(board, i, sym) {
  return board.substring(0, i) + sym + board.substring(i + 1);
}

// Минимакс — оптимальный ход
function minimax(board, me, current) {
  const w = checkWinner(board);
  if (w === me) return { score: 10 };
  if (w && w !== 'D') return { score: -10 };
  if (w === 'D') return { score: 0 };

  const opp = current === 'X' ? 'O' : 'X';
  let best = current === me ? { score: -Infinity } : { score: Infinity };
  for (const i of emptyCells(board)) {
    const res = minimax(setCell(board, i, current), me, opp);
    if (current === me) {
      if (res.score > best.score) best = { score: res.score, move: i };
    } else {
      if (res.score < best.score) best = { score: res.score, move: i };
    }
  }
  return best;
}

// Ход бота. botSym — символ бота. Делаем сильным, но не идеальным:
// в 30% случаев ходит случайно, чтобы школьники могли выигрывать.
function botMove(board, botSym) {
  const empties = emptyCells(board);
  if (empties.length === 0) return board;
  let cell;
  if (Math.random() < 0.30) {
    cell = empties[Math.floor(Math.random() * empties.length)];
  } else {
    cell = minimax(board, botSym, botSym).move;
    if (cell === undefined) cell = empties[0];
  }
  return setCell(board, cell, botSym);
}

// ---------- Достижения ----------
const ACHIEVEMENTS = {
  first_step: { icon: '🚀', title: 'Первый шаг', desc: 'Завершил первый этап' },
  on_fire: { icon: '🔥', title: 'В деле', desc: 'Завершил 3 этапа' },
  champion: { icon: '👑', title: 'Покоритель', desc: 'Завершил все этапы' },
  sniper: { icon: '🎯', title: 'Снайпер', desc: 'Прошёл этап без ошибок' },
  gamer: { icon: '🎮', title: 'Геймер', desc: '5 из 5 в «Угадай игру»' },
  word_master: { icon: '🟩', title: 'Угадал слово', desc: 'Разгадал IT-Wordle' },
  ttt_win: { icon: '⭕', title: 'Крестики: победа', desc: 'Выиграл партию' },
  beat_bot: { icon: '🤖', title: 'Обыграл компьютер', desc: 'Победил бота' },
  leader: { icon: '🏆', title: 'Лидер', desc: 'Был №1 в рейтинге' },
};

module.exports = { checkWinner, emptyCells, setCell, botMove, ACHIEVEMENTS };
