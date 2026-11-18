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

async function ghGet(env, path) {
  const branch = env.GITHUB_BRANCH || 'main';
  const r = await fetch(API + '/repos/' + env.GITHUB_REPO + '/contents/' + path + '?ref=' + branch, { headers: headers(env) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('gh get ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

async function ghPut(env, path, base64, message, sha) {
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
 * Проверка доступа: читает репозиторий и файл каталога.
 * Возвращает права (push) и количество объектов — по ним видно, рабочий ли токен.
 */
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
      address: draft.address || '',
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
