// js/main.js
document.addEventListener('DOMContentLoaded', () => {
  // 1. Бургер-меню
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const navMenu = document.querySelector('.nav ul');
  if (mobileBtn && navMenu) {
    mobileBtn.addEventListener('click', () => navMenu.classList.toggle('show'));
  }

  // 2. Кнопка "Наверх"
  const scrollBtn = document.getElementById('scrollTopBtn');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) scrollBtn.style.display = 'block';
      else scrollBtn.style.display = 'none';
    });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // 3. Функция инициализации слайдеров в карточках (миниатюрах)
  window.initMiniSliders = function() {
    document.querySelectorAll('.card-img-wrapper').forEach(wrapper => {
      // Если слайдер уже инициализирован, пропускаем
      if (wrapper.dataset.sliderInitialized) return; 
      
      const imgDiv = wrapper.querySelector('.card-img');
      const images = JSON.parse(wrapper.getAttribute('data-images') || '[]');
      let currentIndex = 0;

      // Если фото 1 или 0, стрелки не нужны
      if (images.length <= 1) return; 

      const prevBtn = wrapper.querySelector('.prev');
      const nextBtn = wrapper.querySelector('.next');

      if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation(); // Чтобы не открывалась карточка при клике на стрелку
          currentIndex = (currentIndex - 1 + images.length) % images.length;
          imgDiv.style.backgroundImage = `url('${images[currentIndex]}')`;
        });
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          currentIndex = (currentIndex + 1) % images.length;
          imgDiv.style.backgroundImage = `url('${images[currentIndex]}')`;
        });
      }
      wrapper.dataset.sliderInitialized = "true";
    });
  };

  // 4. Слайдер в детальной карточке (object.html)
  const gallery = document.getElementById('object-gallery');
  if (gallery) {
    let images = [];
    try {
      images = JSON.parse(gallery.getAttribute('data-images') || '[]');
    } catch(e) {}

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
  }
});
