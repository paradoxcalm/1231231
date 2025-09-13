// 👤 Пользователь
// === schedule.js ===
//
// Файл, отвечающий за логику расписания:
// - вкладка "Ближайшие отправления" и "Календарь"
// - создание / редактирование расписания
// - функция createOrder не уводит на processing.html, а лишь закрывает окно
//   и вызывает openRequestFormModal (см. requestForm.js).
let calendarCurrentDate = new Date();
let canCreate = false; // Определяется при загрузке (admin/manager?)
let canCreateSchedule = false;
let canCreateOrder = false;
    // архив по умолчанию скрыт
// Для хранения текущего открытого модального окна
let currentModal = null;
let activeCityFilter = "";
let activeWarehouseFilter = "";
let activeDestinationWarehouseFilter = "";
let archiveView = false;
let activeMarketplaceFilter = "";



/**
 * Проверка, можно ли ещё создавать заявку (с учётом accept_deadline, если указано).
 */

function loadSchedule() {
    const dynamicContent = document.getElementById("dynamicContent");
    if (!dynamicContent) return;

    canCreateSchedule = (userRole === "admin" || userRole === "manager");
    const isAdminOrManager = (userRole === "admin" || userRole === "manager");

    const html = `
        <div class="schedule-container">
            <h1 class="section-title">Расписание</h1>
            <div class="tab-header">
                <button class="tab-button active" id="tab-upcoming" onclick="switchTab('upcoming')">Ближайшие отправления</button>
                ${
                    isAdminOrManager
                        ? `<button class="tab-button" id="tab-calendar" onclick="switchTab('calendar')">Календарь</button>`
                        : `<button class="tab-button disabled-tab" id="tab-calendar" tabindex="-1" type="button" aria-disabled="true" disabled>Календарь</button>`
                }
            </div>
            <div class="tab-content" id="tabContent-upcoming" style="display: block;">
                <div class="upcoming-shipments">
                    <h3>Ближайшие отправления</h3>
                    <div id="filterBlock"></div>
                    <div style="margin-top:10px;">
                        <button id="toggleArchiveBtn" class="secondary-button">Архив</button>
                    </div>
                    <div id="upcomingList" style="margin-top:10px;"></div>
                </div>
            </div>
            <div class="tab-content" id="tabContent-calendar" style="display: none;">
                <div id="calendarNoAccess" style="display: none; color: #b60000; font-size: 1.16em; margin: 30px 0; text-align: center;">
                    Нет прав для просмотра календаря
                </div>
                <div class="schedule-controls" id="calendarControls">
                    <div class="action-buttons">
                        ${ canCreateSchedule ? `
                            <button class="primary-button" onclick="showCreateForm()">
                                <i class="fas fa-plus"></i> Создать отправление
                            </button>
                            <div class="dropdown-excel">
                              <button class="excel-button" onclick="toggleExcelMenu()">📤 Excel ▾</button>
                              <div class="excel-menu" id="excelMenu">
                                  <div onclick="exportSchedule()">📤 Экспорт данных</div>
                                  <div onclick="openImportModal()">📥 Импорт расписания</div>
                                  <div onclick="window.location.href='export_schedule_template.php'">📄 Скачать шаблон</div>
                              </div>
                            </div>
                            <button class="secondary-button" onclick="openScheduleManagementModal()">⚙️ Управление</button>
                            <button class="secondary-button" onclick="showShipmentReport()">📄Список Отправлений</button>
                        ` : "" }
                    </div>
                </div>
                <div class="filter-section" id="calendarFilters">
                    <div class="filter-group">
                        <label for="warehouseFilter">Склады:</label>
                        <select id="warehouseFilter" onchange="onWarehouseChange(this.value)">
                            <option value="">Все склады</option>
                        </select>
                    </div>
                    <div class="filter-actions">
                        <button class="apply-button" onclick="applyFilters()">ПРИМЕНИТЬ</button>
                        <button class="reset-button" onclick="resetFilters()">Сбросить</button>
                    </div>
                </div>
                <div class="calendar-view" id="calendarView">
                    <div class="schedule-nav">
                        <button class="nav-button" onclick="changeMonth(-1)">❮</button>
                        <span id="currentMonthYear" style="font-weight:bold;font-size:16px;"></span>
                        <button class="nav-button" onclick="changeMonth(1)">❯</button>
                    </div>
                    <div class="calendar-header">
                        <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div>
                    </div>
                    <div class="calendar-grid" id="calendarGrid"></div>
                </div>
            </div>
        </div>
    `;
    dynamicContent.innerHTML = html;

    // --- Фильтры ---
    const filterBlock = document.getElementById("filterBlock");
    filterBlock.innerHTML = `
        <div class="filters-row">
            <div class="filter-group">
                <label for="marketplaceFilter"><i class="fas fa-store"></i> Маркетплейс</label>
                <select id="marketplaceFilter" class="styled-filter"></select>
            </div>
            <div class="filter-group">
                <label for="cityDropdown"><i class="fas fa-city"></i> Город</label>
                <select id="cityDropdown" class="styled-filter"></select>
            </div>
            <div class="filter-group">
                <label for="destinationWarehouseFilter"><i class="fas fa-warehouse"></i> Склад</label>
                <select id="destinationWarehouseFilter" class="styled-filter"></select>
            </div>
        </div>
    `;

    // --- Уведомление для фильтров ---
    function showFilterNotice(msg) {
        let n = document.getElementById('filterNotice');
        if (!n) {
            n = document.createElement('div');
            n.id = 'filterNotice';
            n.style = "color:#b70000;font-size:1em;padding:7px 0 3px 0;";
            filterBlock.appendChild(n);
        }
        n.textContent = msg;
        setTimeout(() => { n.textContent = ""; }, 3000);
    }

    window.activeMarketplaceFilter = "";
    window.activeCityFilter = "";
    window.activeDestinationWarehouseFilter = "";

    const marketplaceSelect = document.getElementById("marketplaceFilter");
    const citySelect = document.getElementById("cityDropdown");
    const warehouseSelect = document.getElementById("destinationWarehouseFilter");

    // Подгружаем все маркетплейсы
    fetch("filter_options.php?action=marketplaces")
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                marketplaceSelect.innerHTML = `<option value="">Все</option>` +
                    data.marketplaces.map(mp => `<option value="${mp}">${mp}</option>`).join('');
            }
        });

    // Подгружаем все города (по всем маркетплейсам)
    function loadAllCities(selectedCity) {
        fetch("filter_options.php?action=all_cities")
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    citySelect.innerHTML = `<option value="">Все</option>` +
                        data.cities.map(c => `<option value="${c}"${selectedCity===c?' selected':''}>${c}</option>`).join('');
                }
            });
    }

    // Подгружаем все склады (по всем маркетплейсам и городам)
    function loadAllWarehouses(selectedCity, selectedWarehouse) {
        let url = "filter_options.php?action=all_warehouses";
        if (selectedCity) url += "&city=" + encodeURIComponent(selectedCity);
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    warehouseSelect.innerHTML = `<option value="">Все</option>` +
                        data.warehouses.map(w => `<option value="${w}"${selectedWarehouse===w?' selected':''}>${w}</option>`).join('');
                }
            });
    }

    // Изначально подгружаем все города и склады
    loadAllCities();
    loadAllWarehouses();

    // --- Логика изменения фильтра маркетплейса ---
    marketplaceSelect.onchange = function () {
        // сохраняем выбранный маркетплейс в глобальный объект window
        window.activeMarketplaceFilter = this.value;
        // запоминаем ранее выбранные город и склад
        const prevCity = window.activeCityFilter;
        const prevWarehouse = window.activeDestinationWarehouseFilter;
    
        // загружаем список городов для выбранного маркетплейса (или все города)
        let cityPromise;
        if (!window.activeMarketplaceFilter) {
            cityPromise = fetch("filter_options.php?action=all_cities")
                .then(r => r.json())
                .then(data => data.cities || []);
        } else {
            cityPromise = fetch(`filter_options.php?action=cities&marketplace=${encodeURIComponent(window.activeMarketplaceFilter)}`)
                .then(r => r.json())
                .then(data => data.cities || []);
        }
    
        cityPromise.then(cities => {
            // проверяем, подходит ли ранее выбранный город
            const cityValid = !prevCity || cities.includes(prevCity);
            if (!cityValid) {
                showFilterNotice("Нет отправлений по выбранному маркетплейсу и городу.");
                window.activeCityFilter = "";
                window.activeDestinationWarehouseFilter = "";
            } else {
                window.activeCityFilter = prevCity;
            }
    
            // заполняем список городов
            citySelect.innerHTML = `<option value="">Все</option>` +
                cities.map(c => `<option value="${c}"${window.activeCityFilter === c ? ' selected' : ''}>${c}</option>`).join('');
            citySelect.disabled = false;
    
            // загружаем список складов в зависимости от выбранных фильтров
            let whPromise;
            if (!window.activeMarketplaceFilter && !window.activeCityFilter) {
                whPromise = fetch("filter_options.php?action=all_warehouses")
                    .then(r => r.json())
                    .then(data => data.warehouses || []);
            } else if (!window.activeMarketplaceFilter && window.activeCityFilter) {
                whPromise = fetch(`filter_options.php?action=all_warehouses&city=${encodeURIComponent(window.activeCityFilter)}`)
                    .then(r => r.json())
                    .then(data => data.warehouses || []);
            } else if (window.activeMarketplaceFilter && window.activeCityFilter) {
                whPromise = fetch(`filter_options.php?action=warehouses&marketplace=${encodeURIComponent(window.activeMarketplaceFilter)}&city=${encodeURIComponent(window.activeCityFilter)}`)
                    .then(r => r.json())
                    .then(data => data.warehouses || []);
            } else {
                // выбрали marketplace, но не выбрали город – складов нет
                whPromise = Promise.resolve([]);
            }
    
            whPromise.then(warehouses => {
                // проверяем, подходит ли ранее выбранный склад
                const whValid = !prevWarehouse || warehouses.includes(prevWarehouse);
                if (!whValid && prevWarehouse) {
                    showFilterNotice("Нет отправлений по выбранному складу для текущих фильтров.");
                    window.activeDestinationWarehouseFilter = "";
                } else {
                    window.activeDestinationWarehouseFilter = prevWarehouse;
                }
    
                // заполняем список складов
                warehouseSelect.innerHTML = `<option value="">Все</option>` +
                    warehouses.map(w => `<option value="${w}"${window.activeDestinationWarehouseFilter === w ? ' selected' : ''}>${w}</option>`).join('');
                warehouseSelect.disabled = false;
    
                // обновляем список расписаний с учётом новых фильтров
                fetchAndDisplayUpcoming();
            });
        });
    };


        citySelect.onchange = function () {
        // сохраняем выбранный город в глобальный объект window
        window.activeCityFilter = this.value;
        const prevWarehouse = window.activeDestinationWarehouseFilter;
    
        let whPromise;
        // выбираем, откуда загружать склады
        if (!window.activeMarketplaceFilter && !window.activeCityFilter) {
            whPromise = fetch("filter_options.php?action=all_warehouses")
                .then(r => r.json())
                .then(data => data.warehouses || []);
        } else if (!window.activeMarketplaceFilter && window.activeCityFilter) {
            whPromise = fetch(`filter_options.php?action=all_warehouses&city=${encodeURIComponent(window.activeCityFilter)}`)
                .then(r => r.json())
                .then(data => data.warehouses || []);
        } else if (window.activeMarketplaceFilter && window.activeCityFilter) {
            whPromise = fetch(`filter_options.php?action=warehouses&marketplace=${encodeURIComponent(window.activeMarketplaceFilter)}&city=${encodeURIComponent(window.activeCityFilter)}`)
                .then(r => r.json())
                .then(data => data.warehouses || []);
        } else {
            // выбрали marketplace, но не выбрали город – складов нет
            whPromise = Promise.resolve([]);
        }
    
        whPromise.then(warehouses => {
            const whValid = !prevWarehouse || warehouses.includes(prevWarehouse);
            if (!whValid && prevWarehouse) {
                showFilterNotice("Нет отправлений по выбранному складу для текущих фильтров.");
                window.activeDestinationWarehouseFilter = "";
            } else {
                window.activeDestinationWarehouseFilter = prevWarehouse;
            }
    
            // обновляем список складов
            warehouseSelect.innerHTML = `<option value="">Все</option>` +
                warehouses.map(w => `<option value="${w}"${window.activeDestinationWarehouseFilter === w ? ' selected' : ''}>${w}</option>`).join('');
            warehouseSelect.disabled = false;
    
            // перезагружаем список отправлений с учётом выбранного города
            fetchAndDisplayUpcoming();
        });
    };


    warehouseSelect.onchange = function () {
        // сохраняем выбранный склад в глобальный объект window
        window.activeDestinationWarehouseFilter = this.value;
        // и сразу перезагружаем список отправлений
        fetchAndDisplayUpcoming();
    };

    
   // находим кнопку
    const toggleArchiveBtn = document.getElementById("toggleArchiveBtn");
    
    // если кнопка существует
    if (toggleArchiveBtn) {
        // если роль — клиент, прячем кнопку и не вешаем обработчик
        if (userRole === 'client') {
            toggleArchiveBtn.style.display = 'none';
        } else {
            // для админа и менеджера вешаем обработчик
            toggleArchiveBtn.addEventListener("click", () => {
                // переключаем режим: false – активные, true – архив
                archiveView = !archiveView;
    
                // меняем текст кнопки
                toggleArchiveBtn.textContent = archiveView ? "Актив" : "Архив";
    
                // передаём флаг archiveView в функцию, чтобы подгрузить правильный список
                fetchAndDisplayUpcoming(archiveView);
            });
        }
    }


    window.switchTab = function(tab) {
        document.getElementById('tab-upcoming').classList.remove('active');
        document.getElementById('tab-calendar').classList.remove('active');
        document.getElementById('tabContent-upcoming').style.display = 'none';
        document.getElementById('tabContent-calendar').style.display = 'none';

        if (tab === 'upcoming') {
            document.getElementById('tab-upcoming').classList.add('active');
            document.getElementById('tabContent-upcoming').style.display = 'block';
        } else if (tab === 'calendar') {
            document.getElementById('tab-calendar').classList.add('active');
            document.getElementById('tabContent-calendar').style.display = 'block';
            if (!isAdminOrManager) {
                // Защита: если всё же как-то вызвал вручную
                document.getElementById("calendarNoAccess").style.display = "block";
                document.getElementById("calendarControls").style.display = "none";
                document.getElementById("calendarFilters").style.display = "none";
                document.getElementById("calendarView").style.display = "none";
            } else {
                document.getElementById("calendarNoAccess").style.display = "none";
                document.getElementById("calendarControls").style.display = "";
                document.getElementById("calendarFilters").style.display = "";
                document.getElementById("calendarView").style.display = "";
            }
        }
    };

    if (typeof renderStaticCalendar === 'function') renderStaticCalendar();
    if (typeof fetchDataAndUpdateCalendar === 'function') fetchDataAndUpdateCalendar();

    fetchAndDisplayUpcoming();
}









