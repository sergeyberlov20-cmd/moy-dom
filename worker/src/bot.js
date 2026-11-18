import { json, esc, tgApi, tgSend, isAdmin, STATUSES } from './lib.js';

const STATUS_RU = { new: 'новая', inwork: 'в работе', done: 'закрыта', spam: 'спам' };
const KB = (id) => ({
  inline_keyboard: [[
    { text: '📞 В работе', callback_data: 'st:' + id + ':inwork' },
    { text: '✅ Готово', callback_data: 'st:' + id + ':done' }
  ]]
});

/* ---------- вебхук бота ---------- */
export async function handleTelegram(request, env) {
  if (env.WEBHOOK_SECRET) {
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secret !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  }

  let update = null;
  try { update = await request.json(); } catch (e) { return new Response('bad', { status: 400 }); }

  if (update.callback_query) return await handleCallback(update.callback_query, env);

  const msg = update.message;
  if (!msg || !msg.text) return new Response('ok');
  const fromId = msg.from ? msg.from.id : 0;

  if (!isAdmin(env, fromId)) {
    await tgSend(env, msg.chat.id, '🤖 Служебный бот агентства «Мой Дом».\nЗаявки — на сайте <b>dom-mc.ru</b>, звонки — +7 949 504-44-55.');
    return new Response('ok');
  }

  const parts = msg.text.trim().split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();
  const arg = parts[1];

  if (cmd === '/start' || cmd === '/help') {
    await tgSend(env, msg.chat.id,
      '🤖 <b>Панель заявок «Мой Дом»</b>\n\n' +
      '/leads — последние 10 заявок\n' +
      '/leads new — только новые\n' +
      '/stats — сводка за 7 дней\n' +
      '/done 12 — закрыть заявку №12\n' +
      '/id — ваш Telegram ID\n\n' +
      'Под каждой заявкой есть кнопки.');
    return new Response('ok');
  }

  if (cmd === '/id') {
    await tgSend(env, msg.chat.id, 'Ваш ID: <code>' + fromId + '</code>\nЧат: <code>' + msg.chat.id + '</code>');
    return new Response('ok');
  }

  if (cmd === '/leads') {
    const filter = arg && STATUSES.includes(arg) ? arg : '';
    const stmt = env.DB.prepare(
      'SELECT id, created_at, name, phone, message, page, status FROM leads' +
      (filter ? ' WHERE status = ?' : '') + ' ORDER BY id DESC LIMIT 10'
    );
    const rows = filter ? await stmt.bind(filter).all() : await stmt.bind().all();
    const list = rows.results || [];
    if (!list.length) {
      await tgSend(env, msg.chat.id, 'Заявок пока нет.');
      return new Response('ok');
    }
    for (const r of list) {
      await tgSend(env, msg.chat.id,
        '📄 <b>№' + r.id + '</b> · ' + (STATUS_RU[r.status] || r.status) + '\n' +
        '👤 ' + esc(r.name || '—') + '\n' +
        '📞 <a href="tel:' + esc(String(r.phone).replace(/[^\d+]/g, '')) + '">' + esc(r.phone) + '</a>\n' +
        (r.message ? '💬 ' + esc(r.message) + '\n' : '') +
        '🌐 ' + esc(r.page || '—') + '\n' +
        '🕒 ' + esc(r.created_at) + ' UTC', KB(r.id));
    }
    return new Response('ok');
  }

  if (cmd === '/stats') {
    await tgSend(env, msg.chat.id, await statsText(env));
    return new Response('ok');
  }

  if (cmd === '/done') {
    const id = Number(arg);
    if (!id) {
      await tgSend(env, msg.chat.id, 'Укажите номер: <code>/done 12</code>');
      return new Response('ok');
    }
    await env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind('done', id).run();
    await tgSend(env, msg.chat.id, '✅ Заявка №' + id + ' закрыта.');
    return new Response('ok');
  }

  await tgSend(env, msg.chat.id, 'Неизвестная команда. Список: /help');
  return new Response('ok');
}

