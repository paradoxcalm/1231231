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

let lastRenderedSchedules = [];

function canCreateOrderForSchedule(schedule) {
    if (!schedule) return false;
    if (schedule.status === 'Завершено' || schedule.status === 'Товар отправлен') return false;

    const deadline = schedule?.accept_deadline;
    if (!deadline) return true;

    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
        return true;
    }

    const now = new Date();
    return now <= deadlineDate;
}

function escapeHtmlAttribute(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

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

function switchTab(tabName) {
    const tabs = ["upcoming"];
    if (document.getElementById("tab-calendar")) {
        tabs.push("calendar");
    }

    tabs.forEach(tab => {
        const content = document.getElementById(`tabContent-${tab}`);
        const button = document.getElementById(`tab-${tab}`);
        if (content) {
            content.style.display = tab === tabName ? "block" : "none";
        }
        if (button) {
            button.classList.toggle("active", tab === tabName);
        }
    });

    if (tabName === "calendar" && document.getElementById("tab-calendar")) {
        if (typeof renderStaticCalendar === "function") {
            renderStaticCalendar();
        }
        if (typeof fetchDataAndUpdateCalendar === "function") {
            fetchDataAndUpdateCalendar();
        }
    }
}

function toggleExcelMenu() {
    const menu = document.getElementById("excelMenu");
    const arrow = document.getElementById("excelArrow");
    const btn = document.getElementById("excelDropdownBtn");

    if (!menu || !arrow || !btn) {
        return;
    }

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
    if (Array.isArray(errors) && errors.length > 0) {
        html += `<p>❌ Ошибки:</p><ul style="padding-left:16px;">`;
        for (const e of errors) {
            html += `<li>Строка ${e.row}: ${e.error}</li>`;
        }
        html += `</ul>`;
    }
    const resultContent = document.getElementById("importResultModalContent");
    const resultModal = document.getElementById("importResultModal");
    if (resultContent) {
        resultContent.innerHTML = html;
    }
    if (resultModal) {
        resultModal.style.display = "block";
    }
}

function showShipmentReport() {
    const modalContent = document.getElementById("shipmentReportText");
    if (!modalContent) return;

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

    const applyBtn = document.getElementById("shipmentFilterApplyBtn");
    if (applyBtn) {
        applyBtn.onclick = reloadShipmentReport;
    }
    reloadShipmentReport();
}

function reloadShipmentReport() {
    const mp = document.getElementById("shipmentFilterMarketplace")?.value || '';
    const ct = document.getElementById("shipmentFilterCity")?.value || '';
    const wh = document.getElementById("shipmentFilterWarehouse")?.value || '';
    const st = document.getElementById("shipmentFilterStatus")?.value || '';
    const dt = document.getElementById("shipmentFilterDate")?.value || '';

    let url = "get_schedules.php";
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

            data.sort((a, b) => {
                const dA = new Date(a.accept_deadline || a.acceptance_end || a.accept_date || 0);
                const dB = new Date(b.accept_deadline || b.acceptance_end || b.accept_date || 0);
                return dA - dB;
            });

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
                    if (s.accept_date !== currentDate) {
                        currentDate = s.accept_date;
                        html += `
                        <tr class="date-group">
                            <td colspan="8" style="text-align:center; color:#36435c;">${currentDate}</td>
                        </tr>
                    `;
                    }

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
            const modal = document.getElementById("shipmentReportModal");
            if (modal) {
                modal.style.display = "block";
            }
        })
        .catch(err => {
            tableBlock.innerHTML = "<p>Ошибка загрузки данных</p>";
            console.error("Ошибка reloadShipmentReport:", err);
        });
}

document.addEventListener("mousedown", event => {
    const menu = document.getElementById("excelMenu");
    const btn = document.getElementById("excelDropdownBtn");

    if (!menu || !btn) return;

    if (!menu.contains(event.target) && !btn.contains(event.target)) {
        menu.classList.remove("show");
        btn.classList.remove("open");
        const arrow = document.getElementById("excelArrow");
        if (arrow) {
            arrow.innerHTML = "▼";
        }
    }
});

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

