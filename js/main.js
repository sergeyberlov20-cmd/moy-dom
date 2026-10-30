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
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, 4000);
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

window.isFavorite = function(id) {
  return getFavorites().includes(id);
};

// ХЕЛПЕР: Очистка пути от лишних слешей в начале (чтобы картинки грузились)
function cleanImagePath(path) {
  if (!path) return '';
  return path.replace(/^\//, ''); // Удаляет первый слеш, если он есть
}

// 4. УНИВЕРСАЛЬНЫЙ РЕНДЕР КАРТОЧКИ
window.renderCard = function(o, opts = {}) {
  const actions = opts.actions === true;
  const safeMainImage = cleanImagePath(o.image);
  
  // Очищаем массив картинок для слайдера
  const safeImages = (o.images && o.images.length > 0) 
    ? o.images.map(img => cleanImagePath(img)) 
    : [safeMainImage];

  let sliderBtns = '';
  if (safeImages.length > 1) {
    sliderBtns = `<button class="card-slider-btn prev">&#10094;</button><button class="card-slider-btn next">&#10095;</button>`;
  }
  
  const isFav = isFavorite(o.id) ? 'active' : '';

  const actionsHtml = actions
    ? `<div style="display: flex; gap: 8px; margin-top: auto;">
         <a href="tel:+79495044455" class="btn btn-accent" style="flex: 1; padding: 8px; font-size: 0.9rem;">📞 Позвонить</a>
         <a href="https://t.me/nevizhimost_mariupol" target="_blank" class="btn" style="flex: 1; padding: 8px; font-size: 0.9rem; background: #0088cc;">✈️ Telegram</a>
       </div>`
    : '';

  const moreBtnStyle = actions ? 'margin-bottom: 8px;' : '';

  return `
    <article class="card">
      <div class="card-img-wrapper" data-images='${JSON.stringify(safeImages)}'>
        <img src="${safeMainImage}" class="card-img" loading="lazy" alt="${o.title}">
        <span class="card-badge">${o.deal}</span>
        <button class="favorite-btn ${isFav}" aria-label="В избранное" onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite(${o.id}, this)">
          <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
        </button>
        ${sliderBtns}
      </div>
      <div class="card-body">
        <div class="card-price">${formatPrice(o.price, o.deal)}</div>
        <div class="card-title">${o.title}</div>
        <div class="card-meta">${o.address}</div>
        <a href="object.html?id=${o.id}" class="btn" style="${moreBtnStyle}">Подробнее</a>
        ${actionsHtml}
      </div>
    </article>`;
};

// 5. ДЕБАУНС
window.debounce = function(fn, ms) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
};

// 6. СЛАЙДЕР ДЛЯ КАТАЛОГА
window.initMiniSliders = function() {
  document.querySelectorAll('.card-img-wrapper').forEach(wrapper => {
    if (wrapper.dataset.sliderInitialized) return; 
    
    const imgTag = wrapper.querySelector('.card-img');
    // Тут уже очищенные пути, так как мы передали safeImages в data-images
    const images = JSON.parse(wrapper.getAttribute('data-images') || '[]');
    let currentIndex = 0;

    if (images.length <= 1) return; 

    const prevBtn = wrapper.querySelector('.prev');
    const nextBtn = wrapper.querySelector('.next');

    if (prevBtn && nextBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        imgTag.src = images[currentIndex];
      });
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        currentIndex = (currentIndex + 1) % images.length;
        imgTag.src = images[currentIndex];
      });
    }
    wrapper.dataset.sliderInitialized = "true";
  });
};

// 7. СЛАЙДЕР ДЛЯ ДЕТАЛЬНОЙ КАРТОЧКИ
window.initDetailGallery = function() {
  const gallery = document.getElementById('object-gallery');
  if (!gallery) return;

  let rawImages = [];
  try {
    rawImages = JSON.parse(gallery.getAttribute('data-images') || '[]');
  } catch(e) {}

  // Очищаем пути и для детальной галереи
  const images = rawImages.map(img => cleanImagePath(img));

  if (images && images.length > 1) {
    let currentIndex = 0;
    
    gallery.innerHTML = `
      <div style="position:relative; width:100%; height:100%;">
        <div class="slider-img" style="width:100%; height:100%; background-size:cover; background-position:center; transition: background-image 0.3s;"></div>
        <button class="slider-prev" type="button" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:44px; height:44px; cursor:pointer; font-size:1.2rem; z-index:10; display:flex; align-items:center; justify-content:center;">&#10094;</button>
        <button class="slider-next" type="button" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:44px; height:44px; cursor:pointer; font-size:1.2rem; z-index:10; display:flex; align-items:center; justify-content:center;">&#10095;</button>
        <div class="slider-dots" style="position:absolute; bottom:15px; left:50%; transform:translateX(-50%); display:flex; gap:8px; z-index:10;"></div>
      </div>
    `;
    
    const imgDiv = gallery.querySelector('.slider-img');
    const dotsContainer = gallery.querySelector('.slider-dots');
    
    const updateImage = () => {
      imgDiv.style.backgroundImage = `url('${images[currentIndex]}')`;
      const dots = dotsContainer.querySelectorAll('.dot');
      dots.forEach((dot, i) => {
        dot.style.background = i === currentIndex ? '#fff' : 'rgba(255,255,255,0.5)';
      });
    };

    images.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.style.cssText = 'width:12px; height:12px; border-radius:50%; cursor:pointer; border: 1px solid rgba(0,0,0,0.3); transition:background 0.2s;';
      dot.addEventListener('click', () => { currentIndex = i; updateImage(); });
      dotsContainer.appendChild(dot);
    });

    gallery.querySelector('.slider-prev').addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      updateImage();
    });
    gallery.querySelector('.slider-next').addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % images.length;
      updateImage();
    });

    updateImage();
  } else if (images && images.length === 1) {
    gallery.innerHTML = `<div style="width:100%; height:100%; background-image:url('${images[0]}'); background-size:cover; background-position:center;"></div>`;
  }
};

// 8. БУРГЕР-МЕНЮ И КНОПКА НАВЕРХ
document.addEventListener('DOMContentLoaded', () => {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mainNav = document.getElementById('main-nav');
  
  if (mobileBtn && mainNav) {
    mobileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) scrollBtn.style.display = 'flex';
      else scrollBtn.style.display = 'none';
    });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
});
