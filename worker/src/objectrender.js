/**
 * Статические страницы объектов (objects/<id>.html) и пинг IndexNow.
 * Использует шаблон worker/templates/object.html из репозитория.
 */
import { ghGet, ghPut, textToBase64, base64ToText } from './github.js';

const SITE = 'https://dom-mc.ru';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));

function priceText(o) {
  if (!o.price) return 'По договорённости';
  const p = money(o.price) + ' ₽';
  return String(o.deal || '') === 'Аренда' ? p + '/мес' : p;
}

function specs(o) {
  const rows = [['Тип', o.type], ['Сделка', o.deal]];
  if (o.rooms) rows.push(['Комнат', o.rooms]);
  if (o.area) rows.push(['Площадь', o.area + ' м²']);
  if (o.floor) rows.push(['Этаж', o.floor + (o.floors ? ' из ' + o.floors : '')]);
  return rows.map((r) => '<li>' + esc(r[0]) + '<b>' + esc(r[1]) + '</b></li>').join('');
}

function mortgage(o) {
  if (String(o.deal) !== 'Продажа' || !o.price) return '';
  const inp = (id, label, min, max, step, val) =>
    '<label style="font-size:.72rem;color:var(--muted);display:flex;flex-direction:column;gap:4px;">' + label +
    '<input id="' + id + '" type="number" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val +
    '" style="padding:7px;border:1px solid var(--border);border-radius:8px;width:100%;font-size:.9rem;"></label>';
  return '<div style="background:#f7f9fc;border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:16px;">' +
    '<div style="font-weight:800;color:var(--primary);margin-bottom:10px;">Ипотека: <b id="m-pay" style="color:var(--accent);" data-price="' + Number(o.price) + '">—</b> ₽/мес</div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
    inp('m-down', 'Взнос, %', 0, 90, 5, 20) + inp('m-years', 'Срок, лет', 1, 30, 1, 15) + inp('m-rate', 'Ставка, %', 1, 40, 0.5, 12) +
    '</div><p style="font-size:.7rem;color:var(--muted);margin:8px 0 0;">Расчёт ориентировочный, не оферта.</p></div>';
}

function mapBlock(o) {
  const lat = Math.round((Number(o.lat) || 47.095) * 1000) / 1000;
  const lon = Math.round((Number(o.lon) || 37.548) * 1000) / 1000;
  return '<div class="obj-map"><iframe src="https://yandex.ru/map-widget/v1/?ll=' + lon + '%2C' + lat + '&z=17&pt=' + lon + '%2C' + lat + '%2Cpm2rdm" loading="lazy" title="Расположение объекта" allowfullscreen></iframe></div>';
}

function favButton(o) {
  return '<button type="button" class="btn obj-fav" data-id="' + o.id + '" style="width:100%;padding:13px;background:#eef1f7;color:#1c2e5a;font-weight:700;">🔖 В избранное</button>';
}

function phoneButtons(o) {
  const p1 = o.phone || '+7 (949) 504-44-55';
  const p2 = o.phone2 || '';
  const btn = (p) => '<a href="tel:' + p.replace(/[^\d+]/g, '') + '" class="btn btn-accent" style="width:100%;padding:13px;font-size:1rem;">📞 ' + esc(p) + '</a>';
  return btn(p1) + (p2 ? btn(p2) : '') +
    '<a href="https://t.me/nevizhimost_mariupol" target="_blank" class="btn" style="width:100%;padding:13px;background:#0088cc;color:#fff;">✈️ Написать в Telegram</a>';
}

