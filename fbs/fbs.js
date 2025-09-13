function loadFBS() {
    // Загружаем список сортировочных центров
    fetch('fbs/centers.php')
        .then(res => res.json())
        .then(centers => {
            // Добавляем вручную нужные СЦ, если их нет в ответе
            const extraCenters = [
                { id: 'sc_makhachkala', name: 'СЦ Махачкала' },
                { id: 'sc_vladikavkaz', name: 'СЦ Владикавказ' }
            ];
            extraCenters.forEach(sc => {
                if (!centers.some(c => c.name === sc.name)) {
                    centers.push(sc);
                }
            });

            // Определяем роль пользователя
            let userRole = window.userRole || (document.getElementById('userRole') 
                           ? document.getElementById('userRole').value : 'manager');

            // Строим HTML шапки вкладок
            let contentHTML = '<div class="tab-header">';
            centers.forEach(center => {
                contentHTML += `
                    <button class="tab-button${center === centers[0] ? ' active' : ''}" 
                            onclick="switchCityTab('${center.id}')">
                        ${center.name}
                    </button>`;
            });
            // Админам — кнопка «Добавить СЦ» (по аналогии с городами)
            if (userRole === 'admin') {
                contentHTML += `
                    <button class="tab-button" onclick="openAddCenterModal()">+ Добавить СЦ</button>`;
            }
            contentHTML += '</div>';

            // Сохраняем соответствие id ↔ name (используем прежние переменные)
            window.cityList = centers;
            window.cityMap = {};    // name -> id
            window.cityIdMap = {};  // id   -> name
            centers.forEach(center => {
                window.cityMap[center.name] = center.id;
                window.cityIdMap[center.id] = center.name;
            });

            // Создаем содержимое для каждой вкладки (центр/СЦ)
            centers.forEach(center => {
                contentHTML += `
                    <div id="cityTab-${center.id}" class="city-content" style="display:none;">
                        <div class="city-controls">
                            <button class="secondary-button" onclick="openAddFBSModal('${center.name}')">
                                Добавить FBS-запись
                            </button>
                        </div>
                        <div id="tableContainer-${center.id}">Загрузка данных...</div>
                        <div id="paginationContainer-${center.id}"></div>
                    </div>`;
            });

            // Вставляем в страницу
            document.getElementById('dynamicContent').innerHTML = contentHTML;

            // Активируем первую вкладку и загружаем данные
            if (centers.length > 0) {
                let first = centers[0];
                document.getElementById(`cityTab-${first.id}`).style.display = '';
                loadCityFBSData(first.name, first.id, 1);
            }
        })
        .catch(err => {
            console.error("Ошибка загрузки списка СЦ:", err);
            alert("Ошибка загрузки списка сортировочных центров");
        });
}


