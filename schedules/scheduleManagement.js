/*
 * scheduleManagement.js
 *
 * Модуль для администраторов и менеджеров: управление отправлениями.
 * Содержит функции для открытия/закрытия модального окна управления,
 * загрузки и фильтрации списка расписаний, изменения статусов,
 * экспорта, добавления складов, массовых операций (удаление/архивирование)
 * и вспомогательные функции вывода сообщений.
 */


const { parseJSONResponse, handleError } = window.scheduleUtils;

// Открывает модальное окно управления расписаниями и загружает данные.
function openScheduleManagementModal() {
    const modal = document.getElementById("scheduleManagementModal");
    if (!modal) return;
    modal.style.display = "block";
    loadManagementSchedules();
}

// Закрывает модальное окно управления расписаниями.
function closeScheduleManagementModal() {
    const modal = document.getElementById("scheduleManagementModal");
    if (modal) modal.style.display = "none";
}

// Загружает фильтры и инициализирует таблицу расписаний.
function loadManagementSchedules() {
    const block = document.getElementById("managementScheduleList");
    if (!block) return;

    // Формируем базовую разметку фильтров, таблицы и массовых операций
    block.innerHTML = `
        <div class="mgmt-filters">
            <label for="mgmtFilterMarketplace">Маркетплейс</label>
            <select id="mgmtFilterMarketplace">
                <option value="">Все</option>
            </select>
            <label for="mgmtFilterCity">Город</label>
            <select id="mgmtFilterCity">
                <option value="">Все</option>
            </select>
            <label for="mgmtFilterWarehouse">Склад</label>
            <select id="mgmtFilterWarehouse">
                <option value="">Все</option>
            </select>
            <button id="mgmtFilterApplyBtn">Применить</button>
        </div>
        <div id="mgmtSchedulesTable" class="mgmt-table"></div>
        <div class="mass-controls">
            <input type="checkbox" id="selectAllSchedules"> <label for="selectAllSchedules">Выбрать все</label>
            <button id="btnMassDelete">Удалить выбранные</button>
            <button id="btnMassArchive">Архивировать выбранные</button>
            <div id="massManageMessages"></div>
        </div>
    `;

    // Загружаем списки для фильтров
    fetch("filter_options.php?action=marketplaces")
        .then(parseJSONResponse)
        .then(data => {
            const sel = document.getElementById("mgmtFilterMarketplace");
            if (sel) {
                sel.innerHTML = `<option value="">Все</option>` +
                    (data.marketplaces || []).map(mp => `<option value="${mp}">${mp}</option>`).join("");
            }
        });

    fetch("filter_options.php?action=all_cities")
        .then(parseJSONResponse)
        .then(data => {
            const sel = document.getElementById("mgmtFilterCity");
            if (sel) {
                sel.innerHTML = `<option value="">Все</option>` +
                    (data.cities || []).map(c => `<option value="${c}">${c}</option>`).join("");
            }
        });

    fetch("filter_options.php?action=all_warehouses")
        .then(parseJSONResponse)
        .then(data => {
            const sel = document.getElementById("mgmtFilterWarehouse");
            if (sel) {
                sel.innerHTML = `<option value="">Все</option>` +
                    (data.warehouses || []).map(w => `<option value="${w}">${w}</option>`).join("");
            }
        });

    // Кнопка "Применить" перезагружает список расписаний
    document.getElementById("mgmtFilterApplyBtn").onclick = reloadManagementSchedules;

    // Массовые действия
    document.getElementById("btnMassDelete").onclick = () => massManageSchedules('delete');
    document.getElementById("btnMassArchive").onclick = () => massManageSchedules('archive');

    // Выбор всех чекбоксов
    document.getElementById("selectAllSchedules").addEventListener("change", (e) => {
        const checked = e.target.checked;
        document.querySelectorAll(".schedule-checkbox").forEach(cb => { cb.checked = checked; });
    });

    // Загрузка начального списка
    reloadManagementSchedules();
}

