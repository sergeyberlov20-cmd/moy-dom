import { json } from './lib.js';
import { ghCheck, ghWriteCheck } from './github.js';

function allowed(request, env) {
  const key = new URL(request.url).searchParams.get('key') || '';
  return !!env.WEBHOOK_SECRET && key === env.WEBHOOK_SECRET;
}

/**
 * GET /api/diag/gh?key=…  — проверка GitHub-токена и доступа к каталогу
 * GET /api/diag/gh?key=…&write=1 — плюс пробная запись (создаёт коммит _diag/write-test.txt)
 */
export async function ghDiag(request, env) {
  if (!allowed(request, env)) return json({ ok: false, error: 'forbidden' }, 403);

  const repo = env.GITHUB_REPO || '';
  const branch = env.GITHUB_BRANCH || 'main';
  if (!env.GITHUB_TOKEN) {
    return json({ ok: false, error: 'GITHUB_TOKEN не задан', repo: repo, branch: branch });
  }
  if (!repo) {
    return json({ ok: false, error: 'GITHUB_REPO не задан' });
  }

  const wantWrite = new URL(request.url).searchParams.get('write') === '1';

  try {
    const res = await ghCheck(env);
    if (wantWrite) {
      try {
        res.write = await ghWriteCheck(env);
      } catch (e) {
        res.write = { ok: false, error: String((e && e.message) || e) };
      }
    }
    return json(res);
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e), repo: repo, branch: branch });
  }
}
