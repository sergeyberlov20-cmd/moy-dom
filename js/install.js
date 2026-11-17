/* Плашка «Установить приложение» + регистрация service worker.
   Chrome/Edge/Samsung — нативный диалог, Safari/iOS и остальные — с подсказкой. */
(function () {
  'use strict';

  var KEY = 'moydom-pwa';
  var HIDE_DAYS = 30;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  function store(obj) {
    try {
      var cur = {};
      try { cur = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
      for (var k in obj) cur[k] = obj[k];
      localStorage.setItem(KEY, JSON.stringify(cur));
    } catch (e) {}
  }
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }

  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafariIOS = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  var isAndroid = /android/i.test(ua);
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var isMobile = isIOS || isAndroid || /opera mini|iemobile|mobile|silk/i.test(ua) || (coarse && window.innerWidth < 900);
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  if (standalone || !isMobile) return;

  var state = read();
  if (state.installed) return;
  if (state.hiddenAt && Date.now() - state.hiddenAt < HIDE_DAYS * 864e5) return;

  var deferred = null;
  var bar = null;
  var hintText = isSafariIOS
    ? 'Нажмите «Поделиться» внизу экрана и выберите «На экран «Домой»».'
    : (isIOS
      ? 'Откройте сайт в Safari, нажмите «Поделиться» и выберите «На экран «Домой»».'
      : (isAndroid
        ? 'Откройте меню браузера (⋮) и выберите «Установить приложение» или «Добавить на главный экран».'
        : 'Откройте меню браузера и выберите «Добавить на главный экран».'));

  function css() {
    if (document.getElementById('pwa-bar-css')) return;
    var st = document.createElement('style');
    st.id = 'pwa-bar-css';
    st.textContent = [
      '.pwa-bar{position:fixed;z-index:950;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));',
      'max-width:520px;margin:0 auto;display:flex;align-items:flex-start;gap:12px;padding:12px 40px 12px 12px;',
      'background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 12px 34px rgba(15,23,42,.2);',
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-sizing:border-box;",
      'transform:translateY(160%);opacity:0;transition:transform .35s ease,opacity .35s ease}',
      '.pwa-bar--show{transform:translateY(0);opacity:1}',
      '.pwa-bar__icon{width:44px;height:44px;flex:0 0 auto;border-radius:11px;overflow:hidden;background:#1c2e5a}',
      '.pwa-bar__icon img{width:100%;height:100%;object-fit:cover;display:block}',
      '.pwa-bar__text{flex:1 1 auto;min-width:0}',
      '.pwa-bar__title{font-size:.95rem;font-weight:800;color:#1c2e5a;line-height:1.25}',
      '.pwa-bar__sub{font-size:.78rem;color:#6b7280;line-height:1.4;margin-top:2px}',
      '.pwa-bar__hint{display:none;font-size:.78rem;color:#1c2e5a;background:#f3f5fa;border-radius:10px;',
      'padding:8px 10px;margin-top:8px;line-height:1.45}',
      '.pwa-bar--hint .pwa-bar__hint{display:block}',
      '.pwa-bar__install{margin-top:8px;background:linear-gradient(135deg,#cc2229 0%,#a81b21 100%);color:#fff;border:none;',
      'border-radius:10px;padding:9px 14px;font-family:inherit;font-size:.82rem;font-weight:800;cursor:pointer;white-space:nowrap}',
      '.pwa-bar__install:active{transform:scale(.97)}',
      '.pwa-bar__close{position:absolute;top:6px;right:8px;width:26px;height:26px;border:none;background:transparent;',
      'color:#9ca3af;font-size:20px;line-height:1;cursor:pointer;padding:0}',
      '@media(max-width:360px){.pwa-bar__sub{display:none}}'
    ].join('');
    document.head.appendChild(st);
  }

  function build() {
    if (bar) return;
    css();
    bar = document.createElement('div');
    bar.className = 'pwa-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Установить приложение');
    bar.innerHTML =
      '<div class="pwa-bar__icon"><img src="images/icon-192.png" alt="Мой Дом"></div>' +
      '<div class="pwa-bar__text">' +
        '<div class="pwa-bar__title">Установить «Мой Дом»</div>' +
        '<div class="pwa-bar__sub">Каталог и новости недвижимости — с главного экрана</div>' +
        '<div class="pwa-bar__hint">' + hintText + '</div>' +
        '<button class="pwa-bar__install" type="button">Установить</button>' +
      '</div>' +
      '<button class="pwa-bar__close" type="button" aria-label="Закрыть">&times;</button>';
    document.body.appendChild(bar);

    bar.querySelector('.pwa-bar__close').addEventListener('click', function () {
      store({ hiddenAt: Date.now() });
      hide();
    });

    bar.querySelector('.pwa-bar__install').addEventListener('click', function () {
      var btn = bar.querySelector('.pwa-bar__install');
      if (deferred && deferred.prompt) {
        deferred.prompt();
        deferred.userChoice.then(function (choice) {
          if (choice && choice.outcome === 'accepted') {
            store({ installed: true });
            hide();
          } else {
            bar.classList.add('pwa-bar--hint');
            if (btn) btn.textContent = 'Как установить';
          }
          deferred = null;
        }).catch(function () {});
        return;
      }
      bar.classList.add('pwa-bar--hint');
      if (btn) btn.textContent = 'Понятно';
    });

    requestAnimationFrame(function () {
      setTimeout(function () { if (bar) bar.classList.add('pwa-bar--show'); }, 60);
    });
  }

  function hide() {
    if (!bar) return;
    var el = bar;
    bar = null;
    el.classList.remove('pwa-bar--show');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    build();
    var btn = bar && bar.querySelector('.pwa-bar__install');
    if (btn) btn.textContent = 'Установить';
  });

  window.addEventListener('appinstalled', function () {
    store({ installed: true });
    hide();
  });

  function start() { build(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 1500); });
  } else {
    setTimeout(start, 1500);
  }
})();

