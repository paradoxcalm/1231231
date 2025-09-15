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

    // Шаблон HTML для раздела расписания. Содержит пошаговый интерфейс
    // для выбора города, маркетплейса и склада
    const html = `
        <div class="schedule-container">
            <div class="schedule-header">
                <h1>Расписание отправлений</h1>
                <p class="schedule-subtitle">Выберите параметры отправления пошагово</p>
            </div>
            
            <!-- Пошаговый индикатор -->
            <div class="step-wizard">
                <div class="step-indicator">
                    <div class="step active" data-step="1">
                        <div class="step-circle">
                            <span class="step-number">1</span>
                            <i class="fas fa-check step-check" style="display: none;"></i>
                        </div>
                        <div class="step-label">Город</div>
                    </div>
                    <div class="step-line"></div>
                    <div class="step" data-step="2">
                        <div class="step-circle">
                            <span class="step-number">2</span>
                            <i class="fas fa-check step-check" style="display: none;"></i>
                        </div>
                        <div class="step-label">Маркетплейс</div>
                    </div>
                    <div class="step-line"></div>
                    <div class="step" data-step="3">
                        <div class="step-circle">
                            <span class="step-number">3</span>
                            <i class="fas fa-check step-check" style="display: none;"></i>
                        </div>
                        <div class="step-label">Склад</div>
                    </div>
                    <div class="step-line"></div>
                    <div class="step" data-step="4">
                        <div class="step-circle">
                            <span class="step-number">4</span>
                            <i class="fas fa-check step-check" style="display: none;"></i>
                        </div>
                        <div class="step-label">Результат</div>
                    </div>
                </div>
            </div>

            <!-- Шаг 1: Выбор города -->
            <div class="step-content active" id="step-1">
                <div class="step-card">
                    <div class="step-header">
                        <h2><i class="fas fa-map-marker-alt"></i> Выберите город отправления</h2>
                        <p>Выберите город, откуда будет осуществляться отправление</p>
                    </div>
                    <div class="selection-grid" id="cityGrid">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <span>Загрузка городов...</span>
                        </div>
                    </div>
                    <div class="step-actions">
                        <button class="btn-reset" onclick="resetSteps()">
                            <i class="fas fa-redo"></i>
                            Сбросить
                        </button>
                    </div>
                </div>
            </div>

            <!-- Шаг 2: Выбор маркетплейса -->
            <div class="step-content" id="step-2">
                <div class="step-card">
                    <div class="step-header">
                        <h2><i class="fas fa-store"></i> Выберите маркетплейс</h2>
                        <p>Выберите торговую площадку для отправления</p>
                    </div>
                    <div class="selected-params">
                        <div class="param-item">
                            <span class="param-label">Город:</span>
                            <span class="param-value" id="selectedCity">—</span>
                            <button class="change-btn" onclick="goToStep(1)">
                                <i class="fas fa-edit"></i>
                                Изменить
                            </button>
                        </div>
                    </div>
                    <div class="selection-grid" id="marketplaceGrid">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <span>Загрузка маркетплейсов...</span>
                        </div>
                    </div>
                    <div class="step-actions">
                        <button class="btn-back" onclick="goToStep(1)">
                            <i class="fas fa-arrow-left"></i>
                            Назад
                        </button>
                        <button class="btn-reset" onclick="resetSteps()">
                            <i class="fas fa-redo"></i>
                            Сбросить
                        </button>
                    </div>
                </div>
            </div>

            <!-- Шаг 3: Выбор склада -->
            <div class="step-content" id="step-3">
                <div class="step-card">
                    <div class="step-header">
                        <h2><i class="fas fa-warehouse"></i> Выберите склад назначения</h2>
                        <p>Выберите склад, куда будет доставлен товар</p>
                    </div>
                    <div class="selected-params">
                        <div class="param-item">
                            <span class="param-label">Город:</span>
                            <span class="param-value" id="selectedCity2">—</span>
                            <button class="change-btn" onclick="goToStep(1)">
                                <i class="fas fa-edit"></i>
                                Изменить
                            </button>
                        </div>
                        <div class="param-item">
                            <span class="param-label">Маркетплейс:</span>
                            <span class="param-value" id="selectedMarketplace">—</span>
                            <button class="change-btn" onclick="goToStep(2)">
                                <i class="fas fa-edit"></i>
                                Изменить
                            </button>
                        </div>
                    </div>
                    <div class="selection-grid" id="warehouseGrid">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <span>Загрузка складов...</span>
                        </div>
                    </div>
                    <div class="step-actions">
                        <button class="btn-back" onclick="goToStep(2)">
                            <i class="fas fa-arrow-left"></i>
                            Назад
                        </button>
                        <button class="btn-reset" onclick="resetSteps()">
                            <i class="fas fa-redo"></i>
                            Сбросить
                        </button>
                    </div>
                </div>
            </div>

            <!-- Шаг 4: Результаты -->
            <div class="step-content" id="step-4">
                <div class="step-card">
                    <div class="step-header">
                        <h2><i class="fas fa-list"></i> Доступные отправления</h2>
                        <p>Выберите подходящее отправление для создания заявки</p>
                    </div>
                    <div class="selected-params">
                        <div class="param-item">
                            <span class="param-label">Город:</span>
                            <span class="param-value" id="selectedCity3">—</span>
                            <button class="change-btn" onclick="goToStep(1)">
                                <i class="fas fa-edit"></i>
                                Изменить
                            </button>
                        </div>
                        <div class="param-item">
                            <span class="param-label">Маркетплейс:</span>
                            <span class="param-value" id="selectedMarketplace2">—</span>
                            <button class="change-btn" onclick="goToStep(2)">
                                <i class="fas fa-edit"></i>
                                Изменить
                            </button>
                        </div>
                        <div class="param-item">
                            <span class="param-label">Склад:</span>
                            <span class="param-value" id="selectedWarehouse">—</span>
                            <button class="change-btn" onclick="goToStep(3)">
                                <i class="fas fa-edit"></i>
                                Изменить
                            </button>
                        </div>
                    </div>
                    <div class="results-container">
                        <div id="scheduleResults" class="schedule-results">
                            <div class="loading-state">
                                <div class="loading-spinner"></div>
                                <span>Поиск отправлений...</span>
                            </div>
                        </div>
                    </div>
                    <div class="step-actions">
                        <button class="btn-back" onclick="goToStep(3)">
                            <i class="fas fa-arrow-left"></i>
                            Назад
                        </button>
                        <button class="btn-reset" onclick="resetSteps()">
                            <i class="fas fa-redo"></i>
                            Начать заново
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="schedule-tabs" style="display:none;">
          <button id="tab-upcoming" class="active" onclick="switchTab('upcoming')">Ближайшие отправления</button>
          ${isAdminOrManager ? `<button id="tab-calendar" onclick="switchTab('calendar')">Календарь</button>` : `<button id="tab-calendar" onclick="switchTab('calendar')">Календарь</button>`}
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

    // Инициализация пошагового интерфейса
    initStepWizard();
}

// Инициализация пошагового интерфейса
function initStepWizard() {
    // Сбрасываем состояние
    window.selectedCity = '';
    window.selectedMarketplace = '';
    window.selectedWarehouse = '';
    window.currentStep = 1;
    
    // Загружаем города для первого шага
    loadCitiesForStep();
}

// Загрузка городов
function loadCitiesForStep() {
    const cityGrid = document.getElementById('cityGrid');
    
    fetch("filter_options.php?action=all_cities")
        .then(r => r.json())
        .then(data => {
            if (data.success && data.cities) {
                renderCityOptions(data.cities);
            } else {
                cityGrid.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><span>Ошибка загрузки городов</span></div>';
            }
        })
        .catch(err => {
            console.error('Ошибка загрузки городов:', err);
            cityGrid.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><span>Ошибка загрузки городов</span></div>';
        });
}

// Отрисовка вариантов городов
function renderCityOptions(cities) {
    const cityGrid = document.getElementById('cityGrid');
    
    if (!cities || cities.length === 0) {
        cityGrid.innerHTML = '<div class="empty-state"><i class="fas fa-map-marker-alt"></i><span>Нет доступных городов</span></div>';
        return;
    }
    
    cityGrid.innerHTML = cities.map(city => `
        <div class="selection-card" onclick="selectCity('${city}')">
            <div class="card-icon">
                <i class="fas fa-map-marker-alt"></i>
            </div>
            <div class="card-content">
                <h3>${city}</h3>
                <p>Город отправления</p>
            </div>
            <div class="card-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `).join('');
}