/* Инъекция стилей для таблицы FBS */
function injectFbsStyles() {
  if (document.getElementById('fbs-table-styles')) return;
  const style = document.createElement('style');
  style.id = 'fbs-table-styles';
  style.textContent = `
    .fbs-table-container{width:100%;overflow-x:auto;overflow-y:hidden;box-sizing:border-box;}
    .fbs-table-container table{width:100%;min-width:1000px;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;}
    .fbs-table-container thead th{position:sticky;top:0;background-color:#f1f5f9;color:#374151;font-weight:600;padding:0.75rem;border-bottom:2px solid #e5e7eb;text-align:left;white-space:nowrap;z-index:1;user-select:none;cursor:pointer;}
    .fbs-table-container tbody td{padding:0.75rem;font-size:0.875rem;color:#374151;border-bottom:1px solid #f3f4f6;vertical-align:middle;white-space:nowrap;}
    .fbs-table-container tbody tr:nth-child(even){background-color:#f9fafb;}
    .fbs-table-container tbody tr:hover{background-color:#eef2ff;}
    .fbs-table-container img{width:40px;height:40px;object-fit:cover;cursor:pointer;border-radius:4px;display:block;}
    .fbs-table-container tbody tr{min-height:50px;}
    .fbs-filter-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;}
    .fbs-filter-bar input[type="text"],.fbs-filter-bar input[type="date"]{padding:0.4rem 0.5rem;font-size:0.875rem;border:1px solid #d1d5db;border-radius:4px;}
    .fbs-filter-bar select{padding:0.3rem 0.5rem;font-size:0.875rem;border:1px solid #d1d5db;border-radius:4px;}
    .fbs-filter-bar button{padding:0.4rem 0.8rem;font-size:0.875rem;border:1px solid #d1d5db;border-radius:4px;background-color:#f3f4f6;cursor:pointer;}
    .fbs-pagination{display:flex;flex-wrap:wrap;align-items:center;gap:0.25rem;margin-top:0.5rem;}
    .fbs-pagination button{padding:0.4rem 0.7rem;border:1px solid #d1d5db;background-color:#ffffff;border-radius:4px;cursor:pointer;font-size:0.875rem;color:#374151;}
    .fbs-pagination button.active{background-color:#4ade80;color:#ffffff;border-color:#4ade80;}
    .fbs-pagination span{padding:0.4rem 0.7rem;font-size:0.875rem;color:#6b7280;}
    .fbs-pagination button[disabled]{opacity:0.4;cursor:not-allowed;}
  `;
  document.head.appendChild(style);
}

/**
 * Улучшенная отрисовка таблицы FBS. Замените ею старую loadCityFBSData().
 */
