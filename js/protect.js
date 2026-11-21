/* =========================================================================
   Защита контента «Мой Дом» — ЖЁСТКИЙ режим
   -------------------------------------------------------------------------
   Включено:
     1) Запрещено выделение текста на сайте (кроме полей форм — там печатать можно).
     2) Ctrl+C / Ctrl+X работают только в полях формы; из текста страницы копирование
        блокируется с подсказкой.
     3) Правый клик по фотографиям и описаниям отключён; по ссылкам — разрешён
        (чтобы можно было «открыть в новой вкладке»).
     4) Фото нельзя перетащить, сохранить, «поделиться» долгим нажатием на iPhone.
     5) На фотографиях объектов — водяной знак dom-mc.ru.
     6) Ctrl+S / Ctrl+U / Ctrl+P (сохранить, исходник, печать) блокируются.
   Чего НЕ делает (так и задумано):
     — не мешает поисковикам: текст в HTML остаётся, SEO не страдает;
     — не блокирует F12/DevTools (это невозможно и мешает обслуживать сайт);
     — не ломает формы, калькуляторы и кнопки «позвонить».
   Настройка: всё в CONFIG ниже. Мягкий режим — strict: false.
   ========================================================================= */
(function () {
  'use strict';

  var CONFIG = {
    strict: true,                  // жёсткий режим (выделение/копирование запрещены)
    allowInInputs: true,           // в полях формы печатать и копировать можно
    blockContextMenuOnMedia: true, // правый клик по фото/описаниям
    blockShortcuts: true,          // Ctrl+S, Ctrl+U, Ctrl+P
    watermark: true,               // подпись на фотографиях объектов
    watermarkText: 'dom-mc.ru',
    notify: true,                  // всплывающие подсказки
    contactPhone: '+7 949 504-44-55'
  };

  if (window.__mdProtect) return;
  window.__mdProtect = true;

  function isField(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable === true;
  }

  function notify(text) {
    if (!CONFIG.notify) return;
    if (window.showToast) { try { window.showToast(text, 'error'); } catch (e) {} }
  }

  /* ---------- стили ---------- */
  var css = 'img{-webkit-user-drag:none;-moz-user-drag:none;user-drag:none;-webkit-touch-callout:none;}' +
    '.md-watermark{position:absolute;right:8px;bottom:8px;padding:2px 7px;border-radius:6px;' +
    'background:rgba(15,23,42,.5);color:rgba(255,255,255,.9);font:600 11px/1.35 Inter,Arial,sans-serif;' +
    'letter-spacing:.3px;pointer-events:none;z-index:3;user-select:none;}';

  if (CONFIG.strict) {
    css += 'body,body *{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;}' +
      'input,textarea,select,[contenteditable="true"]{-webkit-user-select:text;-moz-user-select:text;' +
      '-ms-user-select:text;user-select:text;}' +
      '@media print{body{visibility:hidden;}body:after{content:"Материалы сайта dom-mc.ru — печать запрещена";visibility:visible;}}';
  }

  var st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* ---------- копирование и вырезание ---------- */
  ['copy', 'cut'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var t = e.target;
      if (CONFIG.allowInInputs && isField(t)) return;      // в формах — можно
      var sel = window.getSelection ? window.getSelection() : null;
      if (CONFIG.allowInInputs && sel && sel.anchorNode) {
        var host = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
        if (host && host.closest && host.closest('input,textarea,select,[contenteditable="true"]')) return;
      }
      e.preventDefault();
      notify('Копирование материалов сайта запрещено. По вопросам использования: ' + CONFIG.contactPhone);
    }, true);
  });

  /* ---------- правый клик: фото и описания ---------- */
  if (CONFIG.blockContextMenuOnMedia) {
    document.addEventListener('contextmenu', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.tagName === 'A') return;                        // ссылки — разрешаем
      var inText = t.closest && t.closest('.post-body,.card-desc,.object-desc,.article-body,.rev-mini p,.blog-card p');
      if (t.tagName === 'IMG' || inText) {
        e.preventDefault();
        notify('Материалы защищены. Использование — по согласованию: ' + CONFIG.contactPhone);
      }
    }, true);
  }

  /* ---------- горячие клавиши ---------- */
  if (CONFIG.blockShortcuts) {
    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = String(e.key || '').toLowerCase();
      if (k === 's' || k === 'u' || k === 'p') {
        e.preventDefault();
        notify('Сохранение и печать материалов сайта отключены.');
      }
    }, true);
  }

  /* ---------- водяной знак на фото ---------- */
  function watermark() {
    if (!CONFIG.watermark) return;
    [].slice.call(document.querySelectorAll('.card-img-wrapper, .home-strip-item, .blog-card-img, .blog-mini-img, .gallery-main, .object-photo, .object-main-photo')).forEach(function (box) {
      if (!box || box.querySelector('.md-watermark')) return;
      if (!box.querySelector('img')) return;
      if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
      var w = document.createElement('span');
      w.className = 'md-watermark';
      w.textContent = CONFIG.watermarkText;
      box.appendChild(w);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(watermark, 400); });
  } else {
    setTimeout(watermark, 400);
  }
  window.addEventListener('load', function () { setTimeout(watermark, 1200); });

  /* Каталог и лента объектов появляются после подгрузки data.json —
     поэтому повторяем разметку знаков ещё несколько раз и следим за DOM */
  var tries = 0;
  var timer = setInterval(function () {
    watermark();
    if (++tries > 10) clearInterval(timer);
  }, 1000);

  document.addEventListener('dataLoaded', function () { setTimeout(watermark, 300); });

  try {
    var pending = null;
    var mo = new MutationObserver(function () {
      if (pending) return;
      pending = setTimeout(function () { pending = null; watermark(); }, 700);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (e) { /* старые браузеры — обойдёмся таймером */ }
})();