// Загружает и отображает расписания с учётом выбранных фильтров.
function reloadManagementSchedules() {
    const mp = document.getElementById("mgmtFilterMarketplace")?.value || '';
    const ct = document.getElementById("mgmtFilterCity")?.value || '';
    const wh = document.getElementById("mgmtFilterWarehouse")?.value || '';
    let url = "schedule.php?archived=0";
    if (mp) url += "&marketplace=" + encodeURIComponent(mp);
    if (ct) url += "&city=" + encodeURIComponent(ct);
    if (wh) url += "&warehouse=" + encodeURIComponent(wh);

    const tableBlock = document.getElementById("mgmtSchedulesTable");
    if (!tableBlock) return;
    tableBlock.innerHTML = "Загрузка…";

    fetch(url)
        .then(parseJSONResponse)
        .then(data => {
            if (!Array.isArray(data)) {
                tableBlock.innerHTML = "Ошибка загрузки расписаний";
                return;
            }
            // Сортируем по окончанию приёмки (раньше – выше)
            data.sort((a, b) => {
                const dA = new Date(a.accept_deadline || a.accept_date || 0);
                const dB = new Date(b.accept_deadline || b.accept_date || 0);
                return dA - dB;
            });

            // Строим таблицу
            let html = `
                <table class="mgmt-table-inner">
                    <thead>
                        <tr>
                            <th></th>
                            <th>№</th>
                            <th>Откуда → Куда</th>
                            <th>Приёмка</th>
                            <th>Сдача</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            data.forEach(s => {
                const statusOptions = (window.SCHEDULE_STATUSES || []).map(st =>
                    `<option value="${st}" ${s.status === st ? "selected" : ""}>${st}</option>`
                ).join("");
                html += `
                    <tr id="schedule_item_${s.id}">
                        <td><input type="checkbox" class="schedule-checkbox" value="${s.id}"></td>
                        <td>${s.id}</td>
                        <td>${s.city || '—'} → ${s.warehouses || '—'}</td>
                        <td>${s.accept_date || '—'}${s.accept_time ? ' ' + s.accept_time : ''}</td>
                        <td>${s.delivery_date || '—'}</td>
                        <td>
                            <select onchange="updateStatus(${s.id}, this.value)">
                                ${statusOptions}
                            </select>
                        </td>
                        <td>
                            <button onclick="deleteSchedule(${s.id})">Удалить</button>
                            <button onclick="archiveSchedule(${s.id})">Архивировать</button>
                        </td>
                    </tr>
                `;
            });
            html += `
                    </tbody>
                </table>
            `;
            tableBlock.innerHTML = html;

            // Обновляем селект "Выбрать все"
            const selectAll = document.getElementById("selectAllSchedules");
            if (selectAll) {
                selectAll.checked = false;
                selectAll.addEventListener("change", () => {
                    const checked = selectAll.checked;
                    document.querySelectorAll(".schedule-checkbox").forEach(cb => { cb.checked = checked; });
                });
            }
        })
        .catch(err => {
            handleError(err, "Ошибка reloadManagementSchedules");
            tableBlock.innerHTML = "Ошибка загрузки расписаний";
        });
}

// Обновляет статус одного расписания. Доступно только администратору/менеджеру.
function updateStatus(id, status) {
    const realRole = typeof userRole !== 'undefined' ? userRole : (window.userRole || 'client');
    if (realRole !== 'admin' && realRole !== 'manager') {
        alert("Нет прав!");
        return;
    }
    fetch("schedule.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", id, status })
    })
    .then(parseJSONResponse)
    .then(d => {
        if (d.status === "success") {
            // Обновляем списки
            reloadManagementSchedules();
            if (typeof fetchDataAndUpdateCalendar === 'function') fetchDataAndUpdateCalendar();
        } else {
            alert("Ошибка: " + d.message);
        }
    })
    .catch(err => handleError(err, "Ошибка updateStatus"));
}

// Помечает расписание как завершённое.
function completeSchedule(id) {
    if (!window.canCreateSchedule) {
        alert("Нет прав!");
        return;
    }
    if (!confirm("Завершить запись?")) return;
    updateStatus(id, "Завершено");
}

// Экспортирует расписания в Excel.
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
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "schedule.xls";
        a.click();
        window.URL.revokeObjectURL(url);
    })
    .catch(err => handleError(err, "Ошибка exportSchedule"));
}

// Загружает склады в фильтр. Используется в некоторых местах интерфейса.
function loadWarehousesForFilter() {
    const select = document.getElementById("warehouseFilter");
    if (!select) {
        console.warn("Элемент #warehouseFilter не найден в DOM");
        return;
    }
    fetch("warehouse_filter.php", { cache: "no-store" })
        .then(parseJSONResponse)
        .then(data => {
            if (!Array.isArray(data)) {
                handleError(new Error("warehouse_filter.php вернул некорректный формат"), "Ошибка загрузки складов");
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
        .catch(err => handleError(err, "Ошибка загрузки складов"));
}

// Добавляет новый склад и обновляет списки складов.
function addNewWarehouse(formId) {
    const name = prompt("Введите название склада:");
    if (!name || !name.trim()) return;
    fetch("warehouses.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name: name.trim() })
    })
    .then(parseJSONResponse)
    .then(d => {
        if (d.status === "success") {
            loadWarehousesForFilter();
            // Обновляем чекбоксы складов в форме редактирования, если нужно
            fetch("warehouses.php")
                .then(parseJSONResponse)
                .then(warehouses => {
                    const container = document.querySelector(`#${formId} .warehouse-checkboxes`);
                    if (container) {
                        container.innerHTML = (warehouses || []).map(wh => {
                            return `
                                <label>
                                    <input type="checkbox" name="warehouses[]" value="${wh.name}" />
                                    ${wh.name}
                                </label>
                            `;
                        }).join("");
                    }
                })
                .catch(err2 => handleError(err2, "Ошибка обновления списков складов"));
        } else {
            alert("Ошибка: " + d.message);
        }
    })
    .catch(err => handleError(err, "Ошибка addNewWarehouse"));
}