function loadCityFBSData(
  cityName,
  cityId,
  page      = 1,
  sortField = 'created_at',
  sortOrder = 'desc',
  filterPhone = '',
  filterStart = '',
  filterEnd   = '',
  perPage     = 10
) {
  injectFbsStyles();
  const tableContainer      = document.getElementById(`tableContainer-${cityId}`);
  const paginationContainer = document.getElementById(`paginationContainer-${cityId}`);
  if (!tableContainer || !paginationContainer) return;

  tableContainer.innerHTML      = '<p>Загрузка...</p>';
  paginationContainer.innerHTML = '';

  const params = new URLSearchParams({
    city:  cityName,
    page:  page,
    per_page: perPage,
    sort:  sortField,
    order: sortOrder
  });
  if (filterPhone) params.append('filterPhone', filterPhone);
  if (filterStart) params.append('filterStart', filterStart);
  if (filterEnd)   params.append('filterEnd',   filterEnd);

  fetch(`fbs/list_fbs.php?${params.toString()}`, { credentials: 'same-origin' })
    .then(res => res.text())
    .then(text => {
      let result;
      try { result = JSON.parse(text); } catch {
        throw new Error(`Сервер вернул некорректный JSON: ${text}`);
      }
      if (!result.success) {
        tableContainer.innerHTML = `<p>${result.message || 'Ошибка получения данных'}</p>`;
        return;
      }

      const records     = result.data;
      const total       = result.total;
      const currentPage = result.page;
      const perPageRet  = result.per_page;
      const totalPages  = Math.ceil(total / perPageRet);

      // сохраняем параметры
      const tabDiv = document.getElementById(`cityTab-${cityId}`);
      if (tabDiv) {
        tabDiv.dataset.loaded      = 'true';
        tabDiv.dataset.sortField   = sortField;
        tabDiv.dataset.sortOrder   = sortOrder;
        tabDiv.dataset.filterPhone = filterPhone;
        tabDiv.dataset.filterStart = filterStart;
        tabDiv.dataset.filterEnd   = filterEnd;
        tabDiv.dataset.perPage     = perPageRet;
      }

      // для стрелок сортировки
      const arrowUp   = ' ▲';
      const arrowDown = ' ▼';
      const getArrow = (field) =>
        sortField === field ? (sortOrder === 'asc' ? arrowUp : arrowDown) : '';

      let html = '<div class="fbs-filter-bar">';
      html += `<label>Телефон:</label><input type="text" id="phoneFilter-${cityId}" value="${filterPhone.replace(/"/g, '&quot;')}" />`;
      html += `<label>Дата с:</label><input type="date" id="startDateFilter-${cityId}" value="${filterStart}" />`;
      html += `<label>по:</label><input type="date" id="endDateFilter-${cityId}" value="${filterEnd}" />`;
      html += `<button id="applyFilterBtn-${cityId}">Применить</button>`;
      html += `<div style="margin-left:auto;display:flex;align-items:center;gap:4px;">`;
      html += `<label for="perPageSelect-${cityId}">На странице:</label><select id="perPageSelect-${cityId}">`;
      [10,25,50,100].forEach(v => {
        html += `<option value="${v}" ${v === perPageRet ? 'selected' : ''}>${v}</option>`;
      });
      html += `</select></div>`;
      html += `<button id="exportBtn-${cityId}" style="margin-left:8px;">Экспорт в Excel</button>`;
      html += '</div>';

      // начало таблицы
      html += '<div class="fbs-table-container"><table><thead><tr>';
      html += `<th data-field="created_at">Дата${getArrow('created_at')}</th>`;
      html += `<th data-field="company">ИП${getArrow('company')}</th>`;
      html += `<th data-field="phone">Телефон${getArrow('phone')}</th>`;
      html += `<th data-field="quantity">Кол‑во${getArrow('quantity')}</th>`;
      html += `<th data-field="amount">Сумма${getArrow('amount')}</th>`;
      html += '<th>Фото</th>';
      html += `<th data-field="comment">Комментарий${getArrow('comment')}</th>`;
      html += '</tr></thead><tbody>';

      // заполняем строки
      if (!records.length) {
        html += `<tr><td colspan="7" style="text-align:center;padding:1rem;">Нет FBS‑записей</td></tr>`;
      } else {
        records.forEach(record => {
          const dateObj = new Date(record.created_at);
          const dateStr = dateObj.toLocaleString('ru-RU', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit'
          });
          // корректный путь к картинке (если в photo_path нет '/', добавляем uploads/fbs/)
          const imageSrc = record.photo_path
            ? (record.photo_path.includes('/') ? record.photo_path : `uploads/fbs/${record.photo_path}`)
            : null;

          html += `
            <tr>
              <td>${dateStr}</td>
              <td>${record.company || '—'}</td>
              <td>${record.phone || '—'}</td>
              <td>${record.quantity != null ? record.quantity : 0}</td>
              <td>${record.amount != null ? record.amount : 0}</td>
              <td style="text-align:center;">
                ${
                  imageSrc
                    ? `<img src="${imageSrc}" class="fbs-photo-thumb" onclick="openImageModal('${record.photo_path}')">`
                    : 'Нет фото'
                }
              </td>
              <td>${record.comment || '—'}</td>
            </tr>
          `;
        });
      }

      html += '</tbody></table></div>';
      tableContainer.innerHTML = html;

      // клики по заголовкам для сортировки
      tableContainer.querySelectorAll('th[data-field]').forEach(th => {
        const field = th.getAttribute('data-field');
        th.onclick = () => {
          let newOrder = 'asc';
          if (sortField === field) {
            newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
          }
          loadCityFBSData(
            cityName, cityId, 1,
            field, newOrder,
            document.getElementById(`phoneFilter-${cityId}`).value.trim(),
            document.getElementById(`startDateFilter-${cityId}`).value,
            document.getElementById(`endDateFilter-${cityId}`).value,
            parseInt(document.getElementById(`perPageSelect-${cityId}`).value,10)
          );
        };
      });

      // кнопка "Применить"
      document.getElementById(`applyFilterBtn-${cityId}`).onclick = () => {
        loadCityFBSData(
          cityName, cityId, 1,
          sortField, sortOrder,
          document.getElementById(`phoneFilter-${cityId}`).value.trim(),
          document.getElementById(`startDateFilter-${cityId}`).value,
          document.getElementById(`endDateFilter-${cityId}`).value,
          parseInt(document.getElementById(`perPageSelect-${cityId}`).value,10)
        );
      };

      // смена количества на странице
      document.getElementById(`perPageSelect-${cityId}`).onchange = (e) => {
        loadCityFBSData(
          cityName, cityId, 1,
          sortField, sortOrder,
          document.getElementById(`phoneFilter-${cityId}`).value.trim(),
          document.getElementById(`startDateFilter-${cityId}`).value,
          document.getElementById(`endDateFilter-${cityId}`).value,
          parseInt(e.target.value,10)
        );
      };

      // экспорт
      document.getElementById(`exportBtn-${cityId}`).onclick = () => {
        if (typeof exportToExcel === 'function') exportToExcel(cityId);
      };

      // обновляем пагинацию
      renderFbsPagination(
        cityName, cityId,
        currentPage, totalPages,
        sortField, sortOrder,
        filterPhone, filterStart, filterEnd,
        perPageRet
      );
    })
    .catch(err => {
      console.error('Ошибка загрузки FBS:', err);
      tableContainer.innerHTML = `<p>Ошибка: ${err.message}</p>`;
    });
}


