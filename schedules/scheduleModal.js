/*
 * scheduleModal.js
 *
 * Модуль, управляющий модальными окнами, связанными с расписанием.
 * Здесь находятся функции для отображения подробной информации
 * об отправлении, редактирования расписания, удаления и архивирования,
 * а также проверки возможности создания заявки.
 *
 * Функции экспортируются через window, чтобы их можно было вызывать
 * из других частей приложения.
 */

// Закрывает текущее модальное окно и очищает его содержимое.
function closeScheduleModal() {
    const modal = document.getElementById("modalContainer");
    if (modal) {
        modal.style.display = "none";
        modal.innerHTML = "";
    }
    window.currentModal = null;
}

// Открывает модальное окно с подробной информацией об одном отправлении.
// Отображает маршрут, даты, автомобиль и водителя, маркетплейс, тайм‑слот,
// позволяет создать заявку (если разрешено), изменить статус, редактировать
// и удалить запись (для админа/менеджера).
function openSingleShipmentModal(sh) {
    const modalContainer = document.getElementById("modalContainer");
    if (!modalContainer) return;

    // Очищаем и показываем модалку
    modalContainer.innerHTML = "";
    modalContainer.style.display = "block";

    const role = window.userRole || 'client';
    const canEdit = role === 'admin' || role === 'manager';
    const canOrder = canCreateOrderForSchedule(sh);

    // Генерируем список статусов из константы
    const statusOptions = (window.SCHEDULE_STATUSES || []).map(s =>
        `<option value="${s}" ${sh.status === s ? 'selected' : ''}>${s}</option>`
    ).join("");

    // Создаём HTML содержимое
    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    modalContent.innerHTML = `
        <h2>Отправление №${sh.id || '—'}</h2>
        <h3>Информация об отправлении</h3>
        <p>Город отправления: ${sh.city || "—"}</p>
        <p>Склад назначения: ${sh.warehouses || "—"}</p>
        <p>Дата приёмки: ${sh.accept_date || "—"}</p>
        <p>Время приёмки: ${sh.accept_time || "—"}</p>
        <p>Дата сдачи: ${sh.delivery_date || "—"}</p>
        <p>Приёмка до: ${sh.accept_deadline || "—"}</p>
        <p>Маркетплейс: ${sh.marketplace || "—"}</p>
        <h3>Авто и водитель</h3>
        <p>Авто: ${sh.car_number || "—"} (${sh.car_brand || "—"})</p>
        <p>Водитель: ${sh.driver_name || "—"}</p>
        <p>Телефон: ${sh.driver_phone || "—"}</p>

        ${
            canOrder
                ? `<button onclick="createOrder(${sh.id}, '${sh.city}', '${sh.warehouses}', '${sh.marketplace}')">Создать заявку</button>`
                : `<p>Приём заявок закрыт</p>`
        }

        ${
            canEdit
                ? `
            <label>Изменить статус:</label>
            <select onchange="updateStatus(${sh.id}, this.value)">
                ${statusOptions}
            </select>
            <br/>
            <button onclick="editSchedule(${sh.id})">Редактировать</button>
            <button onclick="deleteSchedule(${sh.id})">Удалить</button>
        `
                : ""
        }
    `;

    modalContainer.appendChild(modalContent);
    window.currentModal = modalContainer;
}

// Проверяет, можно ли клиенту создать заявку на выбранное расписание.
// Отказ, если статус «Завершено» или «Товар отправлен», либо если истёк срок приёмки.
function canCreateOrderForSchedule(schedule) {
    if (!schedule) return false;
    if (schedule.status === 'Завершено' || schedule.status === 'Товар отправлен') return false;

    const deadline = schedule.accept_deadline;
    if (!deadline) return true;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    return now <= deadlineDate;
}

