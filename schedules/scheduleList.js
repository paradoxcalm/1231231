/*
 * scheduleList.js
 *
 * Этот модуль отвечает за вкладку «Ближайшие отправления» и фильтры
 * расписания. Здесь находятся функции для загрузки и отображения
 * предстоящих отправлений, формирования фильтров по маркетплейсам,
 * городам и складам, а также вспомогательные методы форматирования
 * дат и кликов по городу.
 *
 * Большая часть кода взята из исходного файла schedule.js без
 * изменения логики. Переменные и функции экспортируются через
 * глобальный объект window, чтобы ими могли пользоваться другие
 * модули без системы сборки.
 */

// Глобальные переменные для фильтров и прав. Они привязываются к window,
// чтобы сохранять совместимость с остальным кодом, который ожидал
// видеть их в глобальной области видимости.
window.calendarCurrentDate = new Date();
window.canCreateSchedule = false;
window.canCreateOrder = false;
window.activeCityFilter = "";
window.activeWarehouseFilter = "";
window.activeDestinationWarehouseFilter = "";
window.archiveView = false;
window.activeMarketplaceFilter = "";

/**
 * Основная функция для загрузки страницы расписания. Она формирует
 * разметку вкладок, фильтров и запускает начальную загрузку
 * предстоящих отправлений и календаря. Взята из schedule.js.
 */
