/**
 * Отзывы посетителей сайта: приём с проверкой, модерация в боте, выдача одобренных.
 */
import { json, esc, clean, corsHeaders, ipHash, readJson, tgNotify, tgApi } from './lib.js';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const CACHE_KEY = 'cache:site_reviews';
const CACHE_TTL = 120;

function humanDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}

async function clearCache(env) {
  try { await env.KV.delete(CACHE_KEY); } catch (e) { /* не критично */ }
}

const starLine = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

/* ---------- приём отзыва с сайта ---------- */
export async function handleSiteReview(request, env, ctx) {
  const H = corsHeaders(request, env);
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: 'bad_request' }, 400, H);

  // ловушка для роботов
  if (body._gotcha) return json({ ok: true, pending: true }, 200, H);

  // слишком быстрая отправка — почти наверняка робот
  const elapsed = Number(body.elapsed);
  if (isFinite(elapsed) && elapsed > 0 && elapsed < 2500) return json({ ok: true, pending: true }, 200, H);

  const name = clean(body.name, 60).replace(/\s+/g, ' ');
  const text = clean(body.text, 1500);
  const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating) || 5)));

  if (name.length < 2) return json({ ok: false, error: 'name' }, 400, H);
  if (text.length < 20) return json({ ok: false, error: 'text_short' }, 400, H);
  if (/https?:\/\/|www\./i.test(name + ' ' + text)) return json({ ok: false, error: 'links' }, 400, H);

  const iph = await ipHash(request);

  // лимиты: 3 отзыва в час, 10 в сутки с одного IP
  const hk = 'cnt:srevH:' + iph;
  const dk = 'cnt:srevD:' + iph;
  const hc = Number(await env.KV.get(hk).catch(() => 0)) || 0;
  const dc = Number(await env.KV.get(dk).catch(() => 0)) || 0;
  if (hc >= 3 || dc >= 10) return json({ ok: false, error: 'too_many' }, 429, H);

  // тот же текст с того же IP за 10 минут — второй раз не создаём
  try {
    const dup = await env.DB.prepare(
      "SELECT id FROM site_reviews WHERE ip_hash = ? AND text = ? AND created_at >= datetime('now','-10 minutes') LIMIT 1"
    ).bind(iph, text).first();
    if (dup && dup.id) return json({ ok: true, pending: true, id: dup.id }, 200, H);
  } catch (e) { /* если проверка не удалась — просто продолжаем */ }

  try {
    await env.KV.put(hk, String(hc + 1), { expirationTtl: 3600 });
    await env.KV.put(dk, String(dc + 1), { expirationTtl: 86400 });
  } catch (e) { /* счётчики не критичны */ }

  const res = await env.DB.prepare(
    'INSERT INTO site_reviews (name, rating, text, page, ip_hash) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, rating, text, clean(body.page, 200), iph).run();

  const id = res && res.meta && res.meta.last_row_id ? res.meta.last_row_id : 0;

  if (env.BOT_TOKEN && id) {
    const notify = tgNotify(env,
      '💬 <b>Новый отзыв на сайте</b>\n' +
      '👤 ' + esc(name) + ' · ' + starLine(rating) + '\n' +
      '💬 ' + esc(text.slice(0, 900)) + '\n' +
      '🕒 ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC\n' +
      '<i>На сайте появится только после публикации.</i>',
      {
        inline_keyboard: [[
          { text: '✅ Опубликовать', callback_data: 'srv:a:' + id },
          { text: '❌ Отклонить', callback_data: 'srv:r:' + id }
        ]]
      }
    ).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(notify);
    else await notify;
  }

  return json({ ok: true, pending: true, id }, 200, H);
}

/* ---------- выдача одобренных отзывов ---------- */
export async function handleSiteReviewsGet(request, env) {
  const H = { ...corsHeaders(request, env), 'Cache-Control': 'public, max-age=60' };
  const send = (payload) => new Response(payload, {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...H }
  });

  let cached = null;
  try { cached = await env.KV.get(CACHE_KEY); } catch (e) { /* без кэша */ }
  if (cached) return send(cached);

  let rows = [];
  try {
    const r = await env.DB.prepare(
      "SELECT id, name, rating, text, created_at FROM site_reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 60"
    ).all();
    rows = (r && r.results) || [];
  } catch (e) {
    return json({ ok: false, error: 'db' }, 200, H);
  }

  const reviews = rows.map((x) => ({
    id: x.id,
    author: x.name,
    rating: Number(x.rating) || 5,
    text: x.text,
    date: humanDate(x.created_at),
    iso: String(x.created_at || '').slice(0, 10)
  }));
  const count = reviews.length;
  const rating = count
    ? Math.round((reviews.reduce((s, x) => s + x.rating, 0) / count) * 10) / 10
    : 0;

  const payload = JSON.stringify({ ok: true, count, rating, reviews });
  try { await env.KV.put(CACHE_KEY, payload, { expirationTtl: CACHE_TTL }); } catch (e) { /* не критично */ }
  return send(payload);
}

/* ---------- кнопки модерации в боте: srv:a|r|d:<id> ---------- */
export async function handleSiteReviewCallback(env, query) {
  const m = /^srv:([ard]):(\d+)$/.exec(query.data || '');
  if (!m) {
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Непонятная кнопка' });
    return new Response('ok');
  }

  const act = m[1];
  const id = Number(m[2]);
  const msg = query.message;

  if (act === 'd') {
    await env.DB.prepare('DELETE FROM site_reviews WHERE id = ?').bind(id).run();
    await clearCache(env);
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Удалён' });
    if (msg) {
      await tgApi(env, 'editMessageText', {
        chat_id: msg.chat.id, message_id: msg.message_id,
        text: '🗑 <b>Отзыв №' + id + ' удалён</b>', parse_mode: 'HTML'
      });
    }
    return new Response('ok');
  }

  const status = act === 'a' ? 'approved' : 'rejected';
  const res = await env.DB.prepare('UPDATE site_reviews SET status = ? WHERE id = ?').bind(status, id).run();
  const changed = res && res.meta ? res.meta.changes : 0;
  await clearCache(env);

  await tgApi(env, 'answerCallbackQuery', {
    callback_query_id: query.id,
    text: status === 'approved' ? 'Опубликован' : 'Отклонён',
    show_alert: !changed
  });

  if (msg) {
    const base = String(msg.text || '').replace(/\n\n<i>На сайте появится[\s\S]*$/, '');
    const tail = status === 'approved'
      ? '\n\n✅ <b>Опубликован</b> — уже на сайте: https://dom-mc.ru/reviews/'
      : '\n\n❌ <b>Отклонён</b> — на сайте не появится.';
    await tgApi(env, 'editMessageText', {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      text: base + tail,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: changed ? { inline_keyboard: [[{ text: '🗑 Удалить', callback_data: 'srv:d:' + id }]] } : undefined
    });
  }
  return new Response('ok');
}

/* ---------- что ждёт проверки (для команды в боте) ---------- */
export async function siteReviewsPending(env, limit) {
  const lim = Math.min(10, Math.max(1, Number(limit) || 5));
  const r = await env.DB.prepare(
    "SELECT id, name, rating, text, created_at FROM site_reviews WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?"
  ).bind(lim).all();
  const pend = await env.DB.prepare("SELECT COUNT(*) AS n FROM site_reviews WHERE status = 'pending'").first();
  const appr = await env.DB.prepare("SELECT COUNT(*) AS n FROM site_reviews WHERE status = 'approved'").first();
  return {
    rows: (r && r.results) || [],
    pending: (pend && pend.n) || 0,
    approved: (appr && appr.n) || 0
  };
}

