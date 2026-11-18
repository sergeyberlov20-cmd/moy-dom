import { esc, tgApi, tgSend } from './lib.js';
import { addObjectToCatalog, bytesToBase64 } from './github.js';
import { parseObjectLine } from './quickparse.js';

const TYPES = ['Квартира', 'Дом', 'Земельный участок', 'Офис', 'Гараж'];
const DEALS = ['Продажа', 'Аренда'];
const TTL = 900; // 15 минут на заполнение

const key = (uid) => 'add:' + uid;

async function getState(env, uid) {
  const s = await env.KV.get(key(uid));
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}
async function putState(env, uid, st) {
  await env.KV.put(key(uid), JSON.stringify(st), { expirationTtl: TTL });
}
export async function dropState(env, uid) {
  await env.KV.delete(key(uid));
}

function kbRows(list, prefix) {
  const rows = [];
  for (let i = 0; i < list.length; i += 3) {
    rows.push(list.slice(i, i + 3).map((t, j) => ({ text: t, callback_data: prefix + (i + j) })));
  }
  return { inline_keyboard: rows };
}

export async function startAdd(env, chatId, uid) {
  await putState(env, uid, { step: 'type' });
  await tgSend(env, chatId,
    '➕ <b>Новый объект</b>\nШаг 1/7 — тип недвижимости:\n\n' +
    '💡 После выбора типа и сделки можно всё сразу одной строкой:\n' +
    '<code>Название | Цена | Адрес | Комнаты Площадь</code>',
    kbRows(TYPES, 'add:type:'));
}

function summary(st) {
  return '📦 <b>Проверьте объект</b>\n\n' +
    'Тип: <b>' + esc(st.type) + '</b>\n' +
    'Сделка: <b>' + esc(st.deal) + '</b>\n' +
    'Название: ' + esc(st.title) + '\n' +
    'Цена: <b>' + Number(st.price).toLocaleString('ru-RU') + ' ₽</b>\n' +
    'Адрес: ' + esc(st.address) + '\n' +
    (st.rooms ? 'Комнат: ' + st.rooms + (st.area ? ', площадь: ' + st.area + ' м²' : '') + '\n' : '') +
    'Фото: ' + (st.photoFileId ? 'есть ✅' : 'нет');
}

/* кнопки: тип, сделка, публикация, отмена */
export async function handleAddCallback(env, query) {
  const uid = query.from ? query.from.id : 0;
  const chatId = query.message ? query.message.chat.id : uid;
  const data = query.data || '';
  const st = await getState(env, uid);

  if (data === 'add:cancel') {
    await dropState(env, uid);
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Отменено' });
    await tgSend(env, chatId, '❌ Добавление отменено.');
    return new Response('ok');
  }

  if (!st) {
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Сессия истекла, начните заново: /add' });
    return new Response('ok');
  }

  if (data.indexOf('add:type:') === 0) {
    st.type = TYPES[Number(data.split(':')[2])] || TYPES[0];
    st.step = 'deal';
    await putState(env, uid, st);
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: st.type });
    await tgSend(env, chatId, 'Шаг 2/7 — сделка:', kbRows(DEALS, 'add:deal:'));
    return new Response('ok');
  }

  if (data.indexOf('add:deal:') === 0) {
    st.deal = DEALS[Number(data.split(':')[2])] || DEALS[0];
    st.step = 'title';
    await putState(env, uid, st);
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: st.deal });
    await tgSend(env, chatId, 'Шаг 3/7 — напишите <b>название</b> объекта.\nНапример: «2-комнатная квартира в центре, 46 м²»');
    return new Response('ok');
  }

  if (data === 'add:publish') return await publish(env, chatId, uid, st, query);

  await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Непонятная кнопка' });
  return new Response('ok');
}

