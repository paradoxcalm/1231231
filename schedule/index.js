// 👤 Пользователь
import {
    state,
    setPermissionFlags,
    setCurrentModal,
    syncWindowFilters
} from './state.js';
import {
    initializeFilters,
    filterByCity,
    updateDestinationWarehouses
} from './filters.js';
import {
    renderStaticCalendar,
    changeMonth,
    fetchDataAndUpdateCalendar
} from './calendar.js';
import {
    fetchAndDisplayUpcoming,
    openSingleShipmentModal,
    setArchiveView
} from './upcoming.js';
import {
    openScheduleManagementModal,
    closeScheduleManagementModal,
    loadManagementSchedules,
    updateStatus,
    massManageSchedules,
    registerManagementCallbacks
} from './management.js';
import {
    addNewWarehouseAndRefresh,
    enterWarehouseEditMode,
    cancelWarehouseEdits,
    saveWarehouseEdits,
    confirmWarehouseDelete,
    addNewWarehouse,
    registerWarehouseCallbacks
} from './warehouses.js';
import {
    openImportModal,
    exportSchedule,
    showImportResultModal
} from './importExport.js';

// === schedule.js ===
//
// Файл, отвечающий за логику расписания:
// - вкладка "Ближайшие отправления" и "Календарь"
// - создание / редактирование расписания
// - функция createOrder не уводит на processing.html, а лишь закрывает окно
//   и вызывает openRequestFormModal (см. requestForm.js).



/**
 * Проверка, можно ли ещё создавать заявку (с учётом accept_deadline, если указано).
 */

