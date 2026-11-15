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
<nav>${opts.driver ? `<a href="/driver">司机中心</a>` : `<a href="/driver/login">司机登录</a>`}<a href="/requests">乘客求车</a><a href="/join">成为司机</a><a href="/my">我的预订</a></nav></header>
<main>${body}</main>
<footer>推广期间平台 0 抽成 · 拼车有风险，请自行核实司机信息</footer>
<script>
function showShareMsg(m){ var el = document.querySelector('#share-msg'); if (el) el.textContent = m; }
function fallbackCopy(t){ var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); showShareMsg('✅ 链接已复制，去微信粘贴发给好友吧'); } catch (e) { showShareMsg('复制失败，请长按复制地址栏链接'); } ta.remove(); }
function copyText(t){ if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(function(){ showShareMsg('✅ 链接已复制，去微信粘贴发给好友吧'); }, function(){ fallbackCopy(t); }); } else { fallbackCopy(t); } }
function copyLink(el){ copyText(el.getAttribute('data-url')); }
function shareSite(el){ var u = el.getAttribute('data-url'), t = el.getAttribute('data-text') || '华人顺风车 · 北美华人跨城拼车'; if (navigator.share) { navigator.share({ title: '华人顺风车', text: t, url: u }).catch(function(){}); } else { copyText(u); } }
</script>
</body></html>`;
}

const POPULAR = [
  ['西雅图', '温哥华'], ['温哥华', '西雅图'],
  ['西雅图', '波特兰'], ['Bellevue', 'SEA 机场'],
];

function shareBlock(siteUrl) {
  return `<div class="share"><b>🔗 分享本站</b>
    <p class="hint">复制链接发到微信群或朋友圈，帮更多人找到顺风车。不用注册，谁都能分享。</p>
    <div class="actions">
      <button class="btn" type="button" onclick="shareSite(this)" data-url="${esc(siteUrl)}">分享给好友</button>
      <button class="btn ghost" type="button" onclick="copyLink(this)" data-url="${esc(siteUrl)}">复制链接</button>
    </div><p class="hint" id="share-msg"></p></div>`;
}

function home(trips, past, q, siteUrl) {
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

  const hist = past.map((t) => {
    return `<a class="card past" href="/trip/${t.id}">
      <div class="route">${esc(t.from_city)} <span class="arrow">→</span> ${esc(t.to_city)} <span class="tag">已过期</span></div>
      <div class="meta">📅 ${esc(t.depart_date)} ${esc(t.depart_time)} · 👤 ${esc(t.driver_name)} · 🚙 ${esc(t.car_model || '—')}</div>
      <div class="meta">${t.note ? '📝 ' + esc(t.note.slice(0, 40)) : ''}</div>
      <div class="row"><span class="price">$${esc(t.price)}/位</span>
      <span class="seats">${t.seats_taken}/${t.seats_total} 已订</span></div>
    </a>`;
  }).join('') || '<p class="empty">暂无历史行程</p>';

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
    <h2>历史行程</h2><p class="hint">以下为已过期的行程，仅供参考，不可预订。</p><div class="list">${hist}</div>
    <div class="cta"><a class="btn" href="/join">我是司机，免费发布行程 →</a>
    <a class="btn ghost" href="/request/new">我是乘客，发布求车 →</a></div>
    <p style="text-align:center"><a href="/requests">查看乘客求车 →</a></p>
    ${shareBlock(siteUrl)}
  `);
}

