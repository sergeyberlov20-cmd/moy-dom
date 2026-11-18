/**
 * «Мой Дом» — API заявок, событий и мини-админки.
 * Cloudflare Worker + D1 (SQLite) + KV + Telegram Bot API.
 */

const JSON_HDR = { 'Content-Type': 'application/json; charset=utf-8' };
const STATUSES = ['new', 'inwork', 'done', 'spam'];
const EVENT_TYPES = ['pageview', 'tel_click', 'form_open', 'form_submit', 'object_open'];

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { ...JSON_HDR, ...extra } });

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

function allowedOrigins(env) {
  return String(env.SITE_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = allowedOrigins(env);
  const allow = list.includes(origin) ? origin : (list[0] || '*');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

const corsPreflight = (request, env) => new Response(null, { status: 204, headers: corsHeaders(request, env) });

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function ipHash(request) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '0.0.0.0';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|moydom'));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function rateLimited(env, key, ttl) {
  if (!env.KV) return false;
  const k = 'rl:' + key;
  try {
    if (await env.KV.get(k)) return true;
    // KV не принимает expirationTtl меньше 60 секунд
    await env.KV.put(k, '1', { expirationTtl: Math.max(60, Number(ttl) || 60) });
  } catch (e) {
    return false; // хранилище недоступно — не блокируем заявку
  }
  return false;
}

async function readJson(request) {
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('json')) return null;
  try { return await request.json(); } catch (e) { return null; }
}

async function tgApi(env, method, payload) {
  if (!env.BOT_TOKEN) return null;
  const r = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  try { return await r.json(); } catch (e) { return null; }
}

const tgSend = async (env, chatId, text, reply_markup) => {
  const r = await tgApi(env, 'sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', reply_markup, disable_web_page_preview: true
  });
  // запоминаем id своих сообщений, чтобы «Сброс» мог почистить чат
  try {
    if (r && r.ok && r.result && r.result.message_id && env.KV && /^-?\d+$/.test(String(chatId))) {
      const key = 'msgs:' + chatId;
      const raw = await env.KV.get(key);
      const list = raw ? JSON.parse(raw) : [];
      list.push(r.result.message_id);
      const tail = list.slice(-80);
      await env.KV.put(key, JSON.stringify(tail), { expirationTtl: 60 * 60 * 48 });
    }
  } catch (e) { /* учёт не критичен */ }
  return r;
};

/** Удаляет все свои сообщения в чате (в пределах 48 часов) */
async function tgPurge(env, chatId) {
  const key = 'msgs:' + chatId;
  let ids = [];
  try {
    const raw = await env.KV.get(key);
    ids = raw ? JSON.parse(raw) : [];
  } catch (e) { ids = []; }

  let deleted = 0;
  for (const id of ids.slice(-80)) {
    try {
      const r = await tgApi(env, 'deleteMessage', { chat_id: chatId, message_id: id });
      if (r && r.ok) deleted++;
    } catch (e) { /* старое сообщение — пропускаем */ }
  }
  try { await env.KV.delete(key); } catch (e) {}
  return deleted;
}

/* Постоянная клавиатура внизу чата — как в приложении */
/* Команды, которые должны срабатывать даже во время диалога /add или /post */
const DIALOG_COMMANDS = ['/cancel', '/reset', '/post', '/add', '/start', '/help', '/leads', '/stats', '/site', '/id', '/done', '/admins', '/adduser', '/deluser', '/invite', '/botstats', '/reviews', '/price', '/sold'];

export function isDialogCommand(text) {
  const t = String(text || '').trim().toLowerCase();
  if (t.charAt(0) !== '/') return false;
  return DIALOG_COMMANDS.indexOf(t.split(/\s+/)[0]) >= 0;
}

/* Список владельцев бота: ADMIN_IDS, иначе TG_CHAT_ID (оба могут быть через запятую) */
const adminIds = (env) => {
  const raw = String(env.ADMIN_IDS || env.TG_CHAT_ID || '');
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
};

const isAdmin = (env, userId) => adminIds(env).indexOf(String(userId)) >= 0;

/* Отправить сообщение всем владельцам сразу (новые заявки, сводки, напоминания) */
async function tgNotify(env, text, kb) {
  if (!env.BOT_TOKEN) return [];
  const out = [];
  for (const id of adminIds(env)) {
    try {
      out.push(await tgSend(env, id, text, kb));
    } catch (e) {
      out.push({ ok: false, error: String((e && e.message) || e) });
    }
  }
  return out;
}

/* Дополнительные владельцы, добавленные из бота (хранятся в KV, без деплоя) */
const EXTRA_ADMINS_KEY = 'admins:extra';

async function extraAdminIds(env) {
  try {
    const s = await env.KV.get(EXTRA_ADMINS_KEY);
    return s ? s.split(',').map((x) => x.trim()).filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

async function allAdminIds(env) {
  const list = adminIds(env).concat(await extraAdminIds(env));
  return list.filter((v, i, a) => a.indexOf(v) === i);
}

async function isAllowedAdmin(env, userId) {
  return (await allAdminIds(env)).indexOf(String(userId)) >= 0;
}

async function setExtraAdmins(env, list) {
  const clean = list.filter((v, i, a) => v && a.indexOf(v) === i);
  if (!clean.length) {
    await env.KV.delete(EXTRA_ADMINS_KEY);
    return clean;
  }
  await env.KV.put(EXTRA_ADMINS_KEY, clean.join(','));
  return clean;
}

/* Удалить сообщение бота (чтобы чат не зарастал шагами диалога) */
async function tgDelete(env, chatId, messageId) {
  if (!env.BOT_TOKEN || !chatId || !messageId) return null;
  try {
    return await tgApi(env, 'deleteMessage', { chat_id: chatId, message_id: messageId });
  } catch (e) {
    return null;
  }
}

const MAIN_KB = {
  keyboard: [
    [{ text: '📋 Заявки' }, { text: '📊 Статистика' }],
    [{ text: '➕ Добавить объект' }, { text: '✍️ Написать в блог' }],
    [{ text: '🔗 Пригласить' }, { text: '👥 Люди' }],
    [{ text: '♻️ Сброс' }, { text: '🌐 Открыть сайт' }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

/* Кнопки под сообщениями со списками/сводкой */
const NAV_KB = {
  inline_keyboard: [[
    { text: '🔄 Обновить', callback_data: 'nav:refresh' },
    { text: '📋 Заявки', callback_data: 'nav:leads' },
    { text: '📊 Статистика', callback_data: 'nav:stats' }
  ]]
};

export { json, esc, clean, corsHeaders, corsPreflight, randomHex, ipHash, rateLimited, readJson, tgApi, tgSend, tgNotify, tgDelete, tgPurge, isAdmin, adminIds, allAdminIds, extraAdminIds, isAllowedAdmin, setExtraAdmins, STATUSES, EVENT_TYPES, MAIN_KB, NAV_KB };
