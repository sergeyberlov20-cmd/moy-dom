import { json, esc, clean, corsHeaders, ipHash, rateLimited, readJson, tgSend } from './lib.js';

/* ---------- заявка с сайта ---------- */
export async function handleLead(request, env) {
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

  const iph = await ipHash(request);
  if (await rateLimited(env, 'lead:' + iph, 20)) {
    return json({ ok: false, error: 'too_many' }, 429, corsHeaders(request, env));
  }

  const page = clean(body.page, 200);
  const referrer = clean(body.referrer, 300);
  const utm = clean(body.utm, 300);

  const res = await env.DB.prepare(
    `INSERT INTO leads (name, phone, message, page, referrer, utm, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(name, phone, message, page, referrer, utm, iph).run();

  const id = res.meta && res.meta.last_row_id ? res.meta.last_row_id : 0;

  if (env.BOT_TOKEN && env.TG_CHAT_ID && id) {
    const text =
      '🔔 <b>Новая заявка №' + id + '</b>\n' +
      '👤 ' + esc(name || '—') + '\n' +
      '📞 <a href="tel:' + esc(phone.replace(/[^\d+]/g, '')) + '">' + esc(phone) + '</a>\n' +
      (message ? '💬 ' + esc(message) + '\n' : '') +
      '🌐 ' + esc(page || '—') + '\n' +
      (referrer ? '↩️ ' + esc(referrer) + '\n' : '') +
      '🕒 ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    await tgSend(env, env.TG_CHAT_ID, text, {
      inline_keyboard: [[
        { text: '📞 В работе', callback_data: 'st:' + id + ':inwork' },
        { text: '✅ Готово', callback_data: 'st:' + id + ':done' }
      ]]
    });
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
  if (await rateLimited(env, 'ev:' + iph, 3)) return json({ ok: true }, 200, corsHeaders(request, env));

  await env.DB.prepare(
    'INSERT INTO events (type, page, meta, ip_hash) VALUES (?, ?, ?, ?)'
  ).bind(body.type, clean(body.page, 200), clean(body.meta, 300), iph).run();

  return json({ ok: true }, 200, corsHeaders(request, env));
}
