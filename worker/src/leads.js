import { json, esc, clean, corsHeaders, ipHash, readJson, tgNotify, adminIds, isBotPaused } from './lib.js';

/* ---------- заявка с сайта ---------- */
export async function handleLead(request, env, ctx) {
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: 'bad_request' }, 400, corsHeaders(request, env));

  // скрытая ловушка для спам-ботов: заполнена — молча «принимаем»
  if (body._gotcha) return json({ ok: true }, 200, corsHeaders(request, env));

  const name = clean(body.name, 100);
  const phone = clean(body.phone, 40);
  const message = clean(body.message, 2000);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return json({ ok: false, error: 'phone' }, 400, corsHeaders(request, env));
  }

  // форма, заполненная за пару секунд, — почти всегда робот: тихо «принимаем»
  const elapsed = Number(body.elapsed);
  if (isFinite(elapsed) && elapsed > 0 && elapsed < 2000) {
    return json({ ok: true, id: 0 }, 200, corsHeaders(request, env));
  }

  // ссылки в имени и тексте — типичный спам
  const links = (String(name) + ' ' + String(message)).match(/https?:\/\/|www\./gi);
  if (links && links.length > 2) {
    return json({ ok: true, id: 0 }, 200, corsHeaders(request, env));
  }
  if (/https?:\/\//i.test(name)) {
    return json({ ok: true, id: 0 }, 200, corsHeaders(request, env));
  }

  const page = clean(body.page, 200);
  const referrer = clean(body.referrer, 300);
  const utm = clean(body.utm, 300);

  // повторное нажатие «Отправить» с теми же данными не создаёт дубль:
  // отвечаем успехом и id уже созданной заявки
  try {
    const dup = await env.DB.prepare(
      "SELECT id FROM leads WHERE phone = ? AND coalesce(page, '') = ? AND created_at >= datetime('now','-3 minutes') ORDER BY id DESC LIMIT 1"
    ).bind(phone, page).first();
    if (dup && dup.id) {
      return json({ ok: true, id: dup.id, duplicate: true }, 200, corsHeaders(request, env));
    }
  } catch (e) { /* если запрос не удался — просто продолжаем */ }

  const iph = await ipHash(request);
  // лимиты: 5 заявок / минуту, 10 / час, 30 / сутки с одного IP
  const minKey = 'cnt:leadM:' + iph;
  const hourKey = 'cnt:leadH:' + iph;
  const dayKey = 'cnt:leadD:' + iph;
  const minCount = Number(await env.KV.get(minKey).catch(() => 0)) || 0;
  const hourCount = Number(await env.KV.get(hourKey).catch(() => 0)) || 0;
  const dayCount = Number(await env.KV.get(dayKey).catch(() => 0)) || 0;
  if (minCount >= 5 || hourCount >= 10 || dayCount >= 30) {
    return json({ ok: false, error: 'too_many' }, 429, corsHeaders(request, env));
  }
  try {
    await env.KV.put(minKey, String(minCount + 1), { expirationTtl: 60 });
    await env.KV.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 });
    await env.KV.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 });
  } catch (e) { /* счётчики не критичны */ }

  const res = await env.DB.prepare(
    `INSERT INTO leads (name, phone, message, page, referrer, utm, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(name, phone, message, page, referrer, utm, iph).run();

  const id = res.meta && res.meta.last_row_id ? res.meta.last_row_id : 0;

  const paused = await isBotPaused(env);
  if (env.BOT_TOKEN && adminIds(env).length && id && !paused) {
    const text =
      '🔔 <b>Новая заявка №' + id + '</b>\n' +
      '👤 ' + esc(name || '—') + '\n' +
      '📞 <a href="tel:' + esc(phone.replace(/[^\d+]/g, '')) + '">' + esc(phone) + '</a>\n' +
      (message ? '💬 ' + esc(message) + '\n' : '') +
      '🌐 ' + esc(page || '—') + '\n' +
      (referrer ? '↩️ ' + esc(referrer) + '\n' : '') +
      '🕒 ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    // уведомление отправляем в фоне: ответ посетителю не ждёт Telegram
    const notify = tgNotify(env, text, {
      inline_keyboard: [[
        { text: '📞 В работе', callback_data: 'st:' + id + ':inwork' },
        { text: '✅ Готово', callback_data: 'st:' + id + ':done' },
        { text: '🗑 Удалить', callback_data: 'del:' + id }
      ]]
    }).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(notify);
    else await notify;
  }

  return json({ ok: true, id }, 200, corsHeaders(request, env));
}

/* ---------- события для собственной статистики ---------- */
export async function handleEvent(request, env) {
  const body = await readJson(request);
  const types = ['pageview', 'tel_click', 'form_open', 'form_submit', 'object_open'];
  if (!body || types.indexOf(body.type) === -1) {
    return json({ ok: false, error: 'bad_request' }, 400, corsHeaders(request, env));
  }
  const iph = await ipHash(request);

  await env.DB.prepare(
    'INSERT INTO events (type, page, meta, ip_hash) VALUES (?, ?, ?, ?)'
  ).bind(body.type, clean(body.page, 200), clean(body.meta, 300), iph).run();

  return json({ ok: true }, 200, corsHeaders(request, env));
}