// Функция для обновления склада назначения по выбранному городу
async function updateDestinationWarehouses() {
    const warehouseSelect = document.getElementById("destinationWarehouseFilter");
    if (!activeCityFilter) {
        warehouseSelect.innerHTML = "";
        warehouseSelect.style.display = "none";
        activeDestinationWarehouseFilter = "";
        return;
    }
    try {
        const res = await fetch(`schedule.php?archived=0&city=${encodeURIComponent(activeCityFilter)}`);
        const data = await res.json();
        const list = data.schedules || data;
        const set = new Set();
        list.forEach(s => {
            if (s.warehouses && typeof s.warehouses === 'string') {
                set.add(s.warehouses.trim());
            }
        });
        const options = Array.from(set);
        if (options.length === 0) {
            warehouseSelect.innerHTML = "";
            warehouseSelect.style.display = "none";
            activeDestinationWarehouseFilter = "";
            return;
        }
        warehouseSelect.innerHTML = `<option value="">Все направления</option>` +
            options.map(w => `<option value="${w}">${w}</option>`).join('');
        warehouseSelect.style.display = "";
        warehouseSelect.value = "";
        activeDestinationWarehouseFilter = "";
    } catch (err) {
        warehouseSelect.innerHTML = "";
        warehouseSelect.style.display = "none";
        activeDestinationWarehouseFilter = "";
        console.error("Ошибка загрузки направлений:", err);
    }
}





// Открытие/закрытие выпадающего меню Excel
function toggleExcelMenu() {
    const menu = document.getElementById("excelMenu");
    const arrow = document.getElementById("excelArrow");
    const btn = document.getElementById("excelDropdownBtn");

    const opened = menu.classList.toggle("show");
    arrow.innerHTML = opened ? "▲" : "▼";
    btn.classList.toggle("open", opened);
}

function openImportModal() {
    const modal = document.getElementById("importScheduleModal");
    if (modal) {
        modal.style.display = "block";
    } else {
        alert("❌ Модальное окно импорта не найдено.");
    }
}



function showImportResultModal(inserted, errors) {
    let html = `<p>✅ Успешно добавлено: <strong>${inserted}</strong></p>`;
    if (errors.length > 0) {
        html += `<p>❌ Ошибки:</p><ul style="padding-left:16px;">`;
        for (const e of errors) {
            html += `<li>Строка ${e.row}: ${e.error}</li>`;
        }
        html += `</ul>`;
    }
    document.getElementById("importResultModalContent").innerHTML = html;
    document.getElementById("importResultModal").style.display = "block";
}


// Закрытие при клике вне меню
document.addEventListener("mousedown", function(e) {
    const menu = document.getElementById("excelMenu");
    const btn = document.getElementById("excelDropdownBtn");

    if (!menu || !btn) return;

    if (!menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove("show");
        btn.classList.remove("open");
        document.getElementById("excelArrow").innerHTML = "▼";
    }
});







function showShipmentReport() {
    const modalContent = document.getElementById("shipmentReportText");
    if (!modalContent) return;

    // Блок фильтров
    modalContent.innerHTML = `
      <div id="shipmentReportFilters" style="display:flex;gap:18px;margin-bottom:18px;align-items:flex-end;">
        <div>
          <label style="font-weight:600;">Маркетплейс</label>
          <select id="shipmentFilterMarketplace" class="styled-filter" style="min-width:140px;"></select>
        </div>
        <div>
          <label style="font-weight:600;">Город</label>
          <select id="shipmentFilterCity" class="styled-filter" style="min-width:140px;"></select>
        </div>
        <div>
          <label style="font-weight:600;">Склад</label>
          <select id="shipmentFilterWarehouse" class="styled-filter" style="min-width:140px;"></select>
        </div>
        <div>
          <label style="font-weight:600;">Дата</label>
          <input type="date" id="shipmentFilterDate" class="styled-filter" style="min-width:140px;">
        </div>
        <button id="shipmentFilterApplyBtn" class="primary" style="margin-left:12px;padding:12px 20px;">Применить</button>
      </div>
      <div id="shipmentReportTable"></div>
    `;

    // Загрузка вариантов фильтров
    fetch("filter_options.php?action=marketplaces")
      .then(r => r.json())
      .then(data => {
        const sel = document.getElementById("shipmentFilterMarketplace");
        if (sel) {
            sel.innerHTML = `<option value="">Все</option>` +
              (data.marketplaces || []).map(mp => `<option value="${mp}">${mp}</option>`).join('');
        }
      });
    fetch("filter_options.php?action=all_cities")
      .then(r => r.json())
      .then(data => {
        const sel = document.getElementById("shipmentFilterCity");
        if (sel) {
            sel.innerHTML = `<option value="">Все</option>` +
              (data.cities || []).map(c => `<option value="${c}">${c}</option>`).join('');
        }
      });
    fetch("filter_options.php?action=all_warehouses")
      .then(r => r.json())
      .then(data => {
        const sel = document.getElementById("shipmentFilterWarehouse");
        if (sel) {
            sel.innerHTML = `<option value="">Все</option>` +
              (data.warehouses || []).map(w => `<option value="${w}">${w}</option>`).join('');
        }
      });

    document.getElementById("shipmentFilterApplyBtn").onclick = reloadShipmentReport;
    reloadShipmentReport();  // первая загрузка без фильтров
}