function goToStep(step) {
    const targetStep = Number(step);
    if (!Number.isFinite(targetStep)) {
        return;
    }

    const stepContents = document.querySelectorAll('.step-content');
    stepContents.forEach(content => {
        const match = content.id?.match(/step-(\d+)/);
        const contentStep = match ? Number(match[1]) : NaN;
        content.classList.toggle('active', contentStep === targetStep);
    });

    const indicatorSteps = document.querySelectorAll('.step-indicator .step');
    indicatorSteps.forEach(stepElement => {
        const stepValue = Number(stepElement.dataset.step);
        const isCurrent = stepValue === targetStep;
        stepElement.classList.toggle('active', isCurrent);

        if (stepValue > targetStep) {
            stepElement.classList.remove('completed');
        }
    });

    window.currentStep = targetStep;
}

function updateStepIndicator(step, completed) {
    const stepNumber = Number(step);
    if (!Number.isFinite(stepNumber)) {
        return;
    }

    const current = Number(window.currentStep) || 1;
    const indicatorSteps = document.querySelectorAll('.step-indicator .step');
    indicatorSteps.forEach(stepElement => {
        const stepValue = Number(stepElement.dataset.step);
        stepElement.classList.toggle('active', stepValue === current);

        if (typeof completed === 'boolean' && stepValue === stepNumber) {
            stepElement.classList.toggle('completed', completed);
        }
    });
}

function resetSteps() {
    window.selectedCity = '';
    window.selectedMarketplace = '';
    window.selectedWarehouse = '';
    window.activeCityFilter = '';
    window.activeWarehouseFilter = '';
    window.activeDestinationWarehouseFilter = '';
    window.activeMarketplaceFilter = '';
    lastRenderedSchedules = [];

    goToStep(1);

    const indicatorSteps = document.querySelectorAll('.step-indicator .step');
    indicatorSteps.forEach(stepElement => stepElement.classList.remove('completed'));
    updateStepIndicator(1, false);

    const valuesToReset = [
        'selectedCity',
        'selectedCity2',
        'selectedCity3',
        'selectedMarketplace',
        'selectedMarketplace2',
        'selectedWarehouse'
    ];
    valuesToReset.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '—';
        }
    });

    const marketplaceGrid = document.getElementById('marketplaceGrid');
    if (marketplaceGrid) {
        marketplaceGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-store"></i>
                <span>Выберите город, чтобы увидеть маркетплейсы</span>
            </div>
        `;
    }

    const warehouseGrid = document.getElementById('warehouseGrid');
    if (warehouseGrid) {
        warehouseGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-warehouse"></i>
                <span>Выберите маркетплейс, чтобы увидеть склады</span>
            </div>
        `;
    }

    const resultsContainer = document.getElementById('scheduleResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-list"></i>
                <h3>Параметры не выбраны</h3>
                <p>Пройдите шаги, чтобы получить список отправлений</p>
            </div>
        `;
    }

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

window.selectCity = selectCity;
window.selectMarketplace = selectMarketplace;
window.selectWarehouse = selectWarehouse;

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
    if (!resultsContainer) return;

    lastRenderedSchedules = [];

    if (!Array.isArray(schedules) || schedules.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>Нет доступных отправлений</h3>
                <p>По выбранным параметрам отправления не найдены</p>
            </div>
        `;
        return;
    }

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

    lastRenderedSchedules = filteredSchedules;

    const cardsHtml = filteredSchedules
        .map(renderScheduleResultCard)
        .join('');

    resultsContainer.innerHTML = `
        <div class="results-header">
            <h3>Найдено отправлений: ${filteredSchedules.length}</h3>
        </div>
        <div class="schedule-grid">
            ${cardsHtml}
        </div>
    `;
}

