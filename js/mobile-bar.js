/* Мобильная панель быстрого действия: Позвонить + Telegram.
   Показывается только на узких экранах, не мешает десктопу. */
(function () {
  'use strict';

  var PHONE = '+79495044455';
  var TG = 'https://t.me/nedvizhimost_mariupol';

  if (document.getElementById('mbar')) return;

  var css = document.createElement('style');
  css.id = 'mbar-css';
  css.textContent = [
    '.mbar{position:fixed;left:0;right:0;bottom:0;z-index:940;display:none;gap:8px;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));',
    'background:rgba(255,255,255,.97);border-top:1px solid #e5e7eb;box-shadow:0 -6px 20px rgba(15,23,42,.08);',
    "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-sizing:border-box}",
    '.mbar a{flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;',
    'font-size:.92rem;font-weight:800;padding:13px 10px;border-radius:12px;line-height:1}',
    '.mbar a svg{width:18px;height:18px;fill:currentColor;flex:0 0 auto}',
    '.mbar__call{background:linear-gradient(135deg,#cc2229 0%,#a81b21 100%);color:#fff}',
    '.mbar__tg{background:#f1f5f9;color:#1c2e5a;border:1px solid #e5e7eb}',
    '@media(max-width:820px){.mbar{display:flex}body{padding-bottom:74px}}'
  ].join('');
  document.head.appendChild(css);

  var bar = document.createElement('div');
  bar.id = 'mbar';
  bar.className = 'mbar';
  bar.innerHTML =
    '<a class="mbar__call" href="tel:' + PHONE + '">' +
      '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1l-2.3 2.3z"/></svg>' +
      'Позвонить' +
    '</a>' +
    '<a class="mbar__tg" href="' + TG + '" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24"><path d="M21.9 4.3c-.2-.2-.5-.2-.8-.1L2.7 11.3c-.3.1-.5.4-.5.7 0 .3.2.6.5.7l4.4 1.4 1.7 5.3c.1.3.4.5.7.5.2 0 .4-.1.6-.3l2.5-2.6 4.3 3.2c.2.1.4.2.6.2h.2c.3-.1.5-.4.6-.7l3-14.4c0-.3 0-.6-.2-.8zM9.5 13.1l7.1-4.4-5.9 5.9c-.1.1-.2.3-.2.4l-.3 2.1-1.5-4.6z"/></svg>' +
      'Написать' +
    '</a>';
  document.body.appendChild(bar);
})();