// Вспомогательная функция — загрузка и фильтрация отправлений
function reloadShipmentReport() {
    const mp  = document.getElementById("shipmentFilterMarketplace")?.value || '';
    const ct  = document.getElementById("shipmentFilterCity")?.value || '';
    const wh  = document.getElementById("shipmentFilterWarehouse")?.value || '';
    const st  = document.getElementById("shipmentFilterStatus")?.value || '';
    const dt  = document.getElementById("shipmentFilterDate")?.value || '';
    let url   = "get_schedules.php";
    const params = [];
    if (mp) params.push("marketplace=" + encodeURIComponent(mp));
    if (ct) params.push("city=" + encodeURIComponent(ct));
    if (wh) params.push("warehouse=" + encodeURIComponent(wh));
    if (st) params.push("status=" + encodeURIComponent(st));
    if (dt) params.push("date=" + encodeURIComponent(dt));
    if (params.length) url += "?" + params.join("&");

    const tableBlock = document.getElementById("shipmentReportTable");
    if (!tableBlock) return;
    tableBlock.innerHTML = "Загрузка…";

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) {
            tableBlock.innerHTML = "<p>Нет данных для отображения</p>";
            return;
        }
        // Сортировка по дате (accept_date) или дедлайну приёмки, чтобы группы формировались по порядку
        data.sort((a, b) => {
            const dA = new Date(a.accept_deadline || a.acceptance_end || a.accept_date || 0);
            const dB = new Date(b.accept_deadline || b.acceptance_end || b.accept_date || 0);
            return dA - dB;
        });
        // Рендер таблицы с группировкой по дате отправления
        const today = new Date().toISOString().slice(0, 10);
        let html = `
            <style>
               .shipment-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif;
                    font-size: 14px;
                    background: #fcfcfd;
                }
                .shipment-table th, .shipment-table td {
                    padding: 7px 10px;
                    border-bottom: 1px solid #e7eaf3;
                    text-align: left;
                    vertical-align: middle;
                }
                .shipment-table th {
                    background: #f5f7fa;
                    font-weight: 600;
                    color: #36435c;
                    letter-spacing: 0.03em;
                }
                .shipment-table tr:nth-child(even) {
                    background: #f8fafc;
                }
                .shipment-table tr:hover {
                    background: #eef3fa;
                    transition: background 0.2s;
                }
                .shipment-table td.route {
                    font-weight: 500;
                    color: #3b82f6;
                }
                .shipment-table td.driver {
                    color: #36435c;
                    font-weight: 500;
                }
                .shipment-table td.phone {
                    font-family: 'Menlo', 'Consolas', monospace;
                    font-size: 13px;
                    color: #2563eb;
                }
                .shipment-table td.auto {
                    color: #374151;
                    font-size: 13px;
                }
                .shipment-table td.status {
                    font-weight: bold;
                    color: #059669;
                }
                .shipment-table td.reception {
                    font-style: italic;
                    color: #6b7280;
                }
                @media print {
                    .shipment-table th, .shipment-table td {
                        padding: 4px 6px;
                        font-size: 12px;
                    }
                    body {
                        background: #fff !important;
                    }
                }
            </style>
            <table class="shipment-table">
                <thead>
                    <tr>
                        <th>Статус</th>
                        <th>Дата отправления</th>
                        <th>Маршрут</th>
                        <th>Дата сдачи</th>
                        <th>Водитель</th>
                        <th>Телефон</th>
                        <th>Авто</th>
                        <th>Приёмка</th>
                    </tr>
                </thead>
                <tbody>
        `;
        if (!data.length) {
            html += `<tr><td colspan="8" style="text-align:center;color:#bbb;">Нет отправлений по выбранным условиям</td></tr>`;
        } else {
            let currentDate = "";
            data.forEach(s => {
                // Добавляем заголовок группы (даты) при смене даты отправления
                if (s.accept_date !== currentDate) {
                    currentDate = s.accept_date;
                    html += `
                        <tr class="date-group">
                            <td colspan="8" style="text-align:center; color:#36435c;">${currentDate}</td>
                        </tr>
                    `;
                }
                // Определяем состояние приёмки
                let reception = "—";
                if (s.status === "Завершено") {
                    reception = "Завершена";
                } else if (s.status === "На складе") {
                    reception = "Завершена";
                } else if (s.status === "В пути") {
                    if (s.delivery_date && s.delivery_date <= today) {
                        reception = "Принимается";
                    } else {
                        reception = "Ожидается";
                    }
                } else if (s.status === "Ожидает отправки" || s.status === "Приём заявок" || s.status === "Готов к отправке") {
                    reception = "Ожидается";
                }
                // Строка отправления
                html += `
                    <tr>
                        <td class="status">${s.status || "—"}</td>
                        <td>${s.accept_date || "—"}</td>
                        <td class="route">${s.city || "—"} <span style="color:#889;">→</span> ${s.warehouses || "—"}</td>
                        <td>${s.delivery_date || "—"}</td>
                        <td class="driver">${s.driver_name || "—"}</td>
                        <td class="phone">${s.driver_phone || "—"}</td>
                        <td class="auto">${s.car_brand || "—"}<br><span style="color:#bbb;">${s.car_number || "—"}</span></td>
                        <td class="reception">${reception}</td>
                    </tr>
                `;
            });
        }
        html += `
                </tbody>
            </table>
        `;
        tableBlock.innerHTML = html;
        document.getElementById("shipmentReportModal").style.display = "block";
      })
      .catch(err => {
        tableBlock.innerHTML = "<p>Ошибка загрузки данных</p>";
        console.error("Ошибка reloadShipmentReport:", err);
      });
}







function switchTab(tabName) {
    const tabs = ["upcoming", "calendar"];
    tabs.forEach(tab => {
        const el = document.getElementById(`tabContent-${tab}`);
        const btn = document.getElementById(`tab-${tab}`);
        if (el) el.style.display = (tab === tabName) ? "block" : "none";
        if (btn) btn.classList.toggle("active", tab === tabName);
    });

    // ⬇️ ВАЖНО: отрисовать календарь при переходе
    if (tabName === "calendar") {
        renderStaticCalendar();
        fetchDataAndUpdateCalendar();
    }
}



// Рендерим статический календарь (ячейки)
function renderStaticCalendar() {
    const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];
    // Обновление заголовка месяца и года
    const currentMonthYearElem = document.getElementById("currentMonthYear");
    if (currentMonthYearElem) {
        currentMonthYearElem.textContent =
            `${monthNames[calendarCurrentDate.getMonth()]} ${calendarCurrentDate.getFullYear()}`;
    }
    const calendarGrid = document.getElementById("calendarGrid");
    if (!calendarGrid) return;
    calendarGrid.innerHTML = "";

    // Вычисляем первый и последний день текущего месяца
    const firstDay = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth(), 1);
    const lastDay = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() + 1, 0);

    // День недели первого дня (приводим Sunday=0 к 7)
    const startDay = firstDay.getDay() === 0 ? 7 : firstDay.getDay();

    // Заполнение последних дней предыдущего месяца до начала текущего
    const prevMonthLast = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth(), 0).getDate();
    for (let i = 1; i < startDay; i++) {
        const dayNum = prevMonthLast - (startDay - i) + 1;
        calendarGrid.innerHTML += `
            <div class="calendar-cell" data-date="${getFullDate(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() - 1, dayNum)}">
                <div class="cell-date">${dayNum}</div>
            </div>
        `;
    }

    // Заполнение дней текущего месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const fullDate = `${calendarCurrentDate.getFullYear()}-${String(calendarCurrentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const isToday = isDateToday(fullDate);
        const cellClass = isToday ? "calendar-cell today" : "calendar-cell";
        calendarGrid.innerHTML += `
            <div class="${cellClass}" data-date="${fullDate}" onclick="openShipmentsForDate('${fullDate}')">
                <div class="cell-date">${day}</div>
            </div>
        `;
    }

    // **Исправлено:** Заполнение дней следующего месяца до 42 ячеек
    const nextMonthDate = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() + 1, 1);
    let nextDay = 1;
    while (calendarGrid.children.length < 42) {
        const fullNextDate = getFullDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), nextDay);
        calendarGrid.innerHTML += `
            <div class="calendar-cell" data-date="${fullNextDate}" onclick="openScheduleModal('${fullNextDate}')">
                <div class="cell-date">${nextDay}</div>
            </div>
        `;
        nextDay++;
    }
}

// Помощники
function getFullDate(year, month, day) {
    if (month < 0) {
        year--;
        month = 11;
    } else if (month > 11) {
        year++;
        month = 0;
    }
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function isDateToday(dateStr) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return dateStr === todayStr;
}
// Подгружаем расписание, заполняем календарь
function fetchDataAndUpdateCalendar() {
    const url = `schedule.php${activeWarehouseFilter ? `?warehouse=${encodeURIComponent(activeWarehouseFilter)}` : ""}`;
    fetch(url)
        .then(r => {
            if (!r.ok) throw new Error("Ошибка загрузки расписания: " + r.status);
            return r.json();
        })
        .then(data => {
            let shipmentsByDate = {};
            data.forEach(item => {
                let d = item.accept_date;
                if (!shipmentsByDate[d]) shipmentsByDate[d] = [];
                shipmentsByDate[d].push(item);
            });
            updateCalendarWithData(shipmentsByDate);
        })
        .catch(err => console.error("Ошибка при fetchDataAndUpdateCalendar:", err));
}
function updateCalendarWithData(shipmentsByDate) {
    const cells = document.querySelectorAll(".calendar-cell");
    cells.forEach(cell => {
        const date = cell.getAttribute("data-date");
        const shipments = shipmentsByDate[date] || [];

        // Очищаем и рендерим дату
        cell.innerHTML = "";
        const dateDiv = document.createElement("div");
        dateDiv.className = "cell-date";
        dateDiv.textContent = date.split("-")[2];
        cell.appendChild(dateDiv);

        // Если есть отправления — рисуем точку и подпись
        if (shipments.length > 0) {
            const firstWh = shipments[0].warehouses || "—";
            const labelText = shipments.length === 1
                ? firstWh
                : firstWh + ` +${shipments.length - 1}`;
            const dotColor = getStatusDotColor(shipments[0].status || "");

            const dot = document.createElement("div");
            dot.className = "shipment-dot";
            dot.style.backgroundColor = dotColor;
            const labelDiv = document.createElement("div");
            labelDiv.className = "shipment-label";
            labelDiv.textContent = labelText;

            cell.appendChild(dot);
            cell.appendChild(labelDiv);
        }

        // 🧩 Заменили alert на нормальный вызов модального
        const newCell = cell.cloneNode(true);
        newCell.addEventListener("click", () => {
            openShipmentsForDate(date); // ✅ выведет сообщение через модальное окно
        });
        cell.replaceWith(newCell);
    });
}


