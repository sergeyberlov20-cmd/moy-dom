export const SITE = 'https://dom-mc.ru';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

export function slugify(text) {
  return String(text).toLowerCase()
    .split('').map((c) => (TRANSLIT[c] !== undefined ? TRANSLIT[c] : c)).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 55)
    .replace(/-+$/g, '');
}

export function dateText(iso) {
  const p = String(iso).split('-').map(Number);
  return p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0];
}

export const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const CARD_SVG = '<svg viewBox="0 0 24 24"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zM5 5h5V3H3v18h18v-7h-2v5H5V5z"/></svg>';

export const CONTACT_BLOCK = '<h2>Куда обратиться</h2>\n<p>Мультицентр «Мой дом»<br>Мариуполь, проспект Ленина (Мира), 54/46. Ориентир — Драмтеатр.<br>Телефон <a href="tel:+79495044455">+7 949 504-44-55</a></p>';
