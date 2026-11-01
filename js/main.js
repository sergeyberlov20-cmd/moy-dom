// js/main.js
const _priceFormatter = new Intl.NumberFormat("ru-RU");
window.formatPrice = function(price, deal) {
  const formatted = _priceFormatter.format(price) + " ₽";
  return deal === "Аренда" ? formatted + "/мес" : formatted;
};

// ... (остальные функции showToast, getFavorites, toggleFavorite оставляем без изменений) ...

function cleanImagePath(path) {
  if (!path) return '';
  return path.replace(/^\//, '');
}

window.renderCard = function(o, opts = {}) {
  const actions = opts.actions === true;
  const safeMainImage = cleanImagePath(o.image);
  const safeImages = (o.images && o.images.length > 0) 
    ? o.images.map(img => cleanImagePath(img)) 
    : [safeMainImage];

  let sliderBtns = '';
  if (safeImages.length > 1) {
    sliderBtns = `<button class="card-slider-btn prev">&#10094;</button><button class="card-slider-btn next">&#10095;</button>`;
  }
  
  const isFav = isFavorite(o.id) ? 'active' : '';
  const today = new Date().toISOString().split('T')[0];
  const isNew = o.date === today;
  const badgeHtml = isNew 
    ? `<span class="card-badge new">Новинка</span>` 
    : `<span class="card-badge">${o.deal}</span>`;

  const actionsHtml = actions
    ? `<div style="display: flex; gap: 8px; margin-top: auto;">
         <a href="tel:+79495044455" class="btn btn-accent" style="flex: 1; padding: 10px; font-size: 0.9rem;">📞 Позвонить</a>
         <a href="https://t.me/nevizhimost_mariupol" target="_blank" class="btn" style="flex: 1; padding: 10px; font-size: 0.9rem; background: #0088cc;">✈️ Telegram</a>
       </div>`
    : '';

  const moreBtnStyle = actions ? 'margin-bottom: 12px;' : '';

  // ДОБАВИЛИ width="320" height="240" (пропорции нашей карточки) и loading="eager" для первых карточек
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
        <div class="card-meta">
          <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:currentColor; opacity:0.6;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          ${o.address}
        </div>
        <a href="object.html?id=${o.id}" class="btn" style="${moreBtnStyle}">Подробнее</a>
        ${actionsHtml}
      </div>
    </article>`;
};

// ... (остальной код initMiniSliders, initDetailGallery, DOMContentLoaded оставляем без изменений) ...