function getStatusDotColor(status) {
    const s = status.toLowerCase();
    if (s.includes("пути")) return "yellow";
    if (s.includes("ожидан")) return "green";
    if (s.includes("возврат")) return "red";
    return "gray";
}
function changeMonth(offset) {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + offset);
    renderStaticCalendar();
    fetchDataAndUpdateCalendar();
}
function onWarehouseChange(value) {
    activeWarehouseFilter = value;
    fetchDataAndUpdateCalendar();
    fetchScheduleData();
}
function switchShipmentTab(index, total) {
    for (let i = 0; i < total; i++) {
        const btn = document.getElementById(`shipmentBtn-${i}`);
        const tab = document.getElementById(`shipmentTab-${i}`);
        if (!btn || !tab) continue;
        if (i === index) {
            btn.classList.add("active");
            tab.style.display = "block";
        } else {
            btn.classList.remove("active");
            tab.style.display = "none";
        }
    }
}
function closeScheduleModal() {
    const modal = document.getElementById("modalContainer");
    if (modal) {
        modal.style.display = "none";
        modal.innerHTML = "";
    }
    currentModal = null;
}

function openSingleShipmentModal(sh) {
    const modalContainer = document.getElementById("modalContainer");
    if (!modalContainer) return;

    modalContainer.innerHTML = "";
    modalContainer.style.display = "block";
    

    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";

    const role = window.userRole || 'client';

    modalContent.innerHTML = `
        <span class="modal-close" onclick="closeScheduleModal()"><i class="fas fa-times"></i></span>
        <div class="modal-header">
            <h2>Отправление №${sh.id || '—'}</h2>
        </div>

        <div class="modal-section">
            <div class="modal-section-title">Информация об отправлении</div>
            <div class="modal-row"><div class="modal-label">Город отправления:</div><div class="modal-value">${sh.city || "—"}</div></div>
            <div class="modal-row"><div class="modal-label">Склад назначения:</div><div class="modal-value">${sh.warehouses || "—"}</div></div>
            <div class="modal-row"><div class="modal-label">Отправление:</div><div class="modal-value">${sh.accept_date || "—"}</div></div>
            <div class="modal-row"><div class="modal-label">Время приёмки:</div><div class="modal-value">${sh.accept_time || "—"}</div></div>
            <div class="modal-row"><div class="modal-label">Сдача (дата):</div><div class="modal-value">${sh.delivery_date || "—"}</div></div>
            <div class="modal-row"><div class="modal-label">Приёмка до:</div><div class="modal-value">${sh.accept_deadline || "—"}</div></div>
            <div class="modal-row"><div class="modal-label">Маркетплейс:</div><div class="modal-value">${sh.marketplace || "—"}</div></div>
        </div>

        <div class="modal-section">
            <div class="modal-section-title">Авто и водитель</div>
            <div class="modal-row"><div class="modal-label">Авто:</div><div class="modal-value">${sh.car_number || "—"} (${sh.car_brand || "—"})</div></div>
            <div class="modal-row"><div class="modal-label">Водитель:</div><div class="modal-value">${sh.driver_name || "—"}</div></div>
            <div class="modal-row"><div class="modal-label">Телефон:</div><div class="modal-value">${sh.driver_phone || "—"}</div></div>
        </div>

        <div class="modal-actions">
            ${canCreateOrderForSchedule(sh) ? `
                <button class="create-order-btn big-action" onclick="createOrder(${sh.id}, '${sh.city}', '${sh.warehouses}')">
                    <i class="fas fa-plus-circle"></i> Создать заявку
                </button>
            ` : `<span class="closed-message">Приём заявок закрыт</span>`}

            ${role === 'admin' || role === 'manager' ? `
                <div class="status-control" style="margin-top:10px;margin-bottom:10px;">
                    <label for="statusSelect_${sh.id}">Изменить статус:</label>
                    <select id="statusSelect_${sh.id}" onchange="updateStatus(${sh.id}, this.value)">
                        <option value="Ожидает отправки" ${sh.status === "Ожидает отправки" ? "selected" : ""}>Ожидает отправки</option>
                        <option value="Готов к отправке" ${sh.status === "Готов к отправке" ? "selected" : ""}>Готов к отправке</option>
                        <option value="В пути" ${sh.status === "В пути" ? "selected" : ""}>В пути</option>
                        <option value="Завершено" ${sh.status === "Завершено" ? "selected" : ""}>Завершено</option>
                    </select>
                </div>

                <button class="action-button" onclick="editSchedule(${sh.id})">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
                <button class="action-button" onclick="deleteSchedule(${sh.id})">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            ` : ''}
        </div>
    `;

    modalContainer.appendChild(modalContent);
    currentModal = modalContainer;
}


function canCreateOrderForSchedule(schedule) {
    if (!schedule) return false;
    if (schedule.status === 'Завершено' || schedule.status === 'Товар отправлен') return false;

    const deadline = schedule.accept_deadline;
    if (!deadline) return true;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    return now <= deadlineDate;
}








// Фильтр по городу, складу и маркетплейсу (для "Ближайших отправлений")
// Фильтр по городу, складу и маркетплейсу (для "Ближайших отправлений")
// Фильтр по городу, складу и маркетплейсу (для "Ближайших отправлений")
/**
 * Загрузка и отображение «Ближайших отправлений»
 * Клиенты НЕ видят уже отправившиеся рейсы (delivery_date < now).
 */
/**
 * Загрузка и отображение «Ближайших отправлений».
 * Клиенты НЕ видят уже отправившиеся рейсы (delivery_date < now).
 */
/**
 * Загрузка и отображение «Ближайших отправлений».
 * Клиенты НЕ видят уже отправившиеся рейсы (delivery_date < now).
 */
/**
 * Загружает расписания, делит на категории и рисует выбранную категорию.
 * @param {boolean} showArchived     false – активные (archived=0), true – архив (archived=1)
 * @param {'active'|'transit'|'completed'} statusCategory   категория для отображения
 */
function fetchAndDisplayUpcoming(showArchived = false, statusCategory = 'active') {
    const container = document.getElementById("upcomingList");
    if (!container) return;
    container.innerHTML = "Загрузка…";

    // Формируем URL с учётом фильтров
    let url = `schedule.php?archived=${showArchived ? 1 : 0}`;
    if (window.activeMarketplaceFilter) {
        url += `&marketplace=${encodeURIComponent(window.activeMarketplaceFilter)}`;
    }
    if (window.activeCityFilter) {
        url += `&city=${encodeURIComponent(window.activeCityFilter)}`;
    }
    if (window.activeDestinationWarehouseFilter) {
        url += `&warehouse=${encodeURIComponent(window.activeDestinationWarehouseFilter)}`;
    }

    fetch(url)
        .then(r => {
            if (!r.ok) throw new Error("Ошибка загрузки: " + r.status);
            return r.json();
        })
        .then(data => {
            const list = Array.isArray(data?.schedules) ? data.schedules : data;
            if (!Array.isArray(list) || list.length === 0) {
                container.innerHTML = "Нет расписаний.";
                return;
            }

            // Разбиение по датам
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const activeList = [];
            const transitList = [];
            const completedList = [];

            list.forEach(item => {
                // защита от битых данных
                if (!item?.accept_date || !item?.delivery_date) return;
                const accept = new Date(item.accept_date);
                const deliver = new Date(item.delivery_date);
                if (isNaN(accept) || isNaN(deliver)) return;

                accept.setHours(0, 0, 0, 0);
                deliver.setHours(0, 0, 0, 0);

                // Актив – приёмка в будущем
                if (accept > now) {
                    activeList.push(item);
                }
                // В пути – приёмка была/сегодня, сдача ещё не прошла
                else if (accept <= now && deliver >= now) {
                    transitList.push(item);
                }
                // Завершён – сдача уже прошла
                else if (deliver < now) {
                    completedList.push(item);
                }
            });

            // Выбираем категорию
            let listToDisplay;
            if (statusCategory === 'active') listToDisplay = activeList;
            else if (statusCategory === 'transit') listToDisplay = transitList;
            else listToDisplay = completedList;

            // Старая логика: клиент видит только то, где можно создать заявку
            if (window.userRole === 'client' && typeof canCreateOrderForSchedule === 'function') {
                listToDisplay = listToDisplay.filter(canCreateOrderForSchedule);
            }

            if (!listToDisplay.length) {
                container.innerHTML = "Нет расписаний для выбранной категории.";
                return;
            }

            // Группировка по дате приёмки (accept_date)
            const grouped = {};
            listToDisplay.forEach(sh => {
                const d = sh.accept_date;
                if (!grouped[d]) grouped[d] = [];
                grouped[d].push(sh);
            });

            // Рендер
            container.innerHTML = "";
            Object.keys(grouped)
                .sort((a, b) => new Date(a) - new Date(b))
                .forEach(d => {
                    grouped[d].forEach(sh => {
                        const formattedAccept = typeof formatDeliveryDate === 'function'
                            ? formatDeliveryDate(sh.accept_date)
                            : sh.accept_date;
                        const formattedDelivery = typeof formatDeliveryDate === 'function'
                            ? formatDeliveryDate(sh.delivery_date)
                            : sh.delivery_date;

                        let mpClass = '';
                        if (sh.marketplace === 'Ozon') mpClass = 'mp-ozon';
                        else if (sh.marketplace === 'Wildberries') mpClass = 'mp-wb';
                        else if (sh.marketplace === 'YandexMarket') mpClass = 'mp-yandex';

                        const canOrder = typeof canCreateOrderForSchedule === 'function'
                            ? canCreateOrderForSchedule(sh)
                            : false;

                        const div = document.createElement("div");
                        div.className = "upcoming-item styled-upcoming-item";
                        if (canOrder) {
                            div.classList.add("card-clickable");
                            div.addEventListener("click", () => openRequestFormModal(sh.id));
                        }

                        div.innerHTML = `
                            <div class="shipment-info">
                                <div class="shipment-header" style="display:flex; justify-content:space-between; align-items:center;">
                                    <span class="shipment-warehouse">${sh.city || '—'} → ${sh.warehouses || '—'}</span>
                                    <span class="shipment-marketplace ${mpClass}">${sh.marketplace || ''}</span>
                                </div>
                                <div class="shipment-date-row" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                                    <div class="shipment-sub"><strong>${formattedAccept} → ${formattedDelivery}</strong></div>
                                    ${canOrder ? `<span class="cta-label">Создать заявку</span>` : ''}
                                </div>
                            </div>
                        `;
                        container.appendChild(div);
                    });
                });
        })
        .catch(err => {
            console.error("Ошибка fetchAndDisplayUpcoming:", err);
            container.innerHTML = `Ошибка загрузки: ${err.message}`;
        });
}









