// 华人顺风车 — 数据层：drivers（司机）、trips（行程）、bookings（预订）
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'rideshare.db');

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      wechat TEXT,
      car_model TEXT,
      car_color TEXT,
      plate TEXT,
      intro TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL REFERENCES drivers(id),
      from_city TEXT NOT NULL,
      to_city TEXT NOT NULL,
      depart_date TEXT NOT NULL,
      depart_time TEXT NOT NULL,
      seats_total INTEGER NOT NULL,
      seats_taken INTEGER NOT NULL DEFAULT 0,
      price REAL NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id),
      rider_name TEXT NOT NULL,
      rider_phone TEXT NOT NULL,
      seats INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  const n = db.prepare('SELECT COUNT(*) c FROM drivers').get().c;
  if (n === 0) seed(db);
  return db;
}

function seed(db) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('demo1234', 10);
  const addDriver = db.prepare(
    `INSERT INTO drivers (name, phone, password_hash, wechat, car_model, car_color, plate, intro)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const d1 = addDriver.run('老李', '4255550111', hash, 'laoli_seattle', 'Toyota Sienna', '深灰', 'BXY1234', '西雅图-温哥华专线，五年驾龄，准时靠谱').lastInsertRowid;
  const d2 = addDriver.run('陈姐', '4255550222', hash, 'chenjie_pdx', 'Honda Odyssey', '白色', 'CDZ5678', '机场接送+波特兰线，车里有儿童座椅').lastInsertRowid;

  const addTrip = db.prepare(
    `INSERT INTO trips (driver_id, from_city, to_city, depart_date, depart_time, seats_total, price, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const dates = [0, 1, 2].map((o) => {
    const d = new Date();
    d.setDate(d.getDate() + o + 1);
    return d.toISOString().slice(0, 10);
  });
  addTrip.run(d1, '西雅图', '温哥华', dates[0], '09:00', 6, 35, 'Bellevue/西雅图市区可上车，过境带好证件');
  addTrip.run(d1, '温哥华', '西雅图', dates[0], '16:00', 6, 35, '列治文 Aberdeen 集合');
  addTrip.run(d2, '西雅图', '波特兰', dates[1], '10:30', 4, 45, '可带大件行李，提前说');
  addTrip.run(d2, 'Bellevue', 'SEA 机场', dates[2], '06:30', 3, 25, '赶早班机，准时出发不等人');
}

function resetDb() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  initDb();
  console.log('db reset:', DB_PATH);
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

module.exports = { initDb, resetDb, todayStr, DB_PATH };