// Выбор города
function selectCity(city) {
    window.selectedCity = city;
    window.activeCityFilter = city;
    
    // Обновляем индикатор шага
    updateStepIndicator(1, true);
    
    // Переходим к следующему шагу
    goToStep(2);
    
    // Загружаем маркетплейсы для выбранного города
    loadMarketplacesForStep(city);
}

// Загрузка маркетплейсов
function loadMarketplacesForStep(city) {
    const marketplaceGrid = document.getElementById('marketplaceGrid');
    
    // Обновляем выбранный город в интерфейсе
    document.getElementById('selectedCity').textContent = city;
    
    fetch("filter_options.php?action=marketplaces")
        .then(r => r.json())
        .then(data => {
            if (data.success && data.marketplaces) {
                renderMarketplaceOptions(data.marketplaces);
            } else {
                marketplaceGrid.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><span>Ошибка загрузки маркетплейсов</span></div>';
            }
        })
        .catch(err => {
            console.error('Ошибка загрузки маркетплейсов:', err);
            marketplaceGrid.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><span>Ошибка загрузки маркетплейсов</span></div>';
        });
}

// Отрисовка вариантов маркетплейсов
function renderMarketplaceOptions(marketplaces) {
    const marketplaceGrid = document.getElementById('marketplaceGrid');
    
    if (!marketplaces || marketplaces.length === 0) {
        marketplaceGrid.innerHTML = '<div class="empty-state"><i class="fas fa-store"></i><span>Нет доступных маркетплейсов</span></div>';
        return;
    }
    
    const marketplaceIcons = {
        'Wildberries': 'fas fa-shopping-bag',
        'Ozon': 'fas fa-shopping-cart',
        'YandexMarket': 'fas fa-store'
    };
    
    marketplaceGrid.innerHTML = marketplaces.map(marketplace => `
        <div class="selection-card marketplace-card" onclick="selectMarketplace('${marketplace}')">
            <div class="card-icon ${marketplace.toLowerCase()}">
                <i class="${marketplaceIcons[marketplace] || 'fas fa-store'}"></i>
            </div>
            <div class="card-content">
                <h3>${marketplace}</h3>
                <p>Торговая площадка</p>
            </div>
            <div class="card-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `).join('');
}

