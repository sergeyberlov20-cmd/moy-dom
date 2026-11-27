// worker/src/tgqueue.js — очередь объектов из Telegram (D1) + приём цены
export async function handleTgQueue(request, env, ctx) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  const secret = env.WEBHOOK_SECRET || "";
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  if (!secret || key !== secret) return json({ ok: false, error: "forbidden" }, 403);

  const db = env.DB;
  if (!db) return json({ ok: false, error: "нет базы" }, 500);

  // список
  if (request.method === "GET") {
    const rows = await db.prepare("SELECT id, post, status, price, created_at FROM tg_queue ORDER BY id DESC LIMIT 50").all();
    return json({ ok: true, items: rows.results || [] });
  }

  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);

  let body = {};
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }

  // добавление пачки объектов из локального парсера
  if (Array.isArray(body.items)) {
    let added = 0;
    for (const it of body.items) {
      if (!it || !it.tg) continue;
      const post = String(it.tg);
      const price = Number(it.price) || 0;
      const status = it.needsPrice || !price ? "need-price" : "pending";
      try {
        await db.prepare(
          "INSERT INTO tg_queue (post, status, price, payload) VALUES (?, ?, ?, ?) ON CONFLICT(post) DO UPDATE SET payload = excluded.payload"
        ).bind(post, status, price, JSON.stringify(it)).run();
        added++;
      } catch (e) {}
    }
    return json({ ok: true, added });
  }

  // установка цены: {post: "3569", price: 4000000}
  if (body.post && body.price) {
    const post = String(body.post);
    const price = Math.round(Number(body.price));
    if (!price || price < 1000) return json({ ok: false, error: "цена подозрительно мала" }, 400);
    await db.prepare("UPDATE tg_queue SET price = ?, status = 'ready' WHERE post = ?").bind(price, post).run();
    const row = await db.prepare("SELECT post, price, status FROM tg_queue WHERE post = ?").bind(post).first();
    return json({ ok: true, item: row || null });
  }

  return json({ ok: false, error: "неизвестный запрос" }, 400);
}
