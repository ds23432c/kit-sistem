// Крестики-Нолики против компьютера 🤖
(function () {
  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  let board = Array(9).fill(null);
  let gameOver = false;
  let playerWins = 0;
  let botWins = 0;
  let draws = 0;

  const app = document.getElementById('app');

  function checkWinner(b) {
    for (const [a, c, d] of WIN_LINES) {
      if (b[a] && b[a] === b[c] && b[c] === b[d]) return b[a];
    }
    if (b.every((cell) => cell !== null)) return 'D';
    return null;
  }

  function emptyCells(b) {
    return b.map((v, i) => (v === null ? i : null)).filter((v) => v !== null);
  }

  function minimax(b, isMaximizing) {
    const w = checkWinner(b);
    if (w === 'O') return 10;
    if (w === 'X') return -10;
    if (w === 'D') return 0;

    const empties = emptyCells(b);
    if (isMaximizing) {
      let best = -Infinity;
      for (const i of empties) {
        b[i] = 'O';
        best = Math.max(best, minimax(b, false));
        b[i] = null;
      }
      return best;
    } else {
      let best = Infinity;
      for (const i of empties) {
        b[i] = 'X';
        best = Math.min(best, minimax(b, true));
        b[i] = null;
      }
      return best;
    }
  }

  function botMove(b) {
    const empties = emptyCells(b);
    if (empties.length === 0) return -1;

    // Add some imperfection: 20% random move so player can win sometimes
    if (Math.random() < 0.2) {
      return empties[Math.floor(Math.random() * empties.length)];
    }

    let bestScore = -Infinity;
    let bestMove = empties[0];
    for (const i of empties) {
      b[i] = 'O';
      const score = minimax(b, false);
      b[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
    return bestMove;
  }

  function render() {
    const w = checkWinner(board);
    let statusText = '';
    if (w === 'X') { statusText = '🎉 Ты победил!'; gameOver = true; }
    else if (w === 'O') { statusText = '🤖 Компьютер победил!'; gameOver = true; }
    else if (w === 'D') { statusText = '🤝 Ничья!'; gameOver = true; }
    else if (!gameOver) statusText = 'Твой ход (X)';

    app.innerHTML = `
      <div class="container">
        <div class="header">
          <h1>⭕ Крестики-Нолики</h1>
          <p class="subtitle">Игра против компьютера</p>
        </div>
        <div class="scoreboard">
          <div class="score"><span class="label">🧑 Ты (X)</span><span class="value blue">${playerWins}</span></div>
          <div class="score"><span class="label">🤖 ПК (O)</span><span class="value pink">${botWins}</span></div>
          <div class="score"><span class="label">🤝 Ничьи</span><span class="value gray">${draws}</span></div>
        </div>
        <div class="status">${statusText}</div>
        <div class="board">
          ${board.map((cell, i) => `
            <div class="cell" data-index="${i}">
              ${cell ? `<span class="${cell === 'X' ? 'x' : 'o'}">${cell}</span>` : ''}
            </div>
          `).join('')}
        </div>
        <button class="btn" id="resetBtn">🔄 Начать заново</button>
      </div>
    `;

    // Attach click handlers
    document.querySelectorAll('.cell').forEach((el) => {
      el.addEventListener('click', () => handleCellClick(parseInt(el.dataset.index)));
    });
    document.getElementById('resetBtn').addEventListener('click', resetGame);
  }

  function handleCellClick(index) {
    if (gameOver) return;
    if (board[index] !== null) return;

    // Player move
    board[index] = 'X';
    render();

    const w = checkWinner(board);
    if (w === 'X') { playerWins++; render(); return; }
    if (w === 'D') { draws++; render(); return; }

    // Bot move with slight delay
    gameOver = true; // prevent clicks during AI turn
    setTimeout(() => {
      const move = botMove(board);
      if (move >= 0) {
        board[move] = 'O';
        render();
        const w2 = checkWinner(board);
        if (w2 === 'O') { botWins++; render(); }
        else if (w2 === 'D') { draws++; render(); }
        else { gameOver = false; }
      } else {
        gameOver = false;
      }
    }, 300);
  }

  function resetGame() {
    board = Array(9).fill(null);
    gameOver = false;
    render();
  }

  render();
})();
