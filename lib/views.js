// 华人顺风车 — 服务端模板
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function layout(title, body, opts = {}) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · 华人顺风车</title>
<link rel="stylesheet" href="/style.css"></head>
<body>
<header class="top"><a class="brand" href="/">🚗 华人顺风车</a>
<nav>${opts.driver ? `<a href="/driver">司机中心</a>` : `<a href="/driver/login">司机登录</a>`}<a href="/join">成为司机</a><a href="/my">我的预订</a></nav></header>
<main>${body}</main>
<footer>推广期间平台 0 抽成 · 拼车有风险，请自行核实司机信息</footer>
</body></html>`;
}

const POPULAR = [
  ['西雅图', '温哥华'], ['温哥华', '西雅图'],
  ['西雅图', '波特兰'], ['Bellevue', 'SEA 机场'],
];

function home(trips, q) {
  const cards = trips.map((t) => {
    const left = t.seats_total - t.seats_taken;
    return `<a class="card" href="/trip/${t.id}">
      <div class="route">${esc(t.from_city)} <span class="arrow">→</span> ${esc(t.to_city)}</div>
      <div class="meta">📅 ${esc(t.depart_date)} ${esc(t.depart_time)} · 👤 ${esc(t.driver_name)} · 🚙 ${esc(t.car_model || '—')}</div>
      <div class="meta">${t.note ? '📝 ' + esc(t.note.slice(0, 40)) : ''}</div>
      <div class="row"><span class="price">$${esc(t.price)}/位</span>
      <span class="seats">${left > 0 ? `还剩 ${left} 位` : '已满'}</span></div>
    </a>`;
  }).join('') || '<p class="empty">这段时间没有行程，换个日期试试～</p>';

  const pops = POPULAR.map(([a, b]) =>
    `<a class="chip" href="/?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}">${esc(a)}→${esc(b)}</a>`).join('');

  return layout('首页', `
    <section class="hero"><h1>北美华人跨城拼车</h1>
    <p>司机发布行程 · 乘客按座预订 · 中文沟通 · 微信直联</p></section>
    <form class="search" method="get" action="/">
      <input name="from" placeholder="出发地" value="${esc(q.from || '')}">
      <input name="to" placeholder="目的地" value="${esc(q.to || '')}">
      <input name="date" type="date" value="${esc(q.date || '')}">
      <button type="submit">搜行程</button>
    </form>
    <div class="chips">${pops}</div>
    <h2>近期行程</h2><div class="list">${cards}</div>
    <div class="cta"><a class="btn" href="/join">我是司机，免费发布行程 →</a></div>
  `);
}

function tripDetail(t, msg) {
  const left = t.seats_total - t.seats_taken;
  return layout(`${t.from_city}→${t.to_city}`, `
    <a class="back" href="/">← 返回</a>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
    <div class="detail">
      <h1>${esc(t.from_city)} <span class="arrow">→</span> ${esc(t.to_city)}</h1>
      <p>📅 ${esc(t.depart_date)} ${esc(t.depart_time)}</p>
      <p>👤 司机：${esc(t.driver_name)}${t.wechat ? `（微信 ${esc(t.wechat)}）` : ''}</p>
      <p>🚙 ${esc(t.car_model || '')} ${esc(t.car_color || '')} ${t.plate ? '· 车牌 ' + esc(t.plate) : ''}</p>
      <p>💺 ${t.seats_taken}/${t.seats_total} 已订 · <b>还剩 ${left} 位</b> · <span class="price">$${esc(t.price)}/位</span></p>
      ${t.note ? `<p>📝 ${esc(t.note)}</p>` : ''}
      ${t.driver_intro ? `<p class="intro">司机介绍：${esc(t.driver_intro)}</p>` : ''}
      ${left > 0 ? `
      <h2>预订座位</h2>
      <form method="post" action="/trip/${t.id}/book" class="form">
        <label>姓名<input name="rider_name" required maxlength="20"></label>
        <label>手机号<input name="rider_phone" required inputmode="tel" placeholder="司机将通过此号码联系你"></label>
        <label>座位数<select name="seats">${Array.from({ length: left }, (_, i) =>
          `<option value="${i + 1}">${i + 1} 位</option>`).join('')}</select></label>
        <label>备注（可选）<input name="note" maxlength="80" placeholder="如：带大件行李/带小孩"></label>
        <button class="btn" type="submit">确认预订（到车上再付款）</button>
      </form>` : '<p class="full">本车已满员</p>'}
    </div>`);
}

function bookOk(b, t) {
  return layout('预订成功', `<div class="ok">
    <h1>✅ 预订成功</h1>
    <p>${esc(t.from_city)} → ${esc(t.to_city)} · ${esc(t.depart_date)} ${esc(t.depart_time)}</p>
    <p>预订人：${esc(b.rider_name)} · ${esc(b.seats)} 位</p>
    <p>司机 ${esc(t.driver_name)} 会通过 <b>${esc(b.rider_phone)}</b> 联系你确认上车点。</p>
    <p class="hint">费用 $${esc(t.price)}/位，上车时直接付给司机（平台推广期不抽成）。</p>
    <a class="btn" href="/my?phone=${encodeURIComponent(b.rider_phone)}">查看我的预订</a>
  </div>`);
}

function myPage(phone, rows) {
  const list = rows.map((r) => `<div class="card">
      <div class="route">${esc(r.from_city)} <span class="arrow">→</span> ${esc(r.to_city)}</div>
      <div class="meta">📅 ${esc(r.depart_date)} ${esc(r.depart_time)} · ${esc(r.seats)} 位 · 司机 ${esc(r.driver_name)}</div>
      ${r.status === 'confirmed' ? `<form method="post" action="/booking/${r.id}/cancel" onsubmit="return confirm('确定取消这个预订吗？')">
        <input type="hidden" name="phone" value="${esc(phone)}"><button class="linkbtn" type="submit">取消预订</button></form>`
    : `<span class="tag">已取消</span>`}
    </div>`).join('') || (phone ? '<p class="empty">没有找到预订记录</p>' : '');
  return layout('我的预订', `
    <h1>我的预订</h1>
    <form class="search" method="get" action="/my">
      <input name="phone" placeholder="预订时留的手机号" value="${esc(phone || '')}" inputmode="tel">
      <button type="submit">查询</button>
    </form><div class="list">${list}</div>`);
}

function driverLogin(msg) {
  return layout('司机登录', `<h1>司机登录</h1>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
    <form method="post" action="/driver/login" class="form">
      <label>手机号<input name="phone" required inputmode="tel"></label>
      <label>密码<input name="password" type="password" required></label>
      <button class="btn" type="submit">登录</button>
    </form><p>还没有账号？<a href="/driver/register">注册成为司机</a></p>`);
}

function driverRegister(msg) {
  return layout('司机注册', `<h1>免费成为司机</h1>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
    <form method="post" action="/driver/register" class="form">
      <label>姓名<input name="name" required maxlength="20"></label>
      <label>手机号<input name="phone" required inputmode="tel"></label>
      <label>密码<input name="password" type="password" required minlength="6"></label>
      <label>微信号<input name="wechat" maxlength="30"></label>
      <label>车型<input name="car_model" maxlength="30" placeholder="如 Toyota Sienna"></label>
      <label>车身颜色<input name="car_color" maxlength="10"></label>
      <label>车牌<input name="plate" maxlength="12"></label>
      <label>自我介绍<input name="intro" maxlength="120" placeholder="如：西雅图-温哥华专线，五年驾龄"></label>
      <button class="btn" type="submit">注册并登录</button>
    </form>`);
}

function driverDash(d, trips) {
  const rows = trips.map((t) => {
    const left = t.seats_total - t.seats_taken;
    return `<div class="card">
      <div class="route">${esc(t.from_city)} <span class="arrow">→</span> ${esc(t.to_city)}</div>
      <div class="meta">📅 ${esc(t.depart_date)} ${esc(t.depart_time)} · $${esc(t.price)}/位 ·
        ${t.seats_taken}/${t.seats_total} 已订${t.status === 'cancelled' ? ' · <span class="tag">已取消</span>' : ''}</div>
      <div class="actions">
        <a href="/driver/trip/${t.id}">查看预订 (${t.seats_taken})</a>
        ${t.status === 'open' ? `<a href="/driver/trip/${t.id}/edit">修改行程</a>
        <form style="display:inline" method="post" action="/driver/trip/${t.id}/cancel" onsubmit="return confirm('确定取消这趟行程吗？已预订的乘客会看到取消状态。')">
          <button class="linkbtn" type="submit">取消行程</button></form>` : ''}
      </div></div>`;
  }).join('') || '<p class="empty">还没有发布行程</p>';
  return layout('司机中心', `<h1>你好，${esc(d.name)} 👋</h1>
    <div class="actions"><a class="btn" href="/driver/trip/new">＋ 发布新行程</a>
    <a class="btn ghost" href="/driver/logout">退出登录</a></div>
    <h2>我的行程</h2><div class="list">${rows}</div>`, { driver: true });
}

function tripForm(d, t = {}, msg) {
  const isEdit = !!t.id;
  return layout(isEdit ? '修改行程' : '发布行程', `
    <h1>${isEdit ? '修改行程' : '发布新行程'}</h1>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
    <form method="post" action="${isEdit ? `/driver/trip/${t.id}/edit` : '/driver/trip/new'}" class="form">
      <label>出发地<input name="from_city" required maxlength="20" value="${esc(t.from_city || '')}" placeholder="如 西雅图"></label>
      <label>目的地<input name="to_city" required maxlength="20" value="${esc(t.to_city || '')}" placeholder="如 温哥华"></label>
      <label>出发日期<input name="depart_date" type="date" required value="${esc(t.depart_date || '')}"></label>
      <label>出发时间<input name="depart_time" type="time" required value="${esc(t.depart_time || '')}"></label>
      <label>总座位数<input name="seats_total" type="number" min="1" max="8" required value="${esc(t.seats_total || 4)}"></label>
      <label>每位价格（$）<input name="price" type="number" min="0" step="1" required value="${esc(t.price == null ? '' : t.price)}" placeholder="如 35"></label>
      <label>备注<input name="note" maxlength="140" value="${esc(t.note || '')}" placeholder="如：Bellevue可上车，过境带好证件"></label>
      <button class="btn" type="submit">${isEdit ? '保存修改' : '发布行程'}</button>
    </form>`, { driver: true });
}

function tripBookings(t, rows) {
  const list = rows.map((b) => `<div class="card"><div class="meta">
      👤 ${esc(b.rider_name)} · 📱 ${esc(b.rider_phone)} · ${esc(b.seats)} 位
      ${b.note ? `<br>📝 ${esc(b.note)}` : ''}<br><span class="dim">${esc(b.created_at)}</span></div></div>`)
    .join('') || '<p class="empty">还没有乘客预订</p>';
  return layout('预订名单', `<a class="back" href="/driver">← 司机中心</a>
    <h1>${esc(t.from_city)} → ${esc(t.to_city)} · ${esc(t.depart_date)} ${esc(t.depart_time)}</h1>
    <p>已订 ${t.seats_taken}/${t.seats_total} 位</p><div class="list">${list}</div>`, { driver: true });
}

function join() {
  return layout('成为司机', `<div class="detail">
    <h1>🚗 成为顺风车司机</h1>
    <p>有车、有时间、常跑跨城？把你的空座变成收入。</p>
    <ul class="points">
      <li>✅ <b>推广期完全免费</b>，平台 0 抽成，你定价、你收款</li>
      <li>✅ 行程随时发布、随时修改、随时取消</li>
      <li>✅ 乘客直接打电话/加微信联系你，没有中间商</li>
      <li>✅ 热门线路：西雅图↔温哥华、西雅图↔波特兰、机场接送</li>
    </ul>
    <a class="btn" href="/driver/register">免费注册，发布第一趟行程 →</a>
    <p class="hint">安全提示：请遵守当地交通法规，载客前确认车辆保险覆盖拼车行为。</p>
  </div>`);
}

function adminLogin(msg) {
  return layout('管理后台', `<h1>管理后台</h1>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
    <form method="post" action="/admin" class="form">
      <label>密码<input type="password" name="password" required></label>
      <button class="btn" type="submit">进入</button></form>`);
}

function adminDash(stats, recent) {
  const rows = recent.map((r) => `<tr><td>${esc(r.created_at.slice(0, 16))}</td>
    <td>${esc(r.rider_name)}</td><td>${esc(r.from_city)}→${esc(r.to_city)}</td>
    <td>${esc(r.seats)} 位</td><td>${esc(r.status)}</td></tr>`).join('');
  return layout('管理后台', `<h1>📊 数据总览</h1>
    <div class="stats">
      <div class="stat"><b>${stats.drivers}</b><span>司机</span></div>
      <div class="stat"><b>${stats.trips}</b><span>行程</span></div>
      <div class="stat"><b>${stats.bookings}</b><span>预订</span></div>
      <div class="stat"><b>$${stats.gmv}</b><span>成交额(GMV)</span></div>
    </div>
    <h2>最新预订</h2><table class="tbl"><tr><th>时间</th><th>乘客</th><th>线路</th><th>座位</th><th>状态</th></tr>${rows}</table>`);
}

module.exports = {
  layout, home, tripDetail, bookOk, myPage, driverLogin, driverRegister,
  driverDash, tripForm, tripBookings, join, adminLogin, adminDash, POPULAR,
};
