/**
 * Обновление отзывов с Яндекс.Карт: забирает публичную страницу,
 * вытаскивает JSON с отзывами и пересобирает js/reviews.js + JSON-LD на странице.
 */
import { ghGet, ghPut, textToBase64, base64ToText } from './github.js';
import { tgNotify } from './lib.js';

const ORG = '98286514548';
const YANDEX = 'https://yandex.ru/maps/org/moy_dom/' + ORG + '/reviews/';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/* Вырезает сбалансированный {...} или [...] начиная с позиции startIdx */
function cutBalanced(src, startIdx) {
  const open = src[startIdx];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  return null;
}

const tidy = (s) => String(s || '')
  .replace(/\u00a0/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const escAttr = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Скачивает страницы отзывов и собирает уникальные отзывы */
export async function fetchReviews() {
  const found = new Map();
  let pages = 0;
  let firstHtml = '';

  for (let page = 1; page <= 5; page++) {
    const url = YANDEX + '?page=' + page;
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9'
      }
    });
    if (!r.ok) break;
    const html = await r.text();
    if (page === 1) firstHtml = html;
    if (html.indexOf('"reviewResults"') < 0) break;
    pages++;

    let idx = 0;
    let before = found.size;
    while ((idx = html.indexOf('"reviewResults":', idx)) >= 0) {
      const brace = html.indexOf('{', idx);
      idx = brace + 10;
      const chunk = cutBalanced(html, brace);
      if (!chunk) continue;
      try {
        const obj = JSON.parse(chunk);
        for (const rev of obj.reviews || []) {
          if (rev && rev.reviewId) found.set(rev.reviewId, rev);
        }
      } catch (e) { /* пропускаем битый блок */ }
    }
    if (found.size === before) break; // новых нет — дальше смысла листать
  }

  // сколько всего оценок показал Яндекс (в шапке карточки)
  let ratingsCount = 0;
  const cm = firstHtml.match(/(\d[\d\s]{0,5})\s*оценк/i);
  if (cm) ratingsCount = Number(cm[1].replace(/\D/g, '')) || 0;

  return { raw: [...found.values()], pages: pages, ratingsCount: ratingsCount };
}

/* Приводит отзывы к формату сайта */
export function normalize(raw) {
  return raw
    .filter((r) => r.text && tidy(r.text).length > 5)
    .map((r) => {
      const d = new Date(r.updatedTime);
      return {
        id: r.reviewId,
        author: tidy(r.author && r.author.name).replace(/\s+/g, ' ').slice(0, 60),
        rating: Number(r.rating) || 5,
        iso: isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10),
        date: isNaN(d.getTime()) ? '' : d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(),
        text: tidy(r.text).slice(0, 1200),
        reply: r.businessComment && r.businessComment.text ? tidy(r.businessComment.text).slice(0, 400) : ''
      };
    })
    .sort((a, b) => (a.iso < b.iso ? 1 : -1));
}

/* Собирает файл js/reviews.js */
export function buildDataJs(list, ratingsCount, today) {
  const meta = {
    rating: 5.0,
    reviews: list.length,
    ratingsCount: ratingsCount || list.length,
    url: YANDEX,
    orgUrl: 'https://yandex.ru/maps/org/moy_dom/' + ORG + '/',
    updated: today
  };
  return '/* Отзывы с Яндекс.Карт — обновлено ' + today + ' */\n' +
    'window.REVIEWS_META = ' + JSON.stringify(meta, null, 2) + ';\n\n' +
    'window.REVIEWS = ' + JSON.stringify(list, null, 1) + ';\n';
}

/* JSON-LD для страницы отзывов */
export function buildJsonLd(list) {
  const graph = [{
    '@type': 'Organization',
    '@id': 'https://dom-mc.ru/#org',
    name: 'Мультицентр недвижимости «Мой Дом»',
    url: 'https://dom-mc.ru/',
    telephone: '+7 949 504-44-55',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'пр. Ленина (Мира), 54/46',
      addressLocality: 'Мариуполь',
      addressCountry: 'RU'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: 5.0,
      reviewCount: list.length,
      bestRating: 5,
      worstRating: 1
    }
  }];

  list.slice(0, 10).forEach((r) => {
    graph.push({
      '@type': 'Review',
      itemReviewed: { '@type': 'Organization', name: 'Мультицентр недвижимости «Мой Дом»' },
      author: { '@type': 'Person', name: r.author || 'Клиент' },
      datePublished: r.iso,
      reviewBody: r.text,
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 }
    });
  });

  graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://dom-mc.ru/' },
      { '@type': 'ListItem', position: 2, name: 'Отзывы', item: 'https://dom-mc.ru/reviews/' }
    ]
  });

  return { '@context': 'https://schema.org', '@graph': graph };
}



