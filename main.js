// 📄 main.js
// Функция для отображения раздела «Приёмка»
function loadForm() {
    const dynamicContent = document.getElementById('dynamicContent');
    if (!dynamicContent) return;

    dynamicContent.style.display = 'block';

    // Разметка вкладок и двух секций
    dynamicContent.innerHTML = `
      <div class="section-container" style="padding-top: 20px;">
        <div class="tabs">
          <button class="tab-button active" onclick="switchReceptionTab('scanSection')">QR Приёмка</button>
          <button class="tab-button" onclick="switchReceptionTab('formSection'); loadOldReception()">Приёмка</button>
        </div>
        <!-- Секция QR‑приёмки (по умолчанию видима) -->
        <div id="scanSection">
          <h2>Сканирование QR‑кода</h2>
          <button class="icon-button" onclick="startScanner()">🚀 Запустить сканер</button>
          <button class="icon-button" onclick="stopScanner()">⛔ Остановить сканер</button>
          <div id="reader" style="width: 100%; max-width: 400px; margin: auto; padding-top: 20px;"></div>
        </div>
        <!-- Секция ручной приёмки (пока пустая, видимость отключена) -->
        <div id="formSection" style="display: none;">
          <!-- Сюда позже будет вставлена старая форма из папки OLDWORL -->
          <div id="manualReceptionContainer"></div>
        </div>
      </div>
    `;
}


// 🔘 Ручной запуск сканера
function startScanner() {
    if (typeof initScanner === 'function') {
        initScanner();
    } else {
        console.error("❌ initScanner() не найден — проверь подключение scan.js");
    }
}

// ⛔ Остановка сканера
function stopScanner() {
    if (typeof stopScan === 'function') {
        stopScan();
        console.log("⛔ Сканер остановлен вручную");
    } else {
        console.error("❌ stopScan() не найден — проверь подключение scan.js");
    }
}

// Переключение между вкладками "Форма / Скан"
function switchReceptionTab(tabId) {
    const sections = ['formSection', 'scanSection'];
    sections.forEach(id => {
        const tab = document.getElementById(id);
        const btn = document.querySelector(`.tab-button[onclick*="${id}"]`);
        if (tab) tab.style.display = (id === tabId) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', id === tabId);
    });

    if (tabId === 'formSection') {
        console.log("🔄 Переключено на Приёмку");
    } else if (tabId === 'scanSection') {
        if (typeof initScanner === 'function') {
            initScanner();
        } else {
            console.error("❌ initScanner() не найден — проверь подключение scan.js");
        }
    }
}

// Функция для отображения раздела "Таблица"
function loadTable() {
    const dynamicContent = document.getElementById('dynamicContent');
    if (!dynamicContent) return;
    dynamicContent.style.display = 'block';
    dynamicContent.innerHTML = `
        <h2>Таблица отправлений</h2>
        <div id="tableContainer"></div>
        <div id="paginationContainer"></div>
        <button class="icon-button" onclick="exportAllDataToExcel()" style="margin-top: 10px;">
            <i class="fas fa-download"></i> Выгрузить в Excel
        </button>
    `;
    fetchDataAndDisplayTable();
}
// Выгрузка всех данных таблицы в Excel
function exportAllDataToExcel() {
    fetch('/admin/api/export_to_excel.php')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'exported_data.xls';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error('Ошибка при экспорте данных:', error);
            alert('Не удалось выгрузить данные. Попробуйте позже.');
        });
}

// Функция для отображения раздела "Расписание"
function loadChart() {
    const scheduleSection = document.getElementById('scheduleSection');
    if (!scheduleSection) return;

    document.getElementById('dynamicContent').style.display = 'none';
    const tableSection = document.getElementById('tableSection');
    if (tableSection) tableSection.style.display = 'none';

    scheduleSection.style.display = 'block';

    const scheduleContainer = document.getElementById('scheduleContainer');
    scheduleContainer.innerHTML = '';

    const tableContainer = document.createElement('div');
    tableContainer.id = 'scheduleTable';
    tableContainer.classList.add('schedule-container');
    tableContainer.innerHTML = generateScheduleTable();

    scheduleContainer.appendChild(tableContainer);
}