function card(o) {
  const img = String(o.image || 'images/logo.png').replace(/^\//, '');
  const addr = String(o.address || '').replace(/^г\.\s*Мариуполь,\s*/i, '');
  const sp = [];
  if (o.rooms) sp.push(o.rooms + ' комн.');
  if (o.area) sp.push(o.area + ' м²');
  return '<article class="card"><div class="card-img-wrapper"><img src="../' + esc(img) + '" class="card-img" width="320" height="240" loading="lazy" alt="' + esc(o.title) + '"><span class="card-badge">' + esc(o.deal) + '</span></div>' +
    '<div class="card-body"><div class="card-price">' + priceText(o) + '</div><div class="card-title">' + esc(o.title) + '</div>' +
    '<div class="card-meta">' + esc(addr) + (sp.length ? ' · ' + sp.join(' · ') : '') + '</div>' +
    '<a href="' + o.id + '.html" class="btn" style="margin-top:auto;">Подробнее</a></div></article>';
}

const BOOK_MODAL = `<div id="book-modal" style="position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:16px;z-index:1000;">
  <div style="background:#fff;border-radius:16px;max-width:420px;width:100%;padding:26px 22px;position:relative;box-sizing:border-box;">
    <button type="button" id="book-close" aria-label="Закрыть" style="position:absolute;top:8px;right:12px;border:0;background:none;font-size:28px;line-height:1;color:#94a3b8;cursor:pointer;">×</button>
    <h3 style="margin:0 0 6px;font-size:1.2rem;color:var(--primary);">Записаться на просмотр</h3>
    <p style="margin:0 0 16px;font-size:.86rem;color:var(--muted);line-height:1.5;">__BOOK_TITLE__</p>
    <form id="book-form" style="display:flex;flex-direction:column;gap:10px;">
      <input name="name" required placeholder="Ваше имя" style="padding:12px;border:1px solid var(--border);border-radius:10px;font-size:.95rem;width:100%;box-sizing:border-box;">
      <input name="phone" type="tel" required placeholder="Телефон" style="padding:12px;border:1px solid var(--border);border-radius:10px;font-size:.95rem;width:100%;box-sizing:border-box;">
      <input name="when" placeholder="Удобное время (необязательно)" style="padding:12px;border:1px solid var(--border);border-radius:10px;font-size:.95rem;width:100%;box-sizing:border-box;">
      <button class="btn btn-accent" type="submit" style="padding:14px;">Отправить заявку</button>
      <div id="book-msg" style="font-size:.85rem;color:var(--muted);min-height:18px;"></div>
    </form>
  </div></div>`;

/** Рендер страницы объекта из шаблона */
export function renderObject(template, o, all) {
  const addr = String(o.address || '').replace(/^г\.\s*Мариуполь,\s*/i, '');
  const imgMain = '../' + String(o.image || 'images/logo.png').replace(/^\//, '');
  const imgs = (o.images && o.images.length ? o.images : [o.image]).filter(Boolean);
  const thumbs = '';
  // список фото для слайдера на странице объекта
  const imgsJson = JSON.stringify(imgs.map((p) => '../' + String(p).replace(/^\//, ''))).replace(/'/g, '&#39;');

  const title = o.title + ' — ' + (String(o.deal) === 'Аренда' ? 'аренда' : 'продажа') + ' в Мариуполе | Мой Дом';
  const desc = (o.title + ' · ' + priceText(o) + (addr ? ' · ' + addr : '') + '. ' + String(o.description || '').replace(/\s+/g, ' ')).slice(0, 300).trim();

  const similar = (all || [])
    .filter((x) => Number(x.id) !== Number(o.id) && x.deal === o.deal)
    .map((x) => ({ x, s: Math.abs((Number(x.price) || 0) - (Number(o.price) || 0)) * (x.type === o.type ? 0.35 : 1) }))
    .sort((p, q) => p.s - q.s)
    .slice(0, 4)
    .map((p) => p.x);

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateListing',
        name: o.title,
        description: String(o.description || o.title).slice(0, 400),
        url: SITE + '/objects/' + o.id + '.html',
        image: SITE + '/' + String(o.image || '').replace(/^\//, ''),
        address: { '@type': 'PostalAddress', addressLocality: 'Мариуполь', streetAddress: addr.replace(/^[^,]*,\s*/, '') },
        offers: { '@type': 'Offer', price: Number(o.price) || 0, priceCurrency: 'RUB', availability: 'https://schema.org/InStock' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Каталог', item: SITE + '/catalog.html' },
          { '@type': 'ListItem', position: 3, name: o.title, item: SITE + '/objects/' + o.id + '.html' }
        ]
      }
    ]
  };

  return template
    .replace(/__CANONICAL__/g, SITE + '/objects/' + o.id + '.html')
    .replace(/__TITLE__/g, esc(title))
    .replace(/__TITLE_ALT__/g, esc(o.title + ' в Мариуполе'))
    .replace(/__DESC__/g, esc(desc))
    .replace(/__IMG_ABS__/g, SITE + '/' + String(o.image || '').replace(/^\//, ''))
    .replace(/__IMG_MAIN__/g, esc(imgMain))
    .replace(/__IMAGES__/g, imgsJson)
    .replace(/__CRUMB__/g, esc(o.title.slice(0, 60)))
    .replace(/__H1__/g, esc(o.title))
    .replace(/__ADDR__/g, esc(addr))
    .replace(/__PRICE__/g, priceText(o))
    .replace(/__SPECS__/g, specs(o))
        .replace(/__MAP__/g, mapBlock(o))
    .replace(/__PHONE_BTNS__/g, favButton(o) + phoneButtons(o))
    .replace(/__THUMBS__/g, thumbs)
    .replace(/__DESC_BLOCK__/g, o.description
      ? '<div class="obj-desc"><h2>Описание</h2><p>' + esc(String(o.description).slice(0, 3000)) + '</p></div>'
      : '')
    .replace(/__SIMILAR__/g, similar.length
      ? '<section style="margin-bottom:40px;"><h2 class="section-title" style="font-size:1.4rem;">Похожие объекты</h2><div class="objects-grid">' + similar.map(card).join('') + '</div></section>'
      : '')
    .replace(/__BOOK_MODAL__/g, BOOK_MODAL.replace('__BOOK_TITLE__', esc(o.title)))
    .replace(/__LEAD_PREFIX__/g, esc('Запись на просмотр: ' + o.title + ' (объект №' + o.id + ')'))
    .replace(/__JSONLD__/g, JSON.stringify(jsonld));
}

/** Создаёт/обновляет страницу объекта в репозитории */
export async function saveObjectPage(env, obj, all, message) {
  const tplFile = await ghGet(env, 'worker/templates/object.html');
  if (!tplFile) throw new Error('нет шаблона worker/templates/object.html');
  const html = renderObject(base64ToText(tplFile.content), obj, all || []);
  const path = 'objects/' + obj.id + '.html';
  const existing = await ghGet(env, path);
  await ghPut(env, path, textToBase64(html), message || 'Бот: страница объекта #' + obj.id, existing ? existing.sha : undefined);
  return { path: path, url: SITE + '/' + path };
}
const INDEXNOW_KEY = '9f2a7c1e5b8d4a6c3e0f1b2a3c4d5e6f';

/** Сообщает поисковикам о новых/изменённых адресах (Яндекс, Bing) */
export async function pingIndexNow(urls) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return null;
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'dom-mc.ru',
        key: INDEXNOW_KEY,
        keyLocation: SITE + '/' + INDEXNOW_KEY + '.txt',
        urlList: list
      })
    });
    return r.status;
  } catch (e) {
    return null;
  }
}