function formatDeliveryDate(dateStr) {
    if (!dateStr) return "";
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy} ${dayName}`;
}
function filterByCity(cityName) {
    activeCityFilter = cityName;
    document.querySelectorAll(".city-tab-header .tab-button").forEach(btn => {
        btn.classList.toggle("active", btn.textContent === cityName || (cityName === "" && btn.textContent === "Все"));
    });
    fetchAndDisplayUpcoming(archiveView);
}
// Создание формы расписания
// === schedule.js ===
function showCreateForm() {
    if (!canCreateSchedule) {
        alert("Нет прав!");
        return;
    }

    const modalContainer = document.getElementById("modalContainer");
    if (!modalContainer) return;

    const timeSlots = Array.from({ length: 24 }, (_, i) =>
        `${String(i).padStart(2, "0")}:00-${String((i + 1) % 24).padStart(2, "0")}:00`
    );

    Promise.all([
        fetch("warehouses.php").then(r => r.json()),
        fetch("cities.php", { cache: "no-store" }).then(r => r.json())
    ])
    .then(([warehouses, cities]) => {
        renderCreateForm(modalContainer, warehouses, cities, timeSlots);
    })
    .catch(err => {
        console.error("Ошибка загрузки данных:", err);
    });

    function renderCreateForm(container, warehouses, cities, timeSlots) {
        const modalContent = document.createElement("div");
        modalContent.className = "modal-content";
        modalContent.innerHTML = `
            <i class="fas fa-times modal-close" onclick="closeScheduleModal()"></i>
            <div class="modal-header"><h2>Создать отправление</h2></div>
            <div class="modal-body">
                <form id="createScheduleForm">
                    <div class="form-group">
                        <label>Город отправления:</label>
                        <div style="display:flex; gap:10px;">
                            <select name="city" id="citySelect" required>
                                ${cities.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}
                            </select>
                            <button type="button" onclick="addNewCity()">➕</button>
                            <button type="button" onclick="deleteSelectedCity()">🗑</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Дата выезда:</label>
                        <input type="date" name="accept_date" required>
                    </div>
                    <div class="form-group">
                        <label>Время приёма:</label>
                        <select name="accept_time" required>
                            <option value="08:00-17:00">08:00-17:00</option>
                            <option value="09:00-18:00">09:00-18:00</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Дата сдачи:</label>
                        <input type="date" name="delivery_date" required>
                    </div>
                    <div class="form-group">
                        <label>Склады:</label>
                        <div class="warehouse-checkboxes" id="warehouseCheckboxes">
                            ${
                              warehouses.map(wh => `
                                <div class="warehouse-checkbox-item">
                                    <input type="checkbox" name="warehouses[]" value="${wh.name}" id="warehouse-${wh.name}">
                                    <label for="warehouse-${wh.name}" class="warehouse-label">${wh.name}</label>
                                </div>
                              `).join("")
                            }
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 8px;">
                            <button type="button" onclick="addNewWarehouseAndRefresh()">➕ Добавить</button>
                            <button type="button" onclick="enterWarehouseEditMode()">✏️ Редактировать</button>
                            <button type="button" onclick="confirmWarehouseDelete()">🗑️ Удалить</button>
                        </div>
                        <div id="warehouseEditControls" style="margin-top:10px; display:none;">
                            <button type="button" onclick="saveWarehouseEdits()">💾 Сохранить изменения</button>
                            <button type="button" onclick="cancelWarehouseEdits()">✖️ Отмена</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Маркетплейс:</label>
                        <select name="marketplace" id="marketplaceSelect" required>
                            <option value="Wildberries">Wildberries</option>
                            <option value="Ozon">Ozon</option>
                            <option value="YandexMarket">Яндекс Маркет</option>
                        </select>
                    </div>
                    <div class="form-group" id="timeslotField">
                        <label>Тайм-слот (для Ozon):</label>
                        <select name="timeslot">
                            ${timeSlots.map(slot => `<option value="${slot}">${slot}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Номер автомобиля:</label>
                        <input type="text" name="car_number">
                    </div>
                    <div class="form-group">
                        <label>ФИО водителя:</label>
                        <input type="text" name="driver_name">
                    </div>
                    <div class="form-group">
                        <label>Номер телефона водителя:</label>
                        <input type="text" name="driver_phone">
                    </div>
                    <div class="form-group">
                        <label>Марка машины:</label>
                        <input type="text" name="car_brand">
                    </div>
                    <div class="form-group">
                        <label>Окончание приёмки (accept_deadline):</label>
                        <input type="datetime-local" name="accept_deadline" required>
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="action-button save-btn">Сохранить</button>
                    </div>
                    <div class="error-message" id="createError" style="display:none;color:red;"></div>
                </form>
            </div>
        `;
        container.innerHTML = "";
        container.appendChild(modalContent);
        container.style.display = "block";
        currentModal = container;

        const form = document.getElementById("createScheduleForm");
        const mpSelect = document.getElementById("marketplaceSelect");
        const tsField = document.getElementById("timeslotField");

        if (mpSelect && tsField) {
            mpSelect.addEventListener("change", () => {
                tsField.style.display = mpSelect.value === "Ozon" ? "block" : "none";
            });
        }

        form.addEventListener("submit", e => {
            e.preventDefault();
            const formData = new FormData(form);
            const selectedWh = Array.from(form.querySelectorAll('input[name="warehouses[]"]:checked'))
                                     .map(cb => cb.value);
            if (selectedWh.length === 0) {
                document.getElementById("createError").textContent = "Выберите хотя бы один склад.";
                document.getElementById("createError").style.display = "block";
                return;
            }
            selectedWh.forEach((w, idx) => {
                formData.append(`warehouses[${idx}]`, w);
            });
            formData.append("action", "create");
            fetch("schedule.php", { method: "POST", body: formData })
                .then(r => r.json())
                .then(d => {
                    if (d.status === "success") {
                        fetchScheduleData();
                        fetchDataAndUpdateCalendar();
                        closeScheduleModal();
                    } else {
                        document.getElementById("createError").textContent = d.message || "Ошибка сохранения.";
                        document.getElementById("createError").style.display = "block";
                    }
                })
                .catch(err => {
                    console.error("Ошибка createScheduleForm:", err);
                    document.getElementById("createError").textContent = "Ошибка связи с сервером.";
                    document.getElementById("createError").style.display = "block";
                });
        });

        window.addNewCity = function () {
            const name = prompt("Введите название города:");
            if (!name || !name.trim()) return;
            fetch("cities.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "add", name: name.trim() })
            })
            .then(r => r.json())
            .then(data => {
                if (data.status === "success") {
                    showCreateForm(); // перезагрузка данных
                } else {
                    alert("Ошибка: " + data.message);
                }
            });
        };
        window.deleteSelectedCity = function () {
            const select = document.getElementById("citySelect");
            const id = parseInt(select.value);
            if (!id || isNaN(id)) {
                alert("Сначала выберите город для удаления.");
                return;
            }
            if (!confirm("Удалить выбранный город?")) return;

            fetch("cities.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "delete", id })
            })
            .then(r => r.json())
            .then(data => {
                if (data.status === "success") {
                    showCreateForm(); // обновим
                } else {
                    alert("Ошибка: " + data.message);
                }
            });
        };
        window.addNewWarehouseAndRefresh = function () {
            const name = prompt("Введите название склада:");
            if (!name || !name.trim()) return;
            fetch("warehouses.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "add", name: name.trim() })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === "success") {
                    showCreateForm();
                } else {
                    alert("Ошибка: " + data.message);
                }
            });
        };
        window.enterWarehouseEditMode = function () { /* … */ };
        window.confirmWarehouseDelete = function () { /* … */ };
        window.saveWarehouseEdits = function () { /* … */ };
        window.cancelWarehouseEdits = function () { /* … */ };
    }
}





// ========== INLINE РЕДАКТИРОВАНИЕ СКЛАДОВ ==========

function enterWarehouseEditMode() {
    const checkboxes = document.querySelectorAll('input[name="warehouses[]"]:checked');
    if (checkboxes.length === 0) {
        alert("Сначала выберите склады для редактирования.");
        return;
    }

    checkboxes.forEach(cb => {
        const label = cb.nextElementSibling;
        const currentName = label.textContent;
        const input = document.createElement("input");
        input.type = "text";
        input.value = currentName;
        input.className = "edit-input";
        input.dataset.oldName = currentName;
        label.replaceWith(input);
    });

    document.getElementById("warehouseEditControls").style.display = "block";
}

function cancelWarehouseEdits() {
    const inputs = document.querySelectorAll('.edit-input');
    inputs.forEach(input => {
        const name = input.dataset.oldName;
        const label = document.createElement("label");
        label.htmlFor = `warehouse-${name}`;
        label.className = "warehouse-label";
        label.textContent = name;
        input.replaceWith(label);
    });

    document.getElementById("warehouseEditControls").style.display = "none";
}

function saveWarehouseEdits() {
    const inputs = document.querySelectorAll('.edit-input');
    const edits = [];

    inputs.forEach(input => {
        const oldName = input.dataset.oldName;
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            edits.push({ old_name: oldName, new_name: newName });
        }
    });

    if (edits.length === 0) {
        alert("Нет изменений.");
        return;
    }

    fetch("warehouses.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_edit", edits })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === "success") {
            alert("Склады обновлены.");
            showCreateForm();
        } else {
            alert("Ошибка: " + data.message);
        }
    })
    .catch(err => alert("Ошибка: " + err.message));
}

