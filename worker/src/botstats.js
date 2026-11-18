/**
 * Учёт тех, кто пользуется ботом: кто писал, когда, сколько раз, есть ли доступ.
 */
import { esc } from './lib.js';

/* Отметить активность пользователя (вызывается на каждое сообщение и нажатие кнопки) */
export async function touchBotUser(env, from, opts) {
  if (!from || !from.id) return;
  const id = String(from.id);
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 60);
  const username = from.username ? '@' + from.username : '';
  const isCmd = opts && opts.command ? 1 : 0;
  const allowed = opts && opts.allowed ? 1 : 0;

  try {
    await env.DB.prepare(
      "INSERT INTO bot_users (user_id, name, username, messages, commands, allowed, first_seen, last_seen) " +
      "VALUES (?, ?, ?, 1, ?, ?, datetime('now'), datetime('now')) " +
      "ON CONFLICT(user_id) DO UPDATE SET " +
      "messages = messages + 1, " +
      "commands = commands + excluded.commands, " +
      "name = excluded.name, " +
      "username = excluded.username, " +
      "allowed = excluded.allowed, " +
      "last_seen = datetime('now')"
    ).bind(id, name, username, isCmd, allowed).run();
  } catch (e) {
    /* статистика не должна ломать работу бота */
  }
}

const one = async (env, sql, ...args) => {
  try {
    const r = await env.DB.prepare(sql).bind(...args).first();
    return r || {};
  } catch (e) {
    return {};
  }
};

/* Короткая строка для утренней сводки */
export async function botUsersLine(env) {
  const t = await one(env, "SELECT COUNT(*) AS n, SUM(allowed) AS a FROM bot_users");
  const w = await one(env, "SELECT COUNT(*) AS n FROM bot_users WHERE last_seen >= datetime('now','-6 days')");
  if (!t.n) return '';
  return '👥 Пользуются ботом: <b>' + t.n + '</b> (с доступом: ' + (t.a || 0) + ', активны за 7 дней: ' + (w.n || 0) + ')\n';
}

/* Подробная сводка по команде /botstats */
export async function botStatsText(env) {
  const total = await one(env, "SELECT COUNT(*) AS n, SUM(allowed) AS a FROM bot_users");
  if (!total.n) {
    return '👥 <b>Пользователи бота</b>\n\nПока никто не писал боту.';
  }

  const today = await one(env, "SELECT COUNT(*) AS n FROM bot_users WHERE date(last_seen) = date('now')");
  const week = await one(env, "SELECT COUNT(*) AS n FROM bot_users WHERE last_seen >= datetime('now','-6 days')");
  const msgs = await one(env, "SELECT SUM(messages) AS m, SUM(commands) AS c FROM bot_users");

  let rows = [];
  try {
    const r = await env.DB.prepare(
      "SELECT user_id, name, username, messages, commands, allowed, first_seen, last_seen " +
      "FROM bot_users ORDER BY last_seen DESC LIMIT 12"
    ).all();
    rows = r.results || [];
  } catch (e) {
    rows = [];
  }

  const list = rows.map((u) => {
    const who = esc(u.name || 'без имени') + (u.username ? ' ' + esc(u.username) : '');
    const mark = u.allowed ? '✅' : '⛔';
    return mark + ' ' + who + ' — <code>' + esc(u.user_id) + '</code>\n' +
      '   сообщений: ' + (u.messages || 0) + ', команд: ' + (u.commands || 0) + ', был: ' + esc(u.last_seen) + ' UTC';
  }).join('\n');

  return '👥 <b>Пользователи бота</b>\n\n' +
    'Всего писавших: <b>' + total.n + '</b>\n' +
    'С доступом: <b>' + (total.a || 0) + '</b> · без доступа: ' + (total.n - (total.a || 0)) + '\n' +
    'Активны сегодня: <b>' + (today.n || 0) + '</b> · за 7 дней: <b>' + (week.n || 0) + '</b>\n' +
    'Сообщений всего: ' + (msgs.m || 0) + ' · команд: ' + (msgs.c || 0) + '\n\n' +
    '<b>Последние ' + rows.length + ':</b>\n' + list;
}