function renderScheduleResultCard(schedule) {
    if (!schedule) return '';

    const canOrder = typeof canCreateOrderForSchedule === 'function'
        ? canCreateOrderForSchedule(schedule)
        : false;
    const status = schedule.status || '—';
    const route = `${schedule.city || '—'} → ${schedule.warehouses || '—'}`;
    const acceptDate = formatScheduleDateTime(schedule.accept_date, schedule.accept_time);
    const deliveryDate = formatScheduleDateTime(schedule.delivery_date);
    const carInfo = [schedule.car_brand, schedule.car_number].filter(Boolean).join(' ') || '—';
    const driverInfo = schedule.driver_name || '—';
    const statusClass = typeof getStatusClass === 'function'
        ? getStatusClass(schedule.status)
        : '';
    const scheduleIdAttr = escapeHtmlAttribute(schedule?.id ?? '');

    return `
        <div class="schedule-card ${canOrder ? 'can-order' : 'cannot-order'}" data-schedule-id="${scheduleIdAttr}" onclick="openScheduleDetails(this.dataset.scheduleId)">
            <div class="schedule-header">
                <div class="schedule-route">
                    <i class="fas fa-route"></i>
                    ${route}
                </div>
                <div class="schedule-status ${statusClass}">
                    ${status}
                </div>
            </div>
            <div class="schedule-info">
                <div class="info-row">
                    <span class="info-label">Дата приёмки:</span>
                    <span class="info-value">${acceptDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Дата сдачи:</span>
                    <span class="info-value">${deliveryDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Автомобиль:</span>
                    <span class="info-value">${carInfo}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Водитель:</span>
                    <span class="info-value">${driverInfo}</span>
                </div>
                ${canOrder ? '<div class="info-row status-row">Доступно для создания заявки</div>' : ''}
            </div>
        </div>
    `;
}

function formatScheduleDateTime(dateStr, timeStr = '') {
    if (!dateStr) {
        return timeStr || '—';
    }

    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) {
        return [dateStr, timeStr].filter(Boolean).join(' ') || '—';
    }

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();

    return [`${day}.${month}.${year}`, timeStr].filter(Boolean).join(' ');
}

function openScheduleDetails(scheduleId) {
    if (!scheduleId) {
        console.warn('Не удалось открыть отправление: не передан идентификатор.');
        return;
    }

    const normalizedId = String(scheduleId);
    const schedule = lastRenderedSchedules.find(item => String(item?.id ?? '') === normalizedId);

    if (!schedule) {
        console.warn('Не удалось найти отправление с идентификатором', normalizedId);
        return;
    }

    const modalOpener = (window.schedule && typeof window.schedule.openSingleShipmentModal === 'function')
        ? window.schedule.openSingleShipmentModal
        : (typeof window.openSingleShipmentModal === 'function'
            ? window.openSingleShipmentModal
            : null);

    if (!modalOpener) {
        console.error('Функция открытия модального окна отправления недоступна.');
        return;
    }

    modalOpener(schedule);
}

