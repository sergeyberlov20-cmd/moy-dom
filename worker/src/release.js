/**
 * Снятие noindex с постов, у которых наступила дата публикации.
 * Вызывается по крону (раз в день) и вручную через /api/post/release.
 */
import { ghGet, ghPut, textToBase64, base64ToText } from './github.js';
import { json } from './lib.js';

/** GET /api/post/release?key=… — снять noindex с постов, чья дата наступила */
export async function postRelease(request, env) {
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!env.WEBHOOK_SECRET || key !== env.WEBHOOK_SECRET) return json({ ok: false, error: 'forbidden' }, 403);
  try {
    const r = await releaseScheduled(env);
    return json(Object.assign({ ok: true }, r));
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}

export async function releaseScheduled(env) {
  if (!env.GITHUB_TOKEN) return { released: 0, reason: 'no token' };
  const today = new Date().toISOString().slice(0, 10);

  const idx = await ghGet(env, 'blog/index.html');
  if (!idx) return { released: 0, reason: 'no index' };
  const text = base64ToText(idx.content);

  const re = /<article class="blog-card"[^>]*data-publish="(\d{4}-\d{2}-\d{2})"[\s\S]*?<a class="blog-card-img" href="([^"]+)"/g;
  const slugs = [];
  let m;
  while ((m = re.exec(text))) {
    if (m[1] <= today) {
      const slug = m[2].replace(/\.html$/, '');
      if (slugs.indexOf(slug) === -1) slugs.push(slug);
    }
  }

  const done = [];
  for (const slug of slugs) {
    const f = await ghGet(env, 'blog/' + slug + '.html');
    if (!f) continue;
    const html = base64ToText(f.content);
    if (html.indexOf('content="noindex"') === -1) continue;
    const clean = html.replace(/\s*<meta name="robots" content="noindex">\s*/g, '\n');
    await ghPut(env, 'blog/' + slug + '.html', textToBase64(clean), 'Бот: публикация по плану — ' + slug, f.sha);
    done.push(slug);
  }
  return { released: done.length, slugs: done, date: today };
}
