// tariffs.js

// tariffs.js – обновлённая реализация раздела "Тарифы"
function loadTariffs() {
  const dynamicContent = document.getElementById('dynamicContent');
  if (!dynamicContent) return;

  dynamicContent.innerHTML = `
    <div id="tariffsSection">
      <h2>Тарифы</h2>
      <select id="mobileCitySelect" style="display:none;"></select>
      <div id="mobileTariffCards" class="mobile-tariff-cards"></div>
      <div id="tariffsTabs" class="tariff-tabs"></div>
      <div id="tariffsTableContainer"><p>Загрузка тарифов...</p></div>
    </div>
  `;

  const isMobile = window.innerWidth <= 700;
  const citySelect = document.getElementById('mobileCitySelect');
  const cardsContainer = document.getElementById('mobileTariffCards');
  const tableContainer = document.getElementById('tariffsTableContainer');
  const tabsContainer = document.getElementById('tariffsTabs');

  fetch('/admin/api/tariffs/fetch_tariffs.php')
    .then(r => r.json())
    .then(data => {
      if (!data.success) {
        tableContainer.innerHTML = `<p>Ошибка: ${data.message || 'неизвестная'}</p>`;
        return;
      }

      const tariffs = data.data;
      const cities = Object.keys(tariffs);
      if (cities.length === 0) {
        tableContainer.innerHTML = '<p>Нет данных по тарифам.</p>';
        return;
      }

      // === Мобильный интерфейс ===
      if (isMobile) {
        citySelect.style.display = 'block';

        // Заполняем select
        cities.forEach(city => {
          const opt = document.createElement('option');
          opt.value = city;
          opt.textContent = city;
          citySelect.appendChild(opt);
        });

        citySelect.addEventListener('change', () => {
          renderCards(citySelect.value, tariffs[citySelect.value]);
        });

        // Показываем первый город по умолчанию
        renderCards(cities[0], tariffs[cities[0]]);
        citySelect.value = cities[0];
        tableContainer.style.display = 'none';
        tabsContainer.style.display = 'none';
      } 
      // === Десктопная таблица ===
      else {
        // Показываем табы
        tabsContainer.innerHTML = '';
        tableContainer.innerHTML = '';

        cities.forEach((city, index) => {
          const tabBtn = document.createElement('button');
          tabBtn.className = 'tariff-tab';
          tabBtn.textContent = city;
          if (index === 0) tabBtn.classList.add('active');
          tabBtn.addEventListener('click', () => {
            document.querySelectorAll('.tariff-tab').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
            renderTable(city, tariffs[city]);
          });
          tabsContainer.appendChild(tabBtn);
        });

        renderTable(cities[0], tariffs[cities[0]]);
      }
    })
    .catch(err => {
      console.error('Ошибка:', err);
      tableContainer.innerHTML = '<p>Ошибка загрузки данных.</p>';
    });

  function renderCards(city, data) {
    cardsContainer.innerHTML = '';
    if (!data || Object.keys(data).length === 0) {
      cardsContainer.innerHTML = '<p>Нет тарифов для выбранного города.</p>';
      return;
    }

    for (const [warehouse, prices] of Object.entries(data)) {
      const box = prices.box_price != null ? `${prices.box_price} ₽` : '—';
      const pallet = prices.pallet_price != null ? `${prices.pallet_price} ₽` : '—';

      const card = document.createElement('div');
      card.className = 'tariff-card';
      card.innerHTML = `
        <h4>${warehouse}</h4>
        <div class="price-line"><span class="price-label">📦 Короб:</span>${box}</div>
        <div class="price-line"><span class="price-label">🧱 Паллет:</span>${pallet}</div>
      `;
      cardsContainer.appendChild(card);
    }
  }

  function renderTable(city, data) {
    let rowsHTML = '';
    for (const warehouse in data) {
      const prices = data[warehouse];
      const box = prices.box_price != null ? prices.box_price : '—';
      const pallet = prices.pallet_price != null ? prices.pallet_price : '—';
      rowsHTML += `
        <tr>
          <td>${warehouse}</td>
          <td>${box}</td>
          <td>${pallet}</td>
        </tr>`;
    }

    tableContainer.innerHTML = `
      <table class="tariffs-table">
        <thead>
          <tr>
            <th>Склад</th>
            <th>Цена за короб (₽)</th>
            <th>Цена за паллету (₽)</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    `;
  }
}

