// worker/src/monitor.js — ежечасная проверка сайта и API
export async function monitor(env) {
  const sites = [
    { name: "сайт", url: "https://dom-mc.ru/" },
    { name: "API", url: "https://moydom-leads.sergeyberlov20.workers.dev/api/status" }
  ];

  const bad = [];
  for (const s of sites) {
    try {
      const r = await fetch(s.url, { method: "GET", cf: { cacheTtl: 0 } });
      if (!r.ok) bad.push(s.name + " — HTTP " + r.status);
    } catch (e) {
      bad.push(s.name + " — " + (e.message || "недоступен"));
    }
  }

  if (!bad.length) return { ok: true };

  const ids = String(env.ADMIN_IDS || env.ADMIN_ID || "").split(/[,\s]+/).filter(Boolean);
  const text = "⚠️ <b>Проверка не прошла</b>\n" + bad.join("\n") + "\n\n" + new Date().toISOString();

  for (const id of ids) {
    try {
      await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id, text, parse_mode: "HTML" })
      });
    } catch (e) {}
  }

  return { ok: false, bad };
}
