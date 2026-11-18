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

const tgSend = (env, chatId, text, reply_markup) =>
  tgApi(env, 'sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', reply_markup, disable_web_page_preview: true
  });

const isAdmin = (env, userId) =>
  String(env.ADMIN_IDS || '').split(',').map((s) => s.trim()).includes(String(userId));

export { json, esc, clean, corsHeaders, corsPreflight, randomHex, ipHash, rateLimited, readJson, tgApi, tgSend, isAdmin, STATUSES, EVENT_TYPES };
