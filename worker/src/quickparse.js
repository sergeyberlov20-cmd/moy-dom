/**
 * Быстрый ввод одной строкой — чтобы добавление объекта или поста
 * не превращалось в 7 сообщений.
 */

export function toIsoDate(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const now = new Date();
  if (s === 'сегодня') return now.toISOString().slice(0, 10);
  if (s === 'завтра') return new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const iso = m[3] + '-' + mo + '-' + d;
    if (!isNaN(new Date(iso).getTime())) return iso;
  }
  return '';
}

/**
 * «Название | Цена | Адрес | Комнаты Площадь»
 * Возвращает null, если это не быстрый ввод (нет разделителей).
 */
export function parseObjectLine(text) {
  const raw = String(text || '');
  if (raw.indexOf('|') < 0) return null;

  const p = raw.split('|').map((s) => s.trim());
  const title = p[0] || '';
  const price = Number(String(p[1] || '').replace(/[^\d]/g, ''));
  const address = p[2] || '';

  let rooms = 0;
  let area = 0;
  if (p[3]) {
    const nums = p[3].split(/\s+/).map((x) => Number(String(x).replace(/[^\d.]/g, '')));
    rooms = nums[0] || 0;
    area = nums[1] || 0;
  }

  if (title.length < 5 || title.length > 120) return { error: 'title' };
  if (!price || price < 1000 || price > 2000000000) return { error: 'price' };
  if (address.length < 3) return { error: 'address' };

  return { title: title, price: price, address: address, rooms: rooms, area: area };
}

/**
 * «Текст поста | дата» (дата: 2026-12-01, 01.12.2026, «сегодня», «завтра»)
 * Возвращает null, если это не быстрый ввод.
 */
export function parsePostLine(text) {
  const raw = String(text || '');
  const idx = raw.lastIndexOf('|');
  if (idx < 0) return null;

  const body = raw.slice(0, idx).trim();
  const iso = toIsoDate(raw.slice(idx + 1));
  if (!iso) return null;
  if (body.length < 30) return { error: 'text' };

  return { text: body, date: iso };
}
