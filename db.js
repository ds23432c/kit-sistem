// db.js — подключение к MySQL (Railway) и инициализация схемы
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

function buildConfig() {
  // Railway даёт MYSQL_URL / DATABASE_URL (mysql://user:pass@host:port/db)
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL;
  if (url) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname,
        port: Number(u.port || 3306),
        user: decodeURIComponent(u.username || 'root'),
        password: decodeURIComponent(u.password || ''),
        database: (u.pathname || '/railway').replace(/^\//, '') || 'railway',
      };
    } catch (e) {
      console.error('Не удалось разобрать URL базы:', e.message);
    }
  }
  // Иначе — отдельные переменные Railway
  return {
    host: process.env.MYSQLHOST || process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
  };
}

const cfg = buildConfig();
const pool = mysql.createPool({
  ...cfg,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  multipleStatements: false,
});

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    login VARCHAR(64) NOT NULL UNIQUE,
    pass_hash VARCHAR(255) NOT NULL,
    role ENUM('user','admin') NOT NULL DEFAULT 'user',
    points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stage VARCHAR(32) NOT NULL,
    qid VARCHAR(40) NOT NULL,
    correct TINYINT NOT NULL DEFAULT 0,
    points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_answer (user_id, stage, qid)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS stage_progress (
    user_id INT NOT NULL,
    stage VARCHAR(32) NOT NULL,
    done TINYINT NOT NULL DEFAULT 0,
    points INT NOT NULL DEFAULT 0,
    state LONGTEXT NULL,
    finished_at TIMESTAMP NULL,
    PRIMARY KEY (user_id, stage)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS achievements (
    user_id INT NOT NULL,
    code VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ttt_games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    x_user INT NULL,
    o_user INT NULL,
    board VARCHAR(9) NOT NULL DEFAULT '.........',
    turn CHAR(1) NOT NULL DEFAULT 'X',
    status ENUM('waiting','playing','finished') NOT NULL DEFAULT 'waiting',
    winner CHAR(1) NULL,
    vs_bot TINYINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function init() {
  // Ждём, пока база поднимется (на Railway сервис может стартовать раньше БД)
  let lastErr;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      break;
    } catch (e) {
      lastErr = e;
      console.log(`Жду базу данных... попытка ${attempt}/15 (${e.code || e.message})`);
      await new Promise((r) => setTimeout(r, 2000));
      if (attempt === 15) throw lastErr;
    }
  }
  for (const sql of SCHEMA) {
    await pool.query(sql);
  }
  await seedAdmin();
  console.log(`База готова: ${cfg.host}:${cfg.port}/${cfg.database}`);
}

async function seedAdmin() {
  const login = process.env.ADMIN_LOGIN || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin1234';
  const [rows] = await pool.query('SELECT id FROM users WHERE login=?', [login]);
  if (rows.length === 0) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (login, pass_hash, role) VALUES (?,?,?)', [login, hash, 'admin']);
    console.log(`Создан администратор: логин "${login}" / пароль "${password}" (поменяй в переменных ADMIN_LOGIN/ADMIN_PASSWORD)`);
  }
}

module.exports = { pool, init };