// Загружает данные расписания (заглушка, можно расширить при необходимости).
function fetchScheduleData() {
    // Вы можете перезапрашивать schedule.php и обновлять интерфейс.
    reloadManagementSchedules();
}

/**
 * Массовое удаление/архивирование выбранных расписаний.
 * @param {'delete'|'archive'} action
 */
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

    // Блокируем кнопки и очищаем сообщения
    const btnDelete  = document.getElementById('btnMassDelete');
    const btnArchive = document.getElementById('btnMassArchive');
    const msgBox     = document.getElementById('massManageMessages');
    btnDelete.disabled = btnArchive.disabled = true;
    msgBox.innerHTML = '';

    fetch("mass_update_schedule.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(parseJSONResponse)
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
                'Некоторые расписания не обработаны: ' + blocked.join(', ')
            );
        } else {
            showMassManageMessage('success', 'Все выбранные расписания успешно обработаны');
        }

        // Обновляем списки
        reloadManagementSchedules();
        if (typeof fetchDataAndUpdateCalendar === 'function') fetchDataAndUpdateCalendar();
    })
    .catch(err => {
        handleError(err, "Ошибка massManageSchedules");
        showMassManageMessage('error', `Ошибка запроса: ${err.message}`);
    })
    .finally(() => {
        btnDelete.disabled = btnArchive.disabled = false;
    });
}

// Выводит сообщение для массовых операций.
function showMassManageMessage(type, htmlText) {
    const msgBox = document.getElementById('massManageMessages');
    if (!msgBox) return;
    msgBox.innerHTML = htmlText;
}

// Экспортируем функции в глобальный объект window
window.openScheduleManagementModal = openScheduleManagementModal;
window.closeScheduleManagementModal = closeScheduleManagementModal;
window.loadManagementSchedules = loadManagementSchedules;
window.reloadManagementSchedules = reloadManagementSchedules;
window.updateStatus = updateStatus;
window.completeSchedule = completeSchedule;
window.exportSchedule = exportSchedule;
window.loadWarehousesForFilter = loadWarehousesForFilter;
window.addNewWarehouse = addNewWarehouse;
window.fetchScheduleData = fetchScheduleData;
window.massManageSchedules = massManageSchedules;
window.showMassManageMessage = showMassManageMessage;