/* ---------- кнопки под заявкой ---------- */
async function handleCallback(query, env) {
  const fromId = query.from ? query.from.id : 0;
  const data = query.data || '';
  if (!isAdmin(env, fromId)) {
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Нет доступа', show_alert: true });
    return new Response('ok');
  }

  const m = data.match(/^st:(\d+):(new|inwork|done|spam)$/);
  if (!m) {
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Непонятная кнопка' });
    return new Response('ok');
  }

  const id = Number(m[1]);
  const status = m[2];
  await env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, id).run();
  await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Статус: ' + (STATUS_RU[status] || status) });

  if (query.message) {
    const msg = query.message;
    const base = String(msg.text || '').replace(/\n<b>Статус:<\/b> .*$/m, '');
    await tgApi(env, 'editMessageText', {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      text: base + '\n<b>Статус:</b> ' + (STATUS_RU[status] || status),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: status === 'done' ? { inline_keyboard: [] } : KB(id)
    });
  }
  return new Response('ok');
}

/* ---------- текст сводки ---------- */
export async function statsText(env) {
  const t = await env.DB.prepare("SELECT COUNT(*) AS n FROM leads WHERE date(created_at) = date('now')").first();
  const w = await env.DB.prepare("SELECT COUNT(*) AS n FROM leads WHERE created_at >= date('now','-6 days')").first();
  const fresh = await env.DB.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'new'").first();
  const tel = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'tel_click' AND created_at >= date('now','-6 days')").first();
  const pages = await env.DB.prepare(
    "SELECT page, COUNT(*) AS n FROM events WHERE type = 'pageview' AND created_at >= date('now','-6 days') GROUP BY page ORDER BY n DESC LIMIT 3"
  ).all();

  const top = (pages.results || []).map((p) => '• ' + esc(p.page || '/') + ' — ' + p.n).join('\n') || '• пока нет данных';

  return '📊 <b>Сводка за 7 дней</b>\n\n' +
    'Заявок сегодня: <b>' + (t ? t.n : 0) + '</b>\n' +
    'Заявок за 7 дней: <b>' + (w ? w.n : 0) + '</b>\n' +
    'Новых (не обработано): <b>' + (fresh ? fresh.n : 0) + '</b>\n' +
    'Кликов «позвонить»: <b>' + (tel ? tel.n : 0) + '</b>\n\n' +
    '<b>Топ страниц:</b>\n' + top;
}

/* ---------- ежедневная сводка по cron ---------- */
export async function dailyDigest(env) {
  if (!env.BOT_TOKEN || !env.TG_CHAT_ID) return;
  await tgSend(env, env.TG_CHAT_ID, await statsText(env));
}

/* ---------- сервисные ручки (вызываются извне РФ через воркер) ---------- */
function setupAllowed(request, env) {
  const key = new URL(request.url).searchParams.get('key') || '';
  return !!env.WEBHOOK_SECRET && key === env.WEBHOOK_SECRET;
}

/** GET /api/tg/setup?key=<WEBHOOK_SECRET> — ставит вебхук бота на этот воркер */
export async function tgSetup(request, env) {
  if (!setupAllowed(request, env)) return json({ ok: false, error: 'forbidden' }, 403);
  const base = new URL(request.url).origin;

  const set = await tgApi(env, 'setWebhook', {
    url: base + '/api/tg/webhook',
    secret_token: env.WEBHOOK_SECRET,
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query']
  });
  const info = await tgApi(env, 'getWebhookInfo', {});
  return json({
    ok: !!(set && set.ok),
    webhook: base + '/api/tg/webhook',
    setWebhook: set,
    info: info ? info.result : null
  });
}

/** GET /api/tg/test?key=<WEBHOOK_SECRET> — тестовое сообщение в чат */
export async function tgTest(request, env) {
  if (!setupAllowed(request, env)) return json({ ok: false, error: 'forbidden' }, 403);
  const r = await tgSend(env, env.TG_CHAT_ID,
    '✅ <b>Проверка связи</b>\nБот «Мой Дом» на связи. Сюда будут приходить заявки с сайта.');
  return json({ ok: !!(r && r.ok), response: r });
}

/** GET /api/tg/diag?key=<WEBHOOK_SECRET> — состояние бота */
export async function tgDiag(request, env) {
  if (!setupAllowed(request, env)) return json({ ok: false, error: 'forbidden' }, 403);
  const me = await tgApi(env, 'getMe', {});
  const info = await tgApi(env, 'getWebhookInfo', {});
  const hook = info && info.result ? {
    url: info.result.url, pending: info.result.pending_update_count,
    last_error: info.result.last_error_message || null, last_error_date: info.result.last_error_date || null
  } : null;
  return json({
    ok: !!(me && me.ok),
    bot: me && me.result ? { id: me.result.id, username: me.result.username } : null,
    webhook: hook,
    admins: String(env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
    chat: env.TG_CHAT_ID || null
  });
}

