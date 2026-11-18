// js/main.js

// 1. ФОРМАТИРОВАНИЕ ЦЕНЫ
const _priceFormatter = new Intl.NumberFormat("ru-RU");
window.formatPrice = function(price, deal) {
  const formatted = _priceFormatter.format(price) + " ₽";
  return deal === "Аренда" ? formatted + "/мес" : formatted;
};

// 2. УВЕДОМЛЕНИЯ (TOAST)
window.showToast = function(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : '❌';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('show'); }, 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300); }, 4000);
};

// 3. ФУНКЦИИ ДЛЯ ИЗБРАННОГО
window.getFavorites = () => JSON.parse(localStorage.getItem('favorites') || '[]');
window.toggleFavorite = function(id, btn) {
  let favs = getFavorites();
  if (favs.includes(id)) {
    favs = favs.filter(fId => fId !== id);
    btn.classList.remove('active');
    showToast('Объект удален из избранного', 'error');
  } else {
    favs.push(id);
    btn.classList.add('active');
    showToast('Объект сохранен в избранное', 'success');
  }
  localStorage.setItem('favorites', JSON.stringify(favs));
};
window.isFavorite = function(id) { return getFavorites().includes(id); };

// Очистка пути от лишних слешей
function cleanImagePath(path) {
  if (!path) return '';
  return path.replace(/^\//, '');
}

// 4. УНИВЕРСАЛЬНЫЙ РЕНДЕР КАРТОЧКИ
window.renderCard = function(o, opts = {}) {
  const actions = opts.actions === true;
  const safeMainImage = cleanImagePath(o.image);
  const safeImages = (o.images && o.images.length > 0) ? o.images.map(img => cleanImagePath(img)) : [safeMainImage];

  let sliderBtns = '';
  if (safeImages.length > 1) {
    sliderBtns = `<button class="card-slider-btn prev">&#10094;</button><button class="card-slider-btn next">&#10095;</button>`;
  }
  const isFav = isFavorite(o.id) ? 'active' : '';
  const today = new Date().toISOString().split('T')[0];
  const isNew = o.date === today;
  const badgeHtml = isNew ? `<span class="card-badge new">Новинка</span>` : `<span class="card-badge">${o.deal}</span>`;
  
  // Телефоны (поддержка двух номеров)
  const phoneStr = o.phone || '+7 (949) 504-44-55';
  const phoneClean = phoneStr.replace(/[^0-9+]/g, '');
  const phone2Str = o.phone2 || '';
  const phone2Clean = phone2Str.replace(/[^0-9+]/g, '');

  let actionsHtml = '';
  if (actions) {
    actionsHtml = `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: auto;">
      <a href="tel:${phoneClean}" class="btn btn-accent" style="width: 100%; padding: 10px; font-size: 0.9rem;">📞 ${phoneStr}</a>
      ${phone2Str ? `<a href="tel:${phone2Clean}" class="btn btn-accent" style="width: 100%; padding: 10px; font-size: 0.9rem;">📞 ${phone2Str}</a>` : ''}
      <a href="https://t.me/nevizhimost_mariupol" target="_blank" class="btn" style="width: 100%; padding: 10px; font-size: 0.9rem; background: #0088cc;">✈️ Telegram</a>
    </div>`;
  }
  
  const moreBtnStyle = actions ? 'margin-bottom: 12px;' : '';
  
  // Если адреса нет, не выводим пустую строку.
  // Адрес показываем без номера дома — правило проекта.
  const publicAddr = (window.publicAddress ? window.publicAddress(o.address) : o.address);
  const addressHtml = publicAddr ? `
    <div class="card-meta">
      <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:currentColor; opacity:0.6;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      ${publicAddr}
    </div>` : '';

  return `
    <article class="card">
      <div class="card-img-wrapper" data-images='${JSON.stringify(safeImages)}'>
        <img src="${safeMainImage}" class="card-img" width="320" height="240" loading="eager" alt="${o.title}">
        ${badgeHtml}
        <button class="favorite-btn ${isFav}" aria-label="В избранное" onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite(${o.id}, this)">
          <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
        </button>
        ${sliderBtns}
      </div>
      <div class="card-body">
        <div class="card-price">${formatPrice(o.price, o.deal)}</div>
        <div class="card-title">${o.title}</div>
        ${addressHtml}
        <a href="objects/${o.id}.html" class="btn" style="${moreBtnStyle} margin-top: auto;">Подробнее</a>
        ${actionsHtml}
      </div>
    </article>`;
};

// 5. ДЕБАУНС
window.debounce = function(fn, ms) {
  let t;
  return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
};

// 6. СЛАЙДЕР ДЛЯ КАТАЛОГА
window.initMiniSliders = function() {
  document.querySelectorAll('.card-img-wrapper').forEach(wrapper => {
    if (wrapper.dataset.sliderInitialized) return; 
    const imgTag = wrapper.querySelector('.card-img');
    const images = JSON.parse(wrapper.getAttribute('data-images') || '[]');
    let currentIndex = 0;
    if (images.length <= 1) return; 
    const prevBtn = wrapper.querySelector('.prev');
    const nextBtn = wrapper.querySelector('.next');
    if (prevBtn && nextBtn) {
      prevBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); currentIndex = (currentIndex - 1 + images.length) % images.length; imgTag.src = images[currentIndex]; });
      nextBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); currentIndex = (currentIndex + 1) % images.length; imgTag.src = images[currentIndex]; });
    }
    wrapper.dataset.sliderInitialized = "true";
  });
};

