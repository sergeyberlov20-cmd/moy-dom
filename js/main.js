// js/main.js

document.addEventListener('DOMContentLoaded', () => {
  // 1. Бургер-меню
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const navMenu = document.querySelector('.nav ul');
  if (mobileBtn && navMenu) {
    mobileBtn.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
  }

  // 2. Кнопка "Наверх"
  const scrollBtn = document.getElementById('scrollTopBtn');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollBtn.style.display = 'block';
      } else {
        scrollBtn.style.display = 'none';
      }
    });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 3. Слайдер фотографий в карточке объекта
  const gallery = document.getElementById('object-gallery');
  if (gallery) {
    const images = JSON.parse(gallery.getAttribute('data-images'));
    if (images && images.length > 1) {
      let currentIndex = 0;
      
      // Создаем элементы управления
      gallery.innerHTML = `
        <div class="slider-container" style="position:relative; width:100%; height:100%;">
          <div class="slider-img" style="width:100%; height:100%; background-size:cover; background-position:center; transition: background-image 0.3s;"></div>
          <button class="slider-prev" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:40px; height:40px; cursor:pointer; font-size:1.2rem;">&#10094;</button>
          <button class="slider-next" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:40px; height:40px; cursor:pointer; font-size:1.2rem;">&#10095;</button>
          <div class="slider-dots" style="position:absolute; bottom:15px; left:50%; transform:translateX(-50%); display:flex; gap:8px;"></div>
        </div>
      `;
      
      const imgDiv = gallery.querySelector('.slider-img');
      const dotsContainer = gallery.querySelector('.slider-dots');
      
      const updateImage = () => {
        imgDiv.style.backgroundImage = `url('${images[currentIndex]}')`;
        // Обновляем точки
        const dots = dotsContainer.querySelectorAll('.dot');
        dots.forEach((dot, i) => {
          dot.style.background = i === currentIndex ? '#fff' : 'rgba(255,255,255,0.5)';
        });
      };

      // Создаем точки
      images.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.cssText = 'width:10px; height:10px; border-radius:50%; cursor:pointer; transition:background 0.2s;';
        dot.addEventListener('click', () => {
          currentIndex = i;
          updateImage();
        });
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

      // Инициализация
      updateImage();
    } else if (images && images.length === 1) {
      gallery.innerHTML = `<div style="width:100%; height:100%; background-image:url('${images[0]}'); background-size:cover; background-position:center;"></div>`;
    }
  }
});