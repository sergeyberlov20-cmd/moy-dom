import { json, clean, corsHeaders, randomHex, ipHash, rateLimited, readJson, tgSend, allAdminIds, STATUSES } from './lib.js';
import { metrikaSummary } from './remind.js';

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 дней

/* ---------- вход по одноразовому коду из бота ---------- */
export async function adminLogin(request, env) {
  const iph = await ipHash(request);
  if (await rateLimited(env, 'login:' + iph, 30)) {
    return json({ ok: false, error: 'too_many' }, 429, corsHeaders(request, env));
  }
  const admins = await allAdminIds(env);
  if (!admins.length || !env.BOT_TOKEN) {
    return json({ ok: false, error: 'not_configured' }, 503, corsHeaders(request, env));
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await env.KV.put('otp:' + code, '1', { expirationTtl: 300 });

  let sent = 0;
  for (const a of admins) {
    const r = await tgSend(env, a, '🔐 <b>Код входа в панель заявок</b>\n<code>' + code + '</code>\n\nДействует 5 минут. Если это не вы — игнорируйте.');
    if (r && r.ok) sent++;
  }
  return json({ ok: true, sent: sent }, 200, corsHeaders(request, env));
}

export async function adminVerify(request, env) {
  const body = await readJson(request);
  const code = body && clean(body.code, 12);
  if (!code) return json({ ok: false, error: 'bad_request' }, 400, corsHeaders(request, env));

  const found = await env.KV.get('otp:' + code);
  if (!found) return json({ ok: false, error: 'code' }, 401, corsHeaders(request, env));

  await env.KV.delete('otp:' + code);
  const token = randomHex(24);
  await env.KV.put('sess:' + token, new Date().toISOString(), { expirationTtl: SESSION_TTL });
  return json({ ok: true, token: token }, 200, corsHeaders(request, env));
}

async function requireAdmin(request, env) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+([a-f0-9]{16,64})$/i);
  if (!m) return false;
  return !!(await env.KV.get('sess:' + m[1]));
}

export async function adminLogout(request, env) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+([a-f0-9]{16,64})$/i);
  if (m) await env.KV.delete('sess:' + m[1]);
  return json({ ok: true }, 200, corsHeaders(request, env));
}

export async function adminMe(request, env) {
  const ok = await requireAdmin(request, env);
  return json({ ok: ok }, ok ? 200 : 401, corsHeaders(request, env));
}

/* ---------- заявки ---------- */
export async function adminLeads(request, env) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: 'auth' }, 401, corsHeaders(request, env));

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));

  const useFilter = STATUSES.includes(status);
  const stmt = env.DB.prepare(
    'SELECT id, created_at, name, phone, message, page, referrer, utm, status, note FROM leads' +
    (useFilter ? ' WHERE status = ?' : '') + ' ORDER BY id DESC LIMIT ?'
  );
  const rows = useFilter ? await stmt.bind(status, limit).all() : await stmt.bind(limit).all();

  const counts = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status').all();
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM leads').first();

  return json({
    ok: true,
    total: total ? total.n : 0,
    counts: (counts.results || []).reduce((acc, r) => { acc[r.status] = r.n; return acc; }, {}),
    leads: rows.results || []
  }, 200, corsHeaders(request, env));
}

export async function adminUpdateLead(request, env) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: 'auth' }, 401, corsHeaders(request, env));
  const body = await readJson(request);
  const id = Number(body && body.id);
  const status = body && clean(body.status, 20);
  const note = body && body.note !== undefined ? clean(body.note, 1000) : undefined;
  if (!id || !STATUSES.includes(status)) return json({ ok: false, error: 'bad_request' }, 400, corsHeaders(request, env));

  if (note === undefined) {
    await env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, id).run();
  } else {
    await env.DB.prepare('UPDATE leads SET status = ?, note = ? WHERE id = ?').bind(status, note, id).run();
  }
  return json({ ok: true }, 200, corsHeaders(request, env));
}

