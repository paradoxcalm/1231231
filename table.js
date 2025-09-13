/**
 * Вставляет стили для таблицы, если они ещё не добавлены.  Стили
 * инкапсулированы, поэтому не вмешиваются в глобальные правила
 * оформления сайта.
 */
function injectTableStyles() {
  if (document.getElementById('custom-shipment-table-styles')) return;
  const style = document.createElement('style');
  style.id = 'custom-shipment-table-styles';
  style.textContent = `
    /* Контейнер таблицы */
    #tableContainer {
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      box-sizing: border-box;
    }
    /* Таблица: минимальная ширина, чтобы столбцы не сжимались */
    #tableContainer table {
      width: 100%;
      min-width: 1000px;
      border-collapse: collapse;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
    }
    #tableContainer thead th {
      position: sticky;
      top: 0;
      background-color: #f1f5f9;
      color: #374151;
      font-weight: 600;
      padding: 0.75rem;
      border-bottom: 2px solid #e5e7eb;
      text-align: left;
      white-space: nowrap;
      z-index: 1;
      user-select: none;
    }
    #tableContainer tbody td {
      padding: 0.75rem;
      font-size: 0.875rem;
      color: #374151;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: middle; /* стабильная высота строки */
      white-space: nowrap;
    }
    #tableContainer tbody tr:nth-child(even) {
      background-color: #f9fafb;
    }
    /* Миниатюры фото: фиксируем размер, чтобы строки не растягивались */
    #tableContainer img {
      width: 40px;
      height: 40px;
      object-fit: cover;
      cursor: pointer;
      border-radius: 4px;
      display: block;
    }
    /* Минимальная высота строки для выравнивания с фотографиями */
    #tableContainer tbody tr {
      min-height: 50px;
    }
    /* Поле фильтрации */
    .filter-input {
      padding: 0.5rem;
      font-size: 0.875rem;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      width: 100%;
      max-width: 300px;
      box-sizing: border-box;
    }
    /* Контейнер пагинации */
    #paginationContainer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 1rem;
      gap: 0.25rem;
    }
    #paginationContainer button.pagination-button {
      padding: 0.4rem 0.7rem;
      border: 1px solid #d1d5db;
      background-color: #ffffff;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      color: #374151;
    }
    #paginationContainer button.pagination-button.active {
      background-color: #4ade80;
      color: #ffffff;
      border-color: #4ade80;
    }
    #paginationContainer span.pagination-ellipsis {
      padding: 0.4rem 0.7rem;
      font-size: 0.875rem;
      color: #6b7280;
    }
    /* Подсветка строк при наведении */
    #tableContainer tbody tr:hover {
      background-color: #eef2ff;
    }
    /* Отключённые кнопки пагинации */
    #paginationContainer button[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}

// Основная функция: запрашивает данные, отображает таблицу и
// управляет пагинацией. Логика загрузки и структура данных сохранены.
function fetchDataAndDisplayTable(city = '') {
  injectTableStyles();
  let url = 'fetch_data.php';
  if (city) url += `?city=${encodeURIComponent(city)}`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      const tbl = document.getElementById('tableContainer');
      const pag = document.getElementById('paginationContainer');
      if (!tbl) return console.error('tableContainer не найден');

      if (!Array.isArray(data) || !data.length) {
        tbl.innerHTML = '<p>Нет данных для отображения.</p>';
        if (pag) {
          pag.style.display = 'none';
          pag.innerHTML = '';
        }
        return;
      }
      if (pag) pag.style.display = 'flex';

      // Параметры отображения
      let perPage = 10;
      const perPageOptions = [10, 25, 50];

      // Состояние
      let current = 1;
      let sortColumn = null;  // индекс колонки
      let sortDir = 1;        // 1 = asc, -1 = desc
      let currentQuery = '';  // строка поиска (сохраняем между рендерами)

      // Данные для отображения
      let workingData = data.slice();

      // Список заголовков (нужен для сброса стрелок без перерендера)
      const HEADERS = [
        'Отправитель','Направление','Дата приёмки','Дата сдачи',
        'Тип','Кол-во','Оплата','Фото','Комментарий'
      ];

      /**
       * Сортировка
       * Порядок колонок:
       * 0 sender, 1 direction, 2 submission_date, 3 date_of_delivery,
       * 4 shipment_type, 5 boxes (число), 6 payment (число),
       * 7 photo_thumb, 8 comment
       */
      function applySort() {
        if (sortColumn === null) return;
        const keyMap = [
          'sender',          // 0
          'direction',       // 1
          'submission_date', // 2
          'date_of_delivery',// 3
          'shipment_type',   // 4
          'boxes',           // 5
          'payment',         // 6
          'photo_thumb',     // 7
          'comment'          // 8
        ];
        const key = keyMap[sortColumn];
        workingData.sort((a, b) => {
          let valA = a[key];
          let valB = b[key];
          if (valA === undefined || valA === null) valA = '';
          if (valB === undefined || valB === null) valB = '';

          if (sortColumn === 5 || sortColumn === 6) { // числовые
            const numA = parseFloat(valA) || 0;
            const numB = parseFloat(valB) || 0;
            return sortDir * (numA - numB);
          }
          return sortDir * String(valA).localeCompare(String(valB), 'ru', { sensitivity: 'base' });
        });
      }

      // Генерация строк <tr>...</tr> из среза данных
      function buildRowsHTML(slice) {
        let rows = '';
        slice.forEach(r => {
          rows += `
            <tr>
              <td>${r.sender || '—'}</td>
              <td>${r.direction || '—'}</td>
              <td>${r.submission_date || '—'}</td>
              <td>${r.date_of_delivery || '—'}</td>
              <td>${r.shipment_type || '—'}</td>
              <td>${r.boxes != null ? r.boxes : 0}</td>
              <td>${r.payment != null ? r.payment : 0}${r.payment_type ? ` (${r.payment_type})` : ''}</td>
              <td style="text-align:center;">
                ${r.photo_thumb
                    ? `<img src="${r.photo_thumb}" alt="Фото" onclick="openPhotoGallery(${r.id})">`
                    : 'Нет фото'}
              </td>
              <td>${r.comment || '—'}</td>
            </tr>
          `;
        });
        return rows;
      }

      // Перерисовать только тело таблицы и пагинацию (без шапки и инпутов)
      function renderRowsAndPager() {
        // Сортируем перед разрезанием
        applySort();

        const start = (current - 1) * perPage;
        const slice = workingData.slice(start, start + perPage);

        const tbody = tbl.querySelector('tbody');
        if (tbody) tbody.innerHTML = buildRowsHTML(slice);

        renderPager(); // пагинация отдельно
      }

      // Полный рендер таблицы (шапка, инпуты, тело)
      function renderPage(page) {
        tbl.innerHTML = '';
        current = page;

        // Сортировка перед нарезкой страниц
        applySort();

        const start = (page - 1) * perPage;
        const slice = workingData.slice(start, start + perPage);
        const safeQuery = currentQuery.replace(/"/g, '&quot;');

        let html = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <input type="text" id="filterInput" placeholder="Поиск..." class="filter-input" style="max-width:200px;" value="${safeQuery}" />
            <div style="display:flex; align-items:center; gap:4px; font-size:0.875rem;">
              <label for="perPageSelect">На странице:</label>
              <select id="perPageSelect" style="padding:0.25rem 0.5rem; border:1px solid #d1d5db; border-radius:4px; font-size:0.875rem;">
                ${perPageOptions.map(n => `<option value="${n}" ${n === perPage ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                ${HEADERS.map((title, idx) => {
                  let arrow = '';
                  if (sortColumn === idx) arrow = sortDir === 1 ? ' ▲' : ' ▼';
                  return `<th data-sort-index="${idx}">${title}${arrow}</th>`;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${buildRowsHTML(slice)}
            </tbody>
          </table>
        `;
        tbl.innerHTML = html;

        // Сортировка по клику по заголовку
        const ths = tbl.querySelectorAll('th[data-sort-index]');
        ths.forEach(th => {
          th.style.cursor = 'pointer';
          th.onclick = () => {
            const idx = parseInt(th.getAttribute('data-sort-index'), 10);
            if (sortColumn === idx) {
              sortDir = -sortDir;
            } else {
              sortColumn = idx;
              sortDir = 1;
            }
            // При изменении сортировки перерисуем шапку, чтобы обновить стрелки
            renderPage(1);
            // пагинация перерисуется внутри renderPage через renderPager() ниже
          };
        });

        // Селектор количества строк
        const perPageSelect = document.getElementById('perPageSelect');
        perPageSelect.onchange = () => {
          perPage = parseInt(perPageSelect.value, 10);
          current = 1;
          // Не трогаем шапку, чтобы не терять фокус поля поиска
          renderRowsAndPager();
        };

        // Поиск: не перерисовываем шапку, чтобы не терять фокус
        const filterInput = document.getElementById('filterInput');
        filterInput.oninput = () => {
          currentQuery = filterInput.value.trim().toLowerCase();

          if (!currentQuery) {
            workingData = data.slice();
          } else {
            workingData = data.filter(item => {
              return (
                (item.sender && String(item.sender).toLowerCase().includes(currentQuery)) ||
                (item.direction && String(item.direction).toLowerCase().includes(currentQuery)) ||
                (item.submission_date && String(item.submission_date).toLowerCase().includes(currentQuery)) ||
                (item.date_of_delivery && String(item.date_of_delivery).toLowerCase().includes(currentQuery)) ||
                (item.shipment_type && String(item.shipment_type).toLowerCase().includes(currentQuery)) ||
                (item.payment_type && String(item.payment_type).toLowerCase().includes(currentQuery)) ||
                (item.comment && String(item.comment).toLowerCase().includes(currentQuery)) ||
                (item.payment != null && String(item.payment).toLowerCase().includes(currentQuery)) ||
                (item.boxes != null && String(item.boxes).toLowerCase().includes(currentQuery))
              );
            });
          }

          // Сброс сортировки визуально: убираем стрелки в th без полного рендера
          sortColumn = null;
          sortDir = 1;
          const ths = tbl.querySelectorAll('th[data-sort-index]');
          ths.forEach(th => {
            const idx = parseInt(th.getAttribute('data-sort-index'), 10);
            th.innerHTML = HEADERS[idx]; // вернуть чистые заголовки без стрелок
          });

          current = 1;
          // Обновляем только тело и пагинацию — фокус в инпуте остаётся
          renderRowsAndPager();
        };

        // Первая отрисовка пагинации для текущей страницы
        renderPager();
      }

      // Пагинация (кнопки навигации)
      function renderPager() {
        if (!pag) return;
        pag.innerHTML = '';

        const totalPages = Math.max(1, Math.ceil(workingData.length / perPage));
        const m = 2; // «радиус» вокруг текущей

        const prevBtn = document.createElement('button');
        prevBtn.classList.add('pagination-button');
        prevBtn.textContent = '‹';
        prevBtn.disabled = current <= 1;
        prevBtn.onclick = () => {
          if (current > 1) {
            current--;
            renderRowsAndPager(); // не трогаем шапку
          }
        };
        pag.appendChild(prevBtn);

        let start = Math.max(1, current - m);
        let end   = Math.min(totalPages, current + m);

        if (start > 1) {
          const firstBtn = document.createElement('button');
          firstBtn.classList.add('pagination-button');
          firstBtn.textContent = '1';
          firstBtn.onclick = () => {
            current = 1;
            renderRowsAndPager();
          };
          pag.appendChild(firstBtn);

          if (start > 2) {
            const ell = document.createElement('span');
            ell.textContent = '…';
            ell.classList.add('pagination-ellipsis');
            pag.appendChild(ell);
          }
        }

        for (let i = start; i <= end; i++) {
          const btn = document.createElement('button');
          btn.classList.add('pagination-button');
          btn.textContent = String(i);
          if (i === current) btn.classList.add('active');
          btn.onclick = () => {
            current = i;
            renderRowsAndPager();
          };
          pag.appendChild(btn);
        }

        if (end < totalPages) {
          if (end < totalPages - 1) {
            const ell2 = document.createElement('span');
            ell2.textContent = '…';
            ell2.classList.add('pagination-ellipsis');
            pag.appendChild(ell2);
          }
          const lastBtn = document.createElement('button');
          lastBtn.classList.add('pagination-button');
          lastBtn.textContent = String(totalPages);
          lastBtn.onclick = () => {
            current = totalPages;
            renderRowsAndPager();
          };
          pag.appendChild(lastBtn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.classList.add('pagination-button');
        nextBtn.textContent = '›';
        nextBtn.disabled = current >= totalPages;
        nextBtn.onclick = () => {
          if (current < totalPages) {
            current++;
            renderRowsAndPager();
          }
        };
        pag.appendChild(nextBtn);
      }

      // Для совместимости: внешние вызовы могут менять страницу
      window.changePage = function (p) {
        current = p;
        renderRowsAndPager();
      };

      // Первая отрисовка
      renderPage(1);
    })
    .catch(err => {
      console.error('Ошибка:', err);
      const tbl = document.getElementById('tableContainer');
      if (tbl) tbl.innerHTML = '<p>Ошибка при загрузке данных.</p>';
      const pag = document.getElementById('paginationContainer');
      if (pag) pag.innerHTML = '';
    });
}

// Экспорт в глобальную область
window.fetchDataAndDisplayTable = fetchDataAndDisplayTable;