/**
 * Рисует пагинацию для FBS.
 */
function renderFbsPagination(
  cityName, cityId, currentPage, totalPages,
  sortField, sortOrder, filterPhone, filterStart, filterEnd, perPage
) {
  const pag = document.getElementById(`paginationContainer-${cityId}`);
  if (!pag) return;
  pag.innerHTML = '';
  const addBtn = (text, disabled, handler, active) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = 'pagination-button';
    if (active) btn.classList.add('active');
    btn.disabled = disabled;
    if (handler) btn.onclick = handler;
    pag.appendChild(btn);
  };
  const m = 2;
  addBtn('‹', currentPage <= 1, () => loadCityFBSData(cityName, cityId, currentPage - 1, sortField, sortOrder, filterPhone, filterStart, filterEnd, perPage));
  let start = Math.max(1, currentPage - m);
  let end   = Math.min(totalPages, currentPage + m);
  if (start > 1) {
    addBtn('1', false, () => loadCityFBSData(cityName, cityId, 1, sortField, sortOrder, filterPhone, filterStart, filterEnd, perPage), 1 === currentPage);
    if (start > 2) pag.appendChild(Object.assign(document.createElement('span'), {textContent:'…'}));
  }
  for (let i = start; i <= end; i++) {
    addBtn(String(i), false, () => loadCityFBSData(cityName, cityId, i, sortField, sortOrder, filterPhone, filterStart, filterEnd, perPage), i === currentPage);
  }
  if (end < totalPages) {
    if (end < totalPages - 1) pag.appendChild(Object.assign(document.createElement('span'), {textContent:'…'}));
    addBtn(String(totalPages), false, () => loadCityFBSData(cityName, cityId, totalPages, sortField, sortOrder, filterPhone, filterStart, filterEnd, perPage), currentPage === totalPages);
  }
  addBtn('›', currentPage >= totalPages, () => loadCityFBSData(cityName, cityId, currentPage + 1, sortField, sortOrder, filterPhone, filterStart, filterEnd, perPage));
}

// экспортировать глобально (если необходимо)
window.loadCityFBSData = loadCityFBSData;





// --- Функции для модального окна с фото ---
function openImageModal(filename) {
  const modal = document.getElementById('photoModal');
  const img   = document.getElementById('photoModalImg');
  if (!modal || !img) return;

  // filename — просто имя файла; добавляем префикс uploads/fbs/
  img.src = filename.includes('/')
    ? filename              // если путь уже содержит /
    : `uploads/fbs/${filename}`;

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
}


