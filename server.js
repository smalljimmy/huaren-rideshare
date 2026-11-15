// 华人顺风车 v1 — Node + Express + better-sqlite3，服务端渲染，无构建步骤
process.env.TZ = process.env.TZ || 'America/Los_Angeles';

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const { initDb, todayStr } = require('./lib/db');
const v = require('./lib/views');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SITE_URL = process.env.SITE_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN
    : 'https://rideshare-production-4c51.up.railway.app');
const db = initDb();

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 3600 * 1000 },
}));

const cleanPhone = (s) => String(s || '').replace(/\D/g, '');
const validPhone = (s) => { const p = cleanPhone(s); return (p.length >= 7 && p.length <= 15) ? p : null; };

// ---------- 访问量统计：每个页面浏览记一行（uid 访客去重靠 cookie） ----------
const getUid = (req) => {
  const m = /(?:^|;\s*)rs_uid=([0-9a-f]{32})/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
};
app.use((req, res, next) => {
  let uid = getUid(req);
  if (!uid) {
    uid = crypto.randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', `rs_uid=${uid}; Path=/; Max-Age=${365 * 24 * 3600}; SameSite=Lax`);
  }
  req.uid = uid;
  if (req.method === 'GET' && !/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/i.test(req.path)
    && req.path !== '/favicon.ico') {
    try { db.prepare('INSERT INTO visits (date, uid, path) VALUES (?,?,?)').run(todayStr(), uid, req.path.slice(0, 120)); } catch (e) { /* 统计失败不影响页面 */ }
  }
  next();
});

function tripRow(id) {
  return db.prepare(`SELECT t.*, d.name AS driver_name, d.wechat, d.car_model, d.car_color, d.plate, d.intro AS driver_intro
    FROM trips t JOIN drivers d ON d.id = t.driver_id WHERE t.id = ?`).get(id);
}
function upcomingTrips(from, to, date) {
  let sql = `SELECT t.*, d.name AS driver_name, d.car_model FROM trips t
    JOIN drivers d ON d.id = t.driver_id
    WHERE t.status = 'open' AND t.depart_date >= ?`;
  const args = [todayStr()];
  if (from) { sql += ' AND t.from_city LIKE ?'; args.push(`%${from}%`); }
  if (to) { sql += ' AND t.to_city LIKE ?'; args.push(`%${to}%`); }
  if (date) { sql += ' AND t.depart_date = ?'; args.push(date); }
  sql += ' ORDER BY t.depart_date, t.depart_time LIMIT 100';
  return db.prepare(sql).all(...args);
}
function pastTrips(from, to) {
  let sql = `SELECT t.*, d.name AS driver_name, d.car_model FROM trips t
    JOIN drivers d ON d.id = t.driver_id
    WHERE t.status != 'cancelled' AND t.depart_date < ?`;
  const args = [todayStr()];
  if (from) { sql += ' AND t.from_city LIKE ?'; args.push(`%${from}%`); }
  if (to) { sql += ' AND t.to_city LIKE ?'; args.push(`%${to}%`); }
  sql += ' ORDER BY t.depart_date DESC, t.depart_time DESC LIMIT 50';
  return db.prepare(sql).all(...args);
}
const openRequests = () => db.prepare(
  `SELECT * FROM ride_requests WHERE status = 'open' ORDER BY depart_date, depart_time LIMIT 100`).all();
const requestRow = (id) => db.prepare(
  `SELECT r.*, d.name AS driver_name FROM ride_requests r
   LEFT JOIN drivers d ON d.id = r.driver_id WHERE r.id = ?`).get(id);
const needDriver = (req, res, next) => {
  if (!req.session.driverId) return res.redirect('/driver/login');
  const d = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.session.driverId);
  if (!d || d.status !== 'active') { req.session.driverId = null; return res.redirect('/driver/login'); }
  req.driver = d; next();
};

// ---------- 乘客端 ----------
app.get('/', (req, res) => {
  const { from, to, date } = req.query;
  res.send(v.home(upcomingTrips(from, to, date), pastTrips(from, to), { from, to, date }, SITE_URL));
});

app.get('/trip/:id', (req, res) => {
  const t = tripRow(req.params.id);
  if (!t || t.status === 'cancelled') return res.status(404).send(v.layout('未找到', '<p class="empty">行程不存在或已取消</p>'));
  const past = t.depart_date < todayStr();
  res.send(v.tripDetail(t, past ? '这趟行程已过期，不可预订' : null, { past, siteUrl: SITE_URL }));
});