function fetchAndDisplayUpcoming(showArchived = false, statusCategory = 'active') {
    const container = document.getElementById('upcomingList');
    if (!container) return;
    container.innerHTML = 'Загрузка…';

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
        .then(async response => {
            if (!response.ok) {
                throw new Error('Ошибка загрузки: ' + response.status);
            }
            const contentType = response.headers.get('Content-Type') || '';
            if (!contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error('Сервер вернул не JSON: ' + text.slice(0, 200));
            }
            try {
                return await response.json();
            } catch (error) {
                throw new Error('Ошибка парсинга JSON: ' + error.message);
            }
        })
        .then(data => {
            const list = Array.isArray(data?.schedules) ? data.schedules : data;
            if (!Array.isArray(list) || list.length === 0) {
                container.innerHTML = 'Нет расписаний.';
                return;
            }

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const activeList = [];
            const transitList = [];
            const completedList = [];

            list.forEach(item => {
                if (!item?.accept_date || !item?.delivery_date) return;
                const accept = new Date(item.accept_date);
                const deliver = new Date(item.delivery_date);
                if (Number.isNaN(accept) || Number.isNaN(deliver)) return;

                accept.setHours(0, 0, 0, 0);
                deliver.setHours(0, 0, 0, 0);

                if (accept >= now) {
                    activeList.push(item);
                } else if (deliver >= now) {
                    transitList.push(item);
                } else {
                    completedList.push(item);
                }
            });

            let listToDisplay;
            if (statusCategory === 'active') listToDisplay = activeList;
            else if (statusCategory === 'transit') listToDisplay = transitList;
            else listToDisplay = completedList;

            if (window.userRole === 'client' && typeof canCreateOrderForSchedule === 'function') {
                listToDisplay = listToDisplay.filter(canCreateOrderForSchedule);
            }

            if (!listToDisplay.length) {
                container.innerHTML = 'Нет расписаний для выбранной категории.';
                return;
            }

            const grouped = {};
            listToDisplay.forEach(shipment => {
                const dateKey = shipment.accept_date;
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(shipment);
            });

            container.innerHTML = '';
            Object.keys(grouped)
                .sort((a, b) => new Date(a) - new Date(b))
                .forEach(dateKey => {
                    grouped[dateKey].forEach(shipment => {
                        const card = renderScheduleCard(shipment);
                        container.appendChild(card);
                    });
                });
        })
        .catch(error => {
            container.innerHTML = `Ошибка: ${error.message}`;
            console.error('Ошибка fetchAndDisplayUpcoming:', error);
        });
}

function renderScheduleCard(schedule) {
    if (!schedule) {
        const placeholder = document.createElement('div');
        placeholder.className = 'upcoming-item styled-upcoming-item';
        placeholder.textContent = 'Данные расписания недоступны';
        return placeholder;
    }

    const formattedAccept = typeof formatDeliveryDate === 'function'
        ? formatDeliveryDate(schedule.accept_date)
        : (schedule.accept_date || '—');
    const formattedDelivery = typeof formatDeliveryDate === 'function'
        ? formatDeliveryDate(schedule.delivery_date)
        : (schedule.delivery_date || '—');

    let marketplaceClass = '';
    if (schedule.marketplace === 'Ozon') marketplaceClass = 'mp-ozon';
    else if (schedule.marketplace === 'Wildberries') marketplaceClass = 'mp-wb';
    else if (schedule.marketplace === 'YandexMarket') marketplaceClass = 'mp-yandex';

    const canOrder = typeof canCreateOrderForSchedule === 'function'
        ? canCreateOrderForSchedule(schedule)
        : false;

    const card = document.createElement('div');
    card.className = 'upcoming-item styled-upcoming-item';
    if (canOrder) {
        card.classList.add('card-clickable');
    }

    card.innerHTML = `
        <div class="shipment-info">
            <div class="shipment-header" style="display:flex; justify-content:space-between; align-items:center;">
                <span class="shipment-warehouse">${schedule.city || '—'} → ${schedule.warehouses || '—'}</span>
                <span class="shipment-marketplace ${marketplaceClass}">${schedule.marketplace || ''}</span>
            </div>
            <div class="shipment-date-row" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <div class="shipment-sub"><strong>${formattedAccept} → ${formattedDelivery}</strong></div>
                ${canOrder ? '<span class="cta-label">Создать заявку</span>' : ''}
            </div>
        </div>
    `;

    if (canOrder) {
        card.addEventListener('click', () => {
            if (typeof openRequestFormModal === 'function') {
                openRequestFormModal(schedule);
            } else if (window.schedule && typeof window.schedule.openSingleShipmentModal === 'function') {
                window.schedule.openSingleShipmentModal(schedule);
            }
        });
    }

    return card;
}

