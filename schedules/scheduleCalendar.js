/*
 * scheduleCalendar.js
 *
 * Модуль, отвечающий за отрисовку календаря расписания. Содержит
 * функции для генерации ячеек месяца, подгрузки данных о
 * отправлениях для отображения точек и всплывающих списков, а также
 * управление месяцами. Код основан на исходном schedule.js.
 */

// Отрисовывает статический календарь на текущий месяц. Создаёт ячейки
// для предыдущих и последующих месяцев, чтобы заполнить сетку 6×7.
function renderStaticCalendar() {
    const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];
    const currentMonthYearElem = document.getElementById("currentMonthYear");
    if (currentMonthYearElem) {
        currentMonthYearElem.textContent = `${monthNames[calendarCurrentDate.getMonth()]} ${calendarCurrentDate.getFullYear()}`;
    }
    const calendarGrid = document.getElementById("calendarGrid");
    if (!calendarGrid) return;
    calendarGrid.innerHTML = "";
    // Первый и последний день текущего месяца
    const firstDay = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth(), 1);
    const lastDay = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() + 1, 0);
    // День недели первого дня (Sunday=0 → 7)
    const startDay = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
    // Заполняем последние дни предыдущего месяца
    const prevMonthLast = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth(), 0).getDate();
    for (let i = 1; i < startDay; i++) {
        const dayNum = prevMonthLast - (startDay - i) + 1;
        const cell = document.createElement("div");
        cell.className = "calendar-cell other-month";
        cell.textContent = dayNum;
        calendarGrid.appendChild(cell);
    }
    // Заполняем дни текущего месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const fullDate = `${calendarCurrentDate.getFullYear()}-${String(calendarCurrentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const cell = document.createElement("div");
        const isToday = isDateToday(fullDate);
        cell.className = isToday ? "calendar-cell today" : "calendar-cell";
        cell.setAttribute("data-date", fullDate);
        cell.innerHTML = `<div class="cell-date">${day}</div>`;
        calendarGrid.appendChild(cell);
    }
    // Заполняем дни следующего месяца до 42 ячеек
    const nextMonthDate = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() + 1, 1);
    let nextDay = 1;
    while (calendarGrid.children.length < 42) {
        const fullNextDate = getFullDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), nextDay);
        const cell = document.createElement("div");
        cell.className = "calendar-cell other-month";
        cell.setAttribute("data-date", fullNextDate);
        cell.innerHTML = `<div class="cell-date">${nextDay}</div>`;
        calendarGrid.appendChild(cell);
        nextDay++;
    }
}

// Загружает данные расписаний и обновляет календарь. Если выбран фильтр по складу,
// отправляется в запросе. Использует updateCalendarWithData() для перерисовки.
function fetchDataAndUpdateCalendar() {
    const url = `schedule.php${window.activeWarehouseFilter ? `?warehouse=${encodeURIComponent(window.activeWarehouseFilter)}` : ""}`;
    fetch(url)
        .then(r => {
            if (!r.ok) throw new Error("Ошибка загрузки расписания: " + r.status);
            return r.json();
        })
        .then(data => {
            const shipmentsByDate = {};
            (Array.isArray(data) ? data : data.schedules || []).forEach(item => {
                const d = item.accept_date;
                if (!shipmentsByDate[d]) shipmentsByDate[d] = [];
                shipmentsByDate[d].push(item);
            });
            updateCalendarWithData(shipmentsByDate);
        })
        .catch(err => console.error("Ошибка при fetchDataAndUpdateCalendar:", err));
}

// Обновляет каждую ячейку календаря с учётом данных о расписаниях.
// Рисует цветные точки и метки, назначает обработчики клика.
function updateCalendarWithData(shipmentsByDate) {
    const cells = document.querySelectorAll(".calendar-cell");
    cells.forEach(cell => {
        const date = cell.getAttribute("data-date");
        const shipments = shipmentsByDate[date] || [];
        // очищаем содержимое ячейки, оставляя только номер дня
        const dayNum = date.split("-")[2];
        cell.innerHTML = `<div class="cell-date">${parseInt(dayNum, 10)}</div>`;
        // если есть отправления — рисуем точку и подпись
        if (shipments.length > 0) {
            const firstWh = shipments[0].warehouses || "—";
            const labelText = shipments.length === 1 ? firstWh : `${firstWh} +${shipments.length - 1}`;
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
        // Назначаем обработчик: при клике открываем список отправлений на эту дату
        const newCell = cell.cloneNode(true);
        newCell.addEventListener("click", () => openShipmentsForDate(date));
        cell.replaceWith(newCell);
    });
}

// Возвращает цвет точки в календаре в зависимости от статуса расписания.
function getStatusDotColor(status) {
    const s = status.toLowerCase();
    if (s.includes("пути")) return "yellow";
    if (s.includes("ожидан")) return "green";
    if (s.includes("возврат")) return "red";
    return "gray";
}

// Переключает месяц календаря на offset месяцев (например, -1 или +1).
function changeMonth(offset) {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + offset);
    renderStaticCalendar();
    fetchDataAndUpdateCalendar();
}

// Обработчик изменения фильтра склада для календаря. Перерисовывает календарь
// и запрашивает новые данные.
function onWarehouseChange(value) {
    window.activeWarehouseFilter = value;
    fetchDataAndUpdateCalendar();
    if (typeof fetchScheduleData === 'function') fetchScheduleData();
}

// Открывает список отправлений на конкретную дату в модальном окне.
// Загружает расписания на эту дату и отображает их с возможностью перехода
// к подробной карточке.
function openShipmentsForDate(date) {
    // Получаем модальный контейнер
    const modalContainer = document.getElementById("modalContainer");
    if (!modalContainer) return;
    modalContainer.innerHTML = "";
    modalContainer.style.display = "block";
    // Загружаем расписания на выбранную дату
    fetch(`schedule.php?date=${encodeURIComponent(date)}`)
        .then(r => r.json())
        .then(data => {
            const list = Array.isArray(data.schedules) ? data.schedules : data;
            const modalContent = document.createElement("div");
            modalContent.className = "modal-content";
            let html = `<h3>Отправления на ${date}</h3>`;
            if (!list || list.length === 0) {
                html += `<p>Нет отправлений.</p>`;
            } else {
                list.forEach(sh => {
                    html += `<div class="shipment-list-item">
                        <span class="route">${sh.city || '—'} → ${sh.warehouses || '—'}</span>
                        <span class="status">${sh.status || ''}</span>
                        <button class="details-btn">Подробнее</button>
                    </div>`;
                });
            }
            modalContent.innerHTML = html;
            // Добавляем события на кнопки "Подробнее"
            const buttons = modalContent.querySelectorAll(".details-btn");
            buttons.forEach((btn, idx) => {
                btn.addEventListener("click", () => {
                    const sh = list[idx];
                    if (typeof openSingleShipmentModal === 'function') openSingleShipmentModal(sh);
                });
            });
            modalContainer.appendChild(modalContent);
        })
        .catch(err => {
            modalContainer.innerHTML = `<div class="modal-content"><p>Ошибка загрузки отправлений: ${err.message}</p></div>`;
        });
}

// Экспортируем функции в глобальный объект window
window.renderStaticCalendar = renderStaticCalendar;
window.fetchDataAndUpdateCalendar = fetchDataAndUpdateCalendar;
window.updateCalendarWithData = updateCalendarWithData;
window.changeMonth = changeMonth;
window.onWarehouseChange = onWarehouseChange;
window.openShipmentsForDate = openShipmentsForDate;