function closeImageModal() {
    const modal = document.getElementById('photoModal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

// Навешиваем закрытие на кнопку и фон
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('photoModalClose');
    if (btn) btn.onclick = closeImageModal;
});
window.addEventListener('click', e => {
    if (e.target.id === 'photoModal') {
        closeImageModal();
    }
});

/**
 * Открывает модалку и показывает полноразмерное фото.
 * filename — имя файла из record.photo_path
 */
function openImageModal(filename) {
    const modal = document.getElementById('photoModal');
    const img   = document.getElementById('photoModalImg');
    if (!modal || !img) return;                // если нет элементов — выходим
    img.src = `fbs/uploads/${filename}`;       // путь к файлу (проверьте, что совпадает)
    modal.style.display = 'flex';              // показываем контейнер
    // даём CSS-анимации (opacity) сработать
    setTimeout(() => modal.classList.add('show'), 10);
}

/**
 * Закрывает модалку
 */
function closeImageModal() {
    const modal = document.getElementById('photoModal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

// Привязываем крестик закрытия
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('photoModalClose');
    if (btn) btn.onclick = closeImageModal;
});

// Закрытие по клику на фон
window.addEventListener('click', e => {
    if (e.target.id === 'photoModal') {
        closeImageModal();
    }
});


// Обработчик переключения вкладок города (показывает соответствующий таб и загружает данные при первом открытии)
function switchCityTab(cityId) {
    // Скрываем все вкладки и снимаем активный класс с кнопок
    document.querySelectorAll('.city-content').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.tab-header .tab-button').forEach(btn => btn.classList.remove('active'));
    // Показать выбранную вкладку
    const showDiv = document.getElementById('cityTab-' + cityId);
    if (showDiv) showDiv.style.display = '';
    // Выделяем соответствующую кнопку вкладки как активную
    document.querySelectorAll('.tab-header .tab-button').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`('${cityId}')`)) {
            btn.classList.add('active');
        }
    });
    // Если данные для этой вкладки еще не загружались – загружаем по умолчанию
    if (showDiv && !showDiv.dataset.loaded) {
        const cityName = window.cityIdMap[cityId] || '';
        if (cityName) {
            loadCityFBSData(cityName, cityId, 1);
        }
    }
}

function changeSort(cityId, field) {
    const cityName = window.cityIdMap[cityId];
    const cityTabDiv = document.getElementById(`cityTab-${cityId}`);
    if (!cityName || !cityTabDiv) return;
    // Текущие настройки сортировки
    const currentSortField = cityTabDiv.dataset.sortField || 'created_at';
    const currentSortOrder = cityTabDiv.dataset.sortOrder || 'desc';
    let newSortField = field;
    let newSortOrder = 'asc';
    if (field === currentSortField) {
        // Если кликнули по тому же столбцу, меняем направление сортировки
        newSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        // Новый столбец – сортировка по возрастанию по умолчанию
        newSortOrder = (field === 'created_at') ? 'desc' : 'asc';
        // (например, для даты оставим по умолчанию desc – новые сверху)
    }
    // Берём текущие фильтры и пагинацию
    const filterPhone = cityTabDiv.dataset.filterPhone || '';
    const filterStart = cityTabDiv.dataset.filterStart || '';
    const filterEnd = cityTabDiv.dataset.filterEnd || '';
    const perPage = cityTabDiv.dataset.perPage ? parseInt(cityTabDiv.dataset.perPage) : 10;
    // Сброс на первую страницу при смене сортировки
    loadCityFBSData(cityName, cityId, 1, newSortField, newSortOrder, filterPhone, filterStart, filterEnd, perPage);
}