// 7. СЛАЙДЕР ДЛЯ ДЕТАЛЬНОЙ КАРТОЧКИ
window.initDetailGallery = function() {
  const gallery = document.getElementById('object-gallery');
  if (!gallery) return;
  let rawImages = [];
  try { rawImages = JSON.parse(gallery.getAttribute('data-images') || '[]'); } catch(e) {}
  const images = rawImages.map(img => cleanImagePath(img));

  if (images && images.length > 1) {
    let currentIndex = 0;
    gallery.innerHTML = `
      <div style="position:relative; width:100%; height:100%;">
        <div class="slider-img" style="width:100%; height:100%; background-size:cover; background-position:center; transition: background-image 0.3s;"></div>
        <button class="slider-prev" type="button" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:44px; height:44px; cursor:pointer; z-index:10;">&#10094;</button>
        <button class="slider-next" type="button" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:44px; height:44px; cursor:pointer; z-index:10;">&#10095;</button>
        <div class="slider-dots" style="position:absolute; bottom:15px; left:50%; transform:translateX(-50%); display:flex; gap:8px; z-index:10;"></div>
      </div>`;
    const imgDiv = gallery.querySelector('.slider-img');
    const dotsContainer = gallery.querySelector('.slider-dots');
    const updateImage = () => {
      imgDiv.style.backgroundImage = `url('${images[currentIndex]}')`;
      dotsContainer.querySelectorAll('.dot').forEach((dot, i) => { dot.style.background = i === currentIndex ? '#fff' : 'rgba(255,255,255,0.5)'; });
    };
    images.forEach((_, i) => {
      const dot = document.createElement('div'); dot.className = 'dot'; dot.style.cssText = 'width:12px; height:12px; border-radius:50%; cursor:pointer; border: 1px solid rgba(0,0,0,0.3);';
      dot.addEventListener('click', () => { currentIndex = i; updateImage(); }); dotsContainer.appendChild(dot);
    });
    gallery.querySelector('.slider-prev').addEventListener('click', () => { currentIndex = (currentIndex - 1 + images.length) % images.length; updateImage(); });
    gallery.querySelector('.slider-next').addEventListener('click', () => { currentIndex = (currentIndex + 1) % images.length; updateImage(); });
    updateImage();
  } else if (images && images.length === 1) {
    gallery.innerHTML = `<div style="width:100%; height:100%; background-image:url('${images[0]}'); background-size:cover; background-position:center;"></div>`;
  }
};

