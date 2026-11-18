/**
 * Работа с GitHub API: чтение и запись файлов репозитория.
 * Нужен fine-grained токен с правом Contents: Read and write на этот репозиторий.
 */
const API = 'https://api.github.com';

function headers(env, json) {
  const h = {
    Authorization: 'Bearer ' + env.GITHUB_TOKEN,
    'User-Agent': 'moydom-bot',
    Accept: 'application/vnd.github+json'
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function ghGet(env, path) {
  const branch = env.GITHUB_BRANCH || 'main';
  const r = await fetch(API + '/repos/' + env.GITHUB_REPO + '/contents/' + path + '?ref=' + branch, { headers: headers(env) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('gh get ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

export async function ghPut(env, path, base64, message, sha) {
  const body = { message: message, content: base64, branch: env.GITHUB_BRANCH || 'main' };
  if (sha) body.sha = sha;
  const r = await fetch(API + '/repos/' + env.GITHUB_REPO + '/contents/' + path, {
    method: 'PUT',
    headers: headers(env, true),
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('gh put ' + path + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

/* base64 ↔ байты (порциями, чтобы не переполнить стек) */
export function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function base64ToBytes(b64) {
  const bin = atob(String(b64).replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function textToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function base64ToText(b64) {
  return new TextDecoder().decode(base64ToBytes(b64));
}

/**
 * Пробная запись в служебный файл _diag/write-test.txt.
 * Нужна, чтобы отличить «токен только читает» от «права на запись есть»:
 * поле permissions.push в метаданных репозитория врёт для fine-grained токенов.
 */
export async function ghWriteCheck(env) {
  const body = {
    message: 'проверка прав на запись (можно удалить)',
    content: bytesToBase64(new TextEncoder().encode('ok ' + new Date().toISOString())),
    branch: env.GITHUB_BRANCH || 'main'
  };

  const cur = await ghGet(env, '_diag/write-test.txt');
  if (cur) body.sha = cur.sha;

  const r = await fetch(API + '/repos/' + env.GITHUB_REPO + '/contents/_diag/write-test.txt', {
    method: 'PUT',
    headers: headers(env, true),
    body: JSON.stringify(body)
  });

  let msg = null;
  try { const j = await r.json(); msg = j.message || null; } catch (e) { msg = null; }

  return {
    ok: r.ok,
    status: r.status,
    message: msg,
    hint: r.ok ? null : (r.status === 403 ? 'У токена нет права Contents: Read and write — исправьте в настройках токена' : null)
  };
}

export async function ghCheck(env) {
  const repoRes = await fetch(API + '/repos/' + env.GITHUB_REPO, { headers: headers(env) });
  let info = null;
  try { info = await repoRes.json(); } catch (e) { info = null; }

  const file = await ghGet(env, env.DATA_FILE || 'js/data.json');
  let objects = null;
  if (file) {
    try {
      const j = JSON.parse(base64ToText(file.content));
      const list = Array.isArray(j) ? j : j.objects || [];
      objects = list.length;
    } catch (e) { objects = 'ошибка разбора'; }
  }

  return {
    ok: repoRes.ok && !!file,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH || 'main',
    repoStatus: repoRes.status,
    repoMessage: info && info.message ? info.message : null,
    push: info && info.permissions ? !!info.permissions.push : null,
    file: !!file,
    fileSha: file ? file.sha : null,
    objects: objects
  };
}

/**
 * Публичный адрес объекта: только район и улица, без номера дома и участка.
 * Правило проекта: точные адреса объектов на сайте не публикуем.
 */
function publicAddress(addr) {
  let s = String(addr == null ? '' : addr).trim();
  if (!s) return '';
  s = s.replace(/[,;]?\s*(?:д\.?|дом|уч\.?|участок)\s*\d+[а-яa-z]?(?:\s*[\/-]\s*\d+[а-яa-z]?)?\s*$/i, '');
  s = s.replace(/[,;]\s*\d+[а-яa-z]?(?:\s*[\/-]\s*\d+[а-яa-z]?)?\s*$/, '');
  return s.replace(/\s{2,}/g, ' ').replace(/[,;]\s*$/, '').trim();
}

/* Меняет цену объекта в каталоге */
export async function setObjectPrice(env, id, price) {
  const dataPath = env.DATA_FILE || 'js/data.json';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const file = await ghGet(env, dataPath);
    if (!file) throw new Error('каталог не найден');
    const json = JSON.parse(base64ToText(file.content));
    const list = Array.isArray(json) ? json : json.objects;
    const obj = list.find((o) => Number(o.id) === Number(id));
    if (!obj) throw new Error('объект №' + id + ' не найден');
    const old = obj.price;
    obj.price = Number(price);
    try {
      await ghPut(env, dataPath, textToBase64(JSON.stringify(json, null, 2) + '\n'),
        'Бот: цена объекта #' + id + ' — ' + Number(price).toLocaleString('ru-RU') + ' ₽', file.sha);
      return { id: Number(id), title: obj.title, old: old, price: Number(price) };
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

/* Снимает объект с публикации (удаляет из каталога, фото остаются на диске) */
export async function removeObjectFromCatalog(env, id) {
  const dataPath = env.DATA_FILE || 'js/data.json';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const file = await ghGet(env, dataPath);
    if (!file) throw new Error('каталог не найден');
    const json = JSON.parse(base64ToText(file.content));
    const list = Array.isArray(json) ? json : json.objects;
    const idx = list.findIndex((o) => Number(o.id) === Number(id));
    if (idx < 0) throw new Error('объект №' + id + ' не найден');
    const removed = list.splice(idx, 1)[0];
    try {
      await ghPut(env, dataPath, textToBase64(JSON.stringify(json, null, 2) + '\n'),
        'Бот: объект #' + id + ' снят с публикации — ' + removed.title, file.sha);
      return { id: Number(id), title: removed.title, left: list.length };
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

/**
 * Добавляет объект в каталог (js/data.json) и, если есть фото, коммитит его в images/uploads.
 * Возвращает созданный объект.
 */
export async function addObjectToCatalog(env, draft) {
  const dataPath = env.DATA_FILE || 'js/data.json';

  for (let attempt = 1; attempt <= 3; attempt++) {
    const file = await ghGet(env, dataPath);
    if (!file) throw new Error('файл каталога не найден: ' + dataPath);

    const json = JSON.parse(base64ToText(file.content));
    const list = Array.isArray(json) ? json : json.objects;
    if (!Array.isArray(list)) throw new Error('неожиданный формат каталога');

    const nextId = list.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0) + 1;

    let imagePath = '';
    if (draft.photoBase64) {
      imagePath = 'images/uploads/add-' + nextId + '.' + (draft.photoExt || 'jpg');
      await ghPut(env, imagePath, draft.photoBase64, 'Бот: фото объекта #' + nextId);
    }

    const obj = {
      id: nextId,
      type: draft.type,
      deal: draft.deal,
      title: draft.title,
      price: Number(draft.price) || 0,
      address: publicAddress(draft.address),
      phone: env.OBJECT_PHONE || '+7 (949) 504-44-55',
      rooms: Number(draft.rooms) || 0,
      area: Number(draft.area) || 0,
      floor: 0,
      floors: 0,
      image: imagePath || 'images/logo.png',
      images: [imagePath || 'images/logo.png'],
      description: draft.description || '',
      date: new Date().toISOString().slice(0, 10)
    };

    list.unshift(obj);

    const text = JSON.stringify(json, null, 2) + '\n';
    try {
      await ghPut(env, dataPath, textToBase64(text), 'Бот: объект #' + nextId + ' — ' + draft.title, file.sha);
      return obj;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((res) => setTimeout(res, 400));
    }
  }
  throw new Error('не удалось обновить каталог');
}
/** Читает каталог объектов (js/data.json) */
export async function loadCatalog(env) {
  const file = await ghGet(env, env.DATA_FILE || 'js/data.json');
  if (!file) return [];
  const json = JSON.parse(base64ToText(file.content));
  return Array.isArray(json) ? json : (json.objects || []);
}
/** Удаляет файл из репозитория */
export async function ghDelete(env, path, message, sha) {
  const r = await fetch(API + '/repos/' + env.GITHUB_REPO + '/contents/' + path, {
    method: 'DELETE',
    headers: headers(env, true),
    body: JSON.stringify({ message: message, sha: sha, branch: env.GITHUB_BRANCH || 'main' })
  });
  if (!r.ok) throw new Error('gh delete ' + path + ' ' + r.status);
  return r.json();
}