function confirmWarehouseDelete() {
    const selected = Array.from(document.querySelectorAll('input[name="warehouses[]"]:checked'))
        .map(cb => cb.value);

    if (selected.length === 0) {
        alert("Выберите склады для удаления.");
        return;
    }

    if (!confirm(`Удалить ${selected.length} склад(ов)?`)) return;

    fetch("warehouses.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", names: selected })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === "success") {
            alert("Удалено.");
            showCreateForm();
        } else {
            alert("Ошибка: " + data.message);
        }
    })
    .catch(err => alert("Ошибка: " + err.message));
}





// Редактирование
function editSchedule(id) {
    if (!canCreateSchedule) {
        alert("Нет прав!");
        return;
    }
    fetch(`schedule.php?id=${id}`)
        .then(r => {
            if (!r.ok) throw new Error("Ошибка загрузки: " + r.status);
            return r.json();
        })
        .then(data => {
            if (!data.success || !data.schedule) {
                alert("Не найдена запись");
                return;
            }
            const sh = data.schedule;
            const modalContainer = document.getElementById("modalContainer");
            if (!modalContainer) return;
            const timeSlots = Array.from({ length: 24 }, (_, i) =>
                `${String(i).padStart(2, "0")}:00-${String((i + 1) % 24).padStart(2, "0")}:00`
            );
            fetch("warehouses.php")
                .then(r2 => {
                    if (!r2.ok) throw new Error("Ошибка складов: " + r2.status);
                    return r2.json();
                })
                .then(warehouses => {
                    const selectedWarehouses = sh.warehouses ? sh.warehouses.split(",").map(s => s.trim()) : [];
                    const marketplace = sh.marketplace || "None";
                    const modalContent = document.createElement("div");
                    modalContent.className = "modal-content";
                    modalContent.innerHTML = `
                        <i class="fas fa-times modal-close" onclick="closeScheduleModal()"></i>
                        <div class="modal-header">
                            <h2>Редактировать отправление #${sh.id}</h2>
                        </div>
                        <div class="modal-body">
                            <form id="editScheduleForm">
                                <input type="hidden" name="id" value="${sh.id}">
                                <div class="form-group">
                                    <label>Город:</label>
                                    <select name="city" required>
                                        <option value="Хасавюрт" ${sh.city==="Хасавюрт"?"selected":""}>Хасавюрт</option>
                                        <option value="Махачкала" ${sh.city==="Махачкала"?"selected":""}>Махачкала</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Дата приёма:</label>
                                    <input type="date" name="accept_date" value="${sh.accept_date||""}" required>
                                </div>
                                <div class="form-group">
                                    <label>Время приёма:</label>
                                    <select name="accept_time" required>
                                        <option value="08:00-17:00" ${sh.accept_time==="08:00-17:00"?"selected":""}>08:00-17:00</option>
                                        <option value="09:00-18:00" ${sh.accept_time==="09:00-18:00"?"selected":""}>09:00-18:00</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Дата сдачи:</label>
                                    <input type="date" name="delivery_date" value="${sh.delivery_date||""}" required>
                                </div>
                                <div class="form-group">
                                    <label>Склады:</label>
                                    <div class="warehouse-checkboxes">
                                        ${
                                            warehouses.map(wh => {
                                                const checked = selectedWarehouses.includes(wh.name) ? "checked" : "";
                                                return `
                                                    <div class="warehouse-checkbox-item">
                                                        <input type="checkbox" name="warehouses[]" value="${wh.name}" id="warehouse-${wh.name}" ${checked}>
                                                        <label for="warehouse-${wh.name}">${wh.name}</label>
                                                    </div>
                                                `;
                                            }).join("")
                                        }
                                    </div>
                                    <button type="button" class="add-warehouse-button" onclick="addNewWarehouse('editScheduleForm')">Добавить склад</button>
                                </div>
                                <div class="form-group">
                                    <label>Маркетплейс:</label>
                                    <select name="marketplace" id="marketplaceSelectEdit" required>
                                        <option value="Wildberries" ${marketplace==="Wildberries"?"selected":""}>Wildberries</option>
                                        <option value="Ozon" ${marketplace==="Ozon"?"selected":""}>Ozon</option>
                                        <option value="Yandex.M" ${marketplace==="YandexMarket"?"selected":""}>YandexMarket</option>
                                    </select>
                                </div>
                                <div class="form-group" id="timeslotFieldEdit" style="display:${marketplace==="Ozon"?"block":"none"};">
                                    <label>Тайм-слот (для Ozon):</label>
                                    <select name="timeslot">
                                        ${
                                            timeSlots.map(slot => `
                                                <option value="${slot}" ${sh.timeslot===slot?"selected":""}>${slot}</option>
                                            `).join("")
                                        }
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Статус:</label>
                                    <select name="status">
                                        <option value="Приём заявок"   ${sh.status==="Приём заявок"?"selected":""}>Приём заявок</option>
                                        <option value="В пути"         ${sh.status==="В пути"?"selected":""}>В пути</option>
                                        <option value="На складе"      ${sh.status==="На складе"?"selected":""}>На складе</option>
                                        <option value="Завершено"      ${sh.status==="Завершено"?"selected":""}>Завершено</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Номер автомобиля:</label>
                                    <input type="text" name="car_number" value="${sh.car_number||""}" required>
                                </div>
                                <div class="form-group">
                                    <label>ФИО водителя:</label>
                                    <input type="text" name="driver_name" value="${sh.driver_name||""}" required>
                                </div>
                                <div class="form-group">
                                    <label>Номер телефона водителя:</label>
                                    <input type="text" name="driver_phone" value="${sh.driver_phone||""}" required>
                                </div>
                                <div class="form-group">
                                    <label>Марка машины:</label>
                                    <input type="text" name="car_brand" value="${sh.car_brand||""}" required>
                                </div>
                                <div class="form-group">
                                    <label>Окончание приёмки (deadline):</label>
                                    <input type="datetime-local" name="accept_deadline" value="${sh.accept_deadline ? sh.accept_deadline.replace(" ", "T") : ""}">
                                </div>
                                <div class="modal-actions">
                                    <button type="submit" class="action-button save-btn">Сохранить</button>
                                    <button type="button" class="action-button delete-btn" onclick="deleteSchedule(${sh.id})">Удалить</button>
                                </div>
                                <div class="error-message" id="editError" style="display:none;color:red;"></div>
                            </form>
                        </div>
                    `;
                    modalContainer.innerHTML = "";
                    modalContainer.appendChild(modalContent);
                    modalContainer.style.display = "block";
                    currentModal = modalContainer;
                    const marketSel = document.getElementById("marketplaceSelectEdit");
                    const timeslotField = document.getElementById("timeslotFieldEdit");
                    if (marketSel && timeslotField) {
                        marketSel.addEventListener("change", () => {
                            timeslotField.style.display = marketSel.value === "Ozon" ? "block" : "none";
                        });
                    }
                    const editForm = document.getElementById("editScheduleForm");
                    editForm.addEventListener("submit", e => {
                        e.preventDefault();
                        const formData = new FormData(editForm);
                        const selectedWh = Array.from(editForm.querySelectorAll('input[name="warehouses[]"]:checked')).map(cb => cb.value);
                        if (selectedWh.length === 0) {
                            document.getElementById("editError").textContent = "Выберите хотя бы один склад.";
                            document.getElementById("editError").style.display = "block";
                            return;
                        }
                        selectedWh.forEach((w, idx) => {
                            formData.append(`warehouses[${idx}]`, w);
                        });
                        formData.append("action", "edit");
                        fetch("schedule.php", { method: "POST", body: formData })
                            .then(r => r.json())
                            .then(d => {
                                if (d.status === "success") {
                                    fetchScheduleData();
                                    fetchDataAndUpdateCalendar();
                                    closeScheduleModal();
                                } else {
                                    document.getElementById("editError").textContent = d.message || "Ошибка сохранения.";
                                    document.getElementById("editError").style.display = "block";
                                }
                            })
                            .catch(err => {
                                console.error("Ошибка editScheduleForm:", err);
                                document.getElementById("editError").textContent = "Ошибка связи с сервером.";
                                document.getElementById("editError").style.display = "block";
                            });
                    });
                })
                .catch(err2 => console.error("Ошибка warehouses:", err2));
        })
        .catch(err => console.error("Ошибка editSchedule:", err));
}

// Удаление
function deleteSchedule(id) {
    if (!confirm("Удалить это расписание?")) return;
    fetch("schedule.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            alert(data.message); // Показываем: удалено или архивировано
            fetchAndDisplayUpcoming(archiveView); // 🔁 обновляем список
        } else {
            alert("Ошибка: " + data.message);
        }
    })
    .catch(err => {
        alert("Ошибка сети: " + err.message);
    });
}

function archiveSchedule(id) {
    if (!confirm("Отправить расписание в архив?")) return;
    fetch("mass_update_schedule.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", schedule_ids: [id] })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success && data.results && data.results[id] && data.results[id].status === 'archived') {
            alert('Расписание архивировано');
            loadManagementSchedules();
            fetchDataAndUpdateCalendar();
        } else {
            const msg = data.results && data.results[id] && data.results[id].message ? data.results[id].message : 'Ошибка архивации';
            alert(msg);
        }
    })
    .catch(err => {
        alert("Ошибка сети: " + err.message);
    });
}


function openScheduleManagementModal() {
    document.getElementById("scheduleManagementModal").style.display = "block";
    loadManagementSchedules(); // Загружаем список
}

function closeScheduleManagementModal() {
    document.getElementById("scheduleManagementModal").style.display = "none";
}


// Загрузка всех расписаний (архив = 0)
// === schedule.js ===