function applyFilter(cityId) {
    const cityName = window.cityIdMap[cityId];
    const cityTabDiv = document.getElementById(`cityTab-${cityId}`);
    if (!cityName || !cityTabDiv) return;
    // Получаем значения полей фильтра
    const filterPhone = document.getElementById(`filterPhone-${cityId}`).value.trim();
    const filterStart = document.getElementById(`filterStart-${cityId}`).value;
    const filterEnd = document.getElementById(`filterEnd-${cityId}`).value;
    // Оставляем текущую сортировку
    const sortField = cityTabDiv.dataset.sortField || 'created_at';
    const sortOrder = cityTabDiv.dataset.sortOrder || 'desc';
    // Количество на странице – текущее значение селектора
    const perPageSelect = document.getElementById(`perPageSelect-${cityId}`);
    const perPage = perPageSelect ? parseInt(perPageSelect.value) : 10;
    // Загружаем заново данные с применением фильтров (сброс на первую страницу)
    loadCityFBSData(cityName, cityId, 1, sortField, sortOrder, filterPhone, filterStart, filterEnd, perPage);
}

function changePage(cityId, page) {
    const cityName = window.cityIdMap[cityId];
    const cityTabDiv = document.getElementById(`cityTab-${cityId}`);
    if (!cityName || !cityTabDiv) return;
    // Берём текущие сортировки и фильтры
    const sortField = cityTabDiv.dataset.sortField || 'created_at';
    const sortOrder = cityTabDiv.dataset.sortOrder || 'desc';
    const filterPhone = cityTabDiv.dataset.filterPhone || '';
    const filterStart = cityTabDiv.dataset.filterStart || '';
    const filterEnd = cityTabDiv.dataset.filterEnd || '';
    const perPage = cityTabDiv.dataset.perPage ? parseInt(cityTabDiv.dataset.perPage) : 10;
    // Загружаем указанную страницу с текущими параметрами
    loadCityFBSData(cityName, cityId, page, sortField, sortOrder, filterPhone, filterStart, filterEnd, perPage);
}

function refreshCityTable(cityName) {
    const cityId = window.cityMap[cityName];
    if (!cityId) return;
    // Для простоты всегда заново загружаем первую страницу текущего таба после добавления
    loadCityFBSData(cityName, cityId, 1);
}

function openAddFBSModal(cityName) {
  const modal   = document.getElementById('requestModal');
  const content = document.getElementById('requestModalContent');
  if (!modal || !content) return;

  // Включаем спец‑классы хоста — убираем «окно в окне», центрируем оверлей
  modal.classList.add('fbs-open');
  content.classList.add('fbs-host');

  content.innerHTML = `
    <div id="fbs-modal" role="dialog" aria-modal="true" aria-labelledby="fbs-title">
      <header class="fbs-header">
        <h3 id="fbs-title">Добавление FBS-записи — ${cityName}</h3>
        <button type="button" class="fbs-close" aria-label="Закрыть" title="Закрыть" onclick="closeFBSModal()">×</button>
      </header>

      <input type="hidden" id="cityInput" value="${cityName}">

      <form id="fbs-form" onsubmit="event.preventDefault(); saveFBSRecord();">
        <div class="fbs-grid">
          <div class="fbs-field span-2">
            <label for="companyInput">ИП</label>
            <input type="text" id="companyInput" class="form-control" placeholder="ФИО / Наименование">
          </div>

          <div class="fbs-field span-2">
            <label for="phoneInput">Телефон</label>
            <input type="tel" id="phoneInput" class="form-control" placeholder="+7 (___) ___-__-__">
          </div>

          <div class="fbs-field">
            <label for="qtyInput">Количество</label>
            <input type="number" id="qtyInput" class="form-control" min="1" step="1" value="1">
          </div>

          <div class="fbs-field">
            <label for="amountInput">Сумма</label>
            <input type="number" id="amountInput" class="form-control" min="0" step="1" value="0" inputmode="numeric">
          </div>

          <div class="fbs-field span-2">
            <label for="commentInput">Комментарий</label>
            <textarea id="commentInput" class="form-control" rows="3" placeholder="Опционально"></textarea>
          </div>

          <div class="fbs-field span-2">
            <label class="fbs-switch">
              <input type="checkbox" id="cashPaymentInput" aria-label="Оплата наличными">
              <span class="track" aria-hidden="true"></span>
              <span class="switch-label">Оплата наличными</span>
            </label>
          </div>

          <div class="fbs-field span-2">
            <label for="photoInput">Фото</label>
            <input type="file" id="photoInput" class="form-control" accept="image/*">
          </div>
        </div>

        <div class="fbs-actions">
          <button type="submit" class="confirm-btn">Сохранить</button>
        </div>
      </form>
    </div>
  `;

  // Показ
  modal.classList.add('show');
  modal.style.display = 'block';

  // Закрыть по клику на оверлей
  if (!modal.__fbsOverlayBound) {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeFBSModal(); });
    modal.__fbsOverlayBound = true;
  }

  // Закрыть по Esc
  window.__fbsEsc = (e) => { if (e.key === 'Escape') closeFBSModal(); };
  document.addEventListener('keydown', window.__fbsEsc);
}