function generateScheduleTable(weekOffset = 0) {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - today.getDay() + 1);
    const monthNames = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    let tableHTML = `<h2 class="schedule-title">Расписание отправок</h2>`;
    tableHTML += `<table class="schedule-table"><thead><tr>`;
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(firstDayOfWeek);
        currentDate.setDate(firstDayOfWeek.getDate() + i);
        const dayNames = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
        const dayName = dayNames[i];
        const day = currentDate.getDate();
        const month = monthNames[currentDate.getMonth()];
        tableHTML += `<th>${dayName} <br> ${day} ${month}</th>`;
    }
    tableHTML += `</tr></thead><tbody><tr>`;
    for (let i = 0; i < 7; i++) {
        tableHTML += `<td class="schedule-cell"></td>`;
    }
    tableHTML += `</tr></tbody></table>`;
    tableHTML += `
        <div class="schedule-controls">
            <button onclick="changeWeek(-1)">← Предыдущая неделя</button>
            <button onclick="changeWeek(1)">Следующая неделя →</button>
        </div>
    `;
    return tableHTML;
}

let currentWeekOffset = 0;
function changeWeek(offset) {
    currentWeekOffset += offset;
    const scheduleTable = document.getElementById('scheduleTable');
    if (scheduleTable) {
        scheduleTable.innerHTML = generateScheduleTable(currentWeekOffset);
    }
}

function toggleMobileProfileMenu() {
  const menu = document.getElementById("mobileProfileMenu");
  if (!menu) return;
  menu.classList.toggle("visible");
  menu.classList.toggle("hidden");
}
/**
 * Загружает старую форму приёмки во вторую вкладку.
 * Форма берётся из старого проекта (OLDWORL) и отправляет данные на log_data.php.
 * Вызов происходит только один раз — при первом открытии вкладки.
 */