function loadManagementSchedules() {
    const block = document.getElementById("managementScheduleList");
    if (!block) return;

    // Верстаем фильтры и таблицу
    block.innerHTML = `
      <div class="filters-row">
        <label>Маркетплейс
          <select id="mgmtFilterMarketplace">
            <option value="">Все</option>
          </select>
        </label>
        <label>Город
          <select id="mgmtFilterCity">
            <option value="">Все</option>
          </select>
        </label>
        <label>Склад
          <select id="mgmtFilterWarehouse">
            <option value="">Все</option>
          </select>
        </label>
        <button id="mgmtFilterApplyBtn" class="primary-button">Применить</button>
      </div>
      <div style="margin-top:10px;">
            <label for="mgmtFilterDate">Дата выезда: </label>
            <input type="date" id="mgmtFilterDate">
            <label style="margin-left:10px;">
                <input type="checkbox" id="mgmtFilterNoOrders">
                Без заявок
            </label>
        </div>
      <div class="mass-actions">
        <label><input type="checkbox" id="selectAllSchedules"> Выбрать все</label>
        <button id="btnMassDelete">Удалить выбранные</button>
        <button id="btnMassArchive">Архивировать выбранные</button>
        <div id="massManageMessages"></div>
      </div>
      <div id="mgmtSchedulesTable"></div>
    `;

    const mpSelect = document.getElementById("mgmtFilterMarketplace");
    const citySelect = document.getElementById("mgmtFilterCity");
    const whSelect = document.getElementById("mgmtFilterWarehouse");

    // Загружаем маркетплейсы
    fetch("filter_options.php?action=marketplaces")
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data.marketplaces)) return;
        mpSelect.innerHTML = `<option value="">Все</option>` +
          data.marketplaces.map(mp => `<option value="${mp}">${mp}</option>`).join("");
      });

    // Функции для динамического обновления городов и складов
    function loadCities(mp) {
      if (mp) {
        fetch(`filter_options.php?action=cities&marketplace=${encodeURIComponent(mp)}`)
          .then(r => r.json())
          .then(data => {
            const cities = data.cities || [];
            citySelect.innerHTML = `<option value="">Все</option>` +
              cities.map(c => `<option value="${c}">${c}</option>`).join("");
            whSelect.innerHTML = `<option value="">Все</option>`; // очищаем склады
          });
      } else {
        fetch("filter_options.php?action=all_cities")
          .then(r => r.json())
          .then(data => {
            const cities = data.cities || [];
            citySelect.innerHTML = `<option value="">Все</option>` +
              cities.map(c => `<option value="${c}">${c}</option>`).join("");
          });
        fetch("filter_options.php?action=all_warehouses")
          .then(r => r.json())
          .then(data => {
            const warehouses = data.warehouses || [];
            whSelect.innerHTML = `<option value="">Все</option>` +
              warehouses.map(w => `<option value="${w}">${w}</option>`).join("");
          });
      }
    }

    function loadWarehouses(mp, city) {
      // если выбран маркетплейс и город — загружаем только по ним
      if (mp && city) {
        fetch(`filter_options.php?action=warehouses&marketplace=${encodeURIComponent(mp)}&city=${encodeURIComponent(city)}`)
          .then(r => r.json())
          .then(data => {
            const warehouses = data.warehouses || [];
            whSelect.innerHTML = `<option value="">Все</option>` +
              warehouses.map(w => `<option value="${w}">${w}</option>`).join("");
          });
      } else if (mp) {
        // если выбран только маркетплейс
        fetch(`filter_options.php?action=warehouses&marketplace=${encodeURIComponent(mp)}&city=`)
          .then(r => r.json())
          .then(data => {
            const warehouses = data.warehouses || [];
            whSelect.innerHTML = `<option value="">Все</option>` +
              warehouses.map(w => `<option value="${w}">${w}</option>`).join("");
          });
      } else {
        // иначе загружаем все склады
        fetch("filter_options.php?action=all_warehouses")
          .then(r => r.json())
          .then(data => {
            const warehouses = data.warehouses || [];
            whSelect.innerHTML = `<option value="">Все</option>` +
              warehouses.map(w => `<option value="${w}">${w}</option>`).join("");
          });
      }
    }

    // Обновляем города и склады при изменении маркетплейса
    mpSelect.onchange = () => {
      const mp = mpSelect.value;
      loadCities(mp);
    };
    // Обновляем склады при изменении города
    citySelect.onchange = () => {
      const mp = mpSelect.value;
      const ct = citySelect.value;
      loadWarehouses(mp, ct);
    };

    // Подгружаем все города и склады при первой загрузке
    loadCities("");
    // Кнопка «Применить» оставляем прежней — вызывает reloadManagementSchedules()
    document.getElementById("mgmtFilterApplyBtn").onclick = reloadManagementSchedules;

    // Массовые действия и первоначальная загрузка таблицы — без изменений
    document.getElementById("btnMassDelete").onclick = () => massManageSchedules('delete');
    document.getElementById("btnMassArchive").onclick = () => massManageSchedules('archive');
    document.getElementById("selectAllSchedules").onchange = (e) => {
      const checked = e.target.checked;
      document.querySelectorAll(".schedule-checkbox").forEach(cb => cb.checked = checked);
    };

    // Загружаем таблицу расписаний
    reloadManagementSchedules();
}


// Вспомогательная функция: загрузка и отображение расписаний с применением фильтров и сортировки
function reloadManagementSchedules() {
    const mp   = document.getElementById("mgmtFilterMarketplace")?.value || '';
    const ct   = document.getElementById("mgmtFilterCity")?.value || '';
    const wh   = document.getElementById("mgmtFilterWarehouse")?.value || '';
    const date = document.getElementById("mgmtFilterDate")?.value || '';
    const noOrders = document.getElementById("mgmtFilterNoOrders")?.checked;

    let url = "schedule.php?archived=0";
    if (mp)   url += "&marketplace=" + encodeURIComponent(mp);
    if (ct)   url += "&city=" + encodeURIComponent(ct);
    if (wh)   url += "&warehouse=" + encodeURIComponent(wh);
    if (date) url += "&date=" + encodeURIComponent(date);
    if (noOrders) url += "&no_orders=1";

    const tableBlock = document.getElementById("mgmtSchedulesTable");
    if (!tableBlock) return;
    tableBlock.innerHTML = "Загрузка…";

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) {
            tableBlock.innerHTML = "<p>Ошибка загрузки расписаний</p>";
            return;
        }

        // Сортировка по окончанию приёмки (раньше — выше)
        data.sort((a, b) => {
            const dA = new Date(a.accept_deadline || a.acceptance_end || a.accept_date || 0);
            const dB = new Date(b.accept_deadline || b.acceptance_end || b.accept_date || 0);
            return dA - dB;
        });

        let html = `
            <table class="management-table">
              <thead>
                <tr>
                  <th><input type="checkbox" id="selectAllSchedules"></th>
                  <th>№</th>
                  <th>Откуда → Куда</th>
                  <th>Приёмка</th>
                  <th>Сдача</th>
                  <th>Заявок</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
        `;

        data.forEach(s => {
            const ordersCount = typeof s.orders_count !== 'undefined' ? s.orders_count : 0;

            let rowClass = '';
            if (s.status === 'Завершено' || s.status === 'Товар отправлен') {
                rowClass = 'finished';
            } else if (
                s.status === 'В пути' ||
                s.status === 'Готов к отправке' ||
                s.status === 'В обработке'
            ) {
                rowClass = 'blocked';
            }

            html += `
                <tr id="schedule_item_${s.id}" class="${rowClass}">
                  <td><input type="checkbox" class="schedule-checkbox" value="${s.id}"></td>
                  <td>${s.id}</td>
                  <td>${s.city} → ${s.warehouses || '—'}</td>
                  <td>${s.accept_date}${s.accept_time ? ' ' + s.accept_time : ''}</td>
                  <td>${s.delivery_date || ''}</td>
                  <td class="orders-col">${ordersCount}</td>
                  <td>
                    <select onchange="updateStatus(${s.id}, this.value)">
                      <option value="Ожидает отправки" ${s.status==="Ожидает отправки" ? "selected" : ""}>Ожидает</option>
                      <option value="Готов к отправке" ${s.status==="Готов к отправке" ? "selected" : ""}>Готов</option>
                      <option value="В пути" ${s.status==="В пути" ? "selected" : ""}>В пути</option>
                      <option value="Завершено" ${s.status==="Завершено" ? "selected" : ""}>Завершено</option>
                    </select>
                  </td>
                  <td>
                    <button class="action-button btn-move" data-id="${s.id}" ${ordersCount ? '' : 'disabled'} title="Перенести все заявки на другое отправление">🔄 Перенести</button>
                    <button class="action-button delete-btn" onclick="deleteSchedule(${s.id})">Удалить</button>
                    <button class="action-button archive-btn" onclick="archiveSchedule(${s.id})">Архивировать</button>
                  </td>
                </tr>
            `;
        });

        html += `
              </tbody>
            </table>
        `;

        tableBlock.innerHTML = html;

        // Выделение всех чекбоксов
        const selectAll = document.getElementById("selectAllSchedules");
        if (selectAll) {
            selectAll.addEventListener("change", () => {
                const checked = selectAll.checked;
                document.querySelectorAll(".schedule-checkbox").forEach(cb => cb.checked = checked);
            });
        }

        // Обработчики для переноса заявок
        document.querySelectorAll('.btn-move').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.disabled) return;
                const fromId = btn.dataset.id;
                const toId = prompt("Введите ID расписания, на которое перенести заявки:");
                if (!toId) return;
                if (String(toId).trim() === '' || Number(toId) === Number(fromId)) return;
                if (!confirm(`Перенести все заявки с #${fromId} на #${toId}?`)) return;

                btn.disabled = true;
                try {
                    const res = await fetch('move_orders.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
                        body: JSON.stringify({ from_id: Number(fromId), to_id: Number(toId) })
                    });
                    const resp = await res.json();
                    if (resp && resp.success) {
                        alert(resp.message || 'Заявки перенесены');
                        reloadManagementSchedules();
                    } else {
                        alert('Ошибка: ' + (resp?.message || 'не удалось перенести заявки'));
                    }
                } catch (e) {
                    console.error(e);
                    alert('Ошибка сети при переносе заявок');
                } finally {
                    btn.disabled = false;
                }
            });
        });
    })
    .catch(err => {
        tableBlock.innerHTML = "<p>Ошибка загрузки расписаний</p>";
        console.error("Ошибка reloadManagementSchedules:", err);
    });
}