// 8. БУРГЕР-МЕНЮ, КНОПКА НАВЕРХ И ЗАКРЫТИЕ ФИЛЬТРОВ
document.addEventListener('DOMContentLoaded', () => {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mainNav = document.getElementById('main-nav');
  
  if (mobileBtn && mainNav) {
    mobileBtn.addEventListener('click', () => {
      mainNav.classList.toggle('show');
    });
    
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !mobileBtn.contains(e.target)) {
        mainNav.classList.remove('show');
      }
    });
  }

  const scrollBtn = document.getElementById('scrollTopBtn');
  if (scrollBtn) {
    const toggleScrollBtn = () => {
      scrollBtn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    };
    window.addEventListener('scroll', toggleScrollBtn, { passive: true });
    toggleScrollBtn(); // если страница открылась уже прокрученной
    scrollBtn.addEventListener('click', () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }
});

/* ===== Заставка запуска (PWA): фирменный экран вместо белой вспышки ===== */
(function () {
  try {
    var scriptUrl = (document.currentScript && document.currentScript.src) || '';
    var base = scriptUrl.replace(/js\/main\.js.*$/, '');
    var logo = base + 'images/logo.png';
    var standalone = false;
    try { standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) {}
    var seen = '';
    try { seen = sessionStorage.getItem('moydom_splash') || ''; } catch (e) {}
    if (seen === '1' && !standalone) return;

    var css = document.createElement('style');
    css.id = 'md-splash-css';
    css.textContent = [
      '#mdSplash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;',
      'background:radial-gradient(circle at 50% 32%,#2a4373 0%,rgba(0,0,0,0) 62%),linear-gradient(160deg,#243b6b 0%,#1c2e5a 45%,#0f172a 100%);',
      'opacity:1;transition:opacity .45s ease}',
      '#mdSplash.md-hide{opacity:0;pointer-events:none}',
      '#mdSplash .md-badge{width:98px;height:98px;border-radius:28px;background:#fff;display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 18px 44px rgba(0,0,0,.32);animation:mdPop .75s cubic-bezier(.2,.9,.3,1.25) both}',
      '#mdSplash .md-badge img{width:62px;height:auto;display:block}',
      '#mdSplash .md-name{font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;font-weight:900;font-size:1.55rem;letter-spacing:.5px;',
      'color:#fff;text-transform:uppercase;animation:mdUp .6s ease .12s both}',
      '#mdSplash .md-name span{color:#ff4048}',
      '#mdSplash .md-sub{font-family:Inter,sans-serif;font-size:.7rem;letter-spacing:2.4px;text-transform:uppercase;',
      'color:rgba(255,255,255,.55);margin-top:-8px;animation:mdUp .6s ease .2s both}',
      '#mdSplash .md-line{width:136px;height:3px;border-radius:3px;background:rgba(255,255,255,.16);overflow:hidden;margin-top:10px}',
      '#mdSplash .md-line i{display:block;height:100%;width:42%;border-radius:3px;background:linear-gradient(90deg,#cc2229,#ff6b6f);animation:mdRun 1.15s ease-in-out infinite}',
      '@keyframes mdPop{from{transform:scale(.72);opacity:0}to{transform:scale(1);opacity:1}}',
      '@keyframes mdUp{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}',
      '@keyframes mdRun{0%{transform:translateX(-130%)}100%{transform:translateX(330%)}}',
      '@media (prefers-reduced-motion: reduce){#mdSplash *{animation:none!important}}'
    ].join('');
    document.head.appendChild(css);

    var el = document.createElement('div');
    el.id = 'mdSplash';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="md-badge"><img src="' + logo + '" alt=""></div>' +
      '<div class="md-name">Мой<span>Дом</span></div>' +
      '<div class="md-sub">Мультицентр недвижимости</div>' +
      '<div class="md-line"><i></i></div>';
    (document.body || document.documentElement).appendChild(el);
    try { sessionStorage.setItem('moydom_splash', '1'); } catch (e) {}

    var started = Date.now(), done = false;
    function hide() {
      if (done) return;
      done = true;
      setTimeout(function () {
        el.classList.add('md-hide');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
      }, Math.max(0, 520 - (Date.now() - started)));
    }
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide, { once: true });
    setTimeout(hide, 2600);
  } catch (e) { /* заставка не критична для сайта */ }
})();