function loadSchedule() {
    const dynamicContent = document.getElementById("dynamicContent");
    if (!dynamicContent) return;

    // Определяем, является ли пользователь администратором или менеджером
    window.canCreateSchedule = (userRole === "admin" || userRole === "manager");
    const isAdminOrManager = (userRole === "admin" || userRole === "manager");

    // Шаблон HTML для раздела расписания. Содержит вкладки
    // «Ближайшие отправления» и «Календарь», кнопки создания
    // отправления и управления, а также блок фильтров.
    const html = `
        <div class="schedule-header">
          <h1>Расписание</h1>
        </div>
        <div class="schedule-tabs">
          <button id="tab-upcoming" class="active" onclick="window.schedule.switchTab('upcoming')">Ближайшие отправления</button>
          ${isAdminOrManager ? `<button id=\"tab-calendar\" onclick=\"window.schedule.switchTab('calendar')\">Календарь</button>` : `<button id=\"tab-calendar\" onclick=\"window.schedule.switchTab('calendar')\">Календарь</button>`}
        </div>
        <div id="tabContent-upcoming" style="display:block;">
          <div class="filter-actions">
            <button id="toggleArchiveBtn">Показать архив</button>
            ${window.canCreateSchedule ? `
              <button id="createScheduleBtn" onclick="window.schedule.showCreateForm()">Создать отправление</button>
              <div class="excel-dropdown">
                <button id="excelDropdownBtn" onclick="window.schedule.toggleExcelMenu()">📤 Excel <span id="excelArrow">▼</span></button>
                <div id="excelMenu" class="dropdown-content">
                  <a href="#" onclick="window.schedule.exportSchedule()">📤 Экспорт данных</a>
                  <a href="#" onclick="window.schedule.openImportModal()">📥 Импорт расписания</a>
                  <a href="/templates/Расписание_шаблон.xlsx">📄 Скачать шаблон</a>
                  <a href="#" onclick="window.schedule.openScheduleManagementModal()">⚙️ Управление</a>
                  <a href="#" onclick="window.schedule.showShipmentReport()">📄Список Отправлений</a>
                </div>
              </div>
            ` : ``}
          </div>
          <div id="filterBlock" class="schedule-filters">
            <!-- Фильтры загружаются ниже -->
          </div>
          <div id="upcomingList" class="upcoming-list"></div>
        </div>
        <div id="tabContent-calendar" style="display:none;">
          ${isAdminOrManager ? `
            <div id="calendarControls" class="calendar-controls">
              <!-- Управление отображением месяца здесь -->
            </div>
            <div id="calendarFilters" class="calendar-filters">
              <!-- Фильтры календаря здесь -->
            </div>
            <div id="calendarView" class="calendar-view">
              <div id="currentMonthYear"></div>
              <div id="calendarGrid" class="calendar-grid"></div>
            </div>
            <div id="calendarNoAccess" style="display:none;">Нет прав для просмотра календаря</div>
          ` : `<div id="calendarNoAccess">Нет прав для просмотра календаря</div>`}
        </div>
    `;
    dynamicContent.innerHTML = html;

    // --- Фильтры ---
    const filterBlock = document.getElementById("filterBlock");
    if (filterBlock) {
        filterBlock.innerHTML = `
          <label for="marketplaceFilter">Маркетплейс</label>
          <select id="marketplaceFilter" name="marketplaceFilter"></select>
          <label for="cityDropdown">Город</label>
          <select id="cityDropdown" name="cityDropdown"></select>
          <label for="destinationWarehouseFilter">Склад</label>
          <select id="destinationWarehouseFilter" name="destinationWarehouseFilter"></select>
        `;
    }

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

    // Сбрасываем фильтры
    window.activeMarketplaceFilter = "";
    window.activeCityFilter = "";
    window.activeDestinationWarehouseFilter = "";

    const marketplaceSelect = document.getElementById("marketplaceFilter");
    const citySelect = document.getElementById("cityDropdown");
    const warehouseSelect = document.getElementById("destinationWarehouseFilter");

    // Загружаем список маркетплейсов
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
                        data.cities.map(c => `<option value="${c}">${c}</option>`).join('');
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
                        data.warehouses.map(w => `<option value="${w}">${w}</option>`).join('');
                }
            });
    }

    // Изначально подгружаем все города и склады
    loadAllCities();
    loadAllWarehouses();

    // --- Логика изменения фильтров ---
    marketplaceSelect.onchange = function () {
        window.activeMarketplaceFilter = this.value;
        const prevCity = window.activeCityFilter;
        const prevWarehouse = window.activeDestinationWarehouseFilter;

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
            const cityValid = !prevCity || cities.includes(prevCity);
            if (!cityValid) {
                showFilterNotice("Нет отправлений по выбранному маркетплейсу и городу.");
                window.activeCityFilter = "";
                window.activeDestinationWarehouseFilter = "";
            } else {
                window.activeCityFilter = prevCity;
            }
            citySelect.innerHTML = `<option value="">Все</option>` +
                cities.map(c => `<option value="${c}">${c}</option>`).join('');
            citySelect.disabled = false;

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
                warehouseSelect.innerHTML = `<option value="">Все</option>` +
                    warehouses.map(w => `<option value="${w}">${w}</option>`).join('');
                warehouseSelect.disabled = false;
                fetchAndDisplayUpcoming();
            });
        });
    };

    citySelect.onchange = function () {
        window.activeCityFilter = this.value;
        const prevWarehouse = window.activeDestinationWarehouseFilter;

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
            warehouseSelect.innerHTML = `<option value="">Все</option>` +
                warehouses.map(w => `<option value="${w}">${w}</option>`).join('');
            warehouseSelect.disabled = false;
            fetchAndDisplayUpcoming();
        });
    };

    warehouseSelect.onchange = function () {
        window.activeDestinationWarehouseFilter = this.value;
        fetchAndDisplayUpcoming();
    };

    document.getElementById("toggleArchiveBtn").addEventListener("click", () => {
        window.archiveView = !window.archiveView;
        document.getElementById("toggleArchiveBtn").textContent = window.archiveView ? "Показать активные" : "Показать архив";
        fetchAndDisplayUpcoming();
    });

    // Функция переключения вкладок. Добавляем в window, чтобы ею пользовались
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

    // Инициализация календаря при первой загрузке
    if (typeof renderStaticCalendar === 'function') renderStaticCalendar();
    if (typeof fetchDataAndUpdateCalendar === 'function') fetchDataAndUpdateCalendar();

    // Загружаем список отправлений
    fetchAndDisplayUpcoming();
}

/**
 * Загрузка предстоящих отправлений и отображение их на вкладке
 * «Ближайшие отправления». Фильтрация по выбранным параметрам,
 * группировка по дате приёмки и построение элементов списка. Взята
 * без изменений из schedule.js.
 * @param {boolean} showArchived - показывать ли архивированные записи
 */
function fetchAndDisplayUpcoming(showArchived = false) {
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
            // В некоторых ответах backend либо возвращает массив, либо объект {schedules: []}
            const list = Array.isArray(data.schedules) ? data.schedules : data;
            if (!Array.isArray(list) || !list.length) {
                container.innerHTML = "Нет расписаний.";
                return;
            }
            const now = new Date();
            const isClient = window.userRole === 'client';
            // Фильтрация: исключаем прошедшие и записи, по которым клиент уже не может создать заявку
            const filtered = list.filter(item => {
                const delivery = new Date(item.delivery_date);
                if (delivery < now) {
                    return false; // уже отправились
                }
                if (isClient) {
                    return typeof canCreateOrderForSchedule === 'function'
                        ? canCreateOrderForSchedule(item)
                        : true;
                }
                return true;
            });
            // Группировка по дате приёмки (accept_date)
            const grouped = {};
            filtered.forEach(sh => {
                const d = sh.accept_date;
                if (!grouped[d]) grouped[d] = [];
                grouped[d].push(sh);
            });
            // Очищаем контейнер и заполняем блоками
            container.innerHTML = "";
            Object.keys(grouped)
                .sort((a, b) => new Date(a) - new Date(b))
                .forEach(d => {
                    grouped[d].forEach(sh => {
                        const formattedDelivery = typeof formatDeliveryDate === 'function'
                            ? formatDeliveryDate(sh.delivery_date)
                            : sh.delivery_date;
                        let mpClass = '';
                        if (sh.marketplace === 'Ozon') {
                            mpClass = 'mp-ozon';
                        } else if (sh.marketplace === 'Wildberries') {
                            mpClass = 'mp-wb';
                        } else if (sh.marketplace === 'YandexMarket') {
                            mpClass = 'mp-yandex';
                        }
                        const div = document.createElement("div");
                        div.className = "upcoming-item styled-upcoming-item";
                        div.innerHTML = `
                            <div class="shipment-info">
                              <div class="shipment-header">
                                <span class="route">${sh.city || '—'} → ${sh.warehouses || '—'}</span>
                                <span class="marketplace ${mpClass}">${sh.marketplace || ''}</span>
                              </div>
                              <div class="shipment-dates">
                                <span class="delivery-date">${formattedDelivery}</span>
                              </div>
                            </div>
                        `;
                        // При клике открываем карточку отправления
                        div.addEventListener("click", () => {
                            if (window.schedule && typeof window.schedule.openSingleShipmentModal === 'function') {
                                window.schedule.openSingleShipmentModal(sh);
                            }
                        });
                        container.appendChild(div);
                    });
                });
            if (!container.innerHTML.trim()) {
                container.innerHTML = "Нет отправлений по выбранным условиям.";
            }
        })
        .catch(err => {
            console.error("Ошибка fetchAndDisplayUpcoming:", err);
            container.innerHTML = `Ошибка загрузки: ${err.message}`;
        });
}

// Экспортируем функции в глобальный объект window, чтобы они
// были доступны в других модулях без систем сборки
window.loadSchedule = loadSchedule;
window.fetchAndDisplayUpcoming = fetchAndDisplayUpcoming;