app.post('/trip/:id/book', (req, res) => {
  const t = tripRow(req.params.id);
  if (!t || t.status !== 'open') return res.status(400).send(v.layout('失败', '<p class="empty">行程不可预订</p>'));
  if (t.depart_date < todayStr()) return res.status(400).send(v.tripDetail(t, '这趟行程已过期，不可预订', { past: true, siteUrl: SITE_URL }));
  const name = String(req.body.rider_name || '').trim().slice(0, 20);
  const phone = validPhone(req.body.rider_phone);
  const seats = Math.max(1, Math.min(8, parseInt(req.body.seats, 10) || 1));
  const note = String(req.body.note || '').trim().slice(0, 80);
  const left = t.seats_total - t.seats_taken;
  if (!name || !phone) return res.status(400).send(v.tripDetail(t, '请填写姓名和有效手机号'));
  if (seats > left) return res.status(400).send(v.tripDetail(t, `只剩 ${left} 个座位`));
  try {
    db.transaction(() => {
      db.prepare('INSERT INTO bookings (trip_id, rider_name, rider_phone, seats, note) VALUES (?,?,?,?,?)')
        .run(t.id, name, phone, seats, note);
      db.prepare('UPDATE trips SET seats_taken = seats_taken + ? WHERE id = ?').run(seats, t.id);
    })();
  } catch (e) { return res.status(500).send(v.layout('失败', '<p class="empty">预订失败，请重试</p>')); }
  const b = { rider_name: name, rider_phone: phone, seats };
  res.send(v.bookOk(b, t));
});

app.get('/my', (req, res) => {
  const phone = validPhone(req.query.phone);
  const rows = phone ? db.prepare(`SELECT b.*, t.from_city, t.to_city, t.depart_date, t.depart_time, d.name AS driver_name
    FROM bookings b JOIN trips t ON t.id = b.trip_id JOIN drivers d ON d.id = t.driver_id
    WHERE b.rider_phone = ? ORDER BY b.id DESC`).all(phone) : [];
  const reqs = phone ? db.prepare(
    `SELECT r.*, d.name AS driver_name FROM ride_requests r
     LEFT JOIN drivers d ON d.id = r.driver_id
     WHERE r.rider_phone = ? ORDER BY r.id DESC`).all(phone) : [];
  res.send(v.myPage(req.query.phone || '', rows, reqs));
});

app.post('/booking/:id/cancel', (req, res) => {
  const phone = validPhone(req.body.phone);
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b || b.status !== 'confirmed' || b.rider_phone !== phone)
    return res.status(400).send(v.layout('失败', '<p class="empty">取消失败</p>'));
  db.transaction(() => {
    db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(b.id);
    db.prepare('UPDATE trips SET seats_taken = seats_taken - ? WHERE id = ?').run(b.seats, b.trip_id);
  })();
  res.redirect('/my?phone=' + encodeURIComponent(phone));
});

// ---------- 乘客求车 ----------
app.get('/requests', (req, res) => res.send(v.requestList(openRequests())));