function loadOldReception() {
  const container = document.getElementById('manualReceptionContainer');
  if (!container || container.dataset.loaded) return;
  container.dataset.loaded = 'true';

  // Форма ручной приёмки
  container.innerHTML = `
    <h3>Ручная приёмка</h3>
    <div id="statusOld"></div>
    <form id="manualReceptionForm" enctype="multipart/form-data">
      <div class="form-group">
        <label for="citySelect">Город отправления:</label>
        <select id="citySelect" name="city" required>
          <option value="">Загрузка...</option>
        </select>
      </div>
      <div class="form-group">
        <label for="warehouseSelect">Склад (направление):</label>
        <select id="warehouseSelect" name="warehouses" disabled required>
          <option value="">Выберите город сначала</option>
        </select>
      </div>
      <div class="form-group" id="dateGroup" style="display:none;">
        <label for="dateSelect">Дата сдачи:</label>
        <select id="dateSelect" name="date"></select>
      </div>

      <!-- Скрытые поля -->
      <input type="hidden" id="scheduleId" name="schedule_id">
      <input type="hidden" id="directionInput" name="direction">
      <input type="hidden" id="dateOfDeliveryInput" name="date_of_delivery">

      <div class="form-group">
        <label for="ipInput">ИП:</label>
        <input type="text" id="ipInput" name="ip" required>
      </div>
      <div class="form-group">
        <label for="commentInput">Комментарий:</label>
        <textarea id="commentInput" name="comment" rows="3"></textarea>
      </div>

      <div class="form-group">
        <label for="senderPhone">Телефон отправителя:</label>
        <input type="tel" id="senderPhone" name="sender" pattern="[0-9]{10,15}" required>
      </div>

      <div class="form-group">
        <label for="shipmentType">Тип отправки:</label>
        <select id="shipmentType" name="packaging_type" required>
          <option value="">Выберите тип</option>
          <option value="Box">Короба</option>
          <option value="Pallet">Паллеты</option>
        </select>
      </div>

      <div class="form-group">
        <label for="boxes">Количество мест/паллет:</label>
        <input type="number" id="boxes" name="boxes" min="1" required>
      </div>

      <div class="form-group">
        <label for="paymentAmount">Сумма оплаты (₽):</label>
        <input type="number" id="paymentAmount" name="payment"
               step="0.01" min="0" inputmode="decimal" required>
      </div>

      <div class="form-group">
        <label for="paymentType">Способ оплаты:</label>
        <select id="paymentType" name="payment_type" required>
          <option value="">Выберите способ оплаты</option>
          <option value="Наличные">Наличные</option>
          <option value="ТБанк">Т-Банк</option>
          <option value="Долг">Долг</option>
        </select>
      </div>

      <div class="form-group" id="qrImage" style="display:none;">
        <img id="qrPreview" alt="QR code preview">
      </div>

      <!-- Фото: галерея + камера (оба как photos[]) -->
      <div class="form-group">
        <label>Фотографии:</label>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" id="btnPickGallery">📁 Выбрать из галереи</button>
          <button type="button" id="btnTakePhoto">📷 Сделать фото</button>
          <span id="photoHint" style="opacity:.7;">(можно и выбрать, и сфотографировать)</span>
        </div>
        <input type="file" id="fileGallery" name="photos[]" accept="image/*" multiple style="display:none">
        <input type="file" id="fileCamera"  name="photos[]" accept="image/*" capture="environment" style="display:none">
        <div id="photoCounter" style="margin-top:6px; font-size:.9em; opacity:.8;"></div>
      </div>

      <button type="submit">Отправить заявку</button>
    </form>
  `;

  // --- Тарифы ---
  let tariffsData = {};
  fetch('/admin/api/tariffs/fetch_tariffs.php')
    .then(res => res.json())
    .then(data => { if (data.success) tariffsData = data.data || {}; })
    .catch(err => console.error('Ошибка загрузки тарифов:', err));

  // --- Города ---
  fetch('filter_options.php?action=all_cities')
    .then(res => res.json())
    .then(data => {
      const citySelect = document.getElementById('citySelect');
      const cities = Array.isArray(data) ? data : (data && data.cities ? data.cities : []);
      citySelect.innerHTML = '<option value="">Выберите город</option>';
      cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
      });
    })
    .catch(err => {
      console.error('Ошибка загрузки городов:', err);
      document.getElementById('citySelect').innerHTML = '<option value="">Ошибка загрузки</option>';
    });

  // --- Ручной ввод суммы ---
  const sumField = document.getElementById('paymentAmount');
  sumField.addEventListener('input', () => {
    if (sumField.value === '') delete sumField.dataset.manual;
    else sumField.dataset.manual = '1';
  });

  // --- Фото ---
  const fileGallery = document.getElementById('fileGallery');
  const fileCamera  = document.getElementById('fileCamera');
  const btnPickGallery = document.getElementById('btnPickGallery');
  const btnTakePhoto   = document.getElementById('btnTakePhoto');
  const photoCounter   = document.getElementById('photoCounter');

  btnPickGallery.addEventListener('click', () => fileGallery.click());
  btnTakePhoto.addEventListener('click',   () => fileCamera.click());

  function updatePhotoCounter() {
    const count = (fileGallery.files?.length || 0) + (fileCamera.files?.length || 0);
    photoCounter.textContent = count ? `Выбрано файлов: ${count}` : '';
  }
  fileGallery.addEventListener('change', updatePhotoCounter);
  fileCamera.addEventListener('change',  updatePhotoCounter);

  // --- Кэш расписаний ---
  let schedulesCache = [];

  // Выбор города
  document.getElementById('citySelect').addEventListener('change', function () {
    const city = this.value;
    const warehouseSelect = document.getElementById('warehouseSelect');
    const dateSelect = document.getElementById('dateSelect');
    const dateGroup = document.getElementById('dateGroup');

    warehouseSelect.innerHTML = '';
    dateSelect.innerHTML = '';
    document.getElementById('scheduleId').value = '';
    document.getElementById('directionInput').value = '';
    document.getElementById('dateOfDeliveryInput').value = '';

    sumField.value = '';
    delete sumField.dataset.manual;

    if (!city) {
      warehouseSelect.disabled = true;
      dateGroup.style.display = 'none';
      return;
    }

    fetch('schedule.php?archived=0&city=' + encodeURIComponent(city))
      .then(res => res.json())
      .then(data => {
        const schedules = Array.isArray(data) ? data : [];
        const today = new Date(); today.setHours(0,0,0,0);

        schedulesCache = schedules.filter(s => {
          const d = new Date(s.accept_date); d.setHours(0,0,0,0);
          return d >= today;
        });

        if (schedulesCache.length === 0) {
          warehouseSelect.innerHTML = '<option value="">Нет доступных складов</option>';
          warehouseSelect.disabled = true;
          dateGroup.style.display = 'none';
          return;
        }

        const warehouses = [...new Set(schedulesCache.map(s => s.warehouses))];
        warehouseSelect.innerHTML = '<option value="">Выберите склад</option>';
        warehouses.forEach(w => {
          const opt = document.createElement('option');
          opt.value = w;
          opt.textContent = w;
          warehouseSelect.appendChild(opt);
        });
        warehouseSelect.disabled = false;
        dateGroup.style.display = 'none';
      })
      .catch(err => {
        console.error('Ошибка загрузки расписания:', err);
        warehouseSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        warehouseSelect.disabled = true;
        dateGroup.style.display = 'none';
      });
  });

  // Выбор склада
  document.getElementById('warehouseSelect').addEventListener('change', function () {
    const city = document.getElementById('citySelect').value;
    const warehouse = this.value;
    const dateSelect = document.getElementById('dateSelect');
    const dateGroup = document.getElementById('dateGroup');

    document.getElementById('scheduleId').value = '';
    document.getElementById('directionInput').value = warehouse;
    document.getElementById('dateOfDeliveryInput').value = '';

    sumField.value = '';
    delete sumField.dataset.manual;

    if (!warehouse) {
      dateGroup.style.display = 'none';
      updateCost();
      return;
    }

    const today = new Date(); today.setHours(0,0,0,0);
    const filtered = schedulesCache.filter(
      s => s.city === city && s.warehouses === warehouse && new Date(s.accept_date) >= today
    );

    if (!filtered || filtered.length === 0) {
      dateGroup.style.display = 'none';
      updateCost();
      return;
    }

    const dates = [...new Set(filtered.map(s => s.accept_date))];
    if (dates.length <= 1) {
      dateGroup.style.display = 'none';
      document.getElementById('scheduleId').value = filtered[0].id;
      document.getElementById('dateOfDeliveryInput').value = filtered[0].accept_date;
      updateCost();
    } else {
      dateGroup.style.display = 'block';
      dateSelect.innerHTML = '<option value="">Выберите дату</option>';
      dates.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        dateSelect.appendChild(opt);
      });
      updateCost();
    }
  });

  // Выбор даты
  document.getElementById('dateSelect').addEventListener('change', function () {
    const city      = document.getElementById('citySelect').value;
    const warehouse = document.getElementById('warehouseSelect').value;
    const date      = this.value;
    const schedule = schedulesCache.find(s =>
      s.city === city && s.warehouses === warehouse && s.accept_date === date
    );
    document.getElementById('scheduleId').value = schedule ? schedule.id : '';
    document.getElementById('dateOfDeliveryInput').value = date || '';
    updateCost();
  });

  // Показ/скрытие QR
  document.getElementById('paymentType').addEventListener('change', function () {
    const qrImage = document.getElementById('qrImage');
    const qrPreview = document.getElementById('qrPreview');
    if (this.value === 'ТБанк') {
      qrImage.style.display = 'block';
      qrPreview.src = './QR/1IP.jpg';
    } else {
      qrImage.style.display = 'none';
      qrPreview.src = '';
    }
  });

  // Расчёт суммы (не перезаписывает ручной ввод)
  function updateCost({ force = false } = {}) {
    const city      = document.getElementById('citySelect').value;
    const warehouse = document.getElementById('warehouseSelect').value;
    const type      = document.getElementById('shipmentType').value;
    const qty       = parseInt(document.getElementById('boxes').value, 10) || 0;

    if (!force && sumField.dataset.manual === '1') return;

    let value = '';

    if (tariffsData[city] && tariffsData[city][warehouse] && qty > 0) {
      const prices = tariffsData[city][warehouse];
      const pricePerUnit =
        type === 'Box'    ? prices.box_price   :
        type === 'Pallet' ? prices.pallet_price : null;

      if (pricePerUnit != null) {
        value = (qty * pricePerUnit).toFixed(2);
      }
    }

    sumField.value = value;
    if (value !== '') delete sumField.dataset.manual;
  }

  document.getElementById('shipmentType').addEventListener('change', updateCost);
  document.getElementById('boxes').addEventListener('input', updateCost);

  // ОТПРАВКА ФОРМЫ: собираем FormData ВРУЧНУЮ и склеиваем файлы
  document.getElementById('manualReceptionForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const statusEl  = document.getElementById('statusOld');
    const submitBtn = this.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.style.backgroundColor = '#ccc';
    submitBtn.textContent = 'Создание...';

    // Собираем FormData вручную: поля формы + оба FileList в один массив.
    const fd = new FormData();

    // Текстовые поля
    fd.append('city',               document.getElementById('citySelect').value || '');
    fd.append('warehouses',         document.getElementById('warehouseSelect').value || '');
    fd.append('date',               document.getElementById('dateSelect').value || '');
    fd.append('schedule_id',        document.getElementById('scheduleId').value || '');
    fd.append('direction',          document.getElementById('directionInput').value || '');
    fd.append('date_of_delivery',   document.getElementById('dateOfDeliveryInput').value || '');
    fd.append('sender',             document.getElementById('senderPhone').value || '');
    fd.append('packaging_type',     document.getElementById('shipmentType').value || '');
    fd.append('boxes',              document.getElementById('boxes').value || '');
    fd.append('payment',            document.getElementById('paymentAmount').value || '');
    fd.append('payment_type',       document.getElementById('paymentType').value || '');
    fd.append('ip',                 document.getElementById('ipInput').value || '');
    fd.append('comment',            document.getElementById('commentInput').value || '');

    // Файлы: склеиваем галерею и камеру
    const allFiles = [];
    if (fileGallery.files && fileGallery.files.length) {
      for (const f of fileGallery.files) allFiles.push(f);
    }
    if (fileCamera.files && fileCamera.files.length) {
      for (const f of fileCamera.files) allFiles.push(f);
    }

    // Отправляем под ДВУМЯ именами — для совместимости со старым сервером:
    // 1) photos[] — как новая логика
    // 2) photo[]  — на случай, если сервер ждёт старое имя
    for (const f of allFiles) {
      fd.append('photos[]', f, f.name);
      fd.append('photo[]',  f, f.name);
    }

    try {
      const res = await fetch('log_data.php', { method: 'POST', body: fd });
      const result = await res.json();

      if (result.status === 'success') {
        statusEl.textContent = '✅ Заявка успешно создана';
        statusEl.style.color = 'green';

        window.lastReceptionData = {
          city:         document.getElementById('citySelect').value || '',
          warehouse:    document.getElementById('directionInput').value || '',
          acceptDate:   new Date().toISOString().split('T')[0],
          deliveryDate: document.getElementById('dateOfDeliveryInput').value || '',
          boxCount:     document.getElementById('boxes').value || 1,
          phone:        document.getElementById('senderPhone').value || '',
          company:      ''
        };

        this.reset();
        document.getElementById('warehouseSelect').disabled = true;
        document.getElementById('dateGroup').style.display = 'none';
        delete document.getElementById('paymentAmount').dataset.manual;
        photoCounter.textContent = '';

        submitBtn.disabled = false;
        submitBtn.style.backgroundColor = '';
        submitBtn.textContent = 'Отправить заявку';

        let printBtn = document.getElementById('receptionPrintBtn');
        if (!printBtn) {
          printBtn = document.createElement('button');
          printBtn.id = 'receptionPrintBtn';
          printBtn.type = 'button';
          printBtn.textContent = '📄 Скачать акт приёмки';
          printBtn.style.marginLeft = '10px';
          printBtn.addEventListener('click', () => {
            if (typeof downloadReceptionPdf === 'function') {
              downloadReceptionPdf();
            } else {
              console.error('downloadReceptionPdf не найден. Проверьте, что подключили reception_pdf.js.');
            }
          });
          statusEl.after(printBtn);
        }
      } else {
        statusEl.textContent = `Ошибка: ${result.message}`;
        statusEl.style.color = 'red';
        submitBtn.disabled = false;
        submitBtn.style.backgroundColor = '';
        submitBtn.textContent = 'Отправить заявку';
      }
    } catch (err) {
      statusEl.textContent = 'Ошибка отправки заявки';
      statusEl.style.color = 'red';
      submitBtn.disabled = false;
      submitBtn.style.backgroundColor = '';
      submitBtn.textContent = 'Отправить заявку';
    }
  });
}

 