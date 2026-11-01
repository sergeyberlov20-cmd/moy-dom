/**
 * Мой Дом - Core Engine
 * Version: 2.1.0 (Protected Build)
 */
(function() {
  'use strict';

  // 1. Конфигурация и утилиты
  const CONFIG = {
    phone: '+79495044455',
    telegram: 'https://t.me/nevizhimost_mariupol',
    formatter: new Intl.NumberFormat("ru-RU")
  };

  const formatPrice = (price, deal) => {
    const p = `${CONFIG.formatter.format(price)} ₽`;
    return deal === "Аренда" ? `${p}/мес` : p;
  };

  const cleanPath = (path = '') => String(path).replace(/^\//, '');

  // 2. Система уведомлений
  const Toast = {
    container: null,
    init() {
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
    },
    show(message, type = 'success') {
      this.init();
      const t = document.createElement('div');
      t.className = `toast ${type}`;
      t.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span><span class="toast-message">${message}</span>`;
      this.container.appendChild(t);
      
      requestAnimationFrame(() => t.classList.add('show'));
      setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
      }, 4000);
    }
  };

  // 3. Модуль Избранного
  const Favorites = {
    key: 'favorites',
    get() {
      try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch { return []; }
    },
    has(id) { return this.get().includes(id); },
    toggle(id) {
      const list = this.get();
      const exists = list.includes(id);
      const next = exists ? list.filter(x => x !== id) : [...list, id];
      localStorage.setItem(this.key, JSON.stringify(next));
      return !exists;
    }
  };

  // 4. Рендер карточек
  window.renderCard = (o, opts = {}) => {
    const { actions = false } = opts;
    const safeImage = cleanPath(o.image);
    const safeImages = (o.images?.length ? o.images : [o.image]).map(cleanPath);
    const isNew = o.date === new Date().toISOString().split('T')[0];
    const isFav = Favorites.has(o.id) ? 'active' : '';
    
    const sliderMarkup = safeImages.length > 1 
      ? `<button class="card-slider-btn prev">&#10094;</button><button class="card-slider-btn next">&#10095;</button>` 
      : '';

    const actionsMarkup = actions ? `
      <div style="display: flex; gap: 8px; margin-top: auto;">
        <a href="tel:${CONFIG.phone}" class="btn btn-accent" style="flex: 1; padding: 10px; font-size: 0.9rem;">📞 Позвонить</a>
        <a href="${CONFIG.telegram}" target="_blank" class="btn" style="flex: 1; padding: 10px; font-size: 0.9rem; background: #0088cc;">✈️ Telegram</a>
      </div>` : '';

    return `
      <article class="card">
        <div class="card-img-wrapper" data-images='${JSON.stringify(safeImages)}'>
          <img src="${safeImage}" class="card-img" loading="lazy" alt="${o.title}">
          <span class="card-badge ${isNew ? 'new' : ''}">${isNew ? 'Новинка' : o.deal}</span>
          <button class="favorite-btn ${isFav}" onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite(${o.id}, this)">
            <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
          </button>
          ${sliderMarkup}
        </div>
        <div class="card-body">
          <div class="card-price">${formatPrice(o.price, o.deal)}</div>
          <div class="card-title">${o.title}</div>
          <div class="card-meta">
            <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;opacity:0.6;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            ${o.address}
          </div>
          <a href="object.html?id=${o.id}" class="btn" style="${actions ? 'margin-bottom: 12px;' : ''}">Подробнее</a>
          ${actionsMarkup}
        </div>
      </article>`;
  };

  // 5. Глобальные экшены для HTML
  window.toggleFavorite = (id, btn) => {
    const saved = Favorites.toggle(id);
    btn.classList.toggle('active', saved);
    Toast.show(saved ? 'Объект сохранен' : 'Объект удален', saved ? 'success' : 'error');
  };

  window.debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // 6. Инициализация UI
  window.initMiniSliders = () => {
    document.querySelectorAll('.card-img-wrapper').forEach(w => {
      if (w.dataset.init) return;
      const imgs = JSON.parse(w.dataset.images || '[]');
      if (imgs.length <= 1) return;
      
      let idx = 0;
      const img = w.querySelector('.card-img');
      const update = () => { img.src = imgs[idx]; };

      w.querySelector('.prev')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); idx = (idx - 1 + imgs.length) % imgs.length; update(); });
      w.querySelector('.next')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); idx = (idx + 1) % imgs.length; update(); });
      w.dataset.init = '1';
    });
  };

  window.initDetailGallery = () => {
    const g = document.getElementById('object-gallery');
    if (!g) return;
    const imgs = JSON.parse(g.dataset.images || '[]').map(cleanPath);
    if (!imgs.length) return;

    if (imgs.length === 1) {
      g.innerHTML = `<div style="width:100%;height:100%;background:url('${imgs[0]}') center/cover;"></div>`;
      return;
    }

    let idx = 0;
    g.innerHTML = `
      <div style="position:relative;width:100%;height:100%;">
        <div class="slider-img" style="width:100%;height:100%;background-size:cover;background-position:center;transition:0.3s;"></div>
        <button class="slider-prev" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:44px;height:44px;cursor:pointer;z-index:10;">&#10094;</button>
        <button class="slider-next" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:44px;height:44px;cursor:pointer;z-index:10;">&#10095;</button>
        <div class="slider-dots" style="position:absolute;bottom:15px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;"></div>
      </div>`;

    const imgDiv = g.querySelector('.slider-img');
    const dots = g.querySelector('.slider-dots');
    
    const update = () => {
      imgDiv.style.backgroundImage = `url('${imgs[idx]}')`;
      dots.querySelectorAll('.dot').forEach((d, i) => d.style.background = i === idx ? '#fff' : 'rgba(255,255,255,0.5)');
    };

    imgs.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'dot';
      d.style.cssText = 'width:12px;height:12px;border-radius:50%;cursor:pointer;border:1px solid rgba(0,0,0,0.3);';
      d.addEventListener('click', () => { idx = i; update(); });
      dots.appendChild(d);
    });

    g.querySelector('.slider-prev').addEventListener('click', () => { idx = (idx - 1 + imgs.length) % imgs.length; update(); });
    g.querySelector('.slider-next').addEventListener('click', () => { idx = (idx + 1) % imgs.length; update(); });
    update();
  };

  // 7. Навигация
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('main-nav');
    if (btn && nav) {
      btn.addEventListener('click', e => { e.stopPropagation(); nav.classList.toggle('show'); });
      document.addEventListener('click', e => { if (!nav.contains(e.target) && !btn.contains(e.target)) nav.classList.remove('show'); });
    }

    const scrollBtn = document.getElementById('scrollTopBtn');
    if (scrollBtn) {
      window.addEventListener('scroll', () => scrollBtn.style.display = window.scrollY > 300 ? 'flex' : 'none');
      scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  });

})();