app.get('/request/new', (req, res) => res.send(v.requestForm('', {})));
app.post('/request/new', (req, res) => {
  const b = req.body;
  const from = String(b.from_city || '').trim().slice(0, 20);
  const to = String(b.to_city || '').trim().slice(0, 20);
  const date = String(b.depart_date || '');
  const time = String(b.depart_time || '');
  const seats = Math.max(1, Math.min(8, parseInt(b.seats, 10) || 0));
  const name = String(b.rider_name || '').trim().slice(0, 20);
  const phone = validPhone(b.rider_phone);
  if (!from || !to || !date || !time || !seats || !name || !phone || date < todayStr())
    return res.send(v.requestForm('请完整填写，出发日期不能是过去', b));
  const id = db.prepare(`INSERT INTO ride_requests
    (rider_name, rider_phone, wechat, from_city, to_city, depart_date, depart_time, seats, note)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(name, phone,
    String(b.wechat || '').slice(0, 30), from, to, date, time, seats,
    String(b.note || '').slice(0, 140)).lastInsertRowid;
  res.redirect('/request/' + id + '?ok=1');
});

app.get('/request/:id', (req, res) => {
  const r = requestRow(req.params.id);
  if (!r) return res.status(404).send(v.layout('未找到', '<p class="empty">求车需求不存在</p>'));
  res.send(v.requestDetail(r, req.query.ok ? '发布成功，司机看到后会通过微信联系你。' : null));
});

app.post('/request/:id/claim', needDriver, (req, res) => {
  const r = requestRow(req.params.id);
  if (!r || r.status !== 'open') return res.redirect('/driver');
  db.prepare("UPDATE ride_requests SET status = 'matched', driver_id = ? WHERE id = ? AND status = 'open'")
    .run(req.driver.id, r.id);
  res.redirect('/driver');
});

app.post('/request/:id/cancel', (req, res) => {
  const phone = validPhone(req.body.phone);
  const r = requestRow(req.params.id);
  if (!r || r.status !== 'open' || r.rider_phone !== phone)
    return res.status(400).send(v.layout('失败', '<p class="empty">取消失败</p>'));
  db.prepare("UPDATE ride_requests SET status = 'cancelled' WHERE id = ?").run(r.id);
  res.redirect('/my?phone=' + encodeURIComponent(phone));
});

// ---------- 司机端 ----------
app.get('/driver/register', (req, res) => res.send(v.driverRegister('')));
app.post('/driver/register', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 20);
  const phone = validPhone(req.body.phone);
  const pw = String(req.body.password || '');
  if (!name || !phone || pw.length < 6) return res.send(v.driverRegister('请填写姓名、有效手机号，密码至少 6 位'));
  if (db.prepare('SELECT 1 FROM drivers WHERE phone = ?').get(phone))
    return res.send(v.driverRegister('该手机号已注册，请直接登录'));
  const id = db.prepare(`INSERT INTO drivers (name, phone, password_hash, wechat, car_model, car_color, plate, intro)
    VALUES (?,?,?,?,?,?,?,?)`).run(name, phone, bcrypt.hashSync(pw, 10),
    String(req.body.wechat || '').slice(0, 30), String(req.body.car_model || '').slice(0, 30),
    String(req.body.car_color || '').slice(0, 10), String(req.body.plate || '').slice(0, 12),
    String(req.body.intro || '').slice(0, 120)).lastInsertRowid;
  req.session.driverId = id;
  res.redirect('/driver');
});

app.get('/driver/login', (req, res) => res.send(v.driverLogin('')));
app.post('/driver/login', (req, res) => {
  const phone = validPhone(req.body.phone);
  const d = phone && db.prepare('SELECT * FROM drivers WHERE phone = ?').get(phone);
  if (!d || !bcrypt.compareSync(String(req.body.password || ''), d.password_hash))
    return res.send(v.driverLogin('手机号或密码不对'));
  req.session.driverId = d.id;
  res.redirect('/driver');
});
app.get('/driver/logout', (req, res) => { req.session.driverId = null; res.redirect('/'); });

app.get('/driver', needDriver, (req, res) => {
  const trips = db.prepare('SELECT * FROM trips WHERE driver_id = ? ORDER BY depart_date DESC, id DESC')
    .all(req.driver.id);
  const matched = db.prepare(
    `SELECT * FROM ride_requests WHERE driver_id = ? AND status = 'matched' ORDER BY depart_date, depart_time`)
    .all(req.driver.id);
  res.send(v.driverDash(req.driver, trips, openRequests(), matched, todayStr()));
});

app.get('/driver/trip/new', needDriver, (req, res) => res.send(v.tripForm(req.driver)));
app.post('/driver/trip/new', needDriver, (req, res) => {
  const b = req.body;
  const from = String(b.from_city || '').trim().slice(0, 20);
  const to = String(b.to_city || '').trim().slice(0, 20);
  const date = String(b.depart_date || '');
  const time = String(b.depart_time || '');
  const seats = Math.max(1, Math.min(8, parseInt(b.seats_total, 10) || 0));
  const price = Math.max(0, parseFloat(b.price));
  if (!from || !to || !date || !time || !seats || isNaN(price) || date < todayStr())
    return res.send(v.tripForm(req.driver, b, '请完整填写，出发日期不能是过去'));
  db.prepare(`INSERT INTO trips (driver_id, from_city, to_city, depart_date, depart_time, seats_total, price, note)
    VALUES (?,?,?,?,?,?,?,?)`).run(req.driver.id, from, to, date, time, seats, price,
    String(b.note || '').slice(0, 140));
  res.redirect('/driver');
});

app.get('/driver/trip/:id', needDriver, (req, res) => {
  const t = db.prepare('SELECT * FROM trips WHERE id = ? AND driver_id = ?').get(req.params.id, req.driver.id);
  if (!t) return res.status(404).send(v.layout('未找到', '<p class="empty">行程不存在</p>', { driver: true }));
  const rows = db.prepare("SELECT * FROM bookings WHERE trip_id = ? AND status = 'confirmed' ORDER BY id")
    .all(t.id);
  res.send(v.tripBookings(t, rows));
});

app.get('/driver/trip/:id/edit', needDriver, (req, res) => {
  const t = db.prepare('SELECT * FROM trips WHERE id = ? AND driver_id = ?').get(req.params.id, req.driver.id);
  if (!t || t.status !== 'open') return res.redirect('/driver');
  res.send(v.tripForm(req.driver, t));
});
app.post('/driver/trip/:id/edit', needDriver, (req, res) => {
  const t = db.prepare('SELECT * FROM trips WHERE id = ? AND driver_id = ?').get(req.params.id, req.driver.id);
  if (!t || t.status !== 'open') return res.redirect('/driver');
  const b = req.body;
  const seats = Math.max(t.seats_taken, Math.min(8, parseInt(b.seats_total, 10) || t.seats_total));
  const price = Math.max(0, parseFloat(b.price));
  if (isNaN(price)) return res.send(v.tripForm(req.driver, { ...t, ...b }, '价格不对'));
  db.prepare(`UPDATE trips SET from_city=?, to_city=?, depart_date=?, depart_time=?, seats_total=?, price=?, note=?
    WHERE id=?`).run(String(b.from_city || t.from_city).slice(0, 20), String(b.to_city || t.to_city).slice(0, 20),
    b.depart_date || t.depart_date, b.depart_time || t.depart_time, seats, price,
    String(b.note || '').slice(0, 140), t.id);
  res.redirect('/driver');
});
app.post('/driver/trip/:id/cancel', needDriver, (req, res) => {
  db.prepare("UPDATE trips SET status = 'cancelled' WHERE id = ? AND driver_id = ?")
    .run(req.params.id, req.driver.id);
  res.redirect('/driver');
});

// ---------- 入驻 & 后台 ----------
app.get('/join', (req, res) => res.send(v.join()));

app.get('/admin', (req, res) => {
  if (req.session.admin) {
    const today = todayStr();
    const s = {
      drivers: db.prepare('SELECT COUNT(*) c FROM drivers').get().c,
      trips: db.prepare("SELECT COUNT(*) c FROM trips WHERE status = 'open'").get().c,
      bookings: db.prepare("SELECT COUNT(*) c FROM bookings WHERE status = 'confirmed'").get().c,
      gmv: db.prepare(`SELECT COALESCE(SUM(b.seats * t.price), 0) g FROM bookings b
        JOIN trips t ON t.id = b.trip_id WHERE b.status = 'confirmed'`).get().g,
      reqOpen: db.prepare("SELECT COUNT(*) c FROM ride_requests WHERE status = 'open'").get().c,
      reqMatched: db.prepare("SELECT COUNT(*) c FROM ride_requests WHERE status = 'matched'").get().c,
    };
    const recent = db.prepare(`SELECT b.*, t.from_city, t.to_city FROM bookings b
      JOIN trips t ON t.id = b.trip_id ORDER BY b.id DESC LIMIT 30`).all();
    const visits = {
      todayVisits: db.prepare('SELECT COUNT(*) c FROM visits WHERE date = ?').get(today).c,
      todayVisitors: db.prepare('SELECT COUNT(DISTINCT uid) c FROM visits WHERE date = ?').get(today).c,
      week: db.prepare(`SELECT date, COUNT(*) visits, COUNT(DISTINCT uid) visitors FROM visits
        WHERE date >= date(?, '-6 days') GROUP BY date ORDER BY date DESC`).all(today),
      hot: db.prepare(`SELECT path, COUNT(*) c FROM visits
        WHERE date >= date(?, '-6 days') GROUP BY path ORDER BY c DESC LIMIT 10`).all(today),
    };
    return res.send(v.adminDash(s, recent, visits));
  }
  res.send(v.adminLogin(''));
});
app.post('/admin', (req, res) => {
  if (String(req.body.password || '') === ADMIN_PASSWORD) { req.session.admin = true; return res.redirect('/admin'); }
  res.send(v.adminLogin('密码不对'));
});

app.listen(PORT, () => console.log(`华人顺风车 running on :${PORT}`));