// Выбор маркетплейса
function selectMarketplace(marketplace) {
    window.selectedMarketplace = marketplace;
    window.activeMarketplaceFilter = marketplace;
    
    // Обновляем индикатор шага
    updateStepIndicator(2, true);
    
    // Переходим к следующему шагу
    goToStep(3);
    
    // Загружаем склады для выбранного города и маркетплейса
    loadWarehousesForStep(window.selectedCity, marketplace);
}

// Загрузка складов
function loadWarehousesForStep(city, marketplace) {
    const warehouseGrid = document.getElementById('warehouseGrid');
    
    // Обновляем выбранные параметры в интерфейсе
    document.getElementById('selectedCity2').textContent = city;
    document.getElementById('selectedMarketplace').textContent = marketplace;
    
    fetch(`filter_options.php?action=warehouses&marketplace=${encodeURIComponent(marketplace)}&city=${encodeURIComponent(city)}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.warehouses) {
                renderWarehouseOptions(data.warehouses);
            } else {
                warehouseGrid.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><span>Нет доступных складов</span></div>';
            }
        })
        .catch(err => {
            console.error('Ошибка загрузки складов:', err);
            warehouseGrid.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><span>Ошибка загрузки складов</span></div>';
        });
}

// Отрисовка вариантов складов
function renderWarehouseOptions(warehouses) {
    const warehouseGrid = document.getElementById('warehouseGrid');
    
    if (!warehouses || warehouses.length === 0) {
        warehouseGrid.innerHTML = '<div class="empty-state"><i class="fas fa-warehouse"></i><span>Нет доступных складов</span></div>';
        return;
    }
    
    warehouseGrid.innerHTML = warehouses.map(warehouse => `
        <div class="selection-card warehouse-card" onclick="selectWarehouse('${warehouse}')">
            <div class="card-icon">
                <i class="fas fa-warehouse"></i>
            </div>
            <div class="card-content">
                <h3>${warehouse}</h3>
                <p>Склад назначения</p>
            </div>
            <div class="card-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `).join('');
}

// Выбор склада
function selectWarehouse(warehouse) {
    window.selectedWarehouse = warehouse;
    window.activeDestinationWarehouseFilter = warehouse;
    
    // Обновляем индикатор шага
    updateStepIndicator(3, true);
    
    // Переходим к результатам
    goToStep(4);
    
    // Загружаем результаты
    loadScheduleResults();
}

// Загрузка результатов расписания
function loadScheduleResults() {
    const resultsContainer = document.getElementById('scheduleResults');
    
    // Обновляем выбранные параметры в интерфейсе
    document.getElementById('selectedCity3').textContent = window.selectedCity;
    document.getElementById('selectedMarketplace2').textContent = window.selectedMarketplace;
    document.getElementById('selectedWarehouse').textContent = window.selectedWarehouse;
    
    // Формируем URL с фильтрами
    let url = `schedule.php?archived=0`;
    if (window.selectedMarketplace) {
        url += `&marketplace=${encodeURIComponent(window.selectedMarketplace)}`;
    }
    if (window.selectedCity) {
        url += `&city=${encodeURIComponent(window.selectedCity)}`;
    }
    if (window.selectedWarehouse) {
        url += `&warehouse=${encodeURIComponent(window.selectedWarehouse)}`;
    }
    
    fetch(url)
        .then(r => r.json())
        .then(data => {
            const schedules = Array.isArray(data) ? data : (data.schedules || []);
            renderScheduleResults(schedules);
            updateStepIndicator(4, true);
        })
        .catch(err => {
            console.error('Ошибка загрузки расписания:', err);
            resultsContainer.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><span>Ошибка загрузки расписания</span></div>';
        });
}

// Отрисовка результатов расписания
function renderScheduleResults(schedules) {
    const resultsContainer = document.getElementById('scheduleResults');
    
    if (!schedules || schedules.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>Нет доступных отправлений</h3>
                <p>По выбранным параметрам отправления не найдены</p>
            </div>
        `;
        return;
    }
    
    // Фильтруем актуальные расписания
    const now = new Date();
    const filteredSchedules = schedules.filter(schedule => {
        const deliveryDate = new Date(schedule.delivery_date);
        return deliveryDate >= now && schedule.status !== 'Завершено';
    });
    
    if (filteredSchedules.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <h3>Нет актуальных отправлений</h3>
                <p>Все найденные отправления уже завершены или просрочены</p>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = `
        <div class="results-header">
            <h3>Найдено отправлений: ${filteredSchedules.length}</h3>
        </div>
        <div class="schedule-grid">
            ${filteredSchedules.map(schedule => renderScheduleCard(schedule)).join('')}
        </div>
    `;
}

// Отрисовка карточки расписания
function renderScheduleCard(schedule) {
    const canOrder = canCreateOrderForSchedule(schedule);
    const statusClass = getStatusClass(schedule.status);
    
    return `
        <div class="schedule-card ${canOrder ? 'can-order' : 'cannot-order'}" onclick="openScheduleDetails(${schedule.id})">
            <div class="schedule-header">
                <div class="schedule-route">
                    <i class="fas fa-route"></i>
                    ${schedule.city} → ${schedule.warehouses}
                </div>
                <div class="schedule-status ${statusClass}">
                    ${schedule.status}
                </div>
            </div>
            
            <div class="schedule-info">
                <div class="info-row">
                    <span class="info-label">Д