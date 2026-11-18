/**
 * Ссылки-приглашения: владелец создаёт код, человек открывает ссылку,
 * нажимает Start в боте — и автоматически получает доступ. Код одноразовый.
 */
import { randomHex, adminIds, extraAdminIds, setExtraAdmins } from './lib.js';

const TTL = 60 * 60 * 24; // 24 часа
const key = (code) => 'invite:' + code;

const normalize = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export async function createInvite(env, byUserId) {
  const code = normalize(randomHex(4));
  await env.KV.put(key(code), JSON.stringify({ by: String(byUserId), at: Date.now() }), { expirationTtl: TTL });
  return code;
}

export async function acceptInvite(env, code, userId) {
  const c = normalize(code);
  if (!c) return { ok: false, reason: 'empty' };

  const raw = await env.KV.get(key(c));
  if (!raw) return { ok: false, reason: 'invalid' };

  const id = String(userId);
  if (adminIds(env).indexOf(id) >= 0) {
    await env.KV.delete(key(c));
    return { ok: true, already: true, code: c };
  }

  const extra = await extraAdminIds(env);
  if (extra.indexOf(id) < 0) await setExtraAdmins(env, extra.concat([id]));
  await env.KV.delete(key(c)); // приглашение одноразовое
  return { ok: true, already: false, code: c };
}

/**
 * Обмен приглашения на сессию панели: человек открывает ссылку и сразу попадает в админку.
 * Код одноразовый (после обмена удаляется).
 */
export async function redeemInviteForPanel(env, code) {
  const c = normalize(code);
  if (!c) return { ok: false, error: 'empty' };

  const raw = await env.KV.get(key(c));
  if (!raw) return { ok: false, error: 'invalid' };

  const token = randomHex(32);
  await env.KV.put('sess:' + token, 'invite', { expirationTtl: 60 * 60 * 24 * 30 });
  await env.KV.delete(key(c));
  return { ok: true, token: token };
}

/** Проверка кода без сжигания — для страницы /admin/join.html */
export async function peekInvite(env, code) {
  const c = normalize(code);
  if (!c) return false;
  return !!(await env.KV.get(key(c)));
}