/* Обновляет данные и разметку страницы отзывов */
export async function updateYandexReviews(env) {
  const got = await fetchReviews();
  if (!got.raw.length) {
    return { ok: false, error: 'Яндекс не отдал отзывы (капча или смена разметки)', pages: got.pages };
  }

  const fresh = normalize(got.raw);
  if (!fresh.length) return { ok: false, error: 'отзывы получены, но тексты пустые', pages: got.pages };

  const now = new Date();
  const humanDate = now.getUTCDate() + ' ' + MONTHS[now.getUTCMonth()] + ' ' + now.getUTCFullYear();

  let oldIds = [];
  let oldCount = 0;
  let oldText = '';
  const oldFile = await ghGet(env, 'js/reviews.js');
  if (oldFile) {
    oldText = base64ToText(oldFile.content);
    const txt = oldText;
    const s = txt.indexOf('window.REVIEWS = ');
    const arrStart = s >= 0 ? txt.indexOf('[', s) : -1;
    if (arrStart > 0) {
      const chunk = cutBalanced(txt, arrStart);
      try {
        const arr = JSON.parse(chunk);
        oldIds = arr.map((r) => r.id);
        oldCount = arr.length;
      } catch (e) { /* старый файл не разобрался — не страшно */ }
    }
  }

  const dataJsText = buildDataJs(fresh, got.ratingsCount, humanDate);
  const dataSame = oldText === dataJsText;
  if (!dataSame) {
    await ghPut(env, 'js/reviews.js', textToBase64(dataJsText),
      'Бот: отзывы с Яндекс.Карт — ' + fresh.length + ' шт.', oldFile ? oldFile.sha : undefined);
  }

  let htmlUpdated = false;
  const page = await ghGet(env, 'reviews/index.html');
  if (page) {
    let html = base64ToText(page.content);
    const before = html;
    const ld = '<script type="application/ld+json">' + JSON.stringify(buildJsonLd(fresh)) + '</script>';
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ld);
    html = html.replace(/(<div class="rev-score-num" id="revScoreNum">)[^<]*(<\/div>)/, '$1' + '5,0' + '$2');
    html = html.replace(/(<div class="rev-score-sub" id="revScoreSub">)[\s\S]*?(<\/div>)/,
      '$1' + fresh.length + ' отзывов · ' + (got.ratingsCount || fresh.length) + ' оценок<br>Яндекс.Карты$2');
    if (html !== before) {
      await ghPut(env, 'reviews/index.html', textToBase64(html), 'Бот: обновлена разметка отзывов', page.sha);
      htmlUpdated = true;
    }
  }

  const addedList = fresh.filter((r) => oldIds.indexOf(r.id) < 0);
  return {
    ok: true,
    total: fresh.length,
    before: oldCount,
    added: addedList.length,
    newOnes: addedList.slice(0, 5).map((r) => r.author + ' — ' + r.date),
    pages: got.pages,
    ratingsCount: got.ratingsCount,
    dataUpdated: !dataSame,
    htmlUpdated: htmlUpdated
  };
}

/* Автообновление отзывов по крону (раз в две недели) */
export async function runReviewsCron(env) {
  try {
    const r = await updateYandexReviews(env);
    if (!r.ok) {
      await tgNotify(env, '⚠️ <b>Автообновление отзывов</b>\nНе получилось: ' + String(r.error || 'ошибка'));
      return r;
    }
    if (r.added > 0) {
      await tgNotify(env,
        '⭐ <b>Новые отзывы на Яндекс.Картах</b>\n\n' +
        'Добавлено: <b>' + r.added + '</b>\n' +
        r.newOnes.map((x) => '• ' + x).join('\n') + '\n\n' +
        'Всего: ' + r.total + ' · оценок: ' + (r.ratingsCount || '—') + '\n' +
        'https://dom-mc.ru/reviews/');
    }
    return r;
  } catch (e) {
    const msg = String((e && e.message) || e);
    await tgNotify(env, '⚠️ <b>Автообновление отзывов упало</b>\n' + msg);
    return { ok: false, error: msg };
  }
}

export async function reviewsDry() {
  const t0 = Date.now();
  try {
    const got = await fetchReviews();
    const list = normalize(got.raw);
    return {
      ok: list.length > 0,
      pages: got.pages,
      raw: got.raw.length,
      reviews: list.length,
      ratingsCount: got.ratingsCount,
      ms: Date.now() - t0,
      first: list.length ? { author: list[0].author, date: list[0].date, rating: list[0].rating } : null
    };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), ms: Date.now() - t0 };
  }
}

