// admin.js — живой дашборд ведущего
const Root = document.getElementById('root');
const $ = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let built = false;

async function tick() {
  let d;
  try {
    const res = await fetch('/api/admin/stats', { credentials: 'include' });
    if (res.status === 403 || res.status === 401) {
      Root.innerHTML = `<div class="panel center" style="max-width:520px;margin:40px auto">
        <h2>Нужен вход администратора</h2>
        <p class="muted">Открой приложение, войди под админ-аккаунтом (по умолчанию <b>admin / admin1234</b>),
        затем вернись на этот экран.</p>
        <a class="btn primary big" href="/">Войти →</a></div>`;
      clearInterval(timer);
      return;
    }
    d = await res.json();
  } catch (e) { return; }
  build();
  fill(d);
}

function build() {
  if (built) return;
  Root.innerHTML = '';
  Root.appendChild($(`<div class="kpis">
    <div class="kpi online"><div class="v" id="kOnline">0</div><div class="l">🟢 Сейчас онлайн</div></div>
    <div class="kpi players"><div class="v" id="kPlayers">0</div><div class="l">👥 Всего участников</div></div>
    <div class="kpi points"><div class="v" id="kTop">0</div><div class="l">⭐ Очков у лидера</div></div>
    <div class="kpi ach"><div class="v" id="kAch">0</div><div class="l">🏅 Достижений открыто</div></div>
  </div>`));
  Root.appendChild($(`<div class="cols">
    <div class="panel"><h2>🏆 Живой рейтинг</h2><div id="lb"></div></div>
    <div>
      <div class="panel" style="margin-bottom:18px"><h2>📊 Прогресс по этапам</h2><div id="stages"></div></div>
      <div class="panel"><h2>✨ Последние достижения</h2><div class="ticker" id="ticker"></div></div>
    </div>
  </div>`));
  built = true;
}

function fill(d) {
  document.getElementById('kOnline').textContent = d.online;
  document.getElementById('kPlayers').textContent = d.players;
  document.getElementById('kTop').textContent = d.leaderboard[0] ? d.leaderboard[0].points : 0;
  document.getElementById('kAch').textContent = d.totalAchievements;

  // рейтинг
  const lb = document.getElementById('lb');
  lb.innerHTML = '';
  if (!d.leaderboard.length) lb.appendChild($(`<div class="empty">Пока нет участников. Дай ребятам ссылку и старт! 🚀</div>`));
  d.leaderboard.forEach((u, i) => {
    const r = i + 1;
    const medal = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r;
    lb.appendChild($(`<div class="lb-row ${r <= 3 ? 'top' + r : ''}">
      <div class="pos">${medal}</div>
      <div class="nm">${esc(u.login)}<br><small>пройдено ${u.done}/${d.totalStages}</small></div>
      <div class="pt">${u.points}</div></div>`));
  });

  // этапы
  const st = document.getElementById('stages');
  st.innerHTML = '';
  const max = Math.max(d.players, 1);
  d.perStage.forEach((s) => {
    const pct = Math.round((s.done / max) * 100);
    st.appendChild($(`<div class="stage-row">
      <div class="top"><b>${s.icon} ${esc(s.title)}</b><span class="muted">${s.done} прошли · ${s.started} начали</span></div>
      <div class="pbar"><i style="width:${pct}%"></i></div></div>`));
  });

  // достижения-лента
  const tk = document.getElementById('ticker');
  tk.innerHTML = '';
  if (!d.recentAch.length) tk.appendChild($(`<div class="empty">Достижения появятся здесь по ходу игры</div>`));
  d.recentAch.forEach((a) => {
    tk.appendChild($(`<div class="tk"><div class="e">${a.icon || '🏅'}</div>
      <div class="x"><b>${esc(a.login)}</b> получил «${esc(a.title)}»</div></div>`));
  });
}

const timer = setInterval(tick, 1500);
tick();