// Генерирует HTML‑фрагмент для краткой карточки отправления (используется в календаре).
function renderShipmentDetailsHTML(sh) {
    const role = typeof userRole !== 'undefined'
        ? userRole
        : (window.userRole || 'client');
    const canEdit = role === "admin" || role === "manager";
    const statusOptions = (window.SCHEDULE_STATUSES || []).map(s =>
        `<option value="${s}" ${sh.status === s ? 'selected' : ''}>${s}</option>`
    ).join("");
    return `
        <p>🚚 ${sh.city} → ${sh.warehouses}</p>
        <p>Дата сдачи: ${sh.delivery_date || '—'}</p>
        <p>Дата приёмки: ${sh.accept_date || '—'} ${sh.accept_time || ''}</p>
        <p>Автомобиль: ${sh.car_brand || '—'} ${sh.car_number || '—'}</p>
        <p>Водитель: ${sh.driver_name || '—'} (${sh.driver_phone || '—'})</p>
        <p>Маркетплейс: ${sh.marketplace || '—'}</p>
        <p>Таймслот: ${sh.timeslot || '—'}</p>
        <p>Статус: ${sh.status || '—'}</p>
        ${
            canEdit
                ? `
            <label>Изменить статус:</label>
            <select onchange="updateStatus(${sh.id}, this.value)">
                ${statusOptions}
            </select>
            <br/>
            <button onclick="editSchedule(${sh.id})">✏️ Редактировать</button>
            <button onclick="deleteSchedule(${sh.id})">🗑️ Удалить</button>
        `
                : ""
        }
    `;
}