/* ---------- кто пользуется ботом (для панели) ---------- */
export async function adminBotStats(request, env) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: 'auth' }, 401, corsHeaders(request, env));

  const total = await env.DB.prepare('SELECT COUNT(*) AS n, SUM(allowed) AS a FROM bot_users').first();
  const today = await env.DB.prepare("SELECT COUNT(*) AS n FROM bot_users WHERE date(last_seen) = date('now')").first();
  const week = await env.DB.prepare("SELECT COUNT(*) AS n FROM bot_users WHERE last_seen >= datetime('now','-6 days')").first();
  const list = await env.DB.prepare(
    'SELECT user_id, name, username, messages, commands, allowed, first_seen, last_seen ' +
    'FROM bot_users ORDER BY last_seen DESC LIMIT 25'
  ).all();

  let invites = 0;
  try {
    const r = await env.KV.list({ prefix: 'invite:', limit: 1000 });
    invites = (r.keys || []).length;
  } catch (e) { invites = 0; }

  return json({
    ok: true,
    total: total ? total.n : 0,
    withAccess: total ? (total.a || 0) : 0,
    today: today ? today.n : 0,
    week: week ? week.n : 0,
    activeInvites: invites,
    users: list.results || []
  }, 200, corsHeaders(request, env));
}

/* ---------- статистика ---------- */
export async function adminStats(request, env) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: 'auth' }, 401, corsHeaders(request, env));

  const days = await env.DB.prepare(
    "SELECT date(created_at) AS d, COUNT(*) AS n FROM leads WHERE created_at >= date('now','-6 days') GROUP BY d ORDER BY d"
  ).all();
  const events = await env.DB.prepare(
    "SELECT type, COUNT(*) AS n FROM events WHERE created_at >= date('now','-6 days') GROUP BY type"
  ).all();
  const pages = await env.DB.prepare(
    "SELECT page, COUNT(*) AS n FROM events WHERE type = 'pageview' AND created_at >= date('now','-6 days') GROUP BY page ORDER BY n DESC LIMIT 5"
  ).all();
  const leadPages = await env.DB.prepare(
    "SELECT page, COUNT(*) AS n FROM leads WHERE created_at >= date('now','-29 days') GROUP BY page ORDER BY n DESC LIMIT 5"
  ).all();
  const today = await env.DB.prepare("SELECT COUNT(*) AS n FROM leads WHERE date(created_at) = date('now')").first();

  // откуда приходят заявки: utm → реферер → прямой заход
  const cacheKey = 'cache:stats';
  try {
    const cached = await env.KV.get(cacheKey);
    if (cached) return json(JSON.parse(cached), 200, corsHeaders(request, env));
  } catch (e) { /* кэш не критичен */ }

  let sources = [];
  try {
    const s = await env.DB.prepare(
      "SELECT COALESCE(NULLIF(utm, ''), NULLIF(referrer, ''), 'прямой заход') AS src, COUNT(*) AS n " +
      "FROM leads WHERE created_at >= date('now','-29 days') GROUP BY src ORDER BY n DESC LIMIT 8"
    ).all();
    sources = s.results || [];
  } catch (e) { sources = []; }

  const payload = {
    ok: true,
    today: today ? today.n : 0,
    leadsByDay: days.results || [],
    events: (events.results || []).reduce((acc, r) => { acc[r.type] = r.n; return acc; }, {}),
    topPages: pages.results || [],
    topLeadPages: leadPages.results || [],
    sources: sources,
    metrika: await metrikaSummary(env, 7)
  };

  // тяжёлые агрегаты кэшируем на минуту
  try { await env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 60 }); } catch (e) {}

  return json(payload, 200, corsHeaders(request, env));
}

/* ---------- выгрузка CSV ---------- */
export async function adminExport(request, env) {
  if (!(await requireAdmin(request, env))) {
    return new Response('auth', { status: 401, headers: corsHeaders(request, env) });
  }
  const rows = await env.DB.prepare(
    'SELECT id, created_at, name, phone, message, page, referrer, status, note FROM leads ORDER BY id DESC'
  ).all();

  const head = ['id', 'дата', 'имя', 'телефон', 'сообщение', 'страница', 'источник', 'статус', 'заметка'];
  const body = (rows.results || []).map((r) =>
    [r.id, r.created_at, r.name, r.phone, r.message, r.page, r.referrer, r.status, r.note]
      .map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';')
  );
  const csv = [head.join(';')].concat(body).join('\r\n');

  return new Response('\uFEFF' + csv, {
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads.csv"'
    }
  });
}
