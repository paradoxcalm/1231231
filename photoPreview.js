// ===== photoPreview.js (под разметку с #photoModalImg) =====

// Ожидается разметка:
// <div id="photoModal" class="modal" style="display:none">
//   <span id="photoModalClose" class="close-button">✕</span>
//   <img id="photoModalImg" class="modal-image" src="" alt="Фото">
// </div>

(function () {
  const modal    = document.getElementById('photoModal');
  const imgEl    = document.getElementById('photoModalImg');
  const closeBtn = document.getElementById('photoModalClose');

  if (!modal || !imgEl) {
    console.error('photoPreview.js: не найден #photoModal или #photoModalImg');
    return;
  }

  // ---- ВСПОМОГАТЕЛЬНОЕ ----

  function lockBody(yes) {
    if (yes) {
      document.body.dataset._scrollY = String(window.scrollY || 0);
      document.body.style.position = 'fixed';
      document.body.style.top = `-${document.body.dataset._scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const y = parseInt(document.body.dataset._scrollY || '0', 10);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, y);
    }
  }

  function normalizeToUrlArray(input) {
    const KEYS = ['photos','images','items','list','data','full','url','path','image','photo','src',
                  'original','large','big','original_url','photo_url','full_url'];

    function pick(obj) {
      for (const k of KEYS) if (obj && obj[k]) return obj[k];
      return null;
    }

    let raw = input;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const maybe = pick(raw);
      if (maybe) raw = maybe;
    }

    if (Array.isArray(raw)) {
      return raw.map(v => typeof v === 'string' ? v : String(pick(v) || '')).filter(Boolean);
    }
    if (typeof raw === 'string') return [raw];
    if (raw && typeof raw === 'object') {
      const one = pick(raw);
      return one ? [String(one)] : [];
    }
    return [];
  }

  function showModalWith(src) {
    if (!src) {
      alert('Путь к фото пустой.');
      return;
    }
    imgEl.onerror = function () {
      console.error('Не удалось загрузить изображение:', imgEl.src);
      alert('Не удалось загрузить фото: ' + imgEl.src);
    };
    imgEl.src = src;                // ВАЖНО: ставим src перед показом
    modal.style.display = 'flex';
    lockBody(true);
  }

  function closePhotoGallery() {
    modal.style.display = 'none';
    imgEl.removeAttribute('src');   // чистим src
    lockBody(false);
  }

  // ---- ПУБЛИЧНАЯ ФУНКЦИЯ ----
  // Примеры:
  //   openPhotoGallery(235)                           -> возьмёт URL через fetch_photos.php?id=235
  //   openPhotoGallery('/uploads/file.jpg')           -> откроет напрямую
  //   openPhotoGallery(['url1','url2'])               -> откроет первый
  window.openPhotoGallery = function (idOrUrl) {
    // Массив URL
    if (Array.isArray(idOrUrl)) {
      const arr = normalizeToUrlArray(idOrUrl);
      return arr.length ? showModalWith(arr[0]) : alert('Фото отсутствует.');
    }

    // Явный URL (строка со слешем или начинающаяся с http/https)
    if (typeof idOrUrl === 'string' && idOrUrl.trim() !== '') {
      if (idOrUrl.includes('/') || /^https?:\/\//i.test(idOrUrl)) {
        return showModalWith(idOrUrl.trim());
      }
    }

    // ID -> запрос к PHP
    fetch('fetch_photos.php?id=' + encodeURIComponent(idOrUrl))
      .then(r => r.json())
      .then(data => {
        const arr = normalizeToUrlArray(data);
        if (arr.length) showModalWith(arr[0]);
        else alert('Фото отсутствует.');
      })
      .catch(err => {
        console.error('Ошибка загрузки фото:', err);
        alert('Не удалось загрузить фото.');
      });
  };

  // ---- ЗАКРЫТИЕ ----
  closeBtn && closeBtn.addEventListener('click', closePhotoGallery);
  modal.addEventListener('click', (e) => { if (e.target === modal) closePhotoGallery(); });
  document.addEventListener('keydown', (e) => {
    if (modal.style.display !== 'none' && e.key === 'Escape') closePhotoGallery();
  });

  // Экспорт на всякий случай
  window.closePhotoGallery = closePhotoGallery;
})();