// Открывает форму редактирования отправления. Загрузка данных с сервера,
// вывод полей для редактирования, отправка изменений. Для админа/менеджера.
function editSchedule(id) {
    if (!window.canCreateSchedule) {
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

            // Используем глобальные тайм‑слоты или генерируем по часам
            const timeSlots = Array.isArray(window.TIME_SLOTS) && window.TIME_SLOTS.length > 0
                ? window.TIME_SLOTS
                : Array.from({ length: 24 }, (_, i) =>
                    `${String(i).padStart(2, "0")}:00-${String((i + 1) % 24).padStart(2, "0")}:00`
                );

            // Загружаем список складов
            fetch("warehouses.php")
                .then(r2 => {
                    if (!r2.ok) throw new Error("Ошибка складов: " + r2.status);
                    return r2.json();
                })
                .then(warehouses => {
                    const selectedWarehouses = sh.warehouses ? sh.warehouses.split(",").map(s => s.trim()) : [];

                    // Формируем HTML формы
                    const modalContent = document.createElement("div");
                    modalContent.className = "modal-content";

                    // Генерируем список чекбоксов для складов
                    const warehousesHTML = (warehouses || []).map(wh => {
                        const checked = selectedWarehouses.includes(wh.name) ? "checked" : "";
                        return `
                            <label>
                                <input type="checkbox" name="warehouses[]" value="${wh.name}" ${checked}/>
                                ${wh.name}
                            </label>
                        `;
                    }).join("");

                    // Список статусов
                    const statusOpts = (window.SCHEDULE_STATUSES || []).map(s =>
                        `<option value="${s}" ${sh.status === s ? 'selected' : ''}>${s}</option>`
                    ).join("");

                    // Варианты маркетплейсов
                    const mpOptions = (window.MARKETPLACES || ["Wildberries", "Ozon", "YandexMarket"]).map(mp =>
                        `<option value="${mp}" ${sh.marketplace === mp ? 'selected' : ''}>${mp}</option>`
                    ).join("");

                    // Варианты тайм‑слотов
                    const timeslotOptions = timeSlots.map(slot =>
                        `<option value="${slot}" ${sh.timeslot === slot ? 'selected' : ''}>${slot}</option>`
                    ).join("");

                    modalContent.innerHTML = `
                        <h2>Редактировать отправление #${sh.id}</h2>
                        <form id="editScheduleForm">
                            <label>Город:</label>
                            <input type="text" name="city" value="${sh.city || ''}" required />

                            <label>Дата приёма:</label>
                            <input type="date" name="accept_date" value="${sh.accept_date || ''}" required />

                            <label>Время приёма:</label>
                            <select name="accept_time">
                                ${timeSlots.map(slot => `<option value="${slot}" ${slot === sh.accept_time ? 'selected' : ''}>${slot}</option>`).join("")}
                            </select>

                            <label>Дата сдачи:</label>
                            <input type="date" name="delivery_date" value="${sh.delivery_date || ''}" required />

                            <label>Склады:</label>
                            <div class="warehouse-checkboxes">
                                ${warehousesHTML}
                            </div>
                            <button type="button" onclick="addNewWarehouse('editScheduleForm')">Добавить склад</button>

                            <label>Маркетплейс:</label>
                            <select name="marketplace" id="marketplaceSelectEdit">
                                ${mpOptions}
                            </select>

                            <div id="timeslotFieldEdit" style="${sh.marketplace === 'Ozon' ? '' : 'display:none;'}">
                                <label>Тайм‑слот (для Ozon):</label>
                                <select name="timeslot">
                                    ${timeslotOptions}
                                </select>
                            </div>

                            <label>Статус:</label>
                            <select name="status">
                                ${statusOpts}
                            </select>

                            <label>Номер автомобиля:</label>
                            <input type="text" name="car_number" value="${sh.car_number || ''}" />

                            <label>ФИО водителя:</label>
                            <input type="text" name="driver_name" value="${sh.driver_name || ''}" />

                            <label>Номер телефона водителя:</label>
                            <input type="text" name="driver_phone" value="${sh.driver_phone || ''}" />

                            <label>Марка машины:</label>
                            <input type="text" name="car_brand" value="${sh.car_brand || ''}" />

                            <label>Окончание приёмки (deadline):</label>
                            <input type="datetime-local" name="accept_deadline" value="${sh.accept_deadline || ''}" />

                            <div id="editError" style="display:none;color:red"></div>

                            <button type="submit">Сохранить</button>
                            <button type="button" onclick="deleteSchedule(${sh.id})">Удалить</button>
                        </form>
                    `;
                    modalContainer.innerHTML = "";
                    modalContainer.appendChild(modalContent);
                    modalContainer.style.display = "block";
                    window.currentModal = modalContainer;

                    // Показываем/скрываем поле тайм‑слота в зависимости от выбора маркетплейса
                    const marketSel = document.getElementById("marketplaceSelectEdit");
                    const timeslotField = document.getElementById("timeslotFieldEdit");
                    if (marketSel && timeslotField) {
                        marketSel.addEventListener("change", () => {
                            timeslotField.style.display = marketSel.value === "Ozon" ? "block" : "none";
                        });
                    }

                    // Сохраняем изменения
                    const editForm = document.getElementById("editScheduleForm");
                    editForm.addEventListener("submit", e => {
                        e.preventDefault();
                        const formData = new FormData(editForm);
                        // Собираем выбранные склады
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
                                    if (typeof fetchScheduleData === 'function') fetchScheduleData();
                                    if (typeof fetchDataAndUpdateCalendar === 'function') fetchDataAndUpdateCalendar();
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

// Удаляет расписание. Запрашивает подтверждение, отправляет запрос и обновляет список.
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
            if (typeof fetchAndDisplayUpcoming === 'function') fetchAndDisplayUpcoming(window.archiveView);
        } else {
            alert("Ошибка: " + data.message);
        }
    })
    .catch(err => {
        alert("Ошибка сети: " + err.message);
    });
}

// Отправляет расписание в архив. Запрашивает подтверждение, отправляет запрос и обновляет данные.
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
            if (typeof loadManagementSchedules === 'function') loadManagementSchedules();
            if (typeof fetchDataAndUpdateCalendar === 'function') fetchDataAndUpdateCalendar();
        } else {
            const msg = data.results && data.results[id] && data.results[id].message
                ? data.results[id].message
                : 'Ошибка архивации';
            alert(msg);
        }
    })
    .catch(err => {
        alert("Ошибка сети: " + err.message);
    });
}

// Создаёт заявку на отправление. Закрывает текущую модалку и открывает форму заявки.
function createOrder(scheduleId, city, warehouse, marketplace) {
    closeScheduleModal(); // закрываем окно расписания
    if (typeof openRequestFormModal === 'function') {
        openRequestFormModal({ id: scheduleId, city, warehouses: warehouse, marketplace });
    }
}

// Экспортируем функции в глобальный объект window, чтобы они были доступны из HTML и других модулей.
window.closeScheduleModal = closeScheduleModal;
window.openSingleShipmentModal = openSingleShipmentModal;
window.canCreateOrderForSchedule = canCreateOrderForSchedule;
window.renderShipmentDetailsHTML = renderShipmentDetailsHTML;
window.editSchedule = editSchedule;
window.deleteSchedule = deleteSchedule;
window.archiveSchedule = archiveSchedule;
window.createOrder = createOrder;
