/**
 * Диалог «написать пост в блог»: состояние, старт, публикация.
 */
import { tgApi, tgSend } from './lib.js';
import { publishPost } from './publish.js';
import { dateText } from './postutil.js';

const TTL = 1800;
const key = (uid) => 'post:' + uid;

export async function getPostState(env, uid) {
  const s = await env.KV.get(key(uid));
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}
export const putPostState = (env, uid, st) => env.KV.put(key(uid), JSON.stringify(st), { expirationTtl: TTL });
export const dropPostState = (env, uid) => env.KV.delete(key(uid));
export const isPosting = async (env, uid) => !!(await env.KV.get(key(uid)));

export const CANCEL_KB = { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'post:cancel' }]] };
export const CONFIRM_KB = {
  inline_keyboard: [[
    { text: '✅ Опубликовать', callback_data: 'post:publish' },
    { text: '❌ Отмена', callback_data: 'post:cancel' }
  ]]
};
export const DATE_KB = {
  inline_keyboard: [
    [{ text: 'Сегодня', callback_data: 'post:date:0' }, { text: 'Завтра', callback_data: 'post:date:1' }],
    [{ text: 'Через 3 дня', callback_data: 'post:date:3' }, { text: 'Через неделю', callback_data: 'post:date:7' }],
    [{ text: '❌ Отмена', callback_data: 'post:cancel' }]
  ]
};

export async function startPost(env, chatId, uid) {
  await putPostState(env, uid, { step: 'title' });
  await tgSend(env, chatId, '✍️ <b>Новый пост в блог</b>\n\nШаг 1 из 4 — пришлите <b>заголовок</b>.', CANCEL_KB);
}

export function postSummary(st) {
  const paras = String(st.text || '').split(/\r?\n\s*\r?\n/).filter((t) => t.trim());
  const today = new Date().toISOString().slice(0, 10);
  return '📝 <b>Пост готов</b>\n\n' +
    'Заголовок: <b>' + st.title + '</b>\n' +
    'Абзацев: ' + paras.length + '\n' +
    'Фото: ' + (st.photoFileId ? 'есть ✅' : 'нет') + '\n' +
    'Дата: <b>' + dateText(st.date) + '</b>' + (st.date > today ? ' — выйдет в этот день' : ' — сразу');
}

export async function handlePostCallback(env, query) {
  const uid = query.from ? query.from.id : 0;
  const chatId = query.message ? query.message.chat.id : uid;
  const data = query.data || '';
  const st = await getPostState(env, uid);

  if (data === 'post:cancel') {
    await dropPostState(env, uid);
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Отменено' });
    await tgSend(env, chatId, '❌ Публикация отменена.');
    return new Response('ok');
  }

  if (!st) {
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Сессия истекла: /post' });
    return new Response('ok');
  }

  if (data.indexOf('post:date:') === 0) {
    const days = Number(data.split(':')[2]) || 0;
    st.date = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    st.step = 'confirm';
    await putPostState(env, uid, st);
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: dateText(st.date) });
    await tgSend(env, chatId, postSummary(st), {
      inline_keyboard: [[
        { text: '✅ Опубликовать', callback_data: 'post:publish' },
        { text: '❌ Отмена', callback_data: 'post:cancel' }
      ]]
    });
    return new Response('ok');
  }

  if (data === 'post:publish') {
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Публикую…' });

    const draft = { title: st.title, text: st.text, date: st.date };

    if (st.photoFileId) {
      try {
        const file = await tgApi(env, 'getFile', { file_id: st.photoFileId });
        if (file && file.ok && file.result && file.result.file_path) {
          const bin = await fetch('https://api.telegram.org/file/bot' + env.BOT_TOKEN + '/' + file.result.file_path);
          if (bin.ok) {
            const buf = new Uint8Array(await bin.arrayBuffer());
            let s = '';
            for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
            draft.photoBase64 = btoa(s);
            draft.photoExt = (file.result.file_path.split('.').pop() || 'jpg').toLowerCase();
          }
        }
      } catch (e) { /* без фото */ }
    }

    try {
      const res = await publishPost(env, draft);
      await dropPostState(env, uid);
      await tgSend(env, chatId,
        (res.published ? '✅ <b>Пост опубликован</b>' : '🕒 <b>Пост запланирован на ' + dateText(res.date) + '</b>') +
        '\n\n' + res.url + (res.published ? '' : '\n\nВыйдет в блоге сам в этот день.'));
    } catch (e) {
      const m = String((e && e.message) || e);
      const hint = m.indexOf('403') >= 0
        ? '\n\nУ токена GitHub нет права на запись (Contents: Read and write). Исправьте права токена и запустите deploy.ps1.'
        : '';
      await tgSend(env, chatId, '⚠️ Не удалось опубликовать: ' + m + hint);
    }
    return new Response('ok');
  }

  await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Непонятная кнопка' });
  return new Response('ok');
}
