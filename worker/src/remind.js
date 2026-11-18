import { esc, tgSend, MAIN_KB } from './lib.js';

/* Напоминание о заявках, которые висят «новыми» дольше 30 минут */
export async function remindStale(env) {
  if (!env.BOT_TOKEN || !env.TG_CHAT_ID) return;

  const rows = await env.DB.prepare(
    "SELECT id, name, phone FROM leads " +
    "WHERE status = 'new' AND reminded_at IS NULL AND created_at <= datetime('now','-30 minutes') " +
    "ORDER BY id LIMIT 10"
  ).all();

  const list = rows.results || [];
  if (!list.length) return;

  const text = '⏰ <b>Заявки без ответа дольше 30 минут</b>\n\n' +
    list.map((r) => '• №' + r.id + ' — ' + esc(r.name || 'без имени') + ', ' + esc(r.phone)).join('\n') +
    '\n\nПанель: https://dom-mc.ru/admin/leads.html';

  await tgSend(env, env.TG_CHAT_ID, text, MAIN_KB);

  const ids = list.map((r) => r.id);
  const marks = ids.map(() => '?').join(',');
  await env.DB.prepare("UPDATE leads SET reminded_at = datetime('now') WHERE id IN (" + marks + ")")
    .bind(...ids).run();
}

/* Сводка из Яндекс.Метрики (если заданы токен и номер счётчика) */
export async function metrikaSummary(env, days) {
  if (!env.METRIKA_TOKEN || !env.METRIKA_COUNTER_ID) return null;

  const d = Number(days) || 7;
  const date2 = new Date().toISOString().slice(0, 10);
  const date1 = new Date(Date.now() - (d - 1) * 86400000).toISOString().slice(0, 10);
  const url = 'https://api-metrika.yandex.net/stat/v1/data?ids=' + encodeURIComponent(env.METRIKA_COUNTER_ID) +
    '&metrics=ym:s:visits,ym:s:users,ym:s:pageviews&date1=' + date1 + '&date2=' + date2 + '&accuracy=full';

  try {
    const r = await fetch(url, { headers: { Authorization: 'OAuth ' + env.METRIKA_TOKEN } });
    if (!r.ok) return { error: 'metrika ' + r.status };
    const j = await r.json();
    const t = (j.totals || [])[0] || [];
    return { visits: t[0] || 0, users: t[1] || 0, pageviews: t[2] || 0, date1: date1, date2: date2 };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}