function closeFBSModal() {
  const modal   = document.getElementById('requestModal');
  const content = document.getElementById('requestModalContent');

  document.removeEventListener('keydown', window.__fbsEsc);
  if (modal) {
    modal.classList.remove('show', 'fbs-open');
    modal.style.display = 'none';
  }
  if (content) {
    content.classList.remove('fbs-host');
    content.innerHTML = '';
  }
}









// fbs.js – обновлённая функция сохранения записи FBS
function saveFBSRecord() {
    // Считываем значения из формы
    const city     = document.getElementById('cityInput').value;
    const company  = document.getElementById('companyInput').value.trim();
    const phone    = document.getElementById('phoneInput').value.trim();
    const quantity = parseInt(document.getElementById('qtyInput').value, 10);
    const amount   = parseFloat(document.getElementById('amountInput').value);
    const comment  = document.getElementById('commentInput').value.trim();
    const photoInput = document.getElementById('photoInput');
    const cashPaid = document.getElementById('cashPaymentInput').checked ? 1 : 0;

    // Проверяем обязательные поля
    if (!company || !phone || isNaN(quantity) || quantity <= 0 || isNaN(amount) || amount < 0) {
        alert('Заполните все обязательные поля корректно.');
        return;
    }

    // Создаём FormData для отправки
    const formData = new FormData();
    formData.append('city', city);
    formData.append('company', company);
    formData.append('phone', phone);
    formData.append('quantity', quantity);
    formData.append('amount', amount.toFixed(2));
    formData.append('comment', comment);
    formData.append('cash_paid', cashPaid);
    if (photoInput && photoInput.files.length > 0) {
        formData.append('photo', photoInput.files[0]);
    }

    // Отправляем на сервер
    fetch('/fbs/save_fbs.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
    })
    .then(async res => {
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(`Неверный JSON: ${text}`);
        }
    })
    .then(result => {
        if (result.success) {
            alert('✅ Данные успешно занесены');
            refreshCityTable(city);

            // Находим блок действий и прячем кнопку "Сохранить"
            const actionsDiv = document.querySelector('#fbs-modal .fbs-actions');
            if (actionsDiv) {
                const saveBtn = actionsDiv.querySelector('.confirm-btn');
                if (saveBtn) saveBtn.style.display = 'none';

                // Добавляем кнопку "Скачать PDF", если её ещё нет
                if (!document.getElementById('downloadPdfBtn')) {
                    const pdfBtn = document.createElement('button');
                    pdfBtn.id = 'downloadPdfBtn';
                    pdfBtn.className = 'confirm-btn';
                    pdfBtn.textContent = 'Скачать PDF';
                    pdfBtn.onclick = generateFbsPdf;
                    actionsDiv.appendChild(pdfBtn);
                }
            }

            // Сохраняем данные для PDF (если используете функцию на их основе)
            window.lastFbsData = {
                city: city,
                company: company,
                phone: phone,
                quantity: quantity,
                amount: amount.toFixed(2),
                comment: comment,
                cash_paid: cashPaid
            };
        } else {
            alert('Ошибка: ' + (result.message || 'Не удалось сохранить'));
        }
    })
    .catch(err => {
        console.error('saveFBSRecord error', err);
        alert('Ошибка при сохранении: ' + err.message);
    });
}


