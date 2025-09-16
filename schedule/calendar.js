import { state } from './state.js';
import { getFullDate, getStatusDotColor } from './utils.js';

function isDateToday(dateStr) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
}

export function renderStaticCalendar() {
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    const currentMonthYearElem = document.getElementById('currentMonthYear');
    if (currentMonthYearElem) {
        currentMonthYearElem.textContent = `${monthNames[state.calendarCurrentDate.getMonth()]} ${state.calendarCurrentDate.getFullYear()}`;
    }

    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) {
        return;
    }
    calendarGrid.innerHTML = '';

    const firstDay = new Date(state.calendarCurrentDate.getFullYear(), state.calendarCurrentDate.getMonth(), 1);
    const lastDay = new Date(state.calendarCurrentDate.getFullYear(), state.calendarCurrentDate.getMonth() + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 7 : firstDay.getDay();

    const prevMonthLast = new Date(state.calendarCurrentDate.getFullYear(), state.calendarCurrentDate.getMonth(), 0).getDate();
    for (let i = 1; i < startDay; i++) {
        const dayNum = prevMonthLast - (startDay - i) + 1;
        calendarGrid.innerHTML += `
            <div class="calendar-cell" data-date="${getFullDate(state.calendarCurrentDate.getFullYear(), state.calendarCurrentDate.getMonth() - 1, dayNum)}">
                <div class="cell-date">${dayNum}</div>
            </div>
        `;
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const fullDate = `${state.calendarCurrentDate.getFullYear()}-${String(state.calendarCurrentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = isDateToday(fullDate);
        const cellClass = isToday ? 'calendar-cell today' : 'calendar-cell';
        calendarGrid.innerHTML += `
            <div class="${cellClass}" data-date="${fullDate}" onclick="openShipmentsForDate('${fullDate}')">
                <div class="cell-date">${day}</div>
            </div>
        `;
    }

    const nextMonthDate = new Date(state.calendarCurrentDate.getFullYear(), state.calendarCurrentDate.getMonth() + 1, 1);
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

export function fetchDataAndUpdateCalendar() {
    const url = `schedule.php${state.activeWarehouseFilter ? `?warehouse=${encodeURIComponent(state.activeWarehouseFilter)}` : ''}`;
    fetch(url)
        .then(async r => {
            if (!r.ok) {
                throw new Error('Ошибка загрузки расписания: ' + r.status);
            }
            const ct = r.headers.get('Content-Type') || '';
            if (!ct.includes('application/json')) {
                const txt = await r.text();
                throw new Error('Сервер вернул не JSON: ' + txt.slice(0, 200));
            }
            try {
                return await r.json();
            } catch (e) {
                throw new Error('Ошибка парсинга JSON: ' + e.message);
            }
        })
        .then(data => {
            const shipmentsByDate = {};
            data.forEach(item => {
                const d = item.accept_date;
                if (!shipmentsByDate[d]) {
                    shipmentsByDate[d] = [];
                }
                shipmentsByDate[d].push(item);
            });
            updateCalendarWithData(shipmentsByDate);
        })
        .catch(err => {
            alert('Не удалось загрузить расписание. Обратитесь в поддержку.');
            console.error('Ошибка при fetchDataAndUpdateCalendar:', err);
        });
}

export function changeMonth(offset) {
    state.calendarCurrentDate.setMonth(state.calendarCurrentDate.getMonth() + offset);
    renderStaticCalendar();
    fetchDataAndUpdateCalendar();
}

export function updateCalendarWithData(shipmentsByDate) {
    const cells = document.querySelectorAll('.calendar-cell');
    cells.forEach(cell => {
        const date = cell.getAttribute('data-date');
        const shipments = shipmentsByDate[date] || [];

        cell.innerHTML = '';
        const dateDiv = document.createElement('div');
        dateDiv.className = 'cell-date';
        dateDiv.textContent = date.split('-')[2];
        cell.appendChild(dateDiv);

        if (shipments.length > 0) {
            const firstWh = shipments[0].warehouses || '—';
            const labelText = shipments.length === 1
                ? firstWh
                : `${firstWh} +${shipments.length - 1}`;
            const dotColor = getStatusDotColor(shipments[0].status || '');

            const dot = document.createElement('div');
            dot.className = 'shipment-dot';
            dot.style.backgroundColor = dotColor;
            const labelDiv = document.createElement('div');
            labelDiv.className = 'shipment-label';
            labelDiv.textContent = labelText;

            cell.appendChild(dot);
            cell.appendChild(labelDiv);
        }

        const newCell = cell.cloneNode(true);
        newCell.addEventListener('click', () => {
            if (typeof window !== 'undefined' && typeof window.openShipmentsForDate === 'function') {
                window.openShipmentsForDate(date);
            }
        });
        cell.replaceWith(newCell);
    });
}