function tripDetail(t, msg, opts = {}) {
  const left = t.seats_total - t.seats_taken;
  const past = !!opts.past;
  return layout(`${t.from_city}→${t.to_city}`, `
    <a class="back" href="/">← 返回</a>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
    <div class="detail">
      <h1>${esc(t.from_city)} <span class="arrow">→</span> ${esc(t.to_city)}</h1>
      ${past ? '<p><span class="tag">已过期</span></p>' : ''}
      <p>📅 ${esc(t.depart_date)} ${esc(t.depart_time)}</p>
      <p>👤 司机：${esc(t.driver_name)}${t.wechat ? `（微信 ${esc(t.wechat)}）` : ''}</p>
      <p>🚙 ${esc(t.car_model || '')} ${esc(t.car_color || '')} ${t.plate ? '· 车牌 ' + esc(t.plate) : ''}</p>
      <p>💺 ${t.seats_taken}/${t.seats_total} 已订 · <b>还剩 ${left} 位</b> · <span class="price">$${esc(t.price)}/位</span></p>
      ${t.note ? `<p>📝 ${esc(t.note)}</p>` : ''}
      ${t.driver_intro ? `<p class="intro">司机介绍：${esc(t.driver_intro)}</p>` : ''}
      ${!past && left > 0 ? `
      <h2>预订座位</h2>
      <form method="post" action="/trip/${t.id}/book" class="form">
        <label>姓名<input name="rider_name" required maxlength="20"></label>
        <label>手机号<input name="rider_phone" required inputmode="tel" placeholder="司机将通过此号码联系你"></label>
        <label>座位数<select name="seats">${Array.from({ length: left }, (_, i) =>
          `<option value="${i + 1}">${i + 1} 位</option>`).join('')}</select></label>
        <label>备注（可选）<input name="note" maxlength="80" placeholder="如：带大件行李/带小孩"></label>
        <button class="btn" type="submit">确认预订（到车上再付款）</button>
      </form>` : (past ? '<p class="full">这趟行程已过期，不可预订</p>' : '<p class="full">本车已满员</p>')}
    </div>
    ${shareBlock((opts.siteUrl || '') + '/trip/' + t.id)}`);
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

function myPage(phone, rows, reqs = []) {
  const list = rows.map((r) => `<div class="card">
      <div class="route">${esc(r.from_city)} <span class="arrow">→</span> ${esc(r.to_city)}</div>
      <div class="meta">📅 ${esc(r.depart_date)} ${esc(r.depart_time)} · ${esc(r.seats)} 位 · 司机 ${esc(r.driver_name)}</div>
      ${r.status === 'confirmed' ? `<form method="post" action="/booking/${r.id}/cancel" onsubmit="return confirm('确定取消这个预订吗？')">
        <input type="hidden" name="phone" value="${esc(phone)}"><button class="linkbtn" type="submit">取消预订</button></form>`
    : `<span class="tag">已取消</span>`}
    </div>`).join('') || (phone ? '<p class="empty">没有找到预订记录</p>' : '');
  const reqList = reqs.map((r) => {
    const statusTag = r.status === 'open' ? '<span class="tag">待接单</span>'
      : r.status === 'matched' ? `<span class="tag">已被司机 ${esc(r.driver_name || '')} 接单</span>`
      : '<span class="tag">已取消</span>';
    return `<div class="card">
      <div class="route">${esc(r.from_city)} <span class="arrow">→</span> ${esc(r.to_city)} ${statusTag}</div>
      <div class="meta">📅 ${esc(r.depart_date)} ${esc(r.depart_time)} · 需要 ${esc(r.seats)} 位
        ${r.wechat ? `· 微信 ${esc(r.wechat)}` : ''}</div>
      ${r.status === 'open' ? `<form method="post" action="/request/${r.id}/cancel" onsubmit="return confirm('确定取消这个求车需求吗？')">
        <input type="hidden" name="phone" value="${esc(phone)}"><button class="linkbtn" type="submit">取消求车</button></form>` : ''}
    </div>`;
  }).join('') || (phone ? '<p class="empty">没有找到求车记录</p>' : '');
  return layout('我的预订', `
    <h1>我的预订</h1>
    <form class="search" method="get" action="/my">
      <input name="phone" placeholder="预订时留的手机号" value="${esc(phone || '')}" inputmode="tel">
      <button type="submit">查询</button>
    </form><div class="list">${list}</div>
    <h2>我的求车需求</h2><div class="list">${reqList}</div>
    <p style="text-align:center"><a class="btn ghost" href="/request/new">发布新的求车需求 →</a></p>`);
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

function driverDash(d, trips, openReqs = [], matched = [], today = '') {
  const rows = trips.map((t) => {
    const left = t.seats_total - t.seats_taken;
    const isPast = today && t.depart_date < today;
    return `<div class="card${isPast ? ' past' : ''}">
      <div class="route">${esc(t.from_city)} <span class="arrow">→</span> ${esc(t.to_city)}
        ${isPast ? '<span class="tag">历史行程</span>' : ''}</div>
      <div class="meta">📅 ${esc(t.depart_date)} ${esc(t.depart_time)} · $${esc(t.price)}/位 ·
        ${t.seats_taken}/${t.seats_total} 已订${t.status === 'cancelled' ? ' · <span class="tag">已取消</span>' : ''}</div>
      <div class="actions">
        <a href="/driver/trip/${t.id}">查看预订 (${t.seats_taken})</a>
        ${t.status === 'open' && !isPast ? `<a href="/driver/trip/${t.id}/edit">修改行程</a>
        <form style="display:inline" method="post" action="/driver/trip/${t.id}/cancel" onsubmit="return confirm('确定取消这趟行程吗？已预订的乘客会看到取消状态。')">
          <button class="linkbtn" type="submit">取消行程</button></form>` : ''}
      </div></div>`;
  }).join('') || '<p class="empty">还没有发布行程</p>';
  const reqRows = openReqs.map((r) => `<div class="card">
      <div class="route">${esc(r.from_city)} <span class="arrow">→</span> ${esc(r.to_city)}</div>
      <div class="meta">📅 ${esc(r.depart_date)} ${esc(r.depart_time)} · 需要 ${esc(r.seats)} 位 · 👤 ${esc(r.rider_name)}
        ${r.wechat ? `· 微信 ${esc(r.wechat)}` : ''}</div>
      ${r.note ? `<div class="meta">📝 ${esc(r.note)}</div>` : ''}
      <div class="actions"><form method="post" action="/request/${r.id}/claim" onsubmit="return confirm('确定接下这个求车需求吗？接单后请通过微信联系乘客。')">
        <button class="btn" type="submit">接单</button></form></div>
    </div>`).join('') || '<p class="empty">暂时没有待接的乘客求车</p>';
  const matchedRows = matched.map((r) => `<div class="card">
      <div class="route">${esc(r.from_city)} <span class="arrow">→</span> ${esc(r.to_city)} <span class="tag">已接</span></div>
      <div class="meta">📅 ${esc(r.depart_date)} ${esc(r.depart_time)} · 需要 ${esc(r.seats)} 位</div>
      <div class="meta">👤 ${esc(r.rider_name)} · 📱 ${esc(r.rider_phone)}${r.wechat ? ` · 微信 ${esc(r.wechat)}` : ''}</div>
      ${r.note ? `<div class="meta">📝 ${esc(r.note)}</div>` : ''}
    </div>`).join('') || '<p class="empty">还没有接过求车需求</p>';
  return layout('司机中心', `<h1>你好，${esc(d.name)} 👋</h1>
    <div class="actions"><a class="btn" href="/driver/trip/new">＋ 发布新行程</a>
    <a class="btn ghost" href="/driver/logout">退出登录</a></div>
    <h2>乘客求车（待接单）</h2><div class="list">${reqRows}</div>
    <h2>我已接的求车</h2><div class="list">${matchedRows}</div>
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

function requestForm(msg, r = {}) {
  return layout('发布求车', `<h1>🙋 发布求车需求</h1>
    <p class="hint">找不到合适的车？把你的行程发出来，司机看到后会通过微信联系你。不用注册。</p>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
    <form method="post" action="/request/new" class="form">
      <label>出发地<input name="from_city" required maxlength="20" value="${esc(r.from_city || '')}" placeholder="如 西雅图"></label>
      <label>目的地<input name="to_city" required maxlength="20" value="${esc(r.to_city || '')}" placeholder="如 温哥华"></label>
      <label>出发日期<input name="depart_date" type="date" required value="${esc(r.depart_date || '')}"></label>
      <label>出发时间<input name="depart_time" type="time" required value="${esc(r.depart_time || '')}"></label>
      <label>需要座位数<input name="seats" type="number" min="1" max="8" required value="${esc(r.seats || 2)}"></label>
      <label>姓名<input name="rider_name" required maxlength="20" value="${esc(r.rider_name || '')}"></label>
      <label>手机号<input name="rider_phone" required inputmode="tel" value="${esc(r.rider_phone || '')}" placeholder="用于查询和取消你的求车"></label>
      <label>微信号<input name="wechat" maxlength="30" value="${esc(r.wechat || '')}" placeholder="司机通过微信联系你"></label>
      <label>备注<input name="note" maxlength="140" value="${esc(r.note || '')}" placeholder="如：带大件行李、可拼车"></label>
      <button class="btn" type="submit">发布求车</button>
    </form>`);
}

function requestList(rows) {
  const cards = rows.map((r) => `<a class="card" href="/request/${r.id}">
      <div class="route">${esc(r.from_city)} <span class="arrow">→</span> ${esc(r.to_city)}</div>
      <div class="meta">📅 ${esc(r.depart_date)} ${esc(r.depart_time)} · 需要 ${esc(r.seats)} 位 · 👤 ${esc(r.rider_name)}
        ${r.wechat ? `· 微信 ${esc(r.wechat)}` : ''}</div>
      ${r.note ? `<div class="meta">📝 ${esc(r.note.slice(0, 40))}</div>` : ''}
    </a>`).join('') || '<p class="empty">暂时没有待接的求车需求</p>';
  return layout('乘客求车', `<h1>🙋 乘客求车</h1>
    <p class="hint">以下是乘客发布的求车需求。司机登录后可以在司机中心接单。</p>
    <div class="list">${cards}</div>
    <div class="cta"><a class="btn" href="/request/new">我也要发布求车 →</a></div>`);
}

function requestDetail(r, msg) {
  const tag = r.status === 'open' ? '<span class="tag">待接单</span>'
    : r.status === 'matched' ? `<span class="tag">已被司机 ${esc(r.driver_name || '')} 接单</span>`
    : '<span class="tag">已取消</span>';
  return layout(`${r.from_city}→${r.to_city} 求车`, `<a class="back" href="/requests">← 求车列表</a>
    ${msg ? `<p class="err" style="color:#52c41a;background:#f6ffed">${esc(msg)}</p>` : ''}
    <div class="detail">
      <h1>${esc(r.from_city)} <span class="arrow">→</span> ${esc(r.to_city)} ${tag}</h1>
      <p>📅 ${esc(r.depart_date)} ${esc(r.depart_time)}</p>
      <p>💺 需要 ${esc(r.seats)} 位</p>
      <p>👤 乘客：${esc(r.rider_name)}${r.wechat ? `（微信 ${esc(r.wechat)}）` : ''}</p>
      ${r.note ? `<p>📝 ${esc(r.note)}</p>` : ''}
      <p class="hint">司机请登录司机中心接单；接单后请通过微信联系乘客确认。</p>
    </div>`);
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

function adminDash(stats, recent, visits = {}) {
  const rows = recent.map((r) => `<tr><td>${esc(r.created_at.slice(0, 16))}</td>
    <td>${esc(r.rider_name)}</td><td>${esc(r.from_city)}→${esc(r.to_city)}</td>
    <td>${esc(r.seats)} 位</td><td>${esc(r.status)}</td></tr>`).join('');
  const weekRows = (visits.week || []).map((w) => `<tr><td>${esc(w.date)}</td>
    <td>${esc(w.visits)}</td><td>${esc(w.visitors)}</td></tr>`).join('');
  const hotRows = (visits.hot || []).map((h) => `<tr><td>${esc(h.path)}</td>
    <td>${esc(h.c)}</td></tr>`).join('');
  return layout('管理后台', `<h1>📊 数据总览</h1>
    <div class="stats">
      <div class="stat"><b>${stats.drivers}</b><span>司机</span></div>
      <div class="stat"><b>${stats.trips}</b><span>行程</span></div>
      <div class="stat"><b>${stats.bookings}</b><span>预订</span></div>
      <div class="stat"><b>$${stats.gmv}</b><span>成交额(GMV)</span></div>
    </div>
    <div class="stats">
      <div class="stat"><b>${stats.reqOpen}</b><span>求车待接</span></div>
      <div class="stat"><b>${stats.reqMatched}</b><span>求车已接</span></div>
      <div class="stat"><b>${visits.todayVisits ?? 0}</b><span>今日访问</span></div>
      <div class="stat"><b>${visits.todayVisitors ?? 0}</b><span>今日访客</span></div>
    </div>
    <h2>访问统计</h2>
    <table class="tbl"><tr><th>日期</th><th>访问</th><th>访客</th></tr>${weekRows || '<tr><td colspan="3">暂无访问记录</td></tr>'}</table>
    <h2>热门页面（近 7 天）</h2>
    <table class="tbl"><tr><th>页面</th><th>访问</th></tr>${hotRows || '<tr><td colspan="2">暂无访问记录</td></tr>'}</table>
    <h2>最新预订</h2><table class="tbl"><tr><th>时间</th><th>乘客</th><th>线路</th><th>座位</th><th>状态</th></tr>${rows}</table>`);
}

module.exports = {
  layout, home, tripDetail, bookOk, myPage, driverLogin, driverRegister,
  driverDash, tripForm, tripBookings, join, adminLogin, adminDash, POPULAR,
  shareBlock, requestForm, requestList, requestDetail,
};