// Принудительный апдейт статуса
function updateStatus(id, status) {
    const realUserRole = typeof userRole !== 'undefined' ? userRole : 'client';
    const localCanUpdate = (realUserRole === "admin" || realUserRole === "manager");

    if (!localCanUpdate) {
        alert("Нет прав!");
        return;
    }

    fetch("schedule.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", id, status })
    })
    .then(r => r.json())
    .then(d => {
        if (d.status === "success") {
            fetchScheduleData();
            fetchDataAndUpdateCalendar();
        } else {
            alert("Ошибка: " + d.message);
        }
    })
    .catch(err => console.error("Ошибка updateStatus:", err));
}

function completeSchedule(id) {
    if (!canCreateSchedule) {
        alert("Нет прав!");
        return;
    }
    if (!confirm("Завершить запись?")) return;
    updateStatus(id, "Завершено");
}
// Экспорт
function exportSchedule() {
    fetch("schedule.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export" })
    })
        .then(r => {
            if (!r.ok) throw new Error("Ошибка экспорта: " + r.status);
            return r.blob();
        })
        .then(blob => {
            let url = window.URL.createObjectURL(blob);
            let a = document.createElement("a");
            a.href = url;
            a.download = "schedule.xls";
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(err => console.error("Ошибка exportSchedule:", err));
}
// Загрузка складов
function loadWarehousesForFilter() {
    const select = document.getElementById("warehouseFilter");
    if (!select) {
        console.warn("Элемент #warehouseFilter не найден в DOM");
        return;
    }

    fetch("warehouse_filter.php", { cache: "no-store" })
        .then(r => r.json())
        .then(data => {
            if (!Array.isArray(data)) {
                console.error("warehouse_filter.php вернул некорректный формат:", data);
                return;
            }

            select.innerHTML = '<option value="">Все склады</option>';
            data.forEach(w => {
                if (w.name && typeof w.name === 'string') {
                    const opt = document.createElement("option");
                    opt.value = w.name;
                    opt.textContent = w.name;
                    select.appendChild(opt);
                }
            });
        })
        .catch(err => {
            console.error("Ошибка загрузки складов:", err);
        });
}

/**
 * Функция добавления нового склада
 */
function addNewWarehouse(formId) {
    const name = prompt("Введите название склада:");
    if (!name || !name.trim()) return;
    fetch("warehouses.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name: name.trim() })
    })
        .then(r => r.json())
        .then(d => {
            if (d.status === "success") {
                loadWarehousesForFilter();
                fetch("warehouses.php")
                    .then(r2 => r2.json())
                    .then(warehouses => {
                        const container = document.querySelector(`#${formId} .warehouse-checkboxes`);
                        if (container) {
                            container.innerHTML = warehouses.map(wh => {
                                return `
                                    <div class="warehouse-checkbox-item">
                                        <input type="checkbox" name="warehouses[]" value="${wh.name}" id="warehouse-${wh.name}">
                                        <label for="warehouse-${wh.name}">${wh.name}</label>
                                    </div>
                                `;
                            }).join("");
                        }
                    })
                    .catch(err2 => console.error("Ошибка обновления списков складов:", err2));
            } else {
                alert("Ошибка: " + d.message);
            }
        })
        .catch(err => console.error("Ошибка addNewWarehouse:", err));
}
// Грузим данные расписания (для обновления списка…)
function fetchScheduleData() {
    // если нужно, можно здесь перезапрашивать schedule.php и обновлять экран
    // или вызывать fetchAndUpdateCalendar()
}
/**
 * Главное изменение: мы не переходим на "processing.html",
 * а просто закрываем модалку (или можем открыть нужный раздел).
 */
function createOrder(scheduleId, city, warehouse) {
    // Вместо перехода на processing.html,
    // вызываем нашу функцию из requestForm.js
    closeScheduleModal(); // если было открыто окно расписания
    openRequestFormModal(scheduleId, city, warehouse);
}

function openShipmentsForDate(date) {
    fetch(`schedule.php?combinedDate=${encodeURIComponent(date)}&archived=${archiveView ? 1 : 0}`
          + (activeMarketplaceFilter ? `&marketplace=${encodeURIComponent(activeMarketplaceFilter)}` : "")
          + (activeCityFilter ? `&city=${encodeURIComponent(activeCityFilter)}` : "")
          + (activeWarehouseFilter ? `&warehouse=${encodeURIComponent(activeWarehouseFilter)}` : "")
          + (activeStatusFilter ? `&status=${encodeURIComponent(activeStatusFilter)}` : ""))
        .then(response => {
            if (!response.ok) {
                throw new Error("Ошибка загрузки расписания на дату: " + response.status);
            }
            return response.text();
        })
        .then(html => {
            const modalContainer = document.getElementById("modalContainer");
            if (!modalContainer) return;
            modalContainer.innerHTML = html;
            modalContainer.style.display = "block";
            // Дополнительно: можно навесить события на ID для открытия деталей рейса
            const rows = modalContainer.querySelectorAll("table tr");
            rows.forEach(row => {
                const idCell = row.cells[0];
                if (idCell) {
                    idCell.style.cursor = 'pointer';
                    idCell.title = 'Открыть детали отправления';
                    idCell.onclick = () => {
                        const schedId = idCell.textContent;
                        // Загружаем одно расписание и открываем модал с деталями
                        fetch(`schedule.php?id=${schedId}`)
                            .then(r => r.json())
                            .then(data => {
                                if (data.success && data.schedule) {
                                    openSingleShipmentModal(data.schedule);
                                }
                            })
                            .catch(err => console.error("Ошибка при открытии отправления:", err));
                    };
                }
            });
        })
        .catch(err => {
            console.error("Ошибка openShipmentsForDate:", err);
            alert(err.message || "Не удалось загрузить данные.");
        });
}



function massManageSchedules(action) {
    const checkboxes = Array.from(document.querySelectorAll(".schedule-checkbox:checked"));
    if (checkboxes.length === 0) {
        showMassManageMessage('warning', 'Выберите хотя бы одно расписание.');
        return;
    }

    if (!['delete', 'archive'].includes(action)) {
        showMassManageMessage('error', 'Некорректное действие.');
        return;
    }

    const ids = checkboxes.map(cb => parseInt(cb.value, 10));
    const payload = { action, schedule_ids: ids };

    // Кнопки и контейнер сообщений
    const btnDelete  = document.getElementById('btnMassDelete');
    const btnArchive = document.getElementById('btnMassArchive');
    const msgBox     = document.getElementById('massManageMessages');

    // Блокируем кнопки и очищаем сообщения
    btnDelete.disabled = btnArchive.disabled = true;
    msgBox.innerHTML = '';

    fetch("mass_update_schedule.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Сервер вернул ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.success) {
            showMassManageMessage('error', `Ошибка: ${data.message || 'Неизвестная ошибка'}`);
            return;
        }

        const results = data.results || {};
        const blocked = [];

        ids.forEach(id => {
            const result = results[id];
            const row    = document.getElementById("schedule_item_" + id);
            if (!result || !row) return;

            if (result.status === 'deleted' || result.status === 'archived') {
                row.style.opacity = "0.4";
                row.style.textDecoration = "line-through";
            } else if (result.status === 'blocked') {
                row.style.backgroundColor = "#ffe6e6";
                blocked.push(`Расписание #${id}: ${result.message}`);
            }
        });

        if (blocked.length) {
            showMassManageMessage('warning',
                'Некоторые расписания не обработаны:<ul>'
                + blocked.map(msg => `<li>${msg}</li>`).join('')
                + '</ul>'
            );
        } else {
            showMassManageMessage('success', 'Все выбранные расписания успешно обработаны');
            // можно автоматически закрыть модалку:
            // setTimeout(closeScheduleManagementModal, 1500);
        }

        // Обновляем списки
        loadManagementSchedules();
        fetchDataAndUpdateCalendar();
    })
    .catch(err => {
        showMassManageMessage('error', `Ошибка запроса: ${err.message}`);
    })
    .finally(() => {
        btnDelete.disabled = btnArchive.disabled = false;
    });
}

// Вспомогательная функция для вывода сообщения
function showMassManageMessage(type, htmlText) {
    const msgBox = document.getElementById('massManageMessages');
    msgBox.innerHTML = `<div class="${type}">${htmlText}</div>`;
}





function switchShipmentSubTab(index, total) {
    for (let i = 0; i < total; i++) {
        const tabBtn = document.getElementById(`tabBtn${i}`);
        const tabContent = document.getElementById(`shTab${i}`);
        if (tabBtn) {
            tabBtn.classList.toggle('active', i === index);
        }
        if (tabContent) {
            tabContent.style.display = (i === index) ? 'block' : 'none';
        }
    }
}

function renderShipmentDetailsHTML(sh) {
    const role = typeof userRole !== 'undefined' ? userRole : (window.userRole || 'client');
    const localCanEdit = role === "admin" || role === "manager";
    const statusOptions = [
        "Ожидает отправки",
        "В пути",
        "Завершено"
    ].map(s => `<option value="${s}" ${sh.status === s ? 'selected' : ''}>${s}</option>`).join('');
    return `
        <div class="shipment-card">
            <h3>🚚 ${sh.city} → ${sh.warehouses}</h3>
            <p><strong>Дата сдачи:</strong> ${sh.delivery_date || '—'}</p>
            <p><strong>Дата приёмки:</strong> ${sh.accept_date || '—'} ${sh.accept_time || ''}</p>
            <p><strong>Автомобиль:</strong> ${sh.car_brand || '—'} ${sh.car_number || '—'}</p>
            <p><strong>Водитель:</strong> ${sh.driver_name || '—'} (${sh.driver_phone || '—'})</p>
            <p><strong>Маркетплейс:</strong> ${sh.marketplace || '—'}</p>
            <p><strong>Таймслот:</strong> ${sh.timeslot || '—'}</p>
            <p><strong>Статус:</strong> ${sh.status || '—'}</p>
            ${localCanEdit ? `
                <div class="shipment-actions">
                    <label>Изменить статус:</label>
                    <select onchange="updateStatus(${sh.id}, this.value)">
                        ${statusOptions}
                    </select>
                    <button onclick="editSchedule(${sh.id})">✏️ Редактировать</button>
                    <button onclick="deleteSchedule(${sh.id})">🗑️ Удалить</button>
                </div>
            ` : ''}
        </div>
    `;
}