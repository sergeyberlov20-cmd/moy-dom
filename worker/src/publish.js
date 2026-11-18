/**
 * Публикация поста из бота: страница статьи + карточка в ленте + sitemap.
 */
import { ghGet, ghPut, textToBase64, base64ToText } from './github.js';
import { SITE, slugify, dateText, escHtml, CARD_SVG, CONTACT_BLOCK } from './postutil.js';

export async function publishPost(env, draft) {
  const today = new Date().toISOString().slice(0, 10);
  const date = draft.date || today;
  const future = date > today;
  const title = draft.title;

  // 1. свободный адрес
  const baseSlug = 'blog-' + (slugify(title) || 'post');
  let slug = baseSlug;
  for (let n = 2; n < 20; n++) {
    if (!(await ghGet(env, 'blog/' + slug + '.html'))) break;
    slug = baseSlug + '-' + n;
  }

  // 2. фото
  let imgRel = '../images/logo.png';
  let imgAbs = SITE + '/images/logo.png';
  if (draft.photoBase64) {
    const ext = (draft.photoExt || 'jpg').toLowerCase();
    await ghPut(env, 'images/blog/' + slug + '.' + ext, draft.photoBase64, 'Бот: фото для поста ' + slug);
    imgRel = '../images/blog/' + slug + '.' + ext;
    imgAbs = SITE + '/images/blog/' + slug + '.' + ext;
  }

  // 3. текст
  const paras = String(draft.text || '').split(/\r?\n\s*\r?\n/).map((t) => t.trim()).filter(Boolean);
  const lead = paras[0] || title;
  const body = paras.slice(1).map((t) => '<p>' + escHtml(t) + '</p>').join('\n');
  const desc = lead.replace(/\s+/g, ' ').slice(0, 155);
  const url = SITE + '/blog/' + slug + '.html';

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: title,
        description: desc,
        image: [imgAbs],
        datePublished: date,
        dateModified: date,
        inLanguage: 'ru-RU',
        articleSection: 'Советы',
        author: { '@type': 'Organization', name: 'Мультицентр недвижимости «Мой Дом»', url: SITE + '/' },
        publisher: { '@type': 'Organization', name: 'Мультицентр недвижимости «Мой Дом»', logo: { '@type': 'ImageObject', url: SITE + '/images/icon-512.png' } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Блог', item: SITE + '/blog/' },
          { '@type': 'ListItem', position: 3, name: title, item: url }
        ]
      }
    ]
  };

  // 4. страница из шаблона
  const tpl = await ghGet(env, 'worker/templates/article.html');
  if (!tpl) throw new Error('нет шаблона worker/templates/article.html');
  let html = base64ToText(tpl.content);

  html = html
    .replace(/__TITLE__/g, escHtml(title))
    .replace(/__DESC__/g, escHtml(desc))
    .replace(/__SLUG__/g, slug)
    .replace(/__SITE__/g, SITE)
    .replace(/__DATE_TEXT__/g, dateText(date))
    .replace(/__DATE__/g, date)
    .replace(/__CRUMB__/g, escHtml(title.slice(0, 60)))
    .replace(/__TAG__/g, 'Советы «Мой Дом»')
    .replace(/__LEAD__/g, escHtml(lead))
    .replace(/__BODY__/g, (body ? body + '\n' : '') + CONTACT_BLOCK)
    .replace(/__IMG_ABS__/g, imgAbs)
    .replace(/__IMG__/g, imgRel)
    .replace(/__SOURCE__/g, 'Материал подготовил мультицентр недвижимости «Мой Дом», ' + dateText(date))
    .replace(/__JSONLD__/g, '<script type="application/ld+json">' + JSON.stringify(ld) + '</script>')
    .replace(/__ROBOTS__/, future ? '  <meta name="robots" content="noindex">\r\n' : '');

  await ghPut(env, 'blog/' + slug + '.html', textToBase64(html),
    'Бот: ' + (future ? 'запланирован' : 'опубликован') + ' пост «' + title + '»');

  // 5. карточка в ленте
  const card = '    <article class="blog-card" data-cat="Советы"' + (future ? ' data-publish="' + date + '"' : '') + '>\r\n' +
    '      <a class="blog-card-img" href="' + slug + '.html"><img src="' + imgRel + '" alt="' + escHtml(title) + ' — Мариуполь" loading="lazy"></a>\r\n' +
    '      <div class="blog-card-body">\r\n' +
    '        <div class="blog-meta"><span class="blog-tag green">Советы «Мой Дом»</span><time datetime="' + date + '">' + dateText(date) + '</time></div>\r\n' +
    '        <h3><a href="' + slug + '.html">' + escHtml(title) + '</a></h3>\r\n' +
    '        <p>' + escHtml(desc) + '</p>\r\n' +
    '        <div class="blog-links"><a class="blog-read" href="' + slug + '.html">Читать полностью</a>' +
    '<a class="blog-source" href="../contacts.html">Мультицентр недвижимости «Мой Дом» ' + CARD_SVG + '</a></div>\r\n' +
    '      </div>\r\n    </article>\r\n';

  for (let attempt = 1; attempt <= 3; attempt++) {
    const idx = await ghGet(env, 'blog/index.html');
    let text = base64ToText(idx.content);
    if (text.includes(slug + '.html')) break;
    text = text.replace(/(<div class="blog-grid">\r?\n)/, (m) => m + card);
    try {
      await ghPut(env, 'blog/index.html', textToBase64(text), 'Бот: карточка поста «' + title + '»', idx.sha);
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  // 6. sitemap
  try {
    const sm = await ghGet(env, 'sitemap.xml');
    let xml = base64ToText(sm.content);
    if (!xml.includes(url)) {
      xml = xml.replace('</urlset>', '  <url>\r\n       <loc>' + url + '</loc>\r\n       <lastmod>' + date + 'T09:00:00+00:00</lastmod>\r\n       <priority>0.6400</priority>\r\n  </url>\r\n</urlset>');
      await ghPut(env, 'sitemap.xml', textToBase64(xml), 'Бот: sitemap — ' + slug, sm.sha);
    }
  } catch (e) { /* не критично */ }

  return { slug: slug, url: url, published: !future, date: date };
}