function loadSchedule() {
    const dynamicContent = document.getElementById("dynamicContent");
    if (!dynamicContent) return;

    const canViewCalendar = (userRole === "admin");
    const canManageSchedules = (userRole === 'admin' || userRole === 'manager');
    setPermissionFlags({
        canCreate: canManageSchedules,
        canCreateSchedule: canManageSchedules,
        canCreateOrder: userRole !== 'client'
    });
    state.archiveView = false;
    syncWindowFilters();

    const html = `
        <div class="schedule-container">
            <h1 class="section-title">Расписание</h1>
            <div class="tab-header">
                <button class="tab-button active" id="tab-upcoming" onclick="switchTab('upcoming')">Ближайшие отправления</button>
                ${
                    canViewCalendar
                        ? `<button class="tab-button" id="tab-calendar" onclick="switchTab('calendar')">Календарь</button>`
                        : ""
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
            ${ canViewCalendar ? `
            <div class="tab-content" id="tabContent-calendar" style="display: none;">
                <div class="schedule-controls" id="calendarControls">
                    <div class="action-buttons">
                        ${ state.canCreateSchedule ? `
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
            ` : "" }
        </div>
    `;
    dynamicContent.innerHTML = html;

    initializeFilters();

    const toggleArchiveBtn = document.getElementById('toggleArchiveBtn');
    if (toggleArchiveBtn) {
        if (userRole === 'client') {
            toggleArchiveBtn.style.display = 'none';
        } else {
            toggleArchiveBtn.addEventListener('click', () => {
                const nextValue = !state.archiveView;
                setArchiveView(nextValue);
                toggleArchiveBtn.textContent = nextValue ? 'Актив' : 'Архив';
                fetchAndDisplayUpcoming(nextValue);
            });
        }
    }

    if (canViewCalendar) {
        renderStaticCalendar();
        fetchDataAndUpdateCalendar();
    }

    fetchAndDisplayUpcoming();
}









// Функция для обновления склада назначения по выбранному городу





// Открытие/закрытие выпадающего меню Excel
function toggleExcelMenu() {
    const menu = document.getElementById("excelMenu");
    const arrow = document.getElementById("excelArrow");
    const btn = document.getElementById("excelDropdownBtn");

    const opened = menu.classList.toggle("show");
    arrow.innerHTML = opened ? "▲" : "▼";
    btn.classList.toggle("open", opened);
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
    const tabs = ["upcoming"];
    if (document.getElementById("tab-calendar")) tabs.push("calendar");
    tabs.forEach(tab => {
        const el = document.getElementById(`tabContent-${tab}`);
        const btn = document.getElementById(`tab-${tab}`);
        if (el) el.style.display = (tab === tabName) ? "block" : "none";
        if (btn) btn.classList.toggle("active", tab === tabName);
    });

    // ⬇️ ВАЖНО: отрисовать календарь при переходе
    if (tabName === "calendar" && document.getElementById("tab-calendar")) {
        renderStaticCalendar();
        fetchDataAndUpdateCalendar();
    }
}



// Рендерим статический календарь (ячейки)
function onWarehouseChange(value) {
    state.activeWarehouseFilter = value;
    syncWindowFilters();
    fetchDataAndUpdateCalendar();
    fetchScheduleData();
}

function applyFilters() {
    const warehouseSelect = document.getElementById('warehouseFilter');
    const value = warehouseSelect ? warehouseSelect.value : '';
    onWarehouseChange(value);
}

function resetFilters() {
    const warehouseSelect = document.getElementById('warehouseFilter');
    if (warehouseSelect) {
        warehouseSelect.value = '';
    }
    onWarehouseChange('');
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
    setCurrentModal(null);
}

function showCreateForm() {
    if (!state.canCreateSchedule) {
        alert("Нет прав!");
        return;
    }

    const modalContainer = document.getElementById("modalContainer");
    if (!modalContainer) return;

    const timeSlots = Array.from({ length: 24 }, (_, i) =>
        `${String(i).padStart(2, "0")}:00-${String((i + 1) % 24).padStart(2, "0")}:00`
    );

    Promise.all([
        fetch("/admin/api/warehouses.php").then(r => r.json()),
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
                        <div class="modal-inline-row city-actions">
                            <select name="city" id="citySelect" required>
                                ${cities.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}
                            </select>
                            <button
                                type="button"
                                class="primary-button modal-action-button"
                                onclick="addNewCity()"
                                aria-label="Добавить новый город"
                            >
                                <span class="modal-action-button__icon" aria-hidden="true">➕</span>
                                <span class="modal-action-button__text">Добавить город</span>
                            </button>
                            <button
                                type="button"
                                class="danger-button modal-action-button"
                                onclick="deleteSelectedCity()"
                                aria-label="Удалить выбранный город"
                            >
                                <span class="modal-action-button__icon" aria-hidden="true">🗑️</span>
                                <span class="modal-action-button__text">Удалить город</span>
                            </button>
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
                        <div class="modal-inline-actions warehouse-actions">
                            <button
                                type="button"
                                class="primary-button modal-action-button"
                                onclick="addNewWarehouseAndRefresh()"
                                aria-label="Добавить новый склад"
                            >
                                <span class="modal-action-button__icon" aria-hidden="true">➕</span>
                                <span class="modal-action-button__text">Добавить склад</span>
                            </button>
                            <button
                                type="button"
                                class="secondary-button modal-action-button"
                                onclick="enterWarehouseEditMode()"
                                aria-label="Редактировать список складов"
                            >
                                <span class="modal-action-button__icon" aria-hidden="true">✏️</span>
                                <span class="modal-action-button__text">Редактировать</span>
                            </button>
                            <button
                                type="button"
                                class="danger-button modal-action-button"
                                onclick="confirmWarehouseDelete()"
                                aria-label="Удалить выбранные склады"
                            >
                                <span class="modal-action-button__icon" aria-hidden="true">🗑️</span>
                                <span class="modal-action-button__text">Удалить склады</span>
                            </button>
                        </div>
                        <div id="warehouseEditControls" class="modal-inline-actions warehouse-edit-controls">
                            <button
                                type="button"
                                class="primary-button modal-action-button"
                                onclick="saveWarehouseEdits()"
                                aria-label="Сохранить изменения складов"
                            >
                                <span class="modal-action-button__icon" aria-hidden="true">💾</span>
                                <span class="modal-action-button__text">Сохранить изменения</span>
                            </button>
                            <button
                                type="button"
                                class="secondary-button modal-action-button"
                                onclick="cancelWarehouseEdits()"
                                aria-label="Отменить редактирование складов"
                            >
                                <span class="modal-action-button__icon" aria-hidden="true">✖️</span>
                                <span class="modal-action-button__text">Отмена</span>
                            </button>
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
        setCurrentModal(container);

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
        window.addNewWarehouseAndRefresh = addNewWarehouseAndRefresh;
        window.enterWarehouseEditMode = enterWarehouseEditMode;
        window.confirmWarehouseDelete = confirmWarehouseDelete;
        window.saveWarehouseEdits = saveWarehouseEdits;
        window.cancelWarehouseEdits = cancelWarehouseEdits;
    }
}





// ========== INLINE РЕДАКТИРОВАНИЕ СКЛАДОВ ==========

function editSchedule(id) {
    if (!state.canCreateSchedule) {
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
            fetch("/admin/api/warehouses.php")
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
                    setCurrentModal(modalContainer);
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
            fetchAndDisplayUpcoming(state.archiveView); // 🔁 обновляем список
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


function completeSchedule(id) {
    if (!state.canCreateSchedule) {
        alert("Нет прав!");
        return;
    }
    if (!confirm("Завершить запись?")) return;
    updateStatus(id, "Завершено");
}
// Экспорт
function fetchScheduleData() {
    // если нужно, можно здесь перезапрашивать schedule.php и обновлять экран
    // или вызывать fetchAndUpdateCalendar()
}
/**
 * Главное изменение: мы не переходим на "processing.html",
 * а просто закрываем модалку (или можем открыть нужный раздел).
 */
function createOrder(scheduleId, city, warehouse, marketplace) {
    // Вместо перехода на processing.html,
    // вызываем нашу функцию из requestForm.js
    closeScheduleModal(); // если было открыто окно расписания
    openRequestFormModal({ id: scheduleId, city, warehouses: warehouse, marketplace });
}

function openShipmentsForDate(date) {
    const statusParam = state.activeStatusFilter ? `&status=${encodeURIComponent(state.activeStatusFilter)}` : "";
    fetch(`schedule.php?combinedDate=${encodeURIComponent(date)}&archived=${state.archiveView ? 1 : 0}`
          + (state.activeMarketplaceFilter ? `&marketplace=${encodeURIComponent(state.activeMarketplaceFilter)}` : "")
          + (state.activeCityFilter ? `&city=${encodeURIComponent(state.activeCityFilter)}` : "")
          + (state.activeWarehouseFilter ? `&warehouse=${encodeURIComponent(state.activeWarehouseFilter)}` : "")
          + statusParam)
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

registerWarehouseCallbacks({ showCreateForm });
registerManagementCallbacks({ fetchScheduleData });

const scheduleGlobalBindings = {
    loadSchedule,
    switchTab,
    showCreateForm,
    toggleExcelMenu,
    exportSchedule,
    openImportModal,
    openScheduleManagementModal,
    closeScheduleManagementModal,
    showShipmentReport,
    reloadShipmentReport,
    changeMonth,
    onWarehouseChange,
    applyFilters,
    resetFilters,
    openShipmentsForDate,
    closeScheduleModal,
    openSingleShipmentModal,
    createOrder,
    editSchedule,
    deleteSchedule,
    archiveSchedule,
    addNewWarehouseAndRefresh,
    enterWarehouseEditMode,
    confirmWarehouseDelete,
    saveWarehouseEdits,
    cancelWarehouseEdits,
    addNewWarehouse,
    massManageSchedules,
    updateStatus,
    fetchAndDisplayUpcoming,
    showImportResultModal,
    loadManagementSchedules,
    filterByCity,
    updateDestinationWarehouses
};

Object.assign(window, scheduleGlobalBindings);

export {
    loadSchedule,
    switchTab,
    showCreateForm,
    toggleExcelMenu,
    exportSchedule,
    openImportModal,
    openScheduleManagementModal,
    closeScheduleManagementModal,
    showShipmentReport,
    reloadShipmentReport,
    changeMonth,
    onWarehouseChange,
    applyFilters,
    resetFilters,
    openShipmentsForDate,
    closeScheduleModal,
    openSingleShipmentModal,
    createOrder,
    editSchedule,
    deleteSchedule,
    archiveSchedule,
    addNewWarehouseAndRefresh,
    enterWarehouseEditMode,
    confirmWarehouseDelete,
    saveWarehouseEdits,
    cancelWarehouseEdits,
    addNewWarehouse,
    massManageSchedules,
    updateStatus,
    fetchAndDisplayUpcoming,
    showImportResultModal,
    loadManagementSchedules,
    filterByCity,
    updateDestinationWarehouses
};