function filterByCity(cityName) {
    window.activeCityFilter = cityName;
    const buttons = document.querySelectorAll('.city-tab-header .tab-button');
    buttons.forEach(button => {
        const isActive = button.textContent === cityName || (cityName === '' && button.textContent === 'Все');
        button.classList.toggle('active', isActive);
    });
    fetchAndDisplayUpcoming(window.archiveView, window.activeStatusCategory || 'active');
}

function showCreateForm() {
    if (!window.canCreateSchedule) {
        alert('Нет прав!');
        return;
    }

    const modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) return;

    const timeSlots = Array.from({ length: 24 }, (_, index) =>
        `${String(index).padStart(2, '0')}:00-${String((index + 1) % 24).padStart(2, '0')}:00`
    );

    Promise.all([
        fetch('warehouses.php').then(response => response.json()),
        fetch('cities.php', { cache: 'no-store' }).then(response => response.json())
    ])
    .then(([warehouses, cities]) => {
        renderCreateForm(modalContainer, warehouses, cities, timeSlots);
    })
    .catch(error => {
        console.error('Ошибка загрузки данных:', error);
    });

    function renderCreateForm(container, warehouses, cities, slots) {
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.innerHTML = `
            <i class="fas fa-times modal-close" onclick="closeScheduleModal()"></i>
            <div class="modal-header"><h2>Создать отправление</h2></div>
            <div class="modal-body">
                <form id="createScheduleForm">
                    <div class="form-group">
                        <label>Город отправления:</label>
                        <div style="display:flex; gap:10px;">
                            <select name="city" id="citySelect" required>
                                ${cities.map(city => `<option value="${city.id}">${city.name}</option>`).join('')}
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
                            ${warehouses.map(warehouse => `
                                <div class="warehouse-checkbox-item">
                                    <input type="checkbox" name="warehouses[]" value="${warehouse.name}" id="warehouse-${warehouse.name}">
                                    <label for="warehouse-${warehouse.name}" class="warehouse-label">${warehouse.name}</label>
                                </div>
                            `).join('')}
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
                            ${slots.map(slot => `<option value="${slot}">${slot}</option>`).join('')}
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
        container.innerHTML = '';
        container.appendChild(modalContent);
        container.style.display = 'block';
        window.currentModal = container;

        const form = document.getElementById('createScheduleForm');
        const marketplaceSelect = document.getElementById('marketplaceSelect');
        const timeslotField = document.getElementById('timeslotField');

        if (marketplaceSelect && timeslotField) {
            marketplaceSelect.addEventListener('change', () => {
                timeslotField.style.display = marketplaceSelect.value === 'Ozon' ? 'block' : 'none';
            });
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            const formData = new FormData(form);
            const selectedWarehouses = Array.from(form.querySelectorAll('input[name="warehouses[]"]:checked'))
                .map(checkbox => checkbox.value);
            if (selectedWarehouses.length === 0) {
                const errorEl = document.getElementById('createError');
                errorEl.textContent = 'Выберите хотя бы один склад.';
                errorEl.style.display = 'block';
                return;
            }
            selectedWarehouses.forEach((warehouse, index) => {
                formData.append(`warehouses[${index}]`, warehouse);
            });
            formData.append('action', 'create');
            fetch('schedule.php', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(result => {
                    if (result.status === 'success') {
                        if (typeof window.fetchScheduleData === 'function') window.fetchScheduleData();
                        if (typeof window.fetchDataAndUpdateCalendar === 'function') window.fetchDataAndUpdateCalendar();
                        if (typeof closeScheduleModal === 'function') closeScheduleModal();
                    } else {
                        const errorEl = document.getElementById('createError');
                        errorEl.textContent = result.message || 'Ошибка сохранения.';
                        errorEl.style.display = 'block';
                    }
                })
                .catch(error => {
                    console.error('Ошибка createScheduleForm:', error);
                    const errorEl = document.getElementById('createError');
                    errorEl.textContent = 'Ошибка связи с сервером.';
                    errorEl.style.display = 'block';
                });
        });
    }
}

function addNewCity() {
    const name = prompt('Введите название города:');
    if (!name || !name.trim()) return;
    fetch('cities.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name: name.trim() })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showCreateForm();
        } else {
            alert('Ошибка: ' + data.message);
        }
    });
}

function deleteSelectedCity() {
    const select = document.getElementById('citySelect');
    const id = parseInt(select?.value, 10);
    if (!id || Number.isNaN(id)) {
        alert('Сначала выберите город для удаления.');
        return;
    }
    if (!confirm('Удалить выбранный город?')) return;

    fetch('cities.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showCreateForm();
        } else {
            alert('Ошибка: ' + data.message);
        }
    });
}

function addNewWarehouseAndRefresh() {
    const name = prompt('Введите название склада:');
    if (!name || !name.trim()) return;
    fetch('warehouses.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name: name.trim() })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showCreateForm();
        } else {
            alert('Ошибка: ' + data.message);
        }
    });
}

function enterWarehouseEditMode() {
    const checkboxes = document.querySelectorAll('input[name="warehouses[]"]:checked');
    if (checkboxes.length === 0) {
        alert('Сначала выберите склады для редактирования.');
        return;
    }

    checkboxes.forEach(checkbox => {
        const label = checkbox.nextElementSibling;
        const currentName = label.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'edit-input';
        input.dataset.oldName = currentName;
        label.replaceWith(input);
    });

    const controls = document.getElementById('warehouseEditControls');
    if (controls) controls.style.display = 'block';
}

function cancelWarehouseEdits() {
    const inputs = document.querySelectorAll('.edit-input');
    inputs.forEach(input => {
        const name = input.dataset.oldName;
        const label = document.createElement('label');
        label.htmlFor = `warehouse-${name}`;
        label.className = 'warehouse-label';
        label.textContent = name;
        input.replaceWith(label);
    });

    const controls = document.getElementById('warehouseEditControls');
    if (controls) controls.style.display = 'none';
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
        alert('Нет изменений.');
        return;
    }

    fetch('warehouses.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch_edit', edits })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Склады обновлены.');
            showCreateForm();
        } else {
            alert('Ошибка: ' + data.message);
        }
    })
    .catch(error => alert('Ошибка: ' + error.message));
}

function confirmWarehouseDelete() {
    const selected = Array.from(document.querySelectorAll('input[name="warehouses[]"]:checked'))
        .map(checkbox => checkbox.value);

    if (selected.length === 0) {
        alert('Выберите склады для удаления.');
        return;
    }

    if (!confirm(`Удалить ${selected.length} склад(ов)?`)) return;

    fetch('warehouses.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', names: selected })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Удалено.');
            showCreateForm();
        } else {
            alert('Ошибка: ' + data.message);
        }
    })
    .catch(error => alert('Ошибка: ' + error.message));
}

window.loadSchedule = loadSchedule;
window.switchTab = switchTab;
window.toggleExcelMenu = toggleExcelMenu;
window.openImportModal = openImportModal;
window.showImportResultModal = showImportResultModal;
window.showShipmentReport = showShipmentReport;
window.reloadShipmentReport = reloadShipmentReport;
window.fetchAndDisplayUpcoming = fetchAndDisplayUpcoming;
window.renderScheduleCard = renderScheduleCard;
window.filterByCity = filterByCity;
window.showCreateForm = showCreateForm;
window.addNewCity = addNewCity;
window.deleteSelectedCity = deleteSelectedCity;
window.addNewWarehouseAndRefresh = addNewWarehouseAndRefresh;
window.enterWarehouseEditMode = enterWarehouseEditMode;
window.cancelWarehouseEdits = cancelWarehouseEdits;
window.saveWarehouseEdits = saveWarehouseEdits;
window.confirmWarehouseDelete = confirmWarehouseDelete;
window.openScheduleDetails = openScheduleDetails;
window.goToStep = goToStep;
window.updateStepIndicator = updateStepIndicator;
window.resetSteps = resetSteps;