// Новая функция для генерации и скачивания PDF-метки 120×75 мм
function generateFbsPdf() {
    const company  = document.getElementById('companyInput').value.trim();
    const phone    = document.getElementById('phoneInput').value.trim();
    const city     = document.getElementById('cityInput').value.trim();
    const quantity = parseInt(document.getElementById('qtyInput').value, 10) || 1;
    
    const content = [];
    for (let i = 1; i <= quantity; i++) {
        // Блок информации для одной этикетки:
        content.push(
            { text: `ИП: ${company}`, fontSize: 24, margin: [0, 0, 0, 4] },
            { text: `Телефон: ${phone}`, fontSize: 24, margin: [0, 0, 0, 4] },
            { text: `Город приёмки: ${city}`, fontSize: 24, margin: [0, 0, 0, 15] },
            { text: 'FFIDEAL.ru', fontSize: 24, alignment: 'center' }
        );
        // Разрыв страницы после каждой этикетки, кроме последней:
        if (i < quantity) {
            content.push({ text: '', pageBreak: 'after' });
        }
    }
    
    const docDefinition = {
        pageSize: { width: 340, height: 212 },      // размер страницы ~120×75 мм (в пунктах)
        pageMargins: [15, 15, 15, 20],              // отступы (снизу больше для футера)
        defaultStyle: { font: 'Roboto' },
        content: content,
        // Футер с номером страницы:
        footer: function(currentPage, pageCount) {
            return {
                text: currentPage + '/' + pageCount,
                alignment: 'center',
                fontSize: 16,
                margin: [0, 0, 0, 10]
            };
        }
    };
    
    // Генерация и скачивание PDF файла (имя включает город и текущий timestamp)
    pdfMake.createPdf(docDefinition).download(`FBS_${city}_${Date.now()}.pdf`);
}


function addCenter() {
    const name = prompt("Введите название нового сортировочного центра:");
    if (!name) return;

    fetch('fbs/centers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name: name })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Сортировочный центр добавлен!');
            loadFBS(); // перезагружаем список центров
        } else {
            alert('Ошибка: ' + (data.message || 'не удалось добавить СЦ'));
        }
    })
    .catch(err => {
        alert('Ошибка: ' + err.message);
    });
}

function exportToExcel(cityId) {
    const cityTabDiv = document.getElementById(`cityTab-${cityId}`);
    if (!cityTabDiv) return;
    const cityName = window.cityIdMap[cityId];
    if (!cityName) return;
    // Собираем текущие параметры фильтров и сортировки
    const sortField = cityTabDiv.dataset.sortField || 'created_at';
    const sortOrder = cityTabDiv.dataset.sortOrder || 'desc';
    const filterPhone = cityTabDiv.dataset.filterPhone || '';
    const filterStart = cityTabDiv.dataset.filterStart || '';
    const filterEnd = cityTabDiv.dataset.filterEnd || '';
    // Формируем URL для экспорта
    const params = new URLSearchParams({
        city: cityName,
        sort: sortField,
        order: sortOrder,
        filterPhone: filterPhone
    });
    if (filterStart) params.append('filterStart', filterStart);
    if (filterEnd) params.append('filterEnd', filterEnd);
    const url = `fbs/export_fbs.php?${params.toString()}`;
    // Открываем в новом окне
    window.open(url, '_blank');
}