/* публикация в каталог */
async function publish(env, chatId, uid, st, query) {
  st.step = 'publishing';
  await putState(env, uid, st);
  await tgApi(env, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Публикую…' });

  const draft = {
    type: st.type, deal: st.deal, title: st.title, price: st.price,
    address: st.address, rooms: st.rooms, area: st.area, description: ''
  };

  if (st.photoFileId) {
    try {
      const file = await tgApi(env, 'getFile', { file_id: st.photoFileId });
      if (file && file.ok && file.result && file.result.file_path) {
        const bin = await fetch('https://api.telegram.org/file/bot' + env.BOT_TOKEN + '/' + file.result.file_path);
        if (bin.ok) {
          draft.photoBase64 = bytesToBase64(new Uint8Array(await bin.arrayBuffer()));
          draft.photoExt = (file.result.file_path.split('.').pop() || 'jpg').toLowerCase();
        }
      }
    } catch (e) { /* фото не критично */ }
  }

  try {
    const obj = await addObjectToCatalog(env, draft);
    await dropState(env, uid);
    await tgSend(env, chatId,
      '✅ <b>Объект №' + obj.id + ' в каталоге</b>\n\n' +
      esc(obj.title) + '\n' + Number(obj.price).toLocaleString('ru-RU') + ' ₽\n\n' +
      'Через 1–2 минуты появится на сайте:\nhttps://dom-mc.ru/object.html?id=' + obj.id);
  } catch (e) {
    await putState(env, uid, st);
    await tgSend(env, chatId, '⚠️ Не удалось опубликовать: ' + esc(String((e && e.message) || e)) +
      '\n\nПроверьте GITHUB_TOKEN (права Contents: Read and write) и начните заново: /add');
  }
  return new Response('ok');
}

/* текст и фото по шагам */
export async function handleAddMessage(env, msg, uid) {
  const chatId = msg.chat.id;
  const st = await getState(env, uid);
  if (!st) return;

  const text = (msg.text || '').trim();

  if (st.step === 'title') {
    // быстрый ввод: Название | Цена | Адрес | Комнаты Площадь
    const quick = parseObjectLine(text);
    if (quick) {
      if (quick.error === 'title') { await tgSend(env, chatId, 'Название — от 5 до 120 символов. Проверьте первый блок.'); return; }
      if (quick.error === 'price') { await tgSend(env, chatId, 'Цена должна быть числом от 1 000 ₽. Проверьте второй блок.'); return; }
      if (quick.error === 'address') { await tgSend(env, chatId, 'Адрес — минимум 3 символа. Проверьте третий блок.'); return; }

      st.title = quick.title;
      st.price = quick.price;
      st.address = quick.address;
      st.rooms = quick.rooms;
      st.area = quick.area;
      st.step = 'photo';
      await putState(env, uid, st);
      await tgSend(env, chatId,
        '⚡ <b>Заполнил одной строкой</b>\n\n' +
        esc(quick.title) + '\n' + Number(quick.price).toLocaleString('ru-RU') + ' ₽\n' + esc(quick.address) +
        (quick.rooms ? '\nКомнат: ' + quick.rooms + (quick.area ? ', площадь: ' + quick.area + ' м²' : '') : '') +
        '\n\nОсталось фото: пришлите картинку или /skip');
      return;
    }
    if (text.indexOf('|') >= 0) {
      await tgSend(env, chatId,
        'Не разобрал строку. Формат:\n<code>Название | Цена | Адрес | Комнаты Площадь</code>\n' +
        'Например: <code>2-комнатная в центре | 4500000 | г. Мариуполь, пр. Ленина 54 | 2 46</code>\n\n' +
        'Или пришлите только название — спрошу остальное по шагам.');
      return;
    }

    if (text.length < 5 || text.length > 120) {
      await tgSend(env, chatId, 'Название — от 5 до 120 символов. Пришлите ещё раз.');
      return;
    }
    st.title = text; st.step = 'price';
    await putState(env, uid, st);
    await tgSend(env, chatId,
      'Шаг 4/7 — <b>цена</b> в рублях (только цифры).\nНапример: 4500000\n\n' +
      '💡 Можно было одной строкой: <code>Название | Цена | Адрес | Комнаты Площадь</code>');
    return;
  }

  if (st.step === 'price') {
    const n = Number(text.replace(/[^\d]/g, ''));
    if (!n || n < 1000 || n > 2000000000) {
      await tgSend(env, chatId, 'Цену пришлите числом, например 4500000');
      return;
    }
    st.price = n; st.step = 'address';
    await putState(env, uid, st);
    await tgSend(env, chatId, 'Шаг 5/7 — <b>адрес</b> (район, улица).\nНапример: г. Мариуполь, ул. Варганова');
    return;
  }

  if (st.step === 'address') {
    if (text.length < 3) { await tgSend(env, chatId, 'Адрес слишком короткий, пришлите ещё раз.'); return; }
    st.address = text; st.step = 'rooms';
    await putState(env, uid, st);
    await tgSend(env, chatId, 'Шаг 6/7 — <b>комнаты и площадь</b> через пробел.\nНапример: <code>2 46</code>\nДля участка или гаража отправьте «-»');
    return;
  }

  if (st.step === 'rooms') {
    if (text === '-') { st.rooms = 0; st.area = 0; }
    else {
      const p = text.split(/\s+/).map((x) => Number(x.replace(/[^\d.]/g, '')));
      st.rooms = p[0] || 0;
      st.area = p[1] || 0;
    }
    st.step = 'photo';
    await putState(env, uid, st);
    await tgSend(env, chatId, 'Шаг 7/7 — <b>фото</b> объекта.\nОтправьте картинку как фото или напишите /skip');
    return;
  }

  if (st.step === 'photo') {
    if (Array.isArray(msg.photo) && msg.photo.length) {
      const photo = msg.photo[msg.photo.length - 1];
      st.photoFileId = photo.file_id;
    } else if (text === '/skip' || text.toLowerCase() === 'skip') {
      st.photoFileId = '';
    } else {
      await tgSend(env, chatId, 'Нужна фотография (именно фото, не файлом) или /skip');
      return;
    }
    st.step = 'confirm';
    await putState(env, uid, st);
    await tgSend(env, chatId, summary(st), {
      inline_keyboard: [[
        { text: '✅ Опубликовать', callback_data: 'add:publish' },
        { text: '❌ Отмена', callback_data: 'add:cancel' }
      ]]
    });
    return;
  }
}
