/**
 * Шаги диалога поста: заголовок → текст → фото → дата.
 */
import { tgSend } from './lib.js';
import { getPostState, putPostState, CANCEL_KB, CONFIRM_KB, DATE_KB, postSummary } from './post.js';
import { parsePostLine } from './quickparse.js';
import { dateText } from './postutil.js';

export async function handlePostMessage(env, msg, uid) {
  const chatId = msg.chat.id;
  const st = await getPostState(env, uid);
  if (!st) return;
  const text = (msg.text || '').trim();

  if (st.step === 'title') {
    if (text.length < 5 || text.length > 120) {
      await tgSend(env, chatId, 'Заголовок — от 5 до 120 символов. Пришлите ещё раз.', CANCEL_KB);
      return;
    }
    st.title = text;
    st.step = 'text';
    await putPostState(env, uid, st);
    await tgSend(env, chatId, 'Шаг 2 из 4 — пришлите <b>текст поста</b>.\nАбзацы разделяйте пустой строкой; первый абзац станет вступлением.', CANCEL_KB);
    return;
  }

  if (st.step === 'text') {
    // быстрый ввод: Текст поста | дата
    const quick = parsePostLine(text);
    if (quick) {
      if (quick.error === 'text') {
        await tgSend(env, chatId, 'Текст слишком короткий (меньше 30 символов). Пришлите полный текст.', CANCEL_KB);
        return;
      }
      st.text = quick.text;
      st.date = quick.date;
      st.preDate = true;
      st.step = 'photo';
      await putPostState(env, uid, st);
      await tgSend(env, chatId,
        '⚡ <b>Текст и дата приняты</b> (' + dateText(quick.date) + ')\n\n' +
        'Осталось фото: пришлите картинку или /skip', CANCEL_KB);
      return;
    }

    if (text.length < 30) {
      await tgSend(env, chatId, 'Текст слишком короткий (меньше 30 символов). Пришлите полный текст.', CANCEL_KB);
      return;
    }
    st.text = text.slice(0, 5000);
    st.step = 'photo';
    await putPostState(env, uid, st);
    await tgSend(env, chatId, 'Шаг 3 из 4 — <b>фото</b> для поста.\nОтправьте картинку или напишите «/skip».', CANCEL_KB);
    return;
  }

  if (st.step === 'photo') {
    if (Array.isArray(msg.photo) && msg.photo.length) {
      st.photoFileId = msg.photo[msg.photo.length - 1].file_id;
    } else if (msg.document && /^image\//.test(msg.document.mime_type || '')) {
      st.photoFileId = msg.document.file_id;
    } else if (text === '/skip' || text.toLowerCase() === 'skip') {
      st.photoFileId = '';
    } else {
      await tgSend(env, chatId, 'Нужна картинка (как фото или файлом) или «/skip».', CANCEL_KB);
      return;
    }
    st.step = st.preDate ? 'confirm' : 'date';
    await putPostState(env, uid, st);
    if (st.step === 'confirm') {
      await tgSend(env, chatId, postSummary(st), CONFIRM_KB);
      return;
    }
    await tgSend(env, chatId, 'Шаг 4 из 4 — <b>когда публиковать?</b>\nВыберите кнопку или пришлите дату вида <code>2026-12-01</code>.', DATE_KB);
    return;
  }

  if (st.step === 'date') {
    let iso = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) iso = text;
    else {
      const m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (m) iso = m[3] + '-' + m[2] + '-' + m[1];
    }
    if (!iso || isNaN(new Date(iso).getTime())) {
      await tgSend(env, chatId, 'Пришлите дату как <code>2026-12-01</code> или выберите кнопку.', DATE_KB);
      return;
    }
    st.date = iso;
    st.step = 'confirm';
    await putPostState(env, uid, st);
    await tgSend(env, chatId, postSummary(st), CONFIRM_KB);
    return;
  }

  if (st.step === 'confirm') {
    let iso = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) iso = text;
    else {
      const m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (m) iso = m[3] + '-' + m[2] + '-' + m[1];
    }
    if (!iso || isNaN(new Date(iso).getTime())) {
      await tgSend(env, chatId, 'Нажмите «✅ Опубликовать» или пришлите другую дату: <code>2026-12-01</code>', CONFIRM_KB);
      return;
    }
    st.date = iso;
    await putPostState(env, uid, st);
    await tgSend(env, chatId, postSummary(st), CONFIRM_KB);
    return;
  }
}
